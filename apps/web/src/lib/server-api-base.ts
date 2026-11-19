/**
 * API origin as seen from the Next server (Server Components, ISR).
 *
 * - API_INTERNAL_URL wins when set (production: NEXT_PUBLIC_API_URL is a relative path behind
 *   nginx, which the server cannot fetch).
 * - In development NEXT_PUBLIC_API_URL often points at the machine's LAN IP (192.168.x.x / 10.x)
 *   so phones on the network can reach the API. That IP changes with DHCP; the browser already
 *   follows window.location (api-client.ts), but the server would keep calling the stale IP and
 *   every server-rendered page would fail. The Next server runs on the same machine as the dev
 *   API, so a private LAN host is swapped for 127.0.0.1 on the same port and path.
 *
 * Returns null when no absolute URL is configured; callers then fall back to browser loading.
 */
export function serverApiBase(): string | null {
  const internal = process.env.API_INTERNAL_URL;
  if (internal && /^https?:\/\//.test(internal)) return internal.replace(/\/$/, '');

  const pub = process.env.NEXT_PUBLIC_API_URL || '';
  if (!/^https?:\/\//.test(pub)) return null;

  try {
    const url = new URL(pub);
    if (/^(192\.168\.|10\.)/.test(url.hostname) || url.hostname.endsWith('.local')) {
      url.hostname = '127.0.0.1';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}
