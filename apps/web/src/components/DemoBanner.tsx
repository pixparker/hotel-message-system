import { useState } from "react";
import { Sparkles, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { IS_DEMO } from "../lib/api.js";
import { resetDemoState } from "../lib/demo-backend.js";
import { useAuth } from "../state/auth.js";

export function DemoBanner() {
  const [resetting, setResetting] = useState(false);
  const qc = useQueryClient();
  const logout = useAuth((s) => s.logout);

  if (!IS_DEMO) return null;

  function reset() {
    setResetting(true);
    resetDemoState();
    qc.clear();
    logout();
    setTimeout(() => {
      window.location.href = "/login";
    }, 150);
  }

  return (
    <div className="flex items-center justify-center gap-3 border-b border-brand-200 bg-brand-50 px-4 py-2 text-xs text-brand-800">
      <Sparkles className="h-3.5 w-3.5" />
      <span>
        This is a live demo — all data stays in your browser and nothing is sent
        to real WhatsApp numbers.
      </span>
      <button
        onClick={reset}
        disabled={resetting}
        className="ml-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-brand-700 hover:bg-brand-100 disabled:opacity-50"
      >
        <RotateCcw className="h-3 w-3" />
        Reset demo
      </button>
    </div>
  );
}
