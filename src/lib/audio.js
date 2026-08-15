/**
 * 錄音與音檔轉檔。
 *
 * 為什麼要轉 MP3：Chrome 的 MediaRecorder 產出的是 webm/opus，
 * 而 Gemini 的音訊支援清單並不包含 webm。官方範例使用 audio/mpeg，
 * 所以送出前一律轉成 16kHz 單聲道 32kbps 的 MP3——
 * 語音辨識用這個規格綽綽有餘，17 分鐘也只有約 4MB。
 *
 * 原始 webm 留在本機供她自己回聽，只有 MP3 那一份會離開這台電腦。
 */

const TARGET_SAMPLE_RATE = 16000;
const MP3_BITRATE_KBPS = 32;

export function isRecordingSupported() {
  return Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

/**
 * 開始錄音。回傳的 stop() 會給出原始 webm Blob。
 *
 * 注意：關鍵詞監聽用的 SpeechRecognition 無法接收既有的 MediaStream，
 * 它會自己再開一支麥克風。兩者同時佔用同一個裝置在 Chrome 上是允許的，
 * 使用者也只需要授權一次。
 */
export async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
    .find((type) => MediaRecorder.isTypeSupported(type)) || '';

  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    audioBitsPerSecond: 48000,
  });

  const chunks = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  };
  // 每 5 秒切一塊，錄到一半瀏覽器當掉時已寫入的部分還救得回來。
  recorder.start(5000);

  return {
    stream,
    stop() {
      return new Promise((resolve) => {
        recorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
        };
        if (recorder.state !== 'inactive') recorder.stop();
        else resolve(new Blob(chunks, { type: mimeType || 'audio/webm' }));
      });
    },
  };
}

/** 取平均而非只取單聲道，避免只有一邊有聲音的裝置被錄成靜音。 */
function toMono(buffer) {
  if (buffer.numberOfChannels === 1) return buffer.getChannelData(0);
  const left = buffer.getChannelData(0);
  const right = buffer.getChannelData(1);
  const mono = new Float32Array(left.length);
  for (let i = 0; i < left.length; i += 1) mono[i] = (left[i] + right[i]) / 2;
  return mono;
}

/** 線性內插降取樣。語音在 16kHz 下的可辨識度沒有損失。 */
function downsample(samples, fromRate, toRate) {
  if (fromRate === toRate) return samples;
  const ratio = fromRate / toRate;
  const outLength = Math.floor(samples.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const frac = position - index;
    const a = samples[index] ?? 0;
    const b = samples[index + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

export async function encodeToMp3(blob, onProgress) {
  // MP3 編碼器只有一場結束時才會用到，而門前貼紙那支手機永遠用不到，
  // 所以延後載入，別讓它拖慢首次開啟。
  const { Mp3Encoder } = await import('@breezystack/lamejs');
  const context = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const mono = downsample(toMono(decoded), decoded.sampleRate, TARGET_SAMPLE_RATE);

    const pcm = new Int16Array(mono.length);
    for (let i = 0; i < mono.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, mono[i]));
      pcm[i] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    }

    const encoder = new Mp3Encoder(1, TARGET_SAMPLE_RATE, MP3_BITRATE_KBPS);
    const blocks = [];
    const frameSize = 1152;

    for (let offset = 0; offset < pcm.length; offset += frameSize) {
      const encoded = encoder.encodeBuffer(pcm.subarray(offset, offset + frameSize));
      if (encoded.length > 0) blocks.push(encoded);
      if (onProgress && offset % (frameSize * 500) === 0) {
        onProgress(offset / pcm.length);
        // 讓出主執行緒，避免長時間編碼把畫面凍住。
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    const tail = encoder.flush();
    if (tail.length > 0) blocks.push(tail);
    onProgress?.(1);

    return {
      blob: new Blob(blocks, { type: 'audio/mpeg' }),
      durationSeconds: decoded.duration,
    };
  } finally {
    context.close();
  }
}
