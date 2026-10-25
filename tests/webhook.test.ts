import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  seen: new Set<number>(),
  updates: [] as { table: string; patch: unknown; id?: unknown }[],
  sent: [] as { chatId: number; text: string }[],
  answered: [] as { id: string; text?: string }[],
  ingestResult: { kind: "created", id: "11111111-1111-1111-1111-111111111111", title: "Judul", category: "lainnya" } as Record<string, unknown>,
  ingestCalls: 0,
  afterCbs: [] as (() => unknown)[],
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, after: (cb: () => unknown) => void state.afterCbs.push(cb) };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      insert: async (row: { update_id: number }) =>
        table === "tg_updates" && state.seen.has(row.update_id)
          ? { error: { code: "23505" } }
          : (state.seen.add(row.update_id), { error: null }),
      update: (patch: unknown) => ({
        eq: async (_c: string, id: unknown) => (state.updates.push({ table, patch, id }), { error: null }),
      }),
      select: () => ({
        eq: () => ({ eq: () => ({ order: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) }),
      }),
    }),
  }),
}));
vi.mock("@/lib/ingest", () => ({
  createBroadcastFromMessage: async () => (state.ingestCalls++, state.ingestResult),
}));
vi.mock("@/lib/classify", () => ({ classifyAndUpdate: vi.fn(async () => ({ ok: true })), refreshConfirmation: vi.fn() }));
vi.mock("@/lib/telegram/api", () => ({
  sendMessage: async (chatId: number, text: string) => (state.sent.push({ chatId, text }), { message_id: 99 }),
  editMessageText: vi.fn(),
  editMessageReplyMarkup: vi.fn(),
  answerCallbackQuery: async (id: string, text?: string) => void state.answered.push({ id, text }),
}));

import { POST } from "@/app/api/telegram/route";

const ID = "11111111-1111-1111-1111-111111111111";
const req = (body: unknown, secret = "secret") =>
  new Request("http://x/api/telegram", {
    method: "POST",
    headers: { "x-telegram-bot-api-secret-token": secret, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const msg = (update_id: number, from: number, text: string) => ({
  update_id,
  message: { message_id: update_id, date: 0, chat: { id: from, type: "private" }, from: { id: from }, text },
});

beforeEach(() => {
  state.seen.clear();
  state.updates.length = 0;
  state.sent.length = 0;
  state.answered.length = 0;
  state.afterCbs.length = 0;
  state.ingestCalls = 0;
  state.ingestResult = { kind: "created", id: ID, title: "Judul", category: "lainnya" };
});

describe("telegram webhook", () => {
  it("rejects wrong secret", async () => {
    expect((await POST(req(msg(1, 42, "hi"), "nope"))).status).toBe(403);
    expect(state.ingestCalls).toBe(0);
  });

  it("/start tells anyone their id", async () => {
    const res = await POST(req(msg(2, 7, "/start")));
    expect(res.status).toBe(200);
    expect(state.sent[0].text).toContain("bukan owner");
  });

  it("rejects non-owner messages", async () => {
    await POST(req(msg(3, 7, "broadcast")));
    expect(state.sent[0].text).toBe("Bot ini privat.");
    expect(state.ingestCalls).toBe(0);
  });

  it("ignores duplicate update_id", async () => {
    await POST(req(msg(4, 42, "halo")));
    await POST(req(msg(4, 42, "halo")));
    expect(state.ingestCalls).toBe(1);
  });

  it("stores a new message, confirms, schedules classification", async () => {
    await POST(req(msg(5, 42, "halo")));
    expect(state.sent[0].text).toContain("Tersimpan");
    expect(state.sent[0].text).toContain("sementara");
    expect(state.updates.some((u) => u.table === "broadcasts" && (u.patch as Record<string, unknown>).tg_confirm_message_id === 99)).toBe(true);
    expect(state.afterCbs).toHaveLength(1);
  });

  it("reports duplicate content", async () => {
    state.ingestResult = { kind: "duplicate", id: ID };
    await POST(req(msg(6, 42, "halo")));
    expect(state.sent[0].text).toContain("Sudah ada di arsip");
    expect(state.afterCbs).toHaveLength(0);
  });

  it("category callback sets manual source", async () => {
    const res = await POST(req({
      update_id: 7,
      callback_query: { id: "cb1", from: { id: 42 }, data: `c:${ID}:beasiswa`, message: { message_id: 5, chat: { id: 42 } } },
    }));
    expect(res.status).toBe(200);
    expect(state.updates[0]).toMatchObject({ table: "broadcasts", patch: { category: "beasiswa", category_source: "manual" }, id: ID });
    expect(state.answered[0].text).toBe("Kategori: Beasiswa");
  });

  it("callback from non-owner is refused", async () => {
    await POST(req({
      update_id: 8,
      callback_query: { id: "cb2", from: { id: 7 }, data: `h:${ID}`, message: { message_id: 5, chat: { id: 7 } } },
    }));
    expect(state.answered[0].text).toBe("Bukan owner");
    expect(state.updates).toHaveLength(0);
  });
});
