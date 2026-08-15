import { useEffect, useMemo, useState } from 'react';
import { Play, AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { generateJoinCode } from '../lib/realtime';
import { DEPARTMENT_NAME, timingRuleFor } from '../lib/constants';
import { primeAudio } from '../lib/sound';
import { isRecordingSupported } from '../lib/audio';
import { isSpeechSupported } from '../lib/speech';
import PracticeRunner from './PracticeRunner';

export default function PracticeTab() {
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stationId, setStationId] = useState('');
  const [practiceKind, setPracticeKind] = useState('solo');
  const [mode, setMode] = useState('full');
  const [segmentCategory, setSegmentCategory] = useState('');
  const [segmentMinutes, setSegmentMinutes] = useState(5);
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('stations')
      .select('*')
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (loadError) setError(loadError.message);
        setStations(data ?? []);
        if (data?.length) setStationId(data[0].id);
        setLoading(false);
      });
  }, []);

  const station = useMemo(
    () => stations.find((item) => item.id === stationId),
    [stations, stationId],
  );

  // 片段特訓的段落直接取自這一題評分表的分類，換題就換段，不寫死流程。
  const categories = useMemo(() => {
    const list = (station?.rubric_items ?? []).map((item) => item.category).filter(Boolean);
    return [...new Set(list)];
  }, [station]);

  useEffect(() => {
    setSegmentCategory(categories[0] ?? '');
  }, [categories]);

  async function startSession() {
    setError('');
    if (!station) return;

    // 必須在使用者手勢裡喚醒音訊，否則之後的鈴聲會被瀏覽器擋掉。
    primeAudio();

    const rule = timingRuleFor(station.department);
    const timing = {
      readingSeconds: station.timing?.readingSeconds ?? rule.readingSeconds,
      examSeconds:
        mode === 'segment'
          ? Math.max(60, Math.round(segmentMinutes * 60))
          : station.timing?.examSeconds ?? rule.examSeconds,
      alertSeconds: station.timing?.alertSeconds ?? rule.alertSeconds,
    };

    const { data: userData } = await supabase.auth.getUser();
    const joinCode = generateJoinCode();

    const { data, error: insertError } = await supabase
      .from('sessions')
      .insert({
        owner_id: userData.user.id,
        station_id: station.id,
        station_snapshot: { ...station, timing },
        mode,
        segment_category: mode === 'segment' ? segmentCategory : null,
        practice_kind: practiceKind,
        join_code: joinCode,
        status: 'waiting',
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSession(data);
  }

  if (session) {
    return <PracticeRunner session={session} onExit={() => setSession(null)} />;
  }

  if (loading) return <div className="page empty">載入題庫中…</div>;

  if (!stations.length) {
    return (
      <div className="page page-narrow">
        <div className="card">
          <div className="card-title">
            <AlertTriangle size={18} color="#fbbf24" />
            <h3>題庫是空的</h3>
          </div>
          <p className="muted">
            先到「題庫」分頁把手上的紙本考題拍照匯入，或手動建一題，才能開始演練。
          </p>
        </div>
      </div>
    );
  }

  const rule = station ? timingRuleFor(station.department) : null;

  return (
    <div className="page page-narrow">
      {error && <div className="notice notice-danger" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div className="card">
        <div className="card-title">
          <h3>這一場練什麼</h3>
        </div>

        <label className="field">
          <span>考題</span>
          <select
            className="select"
            value={stationId}
            onChange={(event) => setStationId(event.target.value)}
          >
            {stations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.reviewed ? '' : '［未審核］'}
                {DEPARTMENT_NAME[item.department] ?? item.department}｜{item.title}
              </option>
            ))}
          </select>
        </label>

        {station && !station.reviewed && (
          <div className="notice notice-warn">
            這一題還沒有人審核過臨床內容。建議先到題庫分頁確認過再拿來練——
            練到錯的東西比沒練更糟。
          </div>
        )}

        <label className="field" style={{ marginTop: '0.9rem' }}>
          <span>陪練狀況</span>
          <select
            className="select"
            value={practiceKind}
            onChange={(event) => setPracticeKind(event.target.value)}
          >
            <option value="solo">自己練（提示卡鎖住，靠語音關鍵詞解鎖）</option>
            <option value="coached">有人陪練（提示卡由考官端推送）</option>
          </select>
        </label>

        <label className="field">
          <span>模式</span>
          <select
            className="select"
            value={mode}
            onChange={(event) => setMode(event.target.value)}
          >
            <option value="full">完整演練</option>
            <option value="segment" disabled={!categories.length}>
              片段特訓{categories.length ? '' : '（本題評分表沒有分類，無法切段）'}
            </option>
          </select>
        </label>

        {mode === 'segment' && (
          <div className="grid-2">
            <label className="field">
              <span>練哪一段</span>
              <select
                className="select"
                value={segmentCategory}
                onChange={(event) => setSegmentCategory(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>時長（分鐘）</span>
              <input
                className="input"
                type="number"
                min="1"
                max="15"
                value={segmentMinutes}
                onChange={(event) => setSegmentMinutes(Number(event.target.value))}
              />
            </label>
          </div>
        )}

        {rule && mode === 'full' && (
          <div className="notice">
            <strong>{DEPARTMENT_NAME[station.department]}：{rule.label}</strong>
            <br />
            {rule.basis}
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          style={{ marginTop: '1rem' }}
          onClick={startSession}
        >
          <Play size={18} />
          建立這一場
        </button>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>這台裝置的能力檢查</h3>
        </div>
        <p className="muted">
          錄音：{isRecordingSupported() ? '可用' : '不支援，這台裝置無法錄音'}
          <br />
          語音關鍵詞解鎖：
          {isSpeechSupported()
            ? '可用（Chrome 的中文辨識不保證準，手動解鎖永遠是後備）'
            : '不支援，自練時請用手動解鎖'}
        </p>
      </div>
    </div>
  );
}
