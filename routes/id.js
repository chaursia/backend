const express = require('express');
const { getQR, scanQR } = require('../services/idService');
const { getUserById } = require('../services/authService');
const sessionStore = require('../utils/sessionStore');

const router = express.Router();

/**
 * GET /id/getQR
 * Generates a QR payload for the currently logged-in student.
 */
router.get('/getQR', async (req, res) => {
    let sessionId = req.headers['authorization'];

    if (!sessionId) {
        console.warn('⚠️ No Authorization header provided for getQR');
        return res.status(401).json({ error: 'Unauthorized: No session token provided' });
    }

    // Clean up "Bearer " prefix if it exists (case-insensitive)
    if (sessionId.toLowerCase().startsWith('bearer ')) {
        sessionId = sessionId.slice(7);
    }


    const session = sessionStore.decrypt(sessionId);
    if (!session || !session.user_id) {
        console.error('❌ Failed to decrypt session inside getQR');
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    console.log(`📡 Fetching QR for user_id: ${session.user_id}`);

    try {
        const user = await getUserById(session.user_id);
        if (!user) {
            console.warn(`⚠️ User profile not found in DB for user_id: ${session.user_id}`);
            return res.status(404).json({ error: 'User profile not found in synced database' });
        }

        const qrData = getQR(user.college_id);
        res.json({ qrData });
    } catch (error) {
        console.error('❌ Internal server error in getQR:', error);
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

