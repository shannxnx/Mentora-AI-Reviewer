import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StudentReviewerProvider } from "@/components/features/student-reviewer-provider";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import "@/app/mentora.css";
import "@/components/flashcards/flashcards.css";

async function SignedInWorkspace({ children }: { children: React.ReactNode }) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) redirect("/auth/login");
  return (
    <div className="mentora-theme">
      <WorkspaceShell accountId={user.id} email={user.email ?? "My account"}>
        <StudentReviewerProvider key={user.id} owner={user.id}>{children}</StudentReviewerProvider>
      </WorkspaceShell>
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<p role="status">Opening your workspace…</p>}>
    <SignedInWorkspace>{children}</SignedInWorkspace>
  </Suspense>;
}
