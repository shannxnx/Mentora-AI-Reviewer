import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { dateLabel } from "@/lib/learning/http";

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
