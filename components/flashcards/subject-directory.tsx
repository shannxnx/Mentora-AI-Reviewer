"use client";

import { LoadingState } from "@/components/layout/loading-state";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpen, Plus, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadSubjectDirectory } from "@/lib/flashcards/library";
import type { Subject } from "@/lib/flashcards/model";

export const subjectsPath = "/dashboard/subjects";
type SubjectSummary = Subject & { reviewerCount: number };

export function SubjectDirectory({ owner }: { owner: string | null }) {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectSummary[]>([]);
  const [loading, setLoading] = useState(!!owner);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);

  useEffect(() => {
    if (!owner) return;
    const controller = new AbortController();
    setLoading(true);
    setLoadError(false);
    loadSubjectDirectory(owner, controller.signal)
      .then(rows => { if (!controller.signal.aborted) setSubjects(rows); })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [owner, attempt]);

  function openCreate() {
    setError("");
    setName("");
    dialog.current?.showModal();
    input.current?.focus();
  }

  async function addSubject(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (pending.current || !trimmed || !owner) return;
    if (subjects.some(subject => subject.name.toLocaleLowerCase() === trimmed.toLocaleLowerCase())) {
      setError("You already have a subject with this name. Choose another name.");
      input.current?.focus();
      return;
    }
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const { data, error } = await createClient().from("study_subjects")
        .insert({ name: trimmed }).select("id,name,enrolled_by").single();
      if (error) {
        if (error.code === "23505") {
          setError("You already have a subject with this name. Choose another name.");
          return;
        }
        throw error;
      }
      setSubjects(items => [...items, { ...data, reviewerCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
      dialog.current?.close();
      router.push(subjectsPath + "?subject=" + encodeURIComponent(data.id));
    } catch {
      setError("Couldn’t create this subject. Your name is still here — please try again.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const visible = subjects.filter(subject =>
    subject.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()) &&
    (filter === "all" || (filter === "teacher" ? !!subject.enrolled_by : !subject.enrolled_by)));
  const createButton = (label: string) => owner
    ? <button className="mentora-button primary" onClick={openCreate}><Plus size={18} aria-hidden="true" />{label}</button>
    : <Link className="mentora-button primary" href={"/auth/login?study=" + encodeURIComponent(subjectsPath)}>Sign in to get started<ArrowRight size={17} aria-hidden="true" /></Link>;

  return (
    <section className="subject-directory" aria-labelledby="subjects-heading">
      <header className="subjects-heading">
        <div><h1 id="subjects-heading">My subjects</h1>
          <p>Keep your reviewers and flashcards together, one subject at a time.</p></div>
        {subjects.length > 0 && createButton("Add subject")}
      </header>
      {loading ? <LoadingState>Loading your subjects…</LoadingState> : loadError ? (
        <div className="subjects-empty" role="alert"><h2>We couldn’t load your subjects</h2>
          <p>Check your connection and try again.</p>
          <button className="mentora-button secondary" onClick={() => setAttempt(n => n + 1)}>Try again</button>
        </div>
      ) : subjects.length === 0 ? (
        <div className="subjects-empty subjects-onboarding">
          <span className="subject-book"><BookOpen size={30} strokeWidth={1.6} aria-hidden="true" /></span>
          <h2>A home for every subject</h2>
          <p>{owner ? "Start with a class you’re studying. Then add a file to create your first reviewer." : "Sign in to organize your classes and keep your study materials in one place."}</p>
          {createButton("Create your first subject")}
          <ol className="subject-steps"><li><span>1</span>Create a subject</li><li><span>2</span>Add a file</li><li><span>3</span>Read and practice</li></ol>
        </div>
      ) : (
        <>
          <div className="subjects-toolbar">
            <div className="subjects-search">
              <Search size={19} aria-hidden="true" />
              <label className="sr-only" htmlFor="subject-search">Search subjects</label>
              <input id="subject-search" type="search" value={query} placeholder="Find a subject…" onChange={event => setQuery(event.target.value)} />
              {query && <button aria-label="Clear search" onClick={() => setQuery("")}><X size={17} /></button>}
            </div>
            {subjects.some(subject => subject.enrolled_by) && <select aria-label="Filter subjects" value={filter} onChange={event => setFilter(event.target.value)}>
              <option value="all">All subjects</option><option value="personal">Created by me</option><option value="teacher">Added by a teacher</option>
            </select>}
            <p className="subjects-count" role="status">{query.trim() || filter !== "all" ? visible.length + " of " + subjects.length : subjects.length} {subjects.length === 1 ? "subject" : "subjects"}</p>
          </div>
          {visible.length ? <ul className="subject-grid">
            {visible.map(subject => (
              <li key={subject.id}>
                <Link className="subject-tile" href={subjectsPath + "?subject=" + encodeURIComponent(subject.id)}>
                  <span className="subject-tile-top"><span className="subject-book"><BookOpen size={25} strokeWidth={1.7} aria-hidden="true" /></span>
                    {subject.enrolled_by && <span className="subject-origin">From your teacher</span>}</span>
                  <strong>{subject.name}</strong>
                  <span className="subject-description">{subject.reviewerCount === 0 ? "No reviewers yet. Add a file to get started." : subject.reviewerCount + (subject.reviewerCount === 1 ? " saved reviewer" : " saved reviewers")}</span>
                  <span className="subject-tile-foot">Open subject<ArrowRight size={17} aria-hidden="true" /></span>
                </Link>
              </li>
            ))}
          </ul> : <div className="subjects-empty">
            <Search size={28} aria-hidden="true" /><h2>No matching subjects</h2>
            <p>Try another name or clear your search and filters.</p>
            <button className="mentora-button secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Show all subjects</button>
          </div>}
        </>
      )}
      {owner && (
        <dialog className="subject-dialog" ref={dialog} aria-labelledby="new-subject-heading" aria-describedby="subject-dialog-description" onCancel={event => { if (pending.current) event.preventDefault(); }}>
          <form onSubmit={addSubject}>
            <div className="subject-dialog-title"><h2 id="new-subject-heading">Add a subject</h2>
              <button type="button" disabled={saving} onClick={() => dialog.current?.close()} aria-label="Close"><X size={20} /></button></div>
            <p id="subject-dialog-description">Give it a name you’ll recognize. You can add your study materials next.</p>
            <label htmlFor="subject-name">Subject name</label>
            <input id="subject-name" ref={input} value={name} maxLength={100} required placeholder="e.g. Biology, Calculus, or English" onChange={event => { setName(event.target.value); setError(""); }} disabled={saving} aria-invalid={!!error} aria-describedby={error ? "subject-error" : undefined} />
            {error && <p id="subject-error" role="alert">{error}</p>}
            <div className="subject-dialog-actions">
              <button type="button" className="mentora-button secondary" disabled={saving} onClick={() => dialog.current?.close()}>Cancel</button>
              <button className="mentora-button primary" disabled={saving || !name.trim()}>{saving ? "Creating…" : "Create subject"}</button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}
