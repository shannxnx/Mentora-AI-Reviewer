export type StudyDepth = "concise" | "balanced";

export type StudyTopic = {
  heading: string;
  explanation: string;
  sourceHeading?: string;
  steps?: string[];
  formula?: string;
  code?: string;
  comparison?: { headers: string[]; rows: string[][] };
  example?: { origin: "source" | "illustration"; text: string };
  check?: { question: string; answer: string };
  takeaway?: string;
};

export type StudyGuide = {
  version: 3;
  title: string;
  overview: string;
  topics: StudyTopic[];
};

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, max: number): value is string {
  return typeof value === "string" && !!value.trim() && value.length <= max;
}

function textList(value: unknown, min: number, max: number, width: number): value is string[] {
  return Array.isArray(value) && value.length >= min && value.length <= max &&
    value.every((item) => text(item, width));
}

function validTopic(value: unknown): value is StudyTopic {
  if (!object(value) || !text(value.heading, 180) || !text(value.explanation, 2400)) return false;
  if (value.sourceHeading !== undefined && !text(value.sourceHeading, 200)) return false;
  if (value.steps !== undefined && !textList(value.steps, 1, 8, 650)) return false;
  if (value.formula !== undefined && !text(value.formula, 500)) return false;
  if (value.code !== undefined && !text(value.code, 1800)) return false;
  if (value.takeaway !== undefined && !text(value.takeaway, 450)) return false;
  const { example, check, comparison } = value;
  if (example !== undefined && (!object(example) || !text(example.text, 1400) ||
    (example.origin !== "source" && example.origin !== "illustration"))) return false;
  if (check !== undefined && (!object(check) || !text(check.question, 450) || !text(check.answer, 1000))) return false;
  if (comparison !== undefined) {
    if (!object(comparison) || !textList(comparison.headers, 2, 4, 100)) return false;
    const width = comparison.headers.length;
    if (!Array.isArray(comparison.rows) || !comparison.rows.length || comparison.rows.length > 8 ||
      !comparison.rows.every((row) => textList(row, width, width, 400))) return false;
  }
  return true;
}

export function isStudyGuide(value: unknown): value is StudyGuide {
  return object(value) && value.version === 3 && text(value.title, 200) &&
    text(value.overview, 1500) && Array.isArray(value.topics) &&
    value.topics.length > 0 && value.topics.length <= 10 && value.topics.every(validTopic);
}
