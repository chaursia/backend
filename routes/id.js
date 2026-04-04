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
    const sessionId = req.headers['authorization'];

    if (!sessionId) {
        return res.status(401).json({ error: 'Unauthorized: No session token provided' });
    }

    const session = sessionStore.decrypt(sessionId);
    if (!session || !session.user_id) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }

    try {
        const user = await getUserById(session.user_id);
        if (!user) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const qrData = getQR(user.college_id);
        res.json({ qrData });
    } catch (error) {
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

