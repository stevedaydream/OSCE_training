export const INITIAL_STATIONS = [
  {
    id: "station_np_ppu_postop_303",
    title: "【專科護理師甄審口試】PPU 術後腹痛與呼吸喘",
    department: "外科專科護理師 (Surgical NP)",
    difficulty: "衛福部國考標準 (15分鐘)",
    category: "焦點式病史訪談與健康評估",
    timing: {
      readingSeconds: 120,    // 門外讀題 2 分鐘
      examSeconds: 780,       // 考間口試 13 分鐘 (加計總時間 15 分鐘)
      feedbackSeconds: 120    // 評審講評 2 分鐘
    },
    candidateInfo: {
      situation: "65歲男性，PPU (消化性潰瘍穿孔) 術後第一天，主訴腹痛、呼吸喘。",
      task: "請於門前詳細閱讀基本資料與主訴，鈴響進入考場後執行焦點式病史訪談、身體健康評估（向病人說明檢查目的、項目及部位），並向口試委員解釋可能健康問題、下一步計畫與注意事項。",
      vitalSigns: "T: 37.8°C | O2 3L SpO2: 92-94% | HR: 108 bpm | RR: 26 bpm | BP: 135/85 mmHg"
    },
    examinerGuide: {
      overview: "【110年度甄審規範】由 2 位口試委員現場評量。計算 2 位委員評分總數之平均數為實得成績（計算至小數第2位，第3位無條件捨去），及格分數為 60 分。",
      standardPatientPrompt: "【SP 標準演員回答】\n1. LQQOPERA: 肚子悶脹痛、想吐吐不出來、尿少。\n2. 飲食: 偏辣飲食、習慣外食。\n3. 家族史: 糖尿病(母)。\n4. 個人史: 高血壓、糖尿病、抽菸 30 年。"
    },
    cueCards: [
      {
        id: "cue_ppu_301",
        label: "提示：胸肺與腹部聽診報告",
        type: "text",
        title: "Physical Assessment Prompt (身體評估)",
        content: "【身體評估】\n1. 胸肺聽診：雙側濕囉音 (Bilateral Crackles)\n2. 腹部聽診：無腸蠕動音 (Absent bowel sounds)",
        category: "Physical Exam"
      },
      {
        id: "cue_ppu_302",
        label: "提示：CWV 引流管與傷口狀況",
        type: "text",
        title: "Wound & Drain Assessment (管路與傷口)",
        content: "【管路與傷口】\n1. CWV 引流管：顏色混濁 (Turbid drainage)\n2. 腹部傷口：無紅腫痛",
        category: "Wound/Drain"
      },
      {
        id: "cue_ppu_303",
        label: "提醒：考間結束前2分鐘廣播提醒",
        type: "text",
        title: "Time Broadcast Prompt (廣播提醒)",
        content: "【考場廣播提醒】口試結束前 2 分鐘！請自行掌握考試時間，儘速向口試委員解釋評估結果與下一步計畫。",
        category: "Time Alert"
      }
    ],
    rubricItems: [
      {
        id: "ppu_r1",
        category: "焦點式病史訪談",
        title: "運用 LQQOPERA 詢問主訴 (肚子悶脹痛、嘔吐、尿少) 與個人/家族史 (飲食偏辣外食、高血壓/糖尿病/抽菸30年/母DM)",
        maxPoints: 20,
        critical: true
      },
      {
        id: "ppu_r2",
        category: "焦點式健康評估 (說做合一)",
        title: "執行胸肺與腹部身體檢查時，同時向病人說明檢查目的、項目及部位 (聽診雙側濕囉音、無腸音、檢查 CWV 顏色混濁與傷口)",
        maxPoints: 25,
        critical: true
      },
      {
        id: "ppu_r3",
        category: "臨床推理與判讀說明",
        title: "向口試委員解釋可能健康問題與理由 (麻痺性腸阻塞、腹腔內滲漏感染疑慮、術後肺擴張不全與少尿 AKI 疑慮)",
        maxPoints: 25,
        critical: true
      },
      {
        id: "ppu_r4",
        category: "下一步計畫與溝通",
        title: "向口試委員與病人解釋下一步計畫 (追蹤 CBC/BUN/Cr/KUB/CXR、引流液培養、NPO/胃管引流) 與注意事項",
        maxPoints: 20,
        critical: true
      },
      {
        id: "ppu_r5",
        category: "以病人為中心之專業溝通",
        title: "態度沉著專業，展現同理心與溝通能力，說明檢查過程安全與衛教",
        maxPoints: 10,
        critical: false
      }
    ],
    globalRating: [
      { score: 5, label: "優異 (Clear Pass - Superior NP)" },
      { score: 4, label: "良好 (Pass - Competent NP)" },
      { score: 3, label: "邊緣通過 (Borderline Pass)" },
      { score: 2, label: "未通過 (Borderline Fail)" },
      { score: 1, label: "嚴重不合格 (Clear Fail)" }
    ]
  }
];
