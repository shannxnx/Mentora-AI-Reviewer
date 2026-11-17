import { isStudyGuide, type StudyGuide, type StudyDepth } from "./study-guide";

export const STUDY_FILE_ACCEPT = ".pdf,.ppt,.pptx,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;

export type ReviewerConcept = {
  title: string;
  explanation: string;
  example: string;
};

export type ReviewerTerm = {
  term: string;
  definition: string;
};

export type Reviewer = {
  title: string;
  summary: string;
  concepts: ReviewerConcept[];
  terms: ReviewerTerm[];
  takeaways: string[];
};

export type ReviewerRecord = {
  fileName: string;
  size: number;
  reviewer: Reviewer | StudyGuide;
  completedTopics?: number[];
  sourceHash?: string;
  depth?: StudyDepth;
};

export function sourceSelectionError(
  file: Pick<File, "name" | "size">,
): string | null {
  if (!/\.(pdf|pptx?)$/i.test(file.name)) return "Choose a PDF or a PowerPoint presentation (.ppt or .pptx).";
  if (file.name.length > 255) return "Shorten the file name to 255 characters or fewer.";
  if (file.size === 0) return "This file is empty. Choose a file with lesson content.";
  if (file.size > MAX_SOURCE_BYTES) return "Upload a file of 10 MB or less.";
  return null;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isText(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.length <= maximum
  );
}

function parseConcept(value: unknown): ReviewerConcept | null {
  if (
    !isObject(value) ||
    !isText(value.title, 180) ||
    !isText(value.explanation, 2_000) ||
    !isText(value.example, 1_000)
  )
    return null;
  return {
    title: value.title.trim(),
    explanation: value.explanation.trim(),
    example: value.example.trim(),
  };
}

function parseTerm(value: unknown): ReviewerTerm | null {
  if (
    !isObject(value) ||
    !isText(value.term, 120) ||
    !isText(value.definition, 700)
  )
    return null;
  return {
    term: value.term.trim(),
    definition: value.definition.trim(),
  };
}

export function parseReviewer(value: unknown): Reviewer | null {
  if (
    !isObject(value) ||
    !isText(value.title, 200) ||
    !isText(value.summary, 4_000) ||
    !Array.isArray(value.concepts) ||
    value.concepts.length < 1 ||
    value.concepts.length > 8 ||
    !Array.isArray(value.terms) ||
    value.terms.length < 1 ||
    value.terms.length > 12 ||
    !Array.isArray(value.takeaways) ||
    value.takeaways.length < 1 ||
    value.takeaways.length > 8
  )
    return null;

  const concepts = value.concepts.map(parseConcept);
  const terms = value.terms.map(parseTerm);
  if (concepts.some((item) => item === null)) return null;
  if (terms.some((item) => item === null)) return null;
  if (!value.takeaways.every((item) => isText(item, 500))) return null;

  return {
    title: value.title.trim(),
    summary: value.summary.trim(),
    concepts: concepts as ReviewerConcept[],
    terms: terms as ReviewerTerm[],
    takeaways: value.takeaways.map((item) => item.trim()),
  };
}

export function parseStoredReviewer(value: string | null): ReviewerRecord | null {
  if (!value) return null;
  try {
    return parseReviewerRecord(JSON.parse(value));
  } catch {
    return null;
  }
}

export function parseReviewerRecord(data: unknown): ReviewerRecord | null {
  if (
    !isObject(data) ||
    !isText(data.fileName, 255) ||
    typeof data.size !== "number" ||
    !Number.isInteger(data.size) ||
    data.size < 5 ||
    sourceSelectionError({ name: data.fileName, size: data.size })
  )
    return null;
  const reviewer = isStudyGuide(data.reviewer) ? data.reviewer : parseReviewer(data.reviewer);
  if (!reviewer) return null;
  const count = "topics" in reviewer ? reviewer.topics.length : 0;
  const completedTopics = Array.isArray(data.completedTopics)
    ? [...new Set<number>(data.completedTopics.filter((n) => Number.isInteger(n) && n >= 0 && n < count))]
    : [];
  const sourceHash = typeof data.sourceHash === "string" && /^[a-f0-9]{64}$/.test(data.sourceHash) ? data.sourceHash : undefined;
  const depth = data.depth === "balanced" || data.depth === "concise" ? data.depth : undefined;
  return { fileName: data.fileName, size: data.size, reviewer, completedTopics, sourceHash, depth };
}

export function formatPdfSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
