const { db } = require('../db');

const FILELU_API_BASE = 'https://filelu.com/api';

async function getApiKey() {
    const res = await db.execute({
        sql: "SELECT value FROM app_config WHERE key = 'filelu_api_key'"
    });
    return res.rows[0]?.value || null;
}

async function getUploadServer() {
    const apiKey = await getApiKey();
    if (!apiKey) throw new Error('FileLu not configured.');
    const res = await fetch(`${FILELU_API_BASE}/upload/server?key=${apiKey}`);
    const json = await res.json();
    if (json.status !== 200) throw new Error('FileLu server fetch failed: ' + json.msg);
    return { uploadUrl: json.result, sessId: json.sess_id };
}

async function uploadDocument(buffer, fileName, mimeType) {
    const apiKey = await getApiKey();
    if (!apiKey) throw new Error('FileLu not configured.');
    const { uploadUrl, sessId } = await getUploadServer();

    const formData = new FormData();
    formData.append('sess_id', sessId);
    formData.append('utype', 'prem');
    const blob = new Blob([buffer], { type: mimeType });
    formData.append('file_0', blob, fileName);

    const response = await fetch(uploadUrl, { method: 'POST', body: formData });
    const json = await response.json();

    if (Array.isArray(json) && json[0]?.file_status === 'OK') {
        const fileCode = json[0].file_code;
        return { url: `https://filelu.com/${fileCode}`, fileCode };
    }
    throw new Error('FileLu upload failed: ' + JSON.stringify(json));
}

async function deleteDocument(fileCode) {
    const apiKey = await getApiKey();
    if (!apiKey || !fileCode) return;
    try {
        await fetch(`${FILELU_API_BASE}/file/remove?file_code=${fileCode}&remove=1&key=${apiKey}`);
    } catch (e) {
        console.error('FileLu delete failed:', e.message);
    }
}

module.exports = { getApiKey, getUploadServer, uploadDocument, deleteDocument };
