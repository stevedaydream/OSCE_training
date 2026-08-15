import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Play, Square, Unlock, Mic, MicOff, Radio } from 'lucide-react';
import { supabase, callFunction } from '../lib/supabase';
import { EVENTS, joinChannel, send } from '../lib/realtime';
import { CORE_CHECKLIST, PHASES, PHASE_LABEL } from '../lib/constants';
import { mmss } from '../lib/format';
import { broadcastAlert, ring } from '../lib/sound';
import { encodeToMp3, startRecording } from '../lib/audio';
import { saveClip } from '../lib/idb';
import { createKeywordListener, isSpeechSupported } from '../lib/speech';
import CueOverlay from './CueOverlay';
import SessionReport from './SessionReport';

/**
 * 一場演練的主控端。這一台是唯一的權威：它跑計時、錄音、寫資料庫，
 * 並把狀態廣播給門前手機與陪練考官端。
 */
export default function PracticeRunner({ session, onExit }) {
  // 用題目快照而非即時查詢：日後改題目也不會回頭改寫這一場的報告。
  const station = useMemo(() => session.station_snapshot ?? {}, [session.station_snapshot]);
  const timing = useMemo(
    () => station.timing ?? { readingSeconds: 120, examSeconds: 900, alertSeconds: 120 },
    [station.timing],
  );
  const isSolo = session.practice_kind === 'solo';

  const cueCards = useMemo(
    () => (station.cue_cards ?? []).map((cue, index) => ({
      ...cue,
      id: cue.id || `cue_${index}`,
    })),
    [station.cue_cards],
  );

  /** 片段特訓時，本題專屬檢核項只取該段落的評分項目。 */
  const stationChecklist = useMemo(() => {
    const items = (station.rubric_items ?? []).filter((item) =>
      session.mode === 'segment' ? item.category === session.segment_category : true,
    );
    return items.map((item, index) => ({
      key: item.id || `r_${index}`,
      label: `${item.category ?? ''}｜${item.title ?? ''}`.replace(/^｜/, ''),
    }));
  }, [station.rubric_items, session.mode, session.segment_category]);

  const [phase, setPhase] = useState(PHASES.IDLE);
  const [remaining, setRemaining] = useState(timing.readingSeconds);
  const [running, setRunning] = useState(false);
  const [alerting, setAlerting] = useState(false);
  const [activeCue, setActiveCue] = useState(null);
  const [reveals, setReveals] = useState([]);
  const [examinerScores, setExaminerScores] = useState([]);
  const [showManualUnlock, setShowManualUnlock] = useState(false);
  const [speechState, setSpeechState] = useState('idle');
  const [recordingOn, setRecordingOn] = useState(false);
  const [stage, setStage] = useState('live');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [finished, setFinished] = useState(null);

  const deadlineRef = useRef(null);
  const phaseRef = useRef(PHASES.IDLE);
  const alertedRef = useRef(false);
  const channelRef = useRef(null);
  const recorderRef = useRef(null);
  const listenerRef = useRef(null);
  const examStartedAtRef = useRef(null);
  const revealsRef = useRef([]);
  const snapshotRef = useRef({});
  const finishingRef = useRef(false);

  revealsRef.current = reveals;

  /** 廣播用的狀態快照。放在 ref 裡，才不會讓 Realtime 回呼抓到過期的值。 */
  snapshotRef.current = {
    phase,
    remaining,
    running,
    alertSeconds: timing.alertSeconds,
    stationTitle: station.title,
    doorSheet: station.door_sheet ?? {},
    cueCards: cueCards.map(({ id, label, title, category, peItem }) => ({
      id,
      label,
      title,
      category,
      peItem,
    })),
    rubricItems: (station.rubric_items ?? []).map((item, index) => ({
      ...item,
      id: item.id || `r_${index}`,
    })),
    revealedCueIds: reveals.map((r) => r.cueId),
  };

  const broadcastState = useCallback(() => {
    send(channelRef.current, EVENTS.STATE, {
      ...snapshotRef.current,
      syncedAt: Date.now(),
    });
  }, []);

  const revealCue = useCallback(
    (cueId, by) => {
      const cue = cueCards.find((item) => item.id === cueId);
      if (!cue) return;
      if (revealsRef.current.some((item) => item.cueId === cueId)) return;

      const atSeconds = examStartedAtRef.current
        ? Math.round((Date.now() - examStartedAtRef.current) / 1000)
        : 0;

      listenerRef.current?.markHandled(cueId);
      setReveals((prev) => [...prev, { cueId, label: cue.label || cue.title, atSeconds, by }]);
      setActiveCue(cue);
      send(channelRef.current, EVENTS.CUE_SHOW, { cueId });
    },
    [cueCards],
  );

  // ---- Realtime：本機是主控，其餘裝置是客戶端 ----
  useEffect(() => {
    const channel = joinChannel(session.join_code, {
      [EVENTS.HELLO]: () => broadcastState(),
      [EVENTS.CUE_PUSH]: ({ cueId }) => revealCue(cueId, 'examiner'),
      [EVENTS.SCORE]: (payload) => {
        setExaminerScores((prev) => [
          ...prev.filter((item) => item.examinerLabel !== payload.examinerLabel),
          payload,
        ]);
      },
    });

    channelRef.current = channel;
    channel.subscribe();

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [session.join_code, broadcastState, revealCue]);

  // 主控每 3 秒校時一次，客戶端之間自行倒數，訊息量壓在免費額度的零頭。
  useEffect(() => {
    broadcastState();
    if (!running) return undefined;
    const id = setInterval(broadcastState, 3000);
    return () => clearInterval(id);
  }, [phase, running, reveals.length, broadcastState]);

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;

    setRunning(false);
    setPhase(PHASES.ENDED);
    phaseRef.current = PHASES.ENDED;
    setAlerting(false);
    ring();

    listenerRef.current?.stop();
    listenerRef.current = null;

    const durationSeconds = examStartedAtRef.current
      ? Math.round((Date.now() - examStartedAtRef.current) / 1000)
      : 0;

    setStage('processing');
    setProgress('停止錄音…');

    let audioBlob = null;
    if (recorderRef.current) {
      audioBlob = await recorderRef.current.stop();
      recorderRef.current = null;
      setRecordingOn(false);
    }

    try {
      if (audioBlob && audioBlob.size > 0) {
        setProgress('把錄音存到這台電腦…');
        await saveClip(session.id, audioBlob);

        setProgress('轉檔中（Gemini 不吃 webm，要先轉成 MP3）…');
        const { blob: mp3 } = await encodeToMp3(audioBlob, (ratio) => {
          setProgress(`轉檔中 ${Math.round(ratio * 100)}%…`);
        });

        setProgress('上傳並分析中，約需一到兩分鐘…');
        const formData = new FormData();
        formData.append('audio', mp3, 'session.mp3');
        formData.append(
          'meta',
          JSON.stringify({
            stationTitle: station.title,
            department: station.department,
            mode: session.mode,
            segmentCategory: session.segment_category,
            durationSeconds,
            coreChecklist: CORE_CHECKLIST,
            stationChecklist,
            cueReveals: revealsRef.current,
          }),
        );

        const result = await callFunction('analyze-session', { formData });

        await supabase
          .from('sessions')
          .update({
            status: 'analyzed',
            ended_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
            transcript: result.transcript ?? '',
            analysis: result,
            cue_reveals: revealsRef.current,
            examiner_scores: examinerScores,
          })
          .eq('id', session.id);

        setFinished({ ...session, duration_seconds: durationSeconds, analysis: result, transcript: result.transcript, cue_reveals: revealsRef.current, examiner_scores: examinerScores });
        setStage('done');
      } else {
        await supabase
          .from('sessions')
          .update({
            status: 'ended',
            ended_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
            cue_reveals: revealsRef.current,
            examiner_scores: examinerScores,
          })
          .eq('id', session.id);
        setError('這一場沒有錄到音，所以沒有逐字稿可以分析。');
        setStage('error');
      }
    } catch (err) {
      // 分析失敗不該連場次都遺失：音檔還在本機，紀錄分頁可以重試。
      await supabase
        .from('sessions')
        .update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          cue_reveals: revealsRef.current,
          examiner_scores: examinerScores,
        })
        .eq('id', session.id);
      setError(err.message);
      setStage('error');
    }
  }, [session, station, stationChecklist, examinerScores]);

  const enterExam = useCallback(async () => {
    ring();
    setPhase(PHASES.EXAM);
    phaseRef.current = PHASES.EXAM;
    deadlineRef.current = Date.now() + timing.examSeconds * 1000;
    examStartedAtRef.current = Date.now();
    setRemaining(timing.examSeconds);

    try {
      recorderRef.current = await startRecording();
      setRecordingOn(true);
    } catch {
      setError('麥克風無法啟動，這一場不會有逐字稿。可以繼續練，但事後沒有檢核結果。');
    }

    if (isSolo && isSpeechSupported()) {
      const watchList = cueCards
        .filter((cue) => (cue.triggerKeywords ?? []).length > 0)
        .map((cue) => ({ id: cue.id, keywords: cue.triggerKeywords }));

      if (watchList.length) {
        listenerRef.current = createKeywordListener(
          watchList,
          (cueId) => revealCue(cueId, 'keyword'),
          ({ state }) => setSpeechState(state),
        );
        listenerRef.current?.start();
      }
    }
  }, [timing.examSeconds, isSolo, cueCards, revealCue]);

  // ---- 計時引擎：以絕對截止時間為準，不靠累加，長時間也不會漂移 ----
  useEffect(() => {
    if (!running) return undefined;

    const id = setInterval(() => {
      const deadline = deadlineRef.current;
      if (!deadline) return;

      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);

      if (
        phaseRef.current === PHASES.EXAM &&
        left <= timing.alertSeconds &&
        left > 0 &&
        !alertedRef.current
      ) {
        alertedRef.current = true;
        setAlerting(true);
        broadcastAlert();
      }

      if (left <= 0) {
        if (phaseRef.current === PHASES.READING) enterExam();
        else if (phaseRef.current === PHASES.EXAM) finish();
      }
    }, 250);

    return () => clearInterval(id);
  }, [running, timing.alertSeconds, enterExam, finish]);

  useEffect(() => () => {
    // 元件被卸載（例如她直接關掉分頁）時，至少要放開麥克風。
    listenerRef.current?.stop();
    recorderRef.current?.stop();
  }, []);

  function start() {
    setPhase(PHASES.READING);
    phaseRef.current = PHASES.READING;
    deadlineRef.current = Date.now() + timing.readingSeconds * 1000;
    setRemaining(timing.readingSeconds);
    setRunning(true);
    supabase.from('sessions').update({
      status: 'reading',
      started_at: new Date().toISOString(),
    }).eq('id', session.id).then(() => {});
  }

  function skipReading() {
    deadlineRef.current = Date.now();
  }

  if (stage === 'done' && finished) {
    return <SessionReport session={finished} onBack={onExit} />;
  }

  if (stage === 'processing') {
    return (
      <div className="page page-narrow">
        <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <h3>本場結束，處理中</h3>
          <p className="muted" style={{ marginTop: '0.75rem' }}>{progress}</p>
          <p className="faint" style={{ marginTop: '1.5rem' }}>
            請不要關掉這個分頁。錄音已經存在這台電腦上，只有 MP3 那一份會送去分析。
          </p>
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className="page page-narrow">
        <div className="card">
          <h3>這一場沒有分析成功</h3>
          <div className="notice notice-danger" style={{ marginTop: '0.75rem' }}>{error}</div>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            錄音還在這台電腦上，可以到「紀錄」分頁重試分析。
          </p>
          <button type="button" className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={onExit}>
            回到演練設定
          </button>
        </div>
      </div>
    );
  }

  const joinUrl = (role) =>
    `${window.location.origin}${window.location.pathname}?join=${session.join_code}&as=${role}`;

  const isAlertZone = phase === PHASES.EXAM && remaining <= timing.alertSeconds;

  return (
    <>
      {alerting && phase === PHASES.EXAM && (
        <div className="broadcast">📢 廣播提醒：距離口試結束剩餘 2 分鐘，請自行掌握時間</div>
      )}

      <div className="page">
        <div style={{ textAlign: 'center', padding: '1.5rem 0 1rem' }}>
          <div className="timer-phase">{PHASE_LABEL[phase]}</div>
          <div className={`timer timer-hero ${isAlertZone ? 'timer-alert' : ''}`}>
            {mmss(remaining)}
          </div>

          <div className="row" style={{ justifyContent: 'center', marginTop: '1rem' }}>
            {phase === PHASES.IDLE && (
              <button type="button" className="btn btn-primary btn-lg" onClick={start}>
                <Play size={18} />
                開始（門前閱讀 {Math.round(timing.readingSeconds / 60)} 分鐘）
              </button>
            )}
            {phase === PHASES.READING && (
              <button type="button" className="btn" onClick={skipReading}>
                我讀完了，直接進場
              </button>
            )}
            {phase === PHASES.EXAM && (
              <button type="button" className="btn btn-danger" onClick={finish}>
                <Square size={16} />
                結束這一場
              </button>
            )}
          </div>

          <div className="row" style={{ justifyContent: 'center', marginTop: '0.75rem' }}>
            <span className="pill">
              {recordingOn ? <Mic size={12} /> : <MicOff size={12} />}
              {recordingOn ? '錄音中' : '未錄音'}
            </span>
            {isSolo && (
              <span className={`pill ${speechState === 'listening' ? 'pill-ok' : ''}`}>
                <Radio size={12} />
                語音解鎖：
                {{ idle: '待命', listening: '監聽中', restarting: '重連中', error: '失效', stopped: '已停止' }[speechState] ?? speechState}
              </span>
            )}
            <span className="pill">{isSolo ? '自己練' : '有人陪練'}</span>
          </div>
        </div>

        <div className="grid-2">
          <div className="card">
            <div className="card-title">
              <h3>連線裝置</h3>
              <span className="hint">房間碼 #{session.join_code}</span>
            </div>

            <div className="row" style={{ gap: '1.25rem' }}>
              <div style={{ textAlign: 'center' }}>
                <div className="qr-box">
                  <QRCodeSVG value={joinUrl('door')} size={120} level="M" />
                </div>
                <p className="faint" style={{ marginTop: '0.4rem' }}>手機門前貼紙</p>
              </div>

              {!isSolo && (
                <div style={{ textAlign: 'center' }}>
                  <div className="qr-box">
                    <QRCodeSVG value={joinUrl('coach')} size={120} level="M" />
                  </div>
                  <p className="faint" style={{ marginTop: '0.4rem' }}>陪練考官端</p>
                </div>
              )}
            </div>

            <p className="faint" style={{ marginTop: '0.75rem' }}>
              手機掃完後記得按「啟用鈴聲」，否則進場鈴不會響。
            </p>
          </div>

          <div className="card">
            <div className="card-title">
              <h3>提示卡</h3>
              <span className="hint">
                {isSolo ? '說出對應的檢查名稱就會自動出現' : '由陪練考官端推送'}
              </span>
            </div>

            {reveals.length === 0 ? (
              <p className="muted">尚未揭露任何提示卡。</p>
            ) : (
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {reveals.map((item) => (
                  <li key={item.cueId} className="muted">
                    {mmss(item.atSeconds)}　{item.label}
                    <span className="faint">
                      　（{{ keyword: '語音解鎖', manual: '手動解鎖', examiner: '考官推送' }[item.by]}）
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {isSolo && phase === PHASES.EXAM && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ marginTop: '0.9rem' }}
                  onClick={() => setShowManualUnlock((value) => !value)}
                >
                  <Unlock size={15} />
                  {showManualUnlock ? '收起手動解鎖' : '手動解鎖（語音沒認出來時用）'}
                </button>

                {showManualUnlock && (
                  <div className="cue-list" style={{ marginTop: '0.75rem' }}>
                    {cueCards.map((cue) => (
                      <button
                        key={cue.id}
                        type="button"
                        className="cue-item"
                        disabled={reveals.some((r) => r.cueId === cue.id)}
                        onClick={() => revealCue(cue.id, 'manual')}
                      >
                        <div className="cue-item-main">
                          <strong>{cue.label || cue.title}</strong>
                          <span>{cue.peItem ? `對應：${cue.peItem}` : cue.category || ''}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {!isSolo && examinerScores.length > 0 && (
              <p className="muted" style={{ marginTop: '0.9rem' }}>
                已收到 {examinerScores.map((s) => s.examinerLabel).join('、')} 的評分。
              </p>
            )}
          </div>
        </div>

        {error && <div className="notice notice-warn" style={{ marginTop: '1rem' }}>{error}</div>}
      </div>

      <CueOverlay
        cue={activeCue}
        onClose={() => {
          setActiveCue(null);
          send(channelRef.current, EVENTS.CUE_HIDE, {});
        }}
      />
    </>
  );
}
