import { useEffect, useRef, useState } from 'react';
import { Volume2, WifiOff } from 'lucide-react';
import DoorSheet from './DoorSheet';
import { EVENTS, joinChannel, send } from '../lib/realtime';
import { PHASES } from '../lib/constants';
import { mmss } from '../lib/format';
import { primeAudio, ring } from '../lib/sound';

/**
 * 手機門前貼紙端。
 *
 * 這一端不登入、不碰資料庫，只加入 Realtime 頻道接收考生端廣播的狀態。
 * 演練時它被放在房間門外，扮演考場檢查室門上那張 A4 紙。
 */
export default function DoorView({ joinCode }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [soundReady, setSoundReady] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const previousPhase = useRef(null);

  useEffect(() => {
    const channel = joinChannel(joinCode, {
      [EVENTS.STATE]: (payload) => {
        setState(payload);
        setRemaining(payload.remaining ?? 0);
      },
    });

    channel.subscribe((status) => {
      const online = status === 'SUBSCRIBED';
      setConnected(online);
      // 中途才掃進來的話，主控不會知道要重送，主動要一份現況。
      if (online) send(channel, EVENTS.HELLO, { from: 'door' });
    });

    return () => channel.unsubscribe();
  }, [joinCode]);

  // 主控每幾秒才校時一次，中間由本地自行倒數，畫面才會是連續的。
  useEffect(() => {
    if (!state?.running) return undefined;
    const id = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [state?.running, state?.phase, state?.syncedAt]);

  // 口試開始鈴響在門口——她正站在這支手機前面。
  useEffect(() => {
    const phase = state?.phase;
    if (previousPhase.current === PHASES.READING && phase === PHASES.EXAM) {
      ring();
    }
    previousPhase.current = phase;
  }, [state?.phase]);

  const phase = state?.phase ?? PHASES.IDLE;
  const isReading = phase === PHASES.READING;

  return (
    <div className="door">
      <div
        style={{
          width: '100%',
          maxWidth: 760,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0.5rem 0 0.75rem',
          gap: '0.5rem',
        }}
      >
        <span className="pill" style={{ background: '#fff', color: '#0f172a' }}>
          {connected ? `已連線 #${joinCode}` : '連線中…'}
        </span>

        {!soundReady && (
          <button
            type="button"
            className="btn"
            style={{ background: '#0f172a', color: '#fff', borderColor: '#0f172a' }}
            onClick={() => {
              primeAudio();
              setSoundReady(true);
            }}
          >
            <Volume2 size={16} />
            啟用鈴聲
          </button>
        )}
      </div>

      {!connected && (
        <div className="door-sheet" style={{ textAlign: 'center' }}>
          <WifiOff size={28} style={{ marginBottom: '0.75rem' }} />
          <p>正在連上考生端。若一直停在這裡，請確認兩台裝置都有網路，並重新掃描 QR Code。</p>
        </div>
      )}

      {connected && phase === PHASES.IDLE && (
        <div className="door-sheet" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.1rem' }}>已就位，等待考生端開始這一場。</p>
          <p className="faint" style={{ color: '#64748b', marginTop: '0.75rem' }}>
            把這支手機放在房間門外。開始後這裡會顯示門前試題貼紙與 2 分鐘倒數。
          </p>
          {!soundReady && (
            <p style={{ color: '#b45309', marginTop: '0.75rem', fontSize: '0.9rem' }}>
              建議先按右上角「啟用鈴聲」，否則手機端的進場鈴不會響。
            </p>
          )}
        </div>
      )}

      {connected && isReading && (
        <>
          <div style={{ textAlign: 'center' }}>
            <div className="door-timer">{mmss(remaining)}</div>
            <p style={{ fontWeight: 700, letterSpacing: '0.1em', marginBottom: '1rem' }}>
              門前閱讀時間
            </p>
          </div>
          <DoorSheet title={state.stationTitle} doorSheet={state.doorSheet} />
          <p
            style={{
              maxWidth: 760,
              marginTop: '1rem',
              fontSize: '0.85rem',
              color: '#475569',
              textAlign: 'center',
            }}
          >
            倒數結束、鈴響後自行進入考場開始應考。
          </p>
        </>
      )}

      {connected && phase === PHASES.EXAM && (
        <div className="door-sheet" style={{ textAlign: 'center' }}>
          <div className={`door-timer ${remaining <= (state.alertSeconds ?? 120) ? 'is-alert' : ''}`}>
            {mmss(remaining)}
          </div>
          <p style={{ fontWeight: 700, letterSpacing: '0.1em' }}>考間口試進行中</p>
          {remaining <= (state.alertSeconds ?? 120) && (
            <p style={{ color: '#dc2626', fontWeight: 700, marginTop: '0.5rem' }}>
              距離口試結束剩餘 2 分鐘
            </p>
          )}
        </div>
      )}

      {connected && phase === PHASES.ENDED && (
        <div className="door-sheet" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>本場結束</p>
          <p className="faint" style={{ color: '#64748b', marginTop: '0.5rem' }}>
            分析結果會出現在考生端。
          </p>
        </div>
      )}
    </div>
  );
}
