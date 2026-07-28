import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, Copy, Check, Users, Monitor, UserCheck, RefreshCw, X } from 'lucide-react';

export default function RoomModal({ isOpen, onClose, roomId, setRoomId, currentRole, setCurrentRole }) {
  const [copied, setCopied] = useState(false);
  const [inputRoomId, setInputRoomId] = useState(roomId);

  if (!isOpen) return null;

  const currentUrl = window.location.origin + window.location.pathname + `?room=${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateNewRoom = () => {
    const newId = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomId(newId);
    setInputRoomId(newId);
  };

  const handleSwitchRoom = () => {
    if (inputRoomId.trim()) {
      setRoomId(inputRoomId.trim());
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '0.5rem', borderRadius: '10px' }}>
              <QrCode size={22} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>考場房間與 QR Code 連線</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>掃描 QR Code 或分享連結，評審與考生可跨裝置同步</p>
            </div>
          </div>
          <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* QR Code Section */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.5rem', background: 'rgba(15, 23, 42, 0.8)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-card)', marginBottom: '1.5rem' }}>
          <div style={{ background: '#ffffff', padding: '1rem', borderRadius: '16px', boxShadow: '0 0 25px rgba(56, 189, 248, 0.2)' }}>
            <QRCodeSVG value={currentUrl} size={180} level="H" />
          </div>
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>考場專屬房間代碼</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '0.1em', color: '#38bdf8', fontFamily: 'var(--font-mono)' }}>
              #{roomId}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', width: '100%', maxWidth: '400px' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleCopy}>
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? '已複製連線網址' : '複製考場連線 URL'}
            </button>
            <button className="btn btn-secondary" onClick={handleGenerateNewRoom} title="產生新房間">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* Identity Role Switcher */}
        <div style={{ marginBottom: '1.5rem' }}>
          <label className="form-label" style={{ marginBottom: '0.6rem' }}>
            <Users size={16} /> 本機選擇身分 (多位評審 2~3 人可動態加入)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.6rem' }}>
            <button 
              className={`btn ${currentRole === 'CANDIDATE' ? 'btn-danger' : 'btn-secondary'}`}
              style={{ flexDirection: 'column', padding: '0.75rem 0.5rem', gap: '0.3rem' }}
              onClick={() => setCurrentRole('CANDIDATE')}
            >
              <Monitor size={18} />
              <span style={{ fontSize: '0.8rem' }}>考生端</span>
            </button>
            <button 
              className={`btn ${currentRole === 'EXAMINER_1' ? 'btn-success' : 'btn-secondary'}`}
              style={{ flexDirection: 'column', padding: '0.75rem 0.5rem', gap: '0.3rem' }}
              onClick={() => setCurrentRole('EXAMINER_1')}
            >
              <UserCheck size={18} />
              <span style={{ fontSize: '0.8rem' }}>評審 1</span>
            </button>
            <button 
              className={`btn ${currentRole === 'EXAMINER_2' ? 'btn-success' : 'btn-secondary'}`}
              style={{ flexDirection: 'column', padding: '0.75rem 0.5rem', gap: '0.3rem' }}
              onClick={() => setCurrentRole('EXAMINER_2')}
            >
              <UserCheck size={18} />
              <span style={{ fontSize: '0.8rem' }}>評審 2</span>
            </button>
            <button 
              className={`btn ${currentRole === 'EXAMINER_3' ? 'btn-success' : 'btn-secondary'}`}
              style={{ flexDirection: 'column', padding: '0.75rem 0.5rem', gap: '0.3rem' }}
              onClick={() => setCurrentRole('EXAMINER_3')}
            >
              <UserCheck size={18} />
              <span style={{ fontSize: '0.8rem' }}>評審 3</span>
            </button>
          </div>
        </div>

        {/* Change Room Code Input */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input 
            type="text" 
            className="form-input" 
            placeholder="輸入考場房間號 (如 888999)"
            value={inputRoomId}
            onChange={e => setInputRoomId(e.target.value)}
          />
          <button className="btn btn-secondary" style={{ whiteSpace: 'nowrap' }} onClick={handleSwitchRoom}>
            加入考場
          </button>
        </div>

      </div>
    </div>
  );
}
