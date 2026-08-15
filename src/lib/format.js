/** 顯示用的時間格式：m:ss */
export function mmss(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** 口語化的時長，用於報告 */
export function humanDuration(totalSeconds) {
  const safe = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  if (!minutes) return `${seconds} 秒`;
  return `${minutes} 分 ${String(seconds).padStart(2, '0')} 秒`;
}

/**
 * 公告一、(六)：以 2 位口試委員之評分總和之平均數為實得成績，
 * 計算至小數第 2 位，第 3 位無條件捨去。
 *
 * 「無條件捨去」必須用 floor 而非 toFixed——toFixed 會四捨五入，
 * 59.996 會變成 60.00 而讓不及格的人及格。
 */
export function officialAverage(scores) {
  const valid = scores.filter((s) => typeof s === 'number' && !Number.isNaN(s));
  if (valid.length === 0) return null;
  const mean = valid.reduce((sum, s) => sum + s, 0) / valid.length;
  // 先放大再 floor，避免浮點誤差把 70.00 算成 69.99。
  return Math.floor(mean * 100 + 1e-9) / 100;
}

export function formatScore(value) {
  return value === null || value === undefined ? '—' : value.toFixed(2);
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-TW', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
