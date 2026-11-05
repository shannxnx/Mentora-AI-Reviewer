import type { ReviewerRecord } from "@/lib/reviewer/pdf-reviewer";

export type Subject = { id: string; name: string; enrolled_by: string | null };
export type SavedGuide = {
  id: string;
  subject_id: string;
  file_name: string;
  folder: string | null;
  snapshot: ReviewerRecord;
};
export type Deck = {
  id: string;
  title: string;
  reviewer_id: string;
  settings_key: string;
};
export type Card = {
  id: string;
  deck_id: string;
  topic: number;
  front: string;
  back: string;
  evidence: string;
  origin: string;
  revision: number;
  due_at: string;
  last_rating: string | null;
};
export type Review = { deck_id: string; reviewed_at: string };
export const difficulties = ["mixed", "easy", "medium", "hard"] as const;
export const styles = [
  "mixed",
  "definition",
  "conceptual",
  "application",
] as const;
export const lengths = ["concise", "balanced", "detailed"] as const;
export type Settings = {
  count: number;
  difficulty: (typeof difficulties)[number];
  style: (typeof styles)[number];
  length: (typeof lengths)[number];
  topics: number[];
};

export function sourceTopics({ reviewer }: ReviewerRecord) {
  if ("topics" in reviewer)
    return reviewer.topics.map((t, index) => ({
      index,
      heading: t.heading,
      facts: [
        t.explanation,
        t.sourceHeading,
        t.formula,
        t.code,
        ...(t.steps ?? []),
        ...(t.comparison?.rows.map((row) =>
          row
            .map(
              (value, column) => t.comparison!.headers[column] + ": " + value,
            )
            .join(" · "),
        ) ?? []),
        t.takeaway,
        t.check?.question,
        t.check?.answer,
        t.example?.origin === "source" ? t.example.text : "",
      ].filter((s): s is string => !!s),
      illustration: t.example?.origin === "illustration" ? t.example.text : "",
    }));
  // Legacy examples carry no provenance. Use their explanations, terms and takeaways.
  return [
    ...reviewer.concepts.map((c) => ({
      heading: c.title,
      facts: [c.explanation],
    })),
    {
      heading: "Terms and takeaways",
      facts: [
        ...reviewer.terms.map((t) => t.term + " — " + t.definition),
        ...reviewer.takeaways,
      ],
    },
  ].map((t, index) => ({ ...t, index, illustration: "" }));
}
export function settingsFor(topics: number[]): Settings {
  return {
    count: 10,
    difficulty: "mixed",
    style: "mixed",
    length: "concise",
    topics,
  };
}
export function validSettings(s: Settings, total: number) {
  return (
    s &&
    Number.isInteger(s.count) &&
    s.count >= 1 &&
    s.count <= 50 &&
    difficulties.includes(s.difficulty) &&
    styles.includes(s.style) &&
    lengths.includes(s.length) &&
    Array.isArray(s.topics) &&
    s.topics.length > 0 &&
    s.topics.length <= total &&
    new Set(s.topics).size === s.topics.length &&
    s.topics.every((n) => Number.isInteger(n) && n >= 0 && n < total)
  );
}
export function normalizeQuestion(s: string) {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
