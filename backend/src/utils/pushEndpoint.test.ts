import { describe, it, expect } from "vitest";
import { isAllowedPushEndpoint } from "./pushEndpoint";

/** SEC-14 (SSRF): only real HTTPS push-provider endpoints may be accepted. */
describe("isAllowedPushEndpoint — SEC-14 SSRF allowlist", () => {
  it("accepts legitimate push-provider HTTPS endpoints", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/abc123")).toBe(true);
    expect(isAllowedPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/xyz")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QABC")).toBe(true);
    expect(isAllowedPushEndpoint("https://db5p.notify.windows.com/w/?token=abc")).toBe(true);
  });

  it("rejects internal / private / metadata addresses (SSRF)", () => {
    expect(isAllowedPushEndpoint("http://169.254.169.254/latest/meta-data/")).toBe(false);
    expect(isAllowedPushEndpoint("https://169.254.169.254/")).toBe(false);
    expect(isAllowedPushEndpoint("http://localhost:4000/internal")).toBe(false);
    expect(isAllowedPushEndpoint("https://127.0.0.1/")).toBe(false);
    expect(isAllowedPushEndpoint("http://[::1]/")).toBe(false);
  });

  it("rejects non-https and arbitrary/look-alike hosts", () => {
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/fcm/send/x")).toBe(false); // not https
    expect(isAllowedPushEndpoint("https://evil.com/")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.attacker.com/x")).toBe(false); // suffix spoof
    expect(isAllowedPushEndpoint("not-a-url")).toBe(false);
    expect(isAllowedPushEndpoint("")).toBe(false);
  });
});
