export const questionTypes = [
  "multiple-choice",
  "true-false",
  "identification",
  "short-answer",
] as const;
export type QuestionType = (typeof questionTypes)[number];
export const typeLabels: Record<QuestionType, string> = {
  "multiple-choice": "Multiple choice",
  "true-false": "True / false",
  identification: "Identification",
  "short-answer": "Short answer",
};
export type TestSettings = {
  count: number;
  difficulty: "easy" | "medium" | "hard" | "mixed";
  types: QuestionType[];
  minutes: number | null;
};
export type Question = {
  id: string;
  type: QuestionType;
  prompt: string;
  options: string[];
  topic: string;
  topicKey: string;
  reviewerId: string;
};
export type AnswerKey = Question & {
  answer: string;
  acceptedAnswers: string[];
  explanation: string;
  evidence: string;
};
export type GradedAnswer = AnswerKey & {
  response: string;
  points: number;
  feedback: string;
  aiGraded: boolean;
};
export type TestResult = {
  items: GradedAnswer[];
  earned: number;
  total: number;
  percentage: number;
};
export type PracticeTest = {
  id: string;
  title: string;
  subject_name: string;
  subject_id: string;
  settings: TestSettings;
  questions: Question[];
  created_at: string;
};
export type Attempt = {
  id: string;
  test_id: string;
  status: "active" | "submitted" | "graded";
  answers: Record<string, string>;
  revision: number;
  started_at: string;
  expires_at: string | null;
  submitted_at: string | null;
  score: number | null;
  result: TestResult | null;
};
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function validSettings(value: unknown): value is TestSettings {
  if (!value || typeof value !== "object") return false;
  const s = value as TestSettings;
  return (
    Number.isInteger(s.count) &&
    s.count >= 1 &&
    s.count <= 50 &&
    ["easy", "medium", "hard", "mixed"].includes(s.difficulty) &&
    Array.isArray(s.types) &&
    s.types.length > 0 &&
    new Set(s.types).size === s.types.length &&
    s.types.every((t) => questionTypes.includes(t)) &&
    s.count >= s.types.length &&
    (s.minutes === null ||
      (Number.isInteger(s.minutes) && s.minutes >= 1 && s.minutes <= 180))
  );
}
export function normalizeAnswer(value: string) {
  // Preserve meaningful mathematical symbols: "-2" must never match "2".
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "");
}
export function objectiveGrade(
  key: AnswerKey,
  response: string,
): GradedAnswer | null {
  if (key.type === "short-answer" && response.trim()) return null;
  const correct =
    response.trim().length > 0 &&
    [key.answer, ...key.acceptedAnswers].some(
      (a) => normalizeAnswer(a) === normalizeAnswer(response),
    );
  return {
    ...key,
    response,
    points: correct ? 1 : 0,
    feedback: !response.trim()
      ? "No answer submitted."
      : correct
        ? "Correct."
        : "Review the explanation and source evidence below.",
    aiGraded: false,
  };
}
export function summarize(items: GradedAnswer[]): TestResult {
  const earned = items.reduce((sum, item) => sum + item.points, 0);
  return {
    items,
    earned,
    total: items.length,
    percentage: items.length ? Math.round((earned / items.length) * 100) : 0,
  };
}
export function topicInsights(items: GradedAnswer[]) {
  const topics = new Map<
    string,
    {
      key: string;
      name: string;
      reviewerId: string;
      earned: number;
      count: number;
    }
  >();
  for (const item of items) {
    const topic = topics.get(item.topicKey) ?? {
      key: item.topicKey,
      name: item.topic,
      reviewerId: item.reviewerId,
      earned: 0,
      count: 0,
    };
    topic.earned += item.points;
    topic.count++;
    topics.set(item.topicKey, topic);
  }
  return [...topics.values()]
    .map((t) => ({ ...t, percentage: Math.round((t.earned / t.count) * 100) }))
    .sort((a, b) => a.percentage - b.percentage);
}
