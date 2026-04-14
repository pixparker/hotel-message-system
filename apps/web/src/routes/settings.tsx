import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Page } from "../components/Page.js";
import { api } from "../lib/api.js";
import { useToast } from "../components/toast.js";
import { PhoneInput } from "../components/PhoneInput.js";

interface Settings {
  waProvider: "mock" | "cloud" | "baileys";
  defaultTestPhone: string | null;
}

export function SettingsPage() {
  const { data, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/api/settings"),
  });
  const [provider, setProvider] = useState<Settings["waProvider"]>(
    data?.waProvider ?? "mock",
  );
  const [defaultTestPhone, setDefaultTestPhone] = useState(
    data?.defaultTestPhone ?? "",
  );
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  async function save() {
    setSaving(true);
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          waProvider: provider,
          defaultTestPhone: defaultTestPhone || undefined,
        }),
      });
      push({ variant: "success", title: "Settings saved" });
      refetch();
    } catch {
      push({ variant: "error", title: "Could not save" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page title="Settings" description="Configure WhatsApp delivery and defaults.">
      <div className="card p-6 space-y-4 max-w-2xl">
        <div>
          <label className="label" htmlFor="provider">WhatsApp provider</label>
          <select
            id="provider"
            className="input mt-1"
            value={provider}
            onChange={(e) => setProvider(e.target.value as Settings["waProvider"])}
          >
            <option value="mock">Mock (demo / testing)</option>
            <option value="cloud">Meta Cloud API (M2)</option>
            <option value="baileys">Baileys — on-prem (M3)</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Only Mock is functional in M1. Cloud and Baileys land in later phases.
          </p>
        </div>
        <div>
          <label className="label" htmlFor="test">
            Default test number (fallback for staff without a personal one)
          </label>
          <PhoneInput
            id="test"
            value={defaultTestPhone}
            onChange={setDefaultTestPhone}
            className="mt-1"
          />
        </div>
        <div className="flex justify-end">
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save settings"}
          </button>
        </div>
      </div>
    </Page>
  );
}
