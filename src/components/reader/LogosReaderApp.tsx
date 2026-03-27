import { useEffect, useState } from "react";
import { demoBible, getDemoBibles, getDemoBooks, getDemoChapter, getDemoChapters, searchDemoLibrary } from "../../data/demoLibrary";
import { languageLabel, languageOptions } from "../../lib/bibleMeta";
import { hasLiveApi, liveApi } from "../../lib/liveApi";
import type { BibleSummary, Book, Chapter, ChapterContent, SearchData } from "../../lib/types";
import ReaderPane from "./ReaderPane";
import SearchPanel from "./SearchPanel";
import Sidebar from "./Sidebar";

function explainError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function sourceBadgeClass(source: string) {
  if (source === "demo") {
    return "border-gold/40 bg-gold/10 text-gold";
  }
  return "border-accent/30 bg-accent/10 text-accent";
}

function sourceLabel(source: string) {
  if (source === "demo") {
    return "fallback";
  }
  return "live";
}

function preferredBible(bibles: BibleSummary[]) {
  return (
    bibles.find((bible) => bible.abbreviation.toUpperCase() === "BSB") ??
    bibles.find((bible) => bible.abbreviation.toUpperCase() === "KJV") ??
    bibles[0] ??
    null
  );
}

function preferredBook(books: Book[]) {
  return books.find((book) => book.id === "JHN") ?? books.find((book) => book.id === "PSA") ?? books[0] ?? null;
}

function preferredChapter(bookId: string, chapters: Chapter[]) {
  if (bookId === "PSA") {
    return chapters.find((chapter) => chapter.number === "23") ?? chapters[0] ?? null;
  }
  return chapters.find((chapter) => chapter.number === "1") ?? chapters[0] ?? null;
}

export default function LogosReaderApp() {
  const liveAvailable = hasLiveApi();
  const [mode, setMode] = useState<"demo" | "live">(liveAvailable ? "live" : "demo");
  const [bibles, setBibles] = useState<BibleSummary[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentBible, setCurrentBible] = useState<BibleSummary | null>(null);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentChapter, setCurrentChapter] = useState<ChapterContent | null>(null);
  const [searchResults, setSearchResults] = useState<SearchData | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("eng");

  useEffect(() => {
    let cancelled = false;

    async function bootstrapReader() {
      setBusyLabel(mode === "live" ? "Loading translations" : "Loading fallback library");
      setError(null);
      setCurrentBible(null);
      setCurrentBook(null);
      setCurrentChapter(null);
      setSearchResults(null);
      setSearchOpen(false);
      setBooks([]);
      setChapters([]);

      try {
        const nextBibles = mode === "live" ? await liveApi.getBibles(selectedLanguage) : getDemoBibles();
        if (cancelled) {
          return;
        }

        setBibles(nextBibles);

        const bible = mode === "demo" ? demoBible : preferredBible(nextBibles);
        if (!bible) {
          return;
        }
        setCurrentBible(bible);

        const nextBooks = mode === "live" ? await liveApi.getBooks(bible.id) : getDemoBooks();
        if (cancelled) {
          return;
        }
        setBooks(nextBooks);

        const book = preferredBook(nextBooks);
        if (!book) {
          return;
        }
        setCurrentBook(book);

        const nextChapters = mode === "live" ? await liveApi.getChapters(bible.id, book.id) : getDemoChapters(book.id);
        if (cancelled) {
          return;
        }
        setChapters(nextChapters);

        const chapter = preferredChapter(book.id, nextChapters);
        if (!chapter) {
          return;
        }

        const content = mode === "live" ? await liveApi.getChapter(bible.id, chapter.id) : getDemoChapter(chapter.id);
        if (!cancelled) {
          setCurrentChapter(content);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(explainError(loadError));
          if (mode === "live") {
            setMode("demo");
          }
        }
      } finally {
        if (!cancelled) {
          setBusyLabel("");
        }
      }
    }

    void bootstrapReader();

    return () => {
      cancelled = true;
    };
  }, [mode, selectedLanguage]);

  async function selectBible(bible: BibleSummary) {
    setCurrentBible(bible);
    setCurrentBook(null);
    setCurrentChapter(null);
    setSearchResults(null);
    setSearchOpen(false);
    setChapters([]);
    setBusyLabel(`Loading ${bible.abbreviation}`);

    try {
      const nextBooks = mode === "live" ? await liveApi.getBooks(bible.id) : getDemoBooks();
      setBooks(nextBooks);
    } catch (loadError) {
      setError(explainError(loadError));
    } finally {
      setBusyLabel("");
    }
  }

  function handleLanguageChange(language: string) {
    setSelectedLanguage(language);
  }

  async function selectBook(book: Book) {
    if (!currentBible) {
      return;
    }

    setCurrentBook(book);
    setCurrentChapter(null);
    setSearchOpen(false);
    setBusyLabel(`Loading ${book.name}`);

    try {
      const nextChapters = mode === "live" ? await liveApi.getChapters(currentBible.id, book.id) : getDemoChapters(book.id);
      setChapters(nextChapters);
    } catch (loadError) {
      setError(explainError(loadError));
    } finally {
      setBusyLabel("");
    }
  }

  async function loadChapter(chapterId: string, bookId = currentBook?.id) {
    if (!currentBible || !bookId) {
      return;
    }

    setBusyLabel(`Opening ${chapterId}`);
    try {
      if (currentBook?.id !== bookId) {
        const nextBook = books.find((book) => book.id === bookId);
        if (nextBook) {
          setCurrentBook(nextBook);
        }
        const nextChapters = mode === "live" ? await liveApi.getChapters(currentBible.id, bookId) : getDemoChapters(bookId);
        setChapters(nextChapters);
      }

      const content = mode === "live" ? await liveApi.getChapter(currentBible.id, chapterId) : getDemoChapter(chapterId);
      setCurrentChapter(content);

      const selectedBook = books.find((book) => book.id === content.bookId);
      if (selectedBook) {
        setCurrentBook(selectedBook);
      }
    } catch (loadError) {
      setError(explainError(loadError));
    } finally {
      setBusyLabel("");
    }
  }

  async function openSearchResult(chapterId: string, bookId: string) {
    await loadChapter(chapterId, bookId);
    setSearchOpen(false);
  }

  async function runSearch(query: string) {
    if (!currentBible) {
      return;
    }

    setBusyLabel(`Searching ${currentBible.abbreviation}`);
    try {
      const results = mode === "live" ? await liveApi.search(currentBible.id, query, 30) : searchDemoLibrary(query, 30);
      setSearchResults(results);
      setSearchOpen(true);
    } catch (searchError) {
      setError(explainError(searchError));
    } finally {
      setBusyLabel("");
    }
  }

  function goBack() {
    if (searchOpen) {
      setSearchOpen(false);
      return;
    }
    if (currentChapter) {
      setCurrentChapter(null);
      return;
    }
    if (currentBook) {
      setCurrentBook(null);
      setCurrentChapter(null);
      setChapters([]);
      return;
    }
    if (currentBible && mode === "live") {
      setCurrentBible(null);
      setCurrentBook(null);
      setCurrentChapter(null);
      setSearchResults(null);
      setBooks([]);
      setChapters([]);
    }
  }

  function renderMainPane() {
    if (searchOpen && currentBible) {
      return (
        <SearchPanel
          bibleLabel={`${currentBible.abbreviation} · ${currentBible.name}`}
          loading={Boolean(busyLabel)}
          results={searchResults}
          onClose={() => setSearchOpen(false)}
          onSearch={runSearch}
          onSelectChapter={openSearchResult}
        />
      );
    }

    if (currentChapter) {
      return <ReaderPane chapter={currentChapter} onOpenChapter={loadChapter} />;
    }

    if (currentBook) {
      return (
        <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center px-7 py-8">
          <div className="w-full rounded-[2.3rem] border border-border/80 bg-surface/70 p-8 shadow-panel backdrop-blur-xl">
            <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Open Chapter</p>
            <h2 className="font-display text-4xl text-text">{currentBook.name}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Choose a chapter from the left rail to open the passage in the reader. Search stays available from the
              header so you can jump to any matching verse without leaving the desk.
            </p>
          </div>
        </div>
      );
    }

    if (currentBible) {
      return (
        <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center px-7 py-8">
          <div className="w-full rounded-[2.3rem] border border-border/80 bg-surface/70 p-8 shadow-panel backdrop-blur-xl">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] ${sourceBadgeClass(currentBible.source)}`}
              >
                {sourceLabel(currentBible.source)}
              </span>
              <span className="text-xs uppercase tracking-[0.24em] text-muted">{currentBible.language.name}</span>
            </div>
            <h2 className="font-display text-4xl text-text">{currentBible.name}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Browse books from the left rail or open search to jump directly into a passage in this translation.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center px-7 py-8">
        <div className="w-full rounded-[2.3rem] border border-border/80 bg-surface/70 p-8 shadow-panel backdrop-blur-xl">
          <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Loading Library</p>
          <h1 className="font-display text-4xl text-text">Preparing the reader...</h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
            The reader will open a translation and passage automatically when the library is ready.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card overflow-hidden rounded-none border-0 shadow-none">
      <div className="flex min-h-screen flex-col text-text">
        <header className="relative z-10 border-b border-border/80 bg-bg/70 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-gold">
                  Bible Reader
                </span>
                {currentBible && (
                  <span
                    className={`rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] ${sourceBadgeClass(currentBible.source)}`}
                  >
                    {sourceLabel(currentBible.source)}
                  </span>
                )}
              </div>
              <div className="truncate font-display text-3xl text-text">
                Logos AI
                {currentBible && <span className="ml-3 text-xl text-muted">{currentBible.abbreviation}</span>}
              </div>
              <div className="mt-1 truncate text-sm text-muted">
                {currentBible?.name}
                {currentBook && ` / ${currentBook.name}`}
                {currentChapter && ` / ${currentChapter.reference}`}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {currentBible && (
                <button
                  type="button"
                  onClick={() => setSearchOpen((value) => !value)}
                  className="rounded-full border border-border bg-highlight/70 px-4 py-2 text-sm text-text transition hover:border-gold/50 hover:text-gold"
                >
                  {searchOpen ? "Close Search" : "Search"}
                </button>
              )}
              {(currentBible || currentBook || currentChapter || searchOpen) && (
                <button
                  type="button"
                  onClick={goBack}
                  className="rounded-full border border-border bg-bg/50 px-4 py-2 text-sm text-text transition hover:border-gold/50 hover:text-gold"
                >
                  Back
                </button>
              )}
              <a href="/" className="rounded-full border border-border bg-bg/50 px-4 py-2 text-sm text-text transition hover:border-gold/50 hover:text-gold">
                Home
              </a>
            </div>
          </div>
        </header>

        {error && (
          <div className="border-b border-red-500/30 bg-red-500/10 px-5 py-3 text-sm text-red-100">
            <div className="flex items-center justify-between gap-4">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-xs uppercase tracking-[0.2em]">
                Dismiss
              </button>
            </div>
          </div>
        )}

        <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)_300px]">
          <Sidebar
            bibles={bibles}
            books={books}
            chapters={chapters}
            loading={Boolean(busyLabel)}
            selectedLanguage={selectedLanguage}
            languageOptions={languageOptions}
            languageDisabled={mode === "demo"}
            currentBibleId={currentBible?.id}
            currentBookId={currentBook?.id}
            currentChapterId={currentChapter?.id}
            onLanguageChange={handleLanguageChange}
            onSelectBible={selectBible}
            onSelectBook={selectBook}
            onSelectChapter={(chapter) => void loadChapter(chapter.id, chapter.bookId)}
          />

          <main className="min-h-0 overflow-hidden">{renderMainPane()}</main>

          <aside className="hidden min-h-0 overflow-y-auto border-l border-border/80 bg-surface/40 px-4 py-5 backdrop-blur-xl lg:block">
            <div className="space-y-5">
              <section className="rounded-[1.75rem] border border-border/80 bg-bg/40 p-5 shadow-panel">
                <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Selection</p>
                <div className="space-y-3">
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Translation</div>
                    <div className="mt-1 text-sm text-text">{currentBible?.name ?? "Loading translations..."}</div>
                  </div>
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Book</div>
                    <div className="mt-1 text-sm text-text">{currentBook?.name ?? "Choose a book"}</div>
                  </div>
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Chapter</div>
                    <div className="mt-1 text-sm text-text">{currentChapter?.reference ?? "Choose a chapter"}</div>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-border/80 bg-bg/40 p-5 shadow-panel">
                <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Status</p>
                <div className="space-y-3">
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Source</div>
                    <div className="mt-1 text-sm text-text">
                      {mode === "live" ? "API.Bible live browser mode" : "Fallback bundled reader"}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Language</div>
                    <div className="mt-1 text-sm text-text">{mode === "demo" ? "English (fallback)" : languageLabel(selectedLanguage)}</div>
                  </div>
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Activity</div>
                    <div className="mt-1 text-sm text-text">{busyLabel || "Ready"}</div>
                  </div>
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Search</div>
                    <div className="mt-1 text-sm text-text">Use the search button to jump to matching verses in the current translation.</div>
                  </div>
                </div>
              </section>

              {mode === "demo" && (
                <section className="rounded-[1.75rem] border border-gold/30 bg-gold/5 p-5 shadow-panel">
                  <p className="mb-3 text-xs uppercase tracking-[0.24em] text-gold">Fallback Mode</p>
                  <p className="text-sm leading-7 text-text">
                    Live browser access is not available right now, so the reader fell back to bundled passages.
                  </p>
                  {liveAvailable && (
                    <button
                      type="button"
                      onClick={() => setMode("live")}
                      className="mt-4 rounded-full border border-gold bg-gold px-4 py-2 text-sm font-semibold text-bg transition hover:bg-[#ffd06d]"
                    >
                      Retry live mode
                    </button>
                  )}
                </section>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
