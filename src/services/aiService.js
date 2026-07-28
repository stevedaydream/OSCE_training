/**
 * AI Service for Nurse Practitioner (NP / 專科護理師) National Exam OSCE
 * Supports:
 * 1. AI Text Prompt NP Station Generator (Categorized by NP Specialty Department, Default: Surgical NP)
 * 2. Image / Photo OCR NP Rubric & Question Parser (Vision API)
 * 3. Post-Exam Deep AI Analysis Report Generation for NP Candidates
 */

export function getApiKey() {
  return localStorage.getItem('OSCE_GEMINI_API_KEY') || '';
}

export function setApiKey(key) {
  if (key) {
    localStorage.setItem('OSCE_GEMINI_API_KEY', key.trim());
  } else {
    localStorage.removeItem('OSCE_GEMINI_API_KEY');
  }
}

/**
 * Call Gemini REST API
 */
async function callGeminiAPI(prompt, imageBase64 = null, mimeType = 'image/jpeg') {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API Key missing');
  }

  const model = 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contentsParts = [];
  
  if (imageBase64) {
    contentsParts.push({
      inline_data: {
        mime_type: mimeType,
        data: imageBase64.replace(/^data:image\/\w+;base64,/, '')
      }
    });
  }

  contentsParts.push({ text: prompt });

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: contentsParts }],
      generationConfig: {
        temperature: 0.3,
        response_mime_type: "application/json"
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || `Gemini API Error: ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  return JSON.parse(rawText);
}

/**
 * 1. Generate Station for Nurse Practitioner (NP) National Exam (Categorized by NP Specialty Department)
 */
export async function generateStationFromPrompt(topicPrompt, department = '外科專科護理師 (Surgical NP)') {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    await new Promise(r => setTimeout(r, 1200));
    return createMockNPStation(topicPrompt, department);
  }

  const prompt = `你是一位台灣衛生福利部「專科護理師 (Nurse Practitioner, NP) 國家考試」資深 OSCE 試務委員與評審考官。請根據使用者輸入的臨床情境主題「${topicPrompt}」（專科分科：${department}），一律遵循衛福部國考標準（15分鐘全場，含門前閱讀2分鐘與考間口試13分鐘，包含焦點式訪談、說做合一身體檢查、專科護理處置、SBAR溝通與病患安全），生成合乎專科護理師國家考試標準的 OSCE 考題 JSON 物件。

JSON 必須嚴格遵循以下 Schema：
{
  "id": "station_np_${Date.now()}",
  "title": "考題標題 (專科護理師國考風格)",
  "department": "${department}",
  "difficulty": "衛福部國考標準",
  "category": "專科護理評估與臨床處置",
  "timing": {
    "readingSeconds": 120,
    "examSeconds": 780,
    "feedbackSeconds": 120
  },
  "candidateInfo": {
    "situation": "65歲男性，PPU 術後第一天，主訴腹痛、呼吸喘...（請精簡寫出病患主訴，模擬門口貼紙格式）",
    "task": "請於門前詳細閱讀基本資料與主訴，進入考場後執行焦點式病史訪談、身體健康評估（說做合一），並向口試委員解釋可能健康問題與下一步計畫。",
    "vitalSigns": "T: 37.8°C | O2 3L SpO2: 92-94% | HR: 108 bpm | RR: 26 bpm | BP: 135/85 mmHg"
  },
  "examinerGuide": {
    "overview": "考官指南：2位口試委員現場評量，評估焦點式病史訪談、說做合一身體檢查與 SBAR 溝通。",
    "standardPatientPrompt": "標準化病患/家屬回答指引 (包含 LQQOPERA、飲食、個人史與家族史)"
  },
  "cueCards": [
    {
      "id": "cue_1",
      "label": "提示：身體評估/檢驗報告",
      "type": "text",
      "title": "NP Clinical Prompt",
      "content": "【護理與臨床檢查數據】文字說明",
      "category": "Physical Exam"
    }
  ],
  "rubricItems": [
    {
      "id": "r1",
      "category": "焦點式病史訪談",
      "title": "評分細項目與標準",
      "maxPoints": 20,
      "critical": true
    }
  ],
  "globalRating": [
    {"score": 5, "label": "優異 (Clear Pass - Competent NP)"},
    {"score": 4, "label": "良好 (Pass)"},
    {"score": 3, "label": "邊緣通過 (Borderline Pass)"},
    {"score": 2, "label": "未通過 (Borderline Fail)"},
    {"score": 1, "label": "嚴重不合格 (Clear Fail - Unsafe NP)"}
  ]
}`;

  try {
    return await callGeminiAPI(prompt);
  } catch (err) {
    console.warn('Gemini API call failed, falling back to NP template generator:', err);
    return createMockNPStation(topicPrompt, department);
  }
}

/**
 * 2. Parse NP Station & Rubrics from Uploaded Image (Vision OCR)
 */
export async function parseStationFromImage(imageBase64, mimeType = 'image/jpeg') {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    await new Promise(r => setTimeout(r, 1500));
    return createMockNPStation('外科專科護理師國考紙本考題 (OCR 範例)', '外科專科護理師 (Surgical NP)');
  }

  const prompt = `請解析這張專科護理師 (NP) OSCE 紙本考題或評分表照片，識別出試題名稱、專科分科、NP 應試任務、健康評估重點、提示 Cue Cards，以及評分表細項。
輸出必須為標準 JSON 格式。`;

  try {
    return await callGeminiAPI(prompt, imageBase64, mimeType);
  } catch (err) {
    console.error('Vision OCR error:', err);
    throw err;
  }
}

/**
 * 3. Generate Post-Exam AI Analysis Report for NP Candidates
 */
export async function generatePostExamReport({ station, examinerScores, timestamps, cueLog }) {
  const apiKey = getApiKey();

  const examinerCount = Object.keys(examinerScores).length || 1;
  let totalScoreSum = 0;
  
  Object.values(examinerScores).forEach(ex => {
    totalScoreSum += ex.totalScore || 0;
  });
  
  const avgScore = Math.floor((totalScoreSum / Math.max(1, examinerCount)) * 100) / 100;

  if (!apiKey) {
    await new Promise(r => setTimeout(r, 1000));
    return createMockNPReport(station, avgScore, examinerScores, cueLog);
  }

  const prompt = `你是一位台灣專科護理師 (Nurse Practitioner, NP) 國家考試資深評審委員。請根據以下專科護理師考生的考評數據與評審扣分項，依衛福部國考標準生成專科護理師個人化深度分析報告（JSON 格式）：

【考題標題】：${station.title}
【專科分科】：${station.department || '外科專科護理師'}
【平均實得成績】：${avgScore} / 100 分 (及格分數為 60.00 分)
【評審人數】：2 位口試委員
【評審扣分與評語】：${JSON.stringify(examinerScores)}
【舉牌提示發送歷程】：${cueLog.length} 次 (${JSON.stringify(cueLog)})

請輸出 JSON 物件：
{
  "totalScore": ${avgScore},
  "passStatus": "${avgScore >= 60.0 ? 'PASS' : 'FAIL'}",
  "timeAllocationAnalysis": {
    "readingTimeUsed": "2分00秒 (門前閱讀充分)",
    "historyTakingUsed": "3分15秒 (焦點式病史訪談)",
    "physicalExamUsed": "4分15秒 (說做合一身體健康評估)",
    "managementPlanUsed": "3分30秒 (臨床推理與 SBAR 溝通)",
    "paceEvaluation": "專科健康評估時間掌握得當，在結束前 2 分鐘廣播提示時能迅即回應與做結論。"
  },
  "diagnosticReasoningAnalysis": {
    "coverageRate": "92%",
    "criticalErrors": [],
    "clinicalDecisionPath": "NP 考生展現極佳的外科專科護理決策能力，健康評估說做合一，並能清晰向口試委員簡報處置邏輯。"
  },
  "strengths": [
    "焦點式病史訪談 LQQOPERA 架構完整",
    "身體評估時說做合一，主動向病患說明目的與部位",
    "提示卡獲得後能迅速聯想外科專科照護指引"
  ],
  "improvementTips": [
    "建議強化向口試委員簡報之 SBAR 結構口述流暢度",
    "身體檢查時建議強調說做合一對病患之隱私維護說明",
    "最後 2 分鐘聽見廣播提醒時，快速總結專科護理處置與下一步計畫"
  ],
  "expertSummary": "本場專科護理師 (NP) 國家考試模擬判定為【${avgScore >= 60.0 ? '合格 (PASS)' : '建議加強 (FAIL)'}】。具備紮實的外科專科護理評估與評估決策能力。"
}`;

  try {
    return await callGeminiAPI(prompt);
  } catch (err) {
    console.warn('AI report API failed, returning NP structured summary:', err);
    return createMockNPReport(station, avgScore, examinerScores, cueLog);
  }
}

// Fallback Helper Functions tuned for NP Exam
function createMockNPStation(topic, department) {
  return {
    id: `station_np_${Date.now()}`,
    title: topic.includes('考題') ? topic : `專科護理師國考真題：${topic}`,
    department: department || "外科專科護理師 (Surgical NP)",
    difficulty: "衛福部國考標準",
    category: "專科護理評估與處置",
    timing: { readingSeconds: 120, examSeconds: 780, feedbackSeconds: 120 },
    candidateInfo: {
      situation: `65歲男性，術後第一天，主訴「${topic}」，腹痛加劇與呼吸喘。`,
      task: "請於門前詳細閱讀基本資料與主訴，進入考場後執行焦點式病史訪談、身體健康評估（說做合一），並向口試委員解釋可能健康問題與下一步計畫。",
      vitalSigns: "T: 37.8°C | O2 3L SpO2: 92-94% | HR: 108 bpm | RR: 26 bpm | BP: 135/85 mmHg"
    },
    examinerGuide: {
      overview: `評估專科護理師對 ${topic} 之焦點式訪談、說做合一身體檢查與 SBAR 溝通。`,
      standardPatientPrompt: "當 NP 考生詢問主要不適時，詳細說明 LQQOPERA 疼痛發作時間與程度。"
    },
    cueCards: [
      {
        id: "cue_np_1",
        label: "提示：專科身體評估與檢驗報告",
        type: "text",
        title: "NP Clinical Assessment Prompt",
        content: `【檢驗報告與護理評估】雙側濕囉音，聽診無腸音，引流液顏色混濁。`,
        category: "Lab & Exam"
      },
      {
        id: "cue_np_2",
        label: "提醒：結束前 2 分鐘廣播提醒",
        type: "text",
        title: "Time Broadcast Prompt",
        content: "【考場廣播提醒】口試結束前 2 分鐘！請自行掌握時間進行說明與結論。",
        category: "Time Alert"
      }
    ],
    rubricItems: [
      { id: "r1", category: "焦點式病史訪談", title: "完整詢問 LQQOPERA 發作時間、症狀性質與伴隨風險", maxPoints: 20, critical: true },
      { id: "r2", category: "焦點式身體檢查 (說做合一)", title: "精準進行身體檢查診察並向病人說明目的與部位", maxPoints: 25, critical: true },
      { id: "r3", category: "臨床推理與診斷", title: "正確提出專科護理診斷與急重症預警指標評估", maxPoints: 25, critical: true },
      { id: "r4", category: "下一步計畫與 SBAR 溝通", title: "提出符合指引之處置計畫並以 SBAR 向口試委員簡報", maxPoints: 20, critical: true },
      { id: "r5", category: "溝通與病患安全", title: "展現同理心與以病人為中心之專業溝通態度", maxPoints: 10, critical: false }
    ],
    globalRating: [
      { score: 5, label: "優異 (Clear Pass - Competent NP)" },
      { score: 4, label: "良好 (Pass)" },
      { score: 3, label: "邊緣通過 (Borderline Pass)" },
      { score: 2, label: "未通過 (Borderline Fail)" },
      { score: 1, label: "嚴重不合格 (Clear Fail - Unsafe NP)" }
    ]
  };
}

function createMockNPReport(station, avgScore, examinerScores, cueLog) {
  return {
    totalScore: avgScore,
    passStatus: avgScore >= 60.0 ? 'PASS' : 'FAIL',
    timeAllocationAnalysis: {
      readingTimeUsed: "2分00秒 (門前閱讀充分)",
      historyTakingUsed: "3分15秒 (焦點式病史訪談)",
      physicalExamUsed: "4分15秒 (說做合一身體檢查)",
      managementPlanUsed: "3分30秒 (SBAR 簡報與下一步計畫)",
      paceEvaluation: "專科護理評估時間配比合宜，結束前 2 分鐘聽見廣播提醒時回應迅速。"
    },
    diagnosticReasoningAnalysis: {
      coverageRate: `${Math.min(96, Math.max(68, avgScore + 8))}%`,
      criticalErrors: avgScore < 60.0 ? ["未於第一時間說做合一進行身體檢查說明"] : [],
      clinicalDecisionPath: "NP 考生展現熟練的外科專科護理評估與決策素養，說做合一規範，處置說明清晰。"
    },
    strengths: [
      "焦點式病史訪談與 LQQOPERA 脈絡清楚",
      "身體檢查時說做合一，主動說明檢查目的與部位",
      "態度沉著，溝通展現高度護理同理心"
    ],
    improvementTips: [
      "建議強化向口試委員簡報之 SBAR 結構口述流暢度",
      "身體檢查時建議口述『協助量測雙側脈搏與末梢循環評估』",
      "最後 2 分鐘聽見廣播提醒時，快速總結專科護理處置與下一步計畫"
    ],
    expertSummary: `本場專科護理師 (NP) 甄審口試模擬判定為【${avgScore >= 60.0 ? '合格 (PASS)' : '建議加強 (FAIL)'}】。實得成績為 ${avgScore.toFixed(2)} 分，具備優秀的專科護理素養與臨床評估決策能力。`
  };
}
