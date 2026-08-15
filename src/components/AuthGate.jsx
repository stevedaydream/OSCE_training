import { useState } from 'react';
import { Mail, Stethoscope } from 'lucide-react';
import { supabase } from '../lib/supabase';

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.3z" />
      <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.3l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.2 15.5 46 24 46z" />
      <path fill="#FBBC05" d="M11.8 28.3c-.4-1.3-.7-2.7-.7-4.3s.3-3 .7-4.3v-5.7H4.5C2.9 17.1 2 20.4 2 24s.9 6.9 2.5 10l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.7c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.8 4.5 14l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
    </svg>
  );
}

/**
 * 只有考生本人需要登入。陪練同仁掃 QR 進來是匿名的，
 * 只能對「那一場」推提示卡與送評分，看不到題庫也看不到歷史紀錄。
 *
 * Google 登入放在主位：Supabase 內建的寄信服務有頻率限制且容易進垃圾信匣，
 * 而使用者的帳號本來就是 Gmail，走 Google 可以完全繞開收信這一關。
 * Email 連結留著當後備，也讓沒設定 OAuth 的環境仍然進得來。
 */
export default function AuthGate() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const [showEmail, setShowEmail] = useState(false);

  async function signInWithGoogle() {
    setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (authError) setError(authError.message);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('sending');
    setError('');

    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });

    if (authError) {
      setError(authError.message);
      setStatus('idle');
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="page page-narrow" style={{ paddingTop: '5rem' }}>
      <div className="card">
        <div className="card-title">
          <Stethoscope size={20} color="#38bdf8" />
          <h2>專科護理師甄審口試演練</h2>
        </div>

        {status === 'sent' ? (
          <>
            <p className="muted">
              登入連結已寄到 <strong>{email}</strong>。點開信裡的連結就會直接登入，
              之後這台裝置會保持登入狀態，不用每次都收信。
            </p>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ marginTop: '1rem' }}
              onClick={() => setStatus('idle')}
            >
              換一個方式
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-lg btn-block"
              /* 白底是 Google 按鈕的規範樣式，但淺色主題下卡片也是白的，
                 必須給它 Google 官方的灰邊，否則整顆按鈕會消失在背景裡。 */
              style={{ background: '#fff', color: '#1f2937', borderColor: '#dadce0' }}
              onClick={signInWithGoogle}
            >
              <GoogleMark />
              使用 Google 登入
            </button>

            {!showEmail ? (
              <button
                type="button"
                className="btn btn-ghost btn-block"
                style={{ marginTop: '0.6rem' }}
                onClick={() => setShowEmail(true)}
              >
                改用 Email 連結登入
              </button>
            ) : (
              <form onSubmit={handleSubmit} style={{ marginTop: '1.25rem' }}>
                <label className="field">
                  <span>Email</span>
                  <input
                    className="input"
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </label>

                <button
                  type="submit"
                  className="btn btn-primary btn-block"
                  disabled={status === 'sending'}
                >
                  <Mail size={17} />
                  {status === 'sending' ? '寄送中…' : '寄送登入連結'}
                </button>
                <p className="faint" style={{ marginTop: '0.5rem' }}>
                  內建寄信服務有頻率限制，也可能進垃圾信匣。
                </p>
              </form>
            )}

            {error && (
              <div className="notice notice-danger" style={{ marginTop: '1rem' }}>{error}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
