const express = require('express');
const { db } = require('../db');
const sessionStore = require('../utils/sessionStore');
const { getUploadAuth: getB2UploadAuth, getDownloadUrl: getB2DownloadUrl } = require('../services/b2Service');

const router = express.Router();

/**
 * Validates a client-supplied voice-note object name.
 *
 * Only objects this app wrote (chat_voice/ prefix) may be downloaded, and the
 * name must not attempt path traversal. B2 keys may contain slashes, so
 * "../chat_voice/x" would otherwise be a valid, unintended key.
 */
function sanitizeVoiceFileName(rawName) {
    if (typeof rawName !== 'string') return null;
    const name = rawName.trim();
    if (!name || name.length > 512) return null;
    if (name.includes('..') || name.includes('//')) return null;
    // eslint-disable-next-line no-control-regex
    if (/[\u0000-\u001f\u007f]/.test(name)) return null;
    if (name.startsWith('/')) return null;
    if (!name.toLowerCase().startsWith('chat_voice/')) return null;
    return name;
}

const handleError = (res, error) => {
    if (error.message.includes('Session expired') || error.message.includes('Invalid')) {
        return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
};

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
            sql: 'SELECT id, name, roll_no, profile_image, college_id, semester, section, verify_badge FROM users WHERE id = ?',
            args: [session.user_id]
        });

        if (userRes.rows.length === 0) {
            return res.status(403).json({ error: 'Account not found.' });
        }

        req.user = userRes.rows[0];
        req.user.first_name = (req.user.name || '').split(' ')[0] || req.user.name;

        // Chat bans must honour expiry and deactivation. Previously any row matched
        // forever, so a ban could never be lifted or time out. Falls back to the
        // legacy schema if the optional columns have not been added yet.
        let banCheck;
        try {
            banCheck = await db.execute({
                sql: 'SELECT reason, is_active, expires_at FROM chat_bans WHERE user_id = ?',
                args: [req.user.id]
            });
        } catch (e) {
            banCheck = await db.execute({
                sql: 'SELECT reason FROM chat_bans WHERE user_id = ?',
                args: [req.user.id]
            });
        }

        const activeBan = banCheck.rows.find(row => {
            if (row.is_active === 0 || row.is_active === false) return false;
            if (!row.expires_at) return true;
            const expiry = new Date(row.expires_at).getTime();
            return !Number.isNaN(expiry) ? expiry > Date.now() : true;
        });

        if (activeBan) {
            return res.status(403).json({ error: 'You are banned from chat.', reason: activeBan.reason });
        }
    } catch (err) {
        return res.status(401).json({ error: 'Session verification failed.' });
    }

    next();
});

// GET /api/chat/messages — all messages, pinned first, oldest first
router.get('/messages', async (req, res) => {
    try {
        // Bounded fetch. This was `SELECT * FROM chat_messages` with no LIMIT, so
        // every poll (the app polls every 5s) loaded the entire history, and the
        // follow-up IN(...) query could exceed SQLite's variable limit as the
        // table grew. Deleted rows are excluded so soft-deleted messages stop
        // being returned at all.
        const MESSAGES_PAGE_SIZE = 200;
        const messagesRes = await db.execute({
            sql: `SELECT * FROM chat_messages
                  WHERE is_deleted = 0
                  ORDER BY is_pinned DESC, created_at ASC
                  LIMIT ${MESSAGES_PAGE_SIZE}`,
            args: []
        });

        const parentIds = [...new Set(messagesRes.rows.filter(m => m.parent_id).map(m => m.parent_id))];
        let parentMap = {};
        if (parentIds.length > 0) {
            const placeholders = parentIds.map(() => '?').join(',');
            const parentsRes = await db.execute({
                sql: `SELECT id, name, semester, section, message, is_deleted FROM chat_messages WHERE id IN (${placeholders})`,
                args: parentIds
            });
            parentsRes.rows.forEach(p => {
                parentMap[p.id] = {
                    name: p.name,
                    semester: p.semester,
                    section: p.section,
                    message: p.is_deleted ? 'message was deleted' : p.message
                };
            });
        }

        // Malformed JSON in either column would previously throw and fail the
        // entire response, so parse defensively per row.
        const safeParse = (raw, fallback) => {
            try {
                const parsed = JSON.parse(raw || '');
                return parsed ?? fallback;
            } catch (e) {
                return fallback;
            }
        };

        const messages = messagesRes.rows.map(m => ({
            ...m,
            mentions: safeParse(m.mentions, []),
            reactions: safeParse(m.reactions, {}),
            parent: m.parent_id ? (parentMap[m.parent_id] || null) : null
        }));

        res.json({ messages });
    } catch (error) { handleError(res, error); }
});

// POST /api/chat/messages — send message
router.post('/messages', async (req, res) => {
    try {
        const { message, parent_id, mentions, message_type, gif_url, sticker_url, voice_url } = req.body;

        if (!message && message_type !== 'gif' && message_type !== 'sticker' && message_type !== 'voice') {
            return res.status(400).json({ error: 'Message text is required.' });
        }
        if (message_type === 'gif' && !gif_url) {
            return res.status(400).json({ error: 'GIF URL is required.' });
        }
        if (message_type === 'sticker' && !sticker_url) {
            return res.status(400).json({ error: 'Sticker URL is required.' });
        }
        if (message_type === 'voice' && !voice_url) {
            return res.status(400).json({ error: 'Voice URL is required.' });
        }

        // message_type was previously unvalidated, so a client could send any
        // arbitrary type string, or 'text' alongside populated gif/voice URLs.
        const ALLOWED_TYPES = ['text', 'gif', 'sticker', 'voice'];
        const type = message_type || 'text';
        if (!ALLOWED_TYPES.includes(type)) {
            return res.status(400).json({ error: 'Unsupported message type.' });
        }
        if (type === 'text' && (gif_url || sticker_url || voice_url)) {
            return res.status(400).json({ error: 'Media cannot be sent with message type "text".' });
        }

        // Length caps. Without these, message/mentions could be megabytes and
        // this endpoint could be used to flood the table.
        const MAX_MESSAGE_LENGTH = 4000;
        if (typeof message === 'string' && message.length > MAX_MESSAGE_LENGTH) {
            return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
        }
        const MAX_URL_LENGTH = 1024;
        for (const [field, value] of [['gif_url', gif_url], ['sticker_url', sticker_url], ['voice_url', voice_url]]) {
            if (typeof value === 'string' && value.length > MAX_URL_LENGTH) {
                return res.status(400).json({ error: `Invalid ${field}.` });
            }
        }
        if (mentions != null && !Array.isArray(mentions)) {
            return res.status(400).json({ error: 'Invalid mentions payload.' });
        }

        // Validate parent_id instead of inserting a dangling reference. Must not
        // reference a deleted message.
        if (parent_id != null) {
            const parentLookup = await db.execute({
                sql: 'SELECT id, is_deleted FROM chat_messages WHERE id = ?',
                args: [parent_id]
            });
            if (parentLookup.rows.length === 0) {
                return res.status(400).json({ error: 'Parent message not found.' });
            }
            if (parentLookup.rows[0].is_deleted) {
                return res.status(400).json({ error: 'Cannot reply to a deleted message.' });
            }
        }

        const result = await db.execute({
            sql: `INSERT INTO chat_messages (user_id, name, roll_no, profile_image, semester, section, verify_badge, message, parent_id, mentions, message_type, gif_url, sticker_url, voice_url)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                req.user.id, req.user.first_name, req.user.roll_no || null,
                req.user.profile_image || null, req.user.semester || null,
                req.user.section || null, req.user.verify_badge ? 1 : 0, message || null,
                parent_id || null, JSON.stringify(mentions || []),
                type, gif_url || null, sticker_url || null, voice_url || null
            ]
        });

        const newMsg = await db.execute({
            sql: 'SELECT * FROM chat_messages WHERE id = ?',
            args: [result.lastInsertRowid]
        });

        const msg = newMsg.rows[0];
        try {
            msg.mentions = JSON.parse(msg.mentions || '[]');
            msg.reactions = JSON.parse(msg.reactions || '{}');
        } catch (e) {
            msg.mentions = [];
            msg.reactions = {};
        }
        msg.parent = null;

        if (msg.parent_id) {
            const parentRes = await db.execute({
                sql: 'SELECT id, name, semester, section, message, is_deleted FROM chat_messages WHERE id = ?',
                args: [msg.parent_id]
            });
            if (parentRes.rows.length > 0) {
                const p = parentRes.rows[0];
                msg.parent = {
                    name: p.name,
                    semester: p.semester,
                    section: p.section,
                    message: p.is_deleted ? 'message was deleted' : p.message
                };
            }
        }

        res.status(201).json({ message: msg });
    } catch (error) { handleError(res, error); }
});

// DELETE /api/chat/messages/:id — soft delete own message
router.delete('/messages/:id', async (req, res) => {
    try {
        const msgRes = await db.execute({
            sql: 'SELECT user_id, is_deleted FROM chat_messages WHERE id = ?',
            args: [req.params.id]
        });

        if (msgRes.rows.length === 0) {
            return res.status(404).json({ error: 'Message not found.' });
        }

        const msg = msgRes.rows[0];
        if (msg.user_id !== req.user.id) {
            return res.status(403).json({ error: 'You can only delete your own messages.' });
        }
        if (msg.is_deleted) {
            return res.status(400).json({ error: 'Message already deleted.' });
        }

        // voice_url must also be cleared: deleted voice notes stayed fully playable
        // because the audio URL survived the soft delete. mentions and reactions
        // are cleared too so a deleted message leaves no residual metadata.
        await db.execute({
            sql: `UPDATE chat_messages
                  SET is_deleted = 1,
                      message = NULL,
                      gif_url = NULL,
                      sticker_url = NULL,
                      voice_url = NULL,
                      mentions = '[]',
                      reactions = '{}'
                  WHERE id = ?`,
            args: [req.params.id]
        });

        res.json({ success: true });
    } catch (error) { handleError(res, error); }
});

// POST /api/chat/messages/:id/react — toggle emoji reaction
router.post('/messages/:id/react', async (req, res) => {
    try {
        const { emoji } = req.body;
        if (!emoji) return res.status(400).json({ error: 'Emoji is required.' });

        // Allow-list and length cap. Previously an arbitrary string was used as an
        // object key, so emoji="toString" resolved to Object.prototype.toString and
        // the following .includes() call threw, returning a 500.
        if (typeof emoji !== 'string' || emoji.length === 0 || emoji.length > 16) {
            return res.status(400).json({ error: 'Invalid emoji.' });
        }
        if (!/^[\p{Extended_Pictographic}\p{Emoji_Component}\u0020\u200d]+$/u.test(emoji)) {
            return res.status(400).json({ error: 'Invalid emoji.' });
        }

        const msgRes = await db.execute({
            sql: 'SELECT reactions, is_deleted FROM chat_messages WHERE id = ?',
            args: [req.params.id]
        });
        if (msgRes.rows.length === 0) return res.status(404).json({ error: 'Message not found.' });
        if (msgRes.rows[0].is_deleted) return res.status(400).json({ error: 'Message was deleted.' });

        // Own-property lookup only, so inherited keys can never be read or written.
        let reactions = JSON.parse(msgRes.rows[0].reactions || '{}');
        if (reactions === null || typeof reactions !== 'object' || Array.isArray(reactions)) {
            reactions = {};
        }
        const userId = String(req.user.id);

        const alreadyReactedWithThis =
            Object.prototype.hasOwnProperty.call(reactions, emoji) &&
            Array.isArray(reactions[emoji]) &&
            reactions[emoji].includes(userId);

        if (alreadyReactedWithThis) {
            // Toggle off: the old code removed the user and then unconditionally
            // re-added them, so the same emoji could never be un-reacted.
            const remaining = reactions[emoji].filter(id => id !== userId);
            if (remaining.length > 0) {
                reactions[emoji] = remaining;
            } else {
                delete reactions[emoji];
            }
        } else {
            // Switch: drop any previous reaction, then add this one.
            for (const key of Object.keys(reactions)) {
                if (!Array.isArray(reactions[key])) { delete reactions[key]; continue; }
                reactions[key] = reactions[key].filter(id => id !== userId);
                if (reactions[key].length === 0) delete reactions[key];
            }
            if (!Object.prototype.hasOwnProperty.call(reactions, emoji)) reactions[emoji] = [];
            reactions[emoji].push(userId);
        }

        await db.execute({
            sql: 'UPDATE chat_messages SET reactions = ? WHERE id = ?',
            args: [JSON.stringify(reactions), req.params.id]
        });

        res.json({ reactions });
    } catch (error) { handleError(res, error); }
});

// GET /api/chat/users — search users for @mention autocomplete
router.get('/users', async (req, res) => {
    try {
        const raw = req.query.q || '';
        const q = String(raw).slice(0, 50);
        // Escape LIKE wildcards so a search for "%" cannot match every row.
        const escaped = q.replace(/[\\%_]/g, ch => '\\' + ch);

        // Scoped to the caller's own college. Previously any authenticated user
        // could enumerate name/roll_no/photo/semester/section of every student at
        // every other college, which is a cross-tenant data leak.
        const result = await db.execute({
            sql: q
                ? `SELECT id, name, roll_no, profile_image, semester, section
                   FROM users
                   WHERE college_id = ? AND name LIKE ? ESCAPE '\\'
                   ORDER BY name ASC LIMIT 20`
                : `SELECT id, name, roll_no, profile_image, semester, section
                   FROM users
                   WHERE college_id = ?
                   ORDER BY name ASC LIMIT 20`,
            args: q ? [req.user.college_id, `%${escaped}%`] : [req.user.college_id]
        });
        res.json({ users: result.rows });
    } catch (error) { handleError(res, error); }
});

// GET /api/chat/greeting — check if bot already greeted this user
router.get('/greeting', async (req, res) => {
    try {
        const msgRes = await db.execute({
            sql: "SELECT id FROM chat_messages WHERE user_id = ? AND message_type = 'bot_greeting'",
            args: [req.user.id]
        });
        res.json({ needsGreeting: msgRes.rows.length === 0 });
    } catch (error) { handleError(res, error); }
});

// GET /api/chat/upload/voice/auth — B2 upload credentials for voice messages
router.get('/upload/voice/auth', async (req, res) => {
    try {
        const auth = await getB2UploadAuth();
        if (!auth) return res.status(500).json({ error: 'B2 not configured.' });
        res.json(auth);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET /api/chat/voice — return signed B2 download URL (client downloads directly from B2)
router.get('/voice', async (req, res) => {
    try {
        const fileName = req.query.fileName;
        if (!fileName) return res.status(400).json({ error: 'Missing fileName query parameter' });

        // BOLA guard. The raw query value used to go straight to
        // getB2DownloadUrl(), so any authenticated user could mint a signed URL
        // for any object in the bucket, including other users' documents and
        // voice notes. Constrain to this app's voice-note prefix.
        const safeName = sanitizeVoiceFileName(String(fileName));
        if (!safeName) {
            return res.status(403).json({ error: 'Access denied for this file.' });
        }

        const downloadUrl = await getB2DownloadUrl(safeName);
        if (!downloadUrl) return res.status(404).json({ error: 'File not found.' });

        res.json({ url: downloadUrl, fileName: safeName });
    } catch (e) {
        console.error('[voice] Error:', e.message);
        res.status(500).json({ error: 'Failed to generate download URL.' });
    }
});

module.exports = router;
