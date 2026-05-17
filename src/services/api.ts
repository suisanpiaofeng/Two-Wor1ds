import type {
  ChatMessage,
  Comment,
  Conversation,
  Notification,
  Post,
  User,
  UserProfile
} from '../types';

const API_BASE_URL = '';

function mapComment(comment: any): Comment {
  return {
    id: comment.id,
    postId: comment.post_id,
    postContent: comment.post_content,
    postCreatedAt: comment.post_created_at,
    postUserId: comment.post_user_id,
    postUserNickname: comment.post_user_nickname,
    postUserAvatarSeed: comment.post_user_avatar_seed,
    content: comment.content,
    userId: comment.user_id,
    userNickname: comment.nickname,
    userAvatarSeed: comment.avatar_seed,
    likesCount: comment.likes_count || 0,
    collectionsCount: comment.collections_count || 0,
    isLiked: Boolean(comment.current_user_liked),
    isCollected: Boolean(comment.current_user_collected),
    rootCommentId: comment.root_comment_id || null,
    replyToCommentId: comment.reply_to_comment_id || null,
    replyToUserNickname: comment.reply_to_nickname || null,
    replies: Array.isArray(comment.replies) ? comment.replies.map(mapComment) : [],
    createdAt: comment.created_at
  };
}

function mapPost(post: any): Post {
  return {
    id: post.id,
    content: post.content,
    tags: post.tags || [],
    likes: post.likes_count || 0,
    collectionsCount: post.collections_count || 0,
    commentsCount: post.comments_count || 0,
    likedBy: post.current_user_liked ? ['current-user'] : [],
    collectedBy: post.current_user_collected ? ['current-user'] : [],
    comments: (post.comments || []).map(mapComment),
    userId: post.user_id,
    userNickname: post.nickname,
    userAvatarSeed: post.avatar_seed,
    createdAt: post.created_at
  };
}

function mapChatMessage(message: any): ChatMessage {
  return {
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    content: message.content,
    createdAt: message.created_at
  };
}

function mapConversation(conversation: any): Conversation {
  return {
    id: conversation.id,
    otherUser: {
      id: conversation.other_user.id,
      nickname: conversation.other_user.nickname,
      avatarSeed: conversation.other_user.avatarSeed
    },
    lastMessage: conversation.last_message ? mapChatMessage(conversation.last_message) : null,
    unreadCount: conversation.unread_count || 0,
    updatedAt: conversation.updated_at
  };
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  return response.json();
}

export const authService = {
  async verify(): Promise<{ valid: boolean; user?: User }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async logout(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    localStorage.removeItem('auth_token');
  },

  async quickStart(): Promise<{ user: User; token: string }> {
    const oldToken = localStorage.getItem('auth_token');
    
    const response = await fetch(`${API_BASE_URL}/api/auth/quickstart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: oldToken || '' })
    });
    const data = await handleResponse<any>(response);
    localStorage.setItem('auth_token', data.token);
    return { user: data.user, token: data.token };
  },

  async sendCode(email: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    await handleResponse(response);
  },

  async register(email: string, code: string, password: string, nickname: string): Promise<{ user: User; token: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code, password, nickname })
    });
    const data = await handleResponse<any>(response);
    localStorage.setItem('auth_token', data.token);
    return { user: data.user, token: data.token };
  },

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await handleResponse<any>(response);
    localStorage.setItem('auth_token', data.token);
    return { user: data.user, token: data.token };
  },

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
};

export const postsService = {
  async getAll(tag?: string, sort: 'latest' | 'popular' = 'latest', offset = 0, limit = 20): Promise<{ posts: Post[]; hasMore: boolean }> {
    const params = new URLSearchParams();
    if (tag) params.append('tag', tag);
    params.append('sort', sort);
    params.append('offset', String(offset));
    params.append('limit', String(limit));

    const response = await fetch(`${API_BASE_URL}/api/posts?${params}`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse<any>(response);
    const posts = data.posts.map(mapPost);
    return { posts, hasMore: posts.length === limit };
  },

  async getById(postId: string): Promise<Post> {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse<any>(response);
    return mapPost(data.post);
  },

  async create(content: string, tags: string[] = []): Promise<Post> {
    const response = await fetch(`${API_BASE_URL}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ content, tags })
    });
    const data = await handleResponse<any>(response);
    return data.post;
  },

  async delete(postId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    await handleResponse(response);
  },

  async update(postId: string, content: string, tags: string[] = []): Promise<Post> {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ content, tags })
    });
    const data = await handleResponse<any>(response);
    return mapPost(data.post);
  },

  async like(postId: string): Promise<{ liked: boolean; likes_count: number }> {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async collect(postId: string): Promise<{ collected: boolean; collections_count: number }> {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/collect`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async comment(postId: string, content: string, parentCommentId?: string): Promise<Comment> {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ content, parentCommentId })
    });
    const data = await handleResponse<any>(response);
    return mapComment(data.comment);
  },

  async deleteComment(commentId: string): Promise<{ post_id: string; deleted_count: number; deleted_ids: string[] }> {
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async likeComment(commentId: string): Promise<{ liked: boolean; likes_count: number }> {
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}/like`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async collectComment(commentId: string): Promise<{ collected: boolean; collections_count: number }> {
    const response = await fetch(`${API_BASE_URL}/api/comments/${commentId}/collect`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

export const usersService = {
  async updateActivity(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/users/activity`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
  },

  async updateProfile(nickname: string, avatarSeed?: string): Promise<User> {
    const body: Record<string, string> = { nickname };
    if (avatarSeed) body.avatar_seed = avatarSeed;
    
    const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body)
    });
    const data = await handleResponse<any>(response);
    return data.user;
  },

  async getCollections(): Promise<{ posts: Post[]; comments: Comment[] }> {
    const response = await fetch(`${API_BASE_URL}/api/users/collections`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse<any>(response);
    return {
      posts: data.posts.map(mapPost),
      comments: Array.isArray(data.comments) ? data.comments.map(mapComment) : []
    };
  },

  async getMyComments(): Promise<Comment[]> {
    const response = await fetch(`${API_BASE_URL}/api/users/comments`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse<any>(response);
    return Array.isArray(data.comments) ? data.comments.map(mapComment) : [];
  },

  async getProfile(userId: string): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/api/users/${userId}/profile`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse<any>(response);
    return {
      user: data.user,
      posts: Array.isArray(data.posts) ? data.posts.map(mapPost) : []
    };
  }
};

export const notificationsService = {
  async getNotifications(): Promise<Notification[]> {
    const response = await fetch(`${API_BASE_URL}/api/notifications`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse<any>(response);
    return data.notifications.map((n: any) => ({
      id: n.id,
      type: n.type,
      postId: n.post_id,
      commentId: n.comment_id,
      commentContent: n.comment_content,
      targetCommentContent: n.target_comment_content,
      postContent: n.post_content,
      tags: n.tags,
      actor: {
        id: n.actor?.id || n.actor_id || '',
        nickname: n.actor?.nickname || n.actor_nickname || '有人',
        avatarSeed: n.actor?.avatarSeed || n.actor_avatar_seed || 'unknown'
      },
      createdAt: n.created_at,
      read: n.read
    }));
  },

  async markRead(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/notifications/mark-read`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
  },

  async getUnreadCount(): Promise<{ count: number }> {
    const response = await fetch(`${API_BASE_URL}/api/notifications/unread-count`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  }
};

export const conversationsService = {
  async getAll(): Promise<Conversation[]> {
    const response = await fetch(`${API_BASE_URL}/api/conversations`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse<any>(response);
    return Array.isArray(data.conversations) ? data.conversations.map(mapConversation) : [];
  },

  async openDirect(targetUserId: string): Promise<Conversation> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ target_user_id: targetUserId })
    });
    const data = await handleResponse<any>(response);
    return mapConversation(data.conversation);
  },

  async getMessages(conversationId: string): Promise<ChatMessage[]> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
      headers: getAuthHeaders()
    });
    const data = await handleResponse<any>(response);
    return Array.isArray(data.messages) ? data.messages.map(mapChatMessage) : [];
  },

  async sendMessage(conversationId: string, content: string): Promise<ChatMessage> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ content })
    });
    const data = await handleResponse<any>(response);
    return mapChatMessage(data.message);
  },

  async markRead(conversationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}/read`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    await handleResponse(response);
  },

  async deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    await handleResponse(response);
  }
};
