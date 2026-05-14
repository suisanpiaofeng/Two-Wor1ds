const API_BASE_URL = '';

export interface User {
  id: string;
  email?: string;
  nickname: string;
  avatarSeed: string;
}

export interface Post {
  id: string;
  content: string;
  tags: string[];
  likes: number;
  likedBy: string[];
  collectedBy: string[];
  comments: Comment[];
  userId: string;
  userNickname: string;
  userAvatarSeed: string;
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
  async register(email: string, password: string, nickname?: string): Promise<{ user: User; token: string }> {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, nickname })
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
    const posts = data.posts.map((p: any) => ({
      id: p.id,
      content: p.content,
      tags: p.tags || [],
      likes: p.likes_count || 0,
      likedBy: [],
      collectedBy: [],
      comments: (p.comments || []).map((c: any) => ({
        id: c.id,
        content: c.content,
        userId: c.user_id,
        userNickname: c.nickname,
        userAvatarSeed: c.avatar_seed,
        createdAt: c.created_at
      })),
      userId: p.user_id,
      userNickname: p.nickname,
      userAvatarSeed: p.avatar_seed,
      createdAt: p.created_at
    }));
    return { posts, hasMore: posts.length === limit };
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
    await fetch(`${API_BASE_URL}/api/posts/${postId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
  },

  async like(postId: string): Promise<{ liked: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  async comment(postId: string, content: string): Promise<Comment> {
    const response = await fetch(`${API_BASE_URL}/api/posts/${postId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify({ content })
    });
    const data = await handleResponse<any>(response);
    return data.comment;
  }
};

export const usersService = {
  async updateActivity(): Promise<void> {
    await fetch(`${API_BASE_URL}/api/users/activity`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
  }
};
