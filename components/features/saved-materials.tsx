"use client";

import { LoadingState } from "@/components/layout/loading-state";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Material = { id: string; subject_id: string; file_name: string; folder: string | null };
const pageSize = 12;

export function SavedMaterials({ owner }: { owner: string }) {
  const [page, setPage] = useState(0);
  const [retry, setRetry] = useState(0);
  const [rows, setRows] = useState<Material[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setRows(null);
    setFailed(false);
    const start = page * pageSize;
    void createClient().from("study_reviewers").select("id,subject_id,file_name,folder")
      .eq("owner_id", owner).order("file_name").order("id").range(start, start + pageSize)
      .abortSignal(controller.signal).then(({ data, error }) => {
        if (controller.signal.aborted) return;
        if (error) setFailed(true);
        else setRows(data);
      });
    return () => controller.abort();
  }, [owner, page, retry]);
  return <section className="mentora-panel saved-materials">
    <h2>Saved reviewers</h2>
    {failed ? <p role="alert">Couldn’t load your saved reviewers. <button className="text-link" onClick={() => setRetry(n => n + 1)}>Try again</button></p> :
      !rows ? <LoadingState>Loading saved reviewers…</LoadingState> :
      rows.length ? <ul>{rows.slice(0, pageSize).map(row => <li key={row.id}>
        <Link className="text-link" href={"/dashboard/subjects?" + new URLSearchParams({ subject: row.subject_id, guide: row.id })}>{row.file_name}</Link>
        {row.folder && <small>{row.folder}</small>}
      </li>)}</ul> : <p>Reviewers you save to a subject will appear here.</p>}
    {(page > 0 || (rows && rows.length > pageSize)) && <nav className="button-row" aria-label="Saved reviewer pages">
      <button className="text-link" disabled={!page} onClick={() => setPage(p => p - 1)}>Previous</button>
      <button className="text-link" disabled={!rows || rows.length <= pageSize} onClick={() => setPage(p => p + 1)}>Next</button>
    </nav>}
  </section>;
}
