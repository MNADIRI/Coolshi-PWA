function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buf = new ArrayBuffer(raw.length);
  const arr = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return buf;
}

export type PushStatus =
  | "unsupported"
  | "not-configured"
  | "denied"
  | "default"
  | "subscribed";

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === "undefined") return "unsupported";
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  const meta = await fetch("/api/push/subscribe").then((r) => r.json());
  if (!meta.configured) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return "subscribed";
  return Notification.permission === "granted" ? "default" : "default";
}

export async function subscribeToPush(): Promise<
  { ok: true } | { ok: false; reason: PushStatus | "error"; message?: string }
> {
  if (typeof window === "undefined") return { ok: false, reason: "unsupported" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { ok: false, reason: "unsupported" };
  }

  const meta = await fetch("/api/push/subscribe").then((r) => r.json());
  if (!meta.configured || !meta.publicKey) {
    return { ok: false, reason: "not-configured" };
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission === "denied") return { ok: false, reason: "denied" };
  if (permission !== "granted") return { ok: false, reason: "default" };

  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(meta.publicKey),
      });
    }
    const res = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: btoa(
            String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!)),
          ),
          auth: btoa(
            String.fromCharCode(...new Uint8Array(sub.getKey("auth")!)),
          ),
        },
        userAgent: navigator.userAgent,
      }),
    });
    if (!res.ok) {
      return { ok: false, reason: "error", message: await res.text() };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", message: String(e) };
  }
}
