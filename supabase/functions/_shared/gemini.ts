/**
 * Gemini 呼叫共用層。
 *
 * 兩個 Edge Function 都經由此處呼叫 Gemini，金鑰只存在於 Supabase secrets，
 * 永遠不會出現在前端 bundle 或瀏覽器 localStorage。
 */

const BASE = "https://generativelanguage.googleapis.com";

export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function requireApiKey(): string {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) {
    throw new Error(
      "尚未設定 GEMINI_API_KEY。請到 Supabase 專案的 Edge Functions → Secrets 新增後重試。",
    );
  }
  return key;
}

export function model(): string {
  return Deno.env.get("GEMINI_MODEL") ?? "gemini-3.7-flash";
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/**
 * Files API 可續傳上傳。音檔走這條路而非 inline base64，
 * 因為 inline 的整包請求上限是 20MB，而 17 分鐘錄音沒有必要冒這個險。
 * 上傳的檔案由 Google 端在 48 小時後自動刪除。
 */
export async function uploadFile(
  bytes: Uint8Array,
  mimeType: string,
  displayName: string,
): Promise<{ uri: string; name: string }> {
  const apiKey = requireApiKey();

  const start = await fetch(`${BASE}/upload/v1beta/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName } }),
  });

  if (!start.ok) {
    throw new Error(`Files API 起始失敗 (${start.status}): ${await start.text()}`);
  }

  const uploadUrl = start.headers.get("x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error("Files API 未回傳 x-goog-upload-url");
  }

  const uploaded = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(bytes.byteLength),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: bytes,
  });

  if (!uploaded.ok) {
    throw new Error(`音檔上傳失敗 (${uploaded.status}): ${await uploaded.text()}`);
  }

  const { file } = await uploaded.json();
  if (!file?.name) throw new Error("Files API 未回傳檔案識別碼");

  // 音檔上傳後需經處理才可引用，輪詢至 ACTIVE 為止。
  let state = file.state;
  let attempts = 0;
  while (state === "PROCESSING" && attempts < 60) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(`${BASE}/v1beta/${file.name}`, {
      headers: { "x-goog-api-key": apiKey },
    });
    if (!poll.ok) break;
    const polled = await poll.json();
    state = polled.state;
    attempts++;
  }

  if (state === "FAILED") throw new Error("Gemini 無法處理這個音檔");

  return { uri: file.uri, name: file.name };
}

/** 上傳的檔案 48 小時會自動過期，但用完即刪可以少留一份副本在 Google 端。 */
export async function deleteFile(name: string): Promise<void> {
  try {
    await fetch(`${BASE}/v1beta/${name}`, {
      method: "DELETE",
      headers: { "x-goog-api-key": requireApiKey() },
    });
  } catch {
    // 刪不掉不影響結果，48 小時後仍會自動過期。
  }
}

type Part =
  | { text: string }
  | { file_data: { mime_type: string; file_uri: string } }
  | { inline_data: { mime_type: string; data: string } };

/**
 * 呼叫 generateContent 並強制回傳 JSON。
 * 官方已將 generateContent 標為 legacy，但明載「仍完全支援」，
 * 且其 REST 形狀比新的 Interactions API 穩定得多。
 */
export async function generateJson<T>(parts: Part[], temperature = 0.1): Promise<T> {
  const response = await fetch(
    `${BASE}/v1beta/models/${model()}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": requireApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Gemini 回應錯誤 (${response.status}): ${detail}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];

  if (!candidate) {
    const blocked = data.promptFeedback?.blockReason;
    throw new Error(blocked ? `請求被 Gemini 擋下：${blocked}` : "Gemini 沒有回傳內容");
  }

  // 具思考能力的模型可能回傳多個 part，僅串接文字 part。
  const raw = (candidate.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();

  if (!raw) throw new Error("Gemini 回傳空內容");

  try {
    return JSON.parse(raw) as T;
  } catch {
    // 保險：模型偶爾會用 ```json 包住輸出。
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenced) return JSON.parse(fenced[1]) as T;
    throw new Error(`Gemini 回傳的不是合法 JSON：${raw.slice(0, 300)}`);
  }
}
