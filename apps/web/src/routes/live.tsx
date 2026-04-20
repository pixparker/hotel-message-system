import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Send, Eye, AlertTriangle, ArrowRight, Users } from "lucide-react";
import { Page } from "../components/Page.js";
import { AudienceChip } from "../components/AudienceChip.js";
import { useCampaignStream } from "../hooks/useCampaignStream.js";
import { api } from "../lib/api.js";
import type { AudienceKind } from "../hooks/useAudiences.js";

interface CampaignHeader {
  audiences?: Array<{
    id: string;
    name: string;
    kind: AudienceKind;
    isSystem: boolean;
  }>;
}

export function LivePage() {
  const { id = "" } = useParams();
  const { totals, status, done } = useCampaignStream(id);
  const { data: header } = useQuery({
    queryKey: ["campaign-header", id],
    queryFn: () => api<CampaignHeader>(`/api/campaigns/${id}`),
    enabled: !!id,
  });
  const progress = totals.queued === 0 ? 0 : Math.min(100, Math.round(((totals.seen + totals.failed) / totals.queued) * 100));

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
      {header?.audiences && header.audiences.length > 0 && (
        <div className="card p-5 mb-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Sending to
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {header.audiences.map((a) => (
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
        <StatCard icon={CheckCircle2} label="Delivered" value={totals.delivered} tone="brand" />
        <StatCard icon={Eye} label="Read" value={totals.seen} tone="emerald" />
        <StatCard
          icon={AlertTriangle}
          label="Failed"
          value={totals.failed}
          tone="rose"
        />
      </div>

      <div className="mt-6 text-sm text-slate-500 tabular-nums">
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
