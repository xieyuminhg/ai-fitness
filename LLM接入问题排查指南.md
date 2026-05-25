# LLM 接入问题排查指南

> 记录本项目从 DeepSeek 切换到其他 Anthropic 协议模型时遇到的坑及排查方法。

---

## 一、背景

项目原本使用 DeepSeek 原生 API（OpenAI 格式，`/v1/chat/completions`），后改为 Anthropic 协议（`/v1/messages`），且支持通过 `.env` 灵活切换不同厂商的模型。

---

## 二、遇到的问题及解决方法

### 问题 1：`passlib` 与新版 `bcrypt` 不兼容（HTTP 500）

**现象**

调用 `/api/auth/register` 注册时返回 `500 Internal Server Error`，终端报错：

```
AttributeError: module 'bcrypt' has no attribute '__about__'
...
ValueError: password cannot be longer than 72 bytes, truncate manually if necessary
```

**原因**

- `passlib` 库已停止维护（最后版本 1.7.4），不支持 `bcrypt` >= 4.1.0
- 项目安装的是 `bcrypt` 5.0.0，`passlib` 尝试访问 `bcrypt.__about__.__version__` 属性，但新版 bcrypt 已移除该属性

**解决方法**

弃用 `passlib`，直接用 `bcrypt` 库：

```python
# ❌ 旧代码（backend/security.py）
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ✅ 新代码
import bcrypt

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())
```

同时更新 `backend/requirements.txt`：

```
# ❌ 旧
passlib[bcrypt]==1.7.4

# ✅ 新
bcrypt==5.0.0
```

---

### 问题 2：Anthropic 响应中 `content` 数组包含 `thinking` 类型块，导致取不到文本

**现象**

AI 调用看似成功（API 返回 200），但代码解析响应时出错，无法获取 AI 回复文本。

**原因**

DeepSeek 的 Anthropic 兼容端点（以及 Claude 系列模型）返回的 `content` 数组可能包含多种类型的块：

```json
{
  "content": [
    {"type": "thinking", "thinking": "模型推理过程...", "signature": "..."},
    {"type": "text", "text": "实际的回复文本"}
  ]
}
```

旧代码直接用 `content[0]["text"]` 取值，当第一个块是 `thinking` 时就会出错。

**解决方法**

遍历 `content` 数组，找到 `type == "text"` 的块再取值：

```python
# ❌ 旧代码
ai_content = resp.json()["content"][0]["text"]

# ✅ 新代码
for block in resp.json()["content"]:
    if block["type"] == "text":
        ai_content = block["text"]
        break
else:
    # 没找到文本块，返回错误
    return JSONResponse(
        status_code=500,
        content={"code": 500, "message": "AI 未返回文本回复", "data": None},
    )
```

---

### 问题 3：PowerShell 环境变量覆盖 `.env` 配置（HTTP 403）

**现象**

`.env` 文件里写的是：

```
ANTHROPIC_BASE_URL=https://api.deepseek.com/anthropic
ANTHROPIC_AUTH_TOKEN=sk-7a78aef625a048a18b6417c28261a6b3
ANTHROPIC_MODEL=deepseek-v4-pro
```

但 uvicorn 运行时实际发到了另一个地址：

```
URL: https://dashscope.aliyuncs.com/apps/anthropic/v1/messages
Model: glm-5
```

导致 API 返回 `403 {"message":"invalid api-key"}`。

**原因**

之前在 PowerShell 中手动设置过环境变量：

```powershell
$env:ANTHROPIC_BASE_URL = "https://dashscope.aliyuncs.com/apps/anthropic"
$env:ANTHROPIC_MODEL = "glm-5"
```

`pydantic-settings` 的优先级是：**系统环境变量 > `.env` 文件**。PowerShell 中设置的 `$env:*` 变量会覆盖 `.env` 中同名配置。

Auth Token 没有报错是因为两个地方用的是同一个 key，但目标 API 地址换了之后，key 对不上。

**排查方法**

在运行 uvicorn 的同一个 PowerShell 窗口中执行：

```powershell
$env:ANTHROPIC_BASE_URL
$env:ANTHROPIC_MODEL
$env:ANTHROPIC_AUTH_TOKEN
```

如果输出内容和你 `.env` 里写的不一致，说明被环境变量覆盖了。

**解决方法**

删除 PowerShell 环境变量：

```powershell
Remove-Item Env:\ANTHROPIC_BASE_URL
Remove-Item Env:\ANTHROPIC_MODEL
Remove-Item Env:\ANTHROPIC_AUTH_TOKEN
```

然后重启 uvicorn。

**教训**

```
pydantic-settings 读取优先级（从高到低）：
  1️⃣ $env:XXX          PowerShell 会话变量（最先匹配）
  2️⃣ 系统/用户环境变量    Windows 系统设置中的变量
  3️⃣ .env 文件         项目目录下的 .env 文件
  4️⃣ BaseSettings 字段默认值  代码中写的 default= 值
```

---

### 问题 4：会话表中 `model_name` 默认值写死为旧模型名

**现象**

创建会话时，`model_name` 默认写入 `"deepseek-chat"`，而代码中 `conv.model_name or settings.anthropic_model` 优先使用了数据库里的旧值，导致 `.env` 里配置的模型名不生效。

**解决方法**

- `backend/models.py` — `model_name` 字段默认值改为 `None`（数据库层面）和 `""`（Pydantic 层面）
- `backend/routers/messages.py` — 发送消息时直接使用 `settings.anthropic_model`，不再从会话表取 `model_name`

---

## 三、Anthropic API vs OpenAI API 格式差异速查

| 项目 | Anthropic 协议 | OpenAI/DeepSeek 协议 |
|------|---------------|---------------------|
| 端点 | `POST /v1/messages` | `POST /v1/chat/completions` |
| 认证头 | `x-api-key: <token>` | `Authorization: Bearer <token>` |
| 必带头 | `anthropic-version: 2023-06-01` | 无 |
| system 提示词 | 顶级 `"system"` 字段 | `messages[0]` 中 `role: "system"` |
| `max_tokens` | **必填** | 可选 |
| 响应文本 | `content[].text`（需按 `type` 过滤） | `choices[0].message.content` |
| 思考过程 | `content[]` 中有 `type: "thinking"` 块 | 有些模型放在 `reasoning_content` 字段 |

---

## 四、测试流程

### 4.1 准备环境

确保 uvicorn 已启动：

```powershell
.venv\Scripts\activate
uvicorn backend.main:app --reload
```

打开浏览器访问 Swagger 文档：`http://127.0.0.1:8000/docs`

### 4.2 步骤 1 — 注册用户

在 Swagger 中找到 **POST /api/auth/register**，点击 "Try it out"，填入：

```json
{
  "username": "testuser",
  "password": "123456"
}
```

**预期结果**：返回 `200`，`data` 中包含 `user_id` 和 `token`。

```
实际结果：___
```

### 4.3 步骤 2 — 登录

在 **POST /api/auth/login** 中填入相同的用户名密码。

**预期结果**：返回 `200`，拿到 `token`。

```
实际结果：___
```

### 4.4 步骤 3 — 创建会话

在 **POST /api/conversations** 中：

1. 点击右上角 🔒 图标，填入上一步拿到的 `token`（格式：`Bearer <token>`）
2. 请求体：

```json
{
  "title": "测试对话"
}
```

**预期结果**：返回 `200`，`data` 中包含会话 `id`。

```
实际结果：___
```

### 4.5 步骤 4 — 发送消息（核心测试）

在 **POST /api/conversations/{id}/messages** 中：

1. 同样填入 Token
2. `id` 路径参数填上一步拿到的会话 `id`
3. 请求体：

```json
{
  "content": "你好，请用一句话介绍自己"
}
```

**预期结果**：返回 `200`，`data` 中 `role` 为 `"assistant"`，`content` 为 AI 的回复。

```
实际结果：___
```

### 4.6 如果第 4 步失败

在 uvicorn 终端查看错误信息，对照本文档的问题清单排查：

| 错误 | 可能原因 |
|------|---------|
| `500` + `invalid api-key` | `.env` 被 PowerShell 环境变量覆盖（见问题 3） |
| `500` + `403` / `404` 等 | API 地址或 token 不对，确认 `.env` 内容 |
| `500` + 其他报错 | 查看终端完整 traceback，可能是请求/响应格式问题 |
| `422` | 请求参数校验失败，检查 `password` 长度是否在 6-20 之间 |

### 4.7 用 curl 直接测试（绕过 Swagger）

如果 Swagger 有问题，可以直接在终端用 curl 排查：

```bash
# 1. 注册
curl -s -X POST "http://127.0.0.1:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}'

# 2. 登录（拿到 token）
curl -s -X POST "http://127.0.0.1:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"123456"}'

# 3. 创建会话（替换 YOUR_TOKEN）
curl -s -X POST "http://127.0.0.1:8000/api/conversations" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"测试"}'

# 4. 发消息（替换 YOUR_TOKEN 和会话 ID）
echo '{"content":"你好"}' | curl -s -X POST "http://127.0.0.1:8000/api/conversations/1/messages" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @-
```

### 4.8 用 Python 直接测 API（排查后端代码是否正常）

如果后端接口不通但不确定是代码问题还是模型 API 问题，可以直接用 Python 调模型 API：

```powershell
.venv\Scripts\python -c "
import httpx
from backend.config import settings

with httpx.Client(timeout=60.0) as client:
    resp = client.post(
        f'{settings.anthropic_base_url}/v1/messages',
        headers={
            'x-api-key': settings.anthropic_auth_token,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        json={
            'model': settings.anthropic_model,
            'max_tokens': 100,
            'messages': [{'role': 'user', 'content': 'hi'}],
        },
    )
    print('Status:', resp.status_code)
    print('Body:', resp.text[:500])
"
```

- 如果这个返回 `200` 但接口返回 `500`，说明是代码逻辑问题
- 如果这个也报错，说明是 `.env` 配置或 API 本身的问题

---

## 五、.env 配置说明

项目通过 `backend/config.py` 中的 `pydantic-settings` 读取配置，当前支持的 Anthropic 协议模型配置项：

```
ANTHROPIC_BASE_URL=https://api.anthropic.com       # API 地址
ANTHROPIC_AUTH_TOKEN=your-token                     # 认证 Token
ANTHROPIC_MODEL=claude-sonnet-4-6                   # 模型名
```

换模型时只需修改 `.env` 中这三个值即可，无需改动代码。

> **注意**：目标 API 必须兼容 Anthropic Messages API 协议（`/v1/messages` + `x-api-key` 头），包括但不限于：
> - Anthropic 官方 API
> - DeepSeek Anthropic 兼容端点
> - 阿里云百炼 Anthropic 兼容端点
> - 或其他代理/网关

---

## 六、文件变更清单

| 文件 | 变更内容 |
|------|---------|
| `backend/security.py` | `passlib` → `bcrypt` 直接调用 |
| `backend/config.py` | `deepseek_*` 配置项 → `anthropic_*` |
| `backend/routers/messages.py` | AI 调用格式改为 Anthropic 协议；响应解析兼容 `thinking` 块 |
| `backend/models.py` | `model_name` 默认值清空 |
| `backend/requirements.txt` | `passlib` → `bcrypt` |
| `.env` | 新增三个 `ANTHROPIC_*` 配置项 |