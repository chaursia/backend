const cloudinary = require('cloudinary').v2;

/**
 * SINGLE source of truth for Cloudinary configuration.
 *
 * `cloudinary.v2` is a module-level singleton. storageService.js used to call
 * cloudinary.config() with discrete env vars while cloudinaryService.js called a
 * bare cloudinary.config() when CLOUDINARY_URL was present. Whichever module
 * happened to load last silently overwrote the other, so profile/ID-card
 * uploads could land in a different Cloudinary account than social uploads.
 * Both modules now import configureCloudinary() from here.
 */
function configureCloudinary() {
    if (process.env.CLOUDINARY_URL) {
        // CLOUDINARY_URL encodes cloud_name://api_key:api_secret
        cloudinary.config({ secure: true });
    } else {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        });
    }
}

configureCloudinary();

/** Formats that may be ingested into the Cloudinary image pipeline. */
const ALLOWED_IMAGE_FORMATS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

/**
 * Upload a file buffer to Cloudinary.
 * @param {Buffer} buffer - The file content buffer.
 * @param {string} originalName - The original filename.
 * @param {string} folder - The destination folder (e.g., 'profiles', 'id-cards').
 * @returns {Promise<string>} - The secure URL of the uploaded image.
 */
async function uploadFile(buffer, originalName, folder = 'uploads') {
    if (!process.env.CLOUDINARY_CLOUD_NAME && !process.env.CLOUDINARY_URL) {
        throw new Error('Cloudinary credentials are not configured in environment variables.');
    }

    // resource_type 'image' is hardcoded, so restrict what may enter that
    // pipeline. Previously any bytes labelled image/* were accepted.
    const ext = typeof originalName === 'string'
        ? (originalName.split('.').pop() || '').toLowerCase()
        : '';

    if (originalName != null && !ALLOWED_IMAGE_FORMATS.includes(ext)) {
        throw new Error('Unsupported image format. Allowed: jpg, png, webp, gif.');
    }

    // folder must never be caller-supplied; both call sites pass literals.
    const safeFolder = ['profiles', 'id-cards', 'uploads'].includes(folder) ? folder : 'uploads';

    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: `its-college/${safeFolder}`,
                use_filename: true,
                unique_filename: true,
                resource_type: 'image'
            },
            (error, result) => {
                if (error) {
                    // Log for operator diagnosis, but reject with a generic message
                    // so raw provider payloads (which can echo credentials) are
                    // never returned to the client.
                    console.error('❌ Cloudinary Upload Error:', error && error.message);
                    return reject(new Error('Failed to upload image to Cloudinary.'));
                }
                resolve(result.secure_url);
            }
        );

        uploadStream.end(buffer);
    });
}

module.exports = { uploadFile, configureCloudinary, ALLOWED_IMAGE_FORMATS };
