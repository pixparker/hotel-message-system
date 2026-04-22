import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Send,
  UserPlus,
  LogOut,
  ArrowRight,
  Eye,
  Timer,
  MessageSquare,
  Languages,
  TrendingUp,
  Sparkles,
  ListFilter,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { Page } from "../components/Page.js";
import { PhoneInput } from "../components/PhoneInput.js";
import { LanguagePicker } from "../components/LanguagePicker.js";
import {
  useContacts,
  useCreateContact,
  type Contact,
} from "../hooks/useContacts.js";
import { useAudiences } from "../hooks/useAudiences.js";
import { useDashboardStats } from "../hooks/useDashboardStats.js";
import { useToast } from "../components/toast.js";
import { LANGUAGE_LABELS, formatPhoneDisplay } from "@hms/shared";
import { CheckoutDialog } from "../components/CheckoutDialog.js";
import { AudienceChip } from "../components/AudienceChip.js";

function greetingFor(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function DashboardPage() {
  const { data: stats } = useDashboardStats();
  const [checkInOpen, setCheckInOpen] = useState(false);

  const readRate = stats?.campaigns.readRatePercent ?? 0;
  const avgReadMin = stats?.campaigns.avgReadMs
    ? Math.round((stats.campaigns.avgReadMs / 60000) * 10) / 10
    : null;

  const checkedIn = stats?.checkedInGuests?.total ?? 0;

  return (
    <Page
      eyebrow={`${greetingFor()} · Reform Hotel`}
      title="Welcome back."
      description="Your contacts, your audiences, your campaigns — all at a glance."
      actions={
        <>
          {checkedIn > 0 && (
            <button
              className="btn-secondary"
              onClick={() => setCheckInOpen(true)}
            >
              <UserPlus className="h-4 w-4" />
              Check in guest
            </button>
          )}
          <Link to="/send" className="btn-primary">
            <Send className="h-4 w-4" />
            Send message
          </Link>
        </>
      }
    >
      <CheckInDialog open={checkInOpen} onOpenChange={setCheckInOpen} />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active contacts"
          value={stats?.activeContacts?.total ?? 0}
          hint={`${stats?.activeContacts?.byLanguage.length ?? 0} languages`}
          icon={MessageSquare}
          tone="brand"
        />
        <StatCard
          label="Messages sent · 7d"
          value={stats?.campaigns.last7dSent ?? 0}
          hint={`${stats?.campaigns.last7dCount ?? 0} campaigns`}
          icon={Send}
          tone="indigo"
        />
        <StatCard
          label="Read rate · 7d"
          value={`${readRate}%`}
          hint={`${stats?.campaigns.last7dSeen ?? 0} of ${stats?.campaigns.last7dSent ?? 0} read`}
          icon={Eye}
          tone="emerald"
          progress={readRate}
          hero={readRate >= 90}
        />
        <StatCard
          label="Avg time to read"
          value={avgReadMin !== null ? `${avgReadMin} min` : "—"}
          hint="From sent → read on WhatsApp"
          icon={Timer}
          tone="amber"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <LanguageMixCard
          entries={stats?.activeContacts?.byLanguage ?? []}
          total={stats?.activeContacts?.total ?? 0}
        />
        <TopAudiencesCard audiences={stats?.byAudience ?? []} />
      </div>

      <RecentCampaignsCard campaigns={stats?.recentCampaigns ?? []} />

      {checkedIn > 0 && <CheckedInContactsCard />}
    </Page>
  );
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
  progress,
  hero,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "indigo" | "emerald" | "amber";
  progress?: number;
  hero?: boolean;
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
  return (
    <div
      className={`card p-5 transition hover:shadow-lift hover:-translate-y-[1px] ${
        hero ? "ring-1 ring-brand-200/60 bg-brand-gradient-soft" : ""
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
        className={`mt-4 ${hero ? "metric-hero" : "metric-xl"}`}
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
        </div>
      )}
    </div>
  );
}

function LanguageMixCard({
  entries,
  total,
}: {
  entries: Array<{ language: string; count: number }>;
  total: number;
}) {
  if (total === 0) {
    return (
      <div className="card p-5 lg:col-span-1">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Languages className="h-4 w-4 text-brand-600" />
          Language mix
        </div>
        <div className="mt-4 text-sm text-slate-400">
          Add a contact to see the language breakdown.
        </div>
      </div>
    );
  }
  const sorted = [...entries].sort((a, b) => b.count - a.count);
  return (
    <div className="card p-5 lg:col-span-1">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Languages className="h-4 w-4 text-brand-600" />
        Language mix
      </div>
      <div className="mt-4 space-y-3">
        {sorted.map((e) => {
          const pct = Math.round((e.count / total) * 100);
          return (
            <div key={e.language}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">
                  {LANGUAGE_LABELS[e.language as keyof typeof LANGUAGE_LABELS] ??
                    e.language}
                </span>
                <span className="text-slate-500 tabular-nums">
                  {e.count} · {pct}%
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TopAudiencesCard({
  audiences,
}: {
  audiences: Array<{
    id: string;
    name: string;
    kind: "hotel_guests" | "vip" | "friends" | "custom";
    isSystem: boolean;
    memberCount: number;
  }>;
}) {
  const top = audiences.filter((a) => a.memberCount > 0).slice(0, 3);
  return (
    <div className="card p-5 lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <ListFilter className="h-4 w-4 text-brand-600" />
          Top audiences
        </div>
        <Link
          to="/audiences"
          className="text-xs font-semibold text-brand-700 hover:text-brand-900"
        >
          Manage all →
        </Link>
      </div>
      {top.length === 0 ? (
        <div className="rounded-xl bg-surface-50 p-6 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-brand-500" />
          <div className="mt-2 text-sm text-slate-500">
            Add contacts to audiences to target them in campaigns.
          </div>
        </div>
      ) : (
        <ul className="space-y-2">
          {top.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between rounded-lg border border-slate-100 bg-surface-50 px-4 py-3 hover:bg-surface-100 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <AudienceChip
                  name={a.name}
                  kind={a.kind}
                  isSystem={a.isSystem}
                  size="md"
                />
                <span className="text-sm text-slate-500 tabular-nums">
                  {a.memberCount} member{a.memberCount === 1 ? "" : "s"}
                </span>
              </div>
              <Link
                to={`/send?audience=${a.id}`}
                className="btn-ghost text-brand-700 hover:bg-brand-50"
              >
                <Send className="h-3.5 w-3.5" />
                Send
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentCampaignsCard({
  campaigns,
}: {
  campaigns: Array<{
    id: string;
    title: string;
    createdAt: string;
    status: string;
    queued: number;
    sent: number;
    delivered: number;
    seen: number;
  }>;
}) {
  return (
    <div className="mt-6 card p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <TrendingUp className="h-4 w-4 text-brand-600" />
          Recent campaigns
        </div>
        <Link
          to="/reports"
          className="text-xs font-semibold text-brand-700 hover:text-brand-900"
        >
          View all →
        </Link>
      </div>
      {campaigns.length === 0 ? (
        <div className="rounded-xl bg-surface-50 p-6 text-center">
          <Sparkles className="mx-auto h-5 w-5 text-brand-500" />
          <div className="mt-2 text-sm text-slate-500">
            Your first campaign will show up here.
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {campaigns.map((c) => {
            const pct = c.queued > 0 ? Math.round((c.seen / c.queued) * 100) : 0;
            return (
              <li key={c.id}>
                <Link
                  to={`/campaigns/${c.id}`}
                  className="flex items-center gap-4 py-3 rounded-lg hover:bg-surface-50 px-2 -mx-2 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate text-slate-900">
                      {c.title}
                    </div>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {new Date(c.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="hidden md:block w-32">
                    <div className="progress-track h-1.5">
                      <div
                        className="progress-fill bg-gradient-to-r from-emerald-500 to-emerald-400"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-slate-500 tabular-nums">
                      <span className="font-semibold text-slate-700">
                        {pct}%
                      </span>{" "}
                      · {c.seen}/{c.queued} read
                    </div>
                  </div>
                  <span
                    className={
                      c.status === "done"
                        ? "badge bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200"
                        : c.status === "sending"
                          ? "badge bg-accent-100 text-accent-800 ring-1 ring-inset ring-accent-200"
                          : "badge bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200"
                    }
                  >
                    {c.status}
                  </span>
                  <ArrowRight className="h-4 w-4 text-slate-400" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function CheckedInContactsCard() {
  // Only contacts that belong to Hotel Guests audience AND are checked_in.
  const { data: audiences = [] } = useAudiences();
  const hotelAudienceId = audiences.find((a) => a.kind === "hotel_guests")?.id;
  const { data: contacts = [] } = useContacts(
    hotelAudienceId
      ? { audienceId: hotelAudienceId, status: "checked_in" }
      : undefined,
  );
  const [checkoutContact, setCheckoutContact] = useState<Contact | null>(null);

  if (!hotelAudienceId || contacts.length === 0) return null;

  return (
    <>
      <div className="mt-6 card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
            Currently in-house
            <span className="ml-1 rounded-full bg-surface-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
              {contacts.length}
            </span>
          </div>
          <Link
            to={`/audiences/${hotelAudienceId}`}
            className="text-xs font-semibold text-brand-700 hover:text-brand-900"
          >
            Manage all →
          </Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {contacts.slice(0, 6).map((g: Contact) => (
            <li
              key={g.id}
              className="flex items-center justify-between px-5 py-3 hover:bg-surface-50 transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient-soft text-brand-700 ring-1 ring-brand-100 text-sm font-semibold">
                  {g.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate text-slate-900">
                    {g.name}
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {g.roomNumber && (
                      <span className="text-brand-700 font-semibold">
                        Room {g.roomNumber} ·{" "}
                      </span>
                    )}
                    {formatPhoneDisplay(g.phoneE164)} ·{" "}
                    {LANGUAGE_LABELS[
                      g.language as keyof typeof LANGUAGE_LABELS
                    ] ?? g.language}
                  </div>
                </div>
              </div>
              <button
                className="btn-ghost text-rose-600 hover:bg-rose-50"
                onClick={() => setCheckoutContact(g)}
              >
                <LogOut className="h-4 w-4" />
                Check out
              </button>
            </li>
          ))}
        </ul>
      </div>
      <CheckoutDialog
        guest={checkoutContact}
        open={!!checkoutContact}
        onOpenChange={(o) => !o && setCheckoutContact(null)}
      />
    </>
  );
}

function CheckInDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [language, setLanguage] = useState("en");
  const [roomNumber, setRoomNumber] = useState("");
  const mutation = useCreateContact();
  const { push } = useToast();
  const { data: audiences = [] } = useAudiences();
  const hotelAudienceId = audiences.find((a) => a.kind === "hotel_guests")?.id;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync({
        name,
        phone,
        language,
        roomNumber: roomNumber.trim() || undefined,
        source: "hotel",
        audienceIds: hotelAudienceId ? [hotelAudienceId] : undefined,
      });
      push({ variant: "success", title: `${name} checked in` });
      setName("");
      setPhone("");
      setLanguage("en");
      setRoomNumber("");
      onOpenChange(false);
    } catch {
      push({
        variant: "error",
        title: "Check-in failed",
        description: "Check the phone number format.",
      });
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/30" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 card-lift p-6">
          <Dialog.Title className="text-lg font-semibold">
            Check in guest
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-slate-500">
            Takes under 10 seconds.
          </Dialog.Description>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <div>
                <label className="label" htmlFor="d-name">Full name</label>
                <input
                  id="d-name"
                  className="input mt-1"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="label" htmlFor="d-room">Room <span className="text-slate-400 font-normal">opt.</span></label>
                <input
                  id="d-room"
                  className="input mt-1 tabular-nums"
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="204"
                  maxLength={20}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="d-phone">WhatsApp number</label>
              <PhoneInput id="d-phone" value={phone} onChange={setPhone} className="mt-1" />
            </div>
            <div>
              <div className="label mb-2">Preferred language</div>
              <LanguagePicker value={language} onChange={setLanguage} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? "Checking in…" : "Check in"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

