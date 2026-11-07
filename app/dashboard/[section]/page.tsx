import { Suspense } from "react";
import { notFound } from "next/navigation";
import { FlashcardWorkspace } from "@/components/flashcards/flashcard-workspace";
import { StudentPdfReviewer } from "@/components/features/student-pdf-reviewer";
import { PracticeWorkspace } from "@/components/practice/practice-workspace";
import { StudentProfilePage } from "@/components/profile/student-profile";

export function generateStaticParams() {
  return ["subjects", "materials", "generate", "flashcards", "practice", "profile"].map(section => ({ section }));
}
type Props = { params: Promise<{ section: string }> };
async function Section({ params }: Props) {
  const { section } = await params;
  if (section === "practice") return <PracticeWorkspace />;
  if (section === "profile" || section === "progress") return <StudentProfilePage />;
  if (section === "materials" || section === "generate")
    return <StudentPdfReviewer key={section} page={section} />;
  if (section === "subjects" || section === "flashcards")
    return <FlashcardWorkspace key={section} page={section} />;
  notFound();
}
export default function Page(props: Props) {
  return <Suspense fallback={<p role="status">Opening your study tools…</p>}><Section {...props} /></Suspense>;
}
