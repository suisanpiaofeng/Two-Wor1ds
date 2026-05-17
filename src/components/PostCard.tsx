import type { Post, User } from '../types';
import { formatPublishedTime } from '../utils/helpers';
import { getAvatarUrl } from '../utils/avatar';

interface PostCardProps {
  post: Post;
  currentUserId: string;
  isLiked: boolean;
  isCollected: boolean;
  onLike: (postId: string) => void;
  onCollect: (postId: string) => void;
  onDelete: (postId: string) => void;
  onOpenDetail: (postId: string) => void;
  onAvatarClick?: (user: User) => void;
}

export default function PostCard({
  post,
  currentUserId,
  isLiked,
  isCollected,
  onLike,
  onCollect,
  onDelete,
  onOpenDetail,
  onAvatarClick,
}: PostCardProps) {
  return (
    <div
      className="card-base p-4 space-y-3 cursor-pointer"
      onClick={() => onOpenDetail(post.id)}
      role="button"
      tabIndex={0}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenDetail(post.id);
        }
      }}
    >
      <div className="flex items-start gap-3">
        <img
          src={getAvatarUrl(post.userAvatarSeed)}
          alt={`${post.userNickname} 的头像`}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-white"
          onClick={event => {
            if (post.userId === currentUserId) return;
            event.stopPropagation();
            onAvatarClick?.({
              id: post.userId,
              nickname: post.userNickname,
              avatarSeed: post.userAvatarSeed
            });
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div>
                <span className="font-medium text-gray-text">{post.userNickname}</span>
                <p className="text-xs text-gray-text/45">{formatPublishedTime(post.createdAt)}</p>
              </div>
            </div>
            {post.userId === currentUserId && (
              <button
                onClick={event => {
                  event.stopPropagation();
                  onDelete(post.id);
                }}
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

      <p
        className="text-gray-text leading-relaxed whitespace-pre-wrap"
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}
      >
        {post.content}
      </p>

      <button
        onClick={event => {
          event.stopPropagation();
          onOpenDetail(post.id);
        }}
        className="text-sm text-blue-500 hover:text-blue-600"
      >
        查看全文
      </button>

      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={event => {
            event.stopPropagation();
            onLike(post.id);
          }}
          className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ${
            isLiked
              ? 'bg-red-50 text-red-500'
              : 'bg-gray-50 text-gray-text/70 hover:bg-red-50 hover:text-red-500'
          }`}
          aria-label={isLiked ? '取消点赞' : '点赞'}
        >
          <svg
            className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110"
            viewBox="0 0 24 24"
            fill={isLiked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 21s-6.716-4.35-9.193-8.02C.747 9.924 2.02 5.5 6.09 4.558c2.128-.492 4.154.274 5.41 1.91 1.255-1.636 3.281-2.402 5.409-1.91 4.07.942 5.344 5.366 3.283 8.422C18.716 16.65 12 21 12 21Z"
            />
          </svg>
          <span className="leading-none">{post.likes > 0 ? post.likes : '点赞'}</span>
        </button>

        <button
          onClick={event => {
            event.stopPropagation();
            onOpenDetail(post.id);
          }}
          className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ${
            'bg-gray-50 text-gray-text/70 hover:bg-blue-50 hover:text-blue-500'
          }`}
          aria-label="查看评论"
        >
          <svg
            className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 10h10M7 14h6m-8 7 1.95-3.9A8 8 0 1 1 20 12a8 8 0 0 1-8 8H5Z"
            />
          </svg>
          <span className="leading-none">{post.commentsCount > 0 ? post.commentsCount : '评论'}</span>
        </button>

        <button
          onClick={event => {
            event.stopPropagation();
            onCollect(post.id);
          }}
          className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ${
            isCollected
              ? 'bg-yellow-50 text-yellow-500'
              : 'bg-gray-50 text-gray-text/70 hover:bg-yellow-50 hover:text-yellow-500'
          }`}
          aria-label={isCollected ? '取消收藏' : '收藏'}
        >
          <svg
            className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110"
            viewBox="0 0 24 24"
            fill={isCollected ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m12 3 2.47 5.01 5.53.8-4 3.9.94 5.5L12 15.6l-4.94 2.61.94-5.5-4-3.9 5.53-.8L12 3Z"
            />
          </svg>
          <span className="leading-none">{post.collectionsCount > 0 ? post.collectionsCount : '收藏'}</span>
        </button>
      </div>
    </div>
  );
}
