const { db } = require('../db');

const API_BASE = 'https://api.voiddrive.org/v1';

async function getApiKey() {
    const res = await db.execute({
        sql: "SELECT value FROM app_config WHERE key = 'voiddrive_api_key'"
    });
    return res.rows[0]?.value || null;
}

async function getUploadUrl(fileName, size, contentType) {
    const apiKey = await getApiKey();
    if (!apiKey) throw new Error('VoidDrive not configured.');

    const path = `/social_documents/${Date.now()}_${fileName}`;
    const res = await fetch(`${API_BASE}/files/upload-url`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey
        },
        body: JSON.stringify({ path, size, content_type: contentType })
    });
    const json = await res.json();
    if (!json.url || !json.token) throw new Error('VoidDrive upload-url failed: ' + JSON.stringify(json));
    return { uploadUrl: json.url, fileId: json.token };
}

async function deleteFile(fileId) {
    const apiKey = await getApiKey();
    if (!apiKey || !fileId) return;
    try {
        await fetch(`${API_BASE}/files/${fileId}`, {
            method: 'DELETE',
            headers: { 'X-API-Key': apiKey }
        });
    } catch (e) {
        console.error('VoidDrive delete failed:', e.message);
    }
}

async function getDownloadUrl(fileId) {
    const apiKey = await getApiKey();
    if (!apiKey || !fileId) return null;
    try {
        const res = await fetch(`${API_BASE}/files/${fileId}/download-url`, {
            headers: { 'X-API-Key': apiKey }
        });
        const json = await res.json();
        return json.url || null;
    } catch (e) {
        console.error('VoidDrive download-url failed:', e.message);
        return null;
    }
}

module.exports = { getApiKey, getUploadUrl, deleteFile, getDownloadUrl };
