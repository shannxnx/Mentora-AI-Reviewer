import Link from "next/link";
import { Brand } from "@/components/layout/brand";
import "@/app/mentora.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="mentora-theme auth-shell">
    <Link href="/" className="auth-brand" aria-label="Mentora home"><Brand /></Link>
    {children}
  </main>;
}
