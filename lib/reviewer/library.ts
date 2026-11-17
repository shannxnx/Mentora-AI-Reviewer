import { createClient } from "@/lib/supabase/client";
import { parseReviewerRecord, type ReviewerRecord } from "./pdf-reviewer";
import type { StudyDepth } from "./study-guide";

export async function findSavedReviewer(owner: string, hash: string, depth: StudyDepth, signal: AbortSignal) {
  const lookup = typeof AbortSignal.any === "function"
    ? AbortSignal.any([signal, AbortSignal.timeout(2500)])
    : signal;
  const { data } = await createClient().from("study_reviewers").select("snapshot")
    .eq("owner_id", owner).eq("snapshot->>sourceHash", hash).eq("snapshot->>depth", depth)
    .order("id").limit(1).abortSignal(lookup).maybeSingle();
  return data ? parseReviewerRecord(data.snapshot) : null;
}


export async function saveReviewerToLibrary(
  record: ReviewerRecord,
  subjectId: string,
  folder: string | null = null,
) {
  const snapshot = {
    fileName: record.fileName,
    size: record.size,
    reviewer: record.reviewer,
  };
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify(snapshot)),
  );
  const fingerprint = Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const db = createClient();
  let { data, error } = await db
    .from("study_reviewers")
    .insert({
      subject_id: subjectId,
      // Keep the original fingerprint stable for records saved before PDF reuse.
      snapshot: { ...snapshot, sourceHash: record.sourceHash, depth: record.depth },
      file_name: record.fileName,
      fingerprint,
      folder,
    })
    .select("id")
    .single();
  if (error?.code === "23505")
    ({ data, error } = await db
      .from("study_reviewers")
      .select("id")
      .eq("subject_id", subjectId)
      .eq("fingerprint", fingerprint)
      .single());
  if (error || !data)
    throw new Error("Could not save the reviewer. Please try again.");
  return data.id as string;
}
