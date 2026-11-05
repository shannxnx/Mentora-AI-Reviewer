import { Suspense } from "react";
import { notFound } from "next/navigation";
import { DemoShell } from "@/components/layout/demo-shell";
import { DashboardPreview } from "@/components/features/dashboard-preview";
import { StudentPdfReviewer } from "@/components/features/student-pdf-reviewer";
import { FlashcardWorkspace } from "@/components/flashcards/flashcard-workspace";
import { ComingSoon } from "@/components/features/coming-soon";
import { isDemoRole, navigation, roles } from "@/lib/demo/navigation";

type PageProps = { params: Promise<{ role: string; section?: string[] }> };
export function generateStaticParams() {
  return roles.flatMap((role) =>
    navigation[role].map((item) => ({
      role,
      section: item.slug ? [item.slug] : [],
    })),
  );
}
async function Workspace({ params }: PageProps) {
  const { role, section = [] } = await params;
  if (!isDemoRole(role) || section.length > 1) notFound();
  const slug = section[0] ?? "";
  const item = navigation[role].find((entry) => entry.slug === slug);
  if (!item) notFound();
  return (
    <DemoShell role={role} slug={slug}>
      {role === "student" && (slug === "materials" || slug === "generate") ? (
        <StudentPdfReviewer key={slug} page={slug} />
      ) : (role === "student" && (slug === "subjects" || slug === "flashcards")) || (role === "teacher" && slug === "courses") ? (
        <FlashcardWorkspace page={slug} />
      ) : slug ? (
        <ComingSoon role={role} title={item.label} />
      ) : (
        <DashboardPreview role={role} />
      )}
    </DemoShell>
  );
}
export default function DemoWorkspace(props: PageProps) {
  return (
    <Suspense
      fallback={
        <div className="demo-loading" role="status">
          Opening your workspace…
        </div>
      }
    >
      <Workspace {...props} />
    </Suspense>
  );
}
