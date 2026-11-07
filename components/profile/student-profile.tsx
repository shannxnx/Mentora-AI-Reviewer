"use client";
import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  Pencil,
  Target,
  TrendingUp,
} from "lucide-react";
import { dateLabel, requestJson } from "@/lib/learning/http";
import { profileLimits, type StudentProfile } from "@/lib/profile/model";
import { AttemptHistory } from "@/components/practice/practice-workspace";

type ProfileData = {
  profile: StudentProfile;
  email: string;
  memberSince: string;
  subjects: { id: string; name: string }[];
  summary: {
    subjects: number;
    reviewers: number;
    tests: number;
    average: number | null;
    seconds: number;
    topics: { key: string; name: string; count: number; percentage: number }[];
  };
  history: {
    id: string;
    status: string;
    score: number | null;
    started_at: string;
    practice_tests: { title: string; subject_name: string };
  }[];
  activity: {
    resource: string;
    kind: string;
    title: string;
    last_seen: string;
  }[];
};
export function StudentProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null),
    [error, setError] = useState(""),
    [editing, setEditing] = useState(false),
    [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    setError("");
    try {
      setData(await requestJson<ProfileData>("/api/profile"));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (!data)
    return (
      <section className="learning-card">
        <h1>Your learning profile</h1>
        <p role={error ? "alert" : "status"}>
          {error || "Loading your profile…"}
        </p>
        {error && (
          <button className="learning-button" onClick={() => void load()}>
            Retry
          </button>
        )}
      </section>
    );
  const { profile, summary } = data;
  const name = profile.display_name || "Your learning profile",
    initials = profile.display_name
      ? profile.display_name
          .split(/\s+/)
          .map((s) => s[0])
          .slice(0, 2)
          .join("")
      : data.email?.[0]?.toUpperCase() || "S";
  const trend = [...data.history].reverse().filter((h) => h.score !== null);
  return (
    <div className="learning-page profile-page">
      <header className="learning-heading">
        <div>
          <h1>My profile</h1>
          <p>Your subjects, study activity, and test results.</p>
        </div>
        <button
          className="small-button"
          onClick={() => {
            setEditing(!editing);
            setNotice("");
          }}
        >
          <Pencil size={16} /> {editing ? "Close editor" : "Edit profile"}
        </button>
      </header>
      {notice && (
        <p role="status" className="learning-notice success">
          <Check size={17} /> {notice}
        </p>
      )}
      {editing && (
        <ProfileEditor
          profile={profile}
          onCancel={() => setEditing(false)}
          onSave={(p) => {
            setData((d) => d && { ...d, profile: p });
            setEditing(false);
            setNotice("Your profile has been saved.");
            window.dispatchEvent(new Event("mentora-profile-updated"));
          }}
        />
      )}
      <section className="learning-card profile-identity">
        <div className="identity-main">
          <div className="profile-avatar">
            {profile.avatar ? (
              <Image
                unoptimized
                src={profile.avatar}
                alt="Your profile photo"
                width={92}
                height={92}
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <div>
            <span className="learning-tag">Student</span>
            <h2>{name}</h2>
            <p>{data.email}</p>
            <p className="icon-line">
              <GraduationCap size={16} /> {profile.course || "Add your course"}
              {profile.year_level && " · " + profile.year_level}
            </p>
          </div>
        </div>
        <dl className="identity-details">
          <div>
            <dt>
              <CalendarDays size={16} /> Member since
            </dt>
            <dd>{dateLabel(data.memberSince)}</dd>
          </div>
          <div>
            <dt>
              <Target size={16} /> Learning goal
            </dt>
            <dd>{profile.learning_goal || "Set a goal that motivates you"}</dd>
          </div>
          <div>
            <dt>
              <BookOpen size={16} /> Favorite subject
            </dt>
            <dd>{profile.favorite_subject || "Choose a favorite"}</dd>
          </div>
        </dl>
      </section>
      <div className="profile-stats">
        <Stat
          icon={<BookOpen />}
          value={String(summary.subjects)}
          label="My subjects"
          note="Your study library"
        />
        <Stat
          icon={<ClipboardCheck />}
          value={String(summary.tests)}
          label="Tests completed"
          note="Every graded attempt"
        />
        <Stat
          icon={<TrendingUp />}
          value={summary.average === null ? "—" : summary.average + "%"}
          label="Average score"
          note="Across completed tests"
        />
        <Stat
          icon={<Clock3 />}
          value={
            Math.floor(summary.seconds / 3600) +
            "h " +
            Math.floor((summary.seconds % 3600) / 60) +
            "m"
          }
          label="Study time"
          note="Active learning time"
        />
      </div>
      <div className="profile-columns">
        <section className="learning-card">
          <div className="section-heading">
            <h2>My subjects</h2>
            <Link className="text-link" href="/dashboard/subjects">
              View all <ArrowRight size={14} />
            </Link>
          </div>
          <div className="learning-list">
            {data.subjects.length ? (
              data.subjects.map((s) => (
                <Link
                  className="subject-profile-row"
                  key={s.id}
                  href={"/dashboard/subjects?subject=" + s.id}
                >
                  <span className="icon-tile small">
                    <BookOpen size={17} />
                  </span>
                  <strong>{s.name}</strong>
                  <ArrowRight size={17} />
                </Link>
              ))
            ) : (
              <p className="muted">
                Your subjects will appear here.{" "}
                <Link href="/dashboard/subjects" className="text-link">
                  Add your first subject
                </Link>
              </p>
            )}
          </div>
        </section>
        <section className="learning-card">
          <div className="section-heading">
            <div>
              <h2>Your progress</h2>
              <p className="muted">Scores from your recent test history</p>
            </div>
            <span className="icon-tile small">
              <TrendingUp size={20} />
            </span>
          </div>
          {trend.length ? (
            <div className="score-trend" aria-label="Recent test scores">
              {trend.map((h) => (
                <Link
                  href={"/dashboard/practice?attempt=" + h.id}
                  key={h.id}
                  className="trend-column"
                  aria-label={
                    h.practice_tests.title +
                    ": " +
                    h.score +
                    "% on " +
                    dateLabel(h.started_at)
                  }
                >
                  <strong>{h.score}%</strong>
                  <div className="trend-track">
                    <span style={{ height: Math.max(h.score!, 2) + "%" }} />
                  </div>
                  <small>
                    {new Date(h.started_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </small>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-inline">
              <TrendingUp size={28} />
              <p>
                Complete your first practice test to start seeing your progress.
              </p>
              <Link className="text-link" href="/dashboard/practice">
                Start practicing <ArrowRight size={14} />
              </Link>
            </div>
          )}
        </section>
      </div>
      <section className="learning-card">
        <div className="section-heading">
          <div>
            <h2>Topics to focus on</h2>
            <p className="muted">
              Lowest-scoring topics across your graded attempts. More practice
              makes these insights more useful.
            </p>
          </div>
          <Target size={23} />
        </div>
        {summary.topics.length ? (
          <div className="topic-grid">
            {summary.topics.map((t) => (
              <div className="topic-item" key={t.key}>
                <div>
                  <strong>{t.name}</strong>
                  <span>{t.percentage}%</span>
                </div>
                <progress
                  max={100}
                  value={t.percentage}
                  aria-label={t.name + " average"}
                />
                <small>
                  {t.count} question responses ·{" "}
                  {t.percentage < 70 ? "Worth revisiting" : "Keep it fresh"}
                </small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            Topic insights will appear after your first graded test.
          </p>
        )}
      </section>
      <section className="learning-card">
        <div className="section-heading">
          <h2>Recent test history</h2>
          <Link className="text-link" href="/dashboard/practice">
            View all <ArrowRight size={14} />
          </Link>
        </div>
        <AttemptHistory history={data.history} />
      </section>
      <div className="profile-columns">
        <section className="learning-card">
          <div className="section-heading">
            <h2>Recent learning activity</h2>
            <span className="learning-tag">
              {summary.reviewers} saved reviewers
            </span>
          </div>
          <div className="learning-list">
            {data.activity.length ? (
              data.activity.map((a) => (
                <div className="list-row" key={a.kind + a.resource}>
                  <span className="icon-tile small">
                    <FileText size={17} />
                  </span>
                  <div>
                    <strong>{a.title}</strong>
                    <small>
                      {a.kind === "reviewer"
                        ? "Read a reviewer"
                        : a.kind === "flashcards"
                          ? "Practiced flashcards"
                          : "Worked on a test"}{" "}
                      · {dateLabel(a.last_seen)}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <p className="muted">
                Your reviewer, flashcard, and test activity will appear as you
                study.
              </p>
            )}
          </div>
          <p className="fine-print">
            Study time starts tracking from this update, while a study screen is
            active. Inactive time is excluded.
          </p>
        </section>
        <section className="learning-card blue-card profile-next">
          <span className="icon-tile">
            <Target size={24} />
          </span>
          <h2>Practice a topic</h2>
          <p>
            Choose a topic, revisit your notes, and put your understanding into
            practice.
          </p>
          <Link className="learning-button" href="/dashboard/practice">
            Take a practice test <ArrowRight size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}
function Stat({
  icon,
  value,
  label,
  note,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  note: string;
}) {
  return (
    <section className="learning-card stat-card">
      <span className="icon-tile">{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
    </section>
  );
}
function ProfileEditor({
  profile,
  onSave,
  onCancel,
}: {
  profile: StudentProfile;
  onSave: (p: StudentProfile) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(profile),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function photo(file: File | undefined) {
    if (!file) return;
    try {
      if (
        !/^image\/(jpeg|png|webp)$/.test(file.type) ||
        file.size > 5 * 1024 * 1024
      )
        throw new Error("Choose a JPG, PNG, or WebP photo under 5 MB.");
      const bitmap = await createImageBitmap(file),
        canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext("2d")!,
        side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(
        bitmap,
        (bitmap.width - side) / 2,
        (bitmap.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
      bitmap.close();
      setDraft((d) => ({ ...d, avatar: canvas.toDataURL("image/jpeg", 0.85) }));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="learning-card profile-editor">
      <h2>Edit your profile</h2>
      <form
        className="learning-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const result = await requestJson<{ profile: StudentProfile }>(
              "/api/profile",
              { method: "PUT", body: JSON.stringify(draft) },
            );
            onSave(result.profile);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <fieldset disabled={busy}>
          <div className="form-grid">
            {(
              [
                ["display_name", "Full name"],
                ["course", "Course / program"],
                ["year_level", "Year level"],
                ["favorite_subject", "Favorite subject"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                    aria-label={label}
                  maxLength={profileLimits[key]}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [key]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Learning goal
            <textarea
                aria-label="Learning goal"
              rows={2}
              maxLength={300}
              value={draft.learning_goal}
              onChange={(e) =>
                setDraft((d) => ({ ...d, learning_goal: e.target.value }))
              }
              placeholder="What would you like to understand better?"
            />
          </label>
          <label>
            Profile photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => void photo(e.target.files?.[0])}
            />
          </label>
          {draft.avatar && (
            <div className="button-row">
              <Image
                unoptimized
                src={draft.avatar}
                alt="Selected profile photo"
                width={56}
                height={56}
              />
              <button
                type="button"
                className="text-button"
                onClick={() => setDraft((d) => ({ ...d, avatar: "" }))}
              >
                Remove photo
              </button>
            </div>
          )}
          <div className="button-row">
            <button className="learning-button">
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button className="small-button" type="button" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="learning-notice error">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
