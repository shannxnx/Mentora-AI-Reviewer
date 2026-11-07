import { createClient } from "@/lib/supabase/client";
import type { ReviewerRecord } from "./pdf-reviewer";

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
      snapshot,
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
