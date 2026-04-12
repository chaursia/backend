const express = require('express');
const { getQR, scanQR } = require('../services/idService');
const { getUserById, getUserByCollegeId } = require('../services/authService');
const sessionStore = require('../utils/sessionStore');
const { supabase } = require('../db');

const router = express.Router();

/**
 * GET /id/getQR
 * Generates a QR payload for the currently logged-in student.
 * Checks: qr_enabled flag, user ban status.
 */
router.get('/getQR', async (req, res) => {
    // Check Admin Feature Toggle for QR
    try {
        const { data: features } = await supabase
            .from('feature_settings')
            .select('qr_enabled, maintenance_mode, maintenance_message')
            .eq('id', 1)
            .single();

        if (features) {
            if (features.maintenance_mode) {
                return res.status(503).json({ error: features.maintenance_message || 'System is under maintenance.' });
            }
            if (!features.qr_enabled) {
                return res.status(403).json({ error: 'QR ID generation is currently disabled by the administrator.' });
            }
        }
    } catch (e) { /* Non-fatal: allow if DB is unreachable */ }

    let sessionId = req.headers['authorization'];
    const collegeIdParam = req.query.collegeId;
    let userId;

    if (sessionId) {
        // Clean up "Bearer " prefix if it exists
        if (sessionId.toLowerCase().startsWith('bearer ')) {
            sessionId = sessionId.slice(7);
        }
        const session = sessionStore.decrypt(sessionId);
        if (session && session.user_id) {
            userId = session.user_id;
        }
    }

    try {
        let user;
        if (userId) {
            user = await getUserById(userId);
        } else if (collegeIdParam) {
            // Fallback: Fetch by collegeId (Roll No) if session decryption fails
            user = await getUserByCollegeId(collegeIdParam);
        }

        if (!user) {
            return res.status(401).json({ error: 'Unauthorized: No valid session or collegeId provided' });
        }

        const qrData = getQR(user.college_id);
        res.json({ qrData });
    } catch (error) {
        console.error('❌ Error in getQR:', error);
        res.status(500).json({ error: 'Failed to generate QR data' });
    }
});



/**
 * POST /id/scanQR
 * Decodes and verifies a QR code payload, returning safe student profile data.
 */
router.post('/scanQR', async (req, res) => {
    const { qrData } = req.body;

    if (!qrData) {
        return res.status(400).json({ error: 'Missing QR data in request body' });
    }

    try {
        const verifiedResult = await scanQR(qrData);
        res.json(verifiedResult);
    } catch (error) {
        const isValidationError = error.message.includes('Invalid QR') || error.message.includes('Verification failed');
        res.status(isValidationError ? 400 : 500).json({ 
            error: error.message || 'Verification process encountered an unexpected error.' 
        });
    }
});

module.exports = router;

