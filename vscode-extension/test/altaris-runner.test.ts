import { test, expect, describe } from "bun:test";
import { extractCodeBlock } from "../src/features/altaris-runner";

describe("extractCodeBlock", () => {
  test("extracts fenced ts block", () => {
    const result = extractCodeBlock("here:\n```ts\nconst x = 1;\n```");
    expect(result).toBe("const x = 1;\n");
  });

  test("works without language tag", () => {
    const result = extractCodeBlock("intro\n```\nplain code\n```\nrest");
    expect(result).toBe("plain code\n");
  });

  test("returns null when no fence is present", () => {
    const result = extractCodeBlock("just prose, no fences here");
    expect(result).toBeNull();
  });

  test("preserves multi-line code including blank lines and indentation", () => {
    const code = "function foo() {\n  if (true) {\n    return 1;\n  }\n\n  return 0;\n}";
    const wrapped = "before\n```typescript\n" + code + "\n```\nafter";
    const result = extractCodeBlock(wrapped);
    expect(result).toBe(code + "\n");
  });

  test("extracts only the first block when multiple are present", () => {
    const text = "```js\nfirst\n```\nthen\n```js\nsecond\n```";
    const result = extractCodeBlock(text);
    expect(result).toBe("first\n");
  });
});
