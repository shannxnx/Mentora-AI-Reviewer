import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { parseStoredReviewer } from "@/lib/reviewer/pdf-reviewer";
import { generateCards } from "@/lib/flashcards/generate";
import { sourceTopics, validSettings } from "@/lib/flashcards/model";

export const maxDuration = 90;
const fail = (error: string, status: number) =>
  Response.json({ error }, { status });
export async function POST(request: Request) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return fail("Sign in to generate flashcards.", 401);
  const input = await request.json().catch(() => null);
  if (typeof input?.reviewerId !== "string")
    return fail("Select a saved reviewer.", 400);
  const { data: guide, error } = await db
    .from("study_reviewers")
    .select("id,snapshot")
    .eq("id", input.reviewerId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (error || !guide)
    return fail("Reviewer unavailable for this account.", 404);
  const record = parseStoredReviewer(JSON.stringify(guide.snapshot));
  if (!record) return fail("The saved reviewer could not be read.", 422);
  if (
    input.cardId !== undefined &&
    (typeof input.cardId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(input.cardId) ||
      !Number.isSafeInteger(input.revision))
  )
    return fail("Choose a valid card revision.", 400);
  const all = sourceTopics(record);
  const s = input.settings;
  if (!validSettings(s, all.length))
    return fail("Check your topic selection and generation settings.", 400);
  const settings = {
    count: s.count,
    difficulty: s.difficulty,
    style: s.style,
    length: s.length,
    topics: [...s.topics].sort((a, b) => a - b),
  };
  const key = createHash("sha256")
    .update(JSON.stringify(settings))
    .digest("hex");
  const job = [guide.id, key, input.cardId ?? "", input.revision ?? ""].join(
    "/",
  );
  const token = randomUUID();
  const { data: claimed, error: claimError } = await db.rpc("study_claim", {
    p_key: job,
    p_token: token,
  });
  if (claimError || !claimed)
    return fail(
      claimError
        ? "Generation could not start."
        : "This deck is already being generated.",
      claimError ? 503 : 409,
    );
  try {
    let exclude: string[] = [];
    if (input.cardId) {
      const { data: card } = await db
        .from("study_cards")
        .select("id,deck_id,revision,topic,study_decks!inner(reviewer_id)")
        .eq("id", input.cardId)
        .eq("study_decks.reviewer_id", guide.id)
        .maybeSingle();
      if (
        !card ||
        card.revision !== input.revision ||
        settings.count !== 1 ||
        settings.topics.length !== 1 ||
        settings.topics[0] !== card.topic
      )
        return fail("This card changed. Refresh the deck.", 409);
      const { data: others, error: listError } = await db
        .from("study_cards")
        .select("front")
        .eq("deck_id", card.deck_id);
      if (listError) return fail("Could not read existing cards.", 503);
      exclude = (others ?? []).map((c) => c.front);
    } else {
      const { data: existing, error: readError } = await db
        .from("study_decks")
        .select("id")
        .eq("reviewer_id", guide.id)
        .eq("settings_key", key)
        .maybeSingle();
      if (readError) return fail("Could not read existing decks.", 503);
      if (existing) return Response.json({ deckId: existing.id, reused: true });
    }
    if (!process.env.GEMINI_API_KEY)
      return fail("Flashcard generation is not configured.", 503);
    const cards = await generateCards(
      all.filter((t) => settings.topics.includes(t.index)),
      settings,
      exclude,
    );
    if (!cards.length)
      return fail(
        "No new cards had sufficient supporting material. Try another topic.",
        422,
      );
    const { data: deckId, error: saveError } = await db.rpc("study_finish", {
      p_reviewer: guide.id,
      p_key: job,
      p_token: token,
      p_settings: key,
      p_title: record.reviewer.title,
      p_cards: cards,
      p_replace: input.cardId ?? null,
      p_revision: input.revision ?? null,
    });
    if (saveError)
      return fail(
        "Could not save the generated cards. Reopen the deck and retry.",
        409,
      );
    return Response.json({ deckId, count: cards.length });
  } catch (cause) {
    const status =
      typeof cause === "object" && cause !== null && "status" in cause
        ? cause.status
        : undefined;
    if (status === 429 || status === 503)
      return fail(
        "The AI service is busy. Wait a moment and try again. Your saved cards are safe.",
        status,
      );
    console.error("Flashcard generation failed", {
      status,
      kind: cause instanceof SyntaxError ? "invalid JSON" : "provider error",
    });
    return fail(
      "Flashcards could not be generated. Your existing cards are safe. Please try again.",
      502,
    );
  } finally {
    await db.rpc("study_release", { p_key: job, p_token: token });
  }
}
