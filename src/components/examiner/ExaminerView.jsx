import React, { useState } from 'react';
import { UserCheck, Play, Pause, RotateCcw, PlusCircle, Bell, CheckSquare, Award, Clock, FileText, Send, AlertTriangle } from 'lucide-react';
import { syncEngine, SYNC_ACTIONS } from '../../services/syncService';

export default function ExaminerView({ 
  station, 
  timerState, 
  setTimerState, 
  currentRole, 
  setCurrentRole, 
  examinerScores, 
  setExaminerScores, 
  cueLog, 
  setCueLog,
  roomId,
  onCompleteExam 
}) {
  const [customCueText, setCustomCueText] = useState('');
  
  // Current Examiner Score State
  const currentExaminerId = currentRole; // e.g. 'EXAMINER_1'
  const myScores = examinerScores[currentExaminerId] || {
    scores: {},
    notes: {},
    globalRating: 4,
    totalScore: 0
  };

  // Timer Control Handlers
  const handleStartTimer = () => {
    setTimerState(prev => ({ ...prev, state: 'RUNNING' }));
    syncEngine.broadcast(SYNC_ACTIONS.TIMER_CONTROL, { state: 'RUNNING' }, roomId);
  };

  const handlePauseTimer = () => {
    setTimerState(prev => ({ ...prev, state: 'PAUSED' }));
    syncEngine.broadcast(SYNC_ACTIONS.TIMER_CONTROL, { state: 'PAUSED' }, roomId);
  };

  const handleResetTimer = () => {
    const seconds = station?.timing?.examSeconds || 480;
    setTimerState({ state: 'PAUSED', secondsLeft: seconds, phase: 'EXAM' });
    syncEngine.broadcast(SYNC_ACTIONS.TIMER_CONTROL, { state: 'PAUSED', secondsLeft: seconds, phase: 'EXAM' }, roomId);
  };

  const handleAddMinute = () => {
    const newSec = (timerState.secondsLeft || 0) + 60;
    setTimerState(prev => ({ ...prev, secondsLeft: newSec }));
    syncEngine.broadcast(SYNC_ACTIONS.TIMER_CONTROL, { secondsLeft: newSec }, roomId);
  };

  // Rubric Scoring Handler
  const handleScoreChange = (rubricId, maxPoints, checked) => {
    const points = checked ? maxPoints : 0;
    const newScoresObj = { ...myScores.scores, [rubricId]: points };
    
    // Calculate total
    let total = 0;
    Object.values(newScoresObj).forEach(val => total += (val || 0));

    const updated = {
      ...myScores,
      scores: newScoresObj,
      totalScore: total
    };

    setExaminerScores(prev => ({
      ...prev,
      [currentExaminerId]: updated
    }));

    syncEngine.broadcast(SYNC_ACTIONS.EXAMINER_SCORE_UPDATE, { examinerId: currentExaminerId, scores: newScoresObj, totalScore: total }, roomId);
  };

  const handleGlobalRatingChange = (score) => {
    const updated = { ...myScores, globalRating: score };
    setExaminerScores(prev => ({
      ...prev,
      [currentExaminerId]: updated
    }));
  };

  // Trigger Cue Card Prompt
  const handleTriggerCue = (cue) => {
    const cuePayload = {
      ...cue,
      examinerName: currentRole.replace('EXAMINER_', '評審 ')
    };

    // Log timestamp
    const logItem = {
      id: Date.now(),
      label: cue.label || cue.title,
      time: new Date().toLocaleTimeString(),
      examiner: currentRole,
      content: cue.content
    };
    setCueLog(prev => [logItem, ...prev]);

    // Broadcast to candidate screen
    syncEngine.broadcast(SYNC_ACTIONS.CUE_PROMPT_TRIGGER, cuePayload, roomId);
  };

  // Send Custom Text Cue
  const handleSendCustomCue = (e) => {
    e.preventDefault();
    if (!customCueText.trim()) return;

    const customCue = {
      id: `custom_${Date.now()}`,
      label: "現場評審加發提示",
      title: "【考場現場提示】",
      type: "text",
      content: customCueText
    };

    handleTriggerCue(customCue);
    setCustomCueText('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Controller Bar */}
      <div className="glass-panel" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Examiner Identity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.6rem', borderRadius: '12px' }}>
              <UserCheck size={24} color="#10b981" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <h2 style={{ fontSize: '1.3rem', fontWeight: 800 }}>評審端考台評分與控制</h2>
                <span className="badge badge-emerald">{currentRole.replace('EXAMINER_', '評審 ')}</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                切換評審 1/2/3 即刻進行獨立評分與舉牌控台
              </p>
            </div>
          </div>

          {/* Examiner Switcher Buttons */}
          <div style={{ display: 'flex', gap: '0.4rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.3rem', borderRadius: 'var(--radius-md)' }}>
            {['EXAMINER_1', 'EXAMINER_2', 'EXAMINER_3'].map(exId => (
              <button 
                key={exId}
                className={`btn ${currentRole === exId ? 'btn-success' : 'btn-secondary'}`}
                style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                onClick={() => setCurrentRole(exId)}
              >
                {exId.replace('EXAMINER_', '評審 ')}
              </button>
            ))}
          </div>

          {/* Timer Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(15, 23, 42, 0.8)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
            <Clock size={20} color="#38bdf8" />
            <span className="mono-nums" style={{ fontSize: '1.4rem', fontWeight: 800, color: '#ffffff' }}>
              {Math.floor((timerState.secondsLeft || 480) / 60)}:
              {String((timerState.secondsLeft || 480) % 60).padStart(2, '0')}
            </span>

            {timerState.state === 'RUNNING' ? (
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={handlePauseTimer} title="暫停計時器">
                <Pause size={16} /> 暫停
              </button>
            ) : (
              <button className="btn btn-primary" style={{ padding: '0.4rem 0.6rem' }} onClick={handleStartTimer} title="開始計時器">
                <Play size={16} /> 開始
              </button>
            )}

            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={handleAddMinute} title="加1分鐘">
              +1分
            </button>
            <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={handleResetTimer} title="重設時間">
              <RotateCcw size={16} />
            </button>
          </div>

        </div>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid-2">
        
        {/* Left Column: Interactive Checklist Scoring Table */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckSquare size={20} /> 評分細項 (Checklist)
            </h3>
            <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '0.3rem 0.8rem', borderRadius: 'var(--radius-md)' }}>
              得分：{myScores.totalScore || 0} / 100 分
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {station.rubricItems?.map(item => {
              const isChecked = !!myScores.scores?.[item.id];
              return (
                <div 
                  key={item.id} 
                  className="glass-card"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.85rem',
                    borderColor: isChecked ? 'rgba(16, 185, 129, 0.4)' : 'var(--border-card)',
                    background: isChecked ? 'rgba(16, 185, 129, 0.08)' : 'rgba(15, 23, 42, 0.5)'
                  }}
                >
                  <input 
                    type="checkbox"
                    checked={isChecked}
                    onChange={e => handleScoreChange(item.id, item.maxPoints, e.target.checked)}
                    style={{ width: '22px', height: '22px', marginTop: '0.2rem', cursor: 'pointer', accentColor: '#10b981' }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>{item.category}</span>
                      {item.critical && (
                        <span className="badge badge-rose" style={{ fontSize: '0.65rem' }}>
                          <AlertTriangle size={10} /> 關鍵評分點
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.95rem', fontWeight: 600, color: isChecked ? '#ffffff' : 'var(--text-main)', lineHeight: 1.4 }}>
                      {item.title}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <span className="mono-nums" style={{ fontSize: '1.1rem', fontWeight: 800, color: isChecked ? '#34d399' : 'var(--text-muted)' }}>
                      +{isChecked ? item.maxPoints : 0}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', display: 'block' }}>
                      配分 {item.maxPoints} 分
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Global Rating Scale */}
          <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Award size={18} /> Global Rating 全局總體評估
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {station.globalRating?.map(gr => (
                <label 
                  key={gr.score}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: myScores.globalRating === gr.score ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                    border: `1px solid ${myScores.globalRating === gr.score ? 'rgba(245, 158, 11, 0.4)' : 'transparent'}`,
                    cursor: 'pointer'
                  }}
                >
                  <input 
                    type="radio" 
                    name="globalRating"
                    checked={myScores.globalRating === gr.score}
                    onChange={() => handleGlobalRatingChange(gr.score)}
                    style={{ accentColor: '#f59e0b' }}
                  />
                  <span style={{ fontWeight: 700, color: '#fbbf24', fontSize: '0.9rem' }}>{gr.score} 分</span>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-main)' }}>{gr.label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: One-touch Cue Card Prompting & Log */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* CUE CARD PROMPT CONTROLLER */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f43f5e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} /> 舉牌提示控台 (點擊即時傳送至考生螢幕)
            </h3>

            {/* Station Preset Cue Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
              {station.cueCards?.map(cue => (
                <button
                  key={cue.id}
                  className="btn btn-danger"
                  style={{ justifyContent: 'space-between', padding: '0.85rem 1.25rem', borderRadius: 'var(--radius-md)', textAlign: 'left' }}
                  onClick={() => handleTriggerCue(cue)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Bell size={18} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{cue.label}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>點擊舉牌發送 ➔</span>
                </button>
              ))}
            </div>

            {/* Custom Cue Input */}
            <form onSubmit={handleSendCustomCue} style={{ background: 'rgba(15, 23, 42, 0.7)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
              <label className="form-label" style={{ marginBottom: '0.4rem' }}>
                <FileText size={14} /> 現場自訂文字舉牌提示
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="如：【體檢報告】聽診右肺下葉有濕囉音..."
                  value={customCueText}
                  onChange={e => setCustomCueText(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                  <Send size={16} /> 發送
                </button>
              </div>
            </form>
          </div>

          {/* Cue Trigger Log Timeline */}
          <div className="glass-panel" style={{ padding: '1.5rem', flex: 1 }}>
            <h4 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
              📋 本場舉牌提示歷程紀錄 ({cueLog.length})
            </h4>

            {cueLog.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', fontStyle: 'italic' }}>
                尚未發送任何舉牌提示。點擊上方按鈕即可發送提示給考生。
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '200px', overflowY: 'auto' }}>
                {cueLog.map(log => (
                  <div key={log.id} style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #f43f5e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                      <span>[{log.time}] {log.examiner}</span>
                      <span className="badge badge-rose" style={{ fontSize: '0.6rem' }}>Triggered</span>
                    </div>
                    <p style={{ color: '#ffffff', fontWeight: 600, marginTop: '0.2rem' }}>{log.label}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Complete & Submit Exam */}
          <button className="btn btn-success btn-lg" onClick={onCompleteExam} style={{ width: '100%' }}>
            <Award size={20} /> 完成本場考評並產出 AI 分析報告
          </button>

        </div>

      </div>

    </div>
  );
}
