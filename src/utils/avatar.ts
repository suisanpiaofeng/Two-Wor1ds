export function isUploadedAvatar(value?: string | null): boolean {
  return typeof value === 'string' && value.startsWith('data:image/');
}

export function getAvatarUrl(value?: string | null): string {
  if (isUploadedAvatar(value)) {
    return value as string;
  }

  const seed = value?.trim() || 'default-avatar';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(seed)}`;
}
