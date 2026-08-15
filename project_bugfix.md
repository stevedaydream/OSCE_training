# 踩坑紀錄

## Gemini 不吃 webm，但 Chrome 只產 webm

**症狀**：把 `MediaRecorder` 錄出來的檔案直接丟給 Gemini，音訊無法辨識。

**原因**：Chrome 的 `MediaRecorder` 預設輸出 `audio/webm;codecs=opus`，
而 Gemini 音訊支援清單是 wav / mp3 / aiff / aac / ogg / flac，**沒有 webm**。
官方範例一律使用 `audio/mpeg`。

**解法**：瀏覽器端轉檔。`decodeAudioData` → 取單聲道 → 降取樣到 16kHz →
`lamejs` 編成 32kbps MP3。17 分鐘約 4MB，語音辨識綽綽有餘。
原始 webm 留在 IndexedDB 供本人回聽。

**順帶**：`lamejs` 只有一場結束時才用得到，而門前貼紙那支手機永遠用不到，
所以改成 `await import()` 動態載入，主 bundle 從 198KB gzip 降到 141KB。

---

## Gemini 模型與 API 版本的現況

- `gemini-1.5-flash`（前一版程式用的）**早已下架**。
- 現行最新 GA Flash 是 `gemini-3.7-flash`。
- `generateContent` 已被官方標為 legacy，但文件明載「仍完全支援」，
  且 REST 形狀比新的 Interactions API 穩定，故繼續採用。
- 音檔走 Files API 可續傳上傳而非 inline base64——inline 的整包請求上限是 20MB。
- Files API 上傳後可能是 `PROCESSING`，必須輪詢到 `ACTIVE` 才能引用。

---

## Supabase 免費層限 2 個活躍專案

**症狀**：`create_project` 回 `BadRequestException`，訊息提到 `2 project limit`。

**原因**：免費層是**每位管理者**最多 2 個活躍專案，不是每個組織。

**解法**：暫停一個既有專案（資料不會不見，可隨時恢復），或寄生在既有專案的獨立 schema。
本專案是暫停了 `local-food-collection` 讓出名額。

**附帶**：免費專案閒置一週會自動暫停。考完試擱置一陣子後要手動喚醒。

---

## trigger 函式會被曝露成 RPC 端點

**症狀**：建完 `SECURITY DEFINER` 的 `updated_at` trigger 函式後，
Supabase security advisor 立刻報兩個 WARN。

**原因**：`public` schema 的函式預設對 `anon` 與 `authenticated` 開放 `EXECUTE`，
於是 `/rest/v1/rpc/touch_updated_at` 變成任何人可呼叫的端點。

**解法**：
```sql
revoke execute on function public.touch_updated_at() from anon, authenticated, public;
```

---

## Web Speech API 會自己斷線，而且搶不到既有的 MediaStream

- 一段靜默後 `SpeechRecognition` 會自行觸發 `onend`。必須在 `onend` 裡自動重啟
  （延遲 300ms，太快會被擋）。
- 它**無法接收既有的 `MediaStream`**，會自己再開一支麥克風。
  在 Chrome 上與 `MediaRecorder` 同時佔用同一裝置是允許的，使用者也只需授權一次。
- 中文辨識常把正確詞排在第二順位，所以要遍歷 `result[alt]` 的所有候選，不能只看 `[0]`。

---

## 行動瀏覽器的 AudioContext 預設是 suspended

門前貼紙那支手機如果沒有先經過一次使用者手勢，進場鈴不會響。
因此 DoorView 放了一顆「啟用鈴聲」按鈕，在點擊事件裡呼叫 `primeAudio()`。
考生端則在「建立這一場」的點擊裡順手 prime。

---

## 「無條件捨去」不能用 toFixed

公告一、(六) 要求計算至小數第 2 位、第 3 位**無條件捨去**。
`toFixed(2)` 是四捨五入，會把 59.996 變成 `"60.00"`，讓不及格的人及格。
必須 `Math.floor(mean * 100) / 100`，並加上 `1e-9` 抵銷浮點誤差
（否則 70 可能被算成 69.99）。
