import "server-only";
import { join } from "node:path";
import { Worker } from "node:worker_threads";

type Part = { type: "text"; text: string } | { type: "image"; mime_type: "image/png" | "image/jpeg"; data: string };

export async function presentationParts(bytes: Buffer, kind: "ppt" | "pptx", signal: AbortSignal): Promise<Part[]> {
  signal.throwIfAborted();
  const worker = new Worker(join(/* turbopackIgnore: true */ process.cwd(), "lib/presentations/worker.mjs"), {
    workerData: { bytes, kind },
    resourceLimits: { maxOldGenerationSizeMb: 96, stackSizeMb: 4 },
  });
  try {
    return await new Promise<Part[]>((resolve, reject) => {
      const abort = () => reject(new Error("Upload cancelled."));
      const timer = setTimeout(() => reject(new Error("This presentation took too long to unpack. Split it into smaller files.")), 8000);
      signal.addEventListener("abort", abort, { once: true });
      worker.once("exit", () => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        reject(new Error("The presentation reader stopped before finishing."));
      });
      worker.once("error", () => reject(new Error("This presentation is too complex to read. Try a smaller copy.")));
      worker.once("message", (result: { parts: Part[] } | { error: string }) => {
        if ("error" in result) reject(new Error(result.error));
        else resolve(result.parts);
      });
      if (signal.aborted) abort();
    });
  } finally {
    await worker.terminate();
  }
}
