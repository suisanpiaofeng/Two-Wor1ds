# TwoWor1ds 后端功能文档

## 项目概述

TwoWor1ds 后端基于 Express，部署到 Vercel Serverless Functions，负责认证、验证码注册、帖子、互动、收藏、通知、私聊会话等 API，并通过 PostgreSQL 持久化业务数据。

## 技术栈

- **运行时**: Node.js ESM
- **框架**: Express.js
- **数据库**: PostgreSQL（当前生产库为 Railway）
- **数据库访问**: `pg`
- **认证**: Token + 邮箱验证码注册登录 + 游客模式
- **验证码存储**: PostgreSQL `email_verification_codes`
- **密码哈希**: `bcryptjs`
- **邮件服务**: Nodemailer + QQ 邮箱 SMTP
- **部署**: Vercel Serverless Functions + `vercel.json`
- **线上域名**: `https://twowor1ds.online`

## API 模块

### 1. 健康检查

- **接口**: `GET /`
- **描述**: 返回 API 服务基本状态

- **接口**: `GET /health`
- **描述**: 返回健康状态和时间戳

### 2. 用户认证

- **接口**: `POST /api/auth/send-code`
- **参数**: `email`
- **描述**: 生成 6 位验证码，写入 PostgreSQL，并发送到邮箱，有效期 5 分钟
- **补充**: 若 SMTP 未配置，开发环境会在日志输出验证码

- **接口**: `POST /api/auth/register`
- **参数**: `email`、`code`、`password`、`nickname`
- **描述**: 校验数据库中的验证码后创建正式用户并签发 Token
- **补充**: 验证码校验失败会累计尝试次数，超过 5 次要求重新发送

- **接口**: `POST /api/auth/login`
- **参数**: `email`、`password`
- **描述**: 校验密码后返回用户信息与 Token

- **接口**: `POST /api/auth/quickstart`
- **参数**: `deviceId`（可选）
- **描述**: 创建游客账户，或基于已有游客 Token 续用身份

- **接口**: `GET /api/auth/verify`
- **描述**: 校验当前 Token 并返回用户信息

- **接口**: `POST /api/auth/logout`
- **描述**: 删除当前 Token

### 3. 帖子与互动

- **接口**: `GET /api/posts`
- **参数**: `tag`、`sort`、`limit`、`offset`
- **描述**: 返回帖子列表、帖子互动计数、当前用户点赞/收藏状态以及对应评论摘要

- **接口**: `GET /api/posts/:id`
- **描述**: 返回单个帖子的完整详情、全部评论，以及帖子和评论的当前用户互动状态

- **接口**: `POST /api/posts`
- **参数**: `content`、`tags`
- **描述**: 创建新帖子

- **接口**: `PUT /api/posts/:id`
- **参数**: `content`、`tags`
- **描述**: 仅允许作者编辑自己的帖子，并返回更新后的完整帖子详情
 
- **接口**: `DELETE /api/posts/:id`
- **描述**: 仅允许作者删除自己的帖子，并级联清理评论、点赞、收藏、通知

- **接口**: `POST /api/posts/:id/like`
- **描述**: 切换点赞状态，并在必要时创建通知

- **接口**: `POST /api/posts/:id/collect`
- **描述**: 切换收藏状态，并返回最新收藏数

- **接口**: `POST /api/posts/:id/comment`
- **参数**: `content`、`parentCommentId`（可选）
- **描述**: 新增顶层评论或楼内回复；若传入 `parentCommentId`，回复会归入该楼层内，不再新建顶层评论

- **接口**: `POST /api/comments/:id/like`
- **描述**: 切换评论点赞状态，并返回最新评论点赞数

- **接口**: `POST /api/comments/:id/collect`
- **描述**: 切换评论收藏状态，并返回最新评论收藏数

- **接口**: `DELETE /api/comments/:id`
- **描述**: 删除当前用户自己的评论；若该评论下还有楼内回复，会级联删除其子回复并同步扣减帖子评论数

### 4. 用户资料

- **接口**: `PUT /api/users/profile`
- **参数**: `nickname`、`avatar_seed`
- **描述**: 更新当前用户昵称，或上传后的头像图片数据 / 默认头像种子

- **接口**: `GET /api/users/collections`
- **描述**: 返回当前用户收藏的帖子与评论

- **接口**: `GET /api/users/comments`
- **描述**: 返回当前用户发表过的评论，并带上对应原帖信息

- **接口**: `GET /api/users/:id/profile`
- **描述**: 返回指定用户的基础资料与公开帖子列表，用于“查看主页”

- **接口**: `PUT /api/users/activity`
- **描述**: 更新用户最后活跃时间

### 5. 通知

- **接口**: `GET /api/notifications`
- **描述**: 返回帖子点赞、帖子收藏、帖子评论、评论点赞、评论收藏、评论回复等互动通知

- **接口**: `PUT /api/notifications/mark-read`
- **描述**: 将当前用户通知全部置为已读

- **接口**: `GET /api/notifications/unread-count`
- **描述**: 返回未读通知数
- **补充**: 前端底部消息标签当前基于该接口显示未读提醒徽章

### 6. 私聊会话

- **接口**: `GET /api/conversations`
- **描述**: 返回当前用户的全部私聊会话、会话对方信息、最新一条消息与未读数

- **接口**: `POST /api/conversations/direct`
- **参数**: `target_user_id`
- **描述**: 创建或打开与指定用户的一对一会话

- **接口**: `GET /api/conversations/:id/messages`
- **描述**: 返回指定会话的聊天消息列表

- **接口**: `POST /api/conversations/:id/messages`
- **参数**: `content`
- **描述**: 向指定会话发送一条私聊消息

- **接口**: `PUT /api/conversations/:id/read`
- **描述**: 将当前用户在该会话中的未读状态置为已读

- **接口**: `DELETE /api/conversations/:id`
- **描述**: 删除当前用户可访问的私聊会话，并级联删除该会话下的聊天消息

## 数据库表结构

### users 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 用户唯一标识 |
| email | VARCHAR | 邮箱（游客用户为自动生成） |
| password_hash | VARCHAR | 密码哈希 |
| nickname | VARCHAR | 昵称 |
| avatar_seed | TEXT | 头像图片数据或默认头像种子 |
| created_at | TIMESTAMP | 创建时间 |
| last_active | TIMESTAMP | 最后活跃时间 |

### auth_tokens 表
| 字段 | 类型 | 说明 |
|------|------|------|
| token | VARCHAR | Token 值 |
| user_id | UUID | 用户 ID |
| created_at | TIMESTAMP | 创建时间 |

### email_verification_codes 表
| 字段 | 类型 | 说明 |
|------|------|------|
| email | VARCHAR | 作为主键的邮箱 |
| code_hash | VARCHAR | 验证码 SHA-256 哈希 |
| attempts | INTEGER | 已尝试次数 |
| expires_at | TIMESTAMP | 过期时间 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 最近更新时间 |

### posts 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 帖子唯一标识 |
| user_id | UUID | 作者 ID |
| content | TEXT | 帖子内容 |
| tags | TEXT[] | 标签数组 |
| likes_count | INTEGER | 点赞数 |
| collections_count | INTEGER | 收藏数 |
| comments_count | INTEGER | 评论数 |
| created_at | TIMESTAMP | 创建时间 |

### comments 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 评论唯一标识 |
| post_id | UUID | 所属帖子 ID |
| user_id | UUID | 评论者 ID |
| content | TEXT | 评论内容 |
| likes_count | INTEGER | 评论点赞数 |
| collections_count | INTEGER | 评论收藏数 |
| root_comment_id | UUID | 所属楼层根评论 ID，顶层评论为空 |
| reply_to_comment_id | UUID | 直接回复的评论 ID |
| created_at | TIMESTAMP | 创建时间 |

### likes 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 点赞唯一标识 |
| post_id | UUID | 所属帖子 ID |
| user_id | UUID | 点赞者 ID |
| created_at | TIMESTAMP | 创建时间 |

### collections 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 收藏唯一标识 |
| post_id | UUID | 所属帖子 ID |
| user_id | UUID | 收藏者 ID |
| created_at | TIMESTAMP | 创建时间 |

### comment_likes 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 记录唯一标识 |
| comment_id | UUID | 所属评论 ID |
| user_id | UUID | 点赞者 ID |
| created_at | TIMESTAMP | 创建时间 |

### comment_collections 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | SERIAL | 记录唯一标识 |
| comment_id | UUID | 所属评论 ID |
| user_id | UUID | 收藏者 ID |
| created_at | TIMESTAMP | 创建时间 |

### notifications 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 通知唯一标识 |
| user_id | UUID | 接收用户 ID |
| post_id | UUID | 关联帖子 ID |
| actor_user_id | UUID | 触发通知的用户 ID |
| comment_id | UUID | 关联评论 ID，可用于定位评论 |
| type | VARCHAR | 通知类型（`like` / `collect` / `comment` / `comment_like` / `comment_collect` / `comment_reply`） |
| comment_content | TEXT | 新评论或新回复内容 |
| target_comment_content | TEXT | 被点赞 / 收藏 / 回复的那条评论内容 |
| created_at | TIMESTAMP | 创建时间 |
| read | BOOLEAN | 是否已读 |

### conversations 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 会话唯一标识 |
| user_one_id | UUID | 会话参与者 A |
| user_two_id | UUID | 会话参与者 B |
| user_one_last_read_at | TIMESTAMP | A 最近已读时间 |
| user_two_last_read_at | TIMESTAMP | B 最近已读时间 |
| last_message_at | TIMESTAMP | 最近一条消息时间 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 最近更新时间 |

### conversation_messages 表
| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 消息唯一标识 |
| conversation_id | UUID | 所属会话 ID |
| sender_id | UUID | 发送者 ID |
| content | TEXT | 聊天内容 |
| created_at | TIMESTAMP | 发送时间 |

## 环境变量

### 数据库

- `DATABASE_URL`: 必填，PostgreSQL 连接串
- `DATABASE_SSL`: 可选，默认 `true`
- `DATABASE_SSL_REJECT_UNAUTHORIZED`: 可选，默认 `false`

### SMTP

- `SMTP_HOST`: 例如 `smtp.qq.com`
- `SMTP_PORT`: 例如 `587`
- `SMTP_SECURE`: `true` 或 `false`
- `SMTP_USER`: QQ 邮箱地址
- `SMTP_PASS`: QQ 邮箱 SMTP 授权码
- `SMTP_FROM`: 发件人邮箱，未配置时回退到 `SMTP_USER`

### 本地示例

- 仓库已新增 `.env.example`
- 数据库初始化脚本已统一从 `DATABASE_URL` 读取，不再保留硬编码连接串
- 可通过 `npm run init-db` 执行 `database/schema.sql`

## 部署状态

| 项目 | 状态 |
|------|------|
| 前端站点 | 已上线，`https://twowor1ds.online` |
| Vite 前端构建 | 本地验证通过 |
| API 代码入口 | 本地导入验证通过（使用占位 `DATABASE_URL`） |
| Vercel 生产部署 | 已成功重新部署 |
| 线上健康检查 | `GET /health` 已验证通过 |
| 线上数据库查询 | `GET /api/posts` 已验证通过 |

## 本次更新记录

### 已完成

- 已将验证码存储从内存对象迁移到 PostgreSQL。
- 已新增 `email_verification_codes` 表和过期索引。
- 已把数据库配置改为环境变量读取，不再在代码中保留硬编码连接串。
- 已补充 `.env.example` 与 `npm run init-db`。
- 已补充 `vercel.json`，明确 Vite 输出目录、函数入口和 SPA 路由回退。
- 已补充运行时 schema 自检与缺表自动创建，兼容历史未完整初始化的生产库。
- 已完成 Vercel 生产重新部署并绑定回 `https://twowor1ds.online`。
- 已完成通知未读链路联调，前端改为通过 `GET /api/notifications/unread-count` 驱动底部消息提醒。
- 已补充帖子详情接口，支持广场、消息、个人页进入同一全屏详情页。
- 已补充评论点赞与评论收藏能力，并在运行时自动补齐相关表结构与计数字段。
- 已补充帖子编辑接口，帖子作者可在详情页重新编辑内容与标签。
- 已补充评论楼层字段与回复能力，支持“顶层评论 + 楼内回复”。
- 已补充评论删除、我的评论、收藏评论查询接口，支撑个人中心新入口。
- 已补充通知扩展字段，通知发起人、关联评论、目标评论内容都可被返回给前端。
- 已补充帖子收藏通知、评论点赞通知、评论收藏通知、评论回复通知。
- 已补充他人主页查询接口，支持点击头像后查看公开帖子。
- 已补充一对一私聊会话与会话消息表，以及会话列表、发起聊天、拉取消息、发送消息、标记已读接口。

### 已解决的问题

- **Vercel 构建卡住**: 修复了 `bcrypt` / `bcryptjs` 依赖导入问题，并补充显式部署配置。
- **验证码不稳定**: 不再依赖 Serverless 单实例内存，改为从 PostgreSQL 持久化校验。
- **数据库凭据硬编码**: 已从 `api/utils/db.js`、`api/utils/config.js`、`scripts/init-db.js` 移除。

### 仍需平台侧执行

- 若旧数据库连接串已经泄露，仍需在 Railway / PostgreSQL 提供方控制台执行真正的凭据轮换。
- 轮换后需同步更新 Vercel 项目的 `DATABASE_URL` 环境变量。
