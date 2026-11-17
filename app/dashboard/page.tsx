import { LoadingState } from "@/components/layout/loading-state";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Layers, UploadCloud, ClipboardList, UserRound } from "lucide-react";
import { workspaceAccount } from "@/lib/supabase/server";

async function Dashboard() {
  const { db, user } = await workspaceAccount();
  if (!user) redirect("/auth/login");
  const [subjects, decks] = await Promise.all([
    db.from("study_subjects").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
    db.from("study_decks").select("id", { count: "exact", head: true }).eq("owner_id", user.id),
  ]);
  const links = [
    { href: "subjects", title: "My Subjects", icon: BookOpen,
      description: subjects.error ? "Open your subject library" : (subjects.count ?? 0) + (subjects.count === 1 ? " subject in your library" : " subjects in your library") },
    { href: "flashcards", title: "Flashcards", icon: Layers,
      description: decks.error ? "Review your saved decks" : (decks.count ?? 0) + (decks.count === 1 ? " deck ready to study" : " decks ready to study") },
    { href: "practice", title: "Practice Tests", icon: ClipboardList, description: "Test your understanding with questions from your materials" },
    { href: "profile", title: "My Profile", icon: UserRound, description: "See your progress and the topics to revisit" },
  ];
  return <section className="dashboard-home" aria-labelledby="dashboard-title">
    <h1 id="dashboard-title">Your dashboard</h1>
    <section className="dashboard-start">
      <span className="dashboard-upload-icon"><UploadCloud size={28} strokeWidth={1.6} aria-hidden="true" /></span>
      <div>
        <h2>Create your next reviewer</h2>
        <p>Upload your lecture PDF and build a study guide, flashcards, or a practice test.</p>
      </div>
      <Link className="mentora-button primary" href="/dashboard/generate">Choose a PDF<ArrowRight size={17} aria-hidden="true" /></Link>
    </section>
    <ul className="dashboard-links">
      {links.map(({ href, title, icon: Icon, description }) => <li key={href}>
        <Link className="dashboard-link" href={"/dashboard/" + href}>
          <span className="dashboard-link-icon"><Icon size={24} strokeWidth={1.6} aria-hidden="true" /></span>
          <span><strong>{title}</strong><small>{description}</small></span>
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </li>)}
    </ul>
  </section>;
}
export default function Page() {
  return <Suspense fallback={<LoadingState>Loading your dashboard…</LoadingState>}><Dashboard /></Suspense>;
}
