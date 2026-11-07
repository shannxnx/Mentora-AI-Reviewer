"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ClipboardList,
  Clock3,
  FileText,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  questionTypes,
  typeLabels,
  type TestSettings,
  type PracticeTest,
  type Attempt,
} from "@/lib/practice/model";
import { requestJson, dateLabel } from "@/lib/learning/http";
import { pdfSelectionError } from "@/lib/reviewer/pdf-reviewer";
import { isStudyGuide } from "@/lib/reviewer/study-guide";
import { saveReviewerToLibrary } from "@/lib/reviewer/library";
import { useStudentReviewer } from "@/components/features/student-reviewer-provider";
import { AttemptView } from "./test-attempt";

type History = Pick<
  Attempt,
  "id" | "status" | "score" | "started_at" | "test_id"
> & { practice_tests: { title: string; subject_name: string } };
type Library = {
  subjects: { id: string; name: string }[];
  guides: { id: string; subject_id: string; file_name: string }[];
  tests: PracticeTest[];
  attempts: History[];
  more: boolean;
};
export function PracticeWorkspace() {
  const params = useSearchParams(),
    id = params.get("attempt");
  return id ? <AttemptView key={id} id={id} /> : <TestLibrary />;
}
function TestLibrary() {
  const router = useRouter(),
    params = useSearchParams(),
    { record, saveRecord } = useStudentReviewer();
  const [library, setLibrary] = useState<Library | null>(null),
    [page, setPage] = useState(0);
  const [subject, setSubject] = useState(params.get("subject") ?? ""),
    [selected, setSelected] = useState<string[]>([]);
  const [settings, setSettings] = useState<TestSettings>({
    count: 10,
    difficulty: "mixed",
    types: [...questionTypes],
    minutes: null,
  });
  const [mode, setMode] = useState<"saved" | "pdf">("saved"),
    [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(""),
    [error, setError] = useState(""),
    [ready, setReady] = useState<{ testId: string; count: number } | null>(
      null,
    );
  const lock = useRef(false);
  const load = useCallback(async () => {
    const data = await requestJson<Library>("/api/practice?page=" + page);
    setLibrary(data);
    setSubject((s) => s || data.subjects[0]?.id || "");
  }, [page]);
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [load]);
  async function run(label: string, task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(label);
    setError("");
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  async function start(testId: string) {
    await run("Opening your test…", async () => {
      const data = await requestJson<{ attemptId: string }>(
        "/api/practice/attempt",
        { method: "POST", body: JSON.stringify({ testId }) },
      );
      router.push("/dashboard/practice?attempt=" + data.attemptId);
    });
  }
  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setReady(null);
    await run(
      mode === "pdf" ? "Reading your PDF…" : "Creating source-based questions…",
      async () => {
        let reviewerIds = selected;
        if (mode === "pdf") {
          if (!file) throw new Error("Choose a PDF first.");
          const invalid = pdfSelectionError(file);
          if (invalid) throw new Error(invalid);
          const form = new FormData();
          form.set("pdf", file);
          form.set("depth", "balanced");
          const response = await fetch("/api/reviewer", {
            method: "POST",
            body: form,
          });
          const payload = await response.json();
          if (!response.ok)
            throw new Error(payload.error || "Could not read the PDF.");
          if (!isStudyGuide(payload.reviewer))
            throw new Error("The reviewer could not be read.");
          const generated = {
            reviewer: payload.reviewer,
            fileName: file.name,
            size: file.size,
          };
          saveRecord(generated);
          const id = await saveReviewerToLibrary(generated, subject);
          reviewerIds = [id];
          setSelected([id]);
          setMode("saved");
          setFile(null);
          await load();
          setBusy("Creating source-based questions…");
        }
        const result = await requestJson<{ testId: string; count: number }>(
          "/api/practice",
          {
            method: "POST",
            body: JSON.stringify({ subjectId: subject, reviewerIds, settings }),
          },
        );
        setReady(result);
        await load();
      },
    );
  }
  const guides = library?.guides.filter((g) => g.subject_id === subject) ?? [];
  return (
    <div className="learning-page">
      <header className="learning-heading">
        <div>
          <h1>Practice tests</h1>
          <p>Create a test from a PDF or the reviewers saved in a subject.</p>
        </div>
      </header>
      {error && (
        <div className="learning-notice error" role="alert">
          {error}{" "}
          {!library && (
            <button onClick={() => void run("Loading…", load)}>Retry</button>
          )}
        </div>
      )}
      {!library ? (
        <p role="status">Opening your practice space…</p>
      ) : (
        <>
          {!library.subjects.length ? (
            <section className="learning-card empty-state">
              <BookIcon />
              <h2>Start with a subject</h2>
              <p>
                Create your first subject, then add a PDF or saved reviewer to
                build a test.
              </p>
              <Link className="learning-button" href="/dashboard/subjects">
                <Plus size={17} /> Create a subject
              </Link>
            </section>
          ) : (
            <div className="practice-layout">
              <section className="learning-card">
                <div className="section-heading">
                  <div>
                    <h2>What would you like to practice?</h2>
                  </div>
                  <Sparkles size={22} />
                </div>
                <form onSubmit={generate} className="learning-form">
                  <fieldset disabled={!!busy}>
                    <label>
                      Subject
                      <select
                    aria-label="Subject"
                        value={subject}
                        onChange={(e) => {
                          setSubject(e.target.value);
                          setSelected([]);
                          setReady(null);
                        }}
                        required
                      >
                        {library.subjects.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="learning-segment" aria-label="Test source">
                      <button
                        type="button"
                        aria-pressed={mode === "saved"}
                        onClick={() => setMode("saved")}
                      >
                        Saved reviewers
                      </button>
                      <button
                        type="button"
                        aria-pressed={mode === "pdf"}
                        onClick={() => setMode("pdf")}
                      >
                        Upload a PDF
                      </button>
                    </div>
                    {mode === "saved" ? (
                      <div>
                        <span className="field-label">
                          Choose reviewers{" "}
                          <small>Up to 5 from this subject</small>
                        </span>
                        <div className="source-list">
                          {guides.length ? (
                            guides.map((g) => (
                              <label className="choice-row" key={g.id}>
                                <input
                                  type="checkbox"
                                  checked={selected.includes(g.id)}
                                  disabled={
                                    !selected.includes(g.id) &&
                                    selected.length >= 5
                                  }
                                  onChange={(e) =>
                                    setSelected((s) =>
                                      e.target.checked
                                        ? [...s, g.id]
                                        : s.filter((id) => id !== g.id),
                                    )
                                  }
                                />
                                <FileText size={18} />
                                <span>{g.file_name}</span>
                              </label>
                            ))
                          ) : (
                            <p className="muted">
                              No saved reviewers here yet. Upload a PDF to get
                              started.
                            </p>
                          )}
                        </div>
                        {record && (
                          <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                              void run("Saving your reviewer…", async () => {
                                const id = await saveReviewerToLibrary(
                                  record,
                                  subject,
                                );
                                setSelected([id]);
                                await load();
                              })
                            }
                          >
                            Use my latest reviewer: {record.fileName}
                          </button>
                        )}
                      </div>
                    ) : (
                      <label className="upload-source">
                        <FileText size={25} />
                        <strong>Choose your study material</strong>
                        <span>
                          PDF · Up to 10 MB. Its reviewer is saved to this
                          subject.
                        </span>
                        <input
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={(e) => {
                            setFile(e.target.files?.[0] ?? null);
                            setError("");
                          }}
                        />
                      </label>
                    )}
                    <fieldset className="question-types">
                      <legend>Question types</legend>
                      <div>
                        {questionTypes.map((t) => (
                          <label className="choice-row" key={t}>
                            <input
                              type="checkbox"
                              checked={settings.types.includes(t)}
                              onChange={(e) =>
                                setSettings((s) => ({
                                  ...s,
                                  types: e.target.checked
                                    ? [...s.types, t]
                                    : s.types.filter((x) => x !== t),
                                }))
                              }
                            />
                            {typeLabels[t]}
                          </label>
                        ))}
                      </div>
                    </fieldset>
                    <div className="form-grid">
                      <label>
                        Difficulty
                        <select
                        aria-label="Difficulty"
                          value={settings.difficulty}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              difficulty: e.target
                                .value as TestSettings["difficulty"],
                            }))
                          }
                        >
                          {["mixed", "easy", "medium", "hard"].map((d) => (
                            <option key={d} value={d}>
                              {d[0].toUpperCase() + d.slice(1)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Questions
                        <input
                          type="number"
                          min={Math.max(1, settings.types.length)}
                          max={50}
                          required
                          value={settings.count}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              count: Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label className="choice-row">
                      <input
                        type="checkbox"
                        checked={settings.minutes !== null}
                        onChange={(e) =>
                          setSettings((s) => ({
                            ...s,
                            minutes: e.target.checked ? 15 : null,
                          }))
                        }
                      />{" "}
                      Set a time limit
                    </label>
                    {settings.minutes !== null && (
                      <label>
                        Time limit (minutes)
                        <input
                          type="number"
                          min={1}
                          max={180}
                          required
                          value={settings.minutes}
                          onChange={(e) =>
                            setSettings((s) => ({
                              ...s,
                              minutes: Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                    )}
                    <button
                      className="learning-button full"
                      disabled={
                        !settings.types.length ||
                        (mode === "saved" ? !selected.length : !file)
                      }
                    >
                      <Sparkles size={17} /> Generate practice test
                    </button>
                  </fieldset>
                </form>
                {busy && (
                  <p role="status" className="learning-notice">
                    {busy}
                  </p>
                )}
                {ready && (
                  <div className="learning-notice success" role="status">
                    <strong>Your {ready.count}-question test is ready.</strong>
                    {ready.count < settings.count && (
                      <p>
                        The source supported fewer questions than requested.
                      </p>
                    )}
                    <p>The timer starts when you begin.</p>
                    <button
                      className="learning-button"
                      disabled={!!busy}
                      onClick={() => void start(ready.testId)}
                    >
                      Begin test <ArrowRight size={16} />
                    </button>
                  </div>
                )}
              </section>
              <aside className="practice-aside">
                <section className="learning-card blue-card">
                  <span className="icon-tile">
                    <Clock3 size={23} />
                  </span>
                  <h2>
                    How practice tests work
                  </h2>
                  <p>
                    Get explanations for every answer, discover topics to
                    revisit, and see your progress over time.
                  </p>
                  <ul>
                    <li>Answers save as you go</li>
                    <li>Untimed tests can be resumed</li>
                    <li>Timed tests keep counting while closed</li>
                    <li>Short answers can earn partial credit</li>
                  </ul>
                </section>
                <section className="learning-card">
                  <h2>Saved tests</h2>
                  <p className="muted">
                    Start again whenever you want. Each attempt gets its own
                    result.
                  </p>
                  <div className="learning-list">
                    {library.tests.length ? (
                      library.tests.map((t) => (
                        <div className="list-row" key={t.id}>
                          <div>
                            <strong>{t.title}</strong>
                            <small>
                              {t.settings.difficulty} ·{" "}
                              {t.settings.minutes
                                ? t.settings.minutes + " min"
                                : "Untimed"}
                            </small>
                          </div>
                          <button
                            className="small-button"
                            disabled={!!busy}
                            onClick={() => void start(t.id)}
                          >
                            Start
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        Your generated tests will appear here.
                      </p>
                    )}
                  </div>
                </section>
              </aside>
            </div>
          )}
          <section className="learning-card">
            <div className="section-heading">
              <div>
                <h2>Test history</h2>
              </div>
              <Link className="text-link" href="/dashboard/profile">
                View learning profile <ArrowRight size={15} />
              </Link>
            </div>
            <AttemptHistory history={library.attempts} />
            <div className="history-pagination">
              <button
                className="small-button"
                disabled={!page || !!busy}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </button>
              <span>Page {page + 1}</span>
              <button
                className="small-button"
                disabled={!library.more || !!busy}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
function BookIcon() {
  return (
    <span className="icon-tile">
      <ClipboardList size={30} />
    </span>
  );
}
export function AttemptHistory({
  history,
}: {
  history: {
    id: string;
    status: string;
    score: number | null;
    started_at: string;
    practice_tests: { title: string; subject_name: string };
  }[];
}) {
  return history.length ? (
    <div className="history-table">
      <table>
        <thead>
          <tr>
            <th>Test</th>
            <th>Date</th>
            <th>Score</th>
            <th>
              <span className="sr-only">Action</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {history.map((a) => (
            <tr key={a.id}>
              <td>
                <strong>{a.practice_tests.title}</strong>
                <small>{a.practice_tests.subject_name}</small>
              </td>
              <td>{dateLabel(a.started_at)}</td>
              <td>
                {a.score !== null ? (
                  <span className="score-pill">{a.score}%</span>
                ) : a.status === "active" ? (
                  "In progress"
                ) : (
                  "Awaiting grading"
                )}
              </td>
              <td>
                <Link
                  className="text-link"
                  href={"/dashboard/practice?attempt=" + a.id}
                >
                  {a.status === "active" ? "Resume" : "View results"}
                  <ArrowRight size={14} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty-inline">
      <ClipboardList size={25} />
      <p>
        No attempts yet. Your results and progress will appear here after your
        first test.
      </p>
    </div>
  );
}
