/** 应用主逻辑 */

// ==================== 全局状态 ====================
const state = {
    token: localStorage.getItem('token') || null,
    user: JSON.parse(localStorage.getItem('user') || 'null'),
    conversations: [],
    currentConvId: null,
    messages: [],
};

// ==================== 页面切换 ====================
const authPage = document.getElementById('auth-page');
const appPage = document.getElementById('app-page');

function showAuthPage() {
    authPage.style.display = 'flex';
    appPage.style.display = 'none';
}

function showAppPage() {
    authPage.style.display = 'none';
    appPage.style.display = 'flex';
    document.getElementById('current-user').textContent = state.user?.username || '';
    loadConversations();
}

// 启动时强制进入登录页
showAuthPage();

// ==================== 移动端侧边栏 ====================
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');

function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
}
function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
}

document.getElementById('btn-menu').addEventListener('click', (e) => {
    e.stopPropagation();
    openSidebar();
});
overlay.addEventListener('click', closeSidebar);
document.querySelector('.chat-area').addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') && e.target !== document.getElementById('btn-menu')) {
        closeSidebar();
    }
});

// 移动端选会话后自动关闭侧边栏
const origSelectConversation = selectConversation;
selectConversation = async function (id) {
    await origSelectConversation(id);
    if (window.innerWidth <= 768) closeSidebar();
};

// ==================== 认证 Tab 切换 ====================
document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const isLogin = tab.dataset.tab === 'login';
        document.getElementById('login-form').style.display = isLogin ? '' : 'none';
        document.getElementById('register-form').style.display = isLogin ? 'none' : '';
        document.getElementById('login-error').textContent = '';
        document.getElementById('register-error').textContent = '';
    });
});

// ==================== 登录 ====================
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '登录中...';

    try {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const res = await apiLogin(username, password);
        state.token = res.data.token;
        state.user = { user_id: res.data.user_id, username: res.data.username };
        localStorage.setItem('token', state.token);
        localStorage.setItem('user', JSON.stringify(state.user));
        document.getElementById('login-username').value = '';
        document.getElementById('login-password').value = '';
        showAppPage();
    } catch (err) {
        errorEl.textContent = err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = '登 录';
    }
});

// ==================== 注册 ====================
document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const errorEl = document.getElementById('register-error');
    errorEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '注册中...';

    try {
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;

        if (password.length < 6) {
            throw new Error('密码至少 6 个字符');
        }

        const res = await apiRegister(username, password);
        state.token = res.data.token;
        state.user = { user_id: res.data.user_id, username: res.data.username };
        localStorage.setItem('token', state.token);
        localStorage.setItem('user', JSON.stringify(state.user));
        document.getElementById('register-username').value = '';
        document.getElementById('register-password').value = '';
        showAppPage();
    } catch (err) {
        errorEl.textContent = err.message;
    } finally {
        btn.disabled = false;
        btn.textContent = '注 册';
    }
});

// ==================== 登出 ====================
document.getElementById('btn-logout').addEventListener('click', () => {
    state.token = null;
    state.user = null;
    state.conversations = [];
    state.currentConvId = null;
    state.messages = [];
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    hideChatArea();
    document.getElementById('conv-list').innerHTML = '';
    showAuthPage();
});

// ==================== 会话列表 ====================

async function loadConversations(keepCurrent) {
    try {
        const res = await apiGetConversations();
        state.conversations = res.data.list;
        if (!keepCurrent) {
            state.currentConvId = null;
            state.messages = [];
            hideChatArea();
        }
        renderConvList();
    } catch (err) {
        console.error('加载会话列表失败:', err);
    }
}

function renderConvList() {
    const el = document.getElementById('conv-list');
    if (state.conversations.length === 0) {
        el.innerHTML = '<p class="conv-empty">暂无对话，点击上方按钮创建</p>';
        return;
    }

    el.innerHTML = state.conversations.map(c =>
        `<div class="conv-item${c.id === state.currentConvId ? ' active' : ''}" data-id="${c.id}">
            <span class="conv-title">${escapeHtml(c.title)}</span>
            <div class="conv-actions">
                <button class="conv-edit" data-id="${c.id}" title="重命名">✎</button>
                <button class="conv-del" data-id="${c.id}" title="删除">×</button>
            </div>
        </div>`
    ).join('');

    // 绑定点选
    el.querySelectorAll('.conv-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.conv-actions')) return;
            selectConversation(Number(item.dataset.id));
        });
    });

    // 绑定编辑
    el.querySelectorAll('.conv-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            startRename(Number(btn.dataset.id));
        });
    });

    // 绑定删除
    el.querySelectorAll('.conv-del').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteConversation(Number(btn.dataset.id));
        });
    });
}

function startRename(convId) {
    const conv = state.conversations.find(c => c.id === convId);
    if (!conv) return;

    const item = document.querySelector(`.conv-item[data-id="${convId}"]`);
    const titleEl = item.querySelector('.conv-title');
    const oldTitle = conv.title;

    // 替换为 input
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldTitle;
    input.className = 'conv-rename-input';
    input.maxLength = 200;
    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const save = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== oldTitle) {
            try {
                await apiRenameConversation(convId, newTitle);
                conv.title = newTitle;
                if (state.currentConvId === convId) {
                    // 更新 state 中的会话标题
                    const idx = state.conversations.findIndex(c => c.id === convId);
                    if (idx !== -1) state.conversations[idx].title = newTitle;
                }
            } catch (err) {
                showToast('重命名失败: ' + err.message);
            }
        }
        renderConvList();
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); save(); }
        if (e.key === 'Escape') { e.preventDefault(); renderConvList(); }
    });
}

async function selectConversation(id) {
    state.currentConvId = id;
    state.messages = [];
    renderConvList();
    await loadMessages(id);
}

async function deleteConversation(id) {
    if (!confirm('确定要删除这个会话吗？消息也会一并删除。')) return;
    try {
        await apiDeleteConversation(id);
        if (state.currentConvId === id) {
            state.currentConvId = null;
            state.messages = [];
        }
        loadConversations();
    } catch (err) {
        showToast('删除失败: ' + err.message);
    }
}

// 创建新会话
document.getElementById('btn-new-conv').addEventListener('click', async () => {
    try {
        const res = await apiCreateConversation();
        state.conversations.unshift(res.data);
        state.currentConvId = res.data.id;
        state.messages = [];
        renderConvList();
        showChatArea();
    } catch (err) {
        showToast('创建失败: ' + err.message);
    }
});

// ==================== 消息 ====================

async function loadMessages(convId) {
    try {
        const res = await apiGetMessages(convId);
        state.messages = res.data.list;
        renderMessages();
        showChatArea();
    } catch (err) {
        showToast('加载消息失败: ' + err.message);
    }
}

function renderMessages() {
    const el = document.getElementById('chat-messages');
    el.innerHTML = state.messages.map(m =>
        `<div class="message ${m.role}">
            <div class="msg-content">${m.role === 'assistant' ? renderMarkdown(m.content) : escapeHtml(m.content)}</div>
            <div class="msg-time">${formatTime(m.created_at)}</div>
        </div>`
    ).join('');
    el.scrollTop = el.scrollHeight;
}

function showThinking() {
    const el = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'message assistant';
    div.id = 'thinking-msg';
    div.innerHTML = '<div class="msg-content thinking"><span></span><span></span><span></span></div>';
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
}

function hideThinking() {
    const div = document.getElementById('thinking-msg');
    if (div) div.remove();
}

function showChatArea() {
    document.getElementById('chat-placeholder').style.display = 'none';
    document.getElementById('chat-messages').style.display = 'flex';
    document.getElementById('chat-input-area').style.display = '';
}

function hideChatArea() {
    document.getElementById('chat-placeholder').style.display = 'flex';
    document.getElementById('chat-messages').style.display = 'none';
    document.getElementById('chat-input-area').style.display = 'none';
}

// 发送消息
async function sendMessage() {
    const input = document.getElementById('msg-input');
    const content = input.value.trim();
    if (!content || !state.currentConvId) return;

    const btn = document.getElementById('btn-send');
    input.disabled = true;
    btn.disabled = true;
    btn.textContent = '...';

    // 先追加用户消息到列表
    state.messages.push({
        id: Date.now(),
        role: 'user',
        content: content,
        created_at: new Date().toISOString(),
    });
    input.value = '';
    input.style.height = 'auto';
    renderMessages();
    showThinking();

    try {
        const res = await apiSendMessage(state.currentConvId, content);
        hideThinking();
        // 追加 AI 回复
        state.messages.push({
            id: res.data.id,
            role: 'assistant',
            content: res.data.content,
            created_at: res.data.created_at,
        });
        renderMessages();
        loadConversations(true);
    } catch (err) {
        hideThinking();
        showToast('发送失败: ' + err.message);
    } finally {
        input.disabled = false;
        btn.disabled = false;
        btn.textContent = '发送';
        input.focus();
    }
}

document.getElementById('btn-send').addEventListener('click', sendMessage);

// Enter 发送，Shift+Enter 换行
document.getElementById('msg-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// textarea 自动增高
document.getElementById('msg-input').addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 120) + 'px';
});

// ==================== 工具函数 ====================

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatTime(isoStr) {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderMarkdown(text) {
    let html = escapeHtml(text);

    // 代码块（```...```）
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
        `<pre><code>${escapeHtml(code.trim())}</code></pre>`
    );

    // 行内代码 (`...`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 粗体 (**...**)
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 斜体 (*...*)
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // ### 标题
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 有序列表（1. ...）
    html = html.replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>');
    // 无序列表（- ... 或 * ...）
    html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');

    // 换行
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // 包裹段落
    html = '<p>' + html + '</p>';

    return html;
}

// Toast 轻提示
function showToast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toast';
        el.className = 'toast';
        document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('show'), 3000);
}
