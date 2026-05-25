# AI Fitness 助手 - 项目上下文文档

> 本文档用于保存项目进度，下次对话前请提供给 AI，以便无缝接续开发。
> 生成日期：2026-05-24

---

## 一、项目概述

做一个 AI 健身助手网站。

## 二、MVP（第一版）范围

**只做以下核心功能，其他全部砍掉：**
1. 用户注册 / 登录
2. 与 AI 助手聊天（调用 AI API，如 DeepSeek）
3. 保存聊天记录到数据库
4. 查询历史聊天会话和消息
5. 一个简单网页展示

**未来再做的功能（非 MVP）：**
AI 动作识别、支付会员、社区、排行榜、App、消息通知、多模型切换、数据统计图、教练系统、饮食推荐等。

---

## 三、全栈基础认知（学习成果）

### 前端结构
- **HTML**：决定页面有什么（结构）
- **CSS**：决定页面长什么样（样式）
- **JavaScript**：点击按钮、调 API、接收后端数据、动态更新页面（逻辑）
- **React / Vue**：更高级的 JS 页面开发框架，可以先不学

### 后端结构
- 编程语言
- Web 框架
- API 接口
- 数据库
- 业务逻辑
- AI 调用

### Web 框架理解
Web 框架 = 帮你快速开发后端网站/API 的工具箱。

| 编程语言 | Web 框架 |
|----------|----------|
| Python | FastAPI / Django / Flask |
| Java | Spring Boot |
| JavaScript | Express / NestJS |
| Go | Gin |

**框架特点：**
- **Flask**：轻量、自由、适合小项目
- **Django**：大而全、自带后台、企业感强
- **FastAPI**：现代、API 开发体验好、AI 项目流行、性能高、自动生成文档

### 为什么先设计 API
API 决定了：
- 前端往哪里发请求
- 传什么数据
- 返回什么数据

**接口设计核心原则**：一个接口 = 一个明确的功能。例如 `POST /login` 只负责登录，不要顺便返回历史记录。

**API 会反推数据库结构**：
- `GET /history` → 需要 `messages` 表
- `POST /login` → 需要 `users` 表

### 后端开发的本质
写 API → 操作数据库 → 处理业务逻辑

---

## 四、数据流设计

### 核心思路
用户输入什么？→ 后端返回什么？→ 数据库存什么？

### AI 聊天数据流
```
用户输入问题
  → 前端调用后端 API
  → 后端读取用户选择的模型
  → 调用 AI API（如 DeepSeek）
  → 返回结果
  → 保存聊天记录到数据库
  → 前端展示
```

---

## 五、数据库设计（已确定）

### 5.1 表结构

采用 **3 张表**：`users`、`conversations`、`messages`

**为什么分 3 张而不是 2 张？**
如果合并，每次发消息都要重复存会话标题、模型名，改标题要更新所有消息记录，查会话列表需要去重分组，非常麻烦。

### 5.2 表关系

```
users (1) ────────< (N) conversations (1) ────────< (N) messages
```

- 一个用户可以有很多会话（一对多）
- 一个会话里可以有很多条消息（一对多）

### 5.3 字段详情

#### users（用户表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| username | VARCHAR(50) NOT NULL UNIQUE | 用户名 |
| password_hash | VARCHAR(255) NOT NULL | 密码哈希（绝不存明文）|
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | 注册时间 |
| updated_at | TIMESTAMP DEFAULT ... ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

#### conversations（会话表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| user_id | INT NOT NULL FK | 关联 users.id |
| title | VARCHAR(200) | 会话标题 |
| model_name | VARCHAR(50) | AI 模型名（预留多模型切换）|
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP DEFAULT ... ON UPDATE CURRENT_TIMESTAMP | 更新时间 |

#### messages（消息表）
| 字段名 | 类型 | 说明 |
|--------|------|------|
| id | INT PK AUTO_INCREMENT | 主键 |
| conversation_id | INT NOT NULL FK | 关联 conversations.id |
| role | VARCHAR(20) NOT NULL | user / assistant / system |
| content | TEXT NOT NULL | 消息内容 |
| created_at | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | 发送时间 |

### 5.4 建表 SQL（MySQL）

```sql
CREATE DATABASE IF NOT EXISTS AI_Fitness DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE AI_Fitness;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(200),
    model_name VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
```

---

## 六、当前进度

- [x] 确定 MVP 范围
- [x] 设计数据流
- [x] 设计数据库（表结构、字段、关系）
- [x] 本地 MySQL 创建数据库 `AI_Fitness` 及三张表
- [x] 生成项目上下文文档

## 七、下一步（待定）

**待决策：**
1. **先设计 API 接口**，再写代码？
2. **直接进入后端代码开发**（Python + FastAPI），在写代码过程中定义接口？

**后续流程（全栈开发标准流程）：**
设计 API 接口 → 写后端代码（API + 数据库操作 + 业务逻辑）→ 测试接口 → 做前端 → 前后端联调 → 部署上线

---

## 八、关键决策记录

- 数据库选择：**MySQL**（用户本地已安装）
- 数据库名：**AI_Fitness**
- 后端语言和框架：**待定**（用户在考虑 Python + FastAPI，但数据库设计阶段未最终确定）
- 用户偏好：喜欢一步一步来，每步需确认后再继续