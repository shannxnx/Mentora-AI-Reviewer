"use client";

import { createContext, useContext, useEffect, useState } from "react";
import {
  parseStoredReviewer,
  type ReviewerRecord,
} from "@/lib/reviewer/pdf-reviewer";

const STORAGE_KEY = "mentora.student.pdf-reviewer.v2";
type ReviewerState = {
  record: ReviewerRecord | null;
  ready: boolean;
  storageNotice: string;
  saveRecord: (record: ReviewerRecord) => void;
};
const ReviewerContext = createContext<ReviewerState | null>(null);

export function StudentReviewerProvider({ children, owner }: { children: React.ReactNode; owner?: string }) {
  const storageKey = owner ? STORAGE_KEY + "." + owner : STORAGE_KEY;
  const [record, setRecord] = useState<ReviewerRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  useEffect(() => {
    try {
      setRecord(parseStoredReviewer(sessionStorage.getItem(storageKey)));
    } catch {
      setStorageNotice(
        "Browser storage is unavailable. Your reviewer will remain available until you reload this page.",
      );
    }
    setReady(true);
  }, [storageKey]);

  function saveRecord(next: ReviewerRecord) {
    setRecord(next);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next));
      setStorageNotice("");
    } catch {
      setStorageNotice(
        "Your reviewer is ready, but could not be remembered after a reload.",
      );
    }
  }
  return (
    <ReviewerContext.Provider
      value={{ record, ready, storageNotice, saveRecord }}
    >
      {children}
    </ReviewerContext.Provider>
  );
}

export function useStudentReviewer() {
  const context = useContext(ReviewerContext);
  if (!context) throw new Error("StudentReviewerProvider is required.");
  return context;
}
