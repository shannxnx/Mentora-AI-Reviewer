import {
  account,
  body,
  failure,
  finishAttempt,
  json,
  RequestError,
} from "@/lib/practice/server";
import { isUuid, type Attempt } from "@/lib/practice/model";
export const maxDuration = 90;

export async function GET(request: Request) {
  try {
    const { db, user } = await account(),
      id = new URL(request.url).searchParams.get("id");
    if (!isUuid(id)) throw new RequestError("Select a test attempt.");
    const expired = await db.rpc("practice_expire");
    if (expired.error) throw expired.error;
    const { data, error } = await db
      .from("practice_attempts")
      .select("*")
      .eq("id", id)
      .eq("owner_id", user.id)
      .single();
    if (error) throw new RequestError("This attempt is unavailable.", 404);
    const attempt = await finishAttempt(db, user.id, data as Attempt);
    const { data: test, error: testError } = await db
      .from("practice_tests")
      .select("id,title,subject_id,subject_name,settings,questions,created_at")
      .eq("id", attempt.test_id)
      .eq("owner_id", user.id)
      .single();
    if (testError) throw testError;
    return json({ attempt, test, serverTime: Date.now() });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db } = await account(),
      input = await body(request);
    if (!isUuid(input.testId)) throw new RequestError("Select a test.");
    const { data, error } = await db.rpc("practice_start", {
      p_test: input.testId,
    });
    if (error) throw error;
    return json({ attemptId: data.id });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request) {
  try {
    const { db, user } = await account(),
      input = await body(request);
    if (
      !isUuid(input.id) ||
      !Number.isSafeInteger(input.revision) ||
      input.revision < 0 ||
      !input.answers ||
      typeof input.answers !== "object" ||
      Array.isArray(input.answers) ||
      !Object.values(input.answers).every(
        (v) => typeof v === "string" && v.length <= 4000,
      ) ||
      typeof input.submit !== "boolean"
    )
      throw new RequestError("Invalid answers.");
    const { data, error } = await db.rpc("practice_save", {
      p_attempt: input.id,
      p_revision: input.revision,
      p_answers: input.answers,
      p_submit: input.submit,
    });
    if (error?.code === "40001")
      throw new RequestError(
        "This attempt changed in another tab. Reload to continue.",
        409,
      );
    if (error) throw error;
    const attempt = await finishAttempt(db, user.id, data as Attempt);
    return json({ attempt, serverTime: Date.now() });
  } catch (e) {
    return failure(e);
  }
}
