import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Check, CircleSlash } from 'lucide-react';
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

/**
 * 三級評分。OSCE 的檢核表本來就是「做到／部分做到／沒做到」，
 * 讓委員在 15 分鐘內心算 0 到 7 之間該給幾分既不現實也不一致。
 * 部分做到取一半並四捨五入：滿分 7 分時為 4 分。
 */
const LEVELS = [
  { id: 'full', label: '完全做到', ratio: 1, tone: 'is-full' },
  { id: 'partial', label: '部分做到', ratio: 0.5, tone: 'is-partial' },
  { id: 'none', label: '未做到', ratio: 0, tone: 'is-none' },
];

function pointsFor(level, maxPoints) {
  if (maxPoints === null || maxPoints === undefined) return null;
  const ratio = LEVELS.find((l) => l.id === level)?.ratio ?? 0;
  return Math.round(maxPoints * ratio);
}

export default function CoachView({ joinCode }) {
  const [state, setState] = useState(null);
  const [connected, setConnected] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const [examinerLabel, setExaminerLabel] = useState('委員 A');
  const [marks, setMarks] = useState({});
  const [sentAt, setSentAt] = useState(null);
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

  const revealed = useMemo(() => new Set(state?.revealedCueIds ?? []), [state?.revealedCueIds]);
  const rubricItems = useMemo(() => state?.rubricItems ?? [], [state?.rubricItems]);

  /**
   * 依評分表分類分組，順序就是考試進行的順序。
   * 每組另外標出佔總配分的比例換算成的參考時間，讓委員抓得到節奏。
   */
  const groups = useMemo(() => {
    const byCategory = new Map();
    rubricItems.forEach((item) => {
      const key = item.category || '未分類';
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(item);
    });

    const totalPoints = rubricItems.reduce((sum, i) => sum + (i.maxPoints ?? 0), 0);
    const examMinutes = (state?.examSeconds ?? 900) / 60;

    return [...byCategory.entries()].map(([category, items]) => {
      const groupPoints = items.reduce((sum, i) => sum + (i.maxPoints ?? 0), 0);
      return {
        category,
        items,
        groupPoints,
        suggestedMinutes: totalPoints > 0
          ? Math.round((groupPoints / totalPoints) * examMinutes * 10) / 10
          : null,
      };
    });
  }, [rubricItems, state?.examSeconds]);

  const scorable = rubricItems.filter((i) => i.maxPoints !== null && i.maxPoints !== undefined);
  const unscorable = rubricItems.length - scorable.length;
  const markedCount = Object.keys(marks).length;

  const total = useMemo(
    () =>
      rubricItems.reduce((sum, item) => {
        const level = marks[item.id];
        if (!level) return sum;
        return sum + (pointsFor(level, item.maxPoints) ?? 0);
      }, 0),
    [marks, rubricItems],
  );

  function mark(itemId, level) {
    setMarks((prev) => (prev[itemId] === level
      ? Object.fromEntries(Object.entries(prev).filter(([k]) => k !== itemId))
      : { ...prev, [itemId]: level }));
  }

  function pushCue(cueId) {
    send(channelRef.current, EVENTS.CUE_PUSH, { cueId, examinerLabel });
  }

  function submitScores() {
    const items = Object.fromEntries(
      rubricItems
        .filter((item) => marks[item.id])
        .map((item) => [
          item.id,
          {
            level: marks[item.id],
            points: pointsFor(marks[item.id], item.maxPoints),
            title: item.title,
            category: item.category,
            maxPoints: item.maxPoints ?? null,
          },
        ]),
    );

    send(channelRef.current, EVENTS.SCORE, {
      examinerLabel,
      items,
      total,
      markedCount,
      itemCount: rubricItems.length,
    });
    setSentAt(Date.now());
  }

  const phase = state?.phase ?? PHASES.IDLE;
  const ended = phase === PHASES.ENDED;

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
            <span
              className={`timer ${remaining <= (state?.alertSeconds ?? 120) && phase === PHASES.EXAM ? 'timer-alert' : ''}`}
              style={{ fontSize: '2.6rem' }}
            >
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
                    {done ? <Check size={18} color="var(--ok)" /> : <Send size={16} />}
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
          <div className="card score-card">
            <div className="card-title">
              <h3>評分</h3>
              <span className="hint">已評 {markedCount} / {rubricItems.length} 項</span>
            </div>

            {unscorable > 0 && (
              <div className="notice notice-warn" style={{ marginBottom: '1rem' }}>
                有 {unscorable} 個項目沒有配分，仍可記錄等第，但不會計入總分。
                配分可在考生端的題庫編輯器補上——衛福部公告並未規定細項配分。
              </div>
            )}

            {groups.map((group) => (
              <section className="score-group" key={group.category}>
                <header className="score-group-head">
                  <h4>{group.category}</h4>
                  <span className="faint">
                    {group.groupPoints > 0 ? `${group.groupPoints} 分` : '未設配分'}
                    {group.suggestedMinutes ? `　·　參考配時 ${group.suggestedMinutes} 分鐘` : ''}
                  </span>
                </header>

                {group.items.map((item) => (
                  <div className="score-item" key={item.id}>
                    <div className="score-item-title">
                      {item.title}
                      {item.critical && <span className="pill pill-danger">關鍵</span>}
                    </div>
                    <div className="score-levels">
                      {LEVELS.map((level) => {
                        const active = marks[item.id] === level.id;
                        const points = pointsFor(level.id, item.maxPoints);
                        return (
                          <button
                            key={level.id}
                            type="button"
                            className={`score-level ${active ? `is-active ${level.tone}` : ''}`}
                            onClick={() => mark(item.id, level.id)}
                          >
                            {level.label}
                            {points !== null && <small>{points}</small>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </section>
            ))}

            <div className="score-footer">
              <div>
                <strong style={{ fontSize: '1.35rem' }}>{total} 分</strong>
                <div className="faint">
                  {markedCount < rubricItems.length
                    ? `還有 ${rubricItems.length - markedCount} 項未評`
                    : '全部項目都已評分'}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={markedCount === 0}
                onClick={submitScores}
              >
                {sentAt ? '重新送出' : '送出評分'}
              </button>
            </div>

            {sentAt && (
              <p className="faint" style={{ marginTop: '0.6rem' }}>
                已送出。改動後可以再送一次，考生端會以最後一次為準。
              </p>
            )}

            {ended && (
              <div className="notice" style={{ marginTop: '0.75rem' }}>
                鈴響之後仍然可以評分與送出——只要考生端還停在報告畫面就收得到。
              </div>
            )}
          </div>
        )}

        {rubricItems.length === 0 && state && (
          <div className="card">
            <div className="card-title">
              <CircleSlash size={18} color="var(--warn)" />
              <h3>這一題沒有評分表</h3>
            </div>
            <p className="muted">
              匯入的教學案例多半不附評分表。可以在考生端的題庫編輯器裡套用公告四大分類骨架，
              或由該題內容產生草稿，之後這裡就會出現評分介面。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
