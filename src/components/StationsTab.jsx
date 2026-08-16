import { useEffect, useRef, useState } from 'react';
import { Camera, Plus, Pencil, Archive, ClipboardPaste } from 'lucide-react';
import { supabase, callFunction } from '../lib/supabase';
import { DEPARTMENT_NAME } from '../lib/constants';
import StationEditor from './StationEditor';
import { draftToStation } from '../lib/stationDraft';

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function StationsTab() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [pasting, setPasting] = useState(false);
  const [pastedJson, setPastedJson] = useState('');
  const fileInput = useRef(null);

  async function load() {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('stations')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    setStations(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleImport(event) {
    const files = [...(event.target.files ?? [])];
    event.target.value = '';
    if (!files.length) return;

    setImporting(true);
    setError('');

    try {
      const images = await Promise.all(
        files.map(async (file) => ({
          data: await fileToBase64(file),
          mimeType: file.type || 'image/jpeg',
        })),
      );

      const draft = await callFunction('ocr-station', { body: { images } });
      // 一律進編輯器讓她逐項確認，不會直接寫進題庫。
      setEditing(draftToStation(draft));
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  /**
   * 貼上 Prompt B 產出的 station JSON。
   *
   * 走這條路的題目來源是 AI（情境 → Prompt A 推理文件 → 人工審核 → Prompt B → 這裡），
   * 所以 source 預設為 'ai'，與紙本 OCR 的 'ocr' 分開——紙本題的臨床內容有書背書，這一份沒有。
   * 規矩與 OCR 相同：一律進編輯器逐項確認，不直接寫進題庫。
   */
  function handlePasteImport() {
    // 模型很常在 JSON 外面包一層 ``` 圍欄，即使 prompt 說了不要。這裡直接容忍掉。
    const text = pastedJson
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();

    if (!text) return;
    setError('');

    let draft;
    try {
      draft = JSON.parse(text);
    } catch {
      setError('這不是有效的 JSON。請確認你貼的是 Prompt B 輸出的整段 { … }，前後沒有多複製到說明文字。');
      return;
    }

    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      setError('解析成功但最外層不是一個物件。Prompt B 的輸出應該長成 { "title": …, "doorSheet": … } 這樣。');
      return;
    }

    setEditing(draftToStation({ ...draft, source: draft.source ?? 'ai' }));
    setPastedJson('');
    setPasting(false);
  }

  async function archive(station) {
    await supabase.from('stations').update({ archived: true }).eq('id', station.id);
    load();
  }

  if (editing) {
    return (
      <StationEditor
        initial={editing === 'new' ? null : editing}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-title">
          <h3>把考題匯入</h3>
          <span className="hint">口試題官方不公開，來源是你手上的紙本或自製題</span>
        </div>

        <p className="muted" style={{ marginBottom: '0.9rem' }}>
          <strong>拍照</strong>：拍下考題或評分表（一題可以多張），系統只負責把紙上寫的抄進欄位，不會自己補內容。
          <br />
          <strong>貼上 JSON</strong>：從情境自製的題目（見 <code>prompts/</code> 的兩段式流程）。
          <br />
          兩條路都一定會進編輯器等你逐項確認——臨床正確性由你背書，不由 AI 背書。
        </p>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={handleImport}
        />

        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={importing}
            onClick={() => fileInput.current?.click()}
          >
            <Camera size={16} />
            {importing ? '辨識中…' : '拍照／選圖匯入'}
          </button>

          <button
            type="button"
            className="btn"
            onClick={() => {
              setPasting((open) => !open);
              setError('');
            }}
          >
            <ClipboardPaste size={16} />
            貼上 JSON 匯入
          </button>

          <button type="button" className="btn" onClick={() => setEditing('new')}>
            <Plus size={16} />
            手動新增一題
          </button>
        </div>

        {pasting && (
          <div style={{ marginTop: '0.9rem' }}>
            <p className="muted" style={{ marginBottom: '0.5rem' }}>
              貼上 <code>prompts/B_reasoning-to-station.md</code> 產出的整段 JSON。
              來源會標成「AI 生成」，與紙本 OCR 分開——<strong>紙本題的臨床內容有書背書，這一份沒有</strong>。
              一樣會進編輯器等你逐項確認。
            </p>
            <textarea
              className="textarea"
              rows={10}
              value={pastedJson}
              placeholder={'{\n  "title": "…",\n  "doorSheet": { … },\n  "cueCards": [ … ],\n  "rubricItems": [ … ]\n}'}
              onChange={(event) => setPastedJson(event.target.value)}
            />
            <div className="row" style={{ marginTop: '0.6rem' }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!pastedJson.trim()}
                onClick={handlePasteImport}
              >
                解析並開啟編輯器
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setPasting(false);
                  setPastedJson('');
                  setError('');
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {error && <div className="notice notice-danger" style={{ marginTop: '0.9rem' }}>{error}</div>}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>題庫</h3>
          <span className="hint">{stations.length} 題</span>
        </div>

        {loading && <p className="muted">載入中…</p>}

        {!loading && stations.length === 0 && (
          <p className="muted">還沒有題目。先匯入一題再開始練。</p>
        )}

        {stations.map((station) => (
          <div className="check-row" key={station.id} style={{ alignItems: 'center', gap: '0.9rem' }}>
            <div className="check-body">
              <strong>{station.title}</strong>
              <div className="row" style={{ gap: '0.4rem', marginTop: '0.3rem' }}>
                <span className="pill">{DEPARTMENT_NAME[station.department] ?? station.department}</span>
                <span className={`pill ${station.reviewed ? 'pill-ok' : 'pill-warn'}`}>
                  {station.reviewed ? '已審核' : '未審核'}
                </span>
                <span className="pill">
                  {{ manual: '手動建立', ocr: 'OCR 匯入', ai: 'AI 生成' }[station.source] ?? station.source}
                </span>
                <span className="pill">{(station.rubric_items ?? []).length} 個評分項</span>
                <span className="pill">{(station.cue_cards ?? []).length} 張提示卡</span>
              </div>
            </div>

            <button type="button" className="btn" onClick={() => setEditing(station)}>
              <Pencil size={15} />
              編輯
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => archive(station)}>
              <Archive size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
