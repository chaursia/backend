const express = require('express');
const { db } = require('../db');
const sessionStore = require('../utils/sessionStore');
const { getUploadAuth: getB2UploadAuth, getDownloadUrl: getB2DownloadUrl, deleteFile: deleteFromB2 } = require('../services/b2Service');

const router = express.Router();

const handleError = (res, error) => {
    if (error.message.includes('Session expired') || error.message.includes('Invalid')) {
        return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
};

const MAX_DOCS_PER_USER = 20;

async function isAdmin(userId) {
    const configRes = await db.execute({
        sql: "SELECT value FROM app_config WHERE key = 'library_admins'"
    });
    const adminIdsStr = configRes.rows[0]?.value || '';
    const adminIds = adminIdsStr.split(',').map(s => s.trim()).filter(Boolean);
    return adminIds.includes(String(userId));
}

router.use(async (req, res, next) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) {
        return res.status(401).json({ error: 'Unauthorized: Missing x-session-id header.' });
    }

    try {
        const session = sessionStore.decrypt(sessionId);
        if (!session || !session.user_id) {
            return res.status(401).json({ error: 'Invalid session.' });
        }

        const userRes = await db.execute({
            sql: 'SELECT id, name, roll_no, profile_image, college_id FROM users WHERE id = ?',
            args: [session.user_id]
        });

        if (userRes.rows.length === 0) {
            return res.status(403).json({ error: 'Account not found.' });
        }

        req.user = userRes.rows[0];
    } catch (err) {
        return res.status(401).json({ error: 'Session verification failed.' });
    }

    next();
});

// GET /api/library/upload/auth — B2 upload credentials
router.get('/upload/auth', async (req, res) => {
    try {
        const auth = await getB2UploadAuth();
        if (!auth) return res.status(500).json({ error: 'B2 not configured.' });
        res.json(auth);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST /api/library/documents — confirm upload and save to DB
router.post('/documents', async (req, res) => {
    try {
        const { caption, b2_file_name, b2_file_id, mime_type, file_size } = req.body;

        if (!caption || !caption.trim()) {
            return res.status(400).json({ error: 'Caption is required.' });
        }
        if (!b2_file_name) {
            return res.status(400).json({ error: 'File name is required.' });
        }

        // Check per-user limit (admins bypass)
        const adminUser = await isAdmin(req.user.id);
        if (!adminUser) {
            const countRes = await db.execute({
                sql: 'SELECT COUNT(*) as count FROM library_documents WHERE user_id = ?',
                args: [req.user.id]
            });
            const currentCount = countRes.rows[0]?.count || 0;
            if (currentCount >= MAX_DOCS_PER_USER) {
                return res.status(403).json({ error: `Upload limit reached. You can upload up to ${MAX_DOCS_PER_USER} documents.` });
            }
        }

        const result = await db.execute({
            sql: `INSERT INTO library_documents (user_id, user_name, caption, b2_file_name, b2_file_id, mime_type, file_size)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [
                req.user.id, req.user.name || 'Unknown',
                caption.trim(), b2_file_name, b2_file_id || null,
                mime_type || 'application/octet-stream', file_size || 0
            ]
        });

        const newDoc = await db.execute({
            sql: 'SELECT * FROM library_documents WHERE id = ?',
            args: [result.lastInsertRowid]
        });

        res.status(201).json({ document: newDoc.rows[0] });
    } catch (error) { handleError(res, error); }
});

// GET /api/library/documents — list all documents with user names
router.get('/documents', async (req, res) => {
    try {
        const docsRes = await db.execute({
            sql: `SELECT ld.*, u.profile_image as uploader_image
                  FROM library_documents ld
                  LEFT JOIN users u ON ld.user_id = u.id
                  ORDER BY ld.created_at DESC`
        });
        res.json({ documents: docsRes.rows });
    } catch (error) { handleError(res, error); }
});

// DELETE /api/library/documents/:id — admin delete only
router.delete('/documents/:id', async (req, res) => {
    try {
        if (!(await isAdmin(req.user.id))) {
            return res.status(403).json({ error: 'Only admins can delete documents.' });
        }

        const docRes = await db.execute({
            sql: 'SELECT id, b2_file_name, b2_file_id FROM library_documents WHERE id = ?',
            args: [req.params.id]
        });

        if (docRes.rows.length === 0) {
            return res.status(404).json({ error: 'Document not found.' });
        }

        const doc = docRes.rows[0];

        // Delete from B2
        if (doc.b2_file_id && doc.b2_file_name) {
            await deleteFromB2(doc.b2_file_id, doc.b2_file_name).catch(e => console.error('B2 delete failed:', e.message));
        }

        await db.execute({
            sql: 'DELETE FROM library_documents WHERE id = ?',
            args: [req.params.id]
        });

        res.json({ success: true });
    } catch (error) { handleError(res, error); }
});

// GET /api/library/download — return signed B2 download URL
router.get('/download', async (req, res) => {
    try {
        const fileName = req.query.fileName;
        if (!fileName) return res.status(400).json({ error: 'Missing fileName query parameter' });
        const downloadUrl = await getB2DownloadUrl(fileName);
        res.json({ url: downloadUrl, fileName: fileName });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/library/documents/count — get current user's document count
router.get('/documents/count', async (req, res) => {
    try {
        const adminUser = await isAdmin(req.user.id);
        const countRes = await db.execute({
            sql: 'SELECT COUNT(*) as count FROM library_documents WHERE user_id = ?',
            args: [req.user.id]
        });
        res.json({ count: countRes.rows[0]?.count || 0, max: adminUser ? 999999 : MAX_DOCS_PER_USER });
    } catch (error) { handleError(res, error); }
});

module.exports = router;
