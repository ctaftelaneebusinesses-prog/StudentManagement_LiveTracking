import webpush from "web-push";
import { supabaseAdmin } from "../config/supabase";
import { env } from "../config/env";
import { ApiError } from "../utils/ApiError";
import { logger } from "../config/logger";

const vapidConfigured = !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);

if (vapidConfigured) {
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);
} else {
  logger.warn("VAPID keys not configured — push notifications will be skipped");
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function saveSubscription(
  userId: string,
  schoolId: string | null,
  subscription: PushSubscriptionInput
) {
  const { error } = await supabaseAdmin.from("push_subscriptions").upsert(
    {
      user_id: userId,
      school_id: schoolId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth_key: subscription.keys.auth,
    },
    { onConflict: "endpoint" }
  );
  if (error) throw ApiError.internal(error.message);
}

export async function removeSubscription(endpoint: string) {
  const { error } = await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", endpoint);
  if (error) throw ApiError.internal(error.message);
}

/**
 * Fans a push payload out to every device a set of users has subscribed
 * from. Never throws — a bad/expired subscription (410/404 from the push
 * service) just gets pruned; anything else is logged and skipped, mirroring
 * the fire-and-forget posture of notification.service.ts's dispatchEmail.
 */
export async function sendToUserIds(userIds: string[], payload: PushPayload) {
  if (!vapidConfigured || userIds.length === 0) return;

  const { data: subscriptions, error } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .in("user_id", Array.from(new Set(userIds)));
  if (error) {
    logger.error({ error }, "Failed to load push subscriptions");
    return;
  }

  const body = JSON.stringify(payload);

  await Promise.all(
    (subscriptions ?? []).map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          body
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removeSubscription(sub.endpoint);
        } else {
          logger.error({ err, subscriptionId: sub.id }, "Push send failed");
        }
      }
    })
  );
}
