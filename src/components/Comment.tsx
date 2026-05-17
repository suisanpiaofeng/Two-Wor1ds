import type { Comment as CommentType, User } from '../types';
import { formatPublishedTime } from '../utils/helpers';
import { getAvatarUrl } from '../utils/avatar';

interface CommentProps {
  comment: CommentType;
  currentUserId?: string;
  onLike?: (commentId: string) => void;
  onCollect?: (commentId: string) => void;
  onReply?: (comment: CommentType) => void;
  onDelete?: (commentId: string) => void;
  onAvatarClick?: (user: User) => void;
  highlightedCommentId?: string | null;
  isNested?: boolean;
}

export default function Comment({
  comment,
  currentUserId,
  onLike,
  onCollect,
  onReply,
  onDelete,
  onAvatarClick,
  highlightedCommentId,
  isNested = false
}: CommentProps) {
  const isOwnComment = currentUserId === comment.userId;
  const isHighlighted = highlightedCommentId === comment.id;

  return (
    <div
      id={`comment-${comment.id}`}
      className={`rounded-2xl border p-3 transition ${
        isNested ? 'bg-white' : 'bg-gray-50/80'
      } ${
        isHighlighted ? 'border-blue-300 bg-blue-50/70 shadow-sm' : 'border-gray-100'
      }`}
    >
      <div className="flex gap-3">
        <img
          src={getAvatarUrl(comment.userAvatarSeed)}
          alt={`${comment.userNickname} 的头像`}
          className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-white"
          onClick={() => {
            if (isOwnComment) return;
            onAvatarClick?.({
              id: comment.userId,
              nickname: comment.userNickname,
              avatarSeed: comment.userAvatarSeed
            });
          }}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-gray-text">{comment.userNickname}</span>
            <span className="text-xs text-gray-400">
              {formatPublishedTime(comment.createdAt)}
            </span>
          </div>
          {comment.replyToUserNickname && (
            <p className="mt-1 text-xs text-blue-500">回复 @{comment.replyToUserNickname}</p>
          )}
          <p className="text-sm text-gray-text/80 mt-1 whitespace-pre-wrap leading-6">{comment.content}</p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onLike?.(comment.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                comment.isLiked
                  ? 'bg-red-50 text-red-500'
                  : 'bg-white text-gray-text/60 hover:bg-red-50 hover:text-red-500'
              }`}
              aria-label={comment.isLiked ? '取消点赞评论' : '点赞评论'}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill={comment.isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21s-6.716-4.35-9.193-8.02C.747 9.924 2.02 5.5 6.09 4.558c2.128-.492 4.154.274 5.41 1.91 1.255-1.636 3.281-2.402 5.409-1.91 4.07.942 5.344 5.366 3.283 8.422C18.716 16.65 12 21 12 21Z"
                />
              </svg>
              <span>{comment.likesCount > 0 ? comment.likesCount : '点赞'}</span>
            </button>

            <button
              onClick={() => onCollect?.(comment.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${
                comment.isCollected
                  ? 'bg-yellow-50 text-yellow-500'
                  : 'bg-white text-gray-text/60 hover:bg-yellow-50 hover:text-yellow-500'
              }`}
              aria-label={comment.isCollected ? '取消收藏评论' : '收藏评论'}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill={comment.isCollected ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m12 3 2.47 5.01 5.53.8-4 3.9.94 5.5L12 15.6l-4.94 2.61.94-5.5-4-3.9 5.53-.8L12 3Z"
                />
              </svg>
              <span>{comment.collectionsCount > 0 ? comment.collectionsCount : '收藏'}</span>
            </button>

            <button
              onClick={() => onReply?.(comment)}
              className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-blue-500 transition hover:bg-blue-50"
            >
              回复
            </button>

            {isOwnComment && (
              <button
                onClick={() => onDelete?.(comment.id)}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50"
              >
                删除
              </button>
            )}
          </div>

          {comment.replies.length > 0 && (
            <div className="mt-3 space-y-2 rounded-2xl bg-gray-50 p-2.5">
              {comment.replies.map(reply => (
                <Comment
                  key={reply.id}
                  comment={reply}
                  currentUserId={currentUserId}
                  onLike={onLike}
                  onCollect={onCollect}
                  onReply={onReply}
                  onDelete={onDelete}
                  onAvatarClick={onAvatarClick}
                  highlightedCommentId={highlightedCommentId}
                  isNested
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
