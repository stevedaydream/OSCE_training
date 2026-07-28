import React, { useEffect, useState } from 'react';
import { Clock, Bell, CheckCircle2, HeartPulse, FileText, Volume2, AlertTriangle, X } from 'lucide-react';
import { syncEngine, SYNC_ACTIONS } from '../../services/syncService';

export default function CandidateView({ station, timerState, activeCuePrompt, setActiveCuePrompt, roomId }) {
  const [localCue, setLocalCue] = useState(activeCuePrompt);
  const [broadcastMessage, setBroadcastMessage] = useState('');

  // 15-minute official countdown (2 mins door reading + 13 mins exam)
  const totalSeconds = station?.timing?.examSeconds ? (station.timing.readingSeconds + station.timing.examSeconds) : 900; // 15 mins
  const secondsLeft = timerState.secondsLeft ?? totalSeconds;

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Official 2-minute remaining broadcast trigger (secondsLeft === 120)
  const isBroadcast2MinAlert = secondsLeft <= 120 && secondsLeft > 115;
  const isEndingSoon = secondsLeft <= 120;

  // Synchronize timer and cue cards across tabs/devices
  useEffect(() => {
    const unsubscribe = syncEngine.subscribe((msg) => {
      if (msg.roomId && msg.roomId !== roomId) return;

      if (msg.type === SYNC_ACTIONS.CUE_PROMPT_TRIGGER) {
        setLocalCue(msg.payload);
        setActiveCuePrompt(msg.payload);
        playChime();
      } else if (msg.type === SYNC_ACTIONS.CUE_PROMPT_CLOSE) {
        setLocalCue(null);
        setActiveCuePrompt(null);
      }
    });

    return unsubscribe;
  }, [roomId]);

  useEffect(() => {
    setLocalCue(activeCuePrompt);
  }, [activeCuePrompt]);

  // Voice / Chime Alert when 2 minutes remaining
  useEffect(() => {
    if (secondsLeft === 120 && timerState.state === 'RUNNING') {
      setBroadcastMessage('📢 【廣播提醒】距離考試結束還有 2 分鐘，請自行掌握考試時間！');
      playChime();
      setTimeout(() => setBroadcastMessage(''), 8000);
    }
  }, [secondsLeft, timerState.state]);

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.4);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch (e) {
      console.log('Audio playback prevented');
    }
  };

  const handleCloseCue = () => {
    setLocalCue(null);
    setActiveCuePrompt(null);
    syncEngine.broadcast(SYNC_ACTIONS.CUE_PROMPT_CLOSE, {}, roomId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* OFFICIAL 2-MINUTE BROADCAST BANNER */}
      {(broadcastMessage || isBroadcast2MinAlert) && (
        <div style={{
          background: 'linear-gradient(90deg, #e11d48, #f59e0b)',
          color: '#ffffff',
          padding: '0.85rem 1.5rem',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: '0 0 30px rgba(244, 63, 94, 0.5)',
          animation: 'pulseGlow 1s infinite alternate'
        }}>
          <Volume2 size={26} />
          <span style={{ fontWeight: 800, fontSize: '1.15rem' }}>
            {broadcastMessage || '📢 【廣播提醒】距離口試結束剩餘 2 分鐘，請掌握時間進行報告與結論！'}
          </span>
        </div>
      )}

      {/* ULTRA LARGE COUNTDOWN TIMER DISPLAY (Official 15-Min Rules) */}
      <div className="huge-timer-card" style={{ padding: '1.5rem 2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
          <Clock size={26} color={isEndingSoon ? '#f43f5e' : '#38bdf8'} />
          <span className="badge badge-purple" style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem' }}>
            衛福部專科護理師甄審口試規範 (每位 15 分鐘)
          </span>
          <span className="badge badge-cyan" style={{ fontSize: '0.85rem', padding: '0.3rem 0.8rem' }}>
            {secondsLeft > 780 ? '📖 門前閱讀 2 分鐘' : '⏱ 考間口試 13 分鐘'}
          </span>
          <span className={`badge ${timerState.state === 'RUNNING' ? 'badge-emerald' : 'badge-amber'}`}>
            {timerState.state === 'RUNNING' ? '● 測驗進行中' : '⏸ 暫停'}
          </span>
        </div>

        <div className={`timer-number-display ${isEndingSoon ? 'timer-number-warning' : ''}`}>
          {timeFormatted}
        </div>

        {/* Progress Bar */}
        <div style={{ width: '100%', height: '8px', background: 'rgba(255, 255, 255, 0.1)', borderRadius: '4px', marginTop: '1rem', overflow: 'hidden' }}>
          <div 
            style={{ 
              height: '100%', 
              width: `${Math.min(100, (secondsLeft / totalSeconds) * 100)}%`,
              background: isEndingSoon ? 'linear-gradient(90deg, #f59e0b, #f43f5e)' : 'linear-gradient(90deg, #0284c7, #38bdf8)',
              transition: 'width 1s linear'
            }} 
          />
        </div>
      </div>

      {/* OFFICIAL DOOR STATION SHEET CARD (門前資料與主訴貼紙) */}
      <div className="glass-panel" style={{ 
        padding: '2rem', 
        background: 'linear-gradient(145deg, rgba(255, 255, 255, 0.96) 0%, rgba(241, 245, 249, 0.98) 100%)', 
        color: '#0f172a',
        border: '3px solid #0284c7',
        boxShadow: '0 10px 40px rgba(56, 189, 248, 0.25)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={22} color="#0284c7" />
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.03em', color: '#0f172a' }}>
              專科護理師甄審口試 檢查室門前【病人基本資料與主訴】
            </span>
          </div>
          <span style={{ background: '#0284c7', color: '#ffffff', padding: '0.25rem 0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 800 }}>
            {station.department || '專科護理師甄審'}
          </span>
        </div>

        {/* Patient Chief Complaint (主訴) */}
        <div style={{ marginBottom: '1.25rem' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.3rem' }}>
            【病人基本資料與主訴】
          </span>
          <p style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.4 }}>
            {station.candidateInfo?.situation}
          </p>
        </div>

        {/* Vital Signs (生命徵象) */}
        {station.candidateInfo?.vitalSigns && (
          <div style={{ background: '#e2e8f0', padding: '1rem 1.25rem', borderRadius: '8px', borderLeft: '5px solid #0284c7', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
            <HeartPulse size={26} color="#e11d48" />
            <div>
              <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 800 }}>【VITAL SIGNS 生命徵象】</span>
              <p className="mono-nums" style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                {station.candidateInfo.vitalSigns}
              </p>
            </div>
          </div>
        )}

        {/* Official Guideline Requirement Reminder */}
        <div style={{ background: '#f8fafc', border: '1px dashed #94a3b8', padding: '0.85rem 1.25rem', borderRadius: '8px' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0284c7' }}>【衛福部甄審應考須知與要求】</span>
          <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#334155', margin: '0.2rem 0 0 0', lineHeight: 1.5 }}>
            {station.candidateInfo?.task}
          </p>
        </div>
      </div>

      {/* CUE CARD OVERLAY (Triggered by Examiner) */}
      {localCue && (
        <div className="cue-overlay">
          <div className="cue-card-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Bell size={26} color="#f43f5e" className="pulseGlow" />
                <span className="badge badge-rose" style={{ fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                  來自口試委員之【現場舉牌 Cue Card】
                </span>
              </div>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={handleCloseCue}>
                <X size={20} />
              </button>
            </div>

            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, marginBottom: '1rem', color: '#ffffff' }}>
              {localCue.title || localCue.label}
            </h2>

            <div style={{ background: 'rgba(15, 23, 42, 0.8)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)', margin: '1.25rem 0', textAlign: 'left' }}>
              <p style={{ fontSize: '1.25rem', lineHeight: 1.6, color: '#f8fafc', fontWeight: 600, whiteSpace: 'pre-line' }}>
                {localCue.content}
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '1.5rem' }}>
              <button className="btn btn-danger btn-lg" onClick={handleCloseCue} style={{ minWidth: '220px' }}>
                <CheckCircle2 size={22} /> 我已瞭解提示 (關閉彈窗)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
