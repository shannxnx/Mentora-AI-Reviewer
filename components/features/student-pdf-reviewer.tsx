"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react";
import {
  pdfSelectionError,
  formatPdfSize,
} from "@/lib/reviewer/pdf-reviewer";
import { findSavedReviewer, saveReviewerToLibrary } from "@/lib/reviewer/library";
import { requestReviewer } from "@/lib/reviewer/request-reviewer";
import { type StudyDepth } from "@/lib/reviewer/study-guide";
import { useStudentReviewer } from "./student-reviewer-provider";
import { SavedMaterials } from "./saved-materials";
import { ReviewerViewer } from "./reviewer-viewer";

export function StudentPdfReviewer({
  page,
}: {
  page: "materials" | "generate";
}) {
  const { owner, record, ready, storageNotice, saveRecord } = useStudentReviewer();
  const params = useSearchParams();
  const router = useRouter();
  const subjectId = params.get("subject");
  const freshUpload = params.get("new") === "1";
  const [targetSubject, setTargetSubject] = useState<{ id: string; name: string } | null>(null);
  const [targetFailed, setTargetFailed] = useState(false);
  const [savingSubject, setSavingSubject] = useState(false);
  const [saveError, setSaveError] = useState("");
  const savingLock = useRef(false);
  useEffect(() => {
    if (!subjectId || !owner) return;
    const controller = new AbortController();
    setTargetSubject(null);
    setTargetFailed(false);
    void createClient().from("study_subjects").select("id,name")
      .eq("owner_id", owner).eq("id", subjectId).abortSignal(controller.signal).maybeSingle()
      .then(({ data, error }) => {
        if (controller.signal.aborted) return;
        setTargetSubject(data);
        setTargetFailed(!!error || !data);
      });
    return () => controller.abort();
  }, [subjectId, owner]);
  const destination = targetSubject?.id === subjectId ? targetSubject : null;

  async function saveToSubject() {
    if (!record || !destination || savingLock.current) return;
    savingLock.current = true;
    setSavingSubject(true);
    setSaveError("");
    try {
      const id = await saveReviewerToLibrary(record, destination.id);
      router.push("/dashboard/subjects?" + new URLSearchParams({ subject: destination.id, guide: id }));
    } catch {
      setSaveError("Couldn’t save your reviewer. It’s still here — please try again.");
    } finally {
      savingLock.current = false;
      setSavingSubject(false);
    }
  }
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [depth, setDepth] = useState<StudyDepth>("balanced");
  const [fresh, setFresh] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(freshUpload);
  useEffect(() => { if (freshUpload) setEditing(true); }, [freshUpload, subjectId]);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const output = useRef<HTMLDivElement>(null);
  const focusResult = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (record && !editing && focusResult.current) {
      output.current?.focus({ preventScroll: true });
      output.current?.scrollIntoView({ block: "start" });
      focusResult.current = false;
    }
  }, [record, editing]);

  function selectFiles(files: File[]) {
    if (request.current) return;
    setError("");
    setFile(null);
    if (files.length !== 1) {
      setError("Choose one PDF at a time.");
      return;
    }
    const selectionError = pdfSelectionError(files[0]);
    if (selectionError) {
      setError(selectionError);
      return;
    }
    setFile(files[0]);
  }

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (request.current) return;
    if (!file) {
      setError("Choose a PDF before creating your reviewer.");
      input.current?.focus();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const next = await requestReviewer(file, depth, {
        previous: record, signal: controller.signal, onStatus: setStatus, fresh,
        findSaved: owner ? hash => findSavedReviewer(owner, hash, depth, controller.signal) : undefined,
      });
      if (controller.signal.aborted) return;
      focusResult.current = true;
      saveRecord(next);
      setFresh(false);
      setEditing(false);
      setFile(null);
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error
            ? cause.message
            : "We could not open this file. Please choose it again.",
        );
    } finally {
      if (request.current === controller) {
        setBusy(false);
        request.current = null;
      }
    }
  }

  if (!ready)
    return (
      <div className="reviewer-loading" role="status">
        <LoaderCircle size={20} /> Opening your study space…
      </div>
    );
  return (
    <>
      {subjectId && <div className="subject-upload-context">
        <Link className="subject-back" href={"/dashboard/subjects?subject=" + encodeURIComponent(subjectId)}><ArrowLeft size={16} aria-hidden="true" />{destination ? "Back to " + destination.name : "Back to subject"}</Link>
        {destination ? <p>Create a reviewer, then save it to <strong>{destination.name}</strong>.</p> : targetFailed ? <p role="alert">This subject isn’t available. <Link href="/dashboard/subjects">Choose a subject</Link> to continue.</p> : <p role="status">Checking your subject…</p>}
      </div>}
      <div className="page-intro">
        <div>
                    <h1>{page === "materials" ? "My Materials" : "Generate Reviewer"}</h1>
          <p>{page === "materials" ? "Your saved reviewers and latest study guide." : "Turn your lecture notes into a clear, focused study guide."}</p>
        </div>
      </div>
      {page === "materials" && owner && <SavedMaterials owner={owner} />}
      {storageNotice && (
        <p className="reviewer-storage-notice" role="status">
          {storageNotice}
        </p>
      )}
      {record && !editing ? (
        <div ref={output} tabIndex={-1} aria-label="Reviewer ready">
          <div className="fc-launch button-row">
            {subjectId ? <button className="mentora-button primary" disabled={savingSubject || !destination} onClick={saveToSubject}>{savingSubject ? "Saving reviewer…" : "Save to " + (destination?.name ?? "subject")}<ArrowRight size={17} aria-hidden="true" /></button> : <Link className="mentora-button primary" href="/dashboard/flashcards">Save to subject / Generate flashcards</Link>}
            <Link className="mentora-button secondary" href={"/dashboard/practice" + (destination ? "?subject=" + destination.id : "")}>Create a practice test</Link>
          </div>
          {saveError && <p className="pdf-error" role="alert">{saveError}</p>}
          <ReviewerViewer
            record={record}
            onChooseAnother={() => {
              setEditing(true);
              setError("");
            }}
          />
        </div>
      ) : (
        <>
          <ol className="reviewer-steps" aria-label="Reviewer steps">
            <li className="active">
              <span>1</span> Choose a PDF
            </li>
            <li className={busy ? "active" : ""}>
              <span>2</span> Generate reviewer
            </li>
            <li>
              <span>3</span> Read reviewer
            </li>
          </ol>
          <div className="reviewer-upload-layout">
            <section className="mentora-panel reviewer-upload-panel">
              <div className="panel-heading">
                <div>
                  <h2>Your next study session starts here</h2>
                  <p>Choose a PDF up to 10 MB. For PowerPoint slides, choose File → Export or Save As → PDF first.</p>
                </div>
              </div>
              <form
                onSubmit={generate}
                aria-busy={busy}
                className="reviewer-upload-form"
              >
                <div
                  className={`pdf-dropzone${dragging ? " dragging" : ""}${busy ? " busy" : ""}`}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (!busy) setDragging(true);
                  }}
                  onDragLeave={(event) => {
                    if (
                      !event.currentTarget.contains(
                        event.relatedTarget as Node | null,
                      )
                    )
                      setDragging(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    selectFiles(Array.from(event.dataTransfer.files));
                  }}
                >
                  <span className="pdf-upload-icon">
                    <UploadCloud size={30} />
                  </span>
                  <h3>Drop your PDF here</h3>
                  <p>or choose a file from your device</p>
                  <input
                    ref={input}
                    id="student-pdf"
                    aria-label="Choose PDF file"
                    aria-describedby="pdf-limits pdf-privacy"
                    type="file"
                    accept=".pdf,application/pdf"
                    disabled={busy}
                    onChange={(event) => {
                      if (event.target.files?.length)
                        selectFiles(Array.from(event.target.files));
                      event.target.value = "";
                    }}
                  />
                  <p id="pdf-limits">
                    PDF only · Maximum 10 MB · One file at a time
                  </p>
                </div>
                {file && (
                  <div className="selected-pdf">
                    <span className="stat-icon">
                      <FileText size={20} />
                    </span>
                    <div>
                      <strong>{file.name}</strong>
                      <span>
                        {formatPdfSize(file.size)} · Ready to generate
                      </span>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Remove selected PDF"
                      disabled={busy}
                      onClick={() => {
                        setFile(null);
                        setError("");
                        input.current?.focus();
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                )}
                <fieldset className="guide-depth" disabled={busy}>
                  <legend>Reviewer depth</legend>
                  <div>
                    {(["concise", "balanced"] as const).map((option) => (
                      <label key={option}>
                        <input type="radio" name="depth" value={option} checked={depth === option}
                          onChange={() => setDepth(option)} />
                        <span><strong>{option === "concise" ? "Concise" : "Balanced"}</strong>
                          <small>{option === "concise" ? "Essential ideas for a quick review" : "Explanations and worked examples"}</small>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                {(owner || record?.sourceHash) && <label className="reviewer-fresh">
                  <input type="checkbox" checked={fresh} disabled={busy} onChange={e => setFresh(e.target.checked)} />
                  Generate a fresh version even if I already have a matching reviewer
                </label>}
                {error && (
                  <p className="pdf-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="reviewer-upload-actions">
                  <button
                    type="submit"
                    className="mentora-button primary"
                    disabled={busy || !file}
                  >
                    {busy ? (
                      <>
                        <LoaderCircle size={17} className="reviewer-spinner" />{" "}
                        Creating reviewer…
                      </>
                    ) : (
                      <>
                        Create reviewer <ArrowRight size={17} />
                      </>
                    )}
                  </button>
                  {busy && <button type="button" className="text-link" onClick={() => request.current?.abort()}>Cancel</button>}
                  {record && (
                    <button
                      type="button"
                      className="text-link"
                      disabled={busy}
                      onClick={() => {
                        setEditing(false);
                        setFile(null);
                        setError("");
                      }}
                    >
                      Back to current reviewer
                    </button>
                  )}
                </div>
                {busy && (
                  <p className="reviewer-working" role="status">
                    {status}
                  </p>
                )}
                <p id="pdf-privacy" className="pdf-privacy">
                  Your PDF is sent securely to Google Gemini to generate the
                  reviewer. Mentora does not save the file. Google&apos;s free API
                  tier may use submitted content to improve its products. The
                  generated reviewer is remembered only in this browser tab.
                </p>
              </form>
            </section>
            <aside className="reviewer-upload-aside">
              <span className="reviewer-aside-icon">
                <BookOpen size={26} />
              </span>
              <p className="eyebrow">A CLEARER WAY TO REVIEW</p>
              <h2>
                One document.
                <br />A place to start.
              </h2>
              <p>See how a focused reviewer can bring a lesson together.</p>
              <ul>
                <li>
                  <Check size={16} /> A guide organized by topic
                </li>
                <li>
                  <Check size={16} /> Steps, examples, or comparisons
                </li>
                <li>
                  <Check size={16} /> Topic navigation and recall checks
                </li>
              </ul>
              <div className="reviewer-demo-explanation">
                <strong>How it works</strong>
                <p>
                  Gemini reads the PDF, including text and visible document
                  content, then returns a structured reviewer grounded in it.
                </p>
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}
