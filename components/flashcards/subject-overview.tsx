"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, FileText, Layers, UploadCloud } from "lucide-react";
import type { Subject, Deck } from "@/lib/flashcards/model";
import type { ReviewerRecord } from "@/lib/reviewer/pdf-reviewer";
import type { loadSubjectLibrary } from "@/lib/flashcards/library";
import { subjectsPath } from "./subject-directory";

type Library = Awaited<ReturnType<typeof loadSubjectLibrary>>;

export function SubjectOverview({ subject, guides, decks, record, busy, view, onView, onSave, onConfigure, onDeck }: {
  subject: Subject;
  guides: Library["guides"];
  decks: Library["decks"];
  record: ReviewerRecord | null;
  busy: boolean;
  view: "reviewers" | "flashcards";
  onView: (view: "reviewers" | "flashcards") => void;
  onSave: () => void;
  onConfigure: (id: string) => void;
  onDeck: (deck: Deck) => void;
}) {
  const uploadHref = "/dashboard/generate?" + new URLSearchParams({ subject: subject.id, new: "1" });
  return <div className="subject-overview">
    {record && <details className="subject-save-latest">
      <summary>Save your latest generated reviewer here</summary>
      <div><span><strong>{record.reviewer.title}</strong><small>{record.fileName}</small></span>
        <button className="mentora-button secondary" disabled={busy} onClick={onSave}>{busy ? "Saving…" : "Save to this subject"}</button></div>
    </details>}
    <div className="subject-resource-nav" aria-label="Study materials">
      <div className="subject-resource-switch">
        <button aria-pressed={view === "reviewers"} aria-controls="subject-resources" onClick={() => onView("reviewers")}><FileText size={17} aria-hidden="true" />Reviewers<span>{guides.length}</span></button>
        <button aria-pressed={view === "flashcards"} aria-controls="subject-resources" onClick={() => onView("flashcards")}><Layers size={17} aria-hidden="true" />Flashcards<span>{decks.length}</span></button>
      </div>
      <Link className="text-link" href={"/dashboard/practice?subject=" + subject.id}>Practice this subject<ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
    <section id="subject-resources" className="subject-content" aria-labelledby="subject-resources-heading">
      <div className="subject-content-heading">
        <h2 id="subject-resources-heading">{view === "reviewers" ? "Your reviewers" : "Your flashcard decks"}</h2>
        <p>{view === "reviewers" ? "Open a reviewer to read it, or turn its key ideas into flashcards." : "Choose a deck to start a study session."}</p>
      </div>
      {view === "reviewers" ? guides.length > 0 ? <ul className="subject-resource-list">
        {guides.map(guide => <li key={guide.id}>
          <Link className="subject-resource-main" href={subjectsPath + "?" + new URLSearchParams({ subject: subject.id, guide: guide.id })}>
            <span className="subject-resource-icon"><FileText size={23} strokeWidth={1.6} aria-hidden="true" /></span>
            <span><strong>{guide.title || guide.file_name}</strong><small>{guide.file_name}{guide.folder && " · " + guide.folder}</small><span className="subject-read-label">Read reviewer<ArrowRight size={14} aria-hidden="true" /></span></span>
          </Link>
          <button className="mentora-button secondary" disabled={busy} onClick={() => onConfigure(guide.id)}><Layers size={16} aria-hidden="true" />Make flashcards</button>
        </li>)}
      </ul> : <div className="subjects-empty subject-empty-content">
        <span className="subject-book"><UploadCloud size={29} strokeWidth={1.6} aria-hidden="true" /></span>
        <h3>Add your first reviewer</h3>
        <p>Upload lecture notes or slides to create a study guide for {subject.name}. Save it here when it’s ready.</p>
        <Link className="mentora-button primary" href={uploadHref}><UploadCloud size={18} aria-hidden="true" />Add a file</Link>
        <small>PDF, PPT, or PPTX · Up to 10 MB</small>
      </div> : decks.length > 0 ? <ul className="subject-resource-list">
        {decks.map(deck => <li key={deck.id}>
          <button className="subject-resource-main subject-deck-open" onClick={() => onDeck(deck)}>
            <span className="subject-resource-icon"><Layers size={23} strokeWidth={1.6} aria-hidden="true" /></span>
            <span><strong>{deck.title}</strong><small>{deck.count} {deck.count === 1 ? "card" : "cards"} · {deck.due} ready to review</small></span>
            <span className="subject-study-label">Study deck<ArrowRight size={17} aria-hidden="true" /></span>
          </button>
        </li>)}
      </ul> : <div className="subjects-empty subject-empty-content">
        <span className="subject-book"><Layers size={29} strokeWidth={1.6} aria-hidden="true" /></span>
        <h3>Turn ideas into practice</h3>
        <p>{guides.length ? "Choose “Make flashcards” next to one of your reviewers to create a deck." : "Add a file and save a reviewer first. Then you can turn it into flashcards."}</p>
        {guides.length ? <button className="mentora-button secondary" onClick={() => onView("reviewers")}><BookOpen size={17} aria-hidden="true" />Choose a reviewer</button> : <Link className="mentora-button primary" href={uploadHref}>Add a file<ArrowRight size={17} aria-hidden="true" /></Link>}
      </div>}
    </section>
  </div>;
}

