import { useMemo, useState } from 'react';
import { Copy, Check, ClipboardPaste } from 'lucide-react';

/**
 * 出題頁：把 prompts/ 底下的兩段 prompt 直接搬到畫面上，填好情境就能複製去餵 AI。
 *
 * 這裡**不重寫一份 prompt 內容**，而是用 Vite 的 ?raw 把 md 檔整個讀進來。
 * 理由是我們才剛因為 CATEGORY_WEIGHTS 手抄在三個地方而踩過坑——
 * prompt 一旦有兩份，改了一份忘了另一份，頁面就會教錯東西。
 * `prompts/*.md` 永遠是唯一來源，這頁只是它的顯示器。
 */
import promptARaw from '../../prompts/A_differential-reasoning.md?raw';
import promptBRaw from '../../prompts/B_reasoning-to-station.md?raw';

/**
 * 取出 md 檔裡兩個獨立 `---` 之間的 prompt 本體。
 * 兩份檔案的結構都固定是：說明 → `---` → prompt 本體 → `---` → 使用後必做。
 * 表格裡的 `| :--- |` 不是獨立成行，不會被 /^---$/m 誤切。
 */
function extractPromptBody(raw) {
  const parts = raw.split(/^---$/m);
  return (parts[1] ?? raw).trim();
}

const PROMPT_A = extractPromptBody(promptARaw);
const PROMPT_B = extractPromptBody(promptBRaw);

const FLOW = [
  {
    title: '挑一個情境',
    body: '可以用 prompts/samples/sp63-triage.md 裡已經分流好的 20 題外科情境，也可以貼你自己遇到的臨床案例。資訊量抓門前貼紙的程度就好——病人、主訴、生命徵象。',
  },
  {
    title: '跑 Prompt A → 推理文件',
    body: '產出焦點式病史、身體評估（含說做合一口白）、檢查順序、前三個鑑別診斷，以及兩段逐字稿。這是整條線上唯一允許 AI 產生新臨床事實的一步。',
  },
  {
    gate: true,
    title: '你審一次臨床正確性',
    body: '逐條看第 4、5、7 節。特別是第 7 節的「③ 不能排除」——模型最容易在那一格塞罕見病湊數。第 9 節列出的疑點要自己查證或問資深同仁。',
  },
  {
    title: '跑 Prompt B → station JSON',
    body: '把審過的推理文件重組成考題。這一步只重組、不發明，所以每條評分項都能回溯到 A 的原文。配分依四類比重自動分配。',
  },
  {
    title: '到題庫貼上 JSON 匯入',
    body: '題庫頁 →「貼上 JSON 匯入」。來源會標成「AI 生成」，與紙本 OCR 分開。',
  },
  {
    gate: true,
    title: '你在編輯器再審一次',
    body: '逐項確認門前貼紙、提示卡觸發詞、評分項與配分，確認完才轉「已審核」。臨床正確性由你背書，不由 AI 背書。',
  },
];

function CopyButton({ text, disabled }) {
  const [state, setState] = useState('idle');

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState('done');
      setTimeout(() => setState('idle'), 1800);
    } catch {
      // clipboard API 需要 https 或 localhost。失敗時不要靜靜地什麼都不做，
      // 要讓她知道可以手動選取下面的全文。
      setState('failed');
    }
  }

  return (
    <>
      <button type="button" className="btn btn-primary" disabled={disabled} onClick={copy}>
        {state === 'done' ? <Check size={16} /> : <Copy size={16} />}
        {state === 'done' ? '已複製' : '複製整段 Prompt'}
      </button>
      {state === 'failed' && (
        <span className="faint">瀏覽器不允許自動複製，請展開下方全文手動選取。</span>
      )}
    </>
  );
}

export default function BuildTab() {
  const [scenario, setScenario] = useState('');
  const [reasoning, setReasoning] = useState('');

  // 沒填的時候保留 {{…}} 佔位符——複製出去仍然是一份完整可用的 prompt，
  // 只是要自己在對話框裡補情境。比擋著不讓複製好用。
  const filledA = useMemo(
    () => PROMPT_A.replace('{{情境}}', scenario.trim() || '{{情境}}'),
    [scenario],
  );
  const filledB = useMemo(
    () => PROMPT_B.replace('{{推理文件}}', reasoning.trim() || '{{推理文件}}'),
    [reasoning],
  );

  return (
    <div className="page">
      <div className="build-layout">
        <aside className="card">
          <div className="card-title">
            <h3>教案製作流程</h3>
            <span className="hint">兩道人工關卡</span>
          </div>

          <p className="muted" style={{ marginBottom: '0.8rem' }}>
            拆成兩段 prompt 是為了讓<strong>發明只發生一次</strong>：A 產出的臨床事實由你審一次，
            B 之後每一條評分項都能回溯到 A 的原文。混在一份裡就分不出哪條有依據。
          </p>

          {FLOW.map((step, index) => (
            <div className={`flow-step ${step.gate ? 'is-gate' : ''}`} key={step.title}>
              <div className="flow-num">{step.gate ? '審' : index + 1}</div>
              <div className="flow-body">
                <strong>{step.title}</strong>
                <span>{step.body}</span>
              </div>
            </div>
          ))}

          <p className="faint" style={{ marginTop: '0.9rem' }}>
            這兩段 prompt 的內容直接讀自 <code>prompts/</code> 底下的 md 檔，
            改那邊這一頁就會跟著改，不會有兩份不一致。
          </p>
        </aside>

        <div>
          <div className="card">
            <div className="card-title">
              <h3>Prompt A：情境 → 鑑別診斷推理</h3>
              <span className="hint">唯一允許發明臨床事實的一步</span>
            </div>

            <label className="muted" htmlFor="scenario">
              貼上病人主訴與情境（門前貼紙的資訊量：病人、主訴、生命徵象）
            </label>
            <textarea
              id="scenario"
              className="textarea"
              rows={6}
              value={scenario}
              placeholder={'53 歲女性，右上腹痛。\n疼痛已 6 小時，伴隨噁心嘔吐 2 次。\n血壓 138/84 mmHg、體溫 38.1 度、脈搏 102 次/分鐘。'}
              onChange={(event) => setScenario(event.target.value)}
              style={{ marginTop: '0.4rem' }}
            />

            <div className="row" style={{ marginTop: '0.7rem', alignItems: 'center' }}>
              <CopyButton text={filledA} />
              {!scenario.trim() && (
                <span className="faint">還沒填情境也可以複製，貼過去再補即可。</span>
              )}
            </div>

            <details style={{ marginTop: '0.8rem' }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>
                展開完整 Prompt A（{filledA.length.toLocaleString()} 字）
              </summary>
              <div className="prompt-preview">{filledA}</div>
            </details>
          </div>

          <div className="card">
            <div className="card-title">
              <h3>Prompt B：推理文件 → 考題與評分表</h3>
              <span className="hint">只重組，不發明</span>
            </div>

            <label className="muted" htmlFor="reasoning">
              貼上<strong>已經審核過</strong>的 Prompt A 產出（整份，含九節到第 10 節）
            </label>
            <textarea
              id="reasoning"
              className="textarea"
              rows={6}
              value={reasoning}
              placeholder={'# 1. 情境事實清單\n…\n# 10. 十五分鐘怎麼跑（自檢）\n…'}
              onChange={(event) => setReasoning(event.target.value)}
              style={{ marginTop: '0.4rem' }}
            />

            <div className="row" style={{ marginTop: '0.7rem', alignItems: 'center' }}>
              <CopyButton text={filledB} />
              {!reasoning.trim() && (
                <span className="faint">還沒審完就先別跑 B——沒審過的臨床事實會被原封不動抄進評分表。</span>
              )}
            </div>

            <details style={{ marginTop: '0.8rem' }}>
              <summary className="muted" style={{ cursor: 'pointer' }}>
                展開完整 Prompt B（{filledB.length.toLocaleString()} 字）
              </summary>
              <div className="prompt-preview">{filledB}</div>
            </details>

            <p className="muted" style={{ marginTop: '0.9rem' }}>
              <ClipboardPaste size={14} style={{ verticalAlign: '-2px' }} />
              {' '}拿到 JSON 之後，到<strong>題庫</strong>頁按「貼上 JSON 匯入」。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
