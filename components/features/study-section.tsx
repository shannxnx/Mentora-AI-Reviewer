"use client";

import { LoadingState } from "@/components/layout/loading-state";
import dynamic from "next/dynamic";

const loading = () => <LoadingState>Opening your study tools…</LoadingState>;
const Flashcards = dynamic(() => import("@/components/flashcards/flashcard-workspace").then(m => m.FlashcardWorkspace), { loading });
const Reviewer = dynamic(() => import("./student-pdf-reviewer").then(m => m.StudentPdfReviewer), { loading });
const Practice = dynamic(() => import("@/components/practice/practice-workspace").then(m => m.PracticeWorkspace), { loading });
const Profile = dynamic(() => import("@/components/profile/student-profile").then(m => m.StudentProfilePage), { loading });

export function StudySection({ section }: { section: string }) {
  if (section === "practice") return <Practice />;
  if (section === "profile" || section === "progress") return <Profile />;
  if (section === "materials" || section === "generate") return <Reviewer key={section} page={section} />;
  if (section === "subjects" || section === "flashcards") return <Flashcards key={section} page={section} />;
  return null;
}
