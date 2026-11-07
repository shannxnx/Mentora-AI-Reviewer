import {
  account,
  body,
  failure,
  json,
  RequestError,
} from "@/lib/practice/server";
import {
  emptyProfile,
  profileLimits,
  validProfile,
  type StudentProfile,
} from "@/lib/profile/model";
export async function GET() {
  try {
    const { db, user } = await account();
    const expired = await db.rpc("practice_expire");
    if (expired.error) throw expired.error;
    const [profile, summary, subjects, history, activity] = await Promise.all([
      db
        .from("student_profiles")
        .select(
          "display_name,course,year_level,learning_goal,favorite_subject,avatar",
        )
        .eq("owner_id", user.id)
        .maybeSingle(),
      db.rpc("student_summary"),
      db
        .from("study_subjects")
        .select("id,name")
        .eq("owner_id", user.id)
        .order("name")
        .limit(6),
      db
        .from("practice_attempts")
        .select("id,status,score,started_at,practice_tests(title,subject_name)")
        .eq("owner_id", user.id)
        .order("started_at", { ascending: false })
        .limit(10),
      db
        .from("study_recent_activity")
        .select("resource,kind,title,last_seen")
        .eq("owner_id", user.id)
        .order("last_seen", { ascending: false })
        .limit(8),
    ]);
    for (const result of [profile, summary, subjects, history, activity])
      if (result.error) throw result.error;
    return json({
      profile: profile.data ?? emptyProfile,
      email: user.email,
      memberSince: user.created_at,
      summary: summary.data,
      subjects: subjects.data,
      history: history.data,
      activity: activity.data,
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    const { db, user } = await account(),
      input = await body(request);
    if (!validProfile(input))
      throw new RequestError("Check your profile fields and photo.");
    const profile = Object.fromEntries(
      Object.keys(profileLimits).map((k) => [
        k,
        input[k as keyof StudentProfile].trim(),
      ]),
    ) as StudentProfile;
    const { error } = await db
      .from("student_profiles")
      .upsert({ owner_id: user.id, ...profile });
    if (error) throw error;
    return json({ profile });
  } catch (e) {
    return failure(e);
  }
}
