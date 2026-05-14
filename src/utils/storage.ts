import type { Tag, Post, User } from '../types';

const STORAGE_KEYS = {
  TAGS: 'two_wor1ds_tags',
  POSTS: 'two_wor1ds_posts',
  CURRENT_USER: 'two_wor1ds_current_user',
  LIKED_POSTS: 'two_wor1ds_liked_posts',
  COLLECTED_POSTS: 'two_wor1ds_collected_posts',
} as const;

function safeGetItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
  }
}

export const PRESET_TAGS: Tag[] = [
  { id: 'preset-1', name: '生活', isPreset: true },
  { id: 'preset-2', name: '读书', isPreset: true },
  { id: 'preset-3', name: '职场', isPreset: true },
  { id: 'preset-4', name: '情感', isPreset: true },
  { id: 'preset-5', name: '思考', isPreset: true },
];

export function loadTags(): Tag[] {
  return safeGetItem<Tag[]>(STORAGE_KEYS.TAGS, [...PRESET_TAGS]);
}

export function saveTags(tags: Tag[]): void {
  safeSetItem(STORAGE_KEYS.TAGS, tags);
}

export function loadPosts(): Post[] {
  return safeGetItem<Post[]>(STORAGE_KEYS.POSTS, []);
}

export function savePosts(posts: Post[]): void {
  safeSetItem(STORAGE_KEYS.POSTS, posts);
}

export function loadCurrentUser(): User | null {
  return safeGetItem<User | null>(STORAGE_KEYS.CURRENT_USER, null);
}

export function saveCurrentUser(user: User): void {
  safeSetItem(STORAGE_KEYS.CURRENT_USER, user);
}

export function loadLikedPosts(): string[] {
  return safeGetItem<string[]>(STORAGE_KEYS.LIKED_POSTS, []);
}

export function saveLikedPosts(postIds: string[]): void {
  safeSetItem(STORAGE_KEYS.LIKED_POSTS, postIds);
}

export function loadCollectedPosts(): string[] {
  return safeGetItem<string[]>(STORAGE_KEYS.COLLECTED_POSTS, []);
}

export function saveCollectedPosts(postIds: string[]): void {
  safeSetItem(STORAGE_KEYS.COLLECTED_POSTS, postIds);
}
