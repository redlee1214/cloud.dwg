import { createClient } from "@supabase/supabase-js";

// 이 키들은 "공개 가능(publishable)" 키라 코드에 그대로 있어도 안전해요.
// 실제 데이터 접근 제어는 Supabase의 Row Level Security(RLS) 정책이 담당해요.
const SUPABASE_URL = "https://nhqoiuslhxrdajloklad.supabase.co";
const SUPABASE_KEY = "sb_publishable_wEZG5xP1FCbuNFTTGVpISw_WbQVkDKA";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 이전 Claude 아티팩트의 window.storage와 같은 형태로 맞춘 어댑터
export const storage = {
  async get(key) {
    const { data, error } = await supabase
      .from("app_storage")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key, value: data.value };
  },

  async set(key, value) {
    const { error } = await supabase
      .from("app_storage")
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
    if (error) throw error;
    return { key, value };
  },
};

// 누구인지(DJ/JS)는 이 기기에만 저장하면 되니 localStorage로 충분해요
// (Claude 아티팩트와 달리, 실제 배포된 웹앱에서는 localStorage 사용이 안전합니다)
export const localIdentity = {
  get() {
    try {
      return localStorage.getItem("who-am-i");
    } catch (e) {
      return null;
    }
  },
  set(value) {
    try {
      localStorage.setItem("who-am-i", value);
    } catch (e) {}
  },
};
