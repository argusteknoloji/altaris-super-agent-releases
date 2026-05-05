import { test, expect, describe } from "bun:test";
import { generateAuthToken } from "../src/lockfile";

describe("generateAuthToken", () => {
  test("returns a 64-character hex string (32 bytes)", () => {
    const token = generateAuthToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  test("returns a different value on every call", () => {
    const a = generateAuthToken();
    const b = generateAuthToken();
    const c = generateAuthToken();
    expect(a).not.toBe(b);
    expect(b).not.toBe(c);
    expect(a).not.toBe(c);
  });
});
