import Link from "next/link";
import { ArrowLeft, Construction } from "lucide-react";
import { demoHref, type DemoRole } from "@/lib/demo/navigation";

export function ComingSoon({ role, title }: { role: DemoRole; title: string }) {
  return (
    <>
      <div className="page-intro">
        <div>
          <p className="eyebrow">YOUR WORKSPACE</p>
          <h1>{title}</h1>
          <p>A dedicated place for the next part of your learning journey.</p>
        </div>
      </div>
      <section className="coming-soon mentora-panel">
        <span className="coming-icon">
          <Construction size={30} />
        </span>
        <span className="subtle-badge">Coming soon</span>
        <h2>{title} is taking shape</h2>
        <p>
          This stage establishes the navigation and visual foundation.
          Interactive {role === "student" ? "study tools" : "management tools"}{" "}
          will arrive in a later stage.
        </p>
        <Link className="mentora-button primary" href={demoHref(role)}>
          <ArrowLeft size={17} /> Back to dashboard
        </Link>
        <Link className="text-link" href="/demo">
          Explore another demo role
        </Link>
      </section>
    </>
  );
}
