import { describe, expect, it } from "vitest";
import { classifyByRules, extractDeadline } from "@/lib/classify/rules";
import { parseAiContent } from "@/lib/classify/openrouter";

describe("classifyByRules", () => {
  it.each([
    ["Open Recruitment Magang Backend", "Program internship 6 bulan", "magang"],
    ["Hackathon Nasional", "Lomba CTF dan hackathon", "perlombaan"],
    ["PO Jaket Angkatan", "pre order jaket dan hoodie", "merch"],
    ["Beasiswa LPDP", "pendaftaran beasiswa dibuka", "beasiswa"],
    ["Jadwal UTS", "kelas dan praktikum", "akademik"],
    ["Pengumuman", "tidak ada kata kunci", "lainnya"],
  ])("%s", (t, b, cat) => expect(classifyByRules(t, b)).toBe(cat));

  it("title counts double", () => {
    expect(classifyByRules("Lomba", "magang")).toBe("perlombaan");
  });
  it("does not match substrings", () => {
    expect(classifyByRules("x", "terkompetisi")).toBe("lainnya");
  });
});

describe("extractDeadline", () => {
  const today = "2026-10-24";
  it("indonesian date after keyword", () => {
    expect(extractDeadline("Deadline pendaftaran 28 Oktober 2026", today)).toBe("2026-10-28");
    expect(extractDeadline("paling lambat 5 Nov", today)).toBe("2026-11-05");
  });
  it("numeric date", () => {
    expect(extractDeadline("batas 30/10/2026", today)).toBe("2026-10-30");
  });
  it("rolls to next year when passed more than 30 days", () => {
    expect(extractDeadline("ditutup 1 Jan", today)).toBe("2027-01-01");
  });
  it("keeps recently passed date in current year", () => {
    expect(extractDeadline("sebelum 10 Okt", today)).toBe("2026-10-10");
  });
  it("picks nearest future", () => {
    expect(extractDeadline("close 30 Nov 2026. Deadline 27 Okt 2026", today)).toBe("2026-10-27");
  });
  it("null without keyword", () => {
    expect(extractDeadline("acara 28 Oktober 2026", today)).toBeNull();
  });
  it("rejects invalid dates", () => {
    expect(extractDeadline("deadline 31 Feb 2026", today)).toBeNull();
  });
});

describe("parseAiContent", () => {
  it("extracts JSON surrounded by text", () => {
    const r = parseAiContent('Berikut hasil:\n{"category":"magang","title":"Magang Backend","deadline":"2026-11-01","confidence":0.9}\nSemoga membantu');
    expect(r).toMatchObject({ category: "magang", title: "Magang Backend", deadline: "2026-11-01", confidence: 0.9 });
  });
  it("invalid category becomes lainnya", () => {
    expect(parseAiContent('{"category":"bogus","title":"Judul bagus","deadline":null,"confidence":0.4}').category).toBe("lainnya");
  });
  it("bad deadline becomes null", () => {
    expect(parseAiContent('{"category":"loker","title":"Judul","deadline":"besok","confidence":2}').deadline).toBeNull();
  });
  it("throws without JSON", () => {
    expect(() => parseAiContent("tidak ada json")).toThrow();
  });
  it("throws on missing title", () => {
    expect(() => parseAiContent('{"category":"loker"}')).toThrow();
  });
});
