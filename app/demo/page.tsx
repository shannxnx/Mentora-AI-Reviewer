import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  GraduationCap,
  Presentation,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import { demoHref, demoProfiles, roles } from "@/lib/demo/navigation";

const roleIcons = {
  student: GraduationCap,
  teacher: Presentation,
  admin: ShieldCheck,
};
const descriptions = {
  student:
    "Organize your notes, discover study tools, and see where learning can take you.",
  teacher:
    "Explore a home for your courses, learning materials, and student progress.",
  admin: "See how your learning community, users, and courses fit together.",
};
export default function DemoEntry() {
  return (
    <div className="demo-entry">
      <nav className="public-nav">
        <Link href="/" aria-label="Mentora AI home">
          <Brand />
        </Link>
        <Link href="/" className="text-link">
          <ArrowLeft size={16} /> Back to home
        </Link>
      </nav>
      <main className="demo-entry-main">
        <p className="eyebrow">MEET YOUR NEW LEARNING SPACE</p>
        <h1>
          Three perspectives.
          <br />
          <span>One shared purpose.</span>
        </h1>
        <p className="entry-description">
          Take a look around Mentora AI. Choose a fictional account to explore
          the prototype — no signup needed.
        </p>
        <div className="role-grid">
          {roles.map((role) => {
            const Icon = roleIcons[role];
            return (
              <Link key={role} className="role-card" href={demoHref(role)}>
                <span className={`role-icon ${role}`}>
                  <Icon size={28} />
                </span>
                <span className="eyebrow">EXPLORE AS A</span>
                <h2>{demoProfiles[role].label}</h2>
                <p>{descriptions[role]}</p>
                <span className="role-person">
                  {demoProfiles[role].name} · Fictional account
                </span>
                <span className="role-action">
                  Open workspace <ArrowRight size={18} />
                </span>
              </Link>
            );
          })}
        </div>
        <p className="demo-entry-note">
          <ShieldCheck size={16} /> Demo roles only affect sample screens. They
          do not create an account or grant real permissions.
        </p>
      </main>
      <footer className="public-footer">
        Mentora AI · Built for curious minds
      </footer>
    </div>
  );
}
