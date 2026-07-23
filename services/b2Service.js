const { db } = require('../db');
const crypto = require('crypto');

const B2_API_BASE = 'https://api.backblazeb2.com';

async function getConfig() {
    const res = await db.execute({
        sql: "SELECT key, value FROM app_config WHERE key IN ('b2_application_key_id','b2_application_key','b2_bucket_id','b2_bucket_name')"
    });
    const config = {};
    for (const row of res.rows) config[row.key] = row.value;
    return config;
}

async function authorize() {
    const config = await getConfig();
    if (!config.b2_application_key_id || !config.b2_application_key || !config.b2_bucket_id || !config.b2_bucket_name) {
        throw new Error('B2 not configured.');
    }
    const basicAuth = Buffer.from(`${config.b2_application_key_id}:${config.b2_application_key}`).toString('base64');
    const res = await fetch(`${B2_API_BASE}/b2api/v2/b2_authorize_account`, {
        headers: { 'Authorization': `Basic ${basicAuth}` }
    });
    const json = await res.json();
    if (!res.ok) throw new Error('B2 auth failed: ' + JSON.stringify(json));
    json.bucketId = config.b2_bucket_id;
    json.bucketName = config.b2_bucket_name;
    return json;
}

async function getUploadUrl(auth) {
    const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
        method: 'POST',
        headers: { 'Authorization': auth.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: auth.bucketId })
    });
    const json = await res.json();
    if (!res.ok) throw new Error('B2 get_upload_url failed: ' + JSON.stringify(json));
    return json;
}

async function uploadFile(buffer, originalName, mimeType) {
    const auth = await authorize();
    const uploadInfo = await getUploadUrl(auth);
    const uuid = crypto.randomUUID();
    const b2FileName = `social_documents/${uuid}_${originalName}`;
    const sha1 = crypto.createHash('sha1').update(buffer).digest('hex');
    const res = await fetch(uploadInfo.uploadUrl, {
        method: 'POST',
        headers: {
            'Authorization': uploadInfo.authorizationToken,
            'X-Bz-File-Name': encodeURI(b2FileName),
            'Content-Type': mimeType,
            'X-Bz-Content-Sha1': sha1,
            'Content-Length': buffer.length.toString()
        },
        body: buffer
    });
    const json = await res.json();
    if (!res.ok) throw new Error('B2 upload failed: ' + JSON.stringify(json));
    return { fileId: json.fileId, fileName: b2FileName };
}

async function getDownloadUrl(fileName) {
    const auth = await authorize();
    const res = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
        method: 'POST',
        headers: { 'Authorization': auth.authorizationToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ bucketId: auth.bucketId, fileNamePrefix: fileName, validDurationInSeconds: 3600 })
    });
    const json = await res.json();
    if (!res.ok) throw new Error('B2 get_download_authorization failed: ' + JSON.stringify(json));
    return `${auth.downloadUrl}/file/${auth.bucketName}/${encodeURI(fileName)}?Authorization=${json.authorizationToken}`;
}

async function deleteFile(fileId, fileName) {
    try {
        const auth = await authorize();
        await fetch(`${auth.apiUrl}/b2api/v2/b2_delete_file_version`, {
            method: 'POST',
            headers: { 'Authorization': auth.authorizationToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileId, fileName })
        });
    } catch (e) {
        console.error('B2 delete failed:', e.message);
    }
}

module.exports = { uploadFile, deleteFile, getDownloadUrl };
