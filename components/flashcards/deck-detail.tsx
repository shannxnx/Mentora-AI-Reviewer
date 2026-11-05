"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  settingsFor,
  sourceTopics,
  type Card,
  type Deck,
  type SavedGuide,
} from "@/lib/flashcards/model";
import { StudySession } from "./study-session";

export async function requestDeck(data: object) {
  const response = await fetch("/api/flashcards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.deckId)
    throw new Error(
      result?.error || "Could not generate cards. Sign in and try again.",
    );
  return result.deckId as string;
}
export type Run = (task: () => Promise<void>) => void;
export function DeckDetail({
  deck,
  guide,
  cards,
  busy,
  run,
  close,
  openGuide,
}: {
  deck: Deck;
  guide: SavedGuide;
  cards: Card[];
  busy: boolean;
  run: Run;
  close: () => void;
  openGuide: () => void;
}) {
  const db = createClient();
  const topics = sourceTopics(guide.snapshot);
  const [session, setSession] = useState<Card[] | null>(null);
  const [editing, setEditing] = useState<Card | "new" | null>(null);
  const [front, setFront] = useState(""),
    [back, setBack] = useState(""),
    [topic, setTopic] = useState(0);
  const [title, setTitle] = useState(deck.title);
  const due = cards.filter((c) => Date.parse(c.due_at) <= Date.now());
  function edit(card: Card | "new") {
    setEditing(card);
    setFront(card === "new" ? "" : card.front);
    setBack(card === "new" ? "" : card.back);
    setTopic(card === "new" ? 0 : card.topic);
  }
  if (session)
    return (
      <StudySession
        cards={session}
        topics={topics.map((t) => t.heading)}
        onExit={() => {
          setSession(null);
          run(async () => {});
        }}
      />
    );
  return (
    <section className="fc-panel">
      <button onClick={close}>All decks</button>
      <p className="guide-kicker">Flashcard deck</p>
      <h2>{deck.title}</h2>
      <p>
        {cards.length} cards · {new Set(cards.map((c) => c.topic)).size} topics
        · {due.length} due or new
      </p>
      <button onClick={openGuide}>
        Read reviewer · {guide.snapshot.reviewer.title}
      </button>
      <div className="fc-actions">
        <button
          disabled={!cards.length || busy}
          onClick={() =>
            setSession(
              [...cards].sort((a, b) => a.due_at.localeCompare(b.due_at)),
            )
          }
        >
          Study all
        </button>
        <button
          disabled={!due.length || busy}
          onClick={() =>
            setSession(
              [...due].sort((a, b) => a.due_at.localeCompare(b.due_at)),
            )
          }
        >
          Study due cards
        </button>
      </div>
      <details>
        <summary>Rename deck</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const { error } = await db
                .from("study_decks")
                .update({ title: title.trim() })
                .eq("id", deck.id);
              if (error) throw error;
            });
          }}
        >
          <label>
            Deck name
            <input
              required
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <button disabled={busy}>Save name</button>
        </form>
      </details>
      <h3>Cards</h3>
      <button disabled={busy} onClick={() => edit("new")}>
        Add a card
      </button>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const query =
                editing === "new"
                  ? db.from("study_cards").insert({
                      deck_id: deck.id,
                      topic,
                      front: front.trim(),
                      back: back.trim(),
                      origin: "student",
                    })
                  : db
                      .from("study_cards")
                      .update({ front: front.trim(), back: back.trim() })
                      .eq("id", editing.id)
                      .eq("revision", editing.revision);
              const { error } = await query.select("id").single();
              if (error) throw error;
              setEditing(null);
            });
          }}
        >
          <label>
            Topic
            <select
              disabled={editing !== "new"}
              value={topic}
              onChange={(e) => setTopic(Number(e.target.value))}
            >
              {topics.map((t) => (
                <option key={t.index} value={t.index}>
                  {t.heading}
                </option>
              ))}
            </select>
          </label>
          <label>
            Question
            <textarea
              aria-label="Question"
              required
              maxLength={2000}
              value={front}
              onChange={(e) => setFront(e.target.value)}
            />
          </label>
          <label>
            Answer
            <textarea
              aria-label="Answer"
              required
              maxLength={3000}
              value={back}
              onChange={(e) => setBack(e.target.value)}
            />
          </label>
          <button disabled={busy}>Save card</button>
          <button type="button" onClick={() => setEditing(null)}>
            Cancel
          </button>
        </form>
      )}
      {cards.map((c) => (
        <details key={c.id}>
          <summary>{c.front}</summary>
          <p className="fc-text">{c.back}</p>
          <small>
            {topics[c.topic]?.heading} ·{" "}
            {c.origin === "illustration"
              ? "AI illustration"
              : c.origin === "student"
                ? "Student card"
                : "From reviewer"}
          </small>
          {c.evidence && <blockquote>{c.evidence}</blockquote>}
          <div className="fc-actions">
            <button disabled={busy} onClick={() => edit(c)}>
              Edit
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await requestDeck({
                    reviewerId: guide.id,
                    cardId: c.id,
                    revision: c.revision,
                    settings: { ...settingsFor([c.topic]), count: 1 },
                  });
                })
              }
            >
              Regenerate this card
            </button>
            <button
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    "Delete this card? Past study activity will be kept.",
                  )
                )
                  run(async () => {
                    const { error } = await db
                      .from("study_cards")
                      .delete()
                      .eq("id", c.id)
                      .eq("revision", c.revision)
                      .select("id")
                      .single();
                    if (error) throw error;
                  });
              }}
            >
              Delete
            </button>
          </div>
        </details>
      ))}
    </section>
  );
}
