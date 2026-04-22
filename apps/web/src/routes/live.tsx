import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Send,
  Eye,
  AlertTriangle,
  ArrowRight,
  Users,
} from "lucide-react";
import { Page } from "../components/Page.js";
import { AudienceChip } from "../components/AudienceChip.js";
import { MessageStatusIcon } from "../components/MessageStatusIcon.js";
import { api } from "../lib/api.js";
import { formatPhoneDisplay } from "@hms/shared";
import type { AudienceKind } from "../hooks/useAudiences.js";

interface Message {
  id: string;
  phoneE164: string;
  language: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  error: string | null;
}
interface CampaignDetail {
  id: string;
  title: string;
  status: "draft" | "sending" | "done" | "cancelled";
  totalsQueued: number;
  totalsSent: number;
  totalsDelivered: number;
  totalsSeen: number;
  totalsFailed: number;
  messages: Message[];
  audiences?: Array<{
    id: string;
    name: string;
    kind: AudienceKind;
    isSystem: boolean;
  }>;
}

const statusTone: Record<Message["status"], string> = {
  queued: "bg-slate-100 text-slate-600",
  sent: "bg-sky-100 text-sky-700",
  delivered: "bg-brand-100 text-brand-700",
  read: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
};

// Card styling per message status — a thin border + soft background so 100+
// recipients can be scanned at a glance like a heatmap. The tick icon
// inside each card follows WhatsApp semantics (single/double/blue).
const cardTone: Record<Message["status"], string> = {
  queued: "bg-slate-50/60 border-slate-200",
  sent: "bg-white border-slate-200",
  delivered: "bg-white border-slate-200",
  read: "bg-sky-50/60 border-sky-200",
  failed: "bg-rose-50/60 border-rose-200",
};

export function LivePage() {
  const { id = "" } = useParams();
  const { data } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => api<CampaignDetail>(`/api/campaigns/${id}`),
    enabled: !!id,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "done" || s === "cancelled" ? false : 1500;
    },
  });

  const totals = {
    queued: data?.totalsQueued ?? 0,
    sent: data?.totalsSent ?? 0,
    delivered: data?.totalsDelivered ?? 0,
    seen: data?.totalsSeen ?? 0,
    failed: data?.totalsFailed ?? 0,
  };
  const status = data?.status ?? "sending";
  const done = status === "done" || status === "cancelled";
  const progress =
    totals.queued === 0
      ? 0
      : Math.min(
          100,
          Math.round(((totals.seen + totals.failed) / totals.queued) * 100),
        );

  const messages = data?.messages ?? [];
  const shownCount = messages.length;
  const hiddenCount = Math.max(0, totals.queued - shownCount);

  return (
    <Page
      title={done ? "Campaign complete" : "Sending…"}
      description={
        done
          ? "Every message has reached its final state."
          : "You can close this page — delivery keeps going in the background."
      }
      actions={
        <Link to={`/campaigns/${id}`} className="btn-secondary">
          Open full report <ArrowRight className="h-4 w-4" />
        </Link>
      }
    >
      {data?.audiences && data.audiences.length > 0 && (
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Sending to
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {data.audiences.map((a) => (
              <AudienceChip
                key={a.id}
                name={a.name}
                kind={a.kind}
                isSystem={a.isSystem}
                size="md"
              />
            ))}
          </div>
        </div>
      )}

      <div className="card p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium">Progress</div>
          <div className="text-sm tabular-nums text-slate-500">
            {totals.seen + totals.failed} / {totals.queued}
          </div>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-brand-600 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={Send} label="Sent" value={totals.sent} tone="slate" />
        <StatCard
          icon={CheckCircle2}
          label="Delivered"
          value={totals.delivered}
          tone="brand"
        />
        <StatCard icon={Eye} label="Read" value={totals.seen} tone="emerald" />
        <StatCard
          icon={AlertTriangle}
          label="Failed"
          value={totals.failed}
          tone="rose"
        />
      </div>

      <div className="mt-6 card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <div className="text-sm font-semibold">Recipients</div>
          <div className="text-xs text-slate-500 tabular-nums">
            Showing {shownCount}
            {hiddenCount > 0 && ` of ${totals.queued} · ${hiddenCount} more`}
          </div>
        </div>
        {messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {done ? "No messages." : "Queuing recipients…"}
          </div>
        ) : (
          <div className="max-h-[640px] overflow-y-auto p-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {messages.map((m) => (
                <div
                  key={m.id}
                  title={
                    m.error
                      ? `${m.status} — ${m.error}`
                      : `${m.status}${
                          m.sentAt
                            ? ` · sent ${new Date(m.sentAt).toLocaleTimeString()}`
                            : ""
                        }`
                  }
                  className={`rounded-lg border px-2.5 py-2 transition ${cardTone[m.status]}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageStatusIcon status={m.status} className="h-3.5 w-3.5 shrink-0" />
                    <span className="flex-1 min-w-0 text-[13px] font-medium tabular-nums text-slate-800 truncate">
                      {formatPhoneDisplay(m.phoneE164)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-medium uppercase tracking-wide ${statusTone[m.status].split(" ")[1] ?? ""}`}
                    >
                      {m.status}
                    </span>
                    <span className="text-[10px] text-slate-400 tabular-nums">
                      {m.sentAt
                        ? new Date(m.sentAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-sm text-slate-500 tabular-nums">
        Status: <span className="font-medium text-slate-700">{status}</span>
      </div>
    </Page>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "slate" | "brand" | "emerald" | "rose";
}) {
  const toneMap = {
    slate: "bg-slate-50 text-slate-600",
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="card p-5">
      <div
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneMap[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-sm text-slate-500">{label}</div>
      <div className="mt-0.5 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
