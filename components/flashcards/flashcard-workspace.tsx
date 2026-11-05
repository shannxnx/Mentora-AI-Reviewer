"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SubjectDirectory, subjectsPath } from "./subject-directory";
import { useCallback, useEffect, useRef, useState } from "react";
import { parseStoredReviewer } from "@/lib/reviewer/pdf-reviewer";
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
  type Card,
  type SavedGuide,
  type Subject,
  type Review,
} from "@/lib/flashcards/model";

type Page = "subjects" | "flashcards" | "courses";
type Library = {
  subjects: Subject[];
  guides: SavedGuide[];
  decks: Deck[];
  cards: Card[];
  reviews: Review[];
};
const empty: Library = {
  subjects: [],
  guides: [],
  decks: [],
  cards: [],
  reviews: [],
};

export function FlashcardWorkspace({ page }: { page: Page }) {
  const subjectParam = useSearchParams().get("subject");
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
    return <p role="status">Opening your study space…</p>;
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
  return <LibraryView key={account.id + page + (selected ?? "")} owner={account.id} page={page} selected={selected} />;
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

function LibraryView({ owner, page, selected }: { owner: string; page: Page; selected: string | null }) {
  const { record } = useStudentReviewer();
  const [data, setData] = useState<Library>(empty);
  const [subjectId, selectSubject] = useState(selected ?? ""),
    [guideId, selectGuide] = useState(""),
    [deckId, selectDeck] = useState("");
  const [read, setRead] = useState(false),
    [subjectName, setSubjectName] = useState(""),
    [folder, setFolder] = useState("");
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const active = useRef(true);
  const load = useCallback(async () => {
    const db = createClient();
    async function rows(
      table: string,
      columns: string,
      order = "id",
      limit?: number,
    ) {
      const result = [];
      for (let start = 0; ; start += 500) {
        const { data, error } = await db
          .from(table)
          .select(columns)
          .eq("owner_id", owner)
          .order(order, { ascending: !limit })
          .range(start, start + (limit ?? 500) - 1);
        if (error) throw error;
        result.push(...data);
        if (limit || data.length < 500) break;
      }
      return result;
    }
    const [subjects, guides, decks, cards, reviews] = await Promise.all([
      rows("study_subjects", "id,name,enrolled_by"),
      rows("study_reviewers", "id,subject_id,file_name,folder,snapshot"),
      rows("study_decks", "id,title,reviewer_id,settings_key"),
      rows(
        "study_cards",
        "id,deck_id,topic,front,back,evidence,origin,revision,due_at,last_rating",
      ),
      rows("study_reviews", "deck_id,reviewed_at", "reviewed_at", 30),
    ]);
    if (!active.current) return;
    const library = {
      subjects,
      guides,
      decks,
      cards,
      reviews,
    } as unknown as Library;
    library.guides = library.guides.flatMap((guide) => {
      const snapshot = parseStoredReviewer(JSON.stringify(guide.snapshot));
      return snapshot ? [{ ...guide, snapshot }] : [];
    });
    setData(library);
    selectSubject((current) => current || library.subjects[0]?.id || "");
  }, [owner]);
  useEffect(() => {
    active.current = true;
    load()
      .catch((e) => {
        if (active.current) setNotice(messageFor(e));
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });
    return () => {
      active.current = false;
    };
  }, [load]);
  async function run(task: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice("");
    try {
      await task();
      await load();
    } catch (e) {
      setNotice(messageFor(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const guides = data.guides.filter((g) => g.subject_id === subjectId);
  const subject = data.subjects.find((item) => item.id === subjectId);
  const guide = guides.find((g) => g.id === guideId);
  const decks = data.decks.filter((d) =>
    guides.some((g) => g.id === d.reviewer_id),
  );
  const deck = decks.find((d) => d.id === deckId);
  const deckGuide = guides.find((g) => g.id === deck?.reviewer_id);
  const scopedCards = data.cards.filter((c) =>
    decks.some((d) => d.id === c.deck_id),
  );
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
    const snapshot = {
      fileName: record.fileName,
      size: record.size,
      reviewer: record.reviewer,
    };
    const hash = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(JSON.stringify(snapshot)),
    );
    const fingerprint = Array.from(new Uint8Array(hash), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
    const db = createClient();
    let { data: saved, error } = await db
      .from("study_reviewers")
      .insert({
        subject_id: subjectId,
        snapshot,
        file_name: record.fileName,
        fingerprint,
        folder: folder.trim() || null,
      })
      .select("id")
      .single();
    if (error?.code === "23505")
      ({ data: saved, error } = await db
        .from("study_reviewers")
        .select("id")
        .eq("subject_id", subjectId)
        .eq("fingerprint", fingerprint)
        .single());
    if (error || !saved) throw error;
    selectGuide(saved.id);
    selectDeck("");
    setNotice("Reviewer ready. Choose topics or generate a deck below.");
  }
  const recent = data.reviews
    .map((r) => decks.find((d) => d.id === r.deck_id))
    .find((d) => !!d);
  return (
    <div className="fc-workspace">
      <header>
        {page === "subjects" ? (
          <Link className="subject-back" href={subjectsPath}><ArrowLeft size={16} />All subjects</Link>
        ) : <p className="guide-kicker">Study library</p>}
        <h1>{page === "subjects" ? subject?.name ?? "Subject" : "Flashcards"}</h1>
      </header>
      {notice && (
        <p role="status" className="fc-notice">
          {notice}
        </p>
      )}
      {loading ? (
        <p>Loading your library…</p>
      ) : selected && !subject ? (
        <p>{notice ? "Return to all subjects to try again." : "This subject is unavailable in your library."}</p>
      ) : read && guide ? (
        <section className="fc-panel">
          <button onClick={() => setRead(false)}>Back to flashcards</button>
          <ReviewerViewer
            record={guide.snapshot}
            onChooseAnother={() => setRead(false)}
            archived
          />
        </section>
      ) : deck && deckGuide ? (
        <DeckDetail
          key={deck.id}
          deck={deck}
          guide={deckGuide}
          cards={data.cards.filter((c) => c.deck_id === deck.id)}
          run={run}
          busy={busy}
          close={() => selectDeck("")}
          openGuide={() => {
            selectGuide(deck.reviewer_id);
            setRead(true);
          }}
        />
      ) : (
        <>
          {page === "flashcards" && <section className="fc-panel">
            <h2>Your subjects</h2>
            <p>
              Choose a subject you added or one your teacher enrolled you in.
            </p>
            <div className="fc-actions">
              {data.subjects.map((s) => (
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
            <form
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  const { data, error } = await createClient()
                    .from("study_subjects")
                    .insert({ name: subjectName.trim() })
                    .select("id")
                    .single();
                  if (error) throw error;
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
              <button disabled={busy}>Add subject</button>
            </form>
          </section>}
          {subjectId && (
            <>
              <section className="fc-panel">
                <h2>
                  {selected ? "Reviewers" : "Reviewers in " + subject?.name}
                </h2>
                {record && (
                  <div>
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
                    <button disabled={busy} onClick={() => run(saveReviewer)}>
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
                  <div key={f ?? ""}>
                    <h3>{f ?? "No folder"}</h3>
                    {guides
                      .filter((g) => g.folder === f)
                      .map((g) => (
                        <button
                          key={g.id}
                          disabled={busy}
                          aria-pressed={g.id === guideId}
                          onClick={() => selectGuide(g.id)}
                        >
                          {g.snapshot.reviewer.title} ·{" "}
                          {
                            data.cards.filter((c) =>
                              decks.some(
                                (d) =>
                                  d.id === c.deck_id && d.reviewer_id === g.id,
                              ),
                            ).length
                          }{" "}
                          cards
                        </button>
                      ))}
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
                  {
                    scopedCards.filter(
                      (c) => Date.parse(c.due_at) <= Date.now(),
                    ).length
                  }{" "}
                  cards due or new ·{" "}
                  {scopedCards.filter((c) => c.last_rating === "known").length}{" "}
                  last marked Known
                </p>
                {recent && (
                  <button onClick={() => openDeck(recent)}>
                    Recently studied · {recent.title}
                  </button>
                )}
                {decks.map((d) => (
                  <div key={d.id}>
                    <button onClick={() => openDeck(d)}>
                      {d.title} ·{" "}
                      {scopedCards.filter((c) => c.deck_id === d.id).length}{" "}
                      cards
                    </button>
                  </div>
                ))}
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
          {(
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
          ))}
        </details>
        <button className="fc-primary" disabled={busy || !s.topics.length}>
          {busy ? "Working…" : "Generate flashcards"}
        </button>
      </form>
    </section>
  );
}
