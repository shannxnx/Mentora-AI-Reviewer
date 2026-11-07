"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BookOpen, FolderOpen, LayoutDashboard, Layers, LogOut, Menu, Sparkles, ClipboardList, UserRound } from "lucide-react";
import { Brand } from "./brand";
import { createClient } from "@/lib/supabase/client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const pages = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/subjects", label: "My Subjects", icon: BookOpen },
  { href: "/dashboard/materials", label: "My Materials", icon: FolderOpen },
  { href: "/dashboard/generate", label: "Generate Reviewer", icon: Sparkles },
  { href: "/dashboard/flashcards", label: "Flashcards", icon: Layers },
  { href: "/dashboard/practice", label: "Practice Tests", icon: ClipboardList },
  { href: "/dashboard/profile", label: "My Profile", icon: UserRound },
];

export function WorkspaceShell({ accountId, email, children }: { accountId: string; email: string; children: React.ReactNode }) {
  const path = usePathname();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const { data } = await createClient().from("student_profiles").select("display_name").eq("owner_id", accountId).maybeSingle();
      if (active) setDisplayName(data?.display_name || "");
    };
    void refresh(); window.addEventListener("mentora-profile-updated", refresh);
    return () => { active = false; window.removeEventListener("mentora-profile-updated", refresh); };
  }, [accountId]);
  useEffect(() => {
    const { data } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== accountId) window.location.replace(session ? "/dashboard" : "/auth/login");
    });
    return () => data.subscription.unsubscribe();
  }, [accountId]);
  async function signOut() {
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signOut({ scope: "local" });
    if (error) { setError("Couldn’t sign out. Please try again."); setBusy(false); }
    else window.location.replace("/auth/login");
  }
  const links = pages.map(({ href, label, icon: Icon }) => (
    <Link key={href} href={href} aria-current={path === href ? "page" : undefined}><Icon size={18} aria-hidden="true" /> {label}</Link>
  ));
  return <div className="mentora-app" data-subjects>
    <a className="mentora-skip" href="#main-content">Skip to content</a>
    <aside className="mentora-sidebar">
      <Link href="/dashboard" aria-label="Mentora dashboard"><Brand /></Link>
      <div className="workspace-label">My workspace</div>
      <nav className="mentora-nav" aria-label="Main navigation">{links}</nav>
    </aside>
    <div className="mentora-workspace">
      <header className="mentora-header">
        <div className="header-title">
          <DropdownMenu>
            <DropdownMenuTrigger className="icon-button mobile-menu" aria-label="Open navigation"><Menu size={22} /></DropdownMenuTrigger>
            <DropdownMenuContent align="start">{links.map(link => <DropdownMenuItem asChild key={link.key}>{link}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>
          <strong>{pages.find(p => p.href === path)?.label ?? "My workspace"}</strong>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="profile-trigger" aria-label="Open account menu"><span className="avatar">{(displayName || email).charAt(0).toUpperCase()}</span></DropdownMenuTrigger>
          <DropdownMenuContent align="end"><div className="px-2 py-1 text-sm">{displayName || email}</div><DropdownMenuItem asChild><Link href="/dashboard/profile"><UserRound size={16} /> My profile</Link></DropdownMenuItem><DropdownMenuItem disabled={busy} onSelect={() => void signOut()}><LogOut size={16} /> Sign out</DropdownMenuItem></DropdownMenuContent>
        </DropdownMenu>
      </header>
      {error && <p role="alert">{error}</p>}
      <main id="main-content" className="mentora-main" tabIndex={-1}>{children}</main>
    </div>
  </div>;
}
