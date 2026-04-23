import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { api } from "../../lib/api.js";
import { useToast } from "../../components/toast.js";
import { ProviderCard } from "./_components/ProviderCard.js";

interface Settings {
  waProvider: "mock" | "cloud" | "baileys";
}

interface BaileysStatus {
  status: "none" | "pending" | "connected" | "logged_out" | "failed";
  phoneE164?: string | null;
}

export function WhatsAppSettingsPanel() {
  const { data, refetch } = useQuery({
    queryKey: ["settings"],
    queryFn: () => api<Settings>("/api/settings"),
  });
  const { data: baileys } = useQuery({
    queryKey: ["baileys-status"],
    queryFn: () => api<BaileysStatus>("/api/settings/whatsapp/baileys/status"),
  });
  const { push } = useToast();

  async function switchProvider(next: Settings["waProvider"]) {
    try {
      await api("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ waProvider: next }),
      });
      refetch();
    } catch {
      push({ variant: "error", title: "Could not switch provider" });
    }
  }

  return (
    <div className="card p-6 space-y-5">
      <div>
        <div className="text-sm font-semibold">WhatsApp delivery</div>
        <p className="mt-1 text-xs text-slate-500">
          Pick how outgoing messages reach your contacts. You can switch at any time.
        </p>
      </div>

      <ProviderCard
        active={data?.waProvider === "mock"}
        title="Mock"
        subtitle="Demo / testing — messages are simulated, nothing is sent."
        onActivate={() => switchProvider("mock")}
      />

      <ProviderCard
        active={data?.waProvider === "baileys"}
        title="WhatsApp Web (Baileys) — Unofficial"
        subtitle={
          baileys?.status === "connected"
            ? `Connected as ${baileys.phoneE164 ?? "your phone"}`
            : "Scan a QR with your phone. Easy setup, no Meta verification — but ban risk."
        }
        badge={
          baileys?.status === "connected" ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3 w-3" /> Connected
            </span>
          ) : baileys?.status === "logged_out" || baileys?.status === "failed" ? (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-700">
              <AlertTriangle className="h-3 w-3" /> Session lost
            </span>
          ) : (
            <span className="text-xs font-medium text-amber-700">Unofficial</span>
          )
        }
        action={
          <Link to="/settings/whatsapp/baileys" className="btn-secondary">
            {baileys?.status === "connected" ? "Manage" : "Connect"}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
        onActivate={() => switchProvider("baileys")}
        canActivate={baileys?.status === "connected"}
      />

      <ProviderCard
        active={data?.waProvider === "cloud"}
        title="Meta Cloud API — Official"
        subtitle="Reliable, high-volume. Requires WhatsApp Business verification."
        action={
          <Link to="/settings/whatsapp/connect" className="btn-secondary">
            Connect
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
        onActivate={() => switchProvider("cloud")}
      />
    </div>
  );
}
