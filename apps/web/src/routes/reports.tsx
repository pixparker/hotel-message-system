import { Link } from "react-router-dom";
import {
  BarChart3,
  MessageCircle,
  Eye,
  Users,
  Timer,
  Trophy,
  ArrowRight,
  TrendingUp,
} from "lucide-react";
import { Page } from "../components/Page.js";
import { EmptyState } from "../components/EmptyState.js";
import { useReportsStats } from "../hooks/useReportsStats.js";

// Industry benchmarks used for value framing (public data, rounded).
const BENCHMARK_EMAIL_OPEN = 22;
const BENCHMARK_SMS_READ = 30;
const BENCHMARK_EMAIL_READ_MINUTES = 90; // typical open time after send

function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "—";
  const minutes = ms / 60000;
  if (minutes < 1) return `${Math.round(ms / 1000)}s`;
  if (minutes < 60) return `${Math.round(minutes * 10) / 10} min`;
  return `${Math.round((minutes / 60) * 10) / 10} h`;
}

export function ReportsPage() {
  const { data, isLoading } = useReportsStats();

  if (isLoading || !data) {
    return (
      <Page title="Reports">
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      </Page>
    );
  }

  if (data.totals.campaigns === 0) {
    return (
      <Page title="Reports" description="Past campaigns and their results.">
        <EmptyState
          icon={BarChart3}
          title="No campaigns yet"
          description="Reports appear here after you send your first message — and they look great."
          action={
            <Link to="/send" className="btn-primary">
              Send your first message
            </Link>
          }
        />
      </Page>
    );
  }

  const {
    totals,
    readTiming,
    dailySent,
    readBuckets,
    topCampaign,
    campaigns,
  } = data;
  const avgReadMinutes = readTiming.avgMs / 60000;
  const vsEmailMultiplier =
    avgReadMinutes > 0
      ? Math.max(1, Math.round(BENCHMARK_EMAIL_READ_MINUTES / avgReadMinutes))
      : null;

  return (
    <Page
      title="Reports"
      description="All-time performance across your WhatsApp campaigns."
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          label="Messages sent"
          value={totals.sent.toLocaleString()}
          hint={`${totals.campaigns} campaigns · ${totals.uniqueGuests} unique guests`}
          icon={MessageCircle}
          tone="brand"
        />
        <HeroStat
          label="Read rate"
          value={`${totals.readRate}%`}
          hint={
            totals.readRate > BENCHMARK_EMAIL_OPEN
              ? `${Math.round(totals.readRate / BENCHMARK_EMAIL_OPEN)}× higher than email (${BENCHMARK_EMAIL_OPEN}%)`
              : `Email benchmark: ${BENCHMARK_EMAIL_OPEN}%`
          }
          icon={Eye}
          tone="emerald"
          progress={totals.readRate}
          benchmark={BENCHMARK_EMAIL_OPEN}
          benchmarkLabel="Email avg"
        />
        <HeroStat
          label="Delivery rate"
          value={`${totals.deliveryRate}%`}
          hint={`${totals.delivered.toLocaleString()} of ${totals.sent.toLocaleString()} delivered`}
          icon={Users}
          tone="indigo"
          progress={totals.deliveryRate}
        />
        <HeroStat
          label="Avg time to read"
          value={formatDuration(readTiming.avgMs)}
          hint={
            vsEmailMultiplier
              ? `${vsEmailMultiplier}× faster than typical email open time`
              : `Median: ${formatDuration(readTiming.medianMs)}`
          }
          icon={Timer}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <DailyTrendCard entries={dailySent} />
        <ReadBucketsCard buckets={readBuckets} />
      </div>

      {topCampaign && topCampaign.queued > 0 && (
        <div className="mt-6 card p-5 border-emerald-200 bg-gradient-to-br from-emerald-50/60 to-white">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
                Top performer
              </div>
              <div className="mt-1 flex items-baseline gap-3">
                <Link
                  to={`/campaigns/${topCampaign.id}`}
                  className="text-lg font-semibold truncate hover:text-brand-700"
                >
                  {topCampaign.title}
                </Link>
                <span className="text-2xl font-bold text-emerald-700 tabular-nums">
                  {Math.round((topCampaign.seen / topCampaign.queued) * 100)}%
                </span>
                <span className="text-sm text-slate-500">read rate</span>
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {topCampaign.seen} of {topCampaign.queued} guests read your
                message on {new Date(topCampaign.createdAt).toLocaleDateString()}.
              </div>
            </div>
            <Link
              to={`/campaigns/${topCampaign.id}`}
              className="btn-ghost shrink-0"
            >
              View <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      <div className="mt-6 card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-brand-600" />
            All campaigns
          </div>
          <div className="text-xs text-slate-400">
            {campaigns.length} total
          </div>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Funnel</th>
              <th className="px-4 py-3 text-right">Read rate</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map((c) => {
              const rate = c.queued > 0 ? Math.round((c.seen / c.queued) * 100) : 0;
              return (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/campaigns/${c.id}`} className="hover:text-brand-700">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(c.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 min-w-[220px]">
                    <FunnelBar
                      queued={c.queued}
                      sent={c.sent}
                      delivered={c.delivered}
                      seen={c.seen}
                    />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {rate}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/campaigns/${c.id}`}
                      className="btn-ghost"
                      aria-label="Open campaign"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Page>
  );
}

function HeroStat({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  progress,
  benchmark,
  benchmarkLabel,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "indigo" | "emerald" | "amber";
  progress?: number;
  benchmark?: number;
  benchmarkLabel?: string;
}) {
  const toneMap = {
    brand: "bg-brand-50 text-brand-700",
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };
  const barMap = {
    brand: "bg-brand-500",
    indigo: "bg-indigo-500",
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  };
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div className="text-sm font-medium text-slate-500">{label}</div>
        <div
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${toneMap[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">
        {value}
      </div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
      {progress !== undefined && (
        <div className="mt-3 relative h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className={`h-full ${barMap[tone]} transition-all`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
          {benchmark !== undefined && (
            <div
              className="absolute top-0 h-full w-0.5 bg-slate-400"
              style={{ left: `${Math.min(100, benchmark)}%` }}
              title={benchmarkLabel}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DailyTrendCard({ entries }: { entries: Array<{ day: string; count: number }> }) {
  // Normalize to the last 14 days for a tighter, readable chart.
  const days: Array<{ day: string; count: number }> = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const hit = entries.find((e) => e.day.startsWith(key));
    days.push({ day: key, count: hit?.count ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((a, d) => a + d.count, 0);

  return (
    <div className="card p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-brand-600" />
          Last 14 days
        </div>
        <div className="text-xs text-slate-400">
          {total.toLocaleString()} messages
        </div>
      </div>
      <div className="flex items-end gap-1 h-28">
        {days.map((d) => (
          <div
            key={d.day}
            className="flex-1 flex flex-col items-center justify-end"
            title={`${d.day}: ${d.count}`}
          >
            <div
              className="w-full rounded-t bg-brand-500/80 hover:bg-brand-600 transition-colors min-h-[2px]"
              style={{ height: `${(d.count / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-slate-400 tabular-nums">
        <span>{days[0]!.day.slice(5)}</span>
        <span>today</span>
      </div>
    </div>
  );
}

function ReadBucketsCard({ buckets }: { buckets: Partial<Record<string, number>> }) {
  const rows: Array<{ label: string; key: string }> = [
    { label: "Within 5 min", key: "lt5m" },
    { label: "5–30 min", key: "lt30m" },
    { label: "30 min – 1 h", key: "lt1h" },
    { label: "1–3 h", key: "lt3h" },
    { label: "Over 3 h", key: "gt3h" },
  ];
  const total = rows.reduce((a, r) => a + (buckets[r.key] ?? 0), 0);
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Timer className="h-4 w-4 text-brand-600" />
        How fast guests read
      </div>
      {total === 0 ? (
        <div className="mt-4 text-sm text-slate-400">
          No messages read yet — data will show here.
        </div>
      ) : (
        <div className="mt-4 space-y-2">
          {rows.map((r) => {
            const c = buckets[r.key] ?? 0;
            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
            return (
              <div key={r.key}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-600">{r.label}</span>
                  <span className="tabular-nums text-slate-500">{c} · {pct}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-brand-500 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-4 text-xs text-slate-500">
        Compare to email, where the typical open happens <span className="font-medium text-slate-700">~{BENCHMARK_EMAIL_READ_MINUTES} min</span> after sending.
      </p>
    </div>
  );
}

function FunnelBar({
  queued,
  sent,
  delivered,
  seen,
}: {
  queued: number;
  sent: number;
  delivered: number;
  seen: number;
}) {
  if (queued === 0) return <span className="text-slate-300">—</span>;
  const sentPct = (sent / queued) * 100;
  const deliveredPct = (delivered / queued) * 100;
  const seenPct = (seen / queued) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 text-[11px] text-slate-500 tabular-nums">
        <span>Sent {sent}</span>
        <span>·</span>
        <span>Delivered {delivered}</span>
        <span>·</span>
        <span className="text-emerald-700 font-medium">Seen {seen}</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-slate-300"
          style={{ width: `${sentPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-brand-400"
          style={{ width: `${deliveredPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-emerald-500"
          style={{ width: `${seenPct}%` }}
        />
      </div>
    </div>
  );
}
