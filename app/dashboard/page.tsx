import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BookOpen, Layers, UploadCloud } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

async function Dashboard() {
  const db = await createClient();
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/auth/login");
  const [subjects, decks] = await Promise.all([
    db.from("study_subjects").select("id", { count: "exact", head: true }).eq("owner_id", claims.sub),
    db.from("study_decks").select("id", { count: "exact", head: true }).eq("owner_id", claims.sub),
  ]);
  return <section className="subject-directory" aria-labelledby="dashboard-title">
    <h1 id="dashboard-title">Your dashboard</h1>
    <ul className="subject-grid">
      <li><Link className="subject-tile" href="/dashboard/subjects"><strong>My Subjects</strong><span className="subject-glyph"><BookOpen size={38} /></span><span className="subject-tile-foot">{subjects.error ? "View subjects" : subjects.count + (subjects.count === 1 ? " subject" : " subjects")}<ArrowRight size={16} /></span></Link></li>
      <li><Link className="subject-tile" href="/dashboard/generate"><strong>Generate Reviewer</strong><span className="subject-glyph"><UploadCloud size={38} /></span><span className="subject-tile-foot">Choose a PDF<ArrowRight size={16} /></span></Link></li>
      <li><Link className="subject-tile" href="/dashboard/flashcards"><strong>Flashcards</strong><span className="subject-glyph"><Layers size={38} /></span><span className="subject-tile-foot">{decks.error ? "View decks" : decks.count + (decks.count === 1 ? " deck" : " decks")}<ArrowRight size={16} /></span></Link></li>
    </ul>
  </section>;
}
export default function Page() {
  return <Suspense fallback={<p role="status">Loading your dashboard…</p>}><Dashboard /></Suspense>;
}
