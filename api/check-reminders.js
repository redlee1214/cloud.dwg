import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nhqoiuslhxrdajloklad.supabase.co";
const SUPABASE_KEY = "sb_publishable_wEZG5xP1FCbuNFTTGVpISw_WbQVkDKA";

function todayYMD() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

function tomorrowYMD() {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  try {
    webpush.setVapidDetails(
      "mailto:redlee1214@example.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const today = todayYMD();
    const tomorrow = tomorrowYMD();

    const [eventsRes, foodRes, subsRes] = await Promise.all([
      supabase.from("app_storage").select("value").eq("key", "event-items").maybeSingle(),
      supabase.from("app_storage").select("value").eq("key", "food-items").maybeSingle(),
      supabase.from("app_storage").select("key,value").like("key", "push-sub:%"),
    ]);

    const events = eventsRes.data ? JSON.parse(eventsRes.data.value) : [];
    const foods = foodRes.data ? JSON.parse(foodRes.data.value) : [];
    const subs = subsRes.data || [];

    const messages = [];

    events
      .filter((e) => !e.done && e.date && (e.date === today || e.date === tomorrow))
      .forEach((e) => {
        const when = e.date === today ? "오늘" : "내일";
        messages.push(`🎉 ${when} 행사: ${e.text}`);
      });

    foods
      .filter((f) => !f.done && f.expiresAt && (f.expiresAt === today || f.expiresAt === tomorrow))
      .forEach((f) => {
        const when = f.expiresAt === today ? "오늘" : "내일";
        messages.push(`🍽️ 유통기한 ${when}까지: ${f.text}`);
      });

    if (messages.length === 0) {
      res.status(200).json({ ok: true, sent: 0, reason: "no due items" });
      return;
    }

    const body = messages.join("\n");
    const payload = JSON.stringify({ title: "우리 집 알림", body, url: "/" });

    const staleKeys = [];
    let sent = 0;

    await Promise.all(
      subs.map(async (row) => {
        try {
          const parsed = JSON.parse(row.value);
          await webpush.sendNotification(parsed.subscription, payload);
          sent++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            staleKeys.push(row.key);
          }
        }
      })
    );

    if (staleKeys.length > 0) {
      await supabase.from("app_storage").delete().in("key", staleKeys);
    }

    res.status(200).json({ ok: true, sent, messages });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
}
