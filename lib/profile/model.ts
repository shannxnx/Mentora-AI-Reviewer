export type StudentProfile = {
  display_name: string;
  course: string;
  year_level: string;
  learning_goal: string;
  favorite_subject: string;
  avatar: string;
};
export const emptyProfile: StudentProfile = {
  display_name: "",
  course: "",
  year_level: "",
  learning_goal: "",
  favorite_subject: "",
  avatar: "",
};
export const profileLimits = {
  display_name: 100,
  course: 120,
  year_level: 40,
  learning_goal: 300,
  favorite_subject: 100,
  avatar: 200000,
};
export function validProfile(value: unknown): value is StudentProfile {
  if (!value || typeof value !== "object") return false;
  const v = value as StudentProfile;
  return (
    Object.entries(profileLimits).every(
      ([k, max]) =>
        typeof v[k as keyof StudentProfile] === "string" &&
        v[k as keyof StudentProfile].length <= max,
    ) &&
    (!v.avatar ||
      /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v.avatar))
  );
}
