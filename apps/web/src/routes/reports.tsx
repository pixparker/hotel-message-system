import { Link } from "react-router-dom";
import {
  BarChart3,
  MessageCircle,
  Eye,
  Users,
  Timer,
  Trophy,
  TrendingUp,
  CheckCircle2,
} from "lucide-react";
import { Page } from "../components/Page.js";
import { EmptyState } from "../components/EmptyState.js";
import { useReportsStats } from "../hooks/useReportsStats.js";

// Industry benchmarks used for value framing (public data, rounded).
const BENCHMARK_EMAIL_OPEN = 22;
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
      <Page title="WhatsApp Campaign Performance">
        <div className="card p-8 text-sm text-slate-500">Loading…</div>
      </Page>
    );
  }

  if (data.totals.campaigns === 0) {
    return (
      <Page
        title="WhatsApp Campaign Performance"
        description="How your WhatsApp campaigns actually perform."
      >
        <EmptyState
          icon={BarChart3}
          title="No campaigns yet"
          description="Performance insights appear here after you send your first message — and they look great."
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
  const vsEmailReadRate =
    totals.readRate > BENCHMARK_EMAIL_OPEN
      ? Math.round(totals.readRate / BENCHMARK_EMAIL_OPEN)
      : null;

  const bucketTotal =
    (readBuckets.lt5m ?? 0) +
    (readBuckets.lt30m ?? 0) +
    (readBuckets.lt1h ?? 0) +
    (readBuckets.lt3h ?? 0) +
    (readBuckets.gt3h ?? 0);
  const withinFive =
    bucketTotal > 0
      ? Math.round(((readBuckets.lt5m ?? 0) / bucketTotal) * 100)
      : 0;
  const withinThirty =
    bucketTotal > 0
      ? Math.round(
          (((readBuckets.lt5m ?? 0) + (readBuckets.lt30m ?? 0)) / bucketTotal) * 100,
        )
      : 0;

  return (
    <Page
      title="WhatsApp Campaign Performance"
      description="How your campaigns actually perform — with industry context."
    >
      {totals.readRate >= 95 && totals.sent > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-emerald-50/60 to-white px-5 py-3.5 shadow-[0_8px_24px_-16px_rgba(16,185,129,0.4)]">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_6px_16px_-4px_rgba(16,185,129,0.55)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div className="text-sm">
            <span className="font-semibold text-emerald-900">
              All recipients reached successfully.
            </span>{" "}
            <span className="text-slate-600">
              {totals.readRate}% of your messages were read — the kind of engagement
              you can't get from email.
            </span>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <HeroStat
          label="Messages sent"
          value={totals.sent.toLocaleString()}
          hint={`Across ${totals.campaigns} campaigns · last 14 days`}
          icon={MessageCircle}
          tone="brand"
        />
        <HeroStat
          label="Read rate"
          value={`${totals.readRate}%`}
          hint={
            vsEmailReadRate ? (
              <>
                <span className="font-semibold text-emerald-700">
                  {vsEmailReadRate}× higher than email
                </span>{" "}
                <span className="text-slate-400">
                  (industry avg {BENCHMARK_EMAIL_OPEN}%)
                </span>
              </>
            ) : (
              `Email benchmark: ${BENCHMARK_EMAIL_OPEN}%`
            )
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
            vsEmailMultiplier ? (
              <>
                <span className="font-semibold text-amber-700">
                  {vsEmailMultiplier}× faster
                </span>{" "}
                <span className="text-slate-400">than typical email open time</span>
              </>
            ) : (
              `Median: ${formatDuration(readTiming.medianMs)}`
            )
          }
          icon={Timer}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <DailyTrendCard entries={dailySent} />
        <ReadBucketsCard
          buckets={readBuckets}
          withinFive={withinFive}
          withinThirty={withinThirty}
          bucketTotal={bucketTotal}
        />
      </div>

      {topCampaign && topCampaign.queued > 0 && (
        <div className="mt-6 card p-5 border-accent-200 bg-gradient-to-br from-accent-50/80 via-white to-white shadow-lift">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-gradient text-white shadow-[0_10px_24px_-8px_rgba(228,155,15,0.55)] ring-1 ring-inset ring-white/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.12em] text-accent-700 font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-accent-500" />
                Top performer
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {topCampaign.seen === topCampaign.queued
                  ? "This message reached every recipient — read by all within minutes."
                  : `Read by ${topCampaign.seen} of ${topCampaign.queued} recipients.`}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                <Link
                  to={`/campaigns/${topCampaign.id}`}
                  className="font-medium hover:text-brand-700"
                >
                  {topCampaign.title}
                </Link>{" "}
                <span className="text-slate-400">
                  · sent {new Date(topCampaign.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
            <Link
              to={`/campaigns/${topCampaign.id}`}
              className="btn-secondary shrink-0"
            >
              See full report
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
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Message delivery progress</th>
              <th className="px-4 py-3 text-right">Read rate</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {campaigns.map((c) => {
              const rate = c.queued > 0 ? Math.round((c.seen / c.queued) * 100) : 0;
              const everyoneRead = c.queued > 0 && c.seen === c.queued;
              return (
                <tr key={c.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/campaigns/${c.id}`} className="hover:text-brand-700">
                      {c.title}
                    </Link>
                    {everyoneRead && (
                      <div className="mt-0.5 inline-flex items-center gap-1 text-xs text-emerald-700">
                        <CheckCircle2 className="h-3 w-3" />
                        All recipients reached
                      </div>
                    )}
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
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span
                      className={`text-lg font-bold ${
                        rate >= 90
                          ? "text-emerald-700"
                          : rate >= 60
                            ? "text-brand-700"
                            : "text-slate-700"
                      }`}
                    >
                      {rate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/campaigns/${c.id}`}
                      className="text-sm font-medium text-brand-700 hover:text-brand-900 whitespace-nowrap"
                    >
                      View details →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
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
  hint: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "indigo" | "emerald" | "amber";
  progress?: number;
  benchmark?: number;
  benchmarkLabel?: string;
}) {
  const toneMap = {
    brand: "bg-brand-50 text-brand-700 ring-brand-100",
    indigo: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-accent-50 text-accent-700 ring-accent-100",
  };
  const barMap = {
    brand: "from-brand-500 to-brand-400",
    indigo: "from-indigo-500 to-indigo-400",
    emerald: "from-emerald-500 to-emerald-400",
    amber: "from-accent-500 to-accent-400",
  };
  const hero = tone === "emerald";
  return (
    <div
      className={`card p-5 transition hover:shadow-lift hover:-translate-y-[1px] ${
        hero ? "ring-1 ring-emerald-200/60 bg-gradient-to-br from-emerald-50/60 to-white" : ""
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="text-[13px] font-medium text-slate-500">{label}</div>
        <div
          className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${toneMap[tone]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div
        className={`mt-4 ${
          hero
            ? "text-5xl font-bold tabular-nums tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-emerald-700 via-emerald-600 to-emerald-500"
            : "metric-xl"
        }`}
      >
        {value}
      </div>
      <div className="mt-1.5 text-xs text-slate-500">{hint}</div>
      {progress !== undefined && (
        <div className="progress-track mt-3">
          <div
            className={`progress-fill bg-gradient-to-r ${barMap[tone]}`}
            style={{ width: `${Math.min(100, progress)}%` }}
          />
          {benchmark !== undefined && (
            <div
              className="absolute top-0 h-full w-0.5 bg-slate-500/60"
              style={{ left: `${Math.min(100, benchmark)}%` }}
              title={benchmarkLabel}
            />
          )}
        </div>
      )}
    </div>
  );
}

function DailyTrendCard({
  entries,
}: {
  entries: Array<{ day: string; count: number }>;
}) {
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
  const activeDays = days.filter((d) => d.count > 0).length;

  return (
    <div className="card p-5 lg:col-span-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-brand-600" />
          Last 14 days
        </div>
        <div className="text-xs text-slate-400">
          {total.toLocaleString()} messages · {activeDays} active days
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
              className="w-full rounded-t bg-gradient-to-t from-brand-600 to-brand-400 hover:from-brand-700 hover:to-brand-500 transition-colors min-h-[2px] shadow-[0_1px_0_rgba(255,255,255,0.3)_inset]"
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

function ReadBucketsCard({
  buckets,
  withinFive,
  withinThirty,
  bucketTotal,
}: {
  buckets: Partial<Record<string, number>>;
  withinFive: number;
  withinThirty: number;
  bucketTotal: number;
}) {
  const rows: Array<{ label: string; key: string }> = [
    { label: "Within 5 min", key: "lt5m" },
    { label: "5–30 min", key: "lt30m" },
    { label: "30 min – 1 h", key: "lt1h" },
    { label: "1–3 h", key: "lt3h" },
    { label: "Over 3 h", key: "gt3h" },
  ];
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Timer className="h-4 w-4 text-brand-600" />
        How fast recipients read
      </div>

      {bucketTotal === 0 ? (
        <div className="mt-4 text-sm text-slate-400">
          No messages read yet — data will show here.
        </div>
      ) : (
        <>
          <div className="mt-3 rounded-xl border border-brand-100 bg-brand-gradient-soft px-3.5 py-2.5 text-sm font-semibold text-brand-900 shadow-sm">
            <span className="text-2xl font-bold tabular-nums text-brand-700">
              {withinFive}%
            </span>{" "}
            <span className="text-slate-700 font-medium">
              read within 5 minutes
            </span>
            {withinThirty > withinFive && (
              <div className="mt-0.5 text-xs font-normal text-slate-500">
                {withinThirty}% within 30 min
              </div>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {rows.map((r) => {
              const c = buckets[r.key] ?? 0;
              const pct = bucketTotal > 0 ? Math.round((c / bucketTotal) * 100) : 0;
              return (
                <div key={r.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-slate-600">{r.label}</span>
                    <span className="tabular-nums text-slate-500">
                      {c} · {pct}%
                    </span>
                  </div>
                  <div className="progress-track h-1.5">
                    <div
                      className="progress-fill"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Compare to email, where the typical open happens{" "}
            <span className="font-medium text-slate-700">
              ~{BENCHMARK_EMAIL_READ_MINUTES} min
            </span>{" "}
            after sending.
          </p>
        </>
      )}
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
        <span className="text-emerald-700 font-medium">Read {seen}</span>
      </div>
      <div className="progress-track">
        <div
          className="absolute inset-y-0 left-0 bg-slate-300"
          style={{ width: `${sentPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand-500 to-brand-400"
          style={{ width: `${deliveredPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_0_1px_rgba(5,150,105,0.15)]"
          style={{ width: `${seenPct}%` }}
        />
      </div>
    </div>
  );
}
