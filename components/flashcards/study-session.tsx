"use client";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, RotateCcw, Shuffle } from "lucide-react";
import { ActivityTracker } from "@/components/learning/activity-tracker";
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
  const touch = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);
  const [feedback, setFeedback] = useState("");
  const face = useRef<HTMLButtonElement>(null);
  const summary = useRef<HTMLHeadingElement>(null);
  useEffect(() => { if (finished) summary.current?.focus(); }, [finished]);
  const go = useCallback((n: number) => {
    setIndex(n);
    flip(false);
  }, []);
  function start(items: Card[]) {
    setQueue(items);
    setSession(crypto.randomUUID());
    setResults({});
    setFeedback("");
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
        setFeedback(rating === "known" ? "Got it recorded." : "Saved for another round.");
        face.current?.focus({ preventScroll: true });
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
  if (!queue.length) return <section className="fc-panel"><h2>No cards to study</h2><button onClick={onExit}>Back to deck</button></section>;
  if (finished)
    return (
      <section className="fc-panel recall-summary">
        <CheckCircle2 className="study-complete-icon" size={32} aria-hidden="true" />
        <h2 ref={summary} tabIndex={-1}>{studied === queue.length ? "Session complete" : "Session summary"}</h2>
        <p>
          {studied} of {queue.length} studied ·{" "}
          {Math.round((studied / queue.length) * 100)}% complete
        </p>
        <p>
          {studied - difficult.length} got it · {difficult.length} to study again
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
              Study these {difficult.length} again
            </button>
          )}
          <button onClick={() => start(cards)}>Restart session</button>
          <button onClick={onExit}>Back to deck</button>
        </div>
      </section>
    );
  return (
    <section className="fc-panel recall-session">
      <ActivityTracker kind="flashcards" resource={cards[0]?.deck_id ?? session} title={topics[card?.topic] ? "Flashcards · " + topics[card.topic] : "Flashcard practice"} />
      <p className="guide-kicker">Study session</p>
      <h2>{topics[card.topic]}</h2>
      <div className="recall-meta" aria-live="polite">
        <strong>Card {index + 1} of {queue.length}</strong>
        <span>{studied} completed · {queue.length - studied} remaining</span>
      </div>
      <progress max={queue.length} value={studied} aria-label="Cards completed" />
      <button ref={face} className="fc-face" type="button" aria-disabled={busy}
        aria-label={(back ? "Answer. " + card.back + ". Show question" : "Question. " + card.front + ". Reveal answer")}
        onTouchStart={e => {
          swiped.current = false;
          touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
        }}
        onTouchCancel={() => { touch.current = null; }}
        onTouchEnd={e => {
          const start = touch.current;
          touch.current = null;
          if (!start || busy || !e.changedTouches.length) return;
          const dx = e.changedTouches[0].clientX - start.x;
          const dy = e.changedTouches[0].clientY - start.y;
          if (Math.abs(dx) >= 48 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
            swiped.current = true;
            go(Math.max(0, Math.min(queue.length - 1, index + (dx < 0 ? 1 : -1))));
          }
        }}
        onClick={e => {
          if (!busy && (!swiped.current || e.detail === 0)) flip(v => !v);
          swiped.current = false;
        }}>
        <span key={card.id} className="recall-enter">
          <span className="recall-turn" data-revealed={back}>
            {(["question", "answer"] as const).map(side => <span key={side} className={"recall-side " + side} aria-hidden="true">
              <small>{side === "answer" ? "Answer" : "Question"}{card.origin === "illustration" && " · AI illustration"}</small>
              <span>{side === "answer" ? card.back : card.front}</span>
              <small className="recall-hint">{side === "answer" ? "Tap to see question" : "Tap to reveal answer"}</small>
            </span>)}
          </span>
        </span>
      </button>
      <div className="recall-ratings">
        <button disabled={busy || !back || !!results[card.id]} onClick={() => rate("learning")}><RotateCcw size={17} />Study Again</button>
        <button className="fc-primary" disabled={busy || !back || !!results[card.id]} onClick={() => rate("known")}><Check size={18} />Got It</button>
      </div>
      <div className="recall-feedback" role="status">
        <span key={studied}>{busy ? "Saving your rating…" : results[card.id] ? (results[card.id].rating === "known" ? "Marked Got It" : "Marked Study Again") : feedback}</span>
      </div>
      <div className="recall-navigation">
        <button disabled={busy || index === 0} onClick={() => go(index - 1)}><ArrowLeft size={16} />Previous</button>
        <button disabled={busy || queue.length < 2} onClick={() => { setQueue(shuffled(queue)); go(0); }}><Shuffle size={16} />Shuffle</button>
        <button disabled={busy || index === queue.length - 1} onClick={() => go(index + 1)}>Next<ArrowRight size={16} /></button>
      </div>
      <p className="recall-help"><span>Space to flip · ← → to move · 1 Study Again · 2 Got It</span><span>Swipe left or right to move between cards.</span></p>
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
