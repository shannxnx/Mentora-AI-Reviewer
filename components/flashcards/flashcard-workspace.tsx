"use client";

import { LoadingState } from "@/components/layout/loading-state";
import Link from "next/link";
import { saveReviewerToLibrary } from "@/lib/reviewer/library";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileText, Layers, History, Plus } from "lucide-react";
import { SubjectDirectory, subjectsPath } from "./subject-directory";
import { SubjectOverview } from "./subject-overview";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadSubjects, loadSubjectLibrary, loadGuide, loadDeckCards } from "@/lib/flashcards/library";
import { createClient } from "@/lib/supabase/client";
import { useStudentReviewer } from "@/components/features/student-reviewer-provider";
import { ReviewerViewer } from "@/components/features/reviewer-viewer";
import { DeckDetail, requestDeck } from "./deck-detail";
import {
  sourceTopics,
  settingsFor,
  difficulties,
  styles,
  lengths,
  type Settings,
  type Deck,
  type SavedGuide,
} from "@/lib/flashcards/model";

type Page = "subjects" | "flashcards" | "courses";
function useLibraryResource<T>(load: (signal: AbortSignal) => Promise<T>, revision: number) {
  const [result, setResult] = useState<{ load: typeof load; data?: T; error?: string }>();
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal).then(data => {
      if (!controller.signal.aborted) setResult({ load, data });
    }).catch(error => {
      if (!controller.signal.aborted) setResult({ load, error: messageFor(error) });
    });
    return () => controller.abort();
  }, [load, revision]);
  return result?.load === load ? result : undefined;
}

export function FlashcardWorkspace({ page }: { page: Page }) {
  const params = useSearchParams();
  const subjectParam = params.get("subject");
  const initialGuide = params.get("guide") || "";
  const [account, setAccount] = useState<
    { id: string; teacher: boolean } | null | undefined
  >(undefined);
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange(
      (_event, session) => {
        setAccount(
          session
            ? {
                id: session.user.id,
                teacher: session.user.app_metadata?.role === "teacher",
              }
            : null,
        );
      },
    );
    return () => data.subscription.unsubscribe();
  }, []);
  const path =
    page === "courses" ? "/demo/teacher/courses" : "/dashboard/" + page;
  if (account === undefined)
    return <LoadingState>Opening your study space…</LoadingState>;
  if (page === "subjects" && (!account || !subjectParam))
    return <SubjectDirectory key={account?.id ?? "visitor"} owner={account?.id ?? null} />;
  if (!account)
    return (
      <section className="fc-panel">
        <h1>
          {page === "courses"
            ? "Teacher enrollment"
            : "Your subjects and flashcards"}
        </h1>
        <p>
          Sign in to access your subjects and keep your cards and review history
          across sessions.
        </p>
        <Link
          className="mentora-button primary"
          href={"/auth/login?study=" + encodeURIComponent(path)}
        >
          Sign in to continue
        </Link>
      </section>
    );
  if (page === "courses")
    return account.teacher ? (
      <Enrollment />
    ) : (
      <p className="fc-panel">
        A verified teacher account is required to enroll students.
      </p>
    );
  const selected = page === "subjects" ? subjectParam : null;
  return <LibraryView key={account.id + page + (selected ?? "") + initialGuide} owner={account.id} page={page} selected={selected} initialGuide={initialGuide} />;
}

function Enrollment() {
  const [email, setEmail] = useState(""),
    [name, setName] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <section className="fc-panel">
      <h1>Enroll a student in a subject</h1>
      <p>
        Use the email on the student’s Mentora account. The subject will appear
        in their study library.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setMessage("");
          try {
            const { error } = await createClient().rpc("study_enroll", {
              student_email: email,
              subject_name: name,
            });
            if (error) throw error;
            setMessage("Student enrolled in " + name + ".");
            setEmail("");
          } catch (e) {
            setMessage(messageFor(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Student email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Subject name
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <button disabled={busy}>Enroll student</button>
      </form>
      <p role="status">{message}</p>
    </section>
  );
}
function messageFor(e: unknown) {
  if (typeof e === "object" && e && "code" in e && e.code === "23505")
    return "This name or question already exists.";
  if (
    typeof e === "object" &&
    e &&
    "code" in e &&
    ["PGRST205", "PGRST202"].includes(String(e.code))
  )
    return "The study library needs its database migration. Ask the project administrator to finish setup.";
  if (typeof e === "object" && e && "message" in e) {
    if (/failed to fetch|fetch failed/i.test(String(e.message)))
      return "Could not reach the study library. Check the connection and try again.";
    return String(e.message);
  }
  return "Could not complete the request. Please try again.";
}

function LibraryView({ owner, page, selected, initialGuide }: { owner: string; page: Page; selected: string | null; initialGuide: string }) {
  const router = useRouter();
  const { record } = useStudentReviewer();
  const [chosenSubject, selectSubject] = useState(selected ?? "");
  const [guideId, selectGuide] = useState(initialGuide);
  const [deckId, selectDeck] = useState("");
  const [read, setRead] = useState(Boolean(initialGuide));
  const [configuring, setConfiguring] = useState(false);
  const [overviewView, setOverviewView] = useState<"reviewers" | "flashcards">("reviewers");
  const [subjectName, setSubjectName] = useState("");
  const [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [revision, refresh] = useState(0);
  const [subjectRevision, refreshSubjects] = useState(0);
  const lock = useRef(false);
  const directory = useLibraryResource(useCallback(
    (signal: AbortSignal) => loadSubjects(owner, signal), [owner]), subjectRevision);
  const subjects = directory?.data;
  const subjectId = chosenSubject || subjects?.[0]?.id || "";
  const subject = subjects?.find(item => item.id === subjectId);
  const library = useLibraryResource(useCallback(
    async (signal: AbortSignal) => subjectId ? loadSubjectLibrary(owner, subjectId, signal) : null,
    [owner, subjectId]), revision);
  const guides = library?.data?.guides ?? [];
  const decks = library?.data?.decks ?? [];
  const deck = decks.find(d => d.id === deckId);
  const detail = useLibraryResource(useCallback(
    async (signal: AbortSignal) => guideId && subjectId ? loadGuide(owner, subjectId, guideId, signal) : null,
    [guideId, subjectId, owner]), revision);
  const cardList = useLibraryResource(useCallback(
    async (signal: AbortSignal) => deckId ? loadDeckCards(owner, deckId, signal) : [],
    [owner, deckId]), revision);
  const guide = detail?.data;
  const error = directory?.error || library?.error || detail?.error || cardList?.error;
  const loading = !error && (!subjects || (subjectId && !library) || (guideId && !detail) || (deckId && !cardList));

  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      await task();
      refresh(n => n + 1);
    } catch (e) {
      setNotice(messageFor(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function pickSubject(id: string) {
    selectSubject(id);
    selectGuide("");
    selectDeck("");
    setFolder("");
    setRead(false);
  }
  function openDeck(d: Deck) {
    selectGuide(d.reviewer_id);
    selectDeck(d.id);
    setRead(false);
  }
  async function saveReviewer() {
    if (!record || !subjectId) return;
    const id = await saveReviewerToLibrary(record, subjectId, folder.trim() || null);
    selectGuide(id);
    selectDeck("");
    setNotice(page === "subjects" ? "Reviewer saved to this subject." : "Reviewer ready. Choose topics or generate a deck below.");
  }
  const recent = library?.data?.recent
    .map((r) => decks.find((d) => d.id === r.deck_id))
    .find((d) => !!d);
  return (
    <div className="fc-workspace">
      <header>
        {page === "subjects" ? (
          <Link className="subject-back" href={subjectsPath}><ArrowLeft size={16} />All subjects</Link>
        ) : <p className="guide-kicker">Study library</p>}
        <div className="subject-detail-heading">
          <div><h1>{page === "subjects" ? subject?.name ?? "Subject" : "Flashcards"}</h1>
            {page === "subjects" && subject && <p>Your reviewers, flashcards, and practice in one place.</p>}
          </div>
          {page === "subjects" && subject && <Link className="mentora-button primary" href={"/dashboard/generate?" + new URLSearchParams({ subject: subject.id, new: "1" })}><Plus size={18} aria-hidden="true" />Add a PDF</Link>}
        </div>
        {page !== "subjects" && subject && <Link className="text-link" href={"/dashboard/practice?subject=" + subject.id}>Practice this subject →</Link>}
      </header>
      {notice && (
        <p role="status" className="fc-notice">
          {notice}
        </p>
      )}
      {error ? (
        <div className="fc-notice" role="alert">{error}{" "}
          <button className="text-link" onClick={() => { refresh(n => n + 1); refreshSubjects(n => n + 1); }}>Try again</button>
          {guideId && <button className="text-link" onClick={() => { selectGuide(""); selectDeck(""); setRead(false); }}>Back to library</button>}
        </div>
      ) : loading ? (
        <LoadingState>Loading your library…</LoadingState>
      ) : selected && !subject ? (
        <p>{notice ? "Return to all subjects to try again." : "This subject is unavailable in your library."}</p>
      ) : read && guide ? (
        <section className="fc-panel">
          <ReviewerViewer
            record={guide.snapshot}
            onChooseAnother={() => {
              setRead(false);
              if (page === "subjects") {
                selectDeck("");
                setConfiguring(false);
                router.push(subjectsPath + "?subject=" + subjectId);
              }
            }}
            backLabel={page === "subjects" ? "Back to subject" : undefined}
            archived
          />
        </section>
      ) : deck && guide ? (
        <DeckDetail
          key={deck.id}
          deck={deck}
          guide={guide}
          cards={cardList?.data ?? []}
          run={run}
          busy={busy}
          close={() => {
            selectDeck("");
            if (page === "subjects") { selectGuide(""); setConfiguring(false); setOverviewView("flashcards"); }
          }}
          openGuide={() => {
            selectGuide(deck.reviewer_id);
            setRead(true);
          }}
        />
      ) : page === "subjects" && subject ? (
        configuring && guide ? <>
          <button className="subject-back" onClick={() => { setConfiguring(false); selectGuide(""); }}> <ArrowLeft size={16} aria-hidden="true" />Back to reviewers</button>
          <GuideSettings key={guide.id} guide={guide} busy={busy} run={run} onRead={() => router.push(subjectsPath + "?" + new URLSearchParams({ subject: subjectId, guide: guide.id }))} onDeck={selectDeck} />
        </> : <SubjectOverview subject={subject} guides={guides} decks={decks} record={record} busy={busy} view={overviewView} onView={setOverviewView}
          onSave={() => run(saveReviewer)}
          onConfigure={id => { selectGuide(id); setConfiguring(true); }}
          onDeck={openDeck} />
      ) : (
        <>
          {page === "flashcards" && <section className="fc-panel">
            <h2>Your subjects</h2>
            <p>
              Choose a subject you added or one your teacher enrolled you in.
            </p>
            <div className="fc-actions">
              {subjects?.map((s) => (
                <button
                  key={s.id}
                  disabled={busy}
                  aria-pressed={s.id === subjectId}
                  onClick={() => pickSubject(s.id)}
                >
                  {s.name} · {s.enrolled_by ? "Teacher-enrolled" : "Personal"}
                </button>
              ))}
            </div>
            <form className="fc-add-subject"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const { data, error } = await createClient()
                    .from("study_subjects")
                    .insert({ name: subjectName.trim() })
                    .select("id")
                    .single();
                  if (error) throw error;
                  refreshSubjects(n => n + 1);
                  pickSubject(data.id);
                  setSubjectName("");
                });
              }}
            >
              <label>
                Add your own subject
                <input
                  required
                  maxLength={100}
                  value={subjectName}
                  onChange={(e) => setSubjectName(e.target.value)}
                  placeholder="e.g. Biology"
                />
              </label>
              <button className="fc-primary" disabled={busy || !subjectName.trim()}>Add subject</button>
            </form>
          </section>}
          {subjectId && (
            <>
              <section className="fc-panel">
                <h2>
                  {selected ? "Reviewers" : "Reviewers in " + subject?.name}
                </h2>
                {record && (
                  <div className="fc-current-reviewer">
                    <p>
                      Current reviewer ·{" "}
                      <strong>{record.reviewer.title}</strong>
                    </p>
                    <label>
                      Folder (optional)
                      <input
                        list="fc-folders"
                        maxLength={100}
                        value={folder}
                        placeholder="Leave empty for no folder"
                        onChange={(e) => setFolder(e.target.value)}
                      />
                    </label>
                    <button className="fc-primary" disabled={busy} onClick={() => run(saveReviewer)}>
                      Save current reviewer to this subject
                    </button>
                  </div>
                )}
                <datalist id="fc-folders">
                  {[
                    ...new Set(guides.map((g) => g.folder).filter(Boolean)),
                  ].map((f) => (
                    <option key={f} value={f!} />
                  ))}
                </datalist>
                {!guides.length && (
                  <p>
                    No saved reviewers yet.{" "}
                    <Link href="/dashboard/generate">
                      Open the reviewer generator
                    </Link>
                  </p>
                )}
                {[...new Set(guides.map((g) => g.folder))].sort().map((f) => (
                  <div className="fc-reviewer-group" key={f ?? ""}>
                    {f && <h3>{f}</h3>}
                    <div className="fc-reviewer-list">{guides
                      .filter((g) => g.folder === f)
                      .map((g) => (
                        <button
                          className="fc-library-item"
                          key={g.id}
                          disabled={busy}
                          aria-pressed={g.id === guideId}
                          onClick={() => selectGuide(g.id)}
                        >
                          <FileText size={21} aria-hidden="true" />
                          <span><strong>{g.title || g.file_name}</strong>
                            <small>{decks.filter(d => d.reviewer_id === g.id).reduce((total, d) => total + d.count, 0)} cards</small>
                          </span>
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </button>
                      ))}</div>
                  </div>
                ))}
              </section>
              {guide && (
                <GuideSettings
                  key={guide.id}
                  guide={guide}
                  busy={busy}
                  run={run}
                  onRead={() => setRead(true)}
                  onDeck={selectDeck}
                />
              )}
              <section className="fc-panel">
                <h2>My decks</h2>
                <p>
                  {decks.reduce((total, d) => total + d.due, 0)} cards due or new ·{" "}
                  {decks.reduce((total, d) => total + d.known, 0)}{" "}
                  last marked Known
                </p>
                {recent && (
                  <button className="fc-recent" onClick={() => openDeck(recent)}>
                    <History size={16} aria-hidden="true" /> Recently studied · {recent.title}
                  </button>
                )}
                <div className="fc-deck-list">{decks.map((d) => (
                  <button className="fc-library-item" key={d.id} onClick={() => openDeck(d)}>
                    <Layers size={21} aria-hidden="true" />
                    <span><strong>{d.title}</strong><small>{d.count} cards · {d.due} due</small></span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </button>
                ))}</div>
                {!decks.length && (
                  <p>Select a saved reviewer above to create the first deck.</p>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function GuideSettings({
  guide,
  busy,
  run,
  onRead,
  onDeck,
}: {
  guide: SavedGuide;
  busy: boolean;
  run: (task: () => Promise<void>) => void;
  onRead: () => void;
  onDeck: (id: string) => void;
}) {
  const topics = sourceTopics(guide.snapshot);
  const [s, set] = useState<Settings>(() =>
    settingsFor(topics.map((t) => t.index)),
  );
  const [folder, setFolder] = useState(guide.folder ?? "");
  return (
    <section className="fc-panel">
      <p className="guide-kicker">Selected reviewer</p>
      <h2>{guide.snapshot.reviewer.title}</h2>
      <button onClick={onRead}>Read saved reviewer</button>
      <details>
        <summary>Move reviewer to a folder</summary>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const { error } = await createClient()
                .from("study_reviewers")
                .update({ folder: folder.trim() || null })
                .eq("id", guide.id);
              if (error) throw error;
            });
          }}
        >
          <label>
            Folder (leave empty to remove)
            <input
              list="fc-folders"
              value={folder}
              maxLength={100}
              onChange={(e) => setFolder(e.target.value)}
            />
          </label>
          <button disabled={busy}>Save folder</button>
        </form>
      </details>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(async () =>
            onDeck(await requestDeck({ reviewerId: guide.id, settings: s })),
          );
        }}
      >
        <label>
          Maximum cards
          <input
            type="number"
            min={1}
            max={50}
            required
            value={s.count || ""}
            onChange={(e) => set({ ...s, count: Number(e.target.value) })}
          />
        </label>
        <details>
          <summary>Topics and advanced settings</summary>
          <fieldset>
            <legend>Include topics</legend>
            {topics.map((t) => (
              <label key={t.index}>
                <input
                  type="checkbox"
                  checked={s.topics.includes(t.index)}
                  onChange={(e) =>
                    set({
                      ...s,
                      topics: e.target.checked
                        ? [...s.topics, t.index]
                        : s.topics.filter((i) => i !== t.index),
                    })
                  }
                />
                {t.heading}
              </label>
            ))}
          </fieldset>
          <div className="fc-settings-grid">{(
            [
              ["difficulty", difficulties],
              ["style", styles],
              ["length", lengths],
            ] as const
          ).map(([key, opts]) => (
            <label key={key}>
              {key === "length"
                ? "Answer length"
                : key === "style"
                  ? "Question style"
                  : "Difficulty"}
              <select
                value={s[key]}
                onChange={(e) => set({ ...s, [key]: e.target.value })}
              >
                {opts.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            </label>
          ))}</div>
        </details>
        <button className="fc-primary" disabled={busy || !s.topics.length}>
          {busy ? "Working…" : "Generate flashcards"}
        </button>
      </form>
    </section>
  );
}
