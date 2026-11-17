const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const ts = require("typescript");

// Compile the same local model modules used by the browser. Node runs each test file in isolation.
require.extensions[".ts"] = (mod, filename) => mod._compile(
  ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, filename,
);
const { requestReviewer } = require("../lib/reviewer/request-reviewer.ts");
const { parseStoredReviewer, sourceSelectionError } = require("../lib/reviewer/pdf-reviewer.ts");

const guide = {
  version: 3, title: "Triangles", overview: "Right triangles",
  topics: [{ heading: "Sides", explanation: "The hypotenuse is opposite the right angle." }],
};
const file = new File(["%PDF-sample"], "lesson.pdf", { type: "application/pdf" });

test("identical bytes and depth reuse a reviewer after reload, preserving progress", async t => {
  let posts = 0;
  class Upload {
    upload = {};
    open() {}
    send() {
      posts++;
      this.status = 200;
      this.response = { reviewer: guide };
      this.onload();
      this.onloadend();
    }
  }
  const original = global.XMLHttpRequest;
  global.XMLHttpRequest = Upload;
  t.after(() => { if (original) global.XMLHttpRequest = original; else delete global.XMLHttpRequest; });
  const options = { previous: null, signal: new AbortController().signal, onStatus() {} };
  const first = await requestReviewer(file, "balanced", options);
  const previous = parseStoredReviewer(JSON.stringify({ ...first, completedTopics: [0] }));
  const renamed = new File([file], "lesson-copy.pdf");
  const repeat = await requestReviewer(renamed, "balanced", { ...options, previous });
  assert.equal(posts, 1);
  assert.equal(repeat.fileName, renamed.name);
  assert.deepEqual(repeat.completedTopics, [0]);
  await requestReviewer(file, "concise", { ...options, previous });
  await requestReviewer(file, "balanced", { ...options, previous, fresh: true });
  await requestReviewer(new File(["%PDF-change"], file.name), "balanced", { ...options, previous });
  assert.equal(posts, 4);
  const saved = await requestReviewer(file, "balanced", { ...options, findSaved: async () => previous });
  assert.equal(saved.reviewer.title, first.reviewer.title);
  assert.equal(posts, 4);
  await requestReviewer(file, "concise", { ...options, findSaved: async () => previous });
  assert.equal(posts, 5);
});

test("existing saved records without cache metadata still open", () => {
  const record = parseStoredReviewer(JSON.stringify({ fileName: file.name, size: file.size, reviewer: guide }));
  assert.equal(record.reviewer.title, "Triangles");
  assert.equal(record.sourceHash, undefined);
});
test("invalid uploads and cancelled requests stop before transmission", async () => {
  assert.equal(sourceSelectionError({ name: "slides.PPTX", size: 100 }), null);
  assert.match(sourceSelectionError({ name: "lesson.doc", size: 100 }), /Choose a PDF or a PowerPoint/);
  assert.match(sourceSelectionError({ name: "empty.pdf", size: 0 }), /empty/);
  assert.match(sourceSelectionError({ name: "large.pdf", size: 10485761 }), /10 MB/);
  await assert.rejects(requestReviewer(file, "balanced", {
    previous: null, signal: AbortSignal.abort(), onStatus() {},
  }), { name: "AbortError" });
});

test("evidence must quote a whole fact or a substantial source excerpt", () => {
  const { hasSupportingPassage } = require("../lib/reviewer/evidence.ts");
  const source = ["The hypotenuse is opposite the right angle.", "3 cm"];
  assert.ok(hasSupportingPassage(source, "opposite the right angle"));
  assert.ok(hasSupportingPassage(source, "3 cm"));
  assert.equal(hasSupportingPassage(source, "a"), false);
  assert.equal(hasSupportingPassage(source, "."), false);
  assert.equal(hasSupportingPassage(source, "opposite the acute angle"), false);
});
