import { api } from "@/lib/axios";

export async function registerPushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  await api.post("/push/subscribe", subscription);
}

export async function unregisterPushSubscription(endpoint: string): Promise<void> {
  await api.post("/push/unsubscribe", { endpoint });
}
