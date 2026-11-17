import { createClient } from "@/lib/supabase/client";
import { parseReviewerRecord } from "@/lib/reviewer/pdf-reviewer";
import type { Card, SavedGuide } from "./model";

export async function allPages<T>(
  page: (start: number, end: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await page(start, start + 499);
    if (error) throw error;
    if (!data) throw new Error("The study library could not be loaded.");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export function loadSubjects(owner: string, signal: AbortSignal) {
  const db = createClient();
  return allPages((start, end) => db.from("study_subjects").select("id,name,enrolled_by")
    .eq("owner_id", owner).order("name").order("id").range(start, end).abortSignal(signal));
}

// Counts travel with the directory query; full reviewer content is loaded only when opened.
export async function loadSubjectDirectory(owner: string, signal: AbortSignal) {
  const db = createClient();
  const rows = await allPages((start, end) => db.from("study_subjects")
    .select("id,name,enrolled_by,reviewers:study_reviewers(count)")
    .eq("owner_id", owner).order("name").order("id").range(start, end).abortSignal(signal));
  return rows.map(row => ({
    id: row.id, name: row.name, enrolled_by: row.enrolled_by,
    reviewerCount: row.reviewers[0]?.count ?? 0,
  }));
}

export async function loadSubjectLibrary(owner: string, subject: string, signal: AbortSignal) {
  const db = createClient();
  const now = new Date().toISOString();
  const [guides, decks, recent] = await Promise.all([
    allPages((start, end) => db.from("study_reviewers").select("id,file_name,folder,title:snapshot->reviewer->>title")
      .eq("owner_id", owner).eq("subject_id", subject).order("id").range(start, end).abortSignal(signal)),
    allPages((start, end) => db.from("study_decks")
      .select("id,title,reviewer_id,settings_key,study_reviewers!inner(subject_id),cards:study_cards(count),due:study_cards(count),known:study_cards(count)")
      .eq("owner_id", owner).eq("study_reviewers.subject_id", subject)
      .lte("due.due_at", now).eq("known.last_rating", "known").order("id").range(start, end).abortSignal(signal)),
    db.from("study_reviews").select("deck_id").eq("owner_id", owner)
      .order("reviewed_at", { ascending: false }).limit(30).abortSignal(signal),
  ]);
  if (recent.error) throw recent.error;
  return { guides, decks: decks.map(d => ({
    id: d.id, title: d.title, reviewer_id: d.reviewer_id, settings_key: d.settings_key,
    count: d.cards[0]?.count ?? 0, due: d.due[0]?.count ?? 0, known: d.known[0]?.count ?? 0,
  })), recent: recent.data };
}

export async function loadGuide(owner: string, subject: string, id: string, signal: AbortSignal): Promise<SavedGuide> {
  const { data, error } = await createClient().from("study_reviewers").select("id,subject_id,file_name,folder,snapshot")
    .eq("owner_id", owner).eq("subject_id", subject).eq("id", id).abortSignal(signal).single();
  if (error) throw error;
  const snapshot = parseReviewerRecord(data.snapshot);
  if (!snapshot) throw new Error("This saved reviewer could not be read.");
  return { ...data, snapshot };
}

export function loadDeckCards(owner: string, deck: string, signal: AbortSignal): Promise<Card[]> {
  const db = createClient();
  return allPages((start, end) => db.from("study_cards")
    .select("id,deck_id,topic,front,back,evidence,origin,revision,due_at,last_rating")
    .eq("owner_id", owner).eq("deck_id", deck).order("id").range(start, end).abortSignal(signal));
}
