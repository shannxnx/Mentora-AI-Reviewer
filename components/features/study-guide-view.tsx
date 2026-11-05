import { useState } from "react";
import { Printer, RotateCcw } from "lucide-react";
import type { ReviewerRecord } from "@/lib/reviewer/pdf-reviewer";
import type { StudyGuide, StudyTopic } from "@/lib/reviewer/study-guide";
import { useStudentReviewer } from "./student-reviewer-provider";

function RecallCheck({ check }: { check: NonNullable<StudyTopic["check"]> }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="guide-check">
      <h4>Quick recall</h4>
      <p>{check.question}</p>
      <button type="button" className="text-link" aria-expanded={revealed}
        onClick={() => setRevealed(!revealed)}>{revealed ? "Hide answer" : "Reveal answer"}</button>
      <p className="guide-answer" hidden={!revealed}><strong>Answer</strong> {check.answer}</p>
    </div>
  );
}

function TopicContent({ topic }: { topic: StudyTopic }) {
  return (
    <>
      <p className="guide-prose">{topic.explanation}</p>
      {topic.formula && <div className="guide-formula"><h4>Formula</h4><p>{topic.formula}</p></div>}
      {topic.code && <pre aria-label="Code example" tabIndex={0}><code>{topic.code}</code></pre>}
      {topic.steps && <ol className="guide-steps">{topic.steps.map((step, i) => <li key={i}>{step}</li>)}</ol>}
      {topic.comparison && <div className="guide-table" tabIndex={0} role="region" aria-label={`${topic.heading} comparison`}>
        <table><thead><tr>{topic.comparison.headers.map((header, i) => <th scope="col" key={i}>{header}</th>)}</tr></thead>
          <tbody>{topic.comparison.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
        </table>
      </div>}
      {topic.example && <div className="guide-example">
        <h4>{topic.example.origin === "source" ? "Example from your PDF" : "AI illustration"}</h4>
        <p>{topic.example.text}</p>
      </div>}
      {topic.takeaway && <p className="guide-takeaway"><strong>Remember</strong> {topic.takeaway}</p>}
      {topic.check && <RecallCheck check={topic.check} />}
    </>
  );
}

export function StudyGuideView({ guide, record, onChooseAnother, archived = false }: {
  guide: StudyGuide;
  archived?: boolean;
  record: ReviewerRecord;
  onChooseAnother: () => void;
}) {
  const { saveRecord } = useStudentReviewer();
  const completed = record.completedTopics ?? [];
  function toggleTopic(index: number) {
    const completedTopics = completed.includes(index)
      ? completed.filter((value) => value !== index)
      : [...completed, index];
    saveRecord({ ...record, completedTopics });
  }
  return (
    <section className="study-guide" aria-label="Generated study guide">
      <header className="guide-heading">
        <span className="guide-kicker">AI study guide</span>
        <h2>{guide.title}</h2>
        <p className="guide-source">Source PDF · {record.fileName}</p>
        <div className="guide-actions">
          <button type="button" className="mentora-button secondary" onClick={() => window.print()}><Printer size={15} /> Print / Save PDF</button>
          <button type="button" className="mentora-button secondary" onClick={onChooseAnother}><RotateCcw size={15} /> {archived ? "Back to flashcards" : "Choose another PDF"}</button>
        </div>
      </header>
      <div className="guide-layout">
        <nav className="guide-contents mentora-panel" aria-label="Guide topics">
          <h3>In this guide</h3>
          <ol>{guide.topics.map((topic, index) => (
            <li key={index}><a href={`#study-topic-${index + 1}`}>{topic.heading}</a></li>
          ))}</ol>
          {!archived && <p aria-live="polite">{completed.length} of {guide.topics.length} reviewed</p>}
        </nav>
        <article className="guide-article mentora-panel">
          <section><h3>Overview</h3><p className="guide-prose">{guide.overview}</p></section>
          {guide.topics.map((topic, index) => (
            <section id={`study-topic-${index + 1}`} key={index} tabIndex={-1}>
              <span className="guide-kicker">Topic {String(index + 1).padStart(2, "0")}</span>
              <h3>{topic.heading}</h3>
              {topic.sourceHeading && <p className="guide-locator">Find in PDF · {topic.sourceHeading}</p>}
              <TopicContent topic={topic} />
              {!archived && <label className="guide-complete">
                <input type="checkbox" checked={completed.includes(index)} onChange={() => toggleTopic(index)} />
                Mark as reviewed<span className="sr-only"> · {topic.heading}</span>
              </label>}
            </section>
          ))}
        </article>
      </div>
    </section>
  );
}
