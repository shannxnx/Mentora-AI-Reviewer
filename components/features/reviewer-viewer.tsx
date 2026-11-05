import { StudyGuideView } from "./study-guide-view";
import { BookOpen, CheckCircle2, FileText, RotateCcw } from "lucide-react";
import {
  formatPdfSize,
  type ReviewerRecord,
} from "@/lib/reviewer/pdf-reviewer";

export function ReviewerViewer({
  record,
  onChooseAnother,
  archived = false,
}: {
  record: ReviewerRecord;
  archived?: boolean;
  onChooseAnother: () => void;
}) {
  const reviewer = record.reviewer;
  if ("version" in reviewer) {
    return <StudyGuideView archived={archived} guide={reviewer} record={record} onChooseAnother={onChooseAnother} />;
  }
  return (
    <section className="reviewer-output" aria-label="Generated reviewer">
      <div className="reviewer-success" role="status">
        <CheckCircle2 size={18} /> Your reviewer is ready.
      </div>
      <div className="reviewer-output-heading">
        <div>
          <p className="eyebrow">PDF REVIEWER</p>
          <h2>{reviewer.title}</h2>
        </div>
        <button className="mentora-button secondary" onClick={onChooseAnother}>
          <RotateCcw size={16} /> {archived ? "Back to flashcards" : "Choose another PDF"}
        </button>
      </div>
      <div className="reviewer-disclaimer">
        <strong>Generated from your PDF with AI.</strong>
        <p>
          Review important details against the original document. AI can miss
          context or make mistakes.
        </p>
      </div>
      <div className="reviewer-source">
        <FileText size={20} />
        <div>
          <span>Source PDF</span>
          <strong>{record.fileName}</strong>
        </div>
        <span>{formatPdfSize(record.size)}</span>
      </div>
      <div className="reviewer-reading-layout">
        <article className="mentora-panel reviewer-article">
          <section>
            <div className="reviewer-section-title">
              <BookOpen size={20} />
              <h3>Lesson summary</h3>
            </div>
            <p>{reviewer.summary}</p>
          </section>
          <section>
            <h3>Key concepts</h3>
            <div className="reviewer-concepts">
              {reviewer.concepts.map((concept, index) => (
                <div className="reviewer-concept" key={`${concept.title}-${index}`}>
                  <span className="concept-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h4>{concept.title}</h4>
                    <p>{concept.explanation}</p>
                    <div className="reviewer-example">
                      <strong>Example</strong> {concept.example}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </article>
        <aside className="reviewer-reading-aside">
          <section className="mentora-panel reviewer-terms">
            <p className="eyebrow">WORDS TO KNOW</p>
            <h3>Key terms</h3>
            <dl>
              {reviewer.terms.map((item, index) => (
                <div key={`${item.term}-${index}`}>
                  <dt>{item.term}</dt>
                  <dd>{item.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="reviewer-takeaways">
            <h3>Remember these ideas</h3>
            <ul>
              {reviewer.takeaways.map((item, index) => (
                <li key={`${item}-${index}`}>
                  <CheckCircle2 size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </section>
  );
}
