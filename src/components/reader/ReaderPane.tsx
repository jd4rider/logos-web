import type { ReactNode } from "react";
import type { ChapterContent } from "../../lib/types";

interface Props {
  chapter: ChapterContent;
  onOpenChapter?: (chapterId: string, bookId: string) => void;
}

function renderWordSegment(segment: string, paragraphIndex: number): ReactNode[] {
  const words = segment.trim().split(/\s+/).filter(Boolean);
  const parts: ReactNode[] = [];

  words.forEach((word, wordIndex) => {
    if (wordIndex > 0) {
      parts.push(" ");
    }
    parts.push(
      <span key={`word-${paragraphIndex}-${wordIndex}`} className="text-text transition hover:text-gold">
        {word}
      </span>,
    );
  });

  return parts;
}

function normalizeContent(content: string) {
  if (!/<[a-z][\s\S]*>/i.test(content)) {
    return content;
  }

  return content
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

function parseContent(content: string): ReactNode[] {
  const cleaned = normalizeContent(content).replace(/¶/g, "").trim();
  const paragraphs = cleaned.split(/\n+/);

  return paragraphs.map((paragraph, paragraphIndex) => {
    if (!paragraph.trim()) {
      return <br key={`break-${paragraphIndex}`} />;
    }

    const parts: ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const verseNumberPattern = /\[(\d+)\]/g;

    while ((match = verseNumberPattern.exec(paragraph)) !== null) {
      if (match.index > lastIndex) {
        const segment = paragraph.slice(lastIndex, match.index);
        parts.push(...renderWordSegment(segment, paragraphIndex));
      }

      parts.push(
        <sup
          key={`verse-${paragraphIndex}-${match[1]}`}
          className="mr-1 font-sans text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold"
        >
          {match[1]}
        </sup>,
      );
      parts.push(" ");

      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < paragraph.length) {
      const tail = paragraph.slice(lastIndex);
      parts.push(...renderWordSegment(tail, paragraphIndex));
    }

    return (
      <p key={`paragraph-${paragraphIndex}`} className="mb-5 leading-8 text-[1.05rem]">
        {parts}
      </p>
    );
  });
}

export default function ReaderPane({ chapter, onOpenChapter }: Props) {
  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-y-auto px-7 py-8">
      <div className="mb-6 rounded-[2rem] border border-border/80 bg-surface/70 p-6 shadow-panel backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-gold">
              Reader
            </span>
            <span className="text-xs uppercase tracking-[0.24em] text-muted">{chapter.verseCount} verses</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {chapter.previous && (
              <button
                type="button"
                onClick={() => onOpenChapter?.(chapter.previous!.id, chapter.previous!.bookId)}
                className="rounded-full border border-border bg-bg/50 px-4 py-2 text-sm text-text transition hover:border-gold/50 hover:text-gold"
              >
                Previous
              </button>
            )}
            {chapter.next && (
              <button
                type="button"
                onClick={() => onOpenChapter?.(chapter.next!.id, chapter.next!.bookId)}
                className="rounded-full border border-border bg-bg/50 px-4 py-2 text-sm text-text transition hover:border-gold/50 hover:text-gold"
              >
                Next
              </button>
            )}
          </div>
        </div>
        <h1 className="font-display text-4xl text-text">{chapter.reference}</h1>
      </div>

      <article className="rounded-[2rem] border border-border/80 bg-surface/60 px-7 py-8 font-serif text-lg shadow-panel backdrop-blur-xl">
        {parseContent(chapter.content)}
        <p className="mt-10 border-t border-border/70 pt-5 font-sans text-xs uppercase tracking-[0.18em] text-muted">
          {chapter.copyright}
        </p>
      </article>
    </div>
  );
}
