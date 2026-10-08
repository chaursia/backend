const express = require('express');
const { db, supabase } = require('../db');
const sessionStore = require('../utils/sessionStore');

const router = express.Router();

// GET /app/version
// Strictly reads from Supabase app_settings table (managed via Admin Panel).
router.get('/version', async (req, res) => {
    try {
        // Source of Truth: Supabase DB (Managed by Admin Panel)
        const { data, error } = await supabase
            .from('app_settings')
            .select('version, force, message, download_url')
            .eq('is_current', true)
            .maybeSingle();

        if (error) throw error;

        if (data) {
            return res.json({
                version:     data.version,
                force:       data.force === true,
                message:     data.message,
                downloadUrl: data.download_url,
            });
        }
        
        // Catastrophic Fallback: Only if DB table is empty
        return res.json({
            version: '1.0.0',
            force: false,
            message: 'Software is up to date.',
            downloadUrl: '#'
        });

    } catch (e) {
        console.error('CRITICAL: Version check failed:', e.message);
        // Return a safe response to prevent app crash
        res.status(500).json({
            error: 'Server Error',
            message: 'Unable to verify application version'
        });
    }
});

// GET /app/features
// Public endpoint for the mobile app to check UI toggles & maintenance status
router.get('/features', async (req, res) => {
    try {
        // Explicit column allow-list. `select('*')` published the entire
        // feature_settings row unauthenticated, so any internal column added
        // later (admin notes, config) would leak automatically.
        const { data, error } = await supabase
            .from('feature_settings')
            .select('qr_enabled, barcode_enabled, login_enabled, maintenance_mode, maintenance_message')
            .eq('id', 1)
            .single();

        if (error) throw error;

        return res.json(data);
    } catch (e) {
        console.error('CRITICAL: Feature check failed:', e.message);
        // Fail CLOSED. This previously returned a fully permissive state, so
        // anyone who could induce a Supabase error disabled the admin kill
        // switch for every client that trusts this endpoint. Maintenance mode
        // and disabled-login are the safe defaults during an outage.
        return res.json({
            qr_enabled: false,
            barcode_enabled: false,
            login_enabled: true,
            maintenance_mode: true,
            maintenance_message: "Unable to reach the server. Please try again shortly."
        });
    }
});

// GET /app/announcements
// Returns all currently published announcements, newest first
router.get('/announcements', async (req, res) => {
    try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
            .from('announcements')
            .select('id, title, body, target_course, target_branch, target_semester, publish_at')
            .or(`publish_at.is.null,publish_at.lte.${now}`)
            .order('publish_at', { ascending: false, nullsFirst: true })
            // Bounded: this previously returned every announcement ever published.
            .limit(100);

        if (error) throw error;

        // Audience scoping. target_course / target_branch / target_semester were
        // returned to every caller, disclosing announcements aimed at other
        // sections and years. Untargeted announcements (all three null/empty) go
        // to everyone; otherwise the caller's own course/branch/semester must match.
        let rows = data || [];

        const sessionId = req.headers['x-session-id'] || req.headers['authorization'];
        let caller = null;

        if (sessionId) {
            try {
                let sid = String(sessionId);
                if (sid.toLowerCase().startsWith('bearer ')) sid = sid.slice(7);
                const session = sessionStore.decrypt(sid);
                if (session && session.user_id) {
                    const userRes = await db.execute({
                        sql: 'SELECT course, branch, semester FROM users WHERE id = ?',
                        args: [session.user_id]
                    });
                    if (userRes.rows.length > 0) caller = userRes.rows[0];
                }
            } catch (e) {
                // Unreadable session: treat as anonymous rather than failing the request.
                caller = null;
            }
        }

        const normalise = (v) => (v == null ? '' : String(v).trim().toLowerCase());

        rows = rows.filter(row => {
            const hasTarget = normalise(row.target_course) || normalise(row.target_branch) || normalise(row.target_semester);
            if (!hasTarget) return true; // broadcast

            // Targeted content requires a known caller; otherwise withhold it.
            if (!caller) return false;

            const targetCourse = normalise(row.target_course);
            const targetBranch = normalise(row.target_branch);
            const targetSemester = normalise(row.target_semester);

            if (targetCourse && !normalise(caller.course).includes(targetCourse) && !targetCourse.includes(normalise(caller.course))) return false;
            if (targetBranch && !normalise(caller.branch).includes(targetBranch) && !targetBranch.includes(normalise(caller.branch))) return false;
            if (targetSemester && normalise(caller.semester) !== targetSemester) return false;

            return true;
        });

        return res.json(rows);
    } catch (e) {
        console.error('Announcements fetch failed:', e.message);
        return res.json([]);
    }
});

module.exports = router;
