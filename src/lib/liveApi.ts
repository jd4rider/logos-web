import type { BibleSummary, Book, Chapter, ChapterContent, SearchData } from "./types";

const publicApiBibleKey = import.meta.env.PUBLIC_API_BIBLE_KEY ?? "";
const liveApiBase = (import.meta.env.PUBLIC_LOGOS_API_BASE ?? "").replace(/\/$/, "");
const directApiBase = "https://api.scripture.api.bible/v1";

function assertLiveApi() {
  if (!liveApiBase && !publicApiBibleKey) {
    throw new Error("Live API mode is not configured for this deployment.");
  }
}

async function fetchJSON<T>(path: string): Promise<T> {
  assertLiveApi();
  const response = await fetch(`${liveApiBase || directApiBase}${path}`, {
    headers: publicApiBibleKey ? { "api-key": publicApiBibleKey } : undefined,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return response.json();
}

export function hasLiveApi() {
  return Boolean(liveApiBase || publicApiBibleKey);
}

export const liveApi = {
  async getBibles(language = "eng") {
    const bibles = await fetchJSON<Omit<BibleSummary, "source">[]>(`/bibles?language=${language}`);
    return bibles.map((bible) => ({ ...bible, source: "api" as const }));
  },
  getBooks(bibleId: string) {
    return fetchJSON<Book[]>(`/bibles/${bibleId}/books`);
  },
  getChapters(bibleId: string, bookId: string) {
    return fetchJSON<Chapter[]>(`/bibles/${bibleId}/books/${bookId}/chapters`);
  },
  getChapter(bibleId: string, chapterId: string) {
    return fetchJSON<ChapterContent>(`/bibles/${bibleId}/chapters/${chapterId}`);
  },
  search(bibleId: string, query: string, limit = 20) {
    return fetchJSON<SearchData>(
      `/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&limit=${limit}`,
    );
  },
};
