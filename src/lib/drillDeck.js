/**
 * 推理速練的題庫：直接讀 prompts/samples/stations/ 底下的 Prompt A 產出。
 *
 * 為什麼讀 md 而不讀 stations 資料表：
 * 那 21 份文件的第 1 節就是題目、第 7 節就是三格答案，而且第 9 節列出了模型自己
 * 不確定的地方。這是現成的資產，不必再抄一份進資料庫。
 *
 * ⚠️ 代價要講清楚：**這些文件沒有經過人工審核**。所以 UI 上每一題都必須顯示這一點，
 * 而且對答案時要一併顯示第 9 節，否則她會把模型不確定的東西當標準答案背下來。
 *
 * 檔案不用 eager 載入——21 份加起來約 400KB，全部塞進主 bundle 會讓首頁變慢。
 * 只有抽到那一題才動態載入。
 */

const MODULES = import.meta.glob('../../prompts/samples/stations/*.md', {
  query: '?raw',
  import: 'default',
});

/** 從檔名生出牌卡標籤，例如 A-13-48M-血尿.md → { code: 'A-13', label: '48M 血尿' } */
function labelFromPath(path) {
  const file = path.split('/').pop().replace(/\.md$/, '');
  const parts = file.split('-');
  const code = parts.slice(0, 2).join('-');
  return { code, label: parts.slice(2).join(' ') };
}

export const DECK = Object.keys(MODULES)
  .sort()
  .map((path) => ({ path, ...labelFromPath(path) }));

/**
 * 解析一份 Prompt A 文件。
 *
 * 21 份的結構驗證過完全一致：`## 輸入情境` × 1、`# 7. ` × 1、`## ①②③` 各 1。
 * 但仍然逐項檢查並在缺漏時丟錯——解析器最糟的失敗模式是靜靜產出空白卡片，
 * 那會讓她對著空題目發呆卻不知道是程式壞了。
 */
export function parseCard(raw, meta) {
  const title = (raw.match(/^# (.+)$/m) ?? [])[1]?.trim() ?? '';

  const scenario = (raw.split(/^## 輸入情境.*$/m)[1] ?? '')
    .split(/^(?:---|# 1\.)/m)[0]
    .replace(/```/g, '')
    .trim();

  const section7 = ((raw.split(/^# 7\. .*$/m)[1] ?? '').split(/^# 8\./m)[0] ?? '').trim();
  const section9 = ((raw.split(/^# 9\. .*$/m)[1] ?? '').split(/^# 10\./m)[0] ?? '').trim();

  const slots = [...section7.matchAll(/^## ([①②③])\s*(.+)$/gm)].map((m) => ({
    mark: m[1],
    name: m[2].trim(),
  }));

  if (!title || scenario.length < 40 || slots.length !== 3) {
    throw new Error(
      `${meta?.path ?? '文件'} 解析失敗：title=${!!title} 情境字數=${scenario.length} 診斷格數=${slots.length}`,
    );
  }

  return { ...meta, title, scenario, section7, section9, slots };
}

export async function loadCard(entry) {
  const raw = await MODULES[entry.path]();
  return parseCard(raw, entry);
}

/* ---------- 練習紀錄 ---------- */

/**
 * 存在 localStorage 而不是 Supabase。
 * 這是純個人的速練紀錄，不需要跨裝置、不需要 RLS，也不值得為它開一張表。
 * 正式演練的成績才進資料庫。
 */
const STORAGE_KEY = 'OSCE_DRILL_RECORDS';

export const GRADES = [
  { id: 'hit', label: '想到了', tone: 'ok' },
  { id: 'close', label: '沾到邊', tone: 'warn' },
  { id: 'miss', label: '沒想到', tone: 'danger' },
];

export function loadRecords() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    // 存壞了就從頭來，不要讓一筆爛資料把整頁弄掛。
    return {};
  }
}

export function recordAttempt(path, grades) {
  const all = loadRecords();
  const row = all[path] ?? { attempts: 0, slots: [{}, {}, {}] };
  row.attempts += 1;
  grades.forEach((grade, index) => {
    if (!grade) return;
    row.slots[index] = row.slots[index] ?? {};
    row.slots[index][grade] = (row.slots[index][grade] ?? 0) + 1;
  });
  all[path] = row;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  return all;
}

export function clearRecords() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 「第三格常漏」排行榜。
 *
 * 只看第三格是刻意的：①②答錯多半是知識不足，多讀就好；
 * **③ 答不出來是思維習慣的問題**——想不到「還有什麼漏掉會出事」，
 * 那是這套題庫真正要練的東西，也是跨題目可以累積的。
 */
export function missedThirdSlot(records) {
  return Object.entries(records)
    .map(([path, row]) => {
      const third = row.slots?.[2] ?? {};
      const missed = (third.miss ?? 0) + (third.close ?? 0) * 0.5;
      return { path, ...labelFromPath(path), attempts: row.attempts ?? 0, missed };
    })
    .filter((entry) => entry.missed > 0)
    .sort((a, b) => b.missed - a.missed);
}
