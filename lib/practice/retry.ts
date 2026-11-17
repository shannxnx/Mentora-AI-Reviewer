import "server-only";
import { randomUUID } from "node:crypto";
import { seal, unseal } from "./crypto";
import { RequestError, type account } from "./server";
import type { TestResult, TestSettings } from "./model";
import { publicQuestions } from "./model";

type Database = Awaited<ReturnType<typeof account>>["db"];

export async function missedQuestionTest(db: Database, owner: string, attemptId: string) {
  const { data: attempt, error } = await db.from("practice_attempts").select("test_id,result")
    .eq("owner_id", owner).eq("id", attemptId).eq("status", "graded").maybeSingle();
  if (error) throw error;
  if (!attempt?.result) throw new RequestError("Choose a completed attempt.", 404);
  const missed = new Set((attempt.result as TestResult).items.filter(item => item.points < 1).map(item => item.id));
  if (!missed.size) throw new RequestError("You answered every question correctly.");
  const { data: test, error: testError } = await db.from("practice_tests")
    .select("subject_id,subject_name,settings,encrypted_key").eq("id", attempt.test_id).eq("owner_id", owner).single();
  if (testError) throw testError;
  const keys = unseal(test.encrypted_key).keys.filter(q => missed.has(q.id));
  if (!keys.length) throw new RequestError("There are no questions to retry.");
  const settings: TestSettings = {
    ...test.settings, count: keys.length, types: [...new Set(keys.map(q => q.type))], minutes: null,
  };
  const job = "practice-retry/" + attemptId;
  const token = randomUUID();
  const claim = await db.rpc("study_claim", { p_key: job, p_token: token });
  if (claim.error) throw claim.error;
  if (!claim.data) throw new RequestError("Your retry is being prepared. Try again in a moment.", 409);
  try {
    const existing = await db.from("practice_tests").select("id").eq("owner_id", owner)
      .eq("settings->>retryOf", attemptId).limit(1).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return existing.data.id;
    const { data, error } = await db.from("practice_tests").insert({
      subject_id: test.subject_id, subject_name: test.subject_name,
      title: test.subject_name + " · Missed questions", settings: { ...settings, retryOf: attemptId },
      questions: publicQuestions(keys), ...seal(keys),
    }).select("id").single();
    if (error) throw error;
    return data.id;
  } finally {
    await db.rpc("study_release", { p_key: job, p_token: token });
  }
}
