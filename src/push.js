import { storage } from "./storage";

// 클라이언트에서 노출돼도 안전한 공개 키 (VAPID public key)
const VAPID_PUBLIC_KEY = "BJ1DfBnVaKgMJY-vDqnUC47iVtGZSu0KacODnqLwMVfg3Ty3JC60O2o2D5D2eGsVSFkRa_W0RfhrKGYAs-UwmQA";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isPushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function getNotificationPermissionState() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function subscribeToPush(person) {
  if (!isPushSupported()) throw new Error("이 브라우저는 푸시 알림을 지원하지 않아요");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 허용되지 않았어요");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const id = `${person}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await storage.set(`push-sub:${id}`, JSON.stringify({ person, subscription: sub.toJSON() }));

  try {
    localStorage.setItem("push-subscribed", "1");
  } catch (e) {}

  return true;
}
