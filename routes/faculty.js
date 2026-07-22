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
    req.sessionId = sessionId;

    try {
        const session = sessionStore.decrypt(sessionId);
        if (!session || !session.user_id) {
            return res.status(401).json({ error: 'Invalid or malformed session footprint.' });
        }

        const userRes = await db.execute({
            sql: "UPDATE users SET last_active_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING college_id",
            args: [session.user_id]
        });

        if (userRes.rows.length === 0) {
            return res.status(403).json({ error: 'Your account has been deleted by an administrator.' });
        }

        const collegeId = userRes.rows[0].college_id;

        const [settingsRes, banRes] = await Promise.all([
            require('../db').supabase.from('feature_settings').select('maintenance_mode, maintenance_message').eq('id', 1).single(),
            require('../db').supabase.from('user_bans').select('reason').eq('college_id', collegeId).eq('is_active', true).maybeSingle()
        ]);

        if (settingsRes.data && settingsRes.data.maintenance_mode) {
            return res.status(503).json({ error: settingsRes.data.maintenance_message || 'System is currently under maintenance.' });
        }

        if (banRes.data) {
            return res.status(403).json({ error: 'Your account is suspended.', reason: banRes.data.reason });
        }

    } catch(err) {
        console.error('Faculty API Verification Error:', err.message);
        return res.status(401).json({ error: 'Session verification failed.' });
    }
    
    next();
});

router.get('/', async (req, res) => {
    try {
        const { search } = req.query;
        const args = [];

        let sql = 'SELECT * FROM faculty WHERE is_active = 1';
        if (search) {
            const pattern = `%${search}%`;
            sql += ' AND (name LIKE ? OR employee_id LIKE ? OR designation LIKE ?)';
            args.push(pattern, pattern, pattern);
        }
        sql += ' ORDER BY name ASC';

        const dataRes = await db.execute({ sql, args });
        res.json({ faculty: dataRes.rows });
    } catch (error) {
        handleError(res, error);
    }
});

router.get('/:id', async (req, res) => {
    try {
        const result = await db.execute({
            sql: 'SELECT * FROM faculty WHERE id = ? AND is_active = 1',
            args: [req.params.id]
        });

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Faculty member not found' });
        }

        res.json({ faculty: result.rows[0] });
    } catch (error) {
        handleError(res, error);
    }
});

module.exports = router;