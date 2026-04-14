/**
 * In-browser mock backend for the public demo deployment.
 *
 * Implements every endpoint the UI calls, persists to localStorage, and
 * simulates the real WhatsApp pipeline (queued → sent → delivered → read)
 * with realistic timing so the live status / reports screens feel alive.
 */

const LS_KEY = "hms-demo-state-v1";
const TOKEN = "demo-access-token";

interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: "admin" | "staff";
  testPhone: string | null;
  orgId: string;
}
interface Guest {
  id: string;
  orgId: string;
  name: string;
  phoneE164: string;
  language: string;
  roomNumber: string | null;
  status: "checked_in" | "checked_out";
  checkedInAt: string;
  checkedOutAt: string | null;
  createdAt: string;
}
interface TemplateBody {
  templateId: string;
  language: string;
  body: string;
}
interface Template {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
  bodies: TemplateBody[];
}
interface Campaign {
  id: string;
  orgId: string;
  createdBy: string;
  title: string;
  templateId: string | null;
  customBodies: Record<string, string> | null;
  recipientFilter: { status: "checked_in" | "checked_out" };
  isTest: boolean;
  status: "draft" | "sending" | "done" | "cancelled";
  totalsQueued: number;
  totalsSent: number;
  totalsDelivered: number;
  totalsSeen: number;
  totalsFailed: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}
interface Message {
  id: string;
  campaignId: string;
  guestId: string | null;
  phoneE164: string;
  language: string;
  renderedBody: string;
  providerMessageId: string | null;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  error: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
}
interface Settings {
  orgId: string;
  waProvider: "mock" | "cloud" | "baileys";
  defaultTestPhone: string | null;
  brandPrimaryColor: string | null;
}

interface State {
  users: User[];
  guests: Guest[];
  templates: Template[];
  campaigns: Campaign[];
  messages: Message[];
  settings: Settings;
}

const ORG_ID = "demo-org";
const ADMIN_ID = "demo-admin";

function uuid() {
  // crypto.randomUUID is widely supported; fall back for older env
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

function seed(): State {
  const admin: User = {
    id: ADMIN_ID,
    email: "admin@hotel.local",
    passwordHash: "demo",
    role: "admin",
    testPhone: "+905551112233",
    orgId: ORG_ID,
  };

  const guests: Guest[] = [
    {
      id: uuid(),
      orgId: ORG_ID,
      name: "Ayşe Yılmaz",
      phoneE164: "+905321112233",
      language: "tr",
      roomNumber: "204",
      status: "checked_in",
      checkedInAt: hoursAgo(28),
      checkedOutAt: null,
      createdAt: hoursAgo(28),
    },
    {
      id: uuid(),
      orgId: ORG_ID,
      name: "John Parker",
      phoneE164: "+14155552671",
      language: "en",
      roomNumber: "312",
      status: "checked_in",
      checkedInAt: hoursAgo(6),
      checkedOutAt: null,
      createdAt: hoursAgo(6),
    },
    {
      id: uuid(),
      orgId: ORG_ID,
      name: "Farhad Karimi",
      phoneE164: "+989121234567",
      language: "fa",
      roomNumber: "508",
      status: "checked_in",
      checkedInAt: hoursAgo(40),
      checkedOutAt: null,
      createdAt: hoursAgo(40),
    },
    {
      id: uuid(),
      orgId: ORG_ID,
      name: "Marta Silva",
      phoneE164: "+351912345678",
      language: "en",
      roomNumber: null,
      status: "checked_in",
      checkedInAt: hoursAgo(12),
      checkedOutAt: null,
      createdAt: hoursAgo(12),
    },
    {
      id: uuid(),
      orgId: ORG_ID,
      name: "Mehmet Demir",
      phoneE164: "+905331234567",
      language: "tr",
      roomNumber: "221",
      status: "checked_in",
      checkedInAt: hoursAgo(3),
      checkedOutAt: null,
      createdAt: hoursAgo(3),
    },
    {
      id: uuid(),
      orgId: ORG_ID,
      name: "Sara Ahmadi",
      phoneE164: "+989351112233",
      language: "fa",
      roomNumber: "417",
      status: "checked_in",
      checkedInAt: hoursAgo(20),
      checkedOutAt: null,
      createdAt: hoursAgo(20),
    },
    {
      id: uuid(),
      orgId: ORG_ID,
      name: "David Cohen",
      phoneE164: "+447700900123",
      language: "en",
      roomNumber: null,
      status: "checked_out",
      checkedInAt: hoursAgo(50),
      checkedOutAt: hoursAgo(24),
      createdAt: hoursAgo(50),
    },
  ];

  const welcomeId = uuid();
  const breakfastId = uuid();
  const templates: Template[] = [
    {
      id: welcomeId,
      orgId: ORG_ID,
      name: "Welcome to the hotel",
      description: "Sent on check-in.",
      createdAt: hoursAgo(48),
      bodies: [
        {
          templateId: welcomeId,
          language: "en",
          body: "Welcome to Reform Hotel! Your Wi-Fi password is GUEST2026. Reception is open 24/7 — just reply to this message if you need anything.",
        },
        {
          templateId: welcomeId,
          language: "tr",
          body: "Reform Hotel'e hoş geldiniz! Wi-Fi şifreniz: GUEST2026. Her türlü ihtiyacınız için bu mesaja yanıt verebilirsiniz.",
        },
        {
          templateId: welcomeId,
          language: "fa",
          body: "به هتل Reform خوش آمدید! رمز وای‌فای: GUEST2026. برای هر درخواستی کافیست همین پیام را پاسخ دهید.",
        },
      ],
    },
    {
      id: breakfastId,
      orgId: ORG_ID,
      name: "Breakfast reminder",
      description: "Morning reminder for the restaurant hours.",
      createdAt: hoursAgo(36),
      bodies: [
        {
          templateId: breakfastId,
          language: "en",
          body: "Good morning! Breakfast is served in the main restaurant from 07:00 to 10:30. Have a lovely day.",
        },
        {
          templateId: breakfastId,
          language: "tr",
          body: "Günaydın! Kahvaltı ana restoranda 07:00-10:30 arasında servis edilmektedir. İyi günler dileriz.",
        },
        {
          templateId: breakfastId,
          language: "fa",
          body: "صبح بخیر! صبحانه در رستوران اصلی از ساعت ۷:۰۰ تا ۱۰:۳۰ سرو می‌شود. روز خوبی داشته باشید.",
        },
      ],
    },
  ];

  // Synthetic historical campaigns spread across the last 14 days so the
  // trend chart, time-to-read buckets, and top-performer card all have
  // meaningful data from the moment the demo loads.
  const history: Array<{
    title: string;
    hoursAgo: number;
    messageCount: number;
    failures: number;
    readFraction: number; // 0..1
  }> = [
    { title: "Welcome blast — Saturday arrivals", hoursAgo: 18, messageCount: 6, failures: 0, readFraction: 1 },
    { title: "Pool closes at 10pm reminder", hoursAgo: 72, messageCount: 14, failures: 1, readFraction: 0.93 },
    { title: "Breakfast hours update", hoursAgo: 144, messageCount: 22, failures: 0, readFraction: 1 },
    { title: "VIP upgrade — late checkout offer", hoursAgo: 240, messageCount: 8, failures: 0, readFraction: 1 },
    { title: "Spa weekend promotion", hoursAgo: 312, messageCount: 18, failures: 1, readFraction: 0.94 },
  ];

  const campaignsList: Campaign[] = [];
  const messagesList: Message[] = [];

  for (const h of history) {
    const id = uuid();
    const read = Math.round(h.messageCount * h.readFraction);
    const delivered = h.messageCount - h.failures;
    const sent = delivered;
    const seen = Math.min(read, delivered);
    campaignsList.push({
      id,
      orgId: ORG_ID,
      createdBy: ADMIN_ID,
      title: h.title,
      templateId: welcomeId,
      customBodies: null,
      recipientFilter: { status: "checked_in" },
      isTest: false,
      status: "done",
      totalsQueued: h.messageCount,
      totalsSent: sent,
      totalsDelivered: delivered,
      totalsSeen: seen,
      totalsFailed: h.failures,
      createdAt: hoursAgo(h.hoursAgo),
      startedAt: hoursAgo(h.hoursAgo),
      finishedAt: hoursAgo(h.hoursAgo - 0.1),
    });

    const welcomeBodies = Object.fromEntries(
      templates.find((t) => t.id === welcomeId)!.bodies.map((b) => [b.language, b.body]),
    );

    for (let i = 0; i < h.messageCount; i++) {
      const guest = guests[i % guests.length]!;
      const lang = welcomeBodies[guest.language] ? guest.language : "en";
      const body = welcomeBodies[lang] ?? welcomeBodies.en ?? "";
      const sentAt = new Date(Date.now() - h.hoursAgo * 3600_000 + i * 3500);
      const isFailed = i < h.failures;
      const isRead = !isFailed && i < h.failures + read;
      const deliveredAt = isFailed
        ? null
        : new Date(sentAt.getTime() + 600 + Math.random() * 600);
      // Heavy bias toward <5min reads so the "killer value" stat is strong.
      const readGap =
        Math.random() < 0.8
          ? 15_000 + Math.random() * 180_000 // 15s – 3 min
          : Math.random() < 0.7
            ? 5 * 60_000 + Math.random() * 20 * 60_000 // 5 – 25 min
            : 45 * 60_000 + Math.random() * 60 * 60_000; // 45 – 105 min
      const readAt =
        isRead && deliveredAt
          ? new Date(deliveredAt.getTime() + readGap)
          : null;

      messagesList.push({
        id: uuid(),
        campaignId: id,
        guestId: guest.id,
        phoneE164: guest.phoneE164,
        language: lang,
        renderedBody: body,
        providerMessageId: isFailed ? null : "mock_" + uuid(),
        status: isFailed ? "failed" : isRead ? "read" : "delivered",
        error: isFailed ? "mock: simulated provider failure" : null,
        sentAt: isFailed ? null : sentAt.toISOString(),
        deliveredAt: deliveredAt?.toISOString() ?? null,
        readAt: readAt?.toISOString() ?? null,
      });
    }
  }

  return {
    users: [admin],
    guests,
    templates,
    campaigns: campaignsList,
    messages: messagesList,
    settings: {
      orgId: ORG_ID,
      waProvider: "mock",
      defaultTestPhone: "+905551112233",
      brandPrimaryColor: "#14a77a",
    },
  };
}

let state: State;
try {
  const raw = localStorage.getItem(LS_KEY);
  state = raw ? (JSON.parse(raw) as State) : seed();
} catch {
  state = seed();
}

function persist() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // quota — ignore
  }
}

export function resetDemoState() {
  state = seed();
  persist();
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function pickBody(bodies: Record<string, string>, language: string): { language: string; body: string } {
  if (bodies[language]) return { language, body: bodies[language]! };
  if (bodies.en) return { language: "en", body: bodies.en };
  const any = Object.entries(bodies).find(([, v]) => v && v.trim().length > 0);
  return any ? { language: any[0], body: any[1] } : { language: "en", body: "" };
}

function renderBody(body: string, ctx: Record<string, string>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => ctx[k] ?? "");
}

// ---------- campaign simulation ----------

function startCampaignSim(campaignId: string) {
  const campaign = state.campaigns.find((c) => c.id === campaignId);
  if (!campaign) return;
  const messages = state.messages.filter((m) => m.campaignId === campaignId);

  messages.forEach((msg, i) => {
    const sendDelay = 300 + i * (200 + Math.random() * 200);
    const deliverDelay = sendDelay + 500 + Math.random() * 900;
    const readDelay = deliverDelay + 1500 + Math.random() * 4500;
    const shouldFail = !campaign.isTest && Math.random() < 0.02;

    setTimeout(() => {
      if (campaign.status === "cancelled") return;
      msg.status = shouldFail ? "failed" : "sent";
      msg.sentAt = new Date().toISOString();
      msg.providerMessageId = "mock_" + uuid();
      msg.error = shouldFail ? "mock: simulated provider failure" : null;
      if (shouldFail) campaign.totalsFailed += 1;
      else campaign.totalsSent += 1;
      persist();
    }, sendDelay);

    if (shouldFail) return;

    setTimeout(() => {
      if (campaign.status === "cancelled") return;
      msg.status = "delivered";
      msg.deliveredAt = new Date().toISOString();
      campaign.totalsDelivered += 1;
      persist();
    }, deliverDelay);

    setTimeout(() => {
      if (campaign.status === "cancelled") return;
      msg.status = "read";
      msg.readAt = new Date().toISOString();
      campaign.totalsSeen += 1;

      // Finalize if all messages reached terminal state.
      const msgs = state.messages.filter((m) => m.campaignId === campaign.id);
      const terminal = msgs.every((m) => m.status === "read" || m.status === "failed");
      if (terminal && campaign.status === "sending") {
        campaign.status = "done";
        campaign.finishedAt = new Date().toISOString();
      }
      persist();
    }, readDelay);
  });
}

// ---------- request handler ----------

type JsonBody = Record<string, unknown>;

export async function demoFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const body: JsonBody =
    init.body && typeof init.body === "string" ? (JSON.parse(init.body) as JsonBody) : {};

  // Simulated latency so loading states appear
  await new Promise((r) => setTimeout(r, 80 + Math.random() * 120));

  // --- auth ---
  if (method === "POST" && path === "/api/auth/login") {
    const user = state.users[0]!;
    return json({
      accessToken: TOKEN,
      refreshToken: TOKEN,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        testPhone: user.testPhone,
      },
    });
  }
  if (method === "POST" && path === "/api/auth/refresh") {
    return json({ accessToken: TOKEN });
  }

  // --- me ---
  if (method === "GET" && path === "/api/me") {
    const u = state.users[0]!;
    return json({ id: u.id, email: u.email, role: u.role, testPhone: u.testPhone, orgId: u.orgId });
  }
  if (method === "PATCH" && path === "/api/me") {
    state.users[0]!.testPhone = (body.testPhone as string | undefined) ?? state.users[0]!.testPhone;
    persist();
    return json({ testPhone: state.users[0]!.testPhone });
  }

  // --- guests ---
  if (path.startsWith("/api/guests")) {
    const url = new URL(path, "http://x");
    const statusFilter = url.searchParams.get("status") as
      | "checked_in"
      | "checked_out"
      | null;
    const id = path.match(/^\/api\/guests\/([^\/]+)/)?.[1];

    if (method === "GET" && !id) {
      let rows = state.guests.filter((g) => g.orgId === ORG_ID);
      if (statusFilter) rows = rows.filter((g) => g.status === statusFilter);
      rows.sort(
        (a, b) => new Date(b.checkedInAt).getTime() - new Date(a.checkedInAt).getTime(),
      );
      return json(rows);
    }
    if (method === "POST" && !id) {
      const g: Guest = {
        id: uuid(),
        orgId: ORG_ID,
        name: String(body.name),
        phoneE164: String(body.phone).replace(/\s+/g, ""),
        language: String(body.language),
        roomNumber: (body.roomNumber as string | undefined)?.trim() || null,
        status: "checked_in",
        checkedInAt: new Date().toISOString(),
        checkedOutAt: null,
        createdAt: new Date().toISOString(),
      };
      state.guests.unshift(g);
      persist();
      return json(g, 201);
    }
    if (method === "PATCH" && id) {
      const g = state.guests.find((x) => x.id === id);
      if (!g) return json({ error: "not_found" }, 404);
      if (body.name) g.name = String(body.name);
      if (body.phone) g.phoneE164 = String(body.phone).replace(/\s+/g, "");
      if (body.language) g.language = String(body.language);
      if (body.roomNumber !== undefined)
        g.roomNumber = (body.roomNumber as string | null)?.toString().trim() || null;
      persist();
      return json(g);
    }
    if (method === "POST" && path.endsWith("/checkout")) {
      const g = state.guests.find((x) => x.id === id);
      if (!g) return json({ error: "not_found" }, 404);
      g.status = "checked_out";
      g.checkedOutAt = new Date().toISOString();
      persist();
      return json(g);
    }
    if (method === "POST" && path.endsWith("/checkin")) {
      const g = state.guests.find((x) => x.id === id);
      if (!g) return json({ error: "not_found" }, 404);
      g.status = "checked_in";
      g.checkedOutAt = null;
      g.checkedInAt = new Date().toISOString();
      persist();
      return json(g);
    }
  }

  // --- templates ---
  if (path.startsWith("/api/templates")) {
    const id = path.match(/^\/api\/templates\/([^\/]+)/)?.[1];
    if (method === "GET" && !id) {
      const rows = [...state.templates].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      return json(rows);
    }
    if (method === "GET" && id) {
      const t = state.templates.find((x) => x.id === id);
      if (!t) return json({ error: "not_found" }, 404);
      return json(t);
    }
    if (method === "POST" && !id) {
      const tpl: Template = {
        id: uuid(),
        orgId: ORG_ID,
        name: String(body.name),
        description: (body.description as string | undefined) ?? null,
        createdAt: new Date().toISOString(),
        bodies: (body.bodies as Array<{ language: string; body: string }>).map((b) => ({
          templateId: "pending",
          language: b.language,
          body: b.body,
        })),
      };
      tpl.bodies.forEach((b) => (b.templateId = tpl.id));
      state.templates.unshift(tpl);
      persist();
      return json(tpl, 201);
    }
    if (method === "PATCH" && id) {
      const t = state.templates.find((x) => x.id === id);
      if (!t) return json({ error: "not_found" }, 404);
      t.name = String(body.name);
      t.description = (body.description as string | undefined) ?? null;
      t.bodies = (body.bodies as Array<{ language: string; body: string }>).map((b) => ({
        templateId: t.id,
        language: b.language,
        body: b.body,
      }));
      persist();
      return json(t);
    }
    if (method === "DELETE" && id) {
      state.templates = state.templates.filter((t) => t.id !== id);
      persist();
      return json({ ok: true });
    }
  }

  // --- campaigns ---
  if (path.startsWith("/api/campaigns")) {
    if (method === "POST" && path === "/api/campaigns/test") {
      const phone = String(body.phone).replace(/\s+/g, "");
      const language = String(body.language);
      const bodies =
        (body.customBodies as Record<string, string> | undefined) ??
        Object.fromEntries(
          state.templates
            .find((t) => t.id === String(body.templateId))
            ?.bodies.map((b) => [b.language, b.body]) ?? [],
        );
      const picked = pickBody(bodies, language);
      const rendered = renderBody(picked.body, { name: "Test" });
      const campaign: Campaign = {
        id: uuid(),
        orgId: ORG_ID,
        createdBy: ADMIN_ID,
        title: `Test: ${rendered.slice(0, 40)}`,
        templateId: null,
        customBodies: null,
        recipientFilter: { status: "checked_in" },
        isTest: true,
        status: "sending",
        totalsQueued: 1,
        totalsSent: 0,
        totalsDelivered: 0,
        totalsSeen: 0,
        totalsFailed: 0,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
      const msg: Message = {
        id: uuid(),
        campaignId: campaign.id,
        guestId: null,
        phoneE164: phone,
        language: picked.language,
        renderedBody: rendered,
        providerMessageId: null,
        status: "queued",
        error: null,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
      };
      state.campaigns.push(campaign);
      state.messages.push(msg);
      persist();
      startCampaignSim(campaign.id);
      return json({ campaignId: campaign.id, messageId: msg.id }, 201);
    }

    const idMatch = path.match(/^\/api\/campaigns\/([^\/]+)(?:\/([^\/]+))?$/);
    const id = idMatch?.[1];
    const subpath = idMatch?.[2];

    if (method === "GET" && !id) {
      const rows = state.campaigns
        .filter((c) => !c.isTest)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return json(rows);
    }
    if (method === "GET" && id && !subpath) {
      const c = state.campaigns.find((x) => x.id === id);
      if (!c) return json({ error: "not_found" }, 404);
      const messages = state.messages.filter((m) => m.campaignId === id);
      return json({ ...c, messages });
    }
    if (method === "POST" && id && subpath === "cancel") {
      const c = state.campaigns.find((x) => x.id === id);
      if (!c) return json({ error: "not_found" }, 404);
      c.status = "cancelled";
      c.finishedAt = new Date().toISOString();
      persist();
      return json(c);
    }
    if (method === "POST" && !id) {
      const title = String(body.title || "Untitled campaign");
      const templateId = body.templateId as string | undefined;
      const customBodies = body.customBodies as Record<string, string> | undefined;
      const filter = (body.recipientFilter as { status: "checked_in" | "checked_out" } | undefined) ??
        { status: "checked_in" };

      const bodies =
        customBodies ??
        Object.fromEntries(
          state.templates
            .find((t) => t.id === templateId)
            ?.bodies.map((b) => [b.language, b.body]) ?? [],
        );

      const recipients = state.guests.filter((g) => g.status === filter.status);
      if (recipients.length === 0) return json({ error: "no_recipients" }, 400);

      const campaign: Campaign = {
        id: uuid(),
        orgId: ORG_ID,
        createdBy: ADMIN_ID,
        title,
        templateId: templateId ?? null,
        customBodies: customBodies ?? null,
        recipientFilter: filter,
        isTest: false,
        status: "sending",
        totalsQueued: recipients.length,
        totalsSent: 0,
        totalsDelivered: 0,
        totalsSeen: 0,
        totalsFailed: 0,
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
        finishedAt: null,
      };
      state.campaigns.unshift(campaign);
      for (const g of recipients) {
        const picked = pickBody(bodies, g.language);
        state.messages.push({
          id: uuid(),
          campaignId: campaign.id,
          guestId: g.id,
          phoneE164: g.phoneE164,
          language: picked.language,
          renderedBody: renderBody(picked.body, { name: g.name }),
          providerMessageId: null,
          status: "queued",
          error: null,
          sentAt: null,
          deliveredAt: null,
          readAt: null,
        });
      }
      persist();
      startCampaignSim(campaign.id);
      return json(campaign, 201);
    }
  }

  // --- settings ---
  if (method === "GET" && path === "/api/settings") {
    return json(state.settings);
  }
  if (method === "PATCH" && path === "/api/settings") {
    if (body.waProvider) state.settings.waProvider = body.waProvider as Settings["waProvider"];
    if (body.defaultTestPhone !== undefined)
      state.settings.defaultTestPhone = String(body.defaultTestPhone);
    if (body.brandPrimaryColor !== undefined) {
      const v = body.brandPrimaryColor as string | null;
      state.settings.brandPrimaryColor = v && typeof v === "string" ? v : null;
    }
    persist();
    return json(state.settings);
  }

  // --- stats ---
  if (method === "GET" && path === "/api/stats/dashboard") {
    const active = state.guests.filter((g) => g.status === "checked_in");
    const byLang = Object.entries(
      active.reduce<Record<string, number>>((acc, g) => {
        acc[g.language] = (acc[g.language] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([language, count]) => ({ language, count }));

    const sevenAgo = Date.now() - 7 * 86400_000;
    const c7d = state.campaigns.filter(
      (c) => !c.isTest && new Date(c.createdAt).getTime() >= sevenAgo,
    );
    const sent7d = c7d.reduce((a, c) => a + c.totalsSent, 0);
    const seen7d = c7d.reduce((a, c) => a + c.totalsSeen, 0);

    const readMsgs = state.messages.filter(
      (m) => m.readAt && m.sentAt && state.campaigns.find((c) => c.id === m.campaignId && !c.isTest),
    );
    const avgReadMs =
      readMsgs.length > 0
        ? readMsgs.reduce(
            (a, m) =>
              a + (new Date(m.readAt!).getTime() - new Date(m.sentAt!).getTime()),
            0,
          ) / readMsgs.length
        : 0;

    const recent = state.campaigns
      .filter((c) => !c.isTest)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        status: c.status,
        queued: c.totalsQueued,
        sent: c.totalsSent,
        delivered: c.totalsDelivered,
        seen: c.totalsSeen,
      }));

    return json({
      activeGuests: { total: active.length, byLanguage: byLang },
      campaigns: {
        total: state.campaigns.filter((c) => !c.isTest).length,
        last7dCount: c7d.length,
        last7dSent: sent7d,
        last7dDelivered: c7d.reduce((a, c) => a + c.totalsDelivered, 0),
        last7dSeen: seen7d,
        last7dFailed: c7d.reduce((a, c) => a + c.totalsFailed, 0),
        readRatePercent: sent7d > 0 ? Math.round((seen7d / sent7d) * 1000) / 10 : 0,
        avgReadMs: Math.round(avgReadMs),
      },
      recentCampaigns: recent,
    });
  }

  if (method === "GET" && path === "/api/stats/reports") {
    const nonTest = state.campaigns.filter((c) => !c.isTest);
    const totalsQ = nonTest.reduce((a, c) => a + c.totalsQueued, 0);
    const totalsS = nonTest.reduce((a, c) => a + c.totalsSent, 0);
    const totalsD = nonTest.reduce((a, c) => a + c.totalsDelivered, 0);
    const totalsSeen = nonTest.reduce((a, c) => a + c.totalsSeen, 0);
    const totalsF = nonTest.reduce((a, c) => a + c.totalsFailed, 0);

    const ntMsgs = state.messages.filter((m) =>
      nonTest.some((c) => c.id === m.campaignId),
    );
    const uniqueGuests = new Set(ntMsgs.map((m) => m.guestId).filter(Boolean)).size;

    const readMsgs = ntMsgs.filter((m) => m.readAt && m.sentAt);
    const durations = readMsgs.map(
      (m) => new Date(m.readAt!).getTime() - new Date(m.sentAt!).getTime(),
    );
    const avgMs =
      durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
    const sorted = [...durations].sort((a, b) => a - b);
    const medianMs = sorted.length > 0 ? (sorted[Math.floor(sorted.length / 2)] ?? 0) : 0;

    // daily sent last 30d
    const since30 = Date.now() - 30 * 86400_000;
    const byDay = new Map<string, number>();
    for (const m of ntMsgs) {
      if (!m.sentAt) continue;
      const t = new Date(m.sentAt).getTime();
      if (t < since30) continue;
      const d = new Date(t).toISOString().slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    const dailySent = Array.from(byDay.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, count]) => ({ day, count }));

    const bucketCount: Record<string, number> = {};
    for (const ms of durations) {
      const k =
        ms < 300_000
          ? "lt5m"
          : ms < 1800_000
            ? "lt30m"
            : ms < 3600_000
              ? "lt1h"
              : ms < 10800_000
                ? "lt3h"
                : "gt3h";
      bucketCount[k] = (bucketCount[k] ?? 0) + 1;
    }

    const topEligible = nonTest.filter((c) => c.totalsQueued >= 3);
    topEligible.sort(
      (a, b) => b.totalsSeen / (b.totalsQueued || 1) - a.totalsSeen / (a.totalsQueued || 1),
    );
    const top = topEligible[0];
    const topCampaign = top
      ? {
          id: top.id,
          title: top.title,
          createdAt: top.createdAt,
          queued: top.totalsQueued,
          seen: top.totalsSeen,
        }
      : null;

    const campaignsList = nonTest
      .sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
      .map((c) => ({
        id: c.id,
        title: c.title,
        createdAt: c.createdAt,
        status: c.status,
        queued: c.totalsQueued,
        sent: c.totalsSent,
        delivered: c.totalsDelivered,
        seen: c.totalsSeen,
        failed: c.totalsFailed,
      }));

    return json({
      totals: {
        campaigns: nonTest.length,
        queued: totalsQ,
        sent: totalsS,
        delivered: totalsD,
        seen: totalsSeen,
        failed: totalsF,
        uniqueGuests,
        deliveryRate: totalsS > 0 ? Math.round((totalsD / totalsS) * 1000) / 10 : 0,
        readRate: totalsS > 0 ? Math.round((totalsSeen / totalsS) * 1000) / 10 : 0,
      },
      readTiming: { avgMs: Math.round(avgMs), medianMs: Math.round(medianMs) },
      dailySent,
      readBuckets: bucketCount,
      topCampaign,
      campaigns: campaignsList,
    });
  }

  return json({ error: "not_implemented", path, method }, 404);
}
