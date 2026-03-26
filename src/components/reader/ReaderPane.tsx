import type { ReactNode } from "react";
import type { ChapterContent } from "../../lib/types";

interface Props {
  chapter: ChapterContent;
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

function parseContent(content: string): ReactNode[] {
  const cleaned = content.replace(/¶/g, "").trim();
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

export default function ReaderPane({ chapter }: Props) {
  return (
    <div className="mx-auto flex h-full w-full max-w-4xl flex-col overflow-y-auto px-7 py-8">
      <div className="mb-6 rounded-[2rem] border border-border/80 bg-surface/70 p-6 shadow-panel backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-gold">
            Reader
          </span>
          <span className="text-xs uppercase tracking-[0.24em] text-muted">{chapter.verseCount} verses</span>
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
