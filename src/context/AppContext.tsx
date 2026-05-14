import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { AppContextType, Tag, Post, User } from '../types';
import {
  authService,
  postsService,
  usersService
} from '../services/api';

const PRESET_TAGS: Tag[] = [
  { id: 'preset-1', name: '生活', isPreset: true },
  { id: 'preset-2', name: '读书', isPreset: true },
  { id: 'preset-3', name: '职场', isPreset: true },
  { id: 'preset-4', name: '情感', isPreset: true },
  { id: 'preset-5', name: '思考', isPreset: true },
  { id: 'preset-6', name: '旅行', isPreset: true },
  { id: 'preset-7', name: '美食', isPreset: true },
  { id: 'preset-8', name: '音乐', isPreset: true },
  { id: 'preset-9', name: '电影', isPreset: true },
  { id: 'preset-10', name: '科技', isPreset: true },
  { id: 'preset-11', name: '艺术', isPreset: true },
  { id: 'preset-12', name: '运动', isPreset: true },
  { id: 'preset-13', name: '摄影', isPreset: true },
  { id: 'preset-14', name: '游戏', isPreset: true },
  { id: 'preset-15', name: '时尚', isPreset: true },
];

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>(PRESET_TAGS);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [collectedPosts, setCollectedPosts] = useState<string[]>([]);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const postsOffsetRef = useRef(0);

  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadPosts();
      const activityInterval = setInterval(() => {
        usersService.updateActivity();
      }, 120000);
      return () => {
        clearInterval(activityInterval);
      };
    }
  }, [isAuthenticated]);

  const initApp = async () => {
    try {
      const token = authService.getToken();
      if (token) {
        try {
          const result = await authService.verify();
          if (result.valid && result.user) {
            setCurrentUser(result.user);
            setIsAuthenticated(true);
            return;
          }
        } catch {}
      }
      
      const result = await authService.quickStart();
      setCurrentUser(result.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth init failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    setCurrentUser(result.user);
    setIsAuthenticated(true);
  };

  const logout = async () => {
    await authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setPosts([]);
  };

  const loadPosts = async () => {
    try {
      const result = await postsService.getAll(undefined, 'latest', 0, 20);
      setPosts(result.posts);
      postsOffsetRef.current = result.posts.length;
      setHasMorePosts(result.hasMore);
    } catch (error) {
      console.error('Failed to load posts:', error);
    }
  };

  const refreshPosts = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const result = await postsService.getAll(undefined, 'latest', 0, 20);
      setPosts(result.posts);
      postsOffsetRef.current = result.posts.length;
      setHasMorePosts(result.hasMore);
    } catch (error) {
      console.error('Failed to refresh posts:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadMorePosts = async () => {
    if (isLoadingMore || !hasMorePosts) return;
    setIsLoadingMore(true);
    try {
      const result = await postsService.getAll(undefined, 'latest', postsOffsetRef.current, 20);
      setPosts(prev => [...prev, ...result.posts]);
      postsOffsetRef.current += result.posts.length;
      setHasMorePosts(result.hasMore);
    } catch (error) {
      console.error('Failed to load more posts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const addTag = useCallback((name: string) => {
    const newTag: Tag = {
      id: `tag-${Date.now()}`,
      name,
      isPreset: false,
    };
    setTags(prev => [...prev, newTag]);
  }, []);

  const removeTag = useCallback((id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
  }, []);

  const updateTags = useCallback((updatedTags: Tag[]) => {
    setTags(updatedTags);
  }, []);

  const createPost = useCallback(async (content: string, tagIds: string[]) => {
    const tagNames = tags
      .filter(t => tagIds.includes(t.id))
      .map(t => t.name);

    try {
      const newPost = await postsService.create(content, tagNames);
      const post: Post = {
        id: newPost.id,
        content: newPost.content,
        tags: newPost.tags || tagNames,
        likes: 0,
        likedBy: [],
        collectedBy: [],
        comments: [],
        userId: currentUser?.id || '',
        userNickname: currentUser?.nickname || '',
        userAvatarSeed: currentUser?.avatarSeed || '',
        createdAt: newPost.createdAt || Date.now()
      };
      setPosts(prev => [post, ...prev]);
      postsOffsetRef.current += 1;
    } catch (error) {
      console.error('Failed to create post:', error);
      refreshPosts();
    }
  }, [tags, currentUser]);

  const deletePost = useCallback(async (postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
    setLikedPosts(prev => prev.filter(id => id !== postId));
    setCollectedPosts(prev => prev.filter(id => id !== postId));
    postsOffsetRef.current = Math.max(0, postsOffsetRef.current - 1);
    try {
      await postsService.delete(postId);
    } catch (error) {
      console.error('Failed to delete post:', error);
      refreshPosts();
    }
  }, []);

  const likePost = useCallback(async (postId: string) => {
    const isLiked = likedPosts.includes(postId);
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      return {
        ...post,
        likes: isLiked ? post.likes - 1 : post.likes + 1,
        likedBy: isLiked
          ? post.likedBy.filter(id => id !== currentUser?.id)
          : [...post.likedBy, currentUser?.id || '']
      };
    }));
    setLikedPosts(prev => isLiked ? prev.filter(id => id !== postId) : [...prev, postId]);

    try {
      await postsService.like(postId);
    } catch (error) {
      console.error('Failed to like post:', error);
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          likes: isLiked ? post.likes + 1 : post.likes - 1,
          likedBy: isLiked
            ? [...post.likedBy, currentUser?.id || '']
            : post.likedBy.filter(id => id !== currentUser?.id)
        };
      }));
      setLikedPosts(prev => isLiked ? [...prev, postId] : prev.filter(id => id !== postId));
    }
  }, [currentUser, likedPosts]);

  const collectPost = useCallback((postId: string) => {
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      const isCollected = collectedPosts.includes(postId);
      return {
        ...post,
        collectedBy: isCollected
          ? post.collectedBy.filter(id => id !== currentUser?.id)
          : [...post.collectedBy, currentUser?.id || '']
      };
    }));

    setCollectedPosts(prev => {
      const isCollected = prev.includes(postId);
      return isCollected
        ? prev.filter(id => id !== postId)
        : [...prev, postId];
    });
  }, [currentUser, collectedPosts]);

  const addComment = useCallback(async (postId: string, content: string) => {
    const tempComment = {
      id: `temp-${Date.now()}`,
      userId: currentUser?.id || '',
      userNickname: currentUser?.nickname || '',
      userAvatarSeed: currentUser?.avatarSeed || '',
      content,
      createdAt: Date.now()
    };

    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      return {
        ...post,
        comments: [...post.comments, tempComment]
      };
    }));

    try {
      await postsService.comment(postId, content);
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  }, [currentUser]);

  const contextValue: AppContextType = {
    currentUser,
    tags,
    posts,
    likedPosts,
    collectedPosts,
    addTag,
    removeTag,
    createPost,
    deletePost,
    likePost,
    collectPost,
    addComment,
    updateTags,
    login,
    logout,
    isAuthenticated,
    loading,
    hasMorePosts,
    isLoadingMore,
    isRefreshing,
    refreshPosts,
    loadMorePosts,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
