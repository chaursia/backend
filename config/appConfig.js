require('dotenv').config();

/** Academic sessions are stored as text in app_config. */
const ACADEMIC_SESSION_KEY = 'academic_session';

const SESSION_PATTERN = /^\d{4}-\d{4}$/;

/**
 * Derives the academic session (e.g. "2026-2027") from today's date.
 *
 * The Indian academic year runs June–May, so January–May still belong to the
 * session that began the previous June. This is only the fallback used when no
 * value has been saved in the admin panel.
 */
function deriveAcademicSession(now = new Date()) {
    const currentYear = now.getFullYear();
    // getMonth() is 0-based; 5 === June.
    const startYear = now.getMonth() >= 5 ? currentYear : currentYear - 1;
    return `${startYear}-${startYear + 1}`;
}

/**
 * Returns true when `value` looks like an academic session.
 * Exported so the admin route can validate before writing.
 */
function isValidAcademicSession(value) {
    return typeof value === 'string' && SESSION_PATTERN.test(value.trim());
}

/**
 * In-memory cache of the saved academic session.
 *
 * This is read on every attendance/timetable/calendar request, so it is cached
 * briefly rather than hitting the DB each time. `invalidateAcademicSession()`
 * clears it immediately after an admin saves a new value, so a change takes
 * effect on the very next request instead of after the TTL.
 */
let cachedSession = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 1000;

/** @type {{ execute: Function } | null} */
let dbClient = null;

/**
 * Late-binds db.js to avoid a require cycle: db.js loads config indirectly, and
 * requiring it at module scope would deadlock the CommonJS cache.
 */
function getDb() {
    if (dbClient === null) {
        try {
            dbClient = require('../db').db;
        } catch (e) {
            dbClient = false; // remember the failure, do not retry per request
        }
    }
    return dbClient || null;
}

function invalidateAcademicSession() {
    cachedSession = null;
    cachedAt = 0;
}

/**
 * Resolves the academic session to use for an upstream college API call.
 *
 * Resolution order:
 *   1. An explicit caller-supplied session (?session=...) always wins.
 *   2. The value saved in the admin panel (app_config.academic_session).
 *   3. The ACADEMIC_SESSION environment variable.
 *   4. Derived from the current date.
 *
 * Why this exists: the session used to be hardcoded as "2025-2026" in four
 * places. Once that session ended, /my/attendances silently returned nothing
 * and the app's Statistics screen showed "No history for this month." The
 * college API keys attendance, timetable and calendar data by academic year, so
 * a stale year empties all three without raising an error.
 *
 * Safe to call without `await` — if the cache is cold it returns the derived
 * value immediately rather than blocking. Use the async `loadAcademicSession()`
 * where a freshly-saved value must be picked up straight away.
 *
 * @param {string} [requested] explicit session from the query string
 * @returns {string}
 */
function resolveAcademicSession(requested) {
    if (isValidAcademicSession(requested)) {
        return String(requested).trim();
    }

    if (cachedSession && (Date.now() - cachedAt) < CACHE_TTL_MS) {
        return cachedSession;
    }

    const override = process.env.ACADEMIC_SESSION;
    if (isValidAcademicSession(override)) {
        cachedSession = override.trim();
        cachedAt = Date.now();
        return cachedSession;
    }

    return deriveAcademicSession();
}

/**
 * Reads the saved academic session from the database, refreshing the cache.
 * Falls back to the environment value, then to the date-derived session.
 *
 * @returns {Promise<string>}
 */
async function loadAcademicSession(requested) {
    if (isValidAcademicSession(requested)) {
        return String(requested).trim();
    }

    if (cachedSession && (Date.now() - cachedAt) < CACHE_TTL_MS) {
        return cachedSession;
    }

    const db = getDb();
    if (db) {
        try {
            const res = await db.execute({
                sql: 'SELECT value FROM app_config WHERE key = ?',
                args: [ACADEMIC_SESSION_KEY]
            });
            const saved = res.rows[0]?.value;
            if (isValidAcademicSession(saved)) {
                cachedSession = saved.trim();
                cachedAt = Date.now();
                return cachedSession;
            }
        } catch (e) {
            // Table or row missing on a fresh install: fall through.
        }
    }

    const override = process.env.ACADEMIC_SESSION;
    if (isValidAcademicSession(override)) {
        cachedSession = override.trim();
        cachedAt = Date.now();
        return cachedSession;
    }

    return deriveAcademicSession();
}

const appConfig = {
    version: process.env.APP_VERSION,
    force: process.env.APP_FORCE,
    message: process.env.APP_MESSAGE,
    downloadUrl: process.env.APP_DOWNLOAD_URL,
    ACADEMIC_SESSION_KEY,
    deriveAcademicSession,
    isValidAcademicSession,
    resolveAcademicSession,
    loadAcademicSession,
    invalidateAcademicSession
};

module.exports = appConfig;
