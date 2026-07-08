import { describe, expect, it } from "vitest";
import { getServiceWorkerUrl } from "../pwa/registerServiceWorker";

describe("service worker registration", () => {
  it("resolves the service worker under the Vite base path", () => {
    expect(getServiceWorkerUrl("/With_Agree/")).toBe("/With_Agree/sw.js");
    expect(getServiceWorkerUrl("./")).toBe("./sw.js");
  });
});
