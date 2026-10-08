const express = require('express');
const { db, supabase } = require('../db');
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

        // Read-only check. This was an UPDATE on every GET, which turned a
        // read path into a write path (write amplification / row-lock pressure).
        // DAU tracking already happens in /auth/me and the /api middleware.
        const userRes = await db.execute({
            sql: "SELECT college_id FROM users WHERE id = ?",
            args: [session.user_id]
        });

        if (userRes.rows.length === 0) {
            return res.status(403).json({ error: 'Your account has been deleted by an administrator.' });
        }

        const collegeId = userRes.rows[0].college_id;

        const [settingsRes, banRes] = await Promise.all([
            supabase.from('feature_settings').select('maintenance_mode, maintenance_message').eq('id', 1).single(),
            supabase.from('user_bans').select('reason').eq('college_id', collegeId).eq('is_active', true).maybeSingle()
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

        // Note: the concatenated fragments below are static literals; the
        // user-controlled value is only ever bound through args. Keep it that
        // way — do not interpolate `search` into the SQL string.
        // Explicit column list: SELECT * would expose any future internal column.
        let sql = 'SELECT id, employee_id, name, designation, department, email, phone, qualification, specialization, profile_image, is_active, created_at FROM faculty WHERE is_active = 1';
        if (search) {
            // Escape LIKE wildcards and cap length so a pathological pattern
            // cannot force a full scan. This endpoint had no LIMIT at all.
            const term = String(search).slice(0, 50).replace(/[\\%_]/g, ch => '\\' + ch);
            const pattern = `%${term}%`;
            sql += " AND (name LIKE ? ESCAPE '\\' OR employee_id LIKE ? ESCAPE '\\' OR designation LIKE ? ESCAPE '\\')";
            args.push(pattern, pattern, pattern);
        }
        sql += ' ORDER BY name ASC LIMIT 200';

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