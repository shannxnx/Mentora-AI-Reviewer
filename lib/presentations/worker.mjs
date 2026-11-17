import { parentPort, workerData } from "node:worker_threads";
import { legacySlides } from "./ppt.mjs";
import { modernSlides } from "./pptx.mjs";

try {
  const bytes = Buffer.from(workerData.bytes);
  const slides = workerData.kind === "ppt" ? legacySlides(bytes) : await modernSlides(bytes);
  let characters = 0;
  let hasContent = false;
  const parts = [];
  for (const [index, slide] of slides.entries()) {
    const body = slide.lines.filter(line => /[^\s|]/u.test(line)).join("\n");
    const notes = slide.notes.join("\n");
    hasContent ||= Boolean(body || notes || slide.images.length);
    const text = ["Slide " + (index + 1), body, notes && "Speaker notes\n" + notes].filter(Boolean).join("\n");
    characters += text.length;
    if (characters > 180000) throw Error("This presentation contains too much text. Split it into smaller files.");
    parts.push({ type: "text", text }, ...slide.images);
  }
  if (!hasContent) throw Error("No readable slide content was found. Export the presentation as a PDF to include its visuals.");
  parentPort.postMessage({ parts });
} catch (error) {
  const message = error instanceof Error && /^(This (file|presentation|slide)|Remove the presentation|Use a presentation|No readable slide content)/.test(error.message)
    ? error.message : "The presentation could not be read. Open it in PowerPoint and save a fresh copy.";
  parentPort.postMessage({ error: message });
}
