import { useEffect, useRef, useState } from "react";
import { demoBible, getDemoBibles, getDemoBooks, getDemoChapter, getDemoChapters, searchDemoLibrary } from "../../data/demoLibrary";
import { languageLabel, languageOptions } from "../../lib/bibleMeta";
import { hasLiveApi, liveApi } from "../../lib/liveApi";
import type { BibleSummary, Book, Chapter, ChapterContent, SearchData } from "../../lib/types";
import ReaderPane from "./ReaderPane";
import SearchPanel from "./SearchPanel";
import Sidebar from "./Sidebar";

const maxParallelColumns = 3;
const comparisonSlotCount = maxParallelColumns - 1;

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

function normalizeBookKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchesBook(candidate: Book, target: Book) {
  const candidateKeys = [
    normalizeBookKey(candidate.abbreviation),
    normalizeBookKey(candidate.name),
    normalizeBookKey(candidate.nameLong),
  ];
  const targetKeys = [
    normalizeBookKey(target.abbreviation),
    normalizeBookKey(target.name),
    normalizeBookKey(target.nameLong),
  ];

  return targetKeys.some((key) => candidateKeys.includes(key));
}

function sameSelections(left: string[], right: string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function normalizeComparisonSelections(primaryBibleId: string | undefined, bibles: BibleSummary[], current: string[]) {
  const available = bibles.filter((bible) => bible.id !== primaryBibleId);
  const used = new Set<string>();

  return Array.from({ length: comparisonSlotCount }, (_, slot) => {
    const preserved = current[slot];
    if (preserved && available.some((bible) => bible.id === preserved) && !used.has(preserved)) {
      used.add(preserved);
      return preserved;
    }

    const fallback = available.find((bible) => !used.has(bible.id));
    if (!fallback) {
      return "";
    }

    used.add(fallback.id);
    return fallback.id;
  });
}

function comparisonGridClass(columnCount: number) {
  if (columnCount <= 1) {
    return "";
  }
  if (columnCount === 2) {
    return "xl:grid-cols-2";
  }
  return "xl:grid-cols-2 2xl:grid-cols-3";
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
  const [parallelColumnCount, setParallelColumnCount] = useState(1);
  const [comparisonBibleIds, setComparisonBibleIds] = useState<string[]>(["", ""]);
  const [comparisonChapters, setComparisonChapters] = useState<(ChapterContent | null)[]>([null, null]);
  const [comparisonBusy, setComparisonBusy] = useState<boolean[]>([false, false]);
  const [comparisonErrors, setComparisonErrors] = useState<(string | null)[]>([null, null]);
  const comparisonBooksRef = useRef<Record<string, Book[]>>({});
  const comparisonChaptersRef = useRef<Record<string, Chapter[]>>({});

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
      setComparisonChapters([null, null]);
      setComparisonBusy([false, false]);
      setComparisonErrors([null, null]);

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
        setComparisonBusy([false, false]);
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

  useEffect(() => {
    const maxColumns = Math.min(maxParallelColumns, Math.max(1, bibles.length));
    setParallelColumnCount((current) => Math.min(current, maxColumns));
  }, [bibles.length]);

  useEffect(() => {
    setComparisonBibleIds((current) => {
      const next = normalizeComparisonSelections(currentBible?.id, bibles, current);
      return sameSelections(current, next) ? current : next;
    });
  }, [bibles, currentBible?.id]);

  useEffect(() => {
    const visibleSlots = Math.max(0, parallelColumnCount - 1);
    if (!currentBible || !currentBook || !currentChapter || visibleSlots === 0) {
      setComparisonBusy([false, false]);
      setComparisonChapters([null, null]);
      setComparisonErrors([null, null]);
      return;
    }

    let cancelled = false;
    const seen = new Set<string>();
    const referenceBook = currentBook;
    const referenceChapter = currentChapter;

    for (let slot = 0; slot < comparisonSlotCount; slot += 1) {
      if (slot >= visibleSlots) {
        setComparisonBusy((current) => current.map((value, index) => (index === slot ? false : value)));
        setComparisonChapters((current) => current.map((value, index) => (index === slot ? null : value)));
        setComparisonErrors((current) => current.map((value, index) => (index === slot ? null : value)));
        continue;
      }

      const bibleId = comparisonBibleIds[slot];
      if (!bibleId) {
        setComparisonBusy((current) => current.map((value, index) => (index === slot ? false : value)));
        setComparisonChapters((current) => current.map((value, index) => (index === slot ? null : value)));
        setComparisonErrors((current) =>
          current.map((value, index) => (index === slot ? "Choose another translation to compare this chapter." : value)),
        );
        continue;
      }

      if (bibleId === currentBible.id || seen.has(bibleId)) {
        setComparisonBusy((current) => current.map((value, index) => (index === slot ? false : value)));
        setComparisonChapters((current) => current.map((value, index) => (index === slot ? null : value)));
        setComparisonErrors((current) =>
          current.map((value, index) => (index === slot ? "Choose a different comparison translation." : value)),
        );
        continue;
      }

      seen.add(bibleId);
      setComparisonBusy((current) => current.map((value, index) => (index === slot ? true : value)));
      setComparisonErrors((current) => current.map((value, index) => (index === slot ? null : value)));

      void (async () => {
        try {
          let comparisonBooks = comparisonBooksRef.current[bibleId];
          if (!comparisonBooks) {
            comparisonBooks = mode === "live" ? await liveApi.getBooks(bibleId) : getDemoBooks();
            comparisonBooksRef.current[bibleId] = comparisonBooks;
          }

          const matchingBook = comparisonBooks.find((candidate) => matchesBook(candidate, referenceBook));
          if (!matchingBook) {
            throw new Error(`Could not match ${referenceBook.name} in the comparison translation.`);
          }

          const chapterCacheKey = `${bibleId}:${matchingBook.id}`;
          let comparisonChapterList = comparisonChaptersRef.current[chapterCacheKey];
          if (!comparisonChapterList) {
            comparisonChapterList =
              mode === "live" ? await liveApi.getChapters(bibleId, matchingBook.id) : getDemoChapters(matchingBook.id);
            comparisonChaptersRef.current[chapterCacheKey] = comparisonChapterList;
          }

          const matchingChapter = comparisonChapterList.find((chapter) => chapter.number === referenceChapter.number);
          if (!matchingChapter) {
            throw new Error(`Could not find chapter ${referenceChapter.number} in the comparison translation.`);
          }

          const nextChapter =
            mode === "live" ? await liveApi.getChapter(bibleId, matchingChapter.id) : getDemoChapter(matchingChapter.id);
          if (!cancelled) {
            setComparisonChapters((current) => current.map((value, index) => (index === slot ? nextChapter : value)));
          }
        } catch (comparisonLoadError) {
          if (!cancelled) {
            setComparisonChapters((current) => current.map((value, index) => (index === slot ? null : value)));
            setComparisonErrors((current) =>
              current.map((value, index) => (index === slot ? explainError(comparisonLoadError) : value)),
            );
          }
        } finally {
          if (!cancelled) {
            setComparisonBusy((current) => current.map((value, index) => (index === slot ? false : value)));
          }
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [mode, parallelColumnCount, comparisonBibleIds, currentBible?.id, currentBook?.id, currentChapter?.id]);

  async function selectBible(bible: BibleSummary) {
    setCurrentBible(bible);
    setCurrentBook(null);
    setCurrentChapter(null);
    setSearchResults(null);
    setSearchOpen(false);
    setChapters([]);
    setComparisonChapters([null, null]);
    setComparisonBusy([false, false]);
    setComparisonErrors([null, null]);
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

  function handleParallelColumnChange(columnCount: number) {
    const maxColumns = Math.min(maxParallelColumns, Math.max(1, bibles.length));
    setParallelColumnCount(Math.max(1, Math.min(columnCount, maxColumns)));
  }

  function setComparisonBibleId(slot: number, bibleId: string) {
    setComparisonBibleIds((current) => current.map((value, index) => (index === slot ? bibleId : value)));
  }

  function comparisonOptions(slot: number) {
    const blocked = new Set<string>();
    if (currentBible?.id) {
      blocked.add(currentBible.id);
    }
    comparisonBibleIds.forEach((selectedId, index) => {
      if (index !== slot && selectedId) {
        blocked.add(selectedId);
      }
    });

    return bibles.filter((bible) => bible.id === comparisonBibleIds[slot] || !blocked.has(bible.id));
  }

  async function selectBook(book: Book) {
    if (!currentBible) {
      return;
    }

    setCurrentBook(book);
    setCurrentChapter(null);
    setSearchOpen(false);
    setComparisonChapters([null, null]);
    setComparisonBusy([false, false]);
    setComparisonErrors([null, null]);
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
      setComparisonChapters([null, null]);
      setComparisonBusy([false, false]);
      setComparisonErrors([null, null]);

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
      setComparisonChapters([null, null]);
      setComparisonBusy([false, false]);
      setComparisonErrors([null, null]);
      return;
    }
    if (currentBook) {
      setCurrentBook(null);
      setCurrentChapter(null);
      setChapters([]);
      setComparisonChapters([null, null]);
      setComparisonBusy([false, false]);
      setComparisonErrors([null, null]);
      return;
    }
    if (currentBible && mode === "live") {
      setCurrentBible(null);
      setCurrentBook(null);
      setCurrentChapter(null);
      setSearchResults(null);
      setBooks([]);
      setChapters([]);
      setComparisonChapters([null, null]);
      setComparisonBusy([false, false]);
      setComparisonErrors([null, null]);
    }
  }

  function renderComparisonPane(slot: number) {
    if (comparisonBusy[slot]) {
      return (
        <div className="mx-auto flex h-full w-full items-center justify-center px-4 py-4">
          <div className="w-full rounded-[2rem] border border-border/80 bg-surface/60 p-6 text-sm text-muted shadow-panel backdrop-blur-xl">
            Loading comparison translation...
          </div>
        </div>
      );
    }

    const chapter = comparisonChapters[slot];
    if (chapter) {
      const label = bibles.find((bible) => bible.id === comparisonBibleIds[slot])?.abbreviation ?? `Compare ${slot + 2}`;
      return <ReaderPane chapter={chapter} readerLabel={label} compact sharedScroll />;
    }

    return (
      <div className="mx-auto flex h-full w-full items-center justify-center px-4 py-4">
        <div className="w-full rounded-[2rem] border border-border/80 bg-surface/60 p-6 text-sm text-muted shadow-panel backdrop-blur-xl">
          {comparisonErrors[slot] ?? "Choose another translation to compare this chapter side by side."}
        </div>
      </div>
    );
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
      if (parallelColumnCount > 1) {
        return (
          <div className="h-full overflow-y-auto">
            <div className={`grid min-h-full items-start gap-0 ${comparisonGridClass(parallelColumnCount)}`}>
              <div className="min-h-0">
                <ReaderPane
                  chapter={currentChapter}
                  readerLabel={currentBible?.abbreviation ?? "Primary"}
                  compact
                  sharedScroll
                  onOpenChapter={loadChapter}
                />
              </div>

              {Array.from({ length: parallelColumnCount - 1 }, (_, slot) => (
                <div key={`comparison-pane-${slot}`} className="min-h-0">
                  {renderComparisonPane(slot)}
                </div>
              ))}
            </div>
          </div>
        );
      }

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

  const maxColumnsAvailable = Math.min(maxParallelColumns, Math.max(1, bibles.length));

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
              <a
                href="/"
                className="rounded-full border border-border bg-bg/50 px-4 py-2 text-sm text-text transition hover:border-gold/50 hover:text-gold"
              >
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

        <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
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
              {currentChapter ? (
                <section className="rounded-[1.75rem] border border-border/80 bg-bg/40 p-5 shadow-panel">
                  <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Parallel Reading</p>
                  <h3 className="font-display text-2xl text-text">Compare chapter by chapter</h3>
                  <p className="mt-4 text-sm leading-7 text-muted">
                    Keep the same book and chapter synced across two or three translations so differences stay visible
                    while you read.
                  </p>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((columnCount) => (
                      <button
                        key={`parallel-columns-${columnCount}`}
                        type="button"
                        disabled={columnCount > maxColumnsAvailable}
                        onClick={() => handleParallelColumnChange(columnCount)}
                        className={`rounded-2xl border px-3 py-2 text-sm transition ${
                          parallelColumnCount === columnCount
                            ? "border-gold bg-gold text-bg"
                            : "border-border bg-highlight/70 text-text hover:border-gold/50 hover:text-gold disabled:cursor-not-allowed disabled:opacity-40"
                        }`}
                      >
                        {columnCount === 1 ? "Single" : `${columnCount}-up`}
                      </button>
                    ))}
                  </div>

                  {maxColumnsAvailable === 1 ? (
                    <div className="mt-4 rounded-[1.2rem] border border-border bg-surface/60 px-4 py-3 text-sm text-muted">
                      Parallel reading needs at least two available translations in the current library.
                    </div>
                  ) : parallelColumnCount > 1 ? (
                    <div className="mt-4 space-y-3">
                      {Array.from({ length: parallelColumnCount - 1 }, (_, slot) => {
                        const options = comparisonOptions(slot);
                        return (
                          <label key={`parallel-select-${slot}`} className="block">
                            <span className="text-xs uppercase tracking-[0.18em] text-muted">
                              {slot === 0 ? "Second translation" : "Third translation"}
                            </span>
                            <select
                              value={comparisonBibleIds[slot]}
                              onChange={(event) => setComparisonBibleId(slot, event.target.value)}
                              className="mt-2 w-full rounded-[1.1rem] border border-border bg-surface/70 px-4 py-3 text-sm text-text focus:border-gold/50 focus:outline-none"
                            >
                              {options.map((bible) => (
                                <option key={bible.id} value={bible.id}>
                                  {bible.abbreviation} - {bible.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[1.2rem] border border-border bg-surface/60 px-4 py-3 text-sm text-muted">
                      Switch to 2-up or 3-up when you want to compare the same chapter side by side.
                    </div>
                  )}
                </section>
              ) : (
                <section className="rounded-[1.75rem] border border-border/80 bg-bg/40 p-5 shadow-panel">
                  <p className="mb-3 text-xs uppercase tracking-[0.24em] text-muted">Parallel Reading</p>
                  <h3 className="font-display text-2xl text-text">Waiting for a chapter</h3>
                  <p className="mt-4 text-sm leading-7 text-muted">
                    Open a chapter and the reader will let you compare it in two or three translations side by side.
                  </p>
                </section>
              )}

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
                    <div className="mt-1 text-sm text-text">
                      {mode === "demo" ? "English (fallback)" : languageLabel(selectedLanguage)}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Reader Layout</div>
                    <div className="mt-1 text-sm text-text">
                      {parallelColumnCount === 1 ? "Single translation" : `${parallelColumnCount} synced columns`}
                    </div>
                  </div>
                  <div className="rounded-[1.35rem] border border-border bg-surface/70 px-4 py-3">
                    <div className="text-xs uppercase tracking-[0.22em] text-muted">Activity</div>
                    <div className="mt-1 text-sm text-text">{busyLabel || "Ready"}</div>
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
