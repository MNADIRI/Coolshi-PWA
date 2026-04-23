import webpush from "web-push";
import { getServiceSupabase } from "@/lib/supabase/service";

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function configure(): boolean {
  if (!isPushConfigured()) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  return true;
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function notifyUser(
  userId: string,
  payload: NotificationPayload,
): Promise<{ sent: number; failed: number; pruned: number }> {
  if (!configure()) return { sent: 0, failed: 0, pruned: 0 };
  const supabase = getServiceSupabase();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (!subs || subs.length === 0) return { sent: 0, failed: 0, pruned: 0 };

  const json = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  const stale: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        );
        sent += 1;
      } catch (e: unknown) {
        failed += 1;
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) stale.push(s.endpoint);
      }
    }),
  );

  let pruned = 0;
  if (stale.length > 0) {
    const { count } = await supabase
      .from("push_subscriptions")
      .delete({ count: "exact" })
      .in("endpoint", stale);
    pruned = count ?? 0;
  }
  return { sent, failed, pruned };
}
