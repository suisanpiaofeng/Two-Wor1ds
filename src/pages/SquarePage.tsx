import React, { useState, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import TagEditor from '../components/TagEditor';
import PostCard from '../components/PostCard';

import type { User } from '../types';

interface SquarePageProps {
  onOpenPostDetail: (postId: string, focusCommentId?: string) => void;
  onOpenUserActions: (user: User) => void;
}

export default function SquarePage({ onOpenPostDetail, onOpenUserActions }: SquarePageProps) {
  const {
    currentUser,
    tags,
    posts,
    likedPosts,
    collectedPosts,
    createPost,
    deletePost,
    likePost,
    collectPost,
    addTag,
    hasMorePosts,
    isLoadingMore,
    isRefreshing,
    refreshPosts,
    loadMorePosts,
  } = useApp();

  const [postContent, setPostContent] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const sortedPosts = [...posts].sort((a, b) => b.likes - a.likes);

  const handleTagSelect = (tagId: string) => {
    setSelectedTagIds(prev => [...prev, tagId]);
  };

  const handleTagDeselect = (tagId: string) => {
    setSelectedTagIds(prev => prev.filter(id => id !== tagId));
  };

  const handleCreatePost = () => {
    const trimmed = postContent.trim();
    if (trimmed) {
      createPost(trimmed, selectedTagIds);
      setPostContent('');
      setSelectedTagIds([]);
    }
  };

  const handlePostKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreatePost();
    }
  };

  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollHeight = document.documentElement.scrollHeight;
    const clientHeight = document.documentElement.clientHeight;

    if (scrollHeight - scrollTop - clientHeight < 200 && hasMorePosts && !isLoadingMore) {
      loadMorePosts();
    }
  }, [hasMorePosts, isLoadingMore, loadMorePosts]);

  React.useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-gradient-to-r from-blue-600 to-indigo-600 py-6 px-4 shadow-lg sticky top-0 z-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1"></div>
            <h1 className="text-2xl font-bold text-white tracking-wide flex-1">Two Wor1ds</h1>
            <div className="flex-1 flex justify-end gap-2">
              <span className="text-white/80 text-sm py-2">{currentUser?.nickname}</span>
            </div>
          </div>
          <p className="text-sm text-white/80 mt-1">以文字为界，奔赴两个精神世界</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section className="card-base p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">标签筛选</h2>
            <button
              onClick={refreshPosts}
              disabled={isRefreshing}
              className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50 flex items-center gap-1"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              {isRefreshing ? '刷新中...' : '刷新'}
            </button>
          </div>
          <TagEditor
            tags={tags}
            selectedTagIds={selectedTagIds}
            onTagSelect={handleTagSelect}
            onTagDeselect={handleTagDeselect}
            onAddTag={addTag}
          />
        </section>

        <section className="card-base p-4 space-y-4">
          <h2 className="text-sm font-medium text-gray-500">发布文字</h2>
          <textarea
            value={postContent}
            onChange={e => setPostContent(e.target.value)}
            onKeyDown={handlePostKeyDown}
            placeholder="写下你的文字..."
            rows={4}
            className="w-full px-4 py-3 bg-white border border-blue-200 rounded-lg resize-none focus:outline-none focus:border-blue-500 text-gray-700 placeholder-gray-400"
          />
          <button
            onClick={handleCreatePost}
            disabled={!postContent.trim()}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg btn-interaction hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-md transition"
          >
            发布
          </button>
        </section>

        <section className="space-y-4">
          {sortedPosts.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">暂无内容</p>
              <p className="text-sm">成为第一个发布的人吧！</p>
            </div>
          ) : (
            sortedPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                isLiked={likedPosts.includes(post.id)}
                isCollected={collectedPosts.includes(post.id)}
                onLike={() => likePost(post.id)}
                onCollect={() => collectPost(post.id)}
                onDelete={() => deletePost(post.id)}
                currentUserId={currentUser?.id || ''}
                onOpenDetail={onOpenPostDetail}
                onAvatarClick={onOpenUserActions}
              />
            ))
          )}

          {isLoadingMore && (
            <div className="text-center py-4">
              <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-gray-400 mt-2">加载更多...</p>
            </div>
          )}

          {!hasMorePosts && sortedPosts.length > 0 && (
            <div className="text-center py-4 text-gray-400 text-sm">
              没有更多内容了
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
