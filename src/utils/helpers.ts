export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function generateAvatarSeed(): string {
  return Math.floor(Math.random() * 1000000).toString();
}

const ADJECTIVES = [
  '安静的', '温柔的', '孤独的', '沉思的', '遥远的', '温柔的', '梦幻的',
  '沉默的', '淡然的', '清澈的', '静谧的', '自由的', '空灵的', '素净的',
];

const NOUNS = [
  '行者', '读者', '旅人', '诗人', '旁观者', '倾听者', '漫游者',
  '独白者', '星空', '月光', '晨雾', '落叶', '飞鸟', '流云',
];

export function generateNickname(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return `${adj}${noun}`;
}

export function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;

  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}月${day}日`;
}

export function getAvatarColor(seed: string | number): string {
  let num: number;
  if (typeof seed === 'string') {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash;
    }
    num = Math.abs(hash) % 360;
  } else {
    num = seed % 360;
  }
  return `hsl(${num}, 25%, 75%)`;
}

export function getAvatarLetter(nickname: string): string {
  const lastChar = nickname.slice(-1);
  return lastChar;
}