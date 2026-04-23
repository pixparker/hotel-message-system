import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { api } from "../../lib/api.js";
import { useToast } from "../../components/toast.js";
import { PhoneInput } from "../../components/PhoneInput.js";

interface Settings {
  defaultTestPhone: string | null;
}

export function GeneralSettingsPanel() {
  const { data, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/api/settings"),
  });
  const [defaultTestPhone, setDefaultTestPhone] = useState(
    data?.defaultTestPhone ?? "",
  );
  const [testPhoneStatus, setTestPhoneStatus] = useState<
    "idle" | "saving" | "saved"
  >("idle");
  const { push } = useToast();

  useEffect(() => {
    if (!data) return;
    setDefaultTestPhone(data.defaultTestPhone ?? "");
  }, [data]);

  // Auto-save the default test number when the user stops typing. Debounced
  // so typing a 10-digit phone doesn't fire 10 PATCHes. Skips when the local
  // value already matches the server — avoids an empty round-trip right after
  // the effect above syncs from `data`.
  useEffect(() => {
    const serverValue = data?.defaultTestPhone ?? "";
    if (defaultTestPhone === serverValue) return;
    const timer = setTimeout(async () => {
      setTestPhoneStatus("saving");
      try {
        await api("/api/settings", {
          method: "PATCH",
          body: JSON.stringify({ defaultTestPhone: defaultTestPhone || undefined }),
        });
        await refetch();
        setTestPhoneStatus("saved");
        setTimeout(() => setTestPhoneStatus("idle"), 1500);
      } catch {
        setTestPhoneStatus("idle");
        push({ variant: "error", title: "Could not save test number" });
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [defaultTestPhone, data?.defaultTestPhone, refetch, push]);

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <label className="label" htmlFor="test">
            Default test number
          </label>
          <span
            className="text-xs text-slate-500 min-h-[1rem]"
            aria-live="polite"
          >
            {testPhoneStatus === "saving" ? (
              <span className="inline-flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Saving…
              </span>
            ) : testPhoneStatus === "saved" ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <Check className="h-3 w-3" /> Saved
              </span>
            ) : null}
          </span>
        </div>
        <PhoneInput
          id="test"
          value={defaultTestPhone}
          onChange={setDefaultTestPhone}
          className="mt-1"
        />
        <p className="mt-1 text-xs text-slate-500">
          Fallback test phone for staff without a personal one saved. Changes save automatically.
        </p>
      </div>

      <div className="card p-6 space-y-1">
        <div className="text-sm font-semibold">About</div>
        <div className="text-xs text-slate-500 select-all tabular-nums">
          {__APP_VERSION__}
        </div>
      </div>
    </div>
  );
}
