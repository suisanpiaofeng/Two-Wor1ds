# TwoWor1ds

TwoWor1ds 是一个以文字社交为核心的全栈项目，前端基于 React + TypeScript + Vite，后端基于 Express + PostgreSQL，并通过同源 `/api` 接口部署在 Vercel。

线上地址：`https://twowor1ds.online`

## 核心功能

- 邮箱验证码注册、邮箱密码登录、游客进入
- 世界广场发帖、标签、点赞、收藏、评论
- 帖子全屏详情页，支持完整正文、评论区、评论输入
- 一级楼中楼回复、评论点赞、评论收藏、评论删除
- 个人中心：我的帖子、我的收藏、我的评论
- 头像上传、昵称修改、他人主页查看
- 消息中心：互动提醒聚合、私聊会话、聊天详情页
- 聊天框删除、未读数字全局刷新、游客与注册账号互聊

## 技术栈

### 前端

- React 19
- TypeScript
- Vite 8
- Tailwind CSS 3
- React Context + Hooks

### 后端

- Express
- PostgreSQL
- `pg`
- `jsonwebtoken`
- `bcryptjs`
- Nodemailer

### 部署

- Vercel
- Railway PostgreSQL

## 项目结构

```text
.
├── api/                # Express API 入口与数据库初始化逻辑
├── database/           # PostgreSQL schema
├── docx/               # 前后端功能文档
├── public/             # 静态资源
├── scripts/            # 辅助脚本，如数据库初始化
├── src/
│   ├── components/     # UI 组件
│   ├── context/        # 全局状态管理
│   ├── pages/          # 页面级组件
│   ├── services/       # API 封装
│   ├── utils/          # 工具函数
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── package.json
└── vercel.json
```

## 本地运行

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 并填写真实值：

```bash
cp .env.example .env
```

需要至少配置：

- `DATABASE_URL`
- `DATABASE_SSL`
- `DATABASE_SSL_REJECT_UNAUTHORIZED`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

### 3. 初始化数据库

```bash
npm run init-db
```

### 4. 启动前端开发环境

```bash
npm run dev
```

## 常用命令

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run init-db
```

## 部署说明

- 前端和后端统一部署在 Vercel
- `vercel.json` 已配置 SPA 路由回退与 `/api` 转发
- 后端数据库结构支持运行时自检与自动补齐

## 文档

- 前端文档：`docx/frontend.md`
- 后端文档：`docx/backend.md`

## 当前状态

- 已支持头像上传与真实头像显示
- 已支持帖子和评论发布时间展示
- 已支持聊天框删除
- 已修复游客与注册账号聊天消息接收问题
- 已修复底部消息标签未读数字在非消息页不刷新的问题
