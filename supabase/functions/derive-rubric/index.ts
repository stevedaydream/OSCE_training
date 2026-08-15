/**
 * derive-rubric：把一題「已經匯入的內容」重組成評分項草稿。
 *
 * 這條線畫在哪很重要：
 *  - 允許的是**重組**。案例裡已經寫著「疼痛轉移左上腹」「左腰 Turner sign」，
 *    把它變成一條檢核項「問出疼痛由左後腰轉移至左上腹」，沒有產生新的臨床事實。
 *  - 禁止的是**發明**。案例沒提到的檢查、沒提到的診斷、沒提到的處置，一律不得寫入。
 *
 * 配分依現行四類比重分配，同一類內部平均分——分類總分是已知的實況，
 * 但同類裡誰輕誰重屬於判斷，不是教案裡寫著的事實，留給人在編輯器裡調。
 * 產出仍是草稿，station 維持未審核，必須經人工確認。
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { CORS_HEADERS, generateJson, json } from "../_shared/gemini.ts";

interface StationContent {
  title?: string;
  department?: string;
  doorSheet?: Record<string, string>;
  examinerGuide?: Record<string, string>;
  cueCards?: { label?: string; content?: string; peItem?: string }[];
}

function buildPrompt(station: StationContent): string {
  const cues = (station.cueCards ?? [])
    .map((c) => `- ${c.label ?? ""}${c.peItem ? `（對應檢查：${c.peItem}）` : ""}：${c.content ?? ""}`)
    .join("\n") || "（無提示卡）";

  return `你是台灣衛生福利部專科護理師甄審口試的試務人員。以下是一份已經數位化的 OSCE 教案內容，但它**沒有附評分表**。請把這份教案裡「已經寫著的內容」重組成評分項草稿。

【最重要的規則】
1. **只能重組，不能發明。** 每一條評分項都必須能在下方內容中找到對應的文字依據。
2. 教案沒提到的身體檢查、沒提到的鑑別診斷、沒提到的處置，**一律不得寫進評分項**。
   寧可只產出 5 條有依據的，也不要湊出 10 條。
3. **配分依分類權重平均分配。** 衛福部公告未規定細項配分，但現行甄審的四類比重是
   臨床推理與決策 45、身體評估（說做合一）25、病史詢問 15、溝通 15（總分 100）。
   把每一類的總分平均分給該類的項目，四捨五入後微調到該類剛好等於目標值。
   某一類若沒有產生任何項目，該類的分數不要挪給別類，直接讓總分低於 100，並在 notes 說明。
   同一類裡誰輕誰重屬於判斷，不是教案裡寫著的事實，所以一律平均分，不要自行加權。
4. 分類請盡量對齊公告一、(一) 的四大能力：病史詢問、身體評估（說做合一）、臨床推理與決策、溝通。
   若教案內容不足以支撐某一類，就不要產生該類的項目。
5. 「身體評估（說做合一）」類的項目，措辭必須包含「同時說明檢查目的、項目及部位」，
   因為那是公告一、(三) 的明文要求。

【考題】${station.title ?? "（未命名）"}

【門前貼紙】
病人：${station.doorSheet?.patient ?? ""}
主訴：${station.doorSheet?.chiefComplaint ?? ""}
生命徵象：${station.doorSheet?.vitalSigns ?? ""}
考生任務：${station.doorSheet?.task ?? ""}

【考官指南】
${station.examinerGuide?.overview ?? ""}

【標準化病人回答指引】
${station.examinerGuide?.standardPatientPrompt ?? ""}

【提示卡】
${cues}

【輸出 JSON】
{
  "rubricItems": [
    {
      "category": "四大分類之一",
      "title": "評分項描述，必須對應到上方某段文字",
      "maxPoints": 15,
      "critical": true,
      "basis": "你依據的原文片段，直接引用，方便人工核對"
    }
  ],
  "notes": [
    "指出教案內容不足、無法產生評分項的面向，讓使用者知道要自己補什麼。例如：本教案未描述任何溝通或衛教內容，故未產生溝通類項目。"
  ]
}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "只接受 POST" }, 405);
  }

  try {
    const station = await req.json() as StationContent;

    const hasContent = station.doorSheet?.chiefComplaint ||
      station.examinerGuide?.overview ||
      station.examinerGuide?.standardPatientPrompt ||
      (station.cueCards ?? []).length > 0;

    if (!hasContent) {
      return json({ error: "這一題還沒有足夠的內容可以重組，請先填好門前貼紙或考官指南。" }, 400);
    }

    const result = await generateJson<{ rubricItems: unknown[]; notes: string[] }>(
      [{ text: buildPrompt(station) }],
    );

    return json(result);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
