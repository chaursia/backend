const express = require('express');
const router = express.Router();

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ITS Backend API Documentation</title>
    <style>
        :root {
            --bg-color: #0f172a;
            --text-color: #cbd5e1;
            --card-bg: #1e293b;
            --accent: #38bdf8;
            --border: #334155;
            --method-get: #10b981;
            --method-post: #f59e0b;
        }
        body {
            font-family: 'Segoe UI', system-ui, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 2rem;
            line-height: 1.6;
        }
        h1 {
            color: #f8fafc;
            border-bottom: 2px solid var(--border);
            padding-bottom: 0.5rem;
            font-size: 2.5rem;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
        }
        .endpoint {
            background-color: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .endpoint h3 {
            margin-top: 0;
            color: #f8fafc;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .method {
            padding: 0.2rem 0.6rem;
            border-radius: 4px;
            font-size: 0.9rem;
            font-weight: bold;
            color: #fff;
        }
        .get { background-color: var(--method-get); }
        .post { background-color: var(--method-post); }
        .path {
            font-family: monospace;
            color: var(--accent);
            font-size: 1.2rem;
        }
        .description {
            margin: 1rem 0;
        }
        .headers, .params {
            background-color: #0f172a;
            padding: 1rem;
            border-radius: 6px;
            border: 1px solid var(--border);
            margin-top: 1rem;
        }
        .headers p, .params p {
            margin: 0 0 0.5rem 0;
            font-weight: bold;
            color: #94a3b8;
        }
        code {
            color: #f472b6;
            font-family: monospace;
            background: #334155;
            padding: 2px 4px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 ITS Backend API Docs</h1>
        <p>Welcome to the official API documentation. Base URL is the root of this server.</p>

        <!-- Auth Endpoints -->
        <h2>Authentication</h2>
        
        <div class="endpoint">
            <h3><span class="method post">POST</span> <span class="path">/auth/login</span></h3>
            <p class="description">Authenticates a user via the college system and returns an encrypted session token.</p>
            <div class="params">
                <p>Body Parameters (JSON):</p>
                <code>email</code>: College email address<br>
                <code>password</code>: College password
            </div>
            <div class="headers">
                <p>Returns:</p>
                <code>sessionId</code>: You must pass this exact string as <code>x-session-id</code> header in all <span class="path">/api/*</span> requests!
            </div>
        </div>

        <div class="endpoint">
            <h3><span class="method post">POST</span> <span class="path">/auth/logout</span></h3>
            <p class="description">Terminates the local frontend session logic.</p>
        </div>

        <!-- College API Endpoints -->
        <h2>College Data Endpoints</h2>
        <p><i>⚠️ All endpoints below <strong>require</strong> the <code>x-session-id</code> header mapping to your login token.</i></p>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/profile</span></h3>
            <p class="description">Fetches the securely authenticated student's full profile and demographic information.</p>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/attendance/overall</span></h3>
            <p class="description">Retrieves the total consolidated academic attendance statistics for the current student.</p>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/attendance/monthly</span></h3>
            <p class="description">Retrieves attendance breakdown mapped specifically to a single month.</p>
            <div class="params">
                <p>Query Parameters:</p>
                <code>month</code> (required): Numeric month string (e.g., "04" for April)<br>
                <code>session</code> (optional): Defaults to "2025-2026"
            </div>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/notifications</span></h3>
            <p class="description">Fetches the latest real-time college notifications and portal alerts.</p>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/information</span></h3>
            <p class="description">Fetches general administrative college bulletin items and info-board postings.</p>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/timetable</span></h3>
            <p class="description">Retrieves the student's personal weekly course timetable.</p>
            <div class="params">
                <p>Query Parameters:</p>
                <code>session</code> (optional): Defaults to "2025-2026"<br>
                <code>id</code> (optional): Maps to schedule group, defaults to "14"
            </div>
        </div>

        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/api/calendar</span></h3>
            <p class="description">Retrieves the official college academic calendar for the holistic year.</p>
            <div class="params">
                <p>Query Parameters:</p>
                <code>session</code> (optional): Defaults to "2025-2026"<br>
                <code>title</code> (optional): Filter keyword
            </div>
        </div>

        <!-- App Ecosystem Endpoints -->
        <h2>System Ecosystem</h2>
        
        <div class="endpoint">
            <h3><span class="method get">GET</span> <span class="path">/app/version</span></h3>
            <p class="description">Allows the native app frontends to safely check if they need a forced downloaded OTA update.</p>
            <div class="headers">
                <p>Returns:</p>
                JSON Payload detailing <code>version</code>, <code>force</code>, <code>message</code>, and <code>downloadUrl</code> from Vercel securely.
            </div>
        </div>

    </div>
</body>
</html>
`;

router.get('/', (req, res) => {
    res.send(htmlContent);
});

module.exports = router;
