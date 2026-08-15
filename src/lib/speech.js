/**
 * 語音關鍵詞監聽：自練時用來解鎖提示卡。
 *
 * 這裡刻意不追求逐字稿品質——逐字稿由 Gemini 事後從錄音產出。
 * 這支只需要判斷「她有沒有說出跟某張提示卡對應的檢查名稱」，
 * 是關鍵詞比對而非轉錄，所以中文醫療術語辨識不準的老問題影響有限。
 *
 * 已知限制：Chrome 的 SpeechRecognition 在一段靜默後會自己結束，
 * 而且它會自行開啟麥克風，無法接收既有的 MediaStream。
 * 因此這裡做兩件事：偵測到 end 就自動重啟；並接受它與 MediaRecorder 同時佔用麥克風。
 */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

export function isSpeechSupported() {
  return Boolean(SpeechRecognition);
}

/** 全形空白與標點會讓比對失準，先正規化。 */
function normalise(text) {
  return text.replace(/[\s、，。,.!！?？「」（）()]/g, '').toLowerCase();
}

/**
 * @param {Array<{id:string, keywords:string[]}>} watchList
 * @param {(id:string, heard:string) => void} onMatch 同一個 id 只會回呼一次
 */
export function createKeywordListener(watchList, onMatch, onStatus) {
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = 'zh-TW';
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 3;

  const matched = new Set();
  let stopped = false;
  let restartTimer = null;

  const targets = watchList.map((item) => ({
    id: item.id,
    keywords: item.keywords.map(normalise).filter(Boolean),
  }));

  function inspect(text) {
    const haystack = normalise(text);
    if (!haystack) return;
    for (const target of targets) {
      if (matched.has(target.id)) continue;
      const hit = target.keywords.find((keyword) => haystack.includes(keyword));
      if (hit) {
        matched.add(target.id);
        onMatch(target.id, text);
      }
    }
  }

  recognition.onresult = (event) => {
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      // 逐一檢查所有候選結果：中文辨識常把正確詞排在第二順位。
      for (let alt = 0; alt < result.length; alt += 1) {
        inspect(result[alt].transcript);
      }
    }
  };

  recognition.onerror = (event) => {
    // no-speech 與 aborted 是常態，不必驚動使用者。
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      onStatus?.({ state: 'error', error: event.error });
    }
  };

  recognition.onend = () => {
    if (stopped) return;
    onStatus?.({ state: 'restarting' });
    restartTimer = setTimeout(() => {
      try {
        recognition.start();
        onStatus?.({ state: 'listening' });
      } catch {
        // 重啟太快會被擋，下一次 onend 會再試。
      }
    }, 300);
  };

  return {
    start() {
      stopped = false;
      try {
        recognition.start();
        onStatus?.({ state: 'listening' });
      } catch {
        onStatus?.({ state: 'error', error: 'start-failed' });
      }
    },
    stop() {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      try {
        recognition.stop();
      } catch {
        // 已經停了就算了。
      }
      onStatus?.({ state: 'stopped' });
    },
    /** 手動解鎖後要通知監聽器別再為這張卡觸發。 */
    markHandled(id) {
      matched.add(id);
    },
  };
}
