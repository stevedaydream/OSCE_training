import React, { useState } from 'react';
import { Activity, Key, QrCode, Monitor, UserCheck, Stethoscope, Sparkles, Layers } from 'lucide-react';
import { getApiKey, setApiKey } from '../services/aiService';

export default function Navbar({ 
  currentView, 
  setCurrentView, 
  currentRole, 
  setCurrentRole, 
  roomId, 
  onOpenRoomModal,
  activeStation 
}) {
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(getApiKey());
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveApiKey = () => {
    setApiKey(apiKeyInput);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setShowApiKeyModal(false);
    }, 1000);
  };

  return (
    <>
      <header className="glass-panel no-print" style={{ margin: '1rem 1.5rem 0 1.5rem', padding: '0.85rem 1.5rem', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          
          {/* Logo & Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setCurrentView('generator')}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.4)'
            }}>
              <Activity size={24} color="#0f172a" strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="font-display" style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', background: 'linear-gradient(90deg, #ffffff, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  OSCE MASTER
                </span>
                <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>衛福部專科護理師甄審專用</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {activeStation ? `當前考題：${activeStation.title}` : '衛福部專科護理師甄審口試與題庫產生器'}
              </p>
            </div>
          </div>

          {/* Navigation Views */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'rgba(15, 23, 42, 0.6)', padding: '0.35rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
            <button 
              className={`btn ${currentView === 'generator' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => setCurrentView('generator')}
            >
              <Sparkles size={16} /> NP 題庫產生器
            </button>
            <button 
              className={`btn ${currentView === 'candidate' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => {
                setCurrentView('candidate');
                setCurrentRole('CANDIDATE');
              }}
            >
              <Monitor size={16} /> 考生應試大螢幕
            </button>
            <button 
              className={`btn ${currentView === 'examiner' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => {
                setCurrentView('examiner');
                if (currentRole === 'CANDIDATE') setCurrentRole('EXAMINER_1');
              }}
            >
              <UserCheck size={16} /> 口試委員評分控台
            </button>
            <button 
              className={`btn ${currentView === 'report' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
              onClick={() => setCurrentView('report')}
            >
              <Layers size={16} /> 甄審成績單與 AI 報告
            </button>
          </nav>

          {/* Right Action Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {/* Room QR Code Button */}
            <button 
              className="btn btn-outline"
              style={{ padding: '0.45rem 0.85rem', fontSize: '0.825rem' }}
              onClick={onOpenRoomModal}
            >
              <QrCode size={16} />
              <span>考場: <strong style={{ color: '#ffffff' }}>#{roomId}</strong></span>
            </button>

            {/* Role Badge */}
            <span className={`badge ${currentRole === 'CANDIDATE' ? 'badge-rose' : 'badge-emerald'}`} style={{ padding: '0.45rem 0.75rem' }}>
              <Stethoscope size={13} />
              {currentRole === 'CANDIDATE' ? 'NP 考生身份' : currentRole.replace('EXAMINER_', '口試委員 ')}
            </span>

            {/* API Key Config */}
            <button 
              className="btn btn-secondary"
              style={{ padding: '0.45rem 0.6rem' }}
              title="設定 Gemini AI API Key"
              onClick={() => setShowApiKeyModal(true)}
            >
              <Key size={16} color={getApiKey() ? '#38bdf8' : 'var(--text-muted)'} />
            </button>
          </div>

        </div>
      </header>

      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="modal-overlay" onClick={() => setShowApiKeyModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '0.6rem', borderRadius: '12px' }}>
                <Key size={24} color="#38bdf8" />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Google Gemini API Key 設定</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>解鎖 AI 智慧生成衛福部專科護理師考題、圖片 OCR 解析與測驗分析報告</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">API Key</label>
              <input 
                type="password" 
                className="form-input"
                placeholder="AIzaSy..."
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginTop: '0.3rem' }}>
                * 若無 API Key，系統仍可使用預載的衛福部專科護理師真題、單機連動與智慧範本進行所有評分與測試。
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowApiKeyModal(false)}>取消</button>
              <button className="btn btn-primary" onClick={handleSaveApiKey}>
                {savedSuccess ? '儲存成功！' : '儲存 Key'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
