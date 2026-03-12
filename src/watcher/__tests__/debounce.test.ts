import { describe, test, expect } from "bun:test";
import { createDualDebouncer } from "../index";

describe("createDualDebouncer", () => {
  test("fires fast callback after short delay", async () => {
    let fastFired = false;
    let slowFired = false;

    const debouncer = createDualDebouncer({
      fastDelayMs: 50,
      slowDelayMs: 200,
      onFast: () => { fastFired = true; },
      onSlow: () => { slowFired = true; },
    });

    debouncer.trigger("test.md");

    await new Promise((r) => setTimeout(r, 100));
    expect(fastFired).toBe(true);
    expect(slowFired).toBe(false);

    await new Promise((r) => setTimeout(r, 200));
    expect(slowFired).toBe(true);

    debouncer.stop();
  });

  test("resets slow timer on repeated triggers", async () => {
    let slowCount = 0;

    const debouncer = createDualDebouncer({
      fastDelayMs: 20,
      slowDelayMs: 150,
      onFast: () => {},
      onSlow: () => { slowCount++; },
    });

    debouncer.trigger("test.md");
    await new Promise((r) => setTimeout(r, 50));
    debouncer.trigger("test.md");
    await new Promise((r) => setTimeout(r, 50));
    debouncer.trigger("test.md");

    await new Promise((r) => setTimeout(r, 250));
    expect(slowCount).toBe(1);

    debouncer.stop();
  });
});
