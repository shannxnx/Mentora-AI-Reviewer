import { LoaderCircle } from "lucide-react";

export function LoadingState({ children }: { children: React.ReactNode }) {
  return <div className="loading-state" role="status">
    <LoaderCircle size={20} className="reviewer-spinner" aria-hidden="true" />
    <span>{children}</span>
  </div>;
}
