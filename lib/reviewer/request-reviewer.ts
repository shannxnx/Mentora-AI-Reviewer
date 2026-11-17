import { pdfSelectionError, type ReviewerRecord } from "./pdf-reviewer";
import { isStudyGuide, type StudyDepth, type StudyGuide } from "./study-guide";

type Options = {
  previous: ReviewerRecord | null;
  signal: AbortSignal;
  onStatus: (message: string) => void;
  fresh?: boolean;
  findSaved?: (hash: string) => Promise<ReviewerRecord | null>;
};

function upload(file: File, depth: StudyDepth, { signal, onStatus }: Options) {
  return new Promise<StudyGuide>((resolve, reject) => {
    signal.throwIfAborted();
    const request = new XMLHttpRequest();
    const cancel = () => request.abort();
    request.open("POST", "/api/reviewer");
    request.responseType = "json";
    request.upload.onprogress = (event) => {
      if (event.lengthComputable)
        onStatus("Uploading PDF · " + Math.round(100 * event.loaded / event.total) + "%");
    };
    request.upload.onload = () => onStatus("Reading the PDF and writing your reviewer…");
    request.onload = () => {
      const data = request.response;
      if (request.status >= 200 && request.status < 300 && isStudyGuide(data?.reviewer))
        resolve(data.reviewer);
      else
        reject(new Error(typeof data?.error === "string" ? data.error :
          request.status === 413 ? "The upload limit was exceeded. Try a smaller PDF." :
          "Could not read the reviewer response. Please try again."));
    };
    request.onerror = () => reject(new Error("The connection was interrupted. Check your connection and try again."));
    request.onabort = () => reject(new DOMException("Upload cancelled.", "AbortError"));
    request.onloadend = () => signal.removeEventListener("abort", cancel);
    signal.addEventListener("abort", cancel, { once: true });
    const form = new FormData();
    form.set("pdf", file);
    form.set("depth", depth);
    onStatus("Uploading your PDF…");
    request.send(form);
  });
}

export async function requestReviewer(file: File, depth: StudyDepth, options: Options): Promise<ReviewerRecord> {
  const invalid = pdfSelectionError(file);
  if (invalid) throw new Error(invalid);
  options.onStatus("Checking your PDF…");
  const hash = globalThis.crypto?.subtle
    ? await crypto.subtle.digest("SHA-256", await file.arrayBuffer())
    : null;
  const sourceHash = hash ? Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, "0")).join("") : undefined;
  options.signal.throwIfAborted();
  const previous = options.previous;
  if (!options.fresh && sourceHash && previous?.sourceHash === sourceHash && previous.depth === depth)
    return { ...previous, fileName: file.name, size: file.size };
  if (!options.fresh && sourceHash && options.findSaved) {
    options.onStatus("Checking your saved reviewers…");
    const saved = await options.findSaved(sourceHash);
    options.signal.throwIfAborted();
    if (saved?.sourceHash === sourceHash && saved.depth === depth && isStudyGuide(saved.reviewer))
      return { ...saved, fileName: file.name, size: file.size };
  }
  const reviewer = await upload(file, depth, options);
  return { fileName: file.name, size: file.size, reviewer, depth, sourceHash };
}
