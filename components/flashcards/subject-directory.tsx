"use client";

import Link from "next/link";
import { ArrowUpRight, Plus, SquarePen, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Subject } from "@/lib/flashcards/model";

export const subjectsPath = "/dashboard/subjects";

export function SubjectDirectory({ owner }: { owner: string | null }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(!!owner);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [added, setAdded] = useState("");

  useEffect(() => {
    if (!owner) return;
    let active = true;
    async function load() {
      const all: Subject[] = [];
      for (let start = 0; ; start += 500) {
        const { data, error } = await createClient()
          .from("study_subjects").select("id,name,enrolled_by").eq("owner_id", owner)
          .order("name").order("id").range(start, start + 499);
        if (error) throw error;
        all.push(...data);
        if (data.length < 500) break;
      }
      if (active) setSubjects(all);
    }
    setLoading(true);
    setLoadError(false);
    load().catch(() => { if (active) setLoadError(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [owner, attempt]);

  async function addSubject(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !name.trim() || !owner) return;
    pending.current = true;
    setSaving(true);
    setError("");
    try {
      const { data, error } = await createClient().from("study_subjects")
        .insert({ name: name.trim() }).select("id,name,enrolled_by").single();
      if (error) {
        if (error.code === "23505") {
          setError("You already have a subject with this name.");
          return;
        }
        throw error;
      }
      setSubjects((items) => [...items, data].sort((a, b) => a.name.localeCompare(b.name)));
      setAdded(data.name + " added.");
      dialog.current?.close();
    } catch {
      setError("Couldn’t add this subject. Please try again.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  const newTile = <><Plus className="subject-plus" size={38} strokeWidth={1.4} aria-hidden="true" /><span>New Subject</span></>;
  return (
    <section className="subject-directory" aria-labelledby="subjects-heading">
      <h1 id="subjects-heading">Your Subjects</h1>
      {loading ? <p role="status">Loading your subjects…</p> : loadError ? (
        <div role="alert">Couldn’t load your subjects. <button className="text-link" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>
      ) : (
        <>
          {!owner && <p className="subject-signin">Sign in to open your subjects or create your first one.</p>}
          <ul className="subject-grid">
            {subjects.map((subject) => (
              <li key={subject.id}>
                <Link className="subject-tile" href={subjectsPath + "?subject=" + encodeURIComponent(subject.id)}>
                  <strong>{subject.name}</strong>
                  <span className="subject-glyph"><SquarePen size={40} strokeWidth={1.45} aria-hidden="true" /></span>
                  <span className="subject-tile-foot">{subject.enrolled_by ? "Teacher-enrolled" : "Personal"}<ArrowUpRight size={15} aria-hidden="true" /></span>
                </Link>
              </li>
            ))}
            <li>
              {owner ? <button className="subject-tile subject-new" onClick={() => {
                setError(""); setName(""); dialog.current?.showModal(); input.current?.focus();
              }}>{newTile}</button> : (
                <Link className="subject-tile subject-new" href={"/auth/login?study=" + encodeURIComponent(subjectsPath)}>{newTile}</Link>
              )}
            </li>
          </ul>
        </>
      )}
      <span className="sr-only" role="status">{added}</span>
      {owner && (
        <dialog className="subject-dialog" ref={dialog} aria-labelledby="new-subject-heading" onCancel={(event) => { if (pending.current) event.preventDefault(); }}>
          <form onSubmit={addSubject}>
            <div className="subject-dialog-title">
              <h2 id="new-subject-heading">New subject</h2>
              <button type="button" disabled={saving} onClick={() => dialog.current?.close()} aria-label="Close"><X size={20} /></button>
            </div>
            <label htmlFor="subject-name">Subject name</label>
            <input id="subject-name" ref={input} value={name} maxLength={100} required placeholder="e.g. Data Structures" onChange={(event) => { setName(event.target.value); setError(""); }} disabled={saving} aria-invalid={!!error} aria-describedby={error ? "subject-error" : undefined} />
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
