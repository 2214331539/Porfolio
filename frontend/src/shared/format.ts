const CJK = /[\u3400-\u9fff\uf900-\ufaff]/g;
const LATIN_WORD = /[A-Za-z0-9_]+/g;

export function formatDate(value: string, style: 'full' | 'short' | 'month' = 'full') {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  if (style === 'short') return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  if (style === 'month') return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function relativeTime(value: string) {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return '';
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 60) return '刚刚';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 86400 * 7) return `${Math.floor(seconds / 86400)} 天前`;
  return formatDate(value);
}

export function clockTime(value: Date) {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

/** Markdown reduced to readable plain text, for excerpts and search. */
export function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function excerptOf(item: { excerpt?: string; content: string }, length = 110) {
  if (item.excerpt?.trim()) return item.excerpt.trim();
  const text = plainText(item.content);
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

export function countWords(text: string) {
  return (text.match(CJK)?.length ?? 0) + (text.match(LATIN_WORD)?.length ?? 0);
}

export function readingMinutes(text: string) {
  return Math.max(1, Math.round((text.match(CJK)?.length ?? 0) / 400 + (text.match(LATIN_WORD)?.length ?? 0) / 200));
}

/** `datetime-local` input value in local time. */
export function toLocalInput(value: string | null | undefined) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function errorMessage(error: unknown, fallback = '操作失败，请重试') {
  return error instanceof Error && error.message ? error.message : fallback;
}
