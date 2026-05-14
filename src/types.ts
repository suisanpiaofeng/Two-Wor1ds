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
  likedBy: string[];
  collectedBy: string[];
  comments: Comment[];
  createdAt: number;
}

export interface Comment {
  id: string;
  userId: string;
  userNickname: string;
  userAvatarSeed: string;
  content: string;
  createdAt: number;
}

export interface AppContextType {
  currentUser: User | null;
  tags: Tag[];
  posts: Post[];
  likedPosts: string[];
  collectedPosts: string[];
  addTag: (name: string) => void;
  removeTag: (id: string) => void;
  createPost: (content: string, tagIds: string[]) => void;
  deletePost: (postId: string) => void;
  likePost: (postId: string) => void;
  collectPost: (postId: string) => void;
  addComment: (postId: string, content: string) => void;
  updateTags: (tags: Tag[]) => void;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  hasMorePosts: boolean;
  isLoadingMore: boolean;
  isRefreshing: boolean;
  refreshPosts: () => void;
  loadMorePosts: () => void;
}
