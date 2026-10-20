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
- `pg`（连接池 + 运行时 Schema 自检）
- `bcryptjs`
- Nodemailer（SMTP 邮件服务）

### 部署

- Vercel（前后端一体部署）
- Neon PostgreSQL（免费版，服务端数据库）

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
