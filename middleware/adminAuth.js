const { createSupabaseServerClient } = require('../utils/supabaseServer');

/**
 * Emails permitted to use the admin panel.
 *
 * Previously this was an object keyed by OAuth provider
 * ({ discord: [...], github: [...] }). Admin login is now email + password, so
 * a single flat list is all that is needed.
 *
 * Override with the ADMIN_EMAILS env var (comma-separated) so the allowlist is
 * not compiled into source and can be rotated without a deploy.
 */
function getAuthorizedAdminEmails() {
    const fromEnv = process.env.ADMIN_EMAILS;
    if (fromEnv) {
        const parsed = fromEnv
            .split(',')
            .map(e => e.trim().toLowerCase())
            .filter(Boolean);
        if (parsed.length > 0) return parsed;
    }
    return ['kingshubham557@gmail.com', 'swikki099@gmail.com'];
}

/** Exact-match allowlist of paths that do not require a session. */
const PUBLIC_PATHS = new Set(['/login']);

/**
 * Middleware protecting all /admin/* routes.
 *
 * Authentication is handled by Supabase Auth (email + password sign-in issues
 * the session cookie). This middleware only verifies that a valid session exists
 * and that the account is on the admin allowlist.
 */
async function requireAdmin(req, res, next) {
    // Exact-match. This previously used `path.includes(...)`, which matches any
    // path containing those substrings in an attacker-controlled position:
    // inside router.use() req.path is router-relative, so substituting a `:id`
    // parameter with "login" bypassed authentication on 17 handlers
    // (e.g. POST /users/:id/action, POST /social/post/:id/delete).
    const path = req.path || '';
    if (PUBLIC_PATHS.has(path)) return next();

    try {
        const supabaseServer = createSupabaseServerClient(req, res);
        const { data: { user }, error } = await supabaseServer.auth.getUser();

        if (error || !user) {
            console.log('[requireAdmin] No valid session, redirecting to /admin/login');
            return res.redirect('/admin/login?error=' +
                encodeURIComponent('Please log in using your Admin account to continue.'));
        }

        const userEmail = (user.email || '').toLowerCase();
        if (!getAuthorizedAdminEmails().includes(userEmail)) {
            console.warn(`[requireAdmin] Access Denied: Email ${userEmail}`);
            // Clear the session so a rejected account cannot retry.
            await supabaseServer.auth.signOut();
            return res.redirect('/admin/login?error=' + encodeURIComponent(
                'Access denied. Your account is not authorized for this action.'
            ));
        }

        req.adminUser = user;
        next();
    } catch (err) {
        console.error('Admin auth error:', err.message);
        res.redirect('/admin/login?error=' + encodeURIComponent('Middleware Auth Error: ' + err.message));
    }
}

module.exports = { requireAdmin, getAuthorizedAdminEmails };
