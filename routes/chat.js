const express = require('express');
const { db } = require('../db');
const sessionStore = require('../utils/sessionStore');

const router = express.Router();

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

        const banCheck = await db.execute({
            sql: 'SELECT reason FROM chat_bans WHERE user_id = ?',
            args: [req.user.id]
        });
        if (banCheck.rows.length > 0) {
            return res.status(403).json({ error: 'You are banned from chat.', reason: banCheck.rows[0].reason });
        }
    } catch (err) {
        return res.status(401).json({ error: 'Session verification failed.' });
    }

    next();
});

// GET /api/chat/messages — all messages, pinned first, oldest first
router.get('/messages', async (req, res) => {
    try {
        const messagesRes = await db.execute({
            sql: 'SELECT * FROM chat_messages ORDER BY is_pinned DESC, created_at ASC'
        });

        const parentIds = messagesRes.rows.filter(m => m.parent_id).map(m => m.parent_id);
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

        const messages = messagesRes.rows.map(m => ({
            ...m,
            mentions: JSON.parse(m.mentions || '[]'),
            reactions: JSON.parse(m.reactions || '{}'),
            parent: m.parent_id ? (parentMap[m.parent_id] || null) : null
        }));

        res.json({ messages });
    } catch (error) { handleError(res, error); }
});

// POST /api/chat/messages — send message
router.post('/messages', async (req, res) => {
    try {
        const { message, parent_id, mentions, message_type, gif_url, sticker_url } = req.body;

        if (!message && message_type !== 'gif' && message_type !== 'sticker') {
            return res.status(400).json({ error: 'Message text is required.' });
        }
        if (message_type === 'gif' && !gif_url) {
            return res.status(400).json({ error: 'GIF URL is required.' });
        }
        if (message_type === 'sticker' && !sticker_url) {
            return res.status(400).json({ error: 'Sticker URL is required.' });
        }

        const result = await db.execute({
            sql: `INSERT INTO chat_messages (user_id, name, roll_no, profile_image, semester, section, verify_badge, message, parent_id, mentions, message_type, gif_url, sticker_url)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                req.user.id, req.user.first_name, req.user.roll_no || null,
                req.user.profile_image || null, req.user.semester || null,
                req.user.section || null, req.user.verify_badge ? 1 : 0, message || null,
                parent_id || null, JSON.stringify(mentions || []),
                message_type || 'text', gif_url || null, sticker_url || null
            ]
        });

        const newMsg = await db.execute({
            sql: 'SELECT * FROM chat_messages WHERE id = ?',
            args: [result.lastInsertRowid]
        });

        const msg = newMsg.rows[0];
        msg.mentions = JSON.parse(msg.mentions || '[]');
        msg.reactions = JSON.parse(msg.reactions || '{}');
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

        await db.execute({
            sql: 'UPDATE chat_messages SET is_deleted = 1, message = NULL, gif_url = NULL, sticker_url = NULL WHERE id = ?',
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

        const msgRes = await db.execute({
            sql: 'SELECT reactions FROM chat_messages WHERE id = ?',
            args: [req.params.id]
        });
        if (msgRes.rows.length === 0) return res.status(404).json({ error: 'Message not found.' });

        const reactions = JSON.parse(msgRes.rows[0].reactions || '{}');
        const userId = String(req.user.id);

        // Remove user from any existing reaction
        for (const key of Object.keys(reactions)) {
            reactions[key] = reactions[key].filter(id => id !== userId);
            if (reactions[key].length === 0) delete reactions[key];
        }

        // If user clicked a different emoji than their previous one, add it
        if (!reactions[emoji]) reactions[emoji] = [];
        if (!reactions[emoji].includes(userId)) {
            reactions[emoji].push(userId);
        }
        // If the same emoji was clicked again, it was already removed above (toggle off)

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
        const q = req.query.q || '';
        const result = await db.execute({
            sql: q
                ? 'SELECT id, name, roll_no, profile_image, semester, section FROM users WHERE name LIKE ? ORDER BY name ASC LIMIT 20'
                : 'SELECT id, name, roll_no, profile_image, semester, section FROM users ORDER BY name ASC LIMIT 20',
            args: q ? [`%${q}%`] : []
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

module.exports = router;
