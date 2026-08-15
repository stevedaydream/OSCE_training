/**
 * 錄音檔的本機倉庫。
 *
 * 決策依據：音檔本體不上雲。雲端只保存逐字稿與檢核結果——都是文字，
 * 500MB 的免費資料庫永遠用不完；而 180 場錄音會直接頂爆 1GB 的儲存額度。
 * 送去 Gemini 分析的那一份由 Google 端在 48 小時內自動刪除。
 */

const DB_NAME = 'osce-recordings';
const STORE = 'clips';
const DB_VERSION = 1;

/** 只留最近這麼多場的音檔，其餘自動清掉，避免瀏覽器儲存配額被吃光。 */
export const KEEP_RECENT_CLIPS = 20;

function open() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'sessionId' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run(mode, work) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const result = work(tx.objectStore(STORE));
        tx.oncomplete = () => {
          db.close();
          resolve(result?.result ?? result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      }),
  );
}

export async function saveClip(sessionId, blob) {
  await run('readwrite', (store) =>
    store.put({ sessionId, blob, savedAt: Date.now() }),
  );
  await pruneOldClips();
}

export async function getClip(sessionId) {
  const record = await run('readonly', (store) => store.get(sessionId));
  return record?.blob ?? null;
}

export async function listClips() {
  const records = await run('readonly', (store) => store.getAll());
  return (records ?? [])
    .map(({ sessionId, savedAt, blob }) => ({ sessionId, savedAt, size: blob.size }))
    .sort((a, b) => b.savedAt - a.savedAt);
}

export async function deleteClip(sessionId) {
  await run('readwrite', (store) => store.delete(sessionId));
}

async function pruneOldClips() {
  const clips = await listClips();
  const stale = clips.slice(KEEP_RECENT_CLIPS);
  for (const clip of stale) {
    await run('readwrite', (store) => store.delete(clip.sessionId));
  }
}
