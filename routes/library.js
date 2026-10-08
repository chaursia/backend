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
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB, matches the upload limit

/**
 * Validates a client-supplied B2 object name for a library document.
 *
 * The name is later used to build a signed download URL and to call
 * deleteFromB2(), so it must be constrained to this app's own prefix and must
 * not attempt traversal.
 */
function sanitizeLibraryFileName(rawName) {
    if (typeof rawName !== 'string') return null;
    const name = rawName.trim();
    if (!name || name.length > 512) return null;
    if (name.includes('..') || name.includes('//')) return null;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(name)) return null;
    if (name.startsWith('/')) return null;
    if (!name.toLowerCase().startsWith('library_documents/')) return null;
    return name;
}

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

        // caption, b2_file_name, b2_file_id, mime_type and file_size all arrive
        // from the client. The file name is constrained to this app's own prefix
        // (the same value is later passed to deleteFromB2 and to the signed
        // download URL), and lengths/sizes are validated instead of trusted.
        const safeFileName = sanitizeLibraryFileName(b2_file_name);
        if (!safeFileName) {
            return res.status(400).json({ error: 'Invalid file name.' });
        }
        if (typeof caption !== 'string' || caption.trim().length === 0) {
            return res.status(400).json({ error: 'Caption is required.' });
        }
        if (caption.length > 300) {
            return res.status(400).json({ error: 'Caption is too long (max 300 characters).' });
        }
        if (typeof mime_type === 'string' && !/^[a-z]+\/[a-z0-9.+-]{1,100}$/i.test(mime_type)) {
            return res.status(400).json({ error: 'Invalid MIME type.' });
        }
        const parsedSize = Number(file_size);
        if (file_size != null && (!Number.isFinite(parsedSize) || parsedSize < 0 || parsedSize > MAX_FILE_SIZE_BYTES)) {
            return res.status(400).json({ error: 'Invalid file size.' });
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
                caption.trim(), safeFileName, b2_file_id || null,
                mime_type || 'application/octet-stream',
                Number.isFinite(parsedSize) ? Math.floor(parsedSize) : 0
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
                  ORDER BY ld.created_at DESC
                  LIMIT 200`
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

        // Delete from B2. Re-validate the stored name: it originated from
        // req.body, so older rows may contain an out-of-prefix value.
        if (doc.b2_file_id && doc.b2_file_name) {
            const safeName = sanitizeLibraryFileName(doc.b2_file_name);
            if (safeName) {
                await deleteFromB2(doc.b2_file_id, safeName).catch(e => console.error('B2 delete failed:', e.message));
            } else {
                console.warn(`B2 delete skipped for document ${req.params.id}: disallowed name "${doc.b2_file_name}"`);
            }
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

        // BOLA guard. The raw query value used to be passed straight to
        // getB2DownloadUrl(), so any authenticated student could mint a signed
        // URL for any object in the bucket. Constrain to this app's prefix.
        const safeName = sanitizeLibraryFileName(String(fileName));
        if (!safeName) {
            return res.status(403).json({ error: 'Access denied for this file.' });
        }

        const downloadUrl = await getB2DownloadUrl(safeName);
        if (!downloadUrl) return res.status(404).json({ error: 'File not found.' });

        // Deliberately not echoing the raw client input.
        res.json({ url: downloadUrl, fileName: safeName });
    } catch (e) {
        console.error('Library download failed:', e.message);
        res.status(500).json({ error: 'Failed to generate download URL.' });
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
