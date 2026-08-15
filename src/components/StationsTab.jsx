import { useEffect, useRef, useState } from 'react';
import { Camera, Plus, Pencil, Archive } from 'lucide-react';
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
          <h3>把紙本考題匯入</h3>
          <span className="hint">口試題官方不公開，這裡的來源是你手上的紙本</span>
        </div>

        <p className="muted" style={{ marginBottom: '0.9rem' }}>
          拍下考題或評分表（一題可以多張），系統只負責把紙上寫的抄進欄位，不會自己補內容。
          抄完一定會進編輯器等你逐項確認——臨床正確性由你背書，不由 AI 背書。
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

          <button type="button" className="btn" onClick={() => setEditing('new')}>
            <Plus size={16} />
            手動新增一題
          </button>
        </div>

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
