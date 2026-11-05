import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Check,
  Layers,
  Sparkles,
  Target,
} from "lucide-react";
import { Brand } from "@/components/layout/brand";
import "./mentora.css";

export default function Home() {
  return (
    <div className="mentora-theme landing">
      <nav className="public-nav">
        <Link href="/" aria-label="Mentora AI home">
          <Brand />
        </Link>
        <div className="public-nav-links">
          <a href="#how-it-works">How it works</a>
          <Link href="/auth/login">Log in</Link>
          <Link className="mentora-button primary small" href="/auth/sign-up">
            Get started <ArrowRight size={15} />
          </Link>
        </div>
      </nav>
      <main>
        <section className="landing-hero">
          <div className="hero-copy">
            <span className="hero-badge">
              <Sparkles size={15} /> A LITTLE CLARITY GOES A LONG WAY
            </span>
            <h1>
              Less overwhelm.
              <br />
              More <span>understanding.</span>
            </h1>
            <p>
              A calmer place to turn lecture notes into study resources, put
              your knowledge to the test, and find your next step forward.
            </p>
            <div className="hero-actions">
              <Link className="mentora-button primary" href="/auth/sign-up">
                Create an account <ArrowRight size={18} />
              </Link>
              <Link className="mentora-button secondary" href="/auth/login">
                Log in
              </Link>
            </div>
          </div>
          <div className="hero-preview">
            <div className="preview-top">
              <span className="preview-dots">● ● ●</span>
              <span>YOUR LEARNING, CONNECTED</span>
            </div>
            <div className="preview-body">
              <div className="preview-greeting">
                <span className="eyebrow">BIOLOGY / CHAPTER 01</span>
                <span className="subtle-badge">Sample</span>
              </div>
              <h2>
                Big ideas.
                <br />
                Bite-sized breakthroughs.
              </h2>
              <div className="preview-note">
                <span className="stat-icon">
                  <BookOpen size={22} />
                </span>
                <div>
                  <strong>Introduction to Biology</strong>
                  <p>Lecture notes · 8 pages</p>
                </div>
                <Check size={17} />
              </div>
              <div className="preview-connector" />
              <div className="preview-tools">
                <span>
                  <Sparkles size={19} /> Summaries
                </span>
                <span>
                  <Layers size={19} /> Flashcards
                </span>
                <span>
                  <Target size={19} /> Practice
                </span>
              </div>
              <div className="preview-quote">
                “All living things are made of cells.”
                <span>One key concept. A clearer starting point.</span>
              </div>
              <div className="preview-bottom">
                <span className="status-dot" /> Your next chapter starts here.
              </div>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="how-section">
          <div className="how-heading">
            <p className="eyebrow">A SIMPLE PATH TO PROGRESS</p>
            <h2>
              From “where do I start?”
              <br />
              to “I understand this.”
            </h2>
            <p>The learning journey we’re building for you.</p>
          </div>
          <div className="how-grid">
            {[
              {
                number: "01",
                title: "Bring your materials",
                copy: "Keep lecture notes and learning resources together, organized by subject.",
              },
              {
                number: "02",
                title: "Make the ideas click",
                copy: "Explore summaries, key concepts, and flashcards grounded in your materials.",
              },
              {
                number: "03",
                title: "Find your next step",
                copy: "Practice, reflect on your results, and focus on the topics that need attention.",
              },
            ].map((step) => (
              <article key={step.number}>
                <span>{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <footer className="public-footer">
        <Brand />
        <span>Built for curious minds. Designed for everyday progress.</span>
        <Link href="/auth/sign-up">
          Get started <ArrowRight size={16} />
        </Link>
      </footer>
    </div>
  );
}
