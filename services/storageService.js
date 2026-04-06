const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - The file content buffer.
 * @param {string} originalName - The original filename.
 * @param {string} folder - The destination folder (e.g., 'profiles', 'id-cards').
 * @returns {Promise<string>} - The secure URL of the uploaded image.
 */
async function uploadFile(buffer, originalName, folder = 'uploads') {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY) {
        throw new Error('Cloudinary credentials are not configured in environment variables.');
    }

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `its-college/${folder}`,
                use_filename: true,
                unique_filename: true,
                resource_type: 'image'
            },
            (error, result) => {
                if (error) {
                    console.error('❌ Cloudinary Upload Error:', error);
                    return reject(new Error('Failed to upload image to Cloudinary.'));
                }
                resolve(result.secure_url);
            }
        );

        uploadStream.end(buffer);
    });
}

module.exports = { uploadFile };
