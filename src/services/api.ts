/**
 * Service boundary. MONITOR runs fully client-side; the only optional network call is the
 * release-notes signup, sent only when VITE_NEWSLETTER_URL is configured and the user opts in.
 */
import type { PresetSnapshot } from "../effects/presets";

export const NEWSLETTER_URL: string | undefined = import.meta.env.VITE_NEWSLETTER_URL;
export const REPO_URL = "https://github.com/armgdn-labs/armgdn-labs-monitor-fx";

/** POST {name, email} as JSON to the configured list endpoint (Buttondown, Formspree, a worker…). */
export async function subscribeNewsletter(name: string, email: string): Promise<"sent" | "local"> {
  if (!NEWSLETTER_URL) return "local";
  const res = await fetch(NEWSLETTER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name, email, source: "monitor-fx" }),
  });
  if (!res.ok) throw new Error(`Signup failed (${res.status})`);
  return "sent";
}

/** Local-only event log (dev console); nothing is sent anywhere. */
export function trackEvent(event: string, data: Record<string, unknown> = {}) {
  if (import.meta.env.DEV) console.debug("[event]", event, data);
}

/** Share links encode the stack in the URL hash: no server needed. */
export function encodeShare(snapshot: PresetSnapshot): string {
  const json = JSON.stringify(snapshot);
  let bin = "";
  for (const b of new TextEncoder().encode(json)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodeShare(token: string): PresetSnapshot | null {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const snap = JSON.parse(new TextDecoder().decode(bytes));
    return snap && Array.isArray(snap.graph) ? (snap as PresetSnapshot) : null;
  } catch {
    return null;
  }
}

export function shareUrl(snapshot: PresetSnapshot): string {
  return `${location.origin}${location.pathname}#/?p=${encodeShare(snapshot)}`;
}
