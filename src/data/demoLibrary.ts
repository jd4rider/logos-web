import type { BibleSummary, Book, Chapter, ChapterContent, SearchData, SearchVerse } from "../lib/types";

const english = {
  id: "eng",
  name: "English",
  nameLocal: "English",
  script: "Latin",
  scriptDirection: "LTR",
} as const;

export const demoBible: BibleSummary = {
  id: "demo-web",
  abbreviation: "DEMO",
  name: "Guided Web Demo",
  nameLocal: "Guided Web Demo",
  description: "A bundled sample library that previews the Logos AI reading experience.",
  language: english,
  type: "demo",
  source: "demo",
};

const books: Book[] = [
  { id: "GEN", bibleId: demoBible.id, abbreviation: "GEN", name: "Genesis", nameLong: "Genesis" },
  { id: "PSA", bibleId: demoBible.id, abbreviation: "PSA", name: "Psalms", nameLong: "Psalms" },
  { id: "JHN", bibleId: demoBible.id, abbreviation: "JHN", name: "John", nameLong: "John" },
];

const chapters: Chapter[] = [
  { id: "GEN.1", bibleId: demoBible.id, bookId: "GEN", number: "1", position: 1 },
  { id: "PSA.23", bibleId: demoBible.id, bookId: "PSA", number: "23", position: 23 },
  { id: "JHN.1", bibleId: demoBible.id, bookId: "JHN", number: "1", position: 1 },
];

const chapterMap: Record<string, ChapterContent> = {
  "GEN.1": {
    id: "GEN.1",
    bibleId: demoBible.id,
    bookId: "GEN",
    number: "1",
    reference: "Genesis 1",
    verseCount: 8,
    copyright: "Demo text assembled for Logos AI web previews.",
    next: { id: "PSA.23", number: "23", bookId: "PSA" },
    content:
      "[1] In the beginning God created the heavens and the earth.\n" +
      "[2] The earth was formless and void, and darkness was over the face of the deep.\n" +
      "[3] And God said, Let there be light, and there was light.\n" +
      "[4] God saw that the light was good, and God separated the light from the darkness.\n" +
      "[5] God called the light Day, and the darkness he called Night.\n" +
      "[6] And God said, Let there be an expanse in the midst of the waters.\n" +
      "[7] And it was so.\n" +
      "[8] And there was evening and there was morning, the first day.",
  },
  "PSA.23": {
    id: "PSA.23",
    bibleId: demoBible.id,
    bookId: "PSA",
    number: "23",
    reference: "Psalm 23",
    verseCount: 6,
    copyright: "Demo text assembled for Logos AI web previews.",
    previous: { id: "GEN.1", number: "1", bookId: "GEN" },
    next: { id: "JHN.1", number: "1", bookId: "JHN" },
    content:
      "[1] The Lord is my shepherd; I shall not want.\n" +
      "[2] He makes me lie down in green pastures. He leads me beside still waters.\n" +
      "[3] He restores my soul. He leads me in paths of righteousness for his name's sake.\n" +
      "[4] Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me.\n" +
      "[5] You prepare a table before me in the presence of my enemies.\n" +
      "[6] Surely goodness and mercy shall follow me all the days of my life.",
  },
  "JHN.1": {
    id: "JHN.1",
    bibleId: demoBible.id,
    bookId: "JHN",
    number: "1",
    reference: "John 1",
    verseCount: 8,
    copyright: "Demo text assembled for Logos AI web previews.",
    previous: { id: "PSA.23", number: "23", bookId: "PSA" },
    content:
      "[1] In the beginning was the Word, and the Word was with God, and the Word was God.\n" +
      "[2] He was with God in the beginning.\n" +
      "[3] All things were made through him, and without him nothing was made that has been made.\n" +
      "[4] In him was life, and that life was the light of men.\n" +
      "[5] The light shines in the darkness, and the darkness has not overcome it.\n" +
      "[6] There was a man sent from God, whose name was John.\n" +
      "[7] He came as a witness, to bear witness about the light.\n" +
      "[8] He was not the light, but came to bear witness about the light.",
  },
};

function plainText(content: string) {
  return content
    .replace(/\[\d+\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildVerse(chapter: ChapterContent, text: string): SearchVerse {
  return {
    id: chapter.id,
    orgId: chapter.id,
    bookId: chapter.bookId,
    bibleId: chapter.bibleId,
    chapterId: chapter.id,
    reference: chapter.reference,
    text,
  };
}

export function getDemoBibles() {
  return [demoBible];
}

export function getDemoBooks() {
  return books;
}

export function getDemoChapters(bookId: string) {
  return chapters.filter((chapter) => chapter.bookId === bookId);
}

export function getDemoChapter(chapterId: string) {
  return chapterMap[chapterId];
}

export function searchDemoLibrary(query: string, limit = 12): SearchData {
  const normalized = query.trim().toLowerCase();
  const verses = Object.values(chapterMap)
    .map((chapter) => {
      const text = plainText(chapter.content);
      if (!normalized || !text.toLowerCase().includes(normalized)) {
        return null;
      }
      return buildVerse(chapter, text);
    })
    .filter(Boolean)
    .slice(0, limit) as SearchVerse[];

  return {
    query,
    limit,
    offset: 0,
    total: verses.length,
    verseCount: verses.length,
    verses,
  };
}
