export interface User {
  id: string;
  nickname: string;
  avatarSeed: string;
  email?: string;
}

export interface Tag {
  id: string;
  name: string;
  isPreset: boolean;
}

export interface Post {
  id: string;
  userId: string;
  userNickname: string;
  userAvatarSeed: string;
  content: string;
  tags: string[];
  likes: number;
  collectionsCount: number;
  commentsCount: number;
  likedBy: string[];
  collectedBy: string[];
  comments: Comment[];
  createdAt: number;
}

export interface Comment {
  id: string;
  postId?: string;
  postContent?: string;
  postCreatedAt?: number;
  postUserId?: string;
  postUserNickname?: string;
  postUserAvatarSeed?: string;
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

export interface Notification {
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

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  otherUser: User;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  updatedAt: number;
}

export interface UserProfile {
  user: User;
  posts: Post[];
}

export interface AppContextType {
  currentUser: User | null;
  tags: Tag[];
  posts: Post[];
  collectionPosts: Post[];
  myComments: Comment[];
  collectedComments: Comment[];
  likedPosts: string[];
  collectedPosts: string[];
  notifications: Notification[];
  conversations: Conversation[];
  unreadCount: number;
  addTag: (name: string) => void;
  removeTag: (id: string) => void;
  createPost: (content: string, tagIds: string[]) => Promise<void>;
  editPost: (postId: string, content: string, tagIds: string[]) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
  collectPost: (postId: string) => Promise<void>;
  addComment: (postId: string, content: string, parentCommentId?: string) => Promise<void>;
  deleteComment: (postId: string, commentId: string) => Promise<void>;
  likeComment: (postId: string, commentId: string) => Promise<void>;
  collectComment: (postId: string, commentId: string) => Promise<void>;
  loadPostDetail: (postId: string) => Promise<Post | null>;
  updateTags: (tags: Tag[]) => void;
  logout: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, code: string, password: string, nickname: string) => Promise<void>;
  quickStart: () => Promise<void>;
  sendCode: (email: string) => Promise<void>;
  updateProfile: (nickname: string, avatarSeed?: string) => Promise<User>;
  loadCollections: () => Promise<void>;
  loadMyComments: () => Promise<void>;
  loadNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  loadConversations: () => Promise<void>;
  openConversationWithUser: (targetUserId: string) => Promise<Conversation>;
  loadConversationMessages: (conversationId: string) => Promise<ChatMessage[]>;
  sendChatMessage: (conversationId: string, content: string) => Promise<ChatMessage>;
  markConversationRead: (conversationId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  getUserProfile: (userId: string) => Promise<UserProfile>;
  isAuthenticated: boolean;
  loading: boolean;
  hasMorePosts: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  refreshPosts: () => Promise<void>;
  loadMorePosts: () => Promise<void>;
}
