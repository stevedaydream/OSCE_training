import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, TrendingDown, Archive } from 'lucide-react';
import { supabase, callFunction } from '../lib/supabase';
import { CORE_CHECKLIST } from '../lib/constants';
import { formatDate, formatScore, humanDuration } from '../lib/format';

const STATUS_LABEL = {
  waiting: '未開始',
  reading: '中斷於門前閱讀',
  exam: '中斷於考間',
  ended: '已結束，無逐字稿',
  analyzed: '已分析',
  failed: '分析失敗',
};
import { encodeToMp3 } from '../lib/audio';
import { getClip } from '../lib/idb';
import SessionReport from './SessionReport';

const CORE_LABEL = Object.fromEntries(CORE_CHECKLIST.map((c) => [c.key, c]));

export default function SessionsTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [retrying, setRetrying] = useState(null);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('sessions')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(100);
    if (loadError) setError(loadError.message);
    setSessions(data ?? []);
    setLoading(false);
  }

  /**
   * 封存一場演練。軟刪除，不是真的刪掉。
   *
   * 用軟刪除的理由：這一場可能有陪練委員送的分數，硬刪就永遠拿不回來。
   * 封存的語意是「這場不算數」——列表不顯示，也不計入下方的「反覆漏掉」排行榜
   * （因為 leaderboard 是從 sessions 這個 state 算的，而它已經被 archived 濾掉了）。
   */
  async function archive(session) {
    const { error: archiveError } = await supabase
      .from('sessions')
      .update({ archived: true })
      .eq('id', session.id);
    if (archiveError) {
      setError(archiveError.message);
      return;
    }
    load();
  }

  useEffect(() => {
    load();
  }, []);

  /**
   * 「反覆漏掉」排行榜。
   * 只累積通用骨架那一層——題內專屬項目每題名稱不同，跨題累積沒有意義。
   */
  const leaderboard = useMemo(() => {
    const tally = new Map();
    const analysed = sessions.filter((s) => s.analysis?.coreChecks?.length);

    analysed.forEach((session) => {
      session.analysis.coreChecks.forEach((check) => {
        const entry = tally.get(check.key) ?? { key: check.key, missed: 0, seen: 0 };
        entry.seen += 1;
        if (!check.met) entry.missed += 1;
        tally.set(check.key, entry);
      });
    });

    return {
      sessionCount: analysed.length,
      rows: [...tally.values()]
        .filter((row) => row.missed > 0)
        .sort((a, b) => b.missed - a.missed || b.seen - a.seen)
        .slice(0, 8),
    };
  }, [sessions]);

  async function retryAnalysis(session) {
    setRetrying(session.id);
    setError('');
    try {
      const blob = await getClip(session.id);
      if (!blob) throw new Error('這一場的錄音已經不在這台電腦上了（只保留最近 20 場）。');

      const { blob: mp3 } = await encodeToMp3(blob);
      const stationChecklist = (session.station_snapshot?.rubric_items ?? [])
        .filter((item) =>
          session.mode === 'segment' ? item.category === session.segment_category : true,
        )
        .map((item, index) => ({
          key: item.id || `r_${index}`,
          label: `${item.category ?? ''}｜${item.title ?? ''}`.replace(/^｜/, ''),
        }));

      const formData = new FormData();
      formData.append('audio', mp3, 'session.mp3');
      formData.append(
        'meta',
        JSON.stringify({
          stationTitle: session.station_snapshot?.title,
          department: session.station_snapshot?.department,
          mode: session.mode,
          segmentCategory: session.segment_category,
          durationSeconds: session.duration_seconds ?? 0,
          coreChecklist: CORE_CHECKLIST,
          stationChecklist,
          cueReveals: session.cue_reveals ?? [],
        }),
      );

      const result = await callFunction('analyze-session', { formData });

      await supabase
        .from('sessions')
        .update({
          status: 'analyzed',
          transcript: result.transcript ?? '',
          analysis: result,
        })
        .eq('id', session.id);

      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setRetrying(null);
    }
  }

  if (selected) {
    return <SessionReport session={selected} onBack={() => setSelected(null)} />;
  }

  if (loading) return <div className="page empty">載入紀錄中…</div>;

  return (
    <div className="page">
      {error && <div className="notice notice-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      {leaderboard.rows.length > 0 && (
        <div className="card">
          <div className="card-title">
            <TrendingDown size={18} color="#f87171" />
            <h3>反覆漏掉</h3>
            <span className="hint">統計自 {leaderboard.sessionCount} 場已分析的演練</span>
          </div>

          {leaderboard.rows.map((row) => {
            const meta = CORE_LABEL[row.key];
            return (
              <div className="check-row" key={row.key}>
                <span className="check-mark missed">{row.missed}</span>
                <div className="check-body">
                  <strong>{meta?.label ?? row.key}</strong>
                  <div className="faint">
                    {meta?.category}　·　{row.seen} 場裡漏了 {row.missed} 場
                  </div>
                </div>
              </div>
            );
          })}

          <p className="faint" style={{ marginTop: '0.9rem' }}>
            這張表就是下一場該練什麼。排在最上面的那一項，可以用片段特訓專攻。
          </p>
        </div>
      )}

      <div className="card">
        <div className="card-title">
          <h3>演練紀錄</h3>
          <span className="hint">{sessions.length} 場</span>
        </div>

        {sessions.length === 0 ? (
          <p className="muted">還沒有任何紀錄。</p>
        ) : (
          sessions.map((session) => (
            <div
              className="check-row"
              key={session.id}
              style={{ alignItems: 'center', gap: '0.9rem' }}
            >
              <div className="check-body">
                <strong>{session.station_snapshot?.title ?? '（題目已刪除）'}</strong>
                <div className="faint">
                  {formatDate(session.created_at)}
                  {'　·　'}
                  {session.mode === 'segment' ? `片段：${session.segment_category}` : '完整'}
                  {'　·　'}
                  {humanDuration(session.duration_seconds ?? 0)}
                  {'　·　'}
                  {session.practice_kind === 'solo' ? '自己練' : '有人陪練'}
                </div>
                <div className="row" style={{ gap: '0.35rem', marginTop: '0.35rem' }}>
                  <span className={`pill ${session.status === 'analyzed' ? 'pill-ok' : 'pill-warn'}`}>
                    {STATUS_LABEL[session.status] ?? session.status}
                  </span>
                  {(session.examiner_scores ?? []).length > 0 && (
                    <span className="pill">
                      {session.examiner_scores.map((s) => s.examinerLabel).join('、')}
                      {session.final_score !== null && session.final_score !== undefined
                        ? `　實得 ${formatScore(Number(session.final_score))}`
                        : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* 報告一律可開：沒有逐字稿的場次仍可能有委員評分，
                  只准 analyzed 才能看，等於把委員打的分數鎖在裡面拿不出來。 */}
              <button type="button" className="btn" onClick={() => setSelected(session)}>
                看報告
              </button>

              {session.status !== 'analyzed' && (
                <button
                  type="button"
                  className="btn"
                  disabled={retrying === session.id}
                  onClick={() => retryAnalysis(session)}
                >
                  <RefreshCw size={15} />
                  {retrying === session.id ? '分析中…' : '重試分析'}
                </button>
              )}

              <button
                type="button"
                className="btn btn-ghost"
                title="封存這場（不會刪除，只是不再列出）"
                onClick={() => archive(session)}
              >
                <Archive size={15} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
