import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  Clock3,
  Sparkles,
} from "lucide-react";
import { dashboardData } from "@/lib/demo/data";
import { demoHref, demoProfiles, type DemoRole } from "@/lib/demo/navigation";
import { DemoIcon } from "@/components/layout/demo-shell";

export function DashboardPreview({ role }: { role: DemoRole }) {
  const data = dashboardData[role];
  const profile = demoProfiles[role];
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">A SPACE TO GROW</p>
          <h1>
            {role === "student"
              ? "Welcome back, Juan"
              : `Welcome, ${profile.name}`}
            <span className="greeting-dot">.</span>
          </h1>
          <p>{profile.description}</p>
        </div>
        <span className="sample-label">
          <span className="status-dot" /> Sample dashboard
        </span>
      </div>
      <section className="stats-grid" aria-label="Sample statistics">
        {data.stats.map((stat) => (
          <article key={stat.label} className="stat-card">
            <div className="stat-top">
              <span>{stat.label}</span>
              <span className="stat-icon">
                <DemoIcon name={stat.icon} />
              </span>
            </div>
            <strong>{stat.value}</strong>
            <p>{stat.detail}</p>
          </article>
        ))}
      </section>
      <section className="dashboard-banner">
        <div className="banner-copy">
          <span className="banner-label">
            <Sparkles size={15} /> YOUR LEARNING COMPANION
          </span>
          <h2>{profile.greeting}</h2>
          <p>
            {role === "student"
              ? "Turn your lecture notes into clearer concepts, better questions, and small moments of understanding."
              : "Bring your materials, people, and progress together in one thoughtfully organized workspace."}
          </p>
          <Link
            className="mentora-button primary"
            href={demoHref(role, role === "admin" ? "courses" : "generate")}
          >
            {role === "admin"
              ? "Explore course management"
              : role === "student"
                ? "Upload a PDF"
                : "Explore reviewer generation"}
            <ArrowRight size={17} />
          </Link>
          <span className="banner-caption">
            {role === "student"
              ? "PDF selection · Fixed sample reviewer"
              : "Feature preview · Coming soon"}
          </span>
        </div>
        <div className="banner-illustration" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="illustration-card">
            <span className="illustration-icon">
              <BookOpen size={28} />
            </span>
            <div className="illustration-line" />
            <div className="illustration-line short" />
            <div className="illustration-check">
              <Check size={14} /> One concept clearer
            </div>
          </div>
          <span className="floating-spark">
            <Sparkles size={24} />
          </span>
        </div>
      </section>
      <div className="dashboard-columns">
        <section className="mentora-panel">
          <div className="panel-heading">
            <div>
              <h2>{data.listTitle}</h2>
              <p>A few things to pick up next</p>
            </div>
            <span className="subtle-badge">Sample data</span>
          </div>
          <div className="resource-list">
            {data.items.map((item, index) => (
              <Link
                key={item.title}
                href={demoHref(role, item.slug)}
                className="resource-row"
              >
                <span className={`resource-icon tone-${index}`}>
                  <BookOpen size={21} />
                </span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.subtitle}</p>
                </div>
                <span className="file-badge">{item.badge}</span>
                <ArrowUpRight size={18} className="resource-arrow" />
                <span className="sr-only">
                  {role === "student"
                    ? " — Open PDF upload"
                    : " — Coming soon preview"}
                </span>
              </Link>
            ))}
          </div>
          <div className="panel-foot">
            <Clock3 size={14} /> Demonstration records, ready to explore.
          </div>
        </section>
        <section className="mentora-panel">
          <div className="panel-heading">
            <div>
              <h2>Small steps, real momentum</h2>
              <p>Recent activity · Sample</p>
            </div>
          </div>
          <ol className="activity-list">
            {data.activity.map((item, i) => (
              <li key={item}>
                <span className="activity-dot">
                  <Check size={12} />
                </span>
                <div>
                  <p>{item}</p>
                  <span>{["Today", "Yesterday", "2 days ago"][i]}</span>
                </div>
              </li>
            ))}
          </ol>
          <div className="encouragement">
            Learning is a journey.
            <br />
            <strong>You have a place to start.</strong>
          </div>
        </section>
      </div>
    </>
  );
}
