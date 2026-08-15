# 專科護理師甄審口試實戰演練

給一位外科專科護理師在甄審口試前累積實戰次數的工具。
完整設計說明見 [`project.md`](./project.md)，踩過的坑見 [`project_bugfix.md`](./project_bugfix.md)。

## 開始使用前必須做的兩件事

### 1. 設定 Gemini API Key（沒有這個就沒有逐字稿與 OCR）

到 Supabase 專案 → **Edge Functions → Secrets**，新增：

| Name | Value |
| :--- | :--- |
| `GEMINI_API_KEY` | 你的 Google AI Studio 金鑰 |

可選：`GEMINI_MODEL`（預設 `gemini-3.7-flash`）。

金鑰只存在這裡，不會出現在前端。

### 2. 設定 Google 登入

登入畫面主推 Google，因為 Supabase 內建寄信有頻率限制（免費層約每小時數封）
且容易進垃圾信匣。Email 連結仍保留為後備，不設定 Google 也能用。

**在 Google Cloud Console**（[建立 OAuth 用戶端](https://console.cloud.google.com/auth/clients/create)）：

1. 應用程式類型選 **Web application**
2. **Authorized JavaScript origins** 加入應用網址
   - `http://localhost:5174`（開發用，上線後移除）
   - Vercel 的正式網域
3. **Authorized redirect URIs** 加入 Supabase 的 callback：
   ```
   https://rideujvpbyatlggmeubr.supabase.co/auth/v1/callback
   ```
4. 建立後複製 **Client ID** 與 **Client Secret**

**在 Supabase Dashboard**：

1. Authentication → Providers → **Google** → 啟用，貼上 Client ID 與 Secret
2. Authentication → URL Configuration → **Site URL** 與 **Redirect URLs**
   加入 `http://localhost:5174` 與 Vercel 網域

設定完成前按 Google 登入會回報 provider 未啟用，屬正常。

## 本機開發

```bash
npm install
cp .env.example .env.local   # 填入 Supabase URL 與 publishable key
npm run dev
```

`.env.local` 裡的兩個值是可公開的前端金鑰，真正的機密都在 Supabase secrets。

## 三個進入點

| 網址 | 誰用 | 需要登入 |
| :--- | :--- | :--- |
| `/` | 考生（主控：計時、錄音、報告、題庫） | 是 |
| `/?join=<房間碼>&as=door` | 放在房門外的手機（門前試題貼紙） | 否 |
| `/?join=<房間碼>&as=coach` | 陪練同仁（推提示卡、評分） | 否 |

後兩個網址由考生端的 QR Code 產生，不必手打。

## 部署

前端在 Vercel。部署前把 `VITE_SUPABASE_URL` 與 `VITE_SUPABASE_PUBLISHABLE_KEY`
加進 Vercel 的環境變數。

麥克風需要 HTTPS，`localhost` 與 Vercel 網域都符合。
