import { Sparkles } from "lucide-react";

export function Brand() {
  return (
    <span className="mentora-brand">
      <span className="mentora-mark">
        <Sparkles size={20} aria-hidden="true" />
      </span>
      <span>
        Mentora <span className="mentora-ai">AI</span>
      </span>
    </span>
  );
}
