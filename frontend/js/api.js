/** API 封装层 — 封装后端全部 7 个接口 */

const API_BASE = '';  // 前后端同域名，用相对路径

/**
 * 通用请求函数
 * @param {string} path — API 路径，如 /api/auth/login
 * @param {object} [options] — method, body, auth
 * @returns {Promise<object>} — { code, message, data }
 */
async function request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
        const token = localStorage.getItem('token');
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(API_BASE + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json();
    if (json.code === 401 && auth) {
        // Token 过期或无效，强制登出
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.reload();
        throw new Error('登录已过期，请重新登录');
    }
    if (json.code !== 200) {
        throw new Error(json.message || '请求失败');
    }
    return json;
}

// ────────────────── 认证 ──────────────────

/** 注册 */
function apiRegister(username, password) {
    return request('/api/auth/register', {
        method: 'POST',
        body: { username, password },
    });
}

/** 登录 */
function apiLogin(username, password) {
    return request('/api/auth/login', {
        method: 'POST',
        body: { username, password },
    });
}

// ────────────────── 会话 ──────────────────

/** 获取会话列表 */
function apiGetConversations(page = 1, limit = 20) {
    return request(`/api/conversations?page=${page}&limit=${limit}`, { auth: true });
}

/** 创建会话 */
function apiCreateConversation(title = '新对话') {
    return request('/api/conversations', {
        method: 'POST',
        body: { title },
        auth: true,
    });
}

/** 重命名会话 */
function apiRenameConversation(id, title) {
    return request(`/api/conversations/${id}/title`, {
        method: 'PUT',
        body: { title },
        auth: true,
    });
}

/** 删除会话 */
function apiDeleteConversation(id) {
    return request(`/api/conversations/${id}`, {
        method: 'DELETE',
        auth: true,
    });
}

// ────────────────── 消息 ──────────────────

/** 获取消息列表 */
function apiGetMessages(conversationId, page = 1, limit = 50) {
    return request(`/api/conversations/${conversationId}/messages?page=${page}&limit=${limit}`, { auth: true });
}

/** 发送消息 */
function apiSendMessage(conversationId, content) {
    return request(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: { content },
        auth: true,
    });
}
