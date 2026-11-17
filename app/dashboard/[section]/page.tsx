import { LoadingState } from "@/components/layout/loading-state";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { StudySection } from "@/components/features/study-section";

const sections = ["subjects", "materials", "generate", "flashcards", "practice", "profile", "progress"];
export function generateStaticParams() {
  return sections.map(section => ({ section }));
}
type Props = { params: Promise<{ section: string }> };
async function Section({ params }: Props) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <StudySection section={section} />;
}
export default function Page(props: Props) {
  return <Suspense fallback={<LoadingState>Opening your study tools…</LoadingState>}><Section {...props} /></Suspense>;
}
