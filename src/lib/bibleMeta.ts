import type { BibleSummary, Language } from "./types";

export interface LanguageOption {
  code: string;
  label: string;
}

export const languageOptions: LanguageOption[] = [
  { code: "", label: "All languages" },
  { code: "eng", label: "English" },
  { code: "spa", label: "Spanish" },
  { code: "fra", label: "French" },
  { code: "deu", label: "German" },
  { code: "por", label: "Portuguese" },
  { code: "ita", label: "Italian" },
  { code: "nld", label: "Dutch" },
  { code: "pol", label: "Polish" },
  { code: "zho", label: "Chinese" },
  { code: "hin", label: "Hindi" },
  { code: "ara", label: "Arabic" },
  { code: "kor", label: "Korean" },
  { code: "jpn", label: "Japanese" },
  { code: "vie", label: "Vietnamese" },
  { code: "ind", label: "Indonesian" },
  { code: "tur", label: "Turkish" },
  { code: "heb", label: "Hebrew" },
  { code: "grc", label: "Greek (Ancient)" },
  { code: "lat", label: "Latin" },
];

const displayLanguageNames: Record<string, string> = Object.fromEntries(
  languageOptions.filter((option) => option.code).map((option) => [option.code, option.label]),
);

function canonicalLanguageCode(code: string) {
  switch (code.trim().toLowerCase()) {
    case "":
      return "";
    case "en":
    case "eng":
      return "eng";
    case "es":
    case "spa":
    case "esp":
      return "spa";
    case "fr":
    case "fra":
      return "fra";
    case "de":
    case "deu":
    case "ger":
      return "deu";
    case "pt":
    case "por":
      return "por";
    case "it":
    case "ita":
      return "ita";
    case "nl":
    case "nld":
      return "nld";
    case "pl":
    case "pol":
      return "pol";
    case "zh":
    case "zho":
      return "zho";
    case "hi":
    case "hin":
      return "hin";
    case "ar":
    case "ara":
      return "ara";
    case "ko":
    case "kor":
      return "kor";
    case "ja":
    case "jpn":
      return "jpn";
    case "vi":
    case "vie":
      return "vie";
    case "id":
    case "ind":
      return "ind";
    case "tr":
    case "tur":
      return "tur";
    default:
      return code.trim().toLowerCase();
  }
}

export function languageLabel(code: string) {
  const canonical = canonicalLanguageCode(code);
  if (!canonical) {
    return "All languages";
  }
  return displayLanguageNames[canonical] ?? code;
}

export function stripLangPrefix(abbreviation: string) {
  const trimmed = abbreviation.trim();
  if (!trimmed) {
    return "";
  }

  const known3 = [
    "eng", "spa", "esp", "fra", "deu", "ger", "por", "zho", "hin", "ara", "rus", "kor", "jpn", "vie", "ind",
    "nld", "ita", "pol", "tur", "heb", "grc", "lat", "afr", "swa", "urd", "ben", "tam",
  ];
  const lower = trimmed.toLowerCase();

  for (const prefix of known3) {
    if (lower.startsWith(prefix) && trimmed.length > prefix.length) {
      const result = trimmed.slice(prefix.length);
      if (result.length >= 2) {
        return result;
      }
    }
  }

  for (const prefix of ["en", "es", "fr", "de", "pt", "it", "nl", "pl"]) {
    if (lower.startsWith(prefix) && trimmed.length > prefix.length) {
      const result = trimmed.slice(prefix.length);
      if (result.length >= 2 && /^[A-Z]/.test(result)) {
        return result;
      }
    }
  }

  return trimmed;
}

export function displayBibleAbbreviation(abbreviation: string) {
  return stripLangPrefix(abbreviation) || abbreviation.trim();
}

export function normalizeBibleSummary(bible: Omit<BibleSummary, "source">): Omit<BibleSummary, "source"> {
  const languageId = canonicalLanguageCode(bible.language?.id ?? "");
  const language: Language = {
    id: bible.language?.id ?? languageId,
    name: bible.language?.name || displayLanguageNames[languageId] || bible.language?.id || "Unknown",
    nameLocal: bible.language?.nameLocal || bible.language?.name || displayLanguageNames[languageId] || bible.language?.id || "Unknown",
    script: bible.language?.script ?? "",
    scriptDirection: bible.language?.scriptDirection ?? "LTR",
  };

  return {
    ...bible,
    abbreviation: displayBibleAbbreviation(bible.abbreviation),
    language,
  };
}
