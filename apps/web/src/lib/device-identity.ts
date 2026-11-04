/**
 * Stable per-browser identity used to bind access codes to a device (backend device binding).
 * Not a security boundary on its own: the backend validates the binding.
 */
const KEY = 'sahaba_device_id';

export function getDeviceIdentity(): { id: string; fingerprint: string } {
  let id: string | null = null;
  try {
    id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
  } catch {
    id = crypto.randomUUID();
  }
  return { id, fingerprint: `web:${id}` };
}
