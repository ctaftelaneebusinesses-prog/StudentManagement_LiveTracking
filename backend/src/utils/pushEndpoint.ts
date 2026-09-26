/**
 * SEC-14 (SSRF): a Web Push subscription endpoint is always an HTTPS URL served
 * by a browser's push service. The server later POSTs to this URL
 * (webpush.sendNotification), so an attacker-supplied endpoint pointing at an
 * internal address (e.g. http://169.254.169.254/...) turns the server into an
 * SSRF proxy. Client-side `.url()` validation is not enough — this allowlist is
 * enforced server-side in the subscribe validator.
 *
 * Endpoints must be HTTPS and hosted by a known push provider. Add new
 * providers here if the app adds support for another browser/push service.
 */
const ALLOWED_HOST_SUFFIXES = [
  "fcm.googleapis.com", // Chrome / Android (FCM)
  "android.googleapis.com", // legacy GCM
  "updates.push.services.mozilla.com", // Firefox (autopush)
  "push.apple.com", // Safari / Apple (e.g. web.push.apple.com)
  "notify.windows.com", // Edge / WNS (e.g. *.notify.windows.com)
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  // Reject IP-literal hosts outright (covers internal/link-local/loopback).
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) return false;
  return ALLOWED_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}
