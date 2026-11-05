import type { DemoRole } from "./navigation";

// Fictional fixtures only. Demo roles never authorize access to real user data.
export const dashboardData: Record<
  DemoRole,
  {
    stats: { label: string; value: string; detail: string; icon: string }[];
    listTitle: string;
    items: { title: string; subtitle: string; badge: string; slug: string }[];
    activity: string[];
  }
> = {
  student: {
    stats: [
      {
        label: "My subjects",
        value: "4",
        detail: "A world of ideas to explore",
        icon: "book",
      },
      {
        label: "Study materials",
        value: "12",
        detail: "Your knowledge, organized",
        icon: "folder",
      },
      {
        label: "Quizzes completed",
        value: "8",
        detail: "Every attempt is progress",
        icon: "quiz",
      },
      {
        label: "Average score",
        value: "80%",
        detail: "Keep building your confidence",
        icon: "chart",
      },
    ],
    listTitle: "Your study space",
    items: [
      {
        title: "Introduction to Biology",
        subtitle: "Biology · Lecture notes · 8 pages",
        badge: "PDF",
        slug: "materials",
      },
      {
        title: "Functions & Equations",
        subtitle: "Mathematics · Chapter 3 · 12 pages",
        badge: "PDF",
        slug: "materials",
      },
      {
        title: "The Art of Persuasion",
        subtitle: "English · Class discussion",
        badge: "DOC",
        slug: "materials",
      },
    ],
    activity: [
      "Completed Cell Theory quiz · 8/10",
      "Added Introduction to Biology",
      "Reviewed 12 Mathematics flashcards",
    ],
  },
  teacher: {
    stats: [
      {
        label: "My courses",
        value: "3",
        detail: "Learning spaces you lead",
        icon: "book",
      },
      {
        label: "Enrolled students",
        value: "45",
        detail: "Curious minds in your classroom",
        icon: "users",
      },
      {
        label: "Course materials",
        value: "18",
        detail: "Resources ready to explore",
        icon: "folder",
      },
      {
        label: "Quizzes created",
        value: "8",
        detail: "Opportunities to check understanding",
        icon: "quiz",
      },
    ],
    listTitle: "Your classrooms",
    items: [
      {
        title: "Grade 10 — Biology",
        subtitle: "18 students · 8 materials",
        badge: "BIO",
        slug: "courses",
      },
      {
        title: "Grade 10 — General Science",
        subtitle: "15 students · 6 materials",
        badge: "SCI",
        slug: "courses",
      },
      {
        title: "Grade 9 — Life Sciences",
        subtitle: "12 students · 4 materials",
        badge: "LIFE",
        slug: "courses",
      },
    ],
    activity: [
      "Juan completed the Cell Theory quiz",
      "Added a Biology lesson resource",
      "Published Introduction to Biology quiz",
    ],
  },
  admin: {
    stats: [
      {
        label: "Total users",
        value: "124",
        detail: "One connected learning community",
        icon: "users",
      },
      {
        label: "Students",
        value: "95",
        detail: "Learning at their own pace",
        icon: "book",
      },
      {
        label: "Teachers",
        value: "25",
        detail: "Supporting student success",
        icon: "users",
      },
      {
        label: "Administrators",
        value: "4",
        detail: "Keeping everything running",
        icon: "settings",
      },
    ],
    listTitle: "Community overview",
    items: [
      {
        title: "Student accounts",
        subtitle: "95 fictional student profiles",
        badge: "95",
        slug: "users",
      },
      {
        title: "Teaching community",
        subtitle: "25 fictional teacher profiles",
        badge: "25",
        slug: "users",
      },
      {
        title: "Course catalog",
        subtitle: "Explore the course management preview",
        badge: "EDU",
        slug: "courses",
      },
    ],
    activity: [
      "Student account created for Juan",
      "Prof. Reyes added a course material",
      "Sample platform settings reviewed",
    ],
  },
};
