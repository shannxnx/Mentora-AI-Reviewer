"use client";

import Link from "next/link";
import {
  Activity,
  Bell,
  BookOpen,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  FolderOpen,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  ArrowLeftRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  demoHref,
  demoProfiles,
  navigation,
  type DemoRole,
} from "@/lib/demo/navigation";
import { Brand } from "./brand";

const icons: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  book: BookOpen,
  folder: FolderOpen,
  sparkles: Sparkles,
  cards: Layers,
  question: CircleHelp,
  quiz: ClipboardCheck,
  chart: TrendingUp,
  target: Target,
  settings: Settings,
  users: Users,
  activity: Activity,
};
export function DemoIcon({ name, size = 19 }: { name: string; size?: number }) {
  const Icon = icons[name] ?? BookOpen;
  return <Icon size={size} aria-hidden="true" />;
}

export function DemoShell({
  role,
  slug,
  children,
}: {
  role: DemoRole;
  slug: string;
  children: React.ReactNode;
}) {
  const profile = demoProfiles[role];
  const subjectPage = role === "student" && slug === "subjects";
  const title =
    navigation[role].find((item) => item.slug === slug)?.label ?? "Dashboard";
  return (
    <div className="mentora-app" data-subjects={subjectPage || undefined}>
      <a className="mentora-skip" href="#main-content">
        Skip to content
      </a>
      <aside className="mentora-sidebar">
        <Link href="/" aria-label="Mentora AI home">
          <Brand />
        </Link>
        <div className="workspace-label">
          {profile.label} workspace <span>DEMO</span>
        </div>
        <nav aria-label="Main navigation" className="mentora-nav">
          {navigation[role].map((item) => (
            <Link
              key={item.slug}
              href={demoHref(role, item.slug)}
              aria-current={slug === item.slug ? "page" : undefined}
            >
              <DemoIcon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <Sparkles size={22} />
            <strong>A little progress, every day.</strong>
            <p>Your next chapter starts with curiosity.</p>
          </div>
          <Link href="/demo" className="switch-workspace">
            <ArrowLeftRight size={17} /> Switch demo role
          </Link>
        </div>
      </aside>
      <div className="mentora-workspace">
        <header className="mentora-header">
          <div className="header-title">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="icon-button mobile-menu"
                aria-label="Open navigation"
              >
                <Menu size={22} />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="max-h-[75vh] overflow-y-auto"
              >
                {navigation[role].map((item) => (
                  <DropdownMenuItem key={item.slug} asChild>
                    <Link
                      href={demoHref(role, item.slug)}
                      aria-current={slug === item.slug ? "page" : undefined}
                    >
                      {item.label}
                    </Link>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/demo">Switch demo role</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="header-workspace">
              Workspace <span>/</span>
            </span>
            <strong>{title}</strong>
          </div>
          <div className="header-actions">
            <span className="demo-pill">Demo mode</span>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="icon-button notification-button"
                aria-label="Open notifications"
              >
                <Bell size={20} />
                <span className="notification-dot" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Notifications · Sample</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="p-3 text-sm">
                  <p className="font-medium">Welcome to your study space</p>
                  <p className="mt-1 text-muted-foreground">
                    Try the student PDF sample reviewer from the Generate
                    Reviewer page.
                  </p>
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="profile-trigger"
                aria-label="Open profile menu"
              >
                <span className="avatar">{profile.initials}</span>
                <ChevronDown size={15} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {profile.name}
                  <p className="text-xs font-normal text-muted-foreground">
                    Fictional {profile.label.toLowerCase()} account
                  </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href={demoHref(role, "settings")}>
                    <Settings size={16} /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/demo">
                    <ArrowLeftRight size={16} /> Switch demo role
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/">
                    <LogOut size={16} /> Leave demo
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {!subjectPage && <div className="demo-notice">
          <span className="status-dot" />
          Prototype preview <span className="notice-divider">/</span> Dashboard
          data is fictional. The PDF reviewer sends selected files to Google
          Gemini; Mentora does not save them.
        </div>}
        <main id="main-content" className="mentora-main" tabIndex={-1}>
          {children}
        </main>
        {!subjectPage && <footer className="workspace-footer">
          <span>Mentora AI · A better way to learn</span>
          <span>PDF reviewer preview · 02</span>
        </footer>}
      </div>
    </div>
  );
}
