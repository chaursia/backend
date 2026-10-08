const cloudinary = require('cloudinary').v2;

// Cloudinary configuration is owned by storageService.js. cloudinary.v2 is a
// singleton, so configuring it here as well meant whichever module loaded last
// silently overwrote the other's credentials.
require('./storageService').configureCloudinary();

/**
 * Uploads a file buffer to Cloudinary
 * @param {Buffer} buffer - The file buffer
 * @param {string} mimeType - The mimetype of the file (e.g., 'image/png')
 * @returns {Promise<Object>} - The Cloudinary upload result
 */
const uploadToCloudinary = (buffer, mimeType) => {
    return new Promise((resolve, reject) => {
        let resourceType = 'auto'; // Images/video
        if (mimeType === 'application/pdf' || mimeType.includes('document')) {
            resourceType = 'raw'; // Must use raw for PDFs on free tier usually
        }

        const uploadStream = cloudinary.uploader.upload_stream(
            { 
                folder: 'its_social_feed',
                resource_type: resourceType
            },
            (error, result) => {
                if (error) {
                    // Genericised: the raw provider error can echo request
                    // credentials in its payload and was returned to clients.
                    console.error("Cloudinary Upload Error:", error && error.message);
                    return reject(new Error('Upload failed.'));
                }
                resolve({
                    url: result.secure_url,
                    public_id: result.public_id,
                    type: resourceType === 'raw' ? 'document' : 'image'
                });
            }
        );

        uploadStream.end(buffer);
    });
};

const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    if (!publicId) return;

    // publicId came from client-controlled post metadata, so constrain its shape
    // before it reaches the destroy API.
    if (typeof publicId !== 'string' || publicId.length > 512 || /[\u0000-\u001f]/.test(publicId)) {
        console.warn('Cloudinary delete skipped: invalid public_id');
        return;
    }

    try {
        const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        // destroy() resolves with { result: 'ok' | 'not found' } rather than
        // throwing, so the previous version reported success unconditionally.
        if (!result || result.result !== 'ok') {
            console.warn(`Cloudinary delete did not succeed for "${publicId}": ${result && result.result}`);
        }
    } catch (e) {
        console.error("Failed to delete from Cloudinary:", e && e.message);
    }
};

module.exports = {
    uploadToCloudinary,
    deleteFromCloudinary
};
