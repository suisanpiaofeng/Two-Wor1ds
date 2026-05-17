# TwoWor1ds 前端开发手册

## 项目概述

TwoWor1ds 前端是一个基于 React + TypeScript 的单页应用，负责用户认证、内容浏览、发帖互动、通知展示和个人资料管理，并通过同源 `/api` 路径调用后端接口。

## 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite 8
- **页面切换**: `App.tsx` 内部 overlay 状态切换
- **样式**: Tailwind CSS 3
- **状态管理**: React Context + Hooks
- **API 调用**: 浏览器原生 `fetch`
- **部署**: Vercel
- **线上域名**: `https://twowor1ds.online`

## 核心功能

### 1. 用户认证

- 支持邮箱密码登录。
- 支持邮箱验证码注册。
- 支持游客模式手动进入。
- 自动保存 `auth_token` 到 `localStorage`。
- 启动时可通过 `/api/auth/verify` 自动验证登录态。
- 游客身份支持续用登录态，不会因页面刷新而丢失聊天与消息能力。

### 2. 注册页交互

- 注册模式下先输入邮箱，再点击“发送验证码”。
- 验证码发送成功后才显示验证码输入框。
- 验证码发送后开启 300 秒倒计时。
- 倒计时结束后可点击“重新发送”。
- 注册按钮仅在邮箱、验证码、昵称、密码完整时显示并可提交。

### 3. 世界广场

- 展示帖子列表。
- 支持按标签筛选。
- 支持最新和最热排序。
- 支持分页加载更多内容。
- 支持创建文本帖子并附加标签。
- 广场页保留主帖子流，不再单独展示“我的收藏”列表入口。

### 4. 帖子互动

- 支持点赞和取消点赞。
- 支持收藏和取消收藏。
- 支持评论帖子。
- 评论支持一级楼中楼回复：可回复帖子评论，也可在楼内继续回复，但不会再新建新的顶层楼层。
- 支持打开帖子全屏详情页，查看完整正文、点赞数、收藏数和全部评论。
- 缩小卡片态仅展示正文前几行，完整内容需进入详情页查看。
- 广场页、消息页、我的帖子、我的收藏中的帖子都可进入同一详情页。
- 原卡片上的评论按钮改为直接跳转详情页。
- 详情页评论区支持上下滚动浏览全部评论，并保留底部评论输入栏。
- 评论也支持点赞和收藏。
- 支持删除自己的帖子。
- 帖子详情页中，自己的帖子支持重新编辑和删除。
- 自己发布的评论不可编辑，但可以删除。
- 帖子和评论统一显示发布时间：短期展示相对时间，较久内容展示日期。
- 帖子卡片交互已调整为更接近小红书的轻量风格。
- 点赞使用心形图标，已点赞为红色实心，未点赞为空心。
- 收藏使用五角星图标，已收藏为黄色实心，未收藏为空心。
- 评论使用气泡图标，点击后进入详情页。

### 5. 个人中心

- 展示当前用户头像、昵称、邮箱。
- 支持修改昵称，并可上传自己的头像图片；未上传时继续使用默认种子头像。
- 支持查看我的帖子。
- 支持查看我的收藏，并区分收藏的帖子与收藏的评论。
- 新增“我的评论”，集中展示自己发表过的评论。
- 我的评论和收藏评论都可跳转回原帖详情并定位到对应评论。
- 支持退出登录。

### 6. 消息与聊天

- 消息页改为 QQ 风格结构：顶部一个“互动提醒”盒子，下面是多个聊天会话框。
- 互动提醒盒子内统一收纳帖子点赞、帖子收藏、帖子评论、评论点赞、评论收藏、评论回复提醒。
- 自己的评论被他人继续评论或回复时，也会进入互动提醒盒子。
- 点击互动提醒盒子后可展开查看详细提醒，并跳转到原帖详情，必要时自动定位到对应评论。
- 聊天区域支持与多个用户分别建立独立会话，会话列表展示对方头像、昵称、最近一条消息和未读数。
- 点击会话后进入新的聊天框全屏界面，退出后回到消息列表。
- 支持删除聊天框；可在消息列表直接删除，也可在聊天详情页删除当前会话。
- 底部“消息”标签未读徽章现在会汇总互动提醒未读数与聊天未读数。

### 7. 头像操作与他人主页

- 点击任意非自己的头像会弹出操作层，提供“查看主页”和“去聊天”两个选项。
- “查看主页”进入他人主页页，可查看对方公开帖子列表。
- “去聊天”会直接创建或打开与对方的私聊会话，并同步出现在消息列表中。

## 页面与组件

### 页面组件

- **`AuthPage`**: 登录、注册、验证码发送、游客进入。
- **`SquarePage`**: 帖子流、发帖、筛选、排序。
- **`MessagesPage`**: 互动提醒盒子、聊天会话列表、未读状态处理。
- **`PostDetailPage`**: 帖子全屏详情、帖子互动、帖子编辑删除、楼中楼评论回复。
- **`ProfilePage`**: 个人信息、我的帖子、我的收藏、我的评论。
- **`ChatPage`**: 单个私聊会话详情页。
- **`UserProfilePage`**: 他人主页与公开帖子列表。

### UI 组件

- **`TabBar`**: 底部导航与未读消息徽章。
- **`PostCard`**: 帖子摘要展示、点赞、评论跳转、收藏、删除与头像操作入口。
- **`TagEditor`**: 预设标签选择与自定义标签输入。
- **`Comment`**: 评论内容、楼中楼回复、点赞、收藏、删除与头像操作入口。

## API 接入方式

### 当前策略

- 前端 `API_BASE_URL` 为空字符串，默认通过同源相对路径请求后端。
- 认证、帖子、用户、通知接口统一封装在 `src/services/api.ts`。
- 请求认证接口时，会自动从 `localStorage` 读取 `auth_token` 并放入 `Authorization` 请求头。

### 主要接口封装

- **认证**: `verify`、`logout`、`quickStart`、`sendCode`、`register`、`login`
- **帖子**: `getAll`、`getById`、`create`、`update`、`delete`、`like`、`collect`、`comment`、`deleteComment`、`likeComment`、`collectComment`
- **用户**: `updateActivity`、`updateProfile`、`getCollections`、`getMyComments`、`getProfile`
- **通知**: `getNotifications`、`markRead`
- **聊天**: `getAll`、`openDirect`、`getMessages`、`sendMessage`、`markRead`、`deleteConversation`

## AppContext 状态管理

### 主要状态

| 字段 | 类型 | 说明 |
|------|------|------|
| currentUser | `User \| null` | 当前用户信息 |
| tags | `Tag[]` | 标签列表 |
| posts | `Post[]` | 帖子列表 |
| collectionPosts | `Post[]` | 收藏的帖子列表 |
| myComments | `Comment[]` | 我的评论列表 |
| collectedComments | `Comment[]` | 收藏的评论列表 |
| likedPosts | `string[]` | 已点赞帖子 ID |
| collectedPosts | `string[]` | 已收藏帖子 ID |
| notifications | `Notification[]` | 通知列表 |
| conversations | `Conversation[]` | 私聊会话列表 |
| unreadCount | `number` | 互动提醒未读数 + 聊天未读数 |
| isAuthenticated | `boolean` | 是否已登录 |
| loading | `boolean` | 全局加载状态 |
| hasMorePosts | `boolean` | 是否还有更多帖子 |
| isLoadingMore | `boolean` | 是否正在加载更多 |
| isRefreshing | `boolean` | 是否正在刷新 |

### 主要方法

| 方法 | 说明 |
|------|------|
| `addTag` | 添加标签 |
| `removeTag` | 删除标签 |
| `createPost` | 创建帖子 |
| `editPost` | 编辑自己的帖子 |
| `deletePost` | 删除帖子 |
| `likePost` | 点赞帖子 |
| `collectPost` | 收藏帖子 |
| `addComment` | 添加评论或回复评论 |
| `deleteComment` | 删除自己的评论 |
| `likeComment` | 点赞评论 |
| `collectComment` | 收藏评论 |
| `loadPostDetail` | 加载帖子详情并同步到全局状态 |
| `updateTags` | 更新标签列表 |
| `logout` | 退出登录 |
| `login` | 用户登录 |
| `register` | 用户注册 |
| `sendCode` | 发送验证码 |
| `updateProfile` | 更新个人资料 |
| `loadCollections` | 加载收藏列表 |
| `loadMyComments` | 加载我的评论列表 |
| `loadNotifications` | 加载通知列表 |
| `markNotificationsRead` | 标记通知已读 |
| `loadConversations` | 加载聊天会话列表 |
| `openConversationWithUser` | 创建或打开与指定用户的私聊会话 |
| `loadConversationMessages` | 加载某个会话的全部聊天消息 |
| `sendChatMessage` | 发送私聊消息 |
| `markConversationRead` | 标记某个会话已读 |
| `deleteConversation` | 删除聊天框 |
| `getUserProfile` | 获取他人主页资料与帖子 |
| `refreshPosts` | 刷新帖子 |
| `loadMorePosts` | 加载更多帖子 |

## 主要类型

### User

```typescript
interface User {
  id: string;
  email?: string;
  nickname: string;
  avatarSeed: string;
}
```

### Post

```typescript
interface Post {
  id: string;
  content: string;
  tags: string[];
  likes: number;
  collectionsCount: number;
  commentsCount: number;
  likedBy: string[];
  collectedBy: string[];
  comments: Comment[];
  userId: string;
  userNickname: string;
  userAvatarSeed: string;
  createdAt: number;
}
```

### Comment

```typescript
interface Comment {
  id: string;
  postId?: string;
  userId: string;
  userNickname: string;
  userAvatarSeed: string;
  content: string;
  likesCount: number;
  collectionsCount: number;
  isLiked: boolean;
  isCollected: boolean;
  rootCommentId: string | null;
  replyToCommentId: string | null;
  replyToUserNickname: string | null;
  replies: Comment[];
  createdAt: number;
}
```

### Notification

```typescript
interface Notification {
  id: string;
  type: 'like' | 'collect' | 'comment' | 'comment_like' | 'comment_collect' | 'comment_reply';
  postId: string;
  commentId?: string | null;
  commentContent?: string;
  targetCommentContent?: string;
  postContent?: string;
  tags?: string[];
  actor: {
    id: string;
    nickname: string;
    avatarSeed: string;
  };
  createdAt: number;
  read: boolean;
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  otherUser: User;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: number;
}
```

## 项目结构

```text
src/
├── components/
│   ├── Comment.tsx
│   ├── PostCard.tsx
│   ├── TabBar.tsx
│   └── TagEditor.tsx
├── context/
│   └── AppContext.tsx
├── pages/
│   ├── AuthPage.tsx
│   ├── ChatPage.tsx
│   ├── MessagesPage.tsx
│   ├── PostDetailPage.tsx
│   ├── ProfilePage.tsx
│   ├── SquarePage.tsx
│   └── UserProfilePage.tsx
├── services/
│   └── api.ts
├── utils/
│   ├── avatar.ts
│   └── helpers.ts
├── App.tsx
├── main.tsx
├── index.css
└── types.ts
```

## 部署状态

| 项目 | 状态 |
|------|------|
| 前端页面 | 已上线 |
| Vite 构建 | 本地验证通过 |
| 访问域名 | `https://twowor1ds.online` |
| API 接入方式 | 同源 `/api` |
| 后端联调状态 | 已完成重新部署并复测 `/health`、`/api/posts` |

## 本次文档同步

### 已完成

- 已同步注册页最新交互：验证码输入框在发送成功后显示。
- 已同步 API 调用策略：前端通过同源 `/api` 请求后端。
- 已同步当前部署情况：前后端都已重新部署到正式域名。
- 已同步前端构建状态：`npm run build` 本地通过。
- 已同步后端验证码方案：服务端已改为 PostgreSQL 持久化验证码。
- 已同步游客登录策略：游客可从登录页手动进入，且刷新后仍可保持游客聊天身份。
- 已同步收藏展示策略：广场页移除收藏列表入口，收藏内容统一在“我”页查看。
- 已同步收藏状态修复：登录后会主动回填收藏列表，帖子卡片收藏态与个人页收藏数保持一致。
- 已同步帖子卡片样式更新：点赞、收藏、评论按钮已改为小红书风格图标胶囊按钮。
- 已同步消息提醒修复：底部消息标签改为基于全局通知列表和会话列表聚合刷新徽章。
- 已同步帖子详情页方案：列表卡片改为摘要展示，点击后进入全屏详情页查看完整正文与全部评论。
- 已同步评论互动扩展：详情页内评论支持点赞、收藏与底部输入栏发送评论。
- 已同步评论楼层模型：评论支持一级楼中楼回复，回复评论仍归属原楼层。
- 已同步个人中心扩展：新增“我的评论”，且“我的收藏”同时展示收藏帖子与收藏评论。
- 已同步帖子作者能力：自己的帖子可在详情页重新编辑或删除，自己的评论可删除。
- 已同步消息页改版：互动提醒收敛为单独盒子，聊天会话列表与提醒拆分显示。
- 已同步通知范围扩展：帖子收藏、评论点赞、评论收藏、评论回复也会进入消息页。
- 已同步头像操作：点击非本人头像可查看主页或直接发起聊天。
- 已同步私聊能力：新增会话列表、聊天详情页和他人主页跳转链路。
- 已同步真实头像能力：个人中心支持上传头像，帖子、评论、消息、聊天页统一展示上传后的头像。
- 已同步会话管理：支持在消息列表或聊天详情页删除聊天框。
- 已同步未读刷新修复：底部“消息”标签未读数改为全局轮询与页面激活时刷新，不必先进入消息页。

### 后续关注

- 建议继续人工验证注册、登录、发送验证码完整链路。
- 若后端改为独立域名，需要再补充 `API_BASE_URL` 环境化方案。
