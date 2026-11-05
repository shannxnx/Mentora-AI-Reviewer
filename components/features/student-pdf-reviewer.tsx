"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
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
import { isStudyGuide, type StudyDepth } from "@/lib/reviewer/study-guide";
import { useStudentReviewer } from "./student-reviewer-provider";
import { ReviewerViewer } from "./reviewer-viewer";

export function StudentPdfReviewer({
  page,
}: {
  page: "materials" | "generate";
}) {
  const { record, ready, storageNotice, saveRecord } = useStudentReviewer();
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [depth, setDepth] = useState<StudyDepth>("balanced");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
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
      const formData = new FormData();
      formData.set("pdf", file);
      formData.set("depth", depth);
      const response = await fetch("/api/reviewer", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : "The reviewer could not be generated. Please try again.";
        throw new Error(message);
      }
      const reviewer =
        typeof payload === "object" && payload !== null && "reviewer" in payload
          ? payload.reviewer
          : null;
      if (!isStudyGuide(reviewer))
        throw new Error(
          "The reviewer response was incomplete. Please try again.",
        );
      if (controller.signal.aborted) return;
      focusResult.current = true;
      saveRecord({ fileName: file.name, size: file.size, reviewer });
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
      <div className="page-intro">
        <div>
          <p className="eyebrow">START WITH YOUR NOTES</p>
          <h1>{page === "materials" ? "My Materials" : "Generate Reviewer"}</h1>
          <p>Select a PDF and generate a study reviewer from its content.</p>
        </div>
        <span className="subtle-badge">PDF reviewer · Gemini AI</span>
      </div>
      {storageNotice && (
        <p className="reviewer-storage-notice" role="status">
          {storageNotice}
        </p>
      )}
      {record && !editing ? (
        <div ref={output} tabIndex={-1} aria-label="Reviewer ready">
          <div className="fc-launch"><Link className="mentora-button primary" href="/dashboard/flashcards">Save to subject / Generate flashcards</Link></div>
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
                  <p>Choose one lecture PDF from your device.</p>
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
                        Reading your PDF…
                      </>
                    ) : (
                      <>
                        Create reviewer <ArrowRight size={17} />
                      </>
                    )}
                  </button>
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
                    Reading the document and building a focused reviewer. This
                    may take up to a minute.
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
