import { describe, expect, it } from "vitest";
import { extractLinks, labelFor, makeTitleFallback, parseHeader } from "@/lib/telegram/parse";
import { normalizeAspiration } from "@/lib/aspirasi/normalize";
import { isFlagged } from "@/lib/moderation";
import { contentHash } from "@/lib/hash";

describe("parseHeader", () => {
  it("parses group and sender", () => {
    expect(parseHeader("#IF 2023 | Kahim\nHalo semua")).toEqual({ group: "IF 2023", sender: "Kahim", body: "Halo semua" });
  });
  it("parses group only", () => {
    expect(parseHeader("#IF 2023\nisi")).toEqual({ group: "IF 2023", sender: null, body: "isi" });
  });
  it("no header", () => {
    expect(parseHeader("tanpa header")).toEqual({ group: null, sender: null, body: "tanpa header" });
  });
  it("handles CRLF", () => {
    expect(parseHeader("#G | S\r\nbody\r\nbaris2").body).toBe("body\nbaris2");
  });
});

describe("extractLinks", () => {
  it("finds forms.gle without scheme", () => {
    const l = extractLinks("Daftar di forms.gle/abc123 ya");
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ url: "https://forms.gle/abc123", label: "Isi Form", kind: "form" });
  });
  it("strips trailing punctuation", () => {
    expect(extractLinks("lihat https://example.com/a.")[0].url).toBe("https://example.com/a");
    expect(extractLinks("(https://example.com/x)")[0].url).toBe("https://example.com/x");
  });
  it("uses text_link entities and dedupes", () => {
    const text = "klik di sini https://a.com";
    const l = extractLinks(text, [
      { type: "text_link", offset: 0, length: 4, url: "https://b.com/x" },
      { type: "url", offset: 13, length: 13 },
    ]);
    expect(l.map((x) => x.url)).toEqual(["https://b.com/x", "https://a.com/"]);
  });
  it("rejects non-http protocols", () => {
    expect(extractLinks("x", [{ type: "text_link", offset: 0, length: 1, url: "javascript:alert(1)" }])).toEqual([]);
  });
  it("limits to 8", () => {
    const t = Array.from({ length: 12 }, (_, i) => `https://e${i}.com`).join(" ");
    expect(extractLinks(t)).toHaveLength(8);
  });
});

describe("labelFor", () => {
  it.each([
    ["https://docs.google.com/forms/d/1", "Isi Form"],
    ["https://drive.google.com/file/d/1", "Buka Dokumen"],
    ["https://www.instagram.com/p/1", "Lihat Instagram"],
    ["https://wa.me/62812", "Chat WhatsApp"],
    ["https://us02web.zoom.us/j/1", "Join Zoom"],
    ["https://meet.google.com/abc", "Join Meet"],
    ["https://youtu.be/x", "Tonton"],
    ["https://www.linkedin.com/jobs", "Buka LinkedIn"],
    ["https://www.example.org/x", "example.org"],
  ])("%s", (u, label) => expect(labelFor(u).label).toBe(label));
});

describe("misc", () => {
  it("title fallback", () => {
    expect(makeTitleFallback("*Open Recruitment*\nisi")).toBe("Open Recruitment");
    expect(makeTitleFallback("x".repeat(200)).length).toBeLessThanOrEqual(90);
  });
  it("normalizeAspiration", () => {
    expect(normalizeAspiration("Jam Lab diperpanjang!!")).toBe(normalizeAspiration("jam lab diperpanjang"));
    expect(normalizeAspiration("  Halo,   Dunia 😀 ")).toBe("halo dunia");
    expect(normalizeAspiration("!!!")).toBe("");
  });
  it("moderation", () => {
    expect(isFlagged("dasar b4ngsat")).toBe(true);
    expect(isFlagged("anjiiing")).toBe(true);
    expect(isFlagged("perpanjang jam lab")).toBe(false);
  });
  it("contentHash ignores formatting and case", async () => {
    expect(await contentHash("*Halo*  Dunia")).toBe(await contentHash("halo dunia"));
  });
});
