import { useEffect, useState } from "react";
import { demoBible, getDemoBibles, getDemoBooks, getDemoChapter, getDemoChapters, searchDemoLibrary } from "../../data/demoLibrary";
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

  useEffect(() => {
    let cancelled = false;

    async function loadBibles() {
      setBusyLabel(mode === "live" ? "Loading live library" : "Loading guided demo");
      setCurrentBible(null);
      setCurrentBook(null);
      setCurrentChapter(null);
      setSearchResults(null);
      setSearchOpen(false);
      setBooks([]);
      setChapters([]);

      try {
        const nextBibles = mode === "live" ? await liveApi.getBibles("eng") : getDemoBibles();
        if (!cancelled) {
          setBibles(nextBibles);
          if (mode === "demo") {
            setCurrentBible(demoBible);
            setBooks(getDemoBooks());
          }
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

    void loadBibles();

    return () => {
      cancelled = true;
    };
  }, [mode]);

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

  async function selectBook(book: Book) {
    if (!currentBible) {
      return;
    }

    setCurrentBook(book);
    setCurrentChapter(null);
    setSearchOpen(false);
    setBusyLabel(`Loading ${book.name}`);

    try {
      const nextChapters =
        mode === "live" ? await liveApi.getChapters(currentBible.id, book.id) : getDemoChapters(book.id);
      setChapters(nextChapters);
    } catch (loadError) {
      setError(explainError(loadError));
    } finally {
      setBusyLabel("");
    }
  }

  async function loadChapter(chapterId: string) {
    if (!currentBible) {
      return;
    }

    setBusyLabel(`Opening ${chapterId}`);
    try {
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
    const targetBook = books.find((book) => book.id === bookId);
    if (targetBook && currentBook?.id !== bookId) {
      setCurrentBook(targetBook);
      if (mode === "live" && currentBible) {
        try {
          setChapters(await liveApi.getChapters(currentBible.id, bookId));
        } catch (loadError) {
          setError(explainError(loadError));
        }
      } else {
        setChapters(getDemoChapters(bookId));
      }
    }

    await loadChapter(chapterId);
    setSearchOpen(false);
  }

  async function runSearch(query: string) {
    if (!currentBible) {
      return;
    }

    setBusyLabel(`Searching ${currentBible.abbreviation}`);
    try {
      const results =
        mode === "live" ? await liveApi.search(currentBible.id, query, 30) : searchDemoLibrary(query, 30);
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
      return <ReaderPane chapter={currentChapter} />;
    }

    if (currentBook) {
      return (
        <div className="mx-auto flex h-full w-full max-w-4xl items-center justify-center px-7 py-8">
          <div className="w-full rounded-[2.3rem] border border-border/80 bg-surface/70 p-8 shadow-panel backdrop-blur-xl">
            <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Open Chapter</p>
            <h2 className="font-display text-4xl text-text">{currentBook.name}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              The try flow mirrors the desktop reader: choose a chapter from the left rail to open a passage, then use
              search to jump around quickly.
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
                {currentBible.source}
              </span>
              <span className="text-xs uppercase tracking-[0.24em] text-muted">{currentBible.language.name}</span>
            </div>
            <h2 className="font-display text-4xl text-text">{currentBible.name}</h2>
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
              Browse books from the left rail or open search to jump directly to a passage. The public deployment ships
              with a bundled guided demo, and live mode can point at the shared Logos backend when it is configured.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto flex h-full w-full max-w-5xl items-center justify-center px-7 py-8">
        <div className="grid w-full gap-5 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-[2.5rem] border border-border/80 bg-surface/75 p-8 shadow-panel backdrop-blur-xl">
            <p className="mb-3 text-xs uppercase tracking-[0.28em] text-gold">Logos AI</p>
            <h1 className="max-w-xl font-display text-5xl leading-tight text-text">
              A Wails-inspired reading desk for the web, tuned for discovery.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
              The hosted version focuses on scripture reading and search. AI commentary, voices, and deeper workflows
              stay in the downloadable app where they belong.
            </p>
          </section>

          <section className="rounded-[2.5rem] border border-border/80 bg-bg/55 p-6 shadow-panel backdrop-blur-xl">
            <div className="space-y-4">
              <div className="rounded-[1.7rem] border border-border bg-surface/75 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Free on-ramp</p>
                <p className="mt-2 text-sm leading-6 text-text">
                  The public site shows a guided demo first, then funnels readers into downloads, BYOK, or a managed
                  plan later.
                </p>
              </div>
              <div className="rounded-[1.7rem] border border-border bg-surface/75 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Desktop-first depth</p>
                <p className="mt-2 text-sm leading-6 text-text">
                  Richer AI commentary, offline workflows, and read-aloud stay in the desktop app instead of bloating
                  the browser surface.
                </p>
              </div>
              <div className="rounded-[1.7rem] border border-border bg-surface/75 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-muted">Future live mode</p>
                <p className="mt-2 text-sm leading-6 text-text">
                  When a managed backend is available, the same interface can point at it without redesigning the app.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="surface-card overflow-hidden">
      <div className="flex h-[85vh] min-h-[720px] flex-col text-text">
        <header className="relative z-10 border-b border-border/80 bg-bg/70 px-5 py-4 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-gold/35 bg-gold/10 px-3 py-1 text-[0.68rem] uppercase tracking-[0.24em] text-gold">
                  Web Reader
                </span>
                {currentBible && (
                  <span
                    className={`rounded-full border px-3 py-1 text-[0.68rem] uppercase tracking-[0.22em] ${sourceBadgeClass(currentBible.source)}`}
                  >
                    {currentBible.source}
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

            <div className="flex items-center gap-2">
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

        <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
          <Sidebar
            bibles={bibles}
            books={books}
            chapters={chapters}
            loading={Boolean(busyLabel)}
            currentBibleId={currentBible?.id}
            currentBookId={currentBook?.id}
            currentChapterId={currentChapter?.id}
            onSelectBible={selectBible}
            onSelectBook={selectBook}
            onSelectChapter={(chapter) => void loadChapter(chapter.id)}
          />

          <main className="min-h-0 overflow-hidden">{renderMainPane()}</main>

          <aside className="hidden min-h-0 overflow-y-auto border-l border-border/80 bg-surface/40 px-4 py-5 backdrop-blur-xl lg:block">
            <div className="space-y-5">
              <section className="rounded-[1.75rem] border border-border/80 bg-bg/40 p-5 shadow-panel">
                <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Mode</p>
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => setMode("demo")}
                    className={`rounded-[1.2rem] border px-4 py-3 text-left transition ${
                      mode === "demo" ? "border-gold bg-gold/10 text-gold" : "border-border bg-surface/70 text-text"
                    }`}
                  >
                    <div className="text-sm font-semibold">Guided demo</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">Bundled passages</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => liveAvailable && setMode("live")}
                    disabled={!liveAvailable}
                    className={`rounded-[1.2rem] border px-4 py-3 text-left transition ${
                      mode === "live"
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-surface/70 text-text disabled:cursor-not-allowed disabled:opacity-45"
                    }`}
                  >
                    <div className="text-sm font-semibold">Live API</div>
                    <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                      {liveAvailable
                        ? "Powered by PUBLIC_API_BIBLE_KEY or PUBLIC_LOGOS_API_BASE"
                        : "Not configured on this deployment"}
                    </div>
                  </button>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-border/80 bg-bg/40 p-5 shadow-panel">
                <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Status</p>
                <div className="space-y-3">
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Selection</div>
                    <div className="mt-1 text-sm text-text">{currentBible?.abbreviation ?? "Choose a translation"}</div>
                  </div>
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Activity</div>
                    <div className="mt-1 text-sm text-text">{busyLabel || "Ready"}</div>
                  </div>
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Deployment</div>
                    <div className="mt-1 text-sm text-text">
                      Static on GitHub Pages, with live browser reading enabled when the public API env is set.
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.75rem] border border-border/80 bg-bg/40 p-5 shadow-panel">
                <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Next steps</p>
                <div className="space-y-3 text-sm leading-7 text-muted">
                  <p>Download the desktop app for AI commentary, offline workflows, and read-aloud tools.</p>
                  <p>Use the docs site to plug in your own API setup or connect this web UI to a managed backend later.</p>
                </div>
              </section>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
