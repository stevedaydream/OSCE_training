/**
 * 鈴聲與廣播。
 * 公告一、(四)：口試開始及結束各響鈴 1 次，於口試結束前 2 分鐘廣播提醒。
 *
 * 用 Web Audio 合成而不放音檔，是為了讓手機端掃 QR 進來就能響，
 * 不必先下載資產、也不會因為快取失敗而在演練當下沒聲音。
 */

let context = null;

function ctx() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)();
  }
  // 行動瀏覽器會把 AudioContext 停在 suspended，必須由使用者手勢喚醒。
  if (context.state === 'suspended') context.resume();
  return context;
}

/** 提前喚醒音訊，必須在使用者點擊事件中呼叫，否則行動瀏覽器不給發聲。 */
export function primeAudio() {
  try {
    ctx();
  } catch {
    // 沒有音訊裝置也不該讓演練開不了。
  }
}

function tone(frequency, startOffset, duration) {
  const audio = ctx();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const startAt = audio.currentTime + startOffset;

  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;

  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(0.35, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.05);
}

/** 開始鈴與結束鈴：兩聲清脆的鈴響。 */
export function ring() {
  try {
    tone(880, 0, 0.7);
    tone(1320, 0.18, 0.7);
  } catch {
    // 無聲不影響計時。
  }
}

/** 結束前 2 分鐘的廣播提醒：先一段低沉提示音，再語音播報。 */
export function broadcastAlert(message = '距離口試結束剩餘 2 分鐘') {
  try {
    tone(440, 0, 0.5);
    tone(440, 0.6, 0.5);
  } catch {
    // 略過
  }

  try {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = 'zh-TW';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  } catch {
    // 沒有語音合成就只剩提示音，Banner 仍會顯示。
  }
}
