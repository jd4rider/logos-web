import type { BibleSummary, Book, Chapter, ChapterContent, SearchData } from "./types";
import { normalizeBibleSummary } from "./bibleMeta";

const publicApiBibleKey = import.meta.env.PUBLIC_API_BIBLE_KEY ?? "";
const liveApiBase = (import.meta.env.PUBLIC_LOGOS_API_BASE ?? "").replace(/\/$/, "");
const directApiBase = "https://api.scripture.api.bible/v1";

interface Envelope<T> {
  data: T;
}

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

function unwrapData<T>(payload: T | Envelope<T>): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }
  return payload;
}

export function hasLiveApi() {
  return Boolean(liveApiBase || publicApiBibleKey);
}

export const liveApi = {
  async getBibles(language = "eng") {
    const query = language ? `?language=${language}` : "";
    const bibles = unwrapData(
      await fetchJSON<Omit<BibleSummary, "source">[] | Envelope<Omit<BibleSummary, "source">[]>>(`/bibles${query}`),
    );
    return bibles.map((bible) => ({ ...normalizeBibleSummary(bible), source: "api" as const }));
  },
  async getBooks(bibleId: string) {
    return unwrapData(await fetchJSON<Book[] | Envelope<Book[]>>(`/bibles/${bibleId}/books`));
  },
  async getChapters(bibleId: string, bookId: string) {
    return unwrapData(await fetchJSON<Chapter[] | Envelope<Chapter[]>>(`/bibles/${bibleId}/books/${bookId}/chapters`));
  },
  async getChapter(bibleId: string, chapterId: string) {
    return unwrapData(
      await fetchJSON<ChapterContent | Envelope<ChapterContent>>(
        `/bibles/${bibleId}/chapters/${chapterId}?content-type=text&include-verse-numbers=true&include-titles=true&include-chapter-numbers=false`,
      ),
    );
  },
  async search(bibleId: string, query: string, limit = 20) {
    return unwrapData(
      await fetchJSON<SearchData | Envelope<SearchData>>(
        `/bibles/${bibleId}/search?query=${encodeURIComponent(query)}&limit=${limit}`,
      ),
    );
  },
};
