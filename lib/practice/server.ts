import "server-only";
import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { unseal } from "./crypto";
import { gradeTest } from "./ai";
import type { Attempt } from "./model";

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function account() {
  const db = await createClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new RequestError("Sign in to continue.", 401);
  return { db, user };
}
export function failure(error: unknown) {
  if (error instanceof RequestError)
    return json({ error: error.message }, error.status);
  if (
    error instanceof Error &&
    /^(The source|The generated|Your answers|Practice tests are not configured|AI generation)/.test(
      error.message,
    )
  )
    return json({ error: error.message }, 503);
  console.error("Mentora request failed", {
    kind: error instanceof Error ? error.name : "database",
    code:
      typeof error === "object" && error && "code" in error
        ? error.code
        : undefined,
  });
  return json(
    {
      error:
        "Could not complete this request. Your saved work is safe. Please try again.",
    },
    503,
  );
}
export async function body(request: Request) {
  const raw = await request.text();
  if (raw.length > 300000)
    throw new RequestError("This request is too large.", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new RequestError("Invalid request.");
  }
}
export async function finishAttempt(
  db: Awaited<ReturnType<typeof createClient>>,
  owner: string,
  attempt: Attempt,
) {
  if (attempt.status !== "submitted") return attempt;
  const token = randomUUID(),
    job = "practice-grade/" + attempt.id;
  const { data: claimed, error: claimError } = await db.rpc("study_claim", {
    p_key: job,
    p_token: token,
  });
  if (claimError) throw claimError;
  if (!claimed)
    throw new RequestError(
      "Your answers are saved and grading is in progress. Try again shortly.",
      409,
    );
  try {
    const { data: latest, error: readError } = await db
      .from("practice_attempts")
      .select("*")
      .eq("id", attempt.id)
      .eq("owner_id", owner)
      .single();
    if (readError) throw readError;
    if (latest.status === "graded") return latest as Attempt;
    const { data: test, error } = await db
      .from("practice_tests")
      .select("encrypted_key")
      .eq("id", attempt.test_id)
      .eq("owner_id", owner)
      .single();
    if (error) throw error;
    const key = unseal(test.encrypted_key);
    const result = await gradeTest(key.keys, latest.answers);
    const { data: saved, error: saveError } = await db.rpc("practice_finish", {
      p_attempt: attempt.id,
      p_token: key.token,
      p_result: result,
    });
    if (saveError) throw saveError;
    return saved as Attempt;
  } finally {
    await db.rpc("study_release", { p_key: job, p_token: token });
  }
}
