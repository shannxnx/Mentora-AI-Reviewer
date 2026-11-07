"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock3, RotateCcw } from "lucide-react";
import {
  typeLabels,
  topicInsights,
  type Attempt,
  type PracticeTest,
} from "@/lib/practice/model";
import { requestJson } from "@/lib/learning/http";
import { ActivityTracker } from "@/components/learning/activity-tracker";

type Payload = { attempt: Attempt; test: PracticeTest; serverTime: number };
export function AttemptView({ id }: { id: string }) {
  const [data, setData] = useState<Payload | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await requestJson<Payload>("/api/practice/attempt?id=" + id));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!data)
    return (
      <section className="learning-card">
        <Link className="text-link" href="/dashboard/practice">
          <ArrowLeft size={16} /> Practice tests
        </Link>
        <p role={error ? "alert" : "status"}>
          {error || "Opening your test and checking saved progress…"}
        </p>
        {error && (
          <button className="learning-button" onClick={() => void load()}>
            Retry
          </button>
        )}
      </section>
    );
  return data.attempt.status === "graded" ? (
    <Results data={data} />
  ) : (
    <TestRunner
      initial={data}
      onComplete={(attempt) => setData((d) => d && { ...d, attempt })}
    />
  );
}
function TestRunner({
  initial,
  onComplete,
}: {
  initial: Payload;
  onComplete: (a: Attempt) => void;
}) {
  const { test } = initial;
  const [answers, setAnswers] = useState(initial.attempt.answers),
    [index, setIndex] = useState(0),
    [status, setStatus] = useState("All changes saved");
  const [error, setError] = useState(""),
    [submitting, setSubmitting] = useState(false),
    [confirm, setConfirm] = useState(false),
    [remaining, setRemaining] = useState<number | null>(null);
  const current = useRef(initial.attempt),
    draft = useRef(initial.attempt.answers),
    serial = useRef(Promise.resolve()),
    changed = useRef(false),
    mounted = useRef(true),
    expired = useRef(false),
    blocked = useRef(false);
  const offset = useRef(initial.serverTime - Date.now());
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const save = useCallback(
    (submit = false) => {
      const operation = serial.current
        .catch(() => {})
        .then(async () => {
          if (
            current.current.status === "graded" ||
            blocked.current ||
            (!submit && !changed.current)
          )
            return;
          const snapshot = draft.current;
          if (mounted.current) {
            setStatus(submit ? "Submitting and grading…" : "Saving…");
            setError("");
          }
          try {
            const payload = await requestJson<{
              attempt: Attempt;
              serverTime: number;
            }>("/api/practice/attempt", {
              method: "PATCH",
              body: JSON.stringify({
                id: current.current.id,
                revision: current.current.revision,
                answers: snapshot,
                submit,
              }),
            });
            current.current = payload.attempt;
            offset.current = payload.serverTime - Date.now();
            changed.current = draft.current !== snapshot;
            if (mounted.current) {
              setStatus(
                changed.current ? "Unsaved changes" : "All changes saved",
              );
              if (payload.attempt.status === "graded")
                onComplete(payload.attempt);
            }
          } catch (e) {
            if (mounted.current) {
              setError((e as Error).message);
              setStatus("Save needs attention");
            }
            if (/another tab/.test((e as Error).message))
              blocked.current = true;
            throw e;
          }
        });
      serial.current = operation;
      return operation;
    },
    [onComplete],
  );
  const submit = useCallback(async () => {
    if (mounted.current) {
      setSubmitting(true);
      setConfirm(false);
    }
    try {
      await save(true);
    } catch {
      /* Retry remains available; saved answers are frozen by the server. */
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }, [save]);
  useEffect(() => {
    if (!changed.current) return;
    const timer = setTimeout(() => {
      void save().catch(() => {});
    }, 650);
    return () => clearTimeout(timer);
  }, [answers, save]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (changed.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  useEffect(() => {
    if (!initial.attempt.expires_at) return;
    const tick = () => {
      const left = Math.max(
        0,
        Math.ceil(
          (Date.parse(initial.attempt.expires_at!) -
            Date.now() -
            offset.current) /
            1000,
        ),
      );
      setRemaining(left);
      if (!left && !expired.current) {
        expired.current = true;
        void submit();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [initial.attempt.expires_at, submit]);
  const q = test.questions[index],
    answered = Object.values(answers).filter((a) => a.trim()).length;
  function change(value: string) {
    draft.current = { ...draft.current, [q.id]: value };
    changed.current = true;
    setAnswers(draft.current);
    setStatus("Unsaved changes");
  }
  async function leave() {
    try {
      await save();
      if (!changed.current) window.location.assign("/dashboard/practice");
    } catch {}
  }
  return (
    <div className="learning-page">
      <ActivityTracker
        kind="test"
        resource={initial.attempt.id}
        title={test.title}
      />
      <div className="test-topbar">
        <button
          className="text-button"
          disabled={submitting}
          onClick={() => void leave()}
        >
          <ArrowLeft size={16} /> Save & exit
        </button>
        <span role="status">{status}</span>
        <span
          className={
            remaining !== null && remaining < 60 ? "timer urgent" : "timer"
          }
        >
          <Clock3 size={17} />
          {remaining === null
            ? "Untimed"
            : Math.floor(remaining / 60) +
              ":" +
              String(remaining % 60).padStart(2, "0")}
        </span>
      </div>
      <header className="learning-heading">
        <div>
          <p className="learning-eyebrow">
            {test.subject_name} / {test.settings.difficulty.toUpperCase()}
          </p>
          <h1>{test.title}</h1>
          <p>
            {answered} of {test.questions.length} answered
            {initial.attempt.expires_at
              ? " · Your timer continues if you leave."
              : " · Take your time. You can come back later."}
          </p>
        </div>
      </header>
      {error && (
        <div className="learning-notice error" role="alert">
          {error}
          <div className="button-row">
            <button
              className="small-button"
              disabled={submitting}
              onClick={() => void submit()}
            >
              Retry submission
            </button>
            <button
              className="small-button"
              onClick={() => window.location.reload()}
            >
              Reload saved attempt
            </button>
          </div>
        </div>
      )}
      <div className="test-layout">
        <section className="learning-card question-card">
          <div className="section-heading">
            <span className="learning-tag">
              Question {index + 1} of {test.questions.length}
            </span>
            <span className="muted">{typeLabels[q.type]}</span>
          </div>
          <p className="question-topic">{q.topic}</p>
          <h2 id="question-label" className="question-prompt">
            {q.prompt}
          </h2>
          <fieldset
            disabled={submitting || remaining === 0 || blocked.current}
            aria-labelledby="question-label"
            className="answer-fields"
          >
            {q.options.length ? (
              q.options.map((option, i) => (
                <label
                  key={option}
                  className={
                    answers[q.id] === option
                      ? "answer-option selected"
                      : "answer-option"
                  }
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={option}
                    checked={answers[q.id] === option}
                    onChange={() => change(option)}
                  />
                  <span className="option-letter">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{option}</span>
                  {answers[q.id] === option && <Check size={18} />}
                </label>
              ))
            ) : (
              <label>
                <span className="field-label">Your answer</span>
                {q.type === "short-answer" ? (
                  <textarea
                    aria-label="Your answer"
                    value={answers[q.id] ?? ""}
                    maxLength={4000}
                    rows={6}
                    onChange={(e) => change(e.target.value)}
                    placeholder="Explain it in your own words…"
                  />
                ) : (
                  <input
                    aria-label="Your answer"
                    value={answers[q.id] ?? ""}
                    maxLength={500}
                    onChange={(e) => change(e.target.value)}
                    placeholder="Enter the term or answer"
                  />
                )}
                {q.type === "short-answer" && (
                  <small>
                    Equivalent wording is accepted. Partial understanding can
                    earn half a point.
                  </small>
                )}
              </label>
            )}
          </fieldset>
          <div className="question-footer">
            <button
              className="small-button"
              disabled={!index}
              onClick={() => setIndex((i) => i - 1)}
            >
              <ArrowLeft size={16} /> Previous
            </button>
            {index < test.questions.length - 1 ? (
              <button
                className="learning-button"
                onClick={() => setIndex((i) => i + 1)}
              >
                Next question <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="learning-button"
                disabled={submitting || blocked.current}
                onClick={() => setConfirm(true)}
              >
                Review & submit
              </button>
            )}
          </div>
        </section>
        <aside className="learning-card question-nav">
          <h2>Your questions</h2>
          <div className="question-grid">
            {test.questions.map((item, i) => (
              <button
                key={item.id}
                aria-label={
                  "Question " +
                  (i + 1) +
                  (answers[item.id]?.trim() ? ", answered" : ", unanswered")
                }
                aria-current={i === index ? "step" : undefined}
                className={answers[item.id]?.trim() ? "answered" : ""}
                onClick={() => setIndex(i)}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <p className="muted">
            Filled blue means answered. You can revisit any question before
            submitting.
          </p>
          <button
            className="learning-button full"
            disabled={submitting || blocked.current}
            onClick={() => setConfirm(true)}
          >
            Submit test
          </button>
        </aside>
      </div>
      {confirm && (
        <section
          className="learning-card submit-confirm"
          aria-labelledby="submit-heading"
        >
          <h2 id="submit-heading">Ready to see how you did?</h2>
          <p>
            {test.questions.length - answered
              ? `${test.questions.length - answered} unanswered question(s) will receive zero points.`
              : "You have answered every question."}{" "}
            Your answers are final after submission.
          </p>
          <div className="button-row">
            <button className="small-button" onClick={() => setConfirm(false)}>
              Keep reviewing
            </button>
            <button
              className="learning-button"
              disabled={submitting}
              onClick={() => void submit()}
            >
              Submit answers
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
function Results({ data }: { data: Payload }) {
  const { attempt, test } = data,
    result = attempt.result!,
    topics = topicInsights(result.items);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="learning-page">
      <Link className="text-link" href="/dashboard/practice">
        <ArrowLeft size={16} /> All practice tests
      </Link>
      <section className="learning-card result-hero">
        <div>
          <h1>Test results</h1>
          <p>{test.title}</p>
          <p>
            {result.earned} of {result.total} points ·{" "}
            {result.items.filter((i) => i.points === 1).length} fully correct
          </p>
        </div>
        <div className="score-circle">
          <strong>{result.percentage}%</strong>
          <span>Your score</span>
        </div>
      </section>
      <div className="button-row">
        <button
          className="learning-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const next = await requestJson<{ attemptId: string }>(
                "/api/practice/attempt",
                { method: "POST", body: JSON.stringify({ testId: test.id }) },
              );
              window.location.assign(
                "/dashboard/practice?attempt=" + next.attemptId,
              );
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
            }
          }}
        >
          <RotateCcw size={16} /> Retake this test
        </button>
        <Link
          className="small-button"
          href={"/dashboard/practice?subject=" + test.subject_id}
        >
          Generate a new test
        </Link>
        <Link className="text-link" href="/dashboard/profile">
          View overall progress <ArrowRight size={15} />
        </Link>
      </div>
      {error && <p role="alert">{error}</p>}
      <section className="learning-card">
        <div className="section-heading">
          <div>
            <h2>Your topic breakdown</h2>
            <p className="muted">
              Based on this attempt. Revisit lower-scoring topics first.
            </p>
          </div>
        </div>
        <div className="topic-grid">
          {topics.map((t) => (
            <div className="topic-item" key={t.key}>
              <div>
                <strong>{t.name}</strong>
                <span>{t.percentage}%</span>
              </div>
              <progress
                max={100}
                value={t.percentage}
                aria-label={t.name + " score"}
              />
              <small>
                {t.earned} / {t.count} points ·{" "}
                {t.percentage < 70
                  ? "Worth revisiting"
                  : "Keep building on this"}
              </small>
            </div>
          ))}
        </div>
        <Link
          className="text-link"
          href={"/dashboard/subjects?subject=" + test.subject_id}
        >
          Revisit your reviewers <ArrowRight size={15} />
        </Link>
      </section>
      <section>
        <div className="section-heading">
          <h2>Review your answers</h2>
          <span className="muted">
            1 point per question · Short answers may earn ½ point
          </span>
        </div>
        <div className="answer-review">
          {result.items.map((item, i) => (
            <article className="learning-card" key={item.id}>
              <div className="section-heading">
                <span className="learning-tag">
                  {i + 1} / {typeLabels[item.type]}
                </span>
                <span
                  className={
                    item.points === 1 ? "score-pill" : "score-pill needs-review"
                  }
                >
                  {item.points} / 1 point
                </span>
              </div>
              <h3 className="question-prompt">{item.prompt}</h3>
              <div className="review-answer-grid">
                <div>
                  <small>Your answer</small>
                  <p>{item.response || "No answer"}</p>
                </div>
                <div>
                  <small>Correct / model answer</small>
                  <p>{item.answer}</p>
                </div>
              </div>
              <p>
                <strong>Why:</strong> {item.explanation}
              </p>
              {item.aiGraded && (
                <p className="ai-feedback">
                  <strong>AI feedback:</strong> {item.feedback}
                </p>
              )}
              <details>
                <summary>View supporting source passage</summary>
                <blockquote>{item.evidence}</blockquote>
                <small>{item.topic}</small>
              </details>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
