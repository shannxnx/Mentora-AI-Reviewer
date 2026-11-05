"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Card } from "@/lib/flashcards/model";

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
type Rating = "known" | "learning";
type Result = { rating: Rating; due: string };
export function StudySession({
  cards,
  topics,
  onExit,
}: {
  cards: Card[];
  topics: string[];
  onExit: () => void;
}) {
  const [queue, setQueue] = useState(cards);
  const [index, setIndex] = useState(0);
  const [session, setSession] = useState(() => crypto.randomUUID());
  const [results, setResults] = useState<Record<string, Result>>({});
  const [back, flip] = useState(false);
  const [finished, finish] = useState(false);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState("");
  const card = queue[index];
  const go = useCallback((n: number) => {
    setIndex(n);
    flip(false);
  }, []);
  function start(items: Card[]) {
    setQueue(items);
    setSession(crypto.randomUUID());
    setResults({});
    go(0);
    finish(false);
    setError("");
  }
  const rate = useCallback(
    async (rating: Rating) => {
      if (locked.current || !back || !card || results[card.id]) return;
      locked.current = true;
      setBusy(true);
      setError("");
      try {
        const { data, error } = await createClient().rpc("study_rate", {
          p_card: card.id,
          p_session: session,
          p_revision: card.revision,
          p_rating: rating,
        });
        if (error) throw error;
        const next = { ...results, [card.id]: { rating, due: String(data) } };
        setResults(next);
        for (let offset = 1; offset <= queue.length; offset++) {
          const i = (index + offset) % queue.length;
          if (!next[queue[i].id]) {
            go(i);
            return;
          }
        }
        finish(true);
      } catch {
        setError(
          "Your rating could not be saved. Retry, or reopen the deck if the card was changed.",
        );
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [back, card, results, session, queue, index, go],
  );
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (
        finished ||
        busy ||
        e.repeat ||
        e.altKey ||
        e.ctrlKey ||
        e.metaKey ||
        target.isContentEditable ||
        target.closest("input,textarea,select,a,[role=dialog]") ||
        (e.key === " " && target.closest("button")) ||
        (target.closest("button") && !target.closest(".fc-panel"))
      )
        return;
      if (![" ", "ArrowLeft", "ArrowRight", "1", "2"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === " ") flip((v) => !v);
      if (e.key === "ArrowLeft") go(Math.max(0, index - 1));
      if (e.key === "ArrowRight") go(Math.min(queue.length - 1, index + 1));
      if (e.key === "1" || e.key === "2")
        void rate(e.key === "1" ? "learning" : "known");
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [busy, finished, index, queue.length, go, rate]);
  const studied = Object.keys(results).length;
  const difficult = queue.filter((c) => results[c.id]?.rating === "learning");
  const nextDue = Object.values(results)
    .map((r) => r.due)
    .sort()[0];
  if (finished)
    return (
      <section className="fc-panel">
        <p className="guide-kicker">Session summary</p>
        <h2>Your recall this session</h2>
        <p>
          {studied} of {queue.length} studied ·{" "}
          {Math.round((studied / queue.length) * 100)}% complete
        </p>
        <p>
          {studied - difficult.length} marked Known · {difficult.length} marked
          Still Learning
        </p>
        {difficult.length > 0 && (
          <p>
            Topics to revisit ·{" "}
            {[...new Set(difficult.map((c) => topics[c.topic]))].join(", ")}
          </p>
        )}
        {nextDue && (
          <p>
            Next recommended review · {new Date(nextDue).toLocaleDateString()}
          </p>
        )}
        <div className="fc-actions">
          {!!difficult.length && (
            <button onClick={() => start(difficult)}>
              Retry Still Learning
            </button>
          )}
          <button onClick={() => start(cards)}>Restart session</button>
          <button onClick={onExit}>Back to deck</button>
        </div>
      </section>
    );
  return (
    <section className="fc-panel">
      <p className="guide-kicker">Study session</p>
      <h2>{topics[card.topic]}</h2>
      <p aria-live="polite">
        Card {index + 1} of {queue.length} · {studied} reviewed
      </p>
      <progress
        max={queue.length}
        value={studied}
        aria-label="Cards reviewed"
      />
      <button
        className="fc-face"
        type="button"
        disabled={busy}
        aria-label={back ? "Show question" : "Reveal answer"}
        onClick={() => flip(!back)}
      >
        <span key={card.id + String(back)} className="fc-face-content">
          <small>
            {back ? "Answer" : "Question"}
            {card.origin === "illustration" ? " · AI illustration" : ""}
          </small>
          <span>{back ? card.back : card.front}</span>
        </span>
      </button>
      <div className="fc-actions">
        <button disabled={busy || index === 0} onClick={() => go(index - 1)}>
          Previous
        </button>
        <button disabled={busy} onClick={() => flip(!back)}>
          Flip
        </button>
        <button
          disabled={busy || index === queue.length - 1}
          onClick={() => go(index + 1)}
        >
          Next
        </button>
        <button
          disabled={busy || queue.length < 2}
          onClick={() => {
            setQueue(shuffled(queue));
            go(0);
          }}
        >
          Shuffle
        </button>
      </div>
      <div className="fc-actions">
        <button
          disabled={busy || !back || !!results[card.id]}
          onClick={() => rate("learning")}
        >
          1 · Still Learning
        </button>
        <button
          disabled={busy || !back || !!results[card.id]}
          onClick={() => rate("known")}
        >
          2 · Known
        </button>
      </div>
      <p>
        Space flips the card. Arrow keys navigate. Reveal the answer before
        rating your recall.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="fc-actions">
        <button disabled={busy} onClick={() => finish(true)}>
          End session
        </button>
        <button disabled={busy} onClick={() => start(cards)}>
          Restart session
        </button>
      </div>
    </section>
  );
}
