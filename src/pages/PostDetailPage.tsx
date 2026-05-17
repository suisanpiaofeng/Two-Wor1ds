import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import Comment from '../components/Comment';
import TagEditor from '../components/TagEditor';
import type { Comment as CommentType, Tag, User } from '../types';
import { formatPublishedTime } from '../utils/helpers';
import { getAvatarUrl } from '../utils/avatar';

interface PostDetailPageProps {
  postId: string;
  focusCommentId?: string;
  onBack: () => void;
  onAvatarClick?: (user: User) => void;
}

function ensurePostTags(tags: Tag[], postTags: string[]) {
  const existingNames = new Set(tags.map(tag => tag.name));
  const missingTags = postTags
    .filter(tagName => !existingNames.has(tagName))
    .map((tagName, index) => ({
      id: `custom-edit-${Date.now()}-${index}`,
      name: tagName,
      isPreset: false
    }));

  return missingTags.length > 0 ? [...tags, ...missingTags] : tags;
}

export default function PostDetailPage({ postId, focusCommentId, onBack, onAvatarClick }: PostDetailPageProps) {
  const {
    posts,
    currentUser,
    tags,
    likedPosts,
    collectedPosts,
    updateTags,
    loadPostDetail,
    likePost,
    collectPost,
    editPost,
    deletePost,
    addComment,
    deleteComment,
    likeComment,
    collectComment
  } = useApp();
  const [loading, setLoading] = useState(true);
  const [commentInput, setCommentInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTarget, setReplyTarget] = useState<CommentType | null>(null);
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [editTagIds, setEditTagIds] = useState<string[]>([]);
  const [savingPost, setSavingPost] = useState(false);

  const post = useMemo(
    () => posts.find(item => item.id === postId) || null,
    [posts, postId]
  );

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      await loadPostDetail(postId);
      if (mounted) {
        setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [loadPostDetail, postId]);

  useEffect(() => {
    if (!focusCommentId || !post) return;

    setHighlightedCommentId(focusCommentId);

    const timer = window.setTimeout(() => {
      document.getElementById(`comment-${focusCommentId}`)?.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [focusCommentId, post]);

  const handleStartEdit = () => {
    if (!post) return;

    const mergedTags = ensurePostTags(tags, post.tags);
    if (mergedTags.length !== tags.length) {
      updateTags(mergedTags);
    }

    setEditContent(post.content);
    setEditTagIds(
      mergedTags
        .filter(tag => post.tags.includes(tag.name))
        .map(tag => tag.id)
    );
    setEditingPost(true);
  };

  const handleSavePost = async () => {
    if (!post || !editContent.trim() || savingPost) return;

    setSavingPost(true);
    try {
      await editPost(post.id, editContent.trim(), editTagIds);
      setEditingPost(false);
    } finally {
      setSavingPost(false);
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
    if (!confirm('确定要删除这条帖子吗？')) return;

    await deletePost(post.id);
    onBack();
  };

  const handleSubmitComment = async () => {
    const trimmed = commentInput.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await addComment(postId, trimmed, replyTarget?.id);
      setCommentInput('');
      setReplyTarget(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('确定要删除这条评论吗？')) return;
    await deleteComment(postId, commentId);
    if (highlightedCommentId === commentId) {
      setHighlightedCommentId(null);
    }
  };

  const handleCommentKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmitComment();
    }
  };

  if (loading && !post) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-purple-200 border-t-purple-500" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-medium text-gray-700">帖子不存在或已被删除</p>
        <button
          onClick={onBack}
          className="rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700"
        >
          返回
        </button>
      </div>
    );
  }

  const isLiked = likedPosts.includes(post.id);
  const isCollected = collectedPosts.includes(post.id);
  const isOwnPost = currentUser?.id === post.userId;

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-y-auto">
      <div className="mx-auto min-h-full max-w-2xl bg-white">
        <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/95 px-4 py-4 backdrop-blur">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onBack}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200"
              aria-label="返回"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div className="flex flex-1 items-center justify-between gap-3">
              <div>
                <h1 className="text-base font-semibold text-gray-900">帖子详情</h1>
                <p className="text-xs text-gray-400">完整内容与评论互动</p>
              </div>
              {isOwnPost && (
                <div className="flex items-center gap-2">
                  {editingPost ? (
                    <button
                      onClick={() => setEditingPost(false)}
                      className="rounded-full bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-600"
                    >
                      取消编辑
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleStartEdit}
                        className="rounded-full bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600"
                      >
                        编辑
                      </button>
                      <button
                        onClick={handleDeletePost}
                        className="rounded-full bg-red-50 px-3 py-1.5 text-sm font-medium text-red-500"
                      >
                        删除
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="px-4 pb-28 pt-4">
          <section className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <img
                src={getAvatarUrl(post.userAvatarSeed)}
                alt={`${post.userNickname} 的头像`}
                className="flex h-11 w-11 flex-shrink-0 rounded-full object-cover bg-white"
                onClick={() => {
                  if (isOwnPost) return;
                  onAvatarClick?.({
                    id: post.userId,
                    nickname: post.userNickname,
                    avatarSeed: post.userAvatarSeed
                  });
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{post.userNickname}</p>
                    <p className="text-xs text-gray-400">
                      {formatPublishedTime(post.createdAt)}
                    </p>
                  </div>
                </div>

                {!editingPost && post.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {post.tags.map(tag => (
                      <span
                        key={tag}
                        className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {editingPost ? (
              <div className="mt-5 space-y-4">
                <textarea
                  value={editContent}
                  onChange={event => setEditContent(event.target.value)}
                  rows={6}
                  className="w-full resize-none rounded-2xl border border-blue-100 bg-gray-50 px-4 py-3 text-[15px] leading-7 text-gray-800 outline-none focus:border-blue-400"
                />
                <TagEditor
                  tags={tags}
                  selectedTagIds={editTagIds}
                  onTagSelect={tagId => setEditTagIds(prev => prev.includes(tagId) ? prev : [...prev, tagId])}
                  onTagDeselect={tagId => setEditTagIds(prev => prev.filter(id => id !== tagId))}
                  onAddTag={(name) => {
                    const existingTag = tags.find(tag => tag.name === name);
                    if (existingTag) {
                      setEditTagIds(prev => prev.includes(existingTag.id) ? prev : [...prev, existingTag.id]);
                      return;
                    }

                    const newTag = {
                      id: `custom-${Date.now()}`,
                      name,
                      isPreset: false
                    };
                    updateTags([...tags, newTag]);
                    setEditTagIds(prev => [...prev, newTag.id]);
                  }}
                />
                <button
                  onClick={handleSavePost}
                  disabled={!editContent.trim() || savingPost}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {savingPost ? '保存中...' : '保存修改'}
                </button>
              </div>
            ) : (
              <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7 text-gray-800">
                {post.content}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
              <button
                onClick={() => likePost(post.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isLiked
                    ? 'bg-red-50 text-red-500'
                    : 'bg-gray-50 text-gray-600 hover:bg-red-50 hover:text-red-500'
                }`}
              >
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill={isLiked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 21s-6.716-4.35-9.193-8.02C.747 9.924 2.02 5.5 6.09 4.558c2.128-.492 4.154.274 5.41 1.91 1.255-1.636 3.281-2.402 5.409-1.91 4.07.942 5.344 5.366 3.283 8.422C18.716 16.65 12 21 12 21Z"
                  />
                </svg>
                <span>{post.likes}</span>
              </button>

              <button
                onClick={() => collectPost(post.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  isCollected
                    ? 'bg-yellow-50 text-yellow-500'
                    : 'bg-gray-50 text-gray-600 hover:bg-yellow-50 hover:text-yellow-500'
                }`}
              >
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24" fill={isCollected ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m12 3 2.47 5.01 5.53.8-4 3.9.94 5.5L12 15.6l-4.94 2.61.94-5.5-4-3.9 5.53-.8L12 3Z"
                  />
                </svg>
                <span>{post.collectionsCount}</span>
              </button>

              <div className="rounded-full bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-600">
                评论 {post.commentsCount}
              </div>
            </div>
          </section>

          <section className="mt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">全部评论</h2>
              <span className="text-sm text-gray-400">{post.commentsCount} 条</span>
            </div>

            {post.comments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
                还没有评论，来发表第一条吧
              </div>
            ) : (
              post.comments.map(comment => (
                <Comment
                  key={comment.id}
                  comment={comment}
                  currentUserId={currentUser?.id}
                  onLike={(commentId) => likeComment(post.id, commentId)}
                  onCollect={(commentId) => collectComment(post.id, commentId)}
                  onReply={setReplyTarget}
                  onDelete={handleDeleteComment}
                  onAvatarClick={onAvatarClick}
                  highlightedCommentId={highlightedCommentId}
                />
              ))
            )}
          </section>
        </main>

        <div className="sticky bottom-0 border-t border-gray-100 bg-white/95 px-4 py-3 backdrop-blur">
          {replyTarget && (
            <div className="mb-3 flex items-center justify-between rounded-2xl bg-blue-50 px-3 py-2 text-sm text-blue-600">
              <span>回复 @{replyTarget.userNickname}</span>
              <button
                onClick={() => setReplyTarget(null)}
                className="font-medium text-blue-500"
              >
                取消
              </button>
            </div>
          )}
          <div className="flex items-end gap-3">
            <textarea
              value={commentInput}
              onChange={event => setCommentInput(event.target.value)}
              onKeyDown={handleCommentKeyDown}
              rows={2}
              placeholder={currentUser ? (replyTarget ? `回复 ${replyTarget.userNickname}...` : '写下你的评论...') : '登录后即可评论'}
              className="max-h-32 min-h-[52px] flex-1 resize-none rounded-2xl border border-blue-100 bg-gray-50 px-4 py-3 text-sm text-gray-800 outline-none focus:border-blue-400"
            />
            <button
              onClick={handleSubmitComment}
              disabled={!commentInput.trim() || submitting}
              className="rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              发送
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
