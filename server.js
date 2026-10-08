require('dotenv').config();
require('./utils/logger'); // Start capturing terminal logs immediately
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');

// Import modular routes
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');
const appRoutes = require('./routes/app');
const idRoutes = require('./routes/id');
const profileRoutes = require('./routes/profile');
const facultyRoutes = require('./routes/faculty');
const adminRoutes = require('./routes/admin');
const { logActivity } = require('./utils/activityLogger');

const app = express();
const PORT = process.env.PORT || 3000;

// View Engine Setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Trust Vercel's HTTPS proxy for correct req.protocol and cookies
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true })); // to parse form bodies
app.use(cookieParser());

// NOTE: the "Smart Redirect" middleware that forwarded a stray ?code= to
// /admin/auth/callback was removed with the OAuth flow. Admin login is now
// email + password, so there is no OAuth callback to forward to. It also
// interpolated an unvalidated query parameter into a Location header.

// Active Request Logger (shows up in your Admin Server Logs)
app.use((req, res, next) => {
    if (!req.url.match(/\.(css|js|png|jpg|jpeg|gif|ico|svg)$/)) {
        console.log(`[HTTP] ${req.method} ${req.url}`);
    }
    next();
});

// Routes
// Anything interacting directly with tokens or authorization logic bypasses /api
app.use('/auth', authRoutes);

// General data endpoints protected by custom generic session headers
app.use('/api', apiRoutes);

// App update endpoint for version checking
app.use('/app', appRoutes);

// Digital Student ID QR system
app.use('/id', idRoutes);

// Profile completion system
app.use('/profile', profileRoutes);

// Faculty Directory (App API)
app.use('/api/faculty', facultyRoutes);

// Social Campus Feed
app.use('/social', require('./routes/social'));

// Chat System
app.use('/api/chat', require('./routes/chat'));

// Library / Document Upload System
app.use('/api/library', require('./routes/library'));

// Admin Dashboard UI (Server-Side Rendered)
app.use('/admin', adminRoutes);

// System Documentation Hub (Public)
app.use('/docs', require('./routes/docs'));

// Root Endpoint for deployment verification
app.get('/', (req, res) => {
    res.json({
        status: "success",
        message: "ITS College Backend API is successfully running on Vercel 🚀",
        endpoints: ["/auth/login", "/auth/logout", "/api/profile", "/api/attendance/overall", "/api/timetable", "/api/faculty", "/api/faculty/:id"]
    });
});

// Global unhandled error handler
app.use((err, req, res, next) => {
    console.error('[System Fault Error]', err);
    res.status(500).json({ error: 'Internal Server Architecture Error', message: err.message });
});

// Process-level crash catchers (prints to terminal before dying)
process.on('uncaughtException', (err) => {
    console.error('\n🚨 FATAL CRASH: Uncaught Exception 🚨\n', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('\n🚨 FATAL CRASH: Unhandled Promise Rejection 🚨\n', reason);
});

/**
 * Deletes chat messages older than 7 days.
 *
 * Exposed as a route (guarded by a shared secret) so it can be driven by Vercel
 * Cron in production. It previously lived inside `if (require.main === module)`,
 * which is false under Vercel because every request is routed through
 * api/index.js — so chat_messages grew without bound forever in production.
 */
const CLEANUP_SECRET = process.env.CLEANUP_SECRET;

app.post('/internal/cleanup-chat', async (req, res) => {
    // If no secret is configured the endpoint stays disabled rather than open.
    if (!CLEANUP_SECRET) {
        return res.status(503).json({ error: 'Cleanup endpoint not configured.' });
    }
    const provided = req.headers['x-cleanup-secret'] || req.query.secret;
    if (!provided || provided !== CLEANUP_SECRET) {
        return res.status(401).json({ error: 'Unauthorized.' });
    }

    try {
        const { db } = require('./db');
        const result = await db.execute({
            sql: "DELETE FROM chat_messages WHERE created_at < datetime('now', '-7 days')"
        });
        console.log(`🧹 Cleaned ${result.rowsAffected || 0} old chat messages (>7 days)`);
        res.json({ success: true, deleted: result.rowsAffected || 0 });
    } catch (e) {
        console.error('Chat cleanup failed:', e.message);
        res.status(500).json({ error: 'Cleanup failed.' });
    }
});

if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`✅ Production-Ready Refactored Backend Server running on http://localhost:${PORT}`);

        // Log startup to activity feed
        logActivity('system', 'System Online', 'Backend server started successfully.', {
            icon: 'zap',
            color: 'green'
        }).catch(() => {});

        // Local/dev retention sweep. In production this runs via Vercel Cron
        // against /internal/cleanup-chat (see vercel.json crons).
        const { db } = require('./db');
        async function cleanOldMessages() {
            try {
                const result = await db.execute({
                    sql: "DELETE FROM chat_messages WHERE created_at < datetime('now', '-7 days')"
                });
                if (result.rowsAffected > 0) {
                    console.log(`🧹 Cleaned ${result.rowsAffected} old chat messages (>7 days)`);
                }
            } catch (e) { /* silent */ }
        }
        cleanOldMessages();
        setInterval(cleanOldMessages, 60 * 60 * 1000);
    });
}

module.exports = app;
