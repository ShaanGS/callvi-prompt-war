import { describe, expect, it } from "vitest";
import { serializeJsonParam } from "@/server/db/postgres";

describe("Postgres json/jsonb parameters", () => {
  it("passes JSON text through unchanged so values are not double-encoded", () => {
    const text = JSON.stringify({ en: "Small Business Starter", ta: "சிறு தொழில் தொடக்கம்" });
    expect(serializeJsonParam(text)).toBe(text);
    expect(JSON.parse(serializeJsonParam(text))).toEqual({ en: "Small Business Starter", ta: "சிறு தொழில் தொடக்கம்" });
  });

  it("encodes non-string values", () => {
    expect(serializeJsonParam({ a: 1 })).toBe('{"a":1}');
    expect(serializeJsonParam(["x"])).toBe('["x"]');
  });
});
