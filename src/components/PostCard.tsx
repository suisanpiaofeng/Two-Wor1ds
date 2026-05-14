import React, { useState } from 'react';
import type { Post } from '../types';
import { getAvatarColor, getAvatarLetter } from '../utils/helpers';
import Comment from './Comment';

const VISIBLE_COMMENTS = 3;

interface PostCardProps {
  post: Post;
  currentUserId: string;
  isLiked: boolean;
  isCollected: boolean;
  onLike: (postId: string) => void;
  onCollect: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onDelete: (postId: string) => void;
}

export default function PostCard({
  post,
  currentUserId,
  isLiked,
  isCollected,
  onLike,
  onCollect,
  onComment,
  onDelete,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');

  const handleSubmitComment = () => {
    const trimmed = commentInput.trim();
    if (trimmed) {
      onComment(post.id, trimmed);
      setCommentInput('');
    }
  };

  const handleCommentKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmitComment();
    }
  };

  const avatarColor = getAvatarColor(post.userAvatarSeed);
  const avatarLetter = getAvatarLetter(post.userNickname);

  const visibleComments = showAllComments
    ? post.comments
    : post.comments.slice(-VISIBLE_COMMENTS);
  const hasHiddenComments = post.comments.length > VISIBLE_COMMENTS && !showAllComments;

  return (
    <div className="card-base p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-medium flex-shrink-0"
          style={{ backgroundColor: avatarColor }}
        >
          {avatarLetter}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-text">{post.userNickname}</span>
            </div>
            {post.userId === currentUserId && (
              <button
                onClick={() => onDelete(post.id)}
                className="p-1 text-gray-text/40 hover:text-red-500 btn-interaction"
                title="删除"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>

          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {post.tags.map(tag => (
                <span
                  key={tag}
                  className="text-xs px-1.5 py-0.5 bg-primary-blue/30 rounded text-gray-text/70"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-gray-text leading-relaxed whitespace-pre-wrap">{post.content}</p>

      <div className="flex items-center gap-4 pt-2 border-t border-primary-blue/20">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-1 text-sm btn-interaction ${
            isLiked ? 'text-primary-blue' : 'text-gray-text/60 hover:text-primary-blue'
          }`}
        >
          <span>{isLiked ? '已赞' : '点赞'}</span>
          <span>{post.likes > 0 && post.likes}</span>
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="text-sm text-gray-text/60 hover:text-primary-blue btn-interaction"
        >
          评论 {post.comments.length > 0 && `(${post.comments.length})`}
        </button>

        <button
          onClick={() => onCollect(post.id)}
          className={`flex items-center gap-1 text-sm btn-interaction ${
            isCollected ? 'text-primary-blue' : 'text-gray-text/60 hover:text-primary-blue'
          }`}
        >
          {isCollected ? '已收藏' : '收藏'}
        </button>
      </div>

      {showComments && (
        <div className="space-y-3 pt-3 border-t border-primary-blue/20">
          {hasHiddenComments && (
            <button
              onClick={() => setShowAllComments(true)}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              查看全部 {post.comments.length} 条评论
            </button>
          )}

          {visibleComments.map(comment => (
            <Comment
              key={comment.id}
              comment={comment}
            />
          ))}

          {showAllComments && post.comments.length > VISIBLE_COMMENTS && (
            <button
              onClick={() => setShowAllComments(false)}
              className="text-xs text-gray-400 hover:text-gray-500"
            >
              收起评论
            </button>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={commentInput}
              onChange={e => setCommentInput(e.target.value)}
              onKeyDown={handleCommentKeyDown}
              placeholder="写下你的评论..."
              className="flex-1 px-3 py-2 text-sm bg-white border border-primary-blue/50 rounded-card focus:outline-none focus:border-primary-blue text-gray-text placeholder-gray-text/50"
            />
            <button
              onClick={handleSubmitComment}
              className="px-4 py-2 text-sm bg-primary-blue text-gray-text rounded-card btn-interaction hover:bg-primary-blue/80"
            >
              发送
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
