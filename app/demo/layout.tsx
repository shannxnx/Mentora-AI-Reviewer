import "@/app/mentora.css";
import "@/components/flashcards/flashcards.css";
import { StudentReviewerProvider } from "@/components/features/student-reviewer-provider";

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mentora-theme">
      <StudentReviewerProvider>{children}</StudentReviewerProvider>
    </div>
  );
}
