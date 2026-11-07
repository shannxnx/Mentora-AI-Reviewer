import { randomUUID } from "node:crypto";
import {
  account,
  body,
  failure,
  json,
  RequestError,
} from "@/lib/practice/server";
import { generateTest } from "@/lib/practice/ai";
import { seal } from "@/lib/practice/crypto";
import { isUuid, validSettings } from "@/lib/practice/model";
import { parseStoredReviewer } from "@/lib/reviewer/pdf-reviewer";
import type { SavedGuide } from "@/lib/flashcards/model";

export const maxDuration = 90;
export async function GET(request: Request) {
  try {
    const { db, user } = await account();
    const page = Math.max(
      0,
      Math.min(
        10000,
      Math.floor(Number(new URL(request.url).searchParams.get("page")) || 0),
      ),
    );
    const { error: expireError } = await db.rpc("practice_expire");
    if (expireError) throw expireError;
    const [subjects, guides, tests, attempts] = await Promise.all([
      db
        .from("study_subjects")
        .select("id,name")
        .eq("owner_id", user.id)
        .order("name"),
      db
        .from("study_reviewers")
        .select("id,subject_id,file_name")
        .eq("owner_id", user.id)
        .order("file_name"),
      db
        .from("practice_tests")
        .select("id,title,subject_id,subject_name,settings,created_at")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("practice_attempts")
        .select(
          "id,test_id,status,started_at,expires_at,submitted_at,score,practice_tests(title,subject_name)",
        )
        .eq("owner_id", user.id)
        .order("started_at", { ascending: false })
        .range(page * 20, page * 20 + 20),
    ]);
    for (const result of [subjects, guides, tests, attempts])
      if (result.error) throw result.error;
    return json({
      subjects: subjects.data,
      guides: guides.data,
      tests: tests.data,
      attempts: attempts.data!.slice(0, 20),
      more: attempts.data!.length > 20,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { db, user } = await account(),
      input = await body(request);
    if (
      !isUuid(input.subjectId) ||
      !validSettings(input.settings) ||
      !Array.isArray(input.reviewerIds) ||
      input.reviewerIds.length < 1 ||
      input.reviewerIds.length > 5 ||
      !input.reviewerIds.every(isUuid) ||
      new Set(input.reviewerIds).size !== input.reviewerIds.length
    )
      throw new RequestError(
        "Select a subject, one to five reviewers, and valid test settings.",
      );
    const [{ data: subject, error: subjectError }, { data, error }] =
      await Promise.all([
        db
          .from("study_subjects")
          .select("id,name")
          .eq("id", input.subjectId)
          .eq("owner_id", user.id)
          .single(),
        db
          .from("study_reviewers")
          .select("id,subject_id,file_name,folder,snapshot")
          .eq("subject_id", input.subjectId)
          .eq("owner_id", user.id)
          .in("id", input.reviewerIds),
      ]);
    if (
      error ||
      subjectError ||
      !subject ||
      data?.length !== input.reviewerIds.length
    )
      throw new RequestError("Some selected material is unavailable.", 404);
    const guides = data.map((g) => ({
      ...g,
      snapshot: parseStoredReviewer(JSON.stringify(g.snapshot)),
    }));
    if (guides.some((g) => !g.snapshot))
      throw new RequestError("A saved reviewer could not be read.", 422);
    const token = randomUUID(),
      job = "practice-generate";
    const claim = await db.rpc("study_claim", { p_key: job, p_token: token });
    if (claim.error) throw claim.error;
    if (!claim.data)
      throw new RequestError(
        "A test is already being generated. Please wait.",
        409,
      );
    try {
      const keys = await generateTest(guides as SavedGuide[], input.settings),
        encrypted = seal(keys);
      const questions = keys.map(
        ({ id, type, prompt, options, topic, topicKey, reviewerId }) => ({
          id,
          type,
          prompt,
          options,
          topic,
          topicKey,
          reviewerId,
        }),
      );
      const { data: test, error: saveError } = await db
        .from("practice_tests")
        .insert({
          subject_id: subject.id,
          subject_name: subject.name,
          title: subject.name + " · Practice test",
          settings: input.settings,
          questions,
          ...encrypted,
        })
        .select("id")
        .single();
      if (saveError) throw saveError;
      return json({ testId: test.id, count: keys.length });
    } finally {
      await db.rpc("study_release", { p_key: job, p_token: token });
    }
  } catch (e) {
    return failure(e);
  }
}
