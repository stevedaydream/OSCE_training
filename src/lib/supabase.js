import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * 環境變數缺失時不要 throw。
 *
 * Vite 是在「建置當下」把 VITE_* 內嵌進 bundle 的，所以只要 Vercel 上還沒設好變數
 * 就建置，產出的檔案裡這兩個值永遠是空的。若在此 throw，使用者看到的會是一片全白、
 * 毫無線索。改成把錯誤往上傳，由 App 畫一頁看得懂的說明。
 */
export const configError = !url || !key
  ? '這個站台還沒設定 Supabase 連線資訊（VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY）。'
  : null;

export const supabase = configError
  ? null
  : createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

/**
 * 呼叫 Edge Function。Gemini 金鑰在後端，前端只帶自己的登入憑證。
 * 手機門前端與陪練端不會走到這裡——它們沒有登入，也不需要碰 AI。
 */
export async function callFunction(name, { body, formData } = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('尚未登入，無法呼叫 AI 服務');

  const headers = { Authorization: `Bearer ${session.access_token}` };
  let payload = formData;

  if (!payload) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body ?? {});
  }

  const response = await fetch(`${url}/functions/v1/${name}`, {
    method: 'POST',
    headers,
    body: payload,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.error) {
    throw new Error(result.error || `${name} 呼叫失敗 (${response.status})`);
  }
  return result;
}
