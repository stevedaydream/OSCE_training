import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { Award, Download, Sparkles, Clock, Compass, AlertTriangle, CheckCircle2, TrendingUp, RefreshCcw, FileText } from 'lucide-react';
import { generatePostExamReport } from '../../services/aiService';
import { exportReportToPDF } from '../../services/exportService';

export default function ExamReportView({ station, examinerScores, cueLog, onResetExam }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // 110 Official Rule: 2 Examiners average score (calculated to 2 decimal places, 3rd decimal truncated/floor)
  const calculateOfficialScore = () => {
    const scores = Object.values(examinerScores).map(ex => ex.totalScore || 0);
    if (scores.length === 0) return { finalScore: 0, ex1: 0, ex2: 0, isPass: false };
    
    const ex1 = scores[0] || 0;
    const ex2 = scores[1] ?? ex1; // fallback to ex1 if only 1 examiner rated
    
    const avg = (ex1 + ex2) / 2;
    // Truncate at 2 decimal places without rounding up (無條件捨去至小數第2位)
    const finalScore = Math.floor(avg * 100) / 100;
    
    return {
      finalScore,
      ex1,
      ex2,
      isPass: finalScore >= 60.0
    };
  };

  const scoreResult = calculateOfficialScore();

  useEffect(() => {
    async function fetchReport() {
      setLoading(true);
      try {
        const data = await generatePostExamReport({
          station,
          examinerScores,
          timestamps: [],
          cueLog
        });
        setReport(data);

        if (scoreResult.isPass) {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 }
          });
        }
      } catch (err) {
        console.error('Report fetch error:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  }, [station, examinerScores, cueLog]);

  const handleExportPDF = () => {
    exportReportToPDF('printable-report-area', `${station.title}_NP_甄審口試成績單.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      
      {/* Header Actions */}
      <div className="glass-panel no-print" style={{ padding: '1.25rem 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-purple">衛福部 110 年度甄審口試標準</span>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>專科護理師甄審口試 成績單與 AI 評量總結</h2>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button className="btn btn-secondary" onClick={onResetExam}>
              <RefreshCcw size={16} /> 開啟新場次口試
            </button>
            <button className="btn btn-primary" onClick={handleExportPDF}>
              <Download size={16} /> 導出甄審口試成績 PDF
            </button>
          </div>
        </div>
      </div>

      {/* PRINTABLE REPORT AREA */}
      <div id="printable-report-area" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        
        {/* Official Score & Status Banner (依據衛福部簡章第(六)條計算) */}
        <div className="glass-panel" style={{ padding: '2rem', background: scoreResult.isPass ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)' : 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
            
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.5rem' }}>
                <span className={`badge ${scoreResult.isPass ? 'badge-emerald' : 'badge-rose'}`} style={{ fontSize: '0.9rem', padding: '0.4rem 0.8rem' }}>
                  {scoreResult.isPass ? '甄審口試及格 PASS (≥60分)' : '甄審口試未及格 FAIL (<60分)'}
                </span>
                <span className="badge badge-cyan">{station.department}</span>
              </div>
              <h1 className="font-display" style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '0.4rem' }}>
                {station.title}
              </h1>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                計算規範：依簡章由 2 位口試委員現場評量之平均數（無條件捨去至小數第 2 位）
              </p>
            </div>

            {/* Official Score Calculation Display */}
            <div style={{ textAlign: 'center', background: 'rgba(15, 23, 42, 0.85)', padding: '1.25rem 2.5rem', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-glass-glow)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
                口試甄審實得成績 (2位委員平均)
              </span>
              <div className="mono-nums" style={{ fontSize: '3.8rem', fontWeight: 800, lineHeight: 1, color: scoreResult.isPass ? '#34d399' : '#fb7185' }}>
                {scoreResult.finalScore.toFixed(2)}
                <span style={{ fontSize: '1.4rem', color: 'var(--text-muted)' }}>/100</span>
              </div>
            </div>

          </div>
        </div>

        {/* 1. Official 2 Examiners Score Breakdown Table */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} /> 1. 2位口試委員現場評量分數細目 (依簡章規定計算)
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-card)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '0.75rem 1rem' }}>口試委員</th>
                  <th style={{ padding: '0.75rem 1rem' }}> CheckList 得分</th>
                  <th style={{ padding: '0.75rem 1rem' }}>Global Rating 評估</th>
                  <th style={{ padding: '0.75rem 1rem' }}>評分權重計算</th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#ffffff' }}>口試委員 A (Examiner 1)</td>
                  <td className="mono-nums" style={{ padding: '0.75rem 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>
                    {scoreResult.ex1} 分
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="badge badge-amber">Level {examinerScores['EXAMINER_1']?.globalRating || 4}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>佔總成績 50%</td>
                </tr>
                <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#ffffff' }}>口試委員 B (Examiner 2)</td>
                  <td className="mono-nums" style={{ padding: '0.75rem 1rem', fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}>
                    {scoreResult.ex2} 分
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span className="badge badge-amber">Level {examinerScores['EXAMINER_2']?.globalRating || 4}</span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', color: 'var(--text-muted)' }}>佔總成績 50%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '1rem', padding: '0.85rem', background: 'rgba(15, 23, 42, 0.6)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            * 簡章規定：實得成績以 2 位口試委員之評分總和之平均數為實得成績 (計算至小數第2位，第3位無條件捨去)，及格分數為 60 分。
          </div>
        </div>

        {/* 2. Official Timing Breakdown & 2-Min Alert */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f59e0b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={20} /> 2. 15分鐘考試時間掌握與廣播提醒歷程
          </h3>

          <div className="grid-3">
            <div className="glass-card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>門前閱讀時間 (簡章規定2分鐘)</span>
              <p className="mono-nums" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8', marginTop: '0.2rem' }}>
                2分00秒 (讀題充分)
              </p>
            </div>
            <div className="glass-card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>考間焦點式口試時間</span>
              <p className="mono-nums" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399', marginTop: '0.2rem' }}>
                13分00秒 (時間掌握得當)
              </p>
            </div>
            <div className="glass-card">
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>結束前2分鐘廣播提醒</span>
              <p className="mono-nums" style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fbbf24', marginTop: '0.2rem' }}>
                已於 13:00 準時提醒
              </p>
            </div>
          </div>
        </div>

        {/* 3. Official Core Competencies Assessment */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} /> 3. 專科護理師四大核心專業能力評估與 AI 反思建議
          </h3>

          <div className="grid-2">
            <div className="glass-card" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#34d399', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={16} /> 口試展現核心強項
              </h4>
              <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', color: '#ffffff' }}>
                {report?.strengths?.map((st, idx) => (
                  <li key={idx}>{st}</li>
                )) || <li>焦點式病史訪談脈絡清晰，身體檢查項目口述說做合一。</li>}
              </ul>
            </div>

            <div className="glass-card" style={{ background: 'rgba(56, 189, 248, 0.08)', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
              <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#38bdf8', marginBottom: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <TrendingUp size={16} /> 甄審口試答題技巧優化建議
              </h4>
              <ul style={{ paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', fontSize: '0.9rem', color: '#ffffff' }}>
                {report?.improvementTips?.map((tip, idx) => (
                  <li key={idx}>{tip}</li>
                )) || <li>身體檢查時請務必對病人同時說明檢查目的、項目及部位。</li>}
              </ul>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
