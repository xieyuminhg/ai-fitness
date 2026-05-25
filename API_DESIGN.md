# AI Fitness 助手 - API 接口设计文档

> 本文档用于定义前后端交互规范，开发时以本文档为准。

---

## 一、通用规范

### 1.1 基础信息

| 项 | 说明 |
|----|------|
| 协议 | HTTP |
| 数据格式 | JSON |
| 字符编码 | UTF-8 |
| 基础 URL | `http://localhost:8000`（开发环境） |

### 1.2 认证方式

采用 **JWT Token** 认证。

- 登录/注册成功后，后端返回 `token`
- 前端后续请求需在请求头中携带：`Authorization: Bearer <token>`
- 未携带 Token 或 Token 无效时，后端返回 `401`

### 1.3 统一响应格式

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `code` | int | 状态码，`200` 表示成功，其他见错误码表 |
| `message` | string | 提示信息 |
| `data` | any | 业务数据，失败时可能为 `null` |

### 1.4 错误码表

| 状态码 | 含义 | 典型场景 |
|--------|------|----------|
| `200` | 成功 | 请求处理成功 |
| `400` | 请求参数错误 | 缺少必填字段、格式不对 |
| `401` | 未授权 | Token 缺失、过期、无效 |
| `403` | 禁止访问 | 无权限操作他人资源 |
| `404` | 资源不存在 | 会话 ID 找不到 |
| `500` | 服务器内部错误 | 数据库异常、AI 接口调用失败 |

---

## 二、认证模块

### 2.1 用户注册

**接口信息**

| 方法 | 路径 |
|------|------|
| `POST` | `/api/auth/register` |

**请求体**

```json
{
  "username": "zhangsan",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名，长度 3-50 字符 |
| `password` | string | 是 | 密码，长度 6-20 字符 |

**响应体（成功）**

```json
{
  "code": 200,
  "message": "注册成功",
  "data": {
    "user_id": 1,
    "username": "zhangsan",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**错误情况**

- `400`：用户名或密码为空、格式不符合要求
- `400`：用户名已存在

---

### 2.2 用户登录

**接口信息**

| 方法 | 路径 |
|------|------|
| `POST` | `/api/auth/login` |

**请求体**

```json
{
  "username": "zhangsan",
  "password": "123456"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `username` | string | 是 | 用户名 |
| `password` | string | 是 | 密码 |

**响应体（成功）**

```json
{
  "code": 200,
  "message": "登录成功",
  "data": {
    "user_id": 1,
    "username": "zhangsan",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**错误情况**

- `400`：用户名或密码为空
- `401`：用户名不存在或密码错误

---

## 三、会话模块

### 3.1 查询会话列表

获取当前登录用户的所有聊天会话。

**接口信息**

| 方法 | 路径 |
|------|------|
| `GET` | `/api/conversations` |

**请求头**

```
Authorization: Bearer <token>
```

**查询参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | int | 否 | 1 | 页码 |
| `limit` | int | 否 | 20 | 每页条数，最大 100 |

**响应体（成功）**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "title": "如何制定减脂计划",
        "model_name": "deepseek-chat",
        "created_at": "2026-05-24T10:00:00",
        "updated_at": "2026-05-24T10:30:00"
      }
    ],
    "total": 5,
    "page": 1,
    "limit": 20
  }
}
```

**错误情况**

- `401`：Token 缺失或无效

---

### 3.2 创建新会话

**接口信息**

| 方法 | 路径 |
|------|------|
| `POST` | `/api/conversations` |

**请求头**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**请求体**

```json
{
  "title": "健身计划咨询",
  "model_name": "deepseek-chat"
}
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `title` | string | 否 | "新对话" | 会话标题 |
| `model_name` | string | 否 | "deepseek-chat" | AI 模型名（预留） |

**响应体（成功）**

```json
{
  "code": 200,
  "message": "创建成功",
  "data": {
    "id": 1,
    "title": "健身计划咨询",
    "model_name": "deepseek-chat",
    "created_at": "2026-05-24T10:00:00",
    "updated_at": "2026-05-24T10:00:00"
  }
}
```

**错误情况**

- `401`：Token 缺失或无效

---

### 3.3 删除会话

删除指定会话，级联删除该会话下的所有消息。

**接口信息**

| 方法 | 路径 |
|------|------|
| `DELETE` | `/api/conversations/{id}` |

**请求头**

```
Authorization: Bearer <token>
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | int | 会话 ID |

**响应体（成功）**

```json
{
  "code": 200,
  "message": "删除成功",
  "data": null
}
```

**错误情况**

- `401`：Token 缺失或无效
- `403`：试图删除他人的会话
- `404`：会话不存在

---

## 四、消息模块

### 4.1 查询会话消息列表

获取某个会话下的全部聊天消息，按时间正序排列。

**接口信息**

| 方法 | 路径 |
|------|------|
| `GET` | `/api/conversations/{id}/messages` |

**请求头**

```
Authorization: Bearer <token>
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | int | 会话 ID |

**查询参数**

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `page` | int | 否 | 1 | 页码 |
| `limit` | int | 否 | 50 | 每页条数 |

**响应体（成功）**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "role": "user",
        "content": "你好，我想减肥",
        "created_at": "2026-05-24T10:00:00"
      },
      {
        "id": 2,
        "role": "assistant",
        "content": "你好！很高兴为你服务。请问你的身高体重是多少？",
        "created_at": "2026-05-24T10:00:02"
      }
    ],
    "total": 2,
    "page": 1,
    "limit": 50
  }
}
```

**错误情况**

- `401`：Token 缺失或无效
- `403`：试图查看他人的会话消息
- `404`：会话不存在

---

### 4.2 发送消息（核心接口）

向指定会话发送一条消息，后端自动调用 AI API 获取回复，并将双方消息保存到数据库。

**接口信息**

| 方法 | 路径 |
|------|------|
| `POST` | `/api/conversations/{id}/messages` |

**请求头**

```
Authorization: Bearer <token>
Content-Type: application/json
```

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `id` | int | 会话 ID |

**请求体**

```json
{
  "content": "我每天能运动 1 小时，推荐什么减脂方案？"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `content` | string | 是 | 用户输入的消息内容，不能为空 |

**响应体（成功）**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 3,
    "role": "assistant",
    "content": "根据你的情况，我建议采用有氧+力量结合的方式...",
    "created_at": "2026-05-24T10:05:00"
  }
}
```

> 说明：返回的是 AI 助手的回复消息。用户发送的消息后端也会存入数据库，但前端已持有该内容，故不重复返回。

**错误情况**

- `400`：`content` 为空
- `401`：Token 缺失或无效
- `403`：试图向他人的会话发消息
- `404`：会话不存在
- `500`：AI 接口调用失败

---

## 五、接口汇总表

| 序号 | 方法 | 路径 | 功能 | 需认证 |
|------|------|------|------|--------|
| 1 | `POST` | `/api/auth/register` | 用户注册 | 否 |
| 2 | `POST` | `/api/auth/login` | 用户登录 | 否 |
| 3 | `GET` | `/api/conversations` | 查询会话列表 | 是 |
| 4 | `POST` | `/api/conversations` | 创建新会话 | 是 |
| 5 | `DELETE` | `/api/conversations/{id}` | 删除会话 | 是 |
| 6 | `GET` | `/api/conversations/{id}/messages` | 查询消息列表 | 是 |
| 7 | `POST` | `/api/conversations/{id}/messages` | 发送消息 | 是 |