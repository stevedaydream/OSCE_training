/**
 * ocr-station：把紙本 OSCE 考題／評分表的照片轉成可編輯的題目草稿。
 *
 * 產出一律標記為未審核。題庫的臨床正確性由人背書，不由模型背書——
 * 模型在這裡的職責只有「把紙上已經寫著的東西抄進欄位」，不得補寫任何原文沒有的內容。
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS_HEADERS, generateJson, json } from "../_shared/gemini.ts";

const DEPARTMENT_TIMING: Record<string, { readingSeconds: number; examSeconds: number }> = {
  // 內科、精神科、兒科、外科、婦產科：門前閱讀 2 分鐘「不計入」15 分鐘考間時間
  surgical: { readingSeconds: 120, examSeconds: 900 },
  internal: { readingSeconds: 120, examSeconds: 900 },
  pediatric: { readingSeconds: 120, examSeconds: 900 },
  obgyn: { readingSeconds: 120, examSeconds: 900 },
  psychiatric: { readingSeconds: 120, examSeconds: 900 },
  family: { readingSeconds: 120, examSeconds: 900 },
  // 麻醉科是唯一「15 分鐘含考間外讀題 2 分鐘」的分科
  anesthesia: { readingSeconds: 120, examSeconds: 780 },
};

const PROMPT = `你是台灣專科護理師甄審口試的試務人員，正在把一份紙本 OSCE 考題或評分表數位化。

【最重要的規則】
1. **只抄紙上寫著的內容。** 不要補充、不要改寫、不要「幫忙完善」。這份題目要拿去給真的要考試的人練習，你多寫一個字都可能讓她練到錯的東西。
2. 紙上沒有的欄位，一律留空字串或空陣列。**不要用常見範例去填空。**
3. 影像模糊或被裁切而讀不出來的地方，在該欄位寫「[影像不清]」，不要猜。
4. 配分請照紙上寫的抄。紙上沒有配分就把 maxPoints 設為 null——衛福部公告並未規定細項配分，不要自己發明一套。

【輸出 JSON，嚴格遵循此結構】
{
  "title": "考題名稱",
  "doorSheet": {
    "patient": "病人基本資料，例如：65歲男性，PPU 術後第一天",
    "chiefComplaint": "主訴",
    "vitalSigns": "生命徵象原文，維持紙上的格式",
    "task": "考生任務說明"
  },
  "examinerGuide": {
    "overview": "給口試委員的評量重點說明",
    "standardPatientPrompt": "標準化病人的回答指引（病史、個人史、家族史等）"
  },
  "cueCards": [
    {
      "label": "提示卡在紙上的名稱",
      "title": "卡片標題",
      "content": "卡片內容，例如檢查發現或檢驗報告數值",
      "category": "分類，例如：身體檢查發現 / 檢驗報告 / 影像",
      "peItem": "此提示卡對應的身體檢查項目，例如：胸部聽診。紙上沒寫就留空",
      "triggerKeywords": ["由 peItem 推得的口語關鍵詞，例如：聽診、肺音、呼吸音。純屬語音解鎖用途，可自行補齊常見說法"]
    }
  ],
  "rubricItems": [
    {
      "category": "評分表上的大分類，例如：焦點式病史訪談",
      "title": "細項描述",
      "maxPoints": 20,
      "critical": true
    }
  ],
  "unreadable": ["列出所有你讀不出來、需要人工補的部分。全都讀得清楚就給空陣列。"]
}

triggerKeywords 是唯一允許你「推論」的欄位——那只是語音辨識用的同義詞清單，不影響臨床內容。其餘欄位一律照抄。`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "只接受 POST" }, 405);
  }

  try {
    const { images, department } = await req.json() as {
      images: { data: string; mimeType: string }[];
      department?: string;
    };

    if (!Array.isArray(images) || images.length === 0) {
      return json({ error: "缺少 images" }, 400);
    }

    const parts = [
      ...images.map((img) => ({
        inline_data: {
          mime_type: img.mimeType || "image/jpeg",
          data: img.data.replace(/^data:[^;]+;base64,/, ""),
        },
      })),
      { text: PROMPT },
    ];

    const draft = await generateJson<Record<string, unknown>>(parts);
    const dept = department && DEPARTMENT_TIMING[department] ? department : "surgical";

    return json({
      ...draft,
      department: dept,
      source: "ocr",
      reviewed: false,
      timing: { ...DEPARTMENT_TIMING[dept], alertSeconds: 120 },
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
