"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function RefreshButton() {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  async function refresh() {
    setSpinning(true);
    try {
      await fetch("/api/summary?refresh=1", { cache: "no-store" });
      router.refresh();
    } finally {
      setTimeout(() => setSpinning(false), 600);
    }
  }

  return (
    <button
      onClick={refresh}
      className="flex items-center gap-2 rounded-full border border-ink-600 px-3 py-1.5 text-xs text-slate-400 transition hover:border-slate-500 hover:text-slate-200"
    >
      <RefreshCw size={13} className={spinning ? "animate-spin" : ""} />
      Sync
    </button>
  );
}
