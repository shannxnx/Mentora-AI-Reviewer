export const MAX_PDF_BYTES = 10 * 1024 * 1024;
export type DemoPdfRecord = { fileName: string; size: number };

export function pdfSelectionError(
  file: Pick<File, "name" | "size">,
): string | null {
  if (!file.name.toLowerCase().endsWith(".pdf"))
    return "Choose a PDF file (.pdf). Other file types are not supported yet.";
  if (file.size === 0) return "This file is empty. Choose a PDF with content.";
  if (file.size > MAX_PDF_BYTES)
    return "This PDF is too large. Choose a file of 10 MB or less.";
  return null;
}

// Browser-only simulation. No network request, text extraction, or AI generation.
// A future real generator can replace this boundary without changing the viewer.
export async function prepareSampleReviewer(
  file: File,
  signal: AbortSignal,
): Promise<DemoPdfRecord> {
  const error = pdfSelectionError(file);
  if (error) throw new Error(error);
  signal.throwIfAborted();
  const header = await file.slice(0, 5).text();
  signal.throwIfAborted();
  if (header !== "%PDF-")
    throw new Error(
      "This file does not have a PDF header. Choose a PDF exported from your document app.",
    );
  await new Promise<void>((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", cancel);
      resolve();
    }, 1000);
    signal.addEventListener("abort", cancel, { once: true });
    if (signal.aborted) cancel();
  });
  return { fileName: file.name, size: file.size };
}

export function parseStoredPdf(value: string | null): DemoPdfRecord | null {
  if (!value) return null;
  try {
    const data: unknown = JSON.parse(value);
    if (
      typeof data !== "object" ||
      data === null ||
      !("fileName" in data) ||
      !("size" in data)
    )
      return null;
    if (
      typeof data.fileName !== "string" ||
      data.fileName.length > 255 ||
      typeof data.size !== "number" ||
      !Number.isInteger(data.size)
    )
      return null;
    if (
      data.size < 5 ||
      pdfSelectionError({ name: data.fileName, size: data.size })
    )
      return null;
    return { fileName: data.fileName, size: data.size };
  } catch {
    return null;
  }
}

export function formatPdfSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
