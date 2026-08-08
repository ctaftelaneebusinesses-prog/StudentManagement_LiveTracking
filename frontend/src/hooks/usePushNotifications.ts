import { useCallback, useState } from "react";
import { urlBase64ToUint8Array } from "@/utils/pushHelpers";
import { registerPushSubscription, unregisterPushSubscription } from "@/services/push.service";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

/**
 * True OS-level push (service worker + Push API + VAPID), layered alongside
 * the existing foreground bell/Realtime notifications (useNotifications.ts)
 * rather than replacing them — both fire when an announcement is published.
 */
export function usePushNotifications() {
  const [isSubscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);

    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Push notifications aren't supported in this browser.");
      return false;
    }
    if (!VAPID_PUBLIC_KEY) {
      setError("Push notifications aren't configured for this deployment.");
      return false;
    }

    setSubscribing(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setError("Notification permission was not granted.");
        return false;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        setError("Failed to create a push subscription.");
        return false;
      }

      await registerPushSubscription({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to enable push notifications.");
      return false;
    } finally {
      setSubscribing(false);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await unregisterPushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
  }, []);

  return { subscribe, unsubscribe, isSubscribing, error };
}
