import React, { useState } from 'react';
import { Sparkles, Camera, Edit3, Download, Upload, Plus, Trash2, CheckCircle2, Clock, HelpCircle, FileText, AlertTriangle, Layers, Image as ImageIcon } from 'lucide-react';
import { generateStationFromPrompt, parseStationFromImage } from '../../services/aiService';
import { exportStationToJSON, importStationFromJSON } from '../../services/exportService';

export default function StationGenerator({ stations, setStations, activeStation, setActiveStation, onStartExam }) {
  const [activeTab, setActiveTab] = useState('ai_prompt'); // 'ai_prompt' | 'image_ocr' | 'visual_editor'
  
  // AI Prompt Form state (Categorized by NP Specialty Department, Default: Surgical NP)
  const [aiPrompt, setAiPrompt] = useState('65歲男性 PPU 術後腹痛與呼吸喘評估');
  const [aiDepartment, setAiDepartment] = useState('外科專科護理師 (Surgical NP)');
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  // Image OCR state
  const [ocrImage, setOcrImage] = useState(null);
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);
  const [ocrError, setOcrError] = useState('');

  // Station Form State (Editing active station)
  const [editStation, setEditStation] = useState(activeStation);

  // Switch Active Station
  const handleSelectStation = (st) => {
    setActiveStation(st);
    setEditStation(st);
  };

  // AI Prompt Submit
  const handleAiGenerate = async (e) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;
    setIsGenerating(true);
    setAiError('');

    try {
      const newStation = await generateStationFromPrompt(aiPrompt, aiDepartment);
      setStations(prev => [newStation, ...prev]);
      setActiveStation(newStation);
      setEditStation(newStation);
      setActiveTab('visual_editor');
    } catch (err) {
      setAiError(err.message || 'AI 生成考題失敗');
    } finally {
      setIsGenerating(false);
    }
  };

  // Image File Upload & OCR
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const base64 = evt.target.result;
      setOcrImage(base64);
      setIsOcrProcessing(true);
      setOcrError('');

      try {
        const parsedStation = await parseStationFromImage(base64, file.type);
        setStations(prev => [parsedStation, ...prev]);
        setActiveStation(parsedStation);
        setEditStation(parsedStation);
        setActiveTab('visual_editor');
      } catch (err) {
        setOcrError(err.message || '圖片 OCR 解析失敗，請重試');
      } finally {
        setIsOcrProcessing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Save changes from Visual Editor
  const handleSaveEditor = () => {
    setStations(prev => prev.map(s => s.id === editStation.id ? editStation : s));
    setActiveStation(editStation);
    alert('考題與評分表已成功更新！');
  };

  // Add Rubric Item
  const handleAddRubricItem = () => {
    const newItem = {
      id: `r_${Date.now()}`,
      category: "焦點式健康評估",
      title: "新評分細項說明",
      maxPoints: 10,
      critical: false
    };
    setEditStation(prev => ({
      ...prev,
      rubricItems: [...(prev.rubricItems || []), newItem]
    }));
  };

  // Delete Rubric Item
  const handleDeleteRubricItem = (id) => {
    setEditStation(prev => ({
      ...prev,
      rubricItems: prev.rubricItems.filter(item => item.id !== id)
    }));
  };

  // Add Cue Card
  const handleAddCueCard = () => {
    const newCue = {
      id: `cue_${Date.now()}`,
      label: "提示：新試題 Cue Card",
      type: "text",
      title: "Clinical Cue Prompt",
      content: "【提示內容】請填寫口試委員發送給考生的提示文字",
      category: "Prompt"
    };
    setEditStation(prev => ({
      ...prev,
      cueCards: [...(prev.cueCards || []), newCue]
    }));
  };

  // Delete Cue Card
  const handleDeleteCueCard = (id) => {
    setEditStation(prev => ({
      ...prev,
      cueCards: prev.cueCards.filter(c => c.id !== id)
    }));
  };

  // Import JSON File
  const handleImportJSON = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const imported = await importStationFromJSON(file);
      if (!imported.id) imported.id = `imported_${Date.now()}`;
      setStations(prev => [imported, ...prev]);
      setActiveStation(imported);
      setEditStation(imported);
      setActiveTab('visual_editor');
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Station Selector Header */}
      <div className="glass-panel" style={{ padding: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="badge badge-purple" style={{ marginBottom: '0.4rem' }}>OSCE Station Manager</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>專科護理師甄審口試 題庫與評分表產生器</h2>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <Upload size={16} /> 匯入 JSON
              <input type="file" accept=".json" onChange={handleImportJSON} style={{ display: 'none' }} />
            </label>
            <button className="btn btn-secondary" onClick={() => exportStationToJSON(activeStation)}>
              <Download size={16} /> 導出當前考題 JSON
            </button>
            <button className="btn btn-success btn-lg" onClick={onStartExam}>
              <Clock size={18} /> 開始此站模擬口試 (15分鐘)
            </button>
          </div>
        </div>

        {/* Existing Stations List Pills */}
        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.25rem', overflowX: 'auto', paddingBottom: '0.4rem' }}>
          {stations.map(st => (
            <button
              key={st.id}
              onClick={() => handleSelectStation(st)}
              className={`glass-card ${activeStation.id === st.id ? 'active' : ''}`}
              style={{
                padding: '0.6rem 1rem',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                borderColor: activeStation.id === st.id ? 'var(--color-primary)' : 'var(--border-card)',
                background: activeStation.id === st.id ? 'rgba(56, 189, 248, 0.15)' : 'rgba(15, 23, 42, 0.5)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap'
              }}
            >
              <FileText size={16} color={activeStation.id === st.id ? '#38bdf8' : 'var(--text-muted)'} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{st.title}</span>
              <span className="badge badge-cyan" style={{ fontSize: '0.65rem' }}>{st.department || '外科專科護理師'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', borderBottom: '1px solid var(--border-card)', paddingBottom: '0.5rem' }}>
        <button 
          className={`btn ${activeTab === 'ai_prompt' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('ai_prompt')}
        >
          <Sparkles size={18} /> AI 語意一鍵生成試題
        </button>
        <button 
          className={`btn ${activeTab === 'image_ocr' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('image_ocr')}
        >
          <Camera size={18} /> 圖片 / 紙本考題 OCR 辨識匯入
        </button>
        <button 
          className={`btn ${activeTab === 'visual_editor' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => {
            setEditStation(activeStation);
            setActiveTab('visual_editor');
          }}
        >
          <Edit3 size={18} /> 視覺化評分表與試題編輯器
        </button>
      </div>

      {/* TAB 1: AI Prompt Generator */}
      {activeTab === 'ai_prompt' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.15)', padding: '0.75rem', borderRadius: '14px' }}>
              <Sparkles size={28} color="#38bdf8" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>AI 語意生成專科護理師國考題與評分表</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                一律符合衛福部國考標準（15分鐘全場，門前讀題2分鐘+考間口試13分鐘）。請選擇專科分科（預設外科專科護理師）。
              </p>
            </div>
          </div>

          <form onSubmit={handleAiGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">臨床案例主題描述</label>
              <textarea 
                className="form-textarea"
                rows={3}
                placeholder="例如：65歲男性 PPU 術後腹痛與呼吸喘評估、剖腹術後滲血與低血容休克、胸痛發作..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">專科護理師分科 (一律衛福部國考標準)</label>
                <select className="form-select" value={aiDepartment} onChange={e => setAiDepartment(e.target.value)}>
                  <option value="外科專科護理師 (Surgical NP)">外科專科護理師 (Surgical NP - 預設首選)</option>
                  <option value="內科專科護理師 (Internal Medicine NP)">內科專科護理師 (Internal Medicine NP)</option>
                  <option value="兒科專科護理師 (Pediatric NP)">兒科專科護理師 (Pediatric NP)</option>
                  <option value="婦產科專科護理師 (Ob-Gyn NP)">婦產科專科護理師 (Ob-Gyn NP)</option>
                  <option value="精神科專科護理師 (Psychiatric NP)">精神科專科護理師 (Psychiatric NP)</option>
                  <option value="麻醉科專科護理師 (Anesthesia NP)">麻醉科專科護理師 (Anesthesia NP)</option>
                </select>
              </div>

              <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary btn-lg" disabled={isGenerating} style={{ width: '100%' }}>
                  {isGenerating ? 'AI 正在生成專科護理師考題包...' : '✨ 立即 AI 生成考題包'}
                </button>
              </div>
            </div>

            {aiError && (
              <div style={{ padding: '0.75rem 1rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', color: '#fb7185', fontSize: '0.85rem' }}>
                <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.4rem' }} />
                {aiError}
              </div>
            )}
          </form>
        </div>
      )}

      {/* TAB 2: Image / Photo OCR Import */}
      {activeTab === 'image_ocr' && (
        <div className="glass-panel" style={{ padding: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.15)', padding: '0.75rem', borderRadius: '14px' }}>
              <Camera size={28} color="#10b981" />
            </div>
            <div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 700 }}>圖片 / 紙本評分表照片 OCR 辨識匯入</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                拍攝或上傳專科護理師紙本 OSCE 考題、評分表照片，Vision API 將精準辨識並轉為數位考題與評分項目。
              </p>
            </div>
          </div>

          <div style={{ border: '2px dashed var(--border-glass-glow)', borderRadius: 'var(--radius-xl)', padding: '2.5rem', textAlign: 'center', background: 'rgba(15, 23, 42, 0.4)' }}>
            {ocrImage ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <img src={ocrImage} alt="Uploaded OSCE Rubric" style={{ maxHeight: '240px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }} />
                {isOcrProcessing ? (
                  <p style={{ color: '#38bdf8', fontWeight: 600 }}>🔍 Vision API 正在辨識專科護理師紙本文字與評分細項...</p>
                ) : (
                  <p style={{ color: '#34d399' }}>✅ 辨識完成！已自動切換至視覺化編輯器。</p>
                )}
              </div>
            ) : (
              <label style={{ cursor: 'pointer', display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                <ImageIcon size={48} color="#38bdf8" />
                <div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 700, display: 'block' }}>點擊選擇或拖曳專科護理師考題照片上傳</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>支援 JPG, PNG, WEBP 照片</span>
                </div>
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
              </label>
            )}
          </div>

          {ocrError && (
            <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', color: '#fb7185' }}>
              {ocrError}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Visual Station & Rubric Editor */}
      {activeTab === 'visual_editor' && editStation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Basic Info & Timing */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={20} /> 1. 考題基本資訊與計時維護
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">考題名稱</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editStation.title || ''} 
                  onChange={e => setEditStation({ ...editStation, title: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">專科護理師分科</label>
                <select 
                  className="form-select" 
                  value={editStation.department || '外科專科護理師 (Surgical NP)'} 
                  onChange={e => setEditStation({ ...editStation, department: e.target.value })}
                >
                  <option value="外科專科護理師 (Surgical NP)">外科專科護理師 (Surgical NP)</option>
                  <option value="內科專科護理師 (Internal Medicine NP)">內科專科護理師 (Internal Medicine NP)</option>
                  <option value="兒科專科護理師 (Pediatric NP)">兒科專科護理師 (Pediatric NP)</option>
                  <option value="婦產科專科護理師 (Ob-Gyn NP)">婦產科專科護理師 (Ob-Gyn NP)</option>
                  <option value="精神科專科護理師 (Psychiatric NP)">精神科專科護理師 (Psychiatric NP)</option>
                  <option value="麻醉科專科護理師 (Anesthesia NP)">麻醉科專科護理師 (Anesthesia NP)</option>
                </select>
              </div>
            </div>

            {/* Timing controls using Minute Selectors */}
            <div style={{ marginTop: '0.75rem', padding: '1.25rem', background: 'rgba(15, 23, 42, 0.7)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-card)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <span className="form-label" style={{ color: '#38bdf8', fontWeight: 700 }}>
                  <Clock size={16} /> 考場階段時間維護 (分鐘選擇器)
                </span>
                <span className="badge badge-purple" style={{ fontSize: '0.8rem' }}>
                  甄審總計：{Math.round(((editStation.timing?.readingSeconds || 120) + (editStation.timing?.examSeconds || 780)) / 60)} 分鐘
                  （門前 {Math.round((editStation.timing?.readingSeconds || 120)/60)} 分鐘 + 考間 {Math.round((editStation.timing?.examSeconds || 780)/60)} 分鐘）
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">門前閱讀時間 (分鐘)</label>
                  <select 
                    className="form-select mono-nums"
                    value={Math.round((editStation.timing?.readingSeconds || 120) / 60)}
                    onChange={e => {
                      const mins = parseFloat(e.target.value) || 2;
                      setEditStation({
                        ...editStation,
                        timing: { ...editStation.timing, readingSeconds: Math.round(mins * 60) }
                      });
                    }}
                  >
                    <option value="1">1 分鐘</option>
                    <option value="2">2 分鐘 (衛福部國考門前標準)</option>
                    <option value="3">3 分鐘</option>
                    <option value="5">5 分鐘</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">考間口試作答時間 (分鐘)</label>
                  <select 
                    className="form-select mono-nums"
                    value={Math.round((editStation.timing?.examSeconds || 780) / 60)}
                    onChange={e => {
                      const mins = parseFloat(e.target.value) || 13;
                      setEditStation({
                        ...editStation,
                        timing: { ...editStation.timing, examSeconds: Math.round(mins * 60) }
                      });
                    }}
                  >
                    <option value="8">8 分鐘 (經典簡短)</option>
                    <option value="10">10 分鐘</option>
                    <option value="13">13 分鐘 (衛福部甄審口試標準)</option>
                    <option value="15">15 分鐘</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">換場講評時間 (分鐘)</label>
                  <select 
                    className="form-select mono-nums"
                    value={Math.round((editStation.timing?.feedbackSeconds || 120) / 60)}
                    onChange={e => {
                      const mins = parseFloat(e.target.value) || 2;
                      setEditStation({
                        ...editStation,
                        timing: { ...editStation.timing, feedbackSeconds: Math.round(mins * 60) }
                      });
                    }}
                  >
                    <option value="1">1 分鐘</option>
                    <option value="2">2 分鐘 (標準講評)</option>
                    <option value="3">3 分鐘</option>
                    <option value="5">5 分鐘</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Candidate & Examiner Instructions */}
            <div className="grid-2" style={{ marginTop: '1rem' }}>
              <div className="form-group">
                <label className="form-label">門前試題貼紙與主訴 (Candidate Situation)</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  value={editStation.candidateInfo?.situation || ''} 
                  onChange={e => setEditStation({
                    ...editStation,
                    candidateInfo: { ...editStation.candidateInfo, situation: e.target.value }
                  })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">口試委員指南與 SP 演員指引 (Examiner Overview)</label>
                <textarea 
                  className="form-textarea" 
                  rows={3} 
                  value={editStation.examinerGuide?.overview || ''} 
                  onChange={e => setEditStation({
                    ...editStation,
                    examinerGuide: { ...editStation.examinerGuide, overview: e.target.value }
                  })}
                />
              </div>
            </div>
          </div>

          {/* Cue Cards Section */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={20} /> 2. 口試委員舉牌提示卡維護 (Cue Cards)
              </h3>
              <button className="btn btn-secondary" onClick={handleAddCueCard}>
                <Plus size={16} /> 新增 Cue Card
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {editStation.cueCards?.map((cue, idx) => (
                <div key={cue.id} className="glass-card" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <span className="badge badge-rose" style={{ marginTop: '0.5rem' }}>Card #{idx+1}</span>
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1.5fr 3fr', gap: '0.75rem' }}>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="評審按鈕標籤"
                      value={cue.label || ''} 
                      onChange={e => {
                        const updated = [...editStation.cueCards];
                        updated[idx].label = e.target.value;
                        setEditStation({ ...editStation, cueCards: updated });
                      }}
                    />
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="考生螢幕彈出的提示內容"
                      value={cue.content || ''} 
                      onChange={e => {
                        const updated = [...editStation.cueCards];
                        updated[idx].content = e.target.value;
                        setEditStation({ ...editStation, cueCards: updated });
                      }}
                    />
                  </div>
                  <button className="btn btn-danger" style={{ padding: '0.5rem' }} onClick={() => handleDeleteCueCard(cue.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Rubric Items Checklist Editor */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#34d399', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} /> 3. 評分表細項 Checklist (配分與關鍵扣分點)
              </h3>
              <button className="btn btn-secondary" onClick={handleAddRubricItem}>
                <Plus size={16} /> 新增評分細項
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {editStation.rubricItems?.map((rub, idx) => (
                <div key={rub.id} className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1.2fr 3fr 1fr 1fr auto', gap: '0.75rem', alignItems: 'center' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="領域 (如焦點式訪談)"
                    value={rub.category || ''} 
                    onChange={e => {
                      const updated = [...editStation.rubricItems];
                      updated[idx].category = e.target.value;
                      setEditStation({ ...editStation, rubricItems: updated });
                    }}
                  />
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="評分項目名稱與規範"
                    value={rub.title || ''} 
                    onChange={e => {
                      const updated = [...editStation.rubricItems];
                      updated[idx].title = e.target.value;
                      setEditStation({ ...editStation, rubricItems: updated });
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>配分:</span>
                    <input 
                      type="number" 
                      className="form-input mono-nums" 
                      style={{ width: '70px' }}
                      value={rub.maxPoints || 10} 
                      onChange={e => {
                        const updated = [...editStation.rubricItems];
                        updated[idx].maxPoints = parseInt(e.target.value) || 0;
                        setEditStation({ ...editStation, rubricItems: updated });
                      }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox" 
                      checked={!!rub.critical} 
                      onChange={e => {
                        const updated = [...editStation.rubricItems];
                        updated[idx].critical = e.target.checked;
                        setEditStation({ ...editStation, rubricItems: updated });
                      }}
                    />
                    <span style={{ color: rub.critical ? '#f43f5e' : 'var(--text-muted)', fontWeight: rub.critical ? 700 : 400 }}>
                      關鍵扣分項
                    </span>
                  </label>
                  <button className="btn btn-danger" style={{ padding: '0.5rem' }} onClick={() => handleDeleteRubricItem(rub.id)}>
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary btn-lg" onClick={handleSaveEditor}>
                儲存評分表設定
              </button>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
