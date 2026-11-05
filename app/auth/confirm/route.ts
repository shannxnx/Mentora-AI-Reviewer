import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const token_hash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  const destination = type === "recovery" || params.get("next") === "/auth/update-password"
    ? "/auth/update-password" : "/dashboard";
  const db = await createClient();
  if (token_hash && type) {
    const { error } = await db.auth.verifyOtp({ type, token_hash });
    if (!error) redirect(destination);
  } else if (code) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) redirect(destination);
  }
  redirect("/auth/error?error=" + encodeURIComponent("This email link is invalid or has expired."));
}
