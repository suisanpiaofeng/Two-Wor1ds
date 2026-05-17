import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type {
  AppContextType,
  Tag,
  Post,
  User,
  Notification,
  Comment as CommentType,
  Conversation
} from '../types';
import {
  authService,
  postsService,
  usersService,
  notificationsService,
  conversationsService
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

function mergePostsById(existingPosts: Post[], incomingPosts: Post[]) {
  const postsMap = new Map(existingPosts.map(post => [post.id, post]));
  for (const post of incomingPosts) {
    postsMap.set(post.id, post);
  }
  return Array.from(postsMap.values());
}

function sortConversations(items: Conversation[]) {
  return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
}

function upsertConversationItem(items: Conversation[], conversation: Conversation) {
  const index = items.findIndex(item => item.id === conversation.id);
  if (index === -1) {
    return sortConversations([conversation, ...items]);
  }

  const next = [...items];
  next[index] = conversation;
  return sortConversations(next);
}

function findCommentById(comments: CommentType[], commentId: string): CommentType | null {
  for (const comment of comments) {
    if (comment.id === commentId) {
      return comment;
    }
    const nested = findCommentById(comment.replies, commentId);
    if (nested) {
      return nested;
    }
  }
  return null;
}

function insertCommentIntoTree(comments: CommentType[], newComment: CommentType): CommentType[] {
  if (!newComment.rootCommentId) {
    return [...comments, newComment];
  }

  let inserted = false;
  const nextComments = comments.map(comment => {
    if (comment.id !== newComment.rootCommentId) {
      return comment;
    }

    inserted = true;
    return {
      ...comment,
      replies: [...comment.replies, newComment]
    };
  });

  return inserted ? nextComments : [...comments, newComment];
}

function replaceCommentInTree(comments: CommentType[], targetId: string, replacement: CommentType): CommentType[] {
  return comments.map(comment => {
    if (comment.id === targetId) {
      return replacement;
    }

    if (comment.replies.length === 0) {
      return comment;
    }

    return {
      ...comment,
      replies: replaceCommentInTree(comment.replies, targetId, replacement)
    };
  });
}

function updateCommentInTree(
  comments: CommentType[],
  targetId: string,
  updater: (comment: CommentType) => CommentType
): CommentType[] {
  return comments.map(comment => {
    if (comment.id === targetId) {
      return updater(comment);
    }

    if (comment.replies.length === 0) {
      return comment;
    }

    return {
      ...comment,
      replies: updateCommentInTree(comment.replies, targetId, updater)
    };
  });
}

function removeCommentsFromTree(comments: CommentType[], idsToRemove: Set<string>): CommentType[] {
  return comments
    .filter(comment => !idsToRemove.has(comment.id))
    .map(comment => ({
      ...comment,
      replies: removeCommentsFromTree(comment.replies, idsToRemove)
    }));
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<Tag[]>(PRESET_TAGS);
  const [posts, setPosts] = useState<Post[]>([]);
  const [collectionPosts, setCollectionPosts] = useState<Post[]>([]);
  const [myComments, setMyComments] = useState<CommentType[]>([]);
  const [collectedComments, setCollectedComments] = useState<CommentType[]>([]);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [collectedPosts, setCollectedPosts] = useState<string[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const postsOffsetRef = useRef(0);
  const unreadCount = notifications.filter(item => !item.read).length
    + conversations.reduce((total, item) => total + item.unreadCount, 0);

  const upsertPost = useCallback((post: Post) => {
    setPosts(prev => {
      const index = prev.findIndex(item => item.id === post.id);
      if (index === -1) {
        return [post, ...prev];
      }

      const next = [...prev];
      next[index] = post;
      return next;
    });
  }, []);

  useEffect(() => {
    initApp();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadPosts();
      loadCollections();
      loadMyComments();
      loadNotifications();
      loadConversations();
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
        } catch {
          localStorage.removeItem('auth_token');
        }
      }
    } catch (error) {
      console.error('Auth init failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const quickStart = useCallback(async () => {
    const result = await authService.quickStart();
    setCurrentUser(result.user);
    setIsAuthenticated(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    setCurrentUser(result.user);
    setIsAuthenticated(true);
  }, []);

  const register = useCallback(async (email: string, code: string, password: string, nickname: string) => {
    const result = await authService.register(email, code, password, nickname);
    setCurrentUser(result.user);
    setIsAuthenticated(true);
  }, []);

  const sendCode = useCallback(async (email: string) => {
    await authService.sendCode(email);
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setPosts([]);
    setCollectionPosts([]);
    setMyComments([]);
    setCollectedComments([]);
    setNotifications([]);
    setConversations([]);
    setCollectedPosts([]);
    setLikedPosts([]);
  }, []);

  const updateProfile = useCallback(async (nickname: string, avatarSeed?: string) => {
    const updatedUser = await usersService.updateProfile(nickname, avatarSeed);
    setCurrentUser(updatedUser);
    return updatedUser;
  }, []);

  const loadPosts = async () => {
    try {
      const result = await postsService.getAll(undefined, 'latest', 0, 20);
      setPosts(result.posts);
      setLikedPosts(result.posts.filter(post => post.likedBy.length > 0).map(post => post.id));
      setCollectedPosts(prev => Array.from(new Set([
        ...prev,
        ...result.posts.filter(post => post.collectedBy.length > 0).map(post => post.id)
      ])));
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
      setLikedPosts(result.posts.filter(post => post.likedBy.length > 0).map(post => post.id));
      setCollectedPosts(prev => Array.from(new Set([
        ...prev,
        ...result.posts.filter(post => post.collectedBy.length > 0).map(post => post.id)
      ])));
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
      setPosts(prev => mergePostsById(prev, result.posts));
      setLikedPosts(prev => Array.from(new Set([
        ...prev,
        ...result.posts.filter(post => post.likedBy.length > 0).map(post => post.id)
      ])));
      setCollectedPosts(prev => Array.from(new Set([
        ...prev,
        ...result.posts.filter(post => post.collectedBy.length > 0).map(post => post.id)
      ])));
      postsOffsetRef.current += result.posts.length;
      setHasMorePosts(result.hasMore);
    } catch (error) {
      console.error('Failed to load more posts:', error);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadPostDetail = useCallback(async (postId: string) => {
    try {
      const post = await postsService.getById(postId);
      upsertPost(post);
      return post;
    } catch (error) {
      console.error('Failed to load post detail:', error);
      return null;
    }
  }, [upsertPost]);

  const loadCollections = useCallback(async () => {
    try {
      const collections = await usersService.getCollections();
      setCollectionPosts(collections.posts);
      setCollectedPosts(collections.posts.map(post => post.id));
      setCollectedComments(collections.comments);
    } catch (error) {
      console.error('Failed to load collections:', error);
    }
  }, []);

  const loadMyComments = useCallback(async () => {
    try {
      const comments = await usersService.getMyComments();
      setMyComments(comments);
    } catch (error) {
      console.error('Failed to load my comments:', error);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const notifs = await notificationsService.getNotifications();
      setNotifications(notifs);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    }
  }, []);

  const markNotificationsRead = useCallback(async () => {
    await notificationsService.markRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const loadConversations = useCallback(async () => {
    try {
      const items = await conversationsService.getAll();
      setConversations(sortConversations(items));
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  }, []);

  const openConversationWithUser = useCallback(async (targetUserId: string) => {
    const conversation = await conversationsService.openDirect(targetUserId);
    setConversations(prev => upsertConversationItem(prev, conversation));
    return conversation;
  }, []);

  const loadConversationMessages = useCallback(async (conversationId: string) => {
    const messages = await conversationsService.getMessages(conversationId);
    return messages;
  }, []);

  const sendChatMessage = useCallback(async (conversationId: string, content: string) => {
    const message = await conversationsService.sendMessage(conversationId, content);
    setConversations(prev => {
      const current = prev.find(item => item.id === conversationId);
      if (!current) {
        return prev;
      }

      return upsertConversationItem(prev, {
        ...current,
        lastMessage: message,
        unreadCount: 0,
        updatedAt: message.createdAt
      });
    });
    return message;
  }, []);

  const markConversationRead = useCallback(async (conversationId: string) => {
    await conversationsService.markRead(conversationId);
    setConversations(prev => prev.map(item => (
      item.id === conversationId
        ? { ...item, unreadCount: 0 }
        : item
    )));
  }, []);

  const deleteConversation = useCallback(async (conversationId: string) => {
    await conversationsService.deleteConversation(conversationId);
    setConversations(prev => prev.filter(item => item.id !== conversationId));
  }, []);

  const getUserProfile = useCallback(async (userId: string) => {
    return usersService.getProfile(userId);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    const syncUnreadState = () => {
      void loadNotifications();
      void loadConversations();
    };

    const intervalId = window.setInterval(syncUnreadState, 10000);
    const handleFocus = () => {
      syncUnreadState();
    };
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        syncUnreadState();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isAuthenticated, loadNotifications, loadConversations]);

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
        collectionsCount: 0,
        commentsCount: 0,
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

  const editPost = useCallback(async (postId: string, content: string, tagIds: string[]) => {
    const tagNames = tags
      .filter(tag => tagIds.includes(tag.id))
      .map(tag => tag.name);

    try {
      const updatedPost = await postsService.update(postId, content, tagNames);
      upsertPost(updatedPost);
    } catch (error) {
      console.error('Failed to update post:', error);
      throw error;
    }
  }, [tags, upsertPost]);

  const deletePost = useCallback(async (postId: string) => {
    setPosts(prev => prev.filter(post => post.id !== postId));
    setLikedPosts(prev => prev.filter(id => id !== postId));
    setCollectedPosts(prev => prev.filter(id => id !== postId));
    postsOffsetRef.current = Math.max(0, postsOffsetRef.current - 1);
    try {
      await postsService.delete(postId);
      await Promise.all([loadCollections(), loadMyComments()]);
    } catch (error) {
      console.error('Failed to delete post:', error);
      refreshPosts();
    }
  }, [loadCollections, loadMyComments]);

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
      const result = await postsService.like(postId);
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          likes: result.likes_count,
          likedBy: result.liked
            ? [...post.likedBy.filter(id => id !== currentUser?.id), currentUser?.id || '']
            : post.likedBy.filter(id => id !== currentUser?.id)
        };
      }));
      setLikedPosts(prev => result.liked
        ? Array.from(new Set([...prev, postId]))
        : prev.filter(id => id !== postId)
      );
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

  const collectPost = useCallback(async (postId: string) => {
    const isCollected = collectedPosts.includes(postId);
    
    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      return {
        ...post,
        collectionsCount: isCollected ? Math.max(post.collectionsCount - 1, 0) : post.collectionsCount + 1,
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

    try {
      const result = await postsService.collect(postId);
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          collectionsCount: result.collections_count,
          collectedBy: result.collected
            ? [...post.collectedBy.filter(id => id !== currentUser?.id), currentUser?.id || '']
            : post.collectedBy.filter(id => id !== currentUser?.id)
        };
      }));
      setCollectedPosts(prev => result.collected
        ? Array.from(new Set([...prev, postId]))
        : prev.filter(id => id !== postId)
      );
    } catch (error) {
      console.error('Failed to collect post:', error);
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          collectionsCount: isCollected ? post.collectionsCount + 1 : Math.max(post.collectionsCount - 1, 0),
          collectedBy: isCollected
            ? [...post.collectedBy, currentUser?.id || '']
            : post.collectedBy.filter(id => id !== currentUser?.id)
        };
      }));
      setCollectedPosts(prev => isCollected ? [...prev, postId] : prev.filter(id => id !== postId));
    }
  }, [currentUser, collectedPosts]);

  const addComment = useCallback(async (postId: string, content: string, parentCommentId?: string) => {
    const post = posts.find(item => item.id === postId);
    const parentComment = parentCommentId && post
      ? findCommentById(post.comments, parentCommentId)
      : null;

    const tempComment: CommentType = {
      id: `temp-${Date.now()}`,
      postId,
      userId: currentUser?.id || '',
      userNickname: currentUser?.nickname || '',
      userAvatarSeed: currentUser?.avatarSeed || '',
      content,
      likesCount: 0,
      collectionsCount: 0,
      isLiked: false,
      isCollected: false,
      rootCommentId: parentComment ? (parentComment.rootCommentId || parentComment.id) : null,
      replyToCommentId: parentComment?.id || null,
      replyToUserNickname: parentComment?.userNickname || null,
      replies: [],
      createdAt: Date.now()
    };

    setPosts(prev => prev.map(item => {
      if (item.id !== postId) return item;
      return {
        ...item,
        commentsCount: item.commentsCount + 1,
        comments: insertCommentIntoTree(item.comments, tempComment)
      };
    }));

    try {
      const comment = await postsService.comment(postId, content, parentCommentId);
      setPosts(prev => prev.map(item => {
        if (item.id !== postId) return item;
        return {
          ...item,
          comments: replaceCommentInTree(item.comments, tempComment.id, comment)
        };
      }));
      await loadMyComments();
    } catch (error) {
      console.error('Failed to add comment:', error);
      setPosts(prev => prev.map(item => {
        if (item.id !== postId) return item;
        return {
          ...item,
          commentsCount: Math.max(item.commentsCount - 1, 0),
          comments: removeCommentsFromTree(item.comments, new Set([tempComment.id]))
        };
      }));
      throw error;
    }
  }, [currentUser, posts, loadMyComments]);

  const deleteComment = useCallback(async (postId: string, commentId: string) => {
    try {
      const result = await postsService.deleteComment(commentId);
      const deletedIds = new Set(result.deleted_ids);

      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          commentsCount: Math.max(post.commentsCount - result.deleted_count, 0),
          comments: removeCommentsFromTree(post.comments, deletedIds)
        };
      }));

      setMyComments(prev => prev.filter(comment => !deletedIds.has(comment.id)));
      setCollectedComments(prev => prev.filter(comment => !deletedIds.has(comment.id)));
      await Promise.all([loadCollections(), loadMyComments()]);
    } catch (error) {
      console.error('Failed to delete comment:', error);
      throw error;
    }
  }, [loadCollections, loadMyComments]);

  const likeComment = useCallback(async (postId: string, commentId: string) => {
    let previousLiked = false;

    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      return {
        ...post,
        comments: updateCommentInTree(post.comments, commentId, comment => {
          previousLiked = comment.isLiked;
          return {
            ...comment,
            isLiked: !comment.isLiked,
            likesCount: comment.isLiked ? Math.max(comment.likesCount - 1, 0) : comment.likesCount + 1
          };
        })
      };
    }));

    try {
      const result = await postsService.likeComment(commentId);
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: updateCommentInTree(post.comments, commentId, comment => ({
            ...comment,
            isLiked: result.liked,
            likesCount: result.likes_count
          }))
        };
      }));
      setMyComments(prev => updateCommentInTree(prev, commentId, comment => ({
        ...comment,
        isLiked: result.liked,
        likesCount: result.likes_count
      })));
      setCollectedComments(prev => updateCommentInTree(prev, commentId, comment => ({
        ...comment,
        isLiked: result.liked,
        likesCount: result.likes_count
      })));
    } catch (error) {
      console.error('Failed to like comment:', error);
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: updateCommentInTree(post.comments, commentId, comment => {
            return {
              ...comment,
              isLiked: previousLiked,
              likesCount: previousLiked ? comment.likesCount + 1 : Math.max(comment.likesCount - 1, 0)
            };
          })
        };
      }));
    }
  }, []);

  const collectComment = useCallback(async (postId: string, commentId: string) => {
    let previousCollected = false;

    setPosts(prev => prev.map(post => {
      if (post.id !== postId) return post;
      return {
        ...post,
        comments: updateCommentInTree(post.comments, commentId, comment => {
          previousCollected = comment.isCollected;
          return {
            ...comment,
            isCollected: !comment.isCollected,
            collectionsCount: comment.isCollected ? Math.max(comment.collectionsCount - 1, 0) : comment.collectionsCount + 1
          };
        })
      };
    }));

    try {
      const result = await postsService.collectComment(commentId);
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: updateCommentInTree(post.comments, commentId, comment => ({
            ...comment,
            isCollected: result.collected,
            collectionsCount: result.collections_count
          }))
        };
      }));
      setMyComments(prev => updateCommentInTree(prev, commentId, comment => ({
        ...comment,
        isCollected: result.collected,
        collectionsCount: result.collections_count
      })));
      setCollectedComments(prev => result.collected
        ? updateCommentInTree(prev, commentId, comment => ({
          ...comment,
          isCollected: result.collected,
          collectionsCount: result.collections_count
        }))
        : prev.filter(comment => comment.id !== commentId)
      );
      await loadCollections();
    } catch (error) {
      console.error('Failed to collect comment:', error);
      setPosts(prev => prev.map(post => {
        if (post.id !== postId) return post;
        return {
          ...post,
          comments: updateCommentInTree(post.comments, commentId, comment => {
            return {
              ...comment,
              isCollected: previousCollected,
              collectionsCount: previousCollected ? comment.collectionsCount + 1 : Math.max(comment.collectionsCount - 1, 0)
            };
          })
        };
      }));
    }
  }, [loadCollections]);

  const contextValue: AppContextType = {
    currentUser,
    tags,
    posts,
    collectionPosts,
    myComments,
    collectedComments,
    likedPosts,
    collectedPosts,
    notifications,
    conversations,
    unreadCount,
    addTag,
    removeTag,
    createPost,
    editPost,
    deletePost,
    likePost,
    collectPost,
    addComment,
    deleteComment,
    likeComment,
    collectComment,
    loadPostDetail,
    updateTags,
    logout,
    login,
    register,
    quickStart,
    sendCode,
    updateProfile,
    loadCollections,
    loadMyComments,
    loadNotifications,
    markNotificationsRead,
    loadConversations,
    openConversationWithUser,
    loadConversationMessages,
    sendChatMessage,
    markConversationRead,
    deleteConversation,
    getUserProfile,
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
