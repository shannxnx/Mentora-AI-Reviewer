export const roles = ["student", "teacher", "admin"] as const;
export type DemoRole = (typeof roles)[number];
export function isDemoRole(value: string): value is DemoRole {
  return roles.some((role) => role === value);
}
export const demoProfiles = {
  student: {
    name: "Juan Dela Cruz",
    initials: "JC",
    label: "Student",
    description: "Build confidence, one study session at a time.",
    greeting: "Ready for your next breakthrough?",
  },
  teacher: {
    name: "Prof. Reyes",
    initials: "PR",
    label: "Teacher",
    description: "Make more room for the moments that matter in class.",
    greeting: "A clearer view of your classroom.",
  },
  admin: {
    name: "Alex Santos",
    initials: "AS",
    label: "Admin",
    description: "Keep your learning community connected and supported.",
    greeting: "Your learning community, at a glance.",
  },
} satisfies Record<
  DemoRole,
  {
    name: string;
    initials: string;
    label: string;
    description: string;
    greeting: string;
  }
>;

export type NavigationItem = { slug: string; label: string; icon: string };
export const navigation: Record<DemoRole, NavigationItem[]> = {
  student: [
    { slug: "", label: "Dashboard", icon: "dashboard" },
    { slug: "subjects", label: "My Subjects", icon: "book" },
    { slug: "materials", label: "My Materials", icon: "folder" },
    { slug: "generate", label: "Generate Reviewer", icon: "sparkles" },
    { slug: "flashcards", label: "Flashcards", icon: "cards" },
    { slug: "practice", label: "Practice Questions", icon: "question" },
    { slug: "quizzes", label: "Quizzes", icon: "quiz" },
    { slug: "progress", label: "My Progress", icon: "chart" },
    { slug: "weak-topics", label: "Weak Topics", icon: "target" },
    { slug: "settings", label: "Settings", icon: "settings" },
  ],
  teacher: [
    { slug: "", label: "Dashboard", icon: "dashboard" },
    { slug: "courses", label: "My Courses", icon: "book" },
    { slug: "students", label: "Students", icon: "users" },
    { slug: "materials", label: "Course Materials", icon: "folder" },
    { slug: "generate", label: "Generate Reviewer", icon: "sparkles" },
    { slug: "quizzes", label: "Quiz Management", icon: "quiz" },
    { slug: "performance", label: "Student Performance", icon: "chart" },
    { slug: "analytics", label: "Class Analytics", icon: "target" },
    { slug: "settings", label: "Settings", icon: "settings" },
  ],
  admin: [
    { slug: "", label: "Dashboard", icon: "dashboard" },
    { slug: "users", label: "Users", icon: "users" },
    { slug: "courses", label: "Courses & Subjects", icon: "book" },
    { slug: "settings", label: "System Settings", icon: "settings" },
    { slug: "activity", label: "Activity Logs", icon: "activity" },
  ],
};
export function demoHref(role: DemoRole, slug = "") {
  return `/demo/${role}${slug ? `/${slug}` : ""}`;
}
