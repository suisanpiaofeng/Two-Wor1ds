# TwoWor1ds 前端功能文档

## 项目概述

TwoWor1ds 前端是一个基于 React 的单页应用，提供社交分享平台的用户界面。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **路由**: React Router
- **样式**: Tailwind CSS 3
- **状态管理**: React Context + Hooks
- **部署**: Vercel

## 核心功能模块

### 1. 游客认证

- **快速开始**: 用户无需注册登录，点击即可进入
- **Token 管理**: 自动保存和验证访问令牌
- **本地存储**: Token 持久化存储

### 2. 帖子展示

- **瀑布流布局**: 展示所有帖子
- **标签筛选**: 按标签分类浏览
- **排序方式**: 最新/最热排序

### 3. 帖子创作

- **富文本输入**: 支持文本内容
- **标签选择**: 预设标签 + 自定义标签
- **字数限制**: 500字限制

### 4. 互动功能

- **点赞**: 帖子点赞/取消点赞
- **评论**: 添加评论
- **收藏**: 收藏帖子

## 组件结构

### 页面组件

- **SquarePage**: 广场主页
  - 帖子列表展示
  - 帖子创建表单
  - 标签筛选器

### UI 组件

- **PostCard**: 帖子卡片
  - 展示帖子内容
  - 点赞、评论按钮
  - 评论列表

- **TagEditor**: 标签编辑器
  - 预设标签选择
  - 自定义标签输入

- **Comment**: 评论组件
  - 评论内容展示
  - 用户头像和昵称

## AppContext 状态管理

### 状态字段

| 字段 | 类型 | 说明 |
|------|------|------|
| currentUser | User \| null | 当前用户信息 |
| tags | Tag[] | 标签列表 |
| posts | Post[] | 帖子列表 |
| likedPosts | string[] | 点赞的帖子ID列表 |
| collectedPosts | string[] | 收藏的帖子ID列表 |
| isAuthenticated | boolean | 是否认证 |
| loading | boolean | 加载状态 |
| hasMorePosts | boolean | 是否有更多帖子 |
| isLoadingMore | boolean | 加载更多状态 |
| isRefreshing | boolean | 刷新状态 |

### 方法

| 方法 | 说明 |
|------|------|
| addTag | 添加标签 |
| removeTag | 删除标签 |
| createPost | 创建帖子 |
| deletePost | 删除帖子 |
| likePost | 点赞帖子 |
| collectPost | 收藏帖子 |
| addComment | 添加评论 |
| updateTags | 更新标签列表 |
| logout | 登出 |
| refreshPosts | 刷新帖子 |
| loadMorePosts | 加载更多帖子 |

## 类型定义

### User 类型

```typescript
interface User {
  id: string;
  email: string;
  nickname: string;
  avatarSeed: string;
}
```

### Post 类型

```typescript
interface Post {
  id: string;
  content: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  user_id: string;
  nickname: string;
  avatar_seed: string;
  created_at: number;
  comments: Comment[];
}
```

### Comment 类型

```typescript
interface Comment {
  id: string;
  content: string;
  user_id: string;
  nickname: string;
  avatar_seed: string;
  created_at: number;
}
```

### Tag 类型

```typescript
interface Tag {
  id: string;
  name: string;
  isPreset?: boolean;
}
```

## 已移除功能

以下功能已从项目中移除：

- 用户注册页面
- 用户登录页面
- 聊天模块
- 用户匹配功能
- 在线用户列表

## 项目结构

```
src/
├── components/
│   ├── Comment.tsx      # 评论组件
│   ├── PostCard.tsx     # 帖子卡片组件
│   └── TagEditor.tsx    # 标签编辑器组件
├── context/
│   └── AppContext.tsx   # 全局状态管理
├── pages/
│   └── SquarePage.tsx   # 广场主页
├── services/
│   └── api.ts           # API 服务封装
├── utils/
│   └── helpers.ts       # 工具函数
├── App.tsx              # 应用入口
├── main.tsx             # React 入口
├── types.ts             # TypeScript 类型定义
└── index.css            # 全局样式
```

## 部署状态

| 项目 | 状态 |
|------|------|
| 部署平台 | Vercel ✅ |
| 前端构建 | 正常 ✅ |
| API 连接 | 正常 ✅ |
| 域名 | twowor1ds.online ✅ |

## 项目进展

### 已完成
- ✅ 游客模式认证
- ✅ 帖子列表展示
- ✅ 帖子创建功能
- ✅ 点赞和评论功能
- ✅ 标签筛选
- ✅ 响应式布局
- ✅ Vercel 部署

### 待开发
- ⏳ 用户资料页面
- ⏳ 帖子详情页
- ⏳ 图片上传支持
- ⏳ 通知系统
- ⏳ 搜索功能
