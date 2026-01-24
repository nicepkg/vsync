import { describe, it, expect } from "vitest";
import { main } from "../src/index.js";

describe("CLI Entry Point", () => {
  it("should export main function", () => {
    expect(main).toBeDefined();
    expect(typeof main).toBe("function");
  });

  it("should be async function", () => {
    expect(main.constructor.name).toBe("AsyncFunction");
  });
});
