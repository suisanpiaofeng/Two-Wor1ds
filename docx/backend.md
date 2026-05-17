# TwoWor1ds 后端功能文档

## 项目概述

TwoWor1ds 是一个轻量级的社交分享平台，采用前后端分离架构，后端提供 RESTful API 服务。

## 技术栈

- **框架**: Express.js + Vercel Serverless Functions
- **数据库**: PostgreSQL (Railway)
- **认证**: JWT Token + 游客模式
- **部署**: Vercel
- **域名**: twowor1ds.online

## 核心功能模块

### 1. 用户认证

#### 游客模式 (Quick Start)
- **接口**: `POST /api/auth/quickstart`
- **描述**: 创建游客用户，无需注册登录
- **响应**: 返回用户信息和访问令牌

#### Token 验证
- **接口**: `GET /api/auth/verify`
- **描述**: 验证 Token 有效性，返回用户信息

#### 登出
- **接口**: `POST /api/auth/logout`
- **描述**: 清除用户 Token

### 2. 帖子管理

#### 获取帖子列表
- **接口**: `GET /api/posts`
- **参数**: 
  - `tag`: 标签筛选（可选）
  - `sort`: 排序方式 (`latest` / `popular`)
  - `limit`: 每页数量
  - `offset`: 偏移量

#### 创建帖子
- **接口**: `POST /api/posts`
- **参数**: `content`, `tags`

#### 删除帖子
- **接口**: `DELETE /api/posts/:id`
- **描述**: 用户只能删除自己的帖子

### 3. 互动功能

#### 点赞/取消点赞
- **接口**: `POST /api/posts/:id/like`

#### 添加评论
- **接口**: `POST /api/posts/:id/comment`
- **参数**: `content`

## 数据库表结构

### users 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 用户唯一标识 |
| email | VARCHAR | 邮箱（游客为自动生成） |
| password_hash | VARCHAR | 密码哈希（游客为空） |
| nickname | VARCHAR | 昵称 |
| avatar_seed | VARCHAR | 头像种子 |
| created_at | TIMESTAMP | 创建时间 |
| last_active | TIMESTAMP | 最后活跃时间 |

### posts 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 帖子唯一标识 |
| user_id | UUID | 作者ID |
| content | TEXT | 帖子内容 |
| tags | TEXT[] | 标签数组 |
| likes_count | INTEGER | 点赞数 |
| comments_count | INTEGER | 评论数 |
| created_at | TIMESTAMP | 创建时间 |

### comments 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 评论唯一标识 |
| post_id | UUID | 所属帖子ID |
| user_id | UUID | 评论者ID |
| content | TEXT | 评论内容 |
| created_at | TIMESTAMP | 创建时间 |

### likes 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 点赞唯一标识 |
| post_id | UUID | 所属帖子ID |
| user_id | UUID | 点赞者ID |
| created_at | TIMESTAMP | 创建时间 |

### auth_tokens 表
| 字段 | 类型 | 说明 |
|------|------|------|
| token | VARCHAR | Token 值 |
| user_id | UUID | 用户ID |
| created_at | TIMESTAMP | 创建时间 |

## 已移除功能

以下功能已从项目中移除：

- 用户注册 (`/auth/register`)
- 用户登录 (`/auth/login`)
- 聊天模块 (`/chat/*`)
- 用户匹配 (`/users/match`, `/users/random-match`)
- 在线用户列表 (`/users/online`)

## 部署状态

| 项目 | 状态 |
|------|------|
| 部署平台 | Vercel ✅ |
| 数据库 | Railway PostgreSQL ✅ |
| 域名 | twowor1ds.online ✅ |
| API 状态 | 正常运行 ✅ |

## 项目进展

### 已完成
- ✅ 游客模式认证系统
- ✅ 帖子 CRUD 操作
- ✅ 点赞和评论功能
- ✅ 标签系统
- ✅ Vercel 部署
- ✅ 自定义域名配置

### 待开发
- ⏳ 用户个人资料编辑
- ⏳ 帖子搜索功能
- ⏳ 图片上传支持
- ⏳ 通知系统
