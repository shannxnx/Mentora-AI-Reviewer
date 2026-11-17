export async function requestJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (response.status === 401) throw new Error("Your session expired. Sign in again to continue.");
  const data = await response.json().catch(() => {
    throw new Error("The server returned an unreadable response. Please try again.");
  });
  if (!response.ok)
    throw new Error(data.error || "Could not connect. Please try again.");
  return data as T;
}
export function dateLabel(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
