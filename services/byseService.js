const { db } = require('../db');

const BYSE_API_BASE = 'https://api.byse.sx';

async function getApiKey() {
    const res = await db.execute({
        sql: "SELECT value FROM app_config WHERE key = 'byse_api_key'"
    });
    return res.rows[0]?.value || null;
}

async function getUploadServer() {
    const apiKey = await getApiKey();
    if (!apiKey) throw new Error('Byse not configured.');
    const res = await fetch(`${BYSE_API_BASE}/upload/server?key=${apiKey}`);
    const json = await res.json();
    return json.result;
}

async function uploadVideo(buffer, fileName, mimeType) {
    const apiKey = await getApiKey();
    if (!apiKey) throw new Error('Byse not configured.');
    const uploadServer = await getUploadServer();

    const formData = new FormData();
    formData.append('key', apiKey);
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file', blob, fileName);

    const response = await fetch(uploadServer, { method: 'POST', body: formData });
    const json = await response.json();

    if (json.files?.[0]?.status === 'OK') {
        const filecode = json.files[0].filecode;
        return { url: `https://bysedikamoum.com/e/${filecode}`, fileId: filecode, thumbnail: null };
    }
    throw new Error('Byse upload failed: ' + JSON.stringify(json));
}

async function deleteVideo(fileCode) {
    const apiKey = await getApiKey();
    if (!apiKey || !fileCode) return;
    try {
        await fetch(`${BYSE_API_BASE}/file/delete?key=${apiKey}&file_code=${fileCode}`);
    } catch (e) {
        console.error('Byse delete failed:', e.message);
    }
}

async function getThumbnail(fileCode) {
    const apiKey = await getApiKey();
    if (!apiKey) return null;
    try {
        const res = await fetch(`${BYSE_API_BASE}/images/thumb?key=${apiKey}&file_code=${fileCode}`);
        const json = await res.json();
        console.log(`[Byse] Thumb response for ${fileCode}:`, JSON.stringify(json));
        if (json.result?.thumbnail) return json.result.thumbnail;
        // Try other possible response keys
        if (json.result?.splash) return json.result.splash;
        if (json.result?.url) return json.result.url;
        return null;
    } catch (e) {
        console.error(`[Byse] Thumb fetch failed for ${fileCode}:`, e.message);
        return null;
    }
}

module.exports = { getApiKey, getUploadServer, uploadVideo, deleteVideo, getThumbnail };
