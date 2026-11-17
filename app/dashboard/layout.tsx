import { LoadingState } from "@/components/layout/loading-state";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { workspaceAccount } from "@/lib/supabase/server";
import { StudentReviewerProvider } from "@/components/features/student-reviewer-provider";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import "@/app/mentora.css";
import "@/components/flashcards/flashcards.css";
import "@/components/learning/learning.css";

async function SignedInWorkspace({ children }: { children: React.ReactNode }) {
  const { user } = await workspaceAccount();
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
  return <Suspense fallback={<div className="mentora-theme workspace-opening"><LoadingState>Opening your workspace…</LoadingState></div>}>
    <SignedInWorkspace>{children}</SignedInWorkspace>
  </Suspense>;
}
