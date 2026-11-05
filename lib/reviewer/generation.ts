import type { StudyDepth } from "./study-guide";

const string = { type: "string" };
// Keep size limits in the validator. Expanding nested array bounds in Gemini's
// decoding grammar can exceed the service's state limit.
const strings = { type: "array", items: string };
const object = (properties: Record<string, unknown>, required: string[]) => ({
  type: "object", properties, required, additionalProperties: false,
});

const topic = object({
  heading: string, explanation: string, sourceHeading: string, takeaway: string,
  steps: strings, formula: string, code: string,
  comparison: object({
    headers: strings,
    rows: { type: "array", items: strings },
  }, ["headers", "rows"]),
  example: object({ origin: { type: "string", enum: ["source", "illustration"] }, text: string }, ["origin", "text"]),
  check: object({ question: string, answer: string }, ["question", "answer"]),
}, ["heading", "explanation"]);

export function generationSettings(depth: StudyDepth) {
  const concise = depth === "concise";
  const limit = concise ? 5 : 10;
  return {
    maxTopics: limit,
    maxTokens: concise ? 2200 : 3800,
    schema: object({
      title: string, overview: string,
      topics: { type: "array", items: topic },
    }, ["title", "overview", "topics"]),
    prompt: [
      "Read the entire PDF first, including the final sections. Identify the major learning objectives, group related material and teach prerequisites first.",
      concise
        ? "Make a concise revision guide. Prioritize essential distinctions and use very few optional elements."
        : "Make a balanced study guide. Explain why or how each major idea works, including assumptions that change an answer.",
      `Use at most ${limit} topics, fewer for short sources. Write a short overview of what the student will learn. Use descriptive topic headings and short paragraphs. Define important terms where first used.`,
      "Choose only the optional elements that teach this topic. For maths use plain-text formulas with defined variables and ordered solution steps. For programming, copy a complete runnable snippet from the source into code, preserving line breaks and indentation. Explain its result and any necessary assumptions. Do not flatten code into inline example text. For history use an ordered sequence or cause and effect. For literature tie interpretations to passages. For comparisons use short column headers and rows with exactly one cell per header.",
      "When available, copy a short, exact section heading from the PDF into sourceHeading so the reader can locate it. Omit uncertain locators. Do not guess page numbers.",
      "Use origin=source only for examples actually in the PDF. Put any new illustrative scenario only in example with origin=illustration. It must follow directly from the source, introduce no new factual claims, and be plainly distinguishable from source material.",
      "Include a brief takeaway where it adds value. Use at most two short recall checks in the entire guide, with answers supported by the document. Omit unused fields. Place checks in the topic they test. Never create a separate review topic. Use plain text without Markdown fences. Before returning, compare the guide against every distinct source heading. Preserve key conditions, units, exceptions, required reporting steps and conclusions, merging them into existing topics. Avoid repeating the overview or filling quotas.",
    ].join("\n"),
  };
}
