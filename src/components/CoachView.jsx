import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Check } from 'lucide-react';
import { EVENTS, joinChannel, send } from '../lib/realtime';
import { PHASES, PHASE_LABEL } from '../lib/constants';
import { mmss } from '../lib/format';
import ThemeToggle from './ThemeToggle';

/**
 * 陪練考官端。
 *
 * 職責對應真實考場的考官行為：在聽到考生做到某項身體檢查時，出示對應的提示卡。
 * 這一端不登入、不碰資料庫——推卡與評分都透過 Realtime 送回考生端，
 * 由考生端（唯一已登入的角色）負責寫入資料庫。
 */
export default function CoachView({ joinCode }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [examinerLabel, setExaminerLabel] = useState('委員 A');
  const [scores, setScores] = useState({});
  const [scoreSent, setScoreSent] = useState(false);
  const channelRef = useRef(null);

  useEffect(() => {
    const channel = joinChannel(joinCode, {
      [EVENTS.STATE]: (payload) => {
        setState(payload);
        setRemaining(payload.remaining ?? 0);
      },
    });

    channelRef.current = channel;
    channel.subscribe((status) => {
      const online = status === 'SUBSCRIBED';
      setConnected(online);
      if (online) send(channel, EVENTS.HELLO, { from: 'coach' });
    });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [joinCode]);

  useEffect(() => {
    if (!state?.running) return undefined;
    const id = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(id);
  }, [state?.running, state?.phase, state?.syncedAt]);

  const revealed = useMemo(
    () => new Set((state?.revealedCueIds ?? [])),
    [state?.revealedCueIds],
  );

  const rubricItems = state?.rubricItems ?? [];
  const total = useMemo(
    () => Object.values(scores).reduce((sum, value) => sum + (Number(value) || 0), 0),
    [scores],
  );

  function pushCue(cueId) {
    send(channelRef.current, EVENTS.CUE_PUSH, { cueId, examinerLabel });
  }

  function submitScores() {
    send(channelRef.current, EVENTS.SCORE, {
      examinerLabel,
      items: scores,
      total,
    });
    setScoreSent(true);
    setTimeout(() => setScoreSent(false), 2500);
  }

  const phase = state?.phase ?? PHASES.IDLE;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-brand">
          考官端
          <small>{connected ? `已連線 #${joinCode}` : '連線中…'}</small>
        </div>
        <div className="topbar-spacer" />
        <ThemeToggle />
        <select
          className="select"
          style={{ width: 'auto' }}
          value={examinerLabel}
          onChange={(event) => setExaminerLabel(event.target.value)}
        >
          <option>委員 A</option>
          <option>委員 B</option>
        </select>
      </header>

      <div className="page page-narrow">
        <div className="card">
          <div className="row" style={{ alignItems: 'baseline', gap: '1rem' }}>
            <span className={`timer ${remaining <= (state?.alertSeconds ?? 120) && phase === PHASES.EXAM ? 'timer-alert' : ''}`} style={{ fontSize: '2.6rem' }}>
              {mmss(remaining)}
            </span>
            <span className="timer-phase">{PHASE_LABEL[phase]}</span>
          </div>
          <p className="muted" style={{ marginTop: '0.5rem' }}>
            {state?.stationTitle || '等待考生端選題並開始'}
          </p>
        </div>

        <div className="card">
          <div className="card-title">
            <h3>提示卡</h3>
            <span className="hint">聽到她做到對應的身體檢查時，點一下推給她</span>
          </div>

          {(state?.cueCards ?? []).length === 0 ? (
            <p className="muted">本題沒有設定提示卡。</p>
          ) : (
            <div className="cue-list">
              {state.cueCards.map((cue) => {
                const done = revealed.has(cue.id);
                return (
                  <button
                    key={cue.id}
                    type="button"
                    className="cue-item"
                    disabled={done || phase !== PHASES.EXAM}
                    onClick={() => pushCue(cue.id)}
                  >
                    <div className="cue-item-main">
                      <strong>{cue.label || cue.title}</strong>
                      <span>{cue.peItem ? `對應：${cue.peItem}` : cue.category || ''}</span>
                    </div>
                    {done ? <Check size={18} color="#34d399" /> : <Send size={16} />}
                  </button>
                );
              })}
            </div>
          )}

          {phase !== PHASES.EXAM && (
            <p className="faint" style={{ marginTop: '0.75rem' }}>
              考間口試開始後才能推送提示卡。
            </p>
          )}
        </div>

        {rubricItems.length > 0 && (
          <div className="card">
            <div className="card-title">
              <h3>評分</h3>
              <span className="hint">配分照題目所附的評分表，公告並未規定細項配分</span>
            </div>

            {rubricItems.map((item) => (
              <label className="field" key={item.id}>
                <span>
                  {item.category}｜{item.title}
                  {item.maxPoints ? `（滿分 ${item.maxPoints}）` : ''}
                </span>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max={item.maxPoints ?? undefined}
                  step="0.5"
                  value={scores[item.id] ?? ''}
                  onChange={(event) =>
                    setScores((prev) => ({ ...prev, [item.id]: event.target.value }))
                  }
                />
              </label>
            ))}

            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '1.1rem' }}>本委員總分：{total}</strong>
              <button type="button" className="btn btn-primary" onClick={submitScores}>
                {scoreSent ? '已送出' : '送出評分'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
