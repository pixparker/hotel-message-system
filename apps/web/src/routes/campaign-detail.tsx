import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users, ChevronDown, ChevronUp } from "lucide-react";
import { api } from "../lib/api.js";
import { Page } from "../components/Page.js";
import { AudienceChip } from "../components/AudienceChip.js";
import { MessageStatusIcon } from "../components/MessageStatusIcon.js";
import { formatPhoneDisplay, RTL_LANGUAGES, type Language } from "@hms/shared";
import type { AudienceKind } from "../hooks/useAudiences.js";

// Below this char threshold we render the message in full — short messages
// don't need a toggle. Above it, we show a 2-line preview + "Show more".
const PREVIEW_THRESHOLD = 160;

interface Message {
  id: string;
  phoneE164: string;
  language: string;
  renderedBody: string;
  status: string;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  error: string | null;
}
interface CampaignDetail {
  id: string;
  title: string;
  createdAt: string;
  status: string;
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

const statusTone: Record<string, string> = {
  queued: "bg-slate-100 text-slate-600",
  sent: "bg-sky-100 text-sky-700",
  delivered: "bg-brand-100 text-brand-700",
  read: "bg-emerald-100 text-emerald-700",
  failed: "bg-rose-100 text-rose-700",
};
const statusAccent: Record<string, string> = {
  queued: "before:bg-slate-300",
  sent: "before:bg-sky-400",
  delivered: "before:bg-brand-400",
  read: "before:bg-emerald-500",
  failed: "before:bg-rose-500",
};

function formatTime(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CampaignDetailPage() {
  const { id = "" } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["campaign", id],
    queryFn: () => api<CampaignDetail>(`/api/campaigns/${id}`),
  });

  if (isLoading || !data) {
    return (
      <Page title="Campaign">
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      </Page>
    );
  }

  return (
    <Page
      title={data.title}
      description={new Date(data.createdAt).toLocaleString()}
    >
      {data.audiences && data.audiences.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Sent to
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
            <span className="ml-2 text-sm text-slate-500 tabular-nums">
              {data.totalsQueued} recipient
              {data.totalsQueued === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Stat label="Recipients" value={data.totalsQueued} />
        <Stat label="Sent" value={data.totalsSent} />
        <Stat label="Delivered" value={data.totalsDelivered} />
        <Stat label="Read" value={data.totalsSeen} />
        <Stat label="Failed" value={data.totalsFailed} />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">
          Messages{" "}
          <span className="ml-1 text-xs font-normal text-slate-500 tabular-nums">
            {data.messages.length} shown
            {data.messages.length < data.totalsQueued &&
              ` of ${data.totalsQueued}`}
          </span>
        </h2>
      </div>
      <div className="space-y-2">
        {data.messages.map((m) => (
          <MessageCard key={m.id} message={m} />
        ))}
        {data.messages.length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-500">
            No messages yet.
          </div>
        )}
      </div>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MessageCard({ message: m }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const rtl = RTL_LANGUAGES.has(m.language as Language);
  const sentAt = formatTime(m.sentAt);
  const readAt = formatTime(m.readAt);
  const isLong = m.renderedBody.length > PREVIEW_THRESHOLD;

  return (
    <div
      className={`card relative overflow-hidden pl-4 before:absolute before:inset-y-0 before:left-0 before:w-1 ${statusAccent[m.status] ?? "before:bg-slate-300"}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center gap-2 min-w-0">
          <MessageStatusIcon status={m.status} />
          <span className="text-sm font-medium tabular-nums text-slate-800 truncate">
            {formatPhoneDisplay(m.phoneE164)}
          </span>
          <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
            {m.language}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:inline text-[11px] text-slate-400 tabular-nums">
            {sentAt ? `sent ${sentAt}` : "—"}
            {readAt && ` · read ${readAt}`}
          </span>
          <span className={`badge ${statusTone[m.status] ?? ""}`}>
            {m.status}
          </span>
        </div>
      </div>
      <div
        dir={rtl ? "rtl" : "ltr"}
        className={`px-4 py-3 text-sm text-slate-800 whitespace-pre-wrap leading-relaxed ${
          isLong && !expanded ? "line-clamp-2" : ""
        }`}
      >
        {m.renderedBody}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50/50 transition-colors"
          aria-expanded={expanded}
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show full message <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      )}
      {m.error && (
        <div className="px-4 py-2 text-xs text-rose-700 border-t border-rose-100 bg-rose-50/60">
          {m.error}
        </div>
      )}
    </div>
  );
}
