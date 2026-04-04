const express = require('express');
const { getQR, scanQR } = require('../services/idService');
const { getUserById, getUserByCollegeId } = require('../services/authService');
const sessionStore = require('../utils/sessionStore');

const router = express.Router();

/**
 * GET /id/getQR
 * Generates a QR payload for the currently logged-in student.
 */
router.get('/getQR', async (req, res) => {
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

