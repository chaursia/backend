# Changelog - ITS Backend

All notable changes to this project made on 2026-04-11 will be documented in this file.

## [2026-04-11]

### Added
- **Discord OAuth Integration**: Implemented secure admin login using Discord via Supabase Auth.
- **Admin Dashboard**: Created a comprehensive web-based admin panel using EJS templating.
    - Dashboard overview with real-time statistics.
    - User management system (View, Edit, Delete, Ban).
    - App configuration management (Version control, Force update toggle).
    - Announcement system (Create, View, Delete).
    - System Health monitoring page.
- **Admin Authentication Middleware**: Added `requireAdmin` middleware to protect all `/admin` routes with session verification and Email Allowlist (`kingshubham557@gmail.com`).
- **Server Logging System**:
    - Developed an in-memory console logger (`utils/logger.js`) to capture terminal output.
    - Added a real-time "Server Logs" page in the Admin Panel to monitor server activity and errors via browser.
    - Implemented HTTP request logging middleware for traffic visibility.
- **Daily Active Users (DAU) Tracking**:
    - Added `last_active_at` tracking to the Turso database.
    - Integrated automatic activity updates in `/auth/me` and general `/api/` middleware.
    - Added DAU metric card to the Admin Dashboard.
- **Improved Bug Diagnostics**: Added global crash handlers (`uncaughtException`, `unhandledRejection`) to `server.js` to prevent silent failures and provide better error logs.
- **User Profile Enhancements**: Added `barcode_id` field to user details, edit forms, and database update logic.

### Added (Part 2 - System Overhaul)
- **Live Real-Time Activity Feed**: Deployed a high-fidelity monitoring system using Supabase Realtime/WebSockets.
    - Streams student logins, profile syncs, admin bans, and system updates instantly.
    - Added a dedicated "Live Feed" page and a dashboard widget with pulsing activity indicators.
- **Feature Control Center (Toggles)**: Migrated global app features to the database for real-time admin control.
    - Toggles for QR Scanning, Barcode Generation, and User Login.
    - **Maintenance Mode**: A global switch to lock the app with a customizable "System Under Maintenance" message.
- **Dynamic App Update Engine**: Decoupled versioning from `.env`.
    - Administrators can now publish new versions (v2.0.0+), set force-update flags, and write release notes directly from the UI.
    - The `/app/version` endpoint now pulls from the `app_settings` database table.
- **Automated Onboarding Emails**: Integrated a welcome email trigger in `authService.js`.
    - Automatically sends a personalized email to students upon their first successful login.
    - Uses the newly seeded `admin_mail_templates` table for flexible content management.
- **Advanced Mailing Upgrades**:
    - **Targeted Mailing**: Support for individual students via Roll Number or Email.
    - **Multi-Attachment Support**: Integrated `multer` to handle up to 3 attachments (5MB each) per email.
    - **Personalization Engine**: HTML support for `{{name}}`, `{{roll_no}}`, etc.

### Changed
- **Auth Flow**: Updated mobile login (`/auth/login`) to enforce admin-initiated bans by checking the Supabase `user_bans` table.
- **Database Schema**: Updated Turso `users` table to include `barcode_id`, `profile_complete`, `profile_image`, and `last_active_at`.
- **UI/UX**: Replaced standard email/password admin login with a modern Discord OAuth flow and improved error messaging for session timeouts.
- **Auth Flow Enforcement**: Refined student login to strictly respect the `login_enabled` feature toggle and maintenance mode.
- **Database Architecture**: Seeding of `activity_feed`, `feature_settings`, `admin_mail_templates`, and `app_settings` in Supabase.
- **UI Architecture**: Standardized dashboard layout using a unified sidebar and Lucide icon implementation.

### Fixed
- **Silent Crashes**: Resolved issues where the server would exit without logs by adding explicit error catchers.
- **Dashboard Metrics**: Fixed 0/Empty DAU counts by backfilling data and ensuring correct SQL date comparisons.
- **Session Stability**: Configured Supabase SSR client for robust cookie-based session management across restarts.
- **Admin Login Logic**: Resolved the critical 404 error on `/admin/login` by re-mapping Discord OAuth callback and session exchange routes.
- **Live Stream Connectivity**: Fixed Supabase browser client initialization and icon rendering on real-time pages.
- **Version Check Loop**: Corrected the version comparison logic to prevent infinite the "Update Required" prompt once criteria are met.

## [2026-04-12]

### Added
- **Social Campus Feed (Hub) Backend**: Fully implemented a relational social media system.
    - Added `social_posts`, `post_likes`, `post_comments`, and `post_reports` to Turso DB.
    - Endpoints (`/social`) for feed pagination, posting, liking, commenting, and deleting.
- **Cloudinary Integration Engine**: 
    - Installed `cloudinary` to offload multimedia (Images/PDFs) from local servers.
    - Built a robust memory-buffer streaming system using `multer` to handle `multipart/form-data`.
- **Admin Oracle Viewer (Social Moderation)**:
    - Dedicated `/admin/social` dashboard for comprehensive feed monitoring.
    - Real-time report queue handling (Approve / Dismiss).
    - **Global Kill-Switch**: A one-click "Nuke" button that cascades deletion from the Turso database all the way to wiping the physical asset from Cloudinary servers automatically.
    - Updated Sidebar navigation to include dynamic pulsing red badges when Social Reports are pending.
- **Developer Documentation Hub**: Deployed a public `/docs` webpage designed in Tailwind to provide strict API schemas, routing structures, and proxy parameters to mobile developers.

### Changed
- **Guillotine Security System (Zero-Trust)**:
    - Upgraded `/api/*` proxies, `/auth/me`, `/id/*`, and `/profile/*` endpoints.
    - Every single request is now synchronously intercepted to check for Global Maintenance Mode, App Toggles, and Banned User suspensions, ejecting them instantly before processing to save database cycles.
