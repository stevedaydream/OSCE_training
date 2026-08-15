/**
 * analyze-session：把一場演練的錄音轉成逐字稿與行為檢核結果。
 *
 * 刻意不做的事：
 *  - 不打分數。公文沒有規定細項配分，自練場也沒有口試委員，
 *    任何由模型生出的分數都只是把覆蓋率化妝成分數，對她判斷會不會過沒有幫助。
 *  - 不推測時間分配。舊版把「病史訪談 3分15秒」這種數字寫死在提示詞裡，
 *    那是憑空捏造的，這裡一律以逐字稿中實際出現的內容為準。
 *
 * 輸入：multipart/form-data，欄位 audio（MP3）與 meta（JSON 字串）。
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  CORS_HEADERS,
  deleteFile,
  generateJson,
  json,
  uploadFile,
} from "../_shared/gemini.ts";

interface CheckItem {
  key: string;
  label: string;
  hint?: string;
}

interface CueReveal {
  cueId: string;
  label: string;
  atSeconds: number;
  by: "keyword" | "manual" | "examiner";
}

interface Meta {
  stationTitle: string;
  department: string;
  mode: "full" | "segment";
  segmentCategory?: string;
  durationSeconds: number;
  /** 通用骨架，跨題固定，排行榜只累積這一層 */
  coreChecklist: CheckItem[];
  /** 本題專屬項目，只出現在單場報告 */
  stationChecklist: CheckItem[];
  cueReveals: CueReveal[];
}

function buildPrompt(meta: Meta): string {
  const mmss = (s: number) =>
    `${Math.floor(s / 60)}分${String(Math.floor(s % 60)).padStart(2, "0")}秒`;

  const cueLines = meta.cueReveals.length
    ? meta.cueReveals
      .map((c) =>
        `- 第 ${mmss(c.atSeconds)}：「${c.label}」（觸發方式：${
          { keyword: "考生語音關鍵詞自動解鎖", manual: "考生手動解鎖", examiner: "陪練考官推送" }[c.by]
        }）`
      )
      .join("\n")
    : "（本場沒有任何提示卡被揭露）";

  return `你是台灣衛生福利部專科護理師甄審口試的資深口試委員。以下是一位考生「${meta.department}」分科演練的錄音，請根據錄音內容產出結構化的行為檢核結果。

【本場資訊】
考題：${meta.stationTitle}
模式：${meta.mode === "segment" ? `片段特訓（僅練「${meta.segmentCategory}」）` : "完整演練"}
實際時長：${mmss(meta.durationSeconds)}

【提示卡揭露歷程】
${cueLines}

【最重要的規則】
1. 錄音中只有考生一個人說話。她在自主演練，沒有標準化病人，所以她會「口述」她正在問什麼、正在做什麼檢查。請把她的口述視為她的實際作為。
2. 你只能依據錄音中「實際聽到的話」判斷。**絕對不要推測、不要補完、不要美化。** 沒說到就是沒說到。
3. **不要給任何分數、百分比或等第。** 這份報告刻意不含分數。
4. 不要編造時間分配數據。只有你能從錄音中明確定位的內容才可以標時間。
5. 引用證據時必須是逐字稿中真實出現的原句，不可改寫。找不到證據就把 evidence 留空字串。

【公文規定的檢核重點（作為你判斷的依據）】
依《專科護理師甄審口試流程及評分方式公告》，口試評量以病人為中心之評估、病史詢問、臨床推理與決策、溝通等專業能力；考生執行身體健康評估時，**必須同時向病人說明檢查目的、項目及部位**（此為「說做合一」，是本系統最核心的檢核點）。

【第一層：通用骨架檢核項（跨題固定）】
${meta.coreChecklist.map((c) => `- ${c.key}｜${c.label}${c.hint ? `（判準：${c.hint}）` : ""}`).join("\n")}

【第二層：本題專屬檢核項】
${
    meta.stationChecklist.length
      ? meta.stationChecklist.map((c) => `- ${c.key}｜${c.label}${c.hint ? `（判準：${c.hint}）` : ""}`).join("\n")
      : "（本題未設定專屬檢核項）"
  }

【輸出 JSON，嚴格遵循此結構】
{
  "transcript": "完整逐字稿。每段前面加上大約時間標記，格式 [m:ss]。醫療術語請用台灣慣用寫法（如：濕囉音、腸蠕動音、SBAR、LQQOPERA）。",
  "coreChecks": [
    { "key": "對應上方第一層的 key", "met": true, "evidence": "逐字稿原句", "atSeconds": 123, "note": "未達成時說明差在哪，達成則留空" }
  ],
  "stationChecks": [
    { "key": "對應上方第二層的 key", "met": false, "evidence": "", "atSeconds": null, "note": "整場未提及" }
  ],
  "sayDoFindings": [
    {
      "examName": "她口述執行的身體檢查名稱，例如：聽診雙側肺野",
      "atSeconds": 245,
      "statedPurpose": true,
      "statedItem": true,
      "statedSite": false,
      "quote": "逐字稿原句",
      "missing": "缺少的要素，例如：未說明檢查部位"
    }
  ],
  "cueAudit": [
    {
      "cueId": "對應上方提示卡的識別碼",
      "label": "提示卡名稱",
      "atSeconds": 245,
      "precededByRelevantSpeech": true,
      "note": "取得此提示卡前，她是否已先口述對應的檢查或問診。若否，代表她在還沒做到該項目就先看了答案。"
    }
  ],
  "observations": {
    "strengths": ["以錄音為憑的具體優點，每項都要對得上逐字稿"],
    "gaps": ["以錄音為憑的具體缺漏，每項都要對得上逐字稿"],
    "closingBehaviour": "她在最後有沒有向病人解釋評估結果與下一步計畫或注意事項（公文明列的要求）。沒有就直說沒有。"
  }
}

sayDoFindings 必須涵蓋錄音中每一次她口述執行的身體檢查，即使三要素全缺也要列出——三要素全缺的那幾筆正是她最需要看到的。`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "只接受 POST" }, 405);
  }

  let uploadedName: string | null = null;

  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const rawMeta = form.get("meta");

    if (!(audio instanceof File)) {
      return json({ error: "缺少 audio 欄位" }, 400);
    }
    if (typeof rawMeta !== "string") {
      return json({ error: "缺少 meta 欄位" }, 400);
    }

    const meta = JSON.parse(rawMeta) as Meta;
    const bytes = new Uint8Array(await audio.arrayBuffer());

    if (bytes.byteLength === 0) {
      return json({ error: "錄音檔是空的，可能是麥克風權限被擋掉了" }, 400);
    }

    const file = await uploadFile(
      bytes,
      audio.type || "audio/mpeg",
      `osce-${Date.now()}`,
    );
    uploadedName = file.name;

    const result = await generateJson<Record<string, unknown>>([
      { file_data: { mime_type: audio.type || "audio/mpeg", file_uri: file.uri } },
      { text: buildPrompt(meta) },
    ]);

    return json(result);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  } finally {
    if (uploadedName) await deleteFile(uploadedName);
  }
});
