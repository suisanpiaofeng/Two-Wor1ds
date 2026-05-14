import type { Comment as CommentType } from '../types';
import { getAvatarColor, getAvatarLetter } from '../utils/helpers';

interface CommentProps {
  comment: CommentType;
}

export default function Comment({ comment }: CommentProps) {
  const avatarColor = getAvatarColor(comment.userAvatarSeed);
  const avatarLetter = getAvatarLetter(comment.userNickname);

  return (
    <div className="flex gap-2">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
        style={{ backgroundColor: avatarColor }}
      >
        {avatarLetter}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-text">{comment.userNickname}</span>
        </div>
        <p className="text-sm text-gray-text/80 mt-0.5 whitespace-pre-wrap">{comment.content}</p>
      </div>
    </div>
  );
}
