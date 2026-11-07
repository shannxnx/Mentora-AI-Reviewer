const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const ts = require("typescript");
const Module = require("node:module");
const path = require("node:path");
const filename = path.resolve(__dirname, "../lib/practice/model.ts");
const model = new Module(filename, module);
model._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText,
  filename,
);
const {
  validSettings,
  objectiveGrade,
  normalizeAnswer,
  summarize,
  topicInsights,
} = model.exports;
const key = {
  id: "1",
  type: "identification",
  prompt: "Name the molecule",
  options: [],
  topic: "Cell energy",
  topicKey: "r:1",
  reviewerId: "r",
  answer: "ATP",
  acceptedAnswers: ["adenosine triphosphate"],
  explanation: "ATP supplies cellular energy.",
  evidence: "ATP supplies cellular energy.",
};
test("identification accepts curated equivalent terms and harmless case/spacing", () => {
  assert.equal(objectiveGrade(key, "  Adenosine  triphosphate. ").points, 1);
  assert.equal(objectiveGrade(key, "atp").points, 1);
  assert.equal(objectiveGrade(key, "DNA").points, 0);
  assert.equal(objectiveGrade(key, "").points, 0);
});
test("numeric signs and operators remain meaningful", () => {
  assert.notEqual(normalizeAnswer("-2"), normalizeAnswer("2"));
  assert.notEqual(normalizeAnswer("a+b"), normalizeAnswer("ab"));
});
test("written answers require semantic grading; blank answers get zero without AI", () => {
  assert.equal(
    objectiveGrade({ ...key, type: "short-answer" }, "Energy for the cell"),
    null,
  );
  assert.equal(
    objectiveGrade({ ...key, type: "short-answer" }, "  ").points,
    0,
  );
});
test("partial credit totals and topic identities survive aggregation", () => {
  const items = [
    { ...key, points: 1 },
    { ...key, id: "2", points: 0.5 },
    { ...key, id: "3", topicKey: "different-reviewer:1", points: 0 },
  ];
  assert.equal(summarize(items).percentage, 50);
  assert.equal(summarize(items).earned, 1.5);
  const topics = topicInsights(items);
  assert.equal(topics.length, 2);
  assert.equal(topics[0].percentage, 0);
  assert.equal(topics[1].percentage, 75);
});
test("settings reject impossible mixes, unsupported types and invalid deadlines", () => {
  const settings = {
    count: 10,
    types: ["multiple-choice", "short-answer"],
    difficulty: "mixed",
    minutes: null,
  };
  assert.ok(validSettings(settings));
  assert.ok(validSettings({ ...settings, minutes: 15 }));
  for (const bad of [
    { count: 1 },
    { count: 51 },
    { count: 2.5 },
    { types: [] },
    { types: ["essay"] },
    { types: ["short-answer", "short-answer"] },
    { minutes: 0 },
    { minutes: 181 },
    { minutes: 1.5 },
    { difficulty: "impossible" },
  ])
    assert.equal(validSettings({ ...settings, ...bad }), false);
});
