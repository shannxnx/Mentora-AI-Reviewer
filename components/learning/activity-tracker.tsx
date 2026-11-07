"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function ActivityTracker({
  kind,
  resource,
  title,
}: {
  kind: "reviewer" | "flashcards" | "test";
  resource: string;
  title: string;
}) {
  useEffect(() => {
    let lastInput = Date.now();
    const touch = () => {
      lastInput = Date.now();
    };
    const heartbeat = () => {
      if (
        document.visibilityState === "visible" &&
        document.hasFocus() &&
        Date.now() - lastInput < 60000
      )
        void createClient().rpc("study_heartbeat", {
          p_kind: kind,
          p_resource: resource.slice(0, 200),
          p_title: title.slice(0, 200),
        }).then(() => undefined, () => undefined);
    };
    const events = ["pointerdown", "keydown", "scroll", "pointermove"];
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    heartbeat();
    const timer = setInterval(heartbeat, 15000);
    return () => {
      clearInterval(timer);
      events.forEach((e) => window.removeEventListener(e, touch));
    };
  }, [kind, resource, title]);
  return null;
}
