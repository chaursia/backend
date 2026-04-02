const sessions = new Map();

/**
 * A simple in-memory session store. 
 * For production at scale, consider replacing with Redis.
 */
module.exports = {
    set: (id, data) => sessions.set(id, data),
    get: (id) => sessions.get(id),
    delete: (id) => sessions.delete(id)
};
