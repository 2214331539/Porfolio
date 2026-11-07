export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

const apiPrefix = (import.meta.env.VITE_API_PREFIX || "/api").replace(/\/+$/, "");
const sharedTokenKey = "inkfold_token";

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = localStorage.getItem(sharedTokenKey);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(apiPrefix + path, {
    ...options,
    headers,
    credentials: "same-origin",
  });
  const result = await response.json();
  if (!response.ok)
    throw new ApiError(result.error || "操作未完成，请重试。", response.status);
  return result as T;
}
export function post<T>(path: string, body: unknown = {}) {
  return api<T>(path, { method: "POST", body: JSON.stringify(body) });
}
export const regions: Record<string, string> = {
  "ap-southeast-1": "新加坡",
  "ap-shanghai": "上海",
  "cn-hangzhou": "杭州",
  "cn-beijing": "北京",
  "cn-shanghai": "上海",
  "ap-guangzhou": "广州",
  "ap-hongkong": "香港",
};
export function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(value / 1024)} KB`;
}
export function formatTime(value?: string | null) {
  return value
    ? new Date(value).toLocaleTimeString("zh-CN", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        timeZone: "Asia/Singapore",
      })
    : "尚未采集";
}
export function formatDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Singapore",
  }).format(new Date(value));
}
export function serverRegion(region: string) {
  return regions[region] || region || "地区待补充";
}
export function address(value: string) {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "操作暂时未完成。";
export const reducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
