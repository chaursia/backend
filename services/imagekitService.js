const { db } = require('../db');

let _ik = null;

async function getImageKit() {
    if (_ik) return _ik;
    const rows = await db.execute({
        sql: "SELECT value FROM app_config WHERE key = 'imagekit_private_key'"
    });
    const privateKey = rows.rows[0]?.value;
    if (!privateKey) return null;

    const [pubRes, urlRes] = await Promise.all([
        db.execute({ sql: "SELECT value FROM app_config WHERE key = 'imagekit_public_key'" }),
        db.execute({ sql: "SELECT value FROM app_config WHERE key = 'imagekit_url_endpoint'" })
    ]);

    const ImageKit = require('@imagekit/nodejs');
    _ik = new ImageKit({
        publicKey: pubRes.rows[0]?.value || '',
        privateKey,
        urlEndpoint: urlRes.rows[0]?.value || ''
    });
    return _ik;
}

function clearInstance() { _ik = null; }

async function uploadVideo(buffer, fileName, mimeType) {
    const ik = await getImageKit();
    if (!ik) throw new Error('ImageKit not configured. Set credentials in admin panel.');

    const result = await ik.upload({
        file: buffer,
        fileName,
        useUniqueFileName: true,
        folder: '/its_social_feed/videos'
    });

    return {
        url: result.url,
        fileId: result.fileId,
        thumbnail: result.thumbnailUrl,
        duration: result.duration || null
    };
}

async function deleteVideo(fileId) {
    const ik = await getImageKit();
    if (!ik || !fileId) return;
    try {
        await ik.deleteFile(fileId);
    } catch (e) {
        console.error('ImageKit delete failed:', e.message);
    }
}

module.exports = { uploadVideo, deleteVideo, getImageKit, clearInstance };
