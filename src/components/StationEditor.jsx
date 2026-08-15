import { useState } from 'react';
import { Plus, Trash2, Save, ArrowLeft, ListChecks, Wand2 } from 'lucide-react';
import { supabase, callFunction } from '../lib/supabase';
import { DEPARTMENTS, RUBRIC_SKELETON, timingRuleFor } from '../lib/constants';
import { emptyStation } from '../lib/stationDraft';

export default function StationEditor({ initial, onSaved, onCancel }) {
  const [station, setStation] = useState(() => initial ?? emptyStation());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deriving, setDeriving] = useState(false);
  const [deriveNotes, setDeriveNotes] = useState([]);

  const unreadable = station.unreadable ?? [];
  const rule = timingRuleFor(station.department);

  function set(path, value) {
    setStation((prev) => {
      if (path.length === 1) return { ...prev, [path[0]]: value };
      const [head, key] = path;
      return { ...prev, [head]: { ...prev[head], [key]: value } };
    });
  }

  function setDepartment(department) {
    const nextRule = timingRuleFor(department);
    setStation((prev) => ({ ...prev, department, timing: { ...nextRule } }));
  }

  function updateList(key, index, patch) {
    setStation((prev) => ({
      ...prev,
      [key]: prev[key].map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function addItem(key, item) {
    setStation((prev) => ({ ...prev, [key]: [...prev[key], item] }));
  }

  function removeItem(key, index) {
    setStation((prev) => ({ ...prev, [key]: prev[key].filter((_, i) => i !== index) }));
  }

  /** 零 AI：直接套用公告四大能力的分類，讓片段特訓至少切得出段落。 */
  function applySkeleton() {
    setDeriveNotes([]);
    setStation((prev) => ({
      ...prev,
      rubric_items: [
        ...prev.rubric_items,
        ...RUBRIC_SKELETON.map((item, index) => ({
          ...item,
          id: `r_${prev.rubric_items.length + index + 1}`,
        })),
      ],
    }));
  }

  /**
   * 把這一題已經有的內容重組成評分項。
   * 重組不是發明——每一條都會附上它依據的原文片段供核對。
   */
  async function deriveRubric() {
    setDeriving(true);
    setError('');
    setDeriveNotes([]);

    try {
      const result = await callFunction('derive-rubric', {
        body: {
          title: station.title,
          department: station.department,
          doorSheet: station.door_sheet,
          examinerGuide: station.examiner_guide,
          cueCards: station.cue_cards,
        },
      });

      const derived = (result.rubricItems ?? []).map((item, index) => ({
        id: `r_${station.rubric_items.length + index + 1}`,
        category: item.category ?? '',
        title: item.basis ? `${item.title}　【依據：${item.basis}】` : (item.title ?? ''),
        maxPoints: item.maxPoints ?? null,
        critical: Boolean(item.critical),
      }));

      if (derived.length === 0) {
        setError('這一題的內容不足以重組出任何評分項，請改用四大分類骨架或自己新增。');
      }

      setStation((prev) => ({ ...prev, rubric_items: [...prev.rubric_items, ...derived] }));
      setDeriveNotes(result.notes ?? []);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeriving(false);
    }
  }

  async function save() {
    setSaving(true);
    setError('');

    const { data: userData } = await supabase.auth.getUser();
    const payload = {
      owner_id: userData.user.id,
      title: station.title,
      department: station.department,
      source: station.source,
      reviewed: station.reviewed,
      door_sheet: station.door_sheet,
      examiner_guide: station.examiner_guide,
      cue_cards: station.cue_cards,
      rubric_items: station.rubric_items,
      timing: {
        readingSeconds: Number(station.timing.readingSeconds),
        examSeconds: Number(station.timing.examSeconds),
        alertSeconds: Number(station.timing.alertSeconds),
      },
    };

    const query = station.id
      ? supabase.from('stations').update(payload).eq('id', station.id)
      : supabase.from('stations').insert(payload);

    const { error: saveError } = await query;
    setSaving(false);

    if (saveError) setError(saveError.message);
    else onSaved();
  }

  return (
    <div className="page page-narrow">
      <button type="button" className="btn btn-ghost" onClick={onCancel} style={{ marginBottom: '1rem' }}>
        <ArrowLeft size={16} />
        取消
      </button>

      {unreadable.length > 0 && (
        <div className="notice notice-warn" style={{ marginBottom: '1rem' }}>
          <strong>OCR 讀不出來、需要你補的部分：</strong>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
            {unreadable.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      )}

      <div className="card">
        <div className="card-title"><h3>基本資料</h3></div>

        <label className="field">
          <span>考題名稱</span>
          <input
            className="input"
            value={station.title}
            onChange={(event) => set(['title'], event.target.value)}
          />
        </label>

        <label className="field">
          <span>分科</span>
          <select
            className="select"
            value={station.department}
            onChange={(event) => setDepartment(event.target.value)}
          >
            {DEPARTMENTS.map((dept) => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>
        </label>

        <div className="notice">{rule.label}<br />{rule.basis}</div>

        <div className="grid-2" style={{ marginTop: '0.9rem' }}>
          <label className="field">
            <span>門前閱讀（秒）</span>
            <input
              className="input"
              type="number"
              value={station.timing.readingSeconds}
              onChange={(event) => set(['timing', 'readingSeconds'], event.target.value)}
            />
          </label>
          <label className="field">
            <span>考間口試（秒）</span>
            <input
              className="input"
              type="number"
              value={station.timing.examSeconds}
              onChange={(event) => set(['timing', 'examSeconds'], event.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>門前貼紙</h3>
          <span className="hint">貼在門上那張 A4 上會出現的全部內容</span>
        </div>

        <label className="field">
          <span>病人基本資料</span>
          <input
            className="input"
            value={station.door_sheet.patient ?? ''}
            onChange={(event) => set(['door_sheet', 'patient'], event.target.value)}
          />
        </label>
        <label className="field">
          <span>主訴</span>
          <input
            className="input"
            value={station.door_sheet.chiefComplaint ?? ''}
            onChange={(event) => set(['door_sheet', 'chiefComplaint'], event.target.value)}
          />
        </label>
        <label className="field">
          <span>生命徵象</span>
          <input
            className="input"
            value={station.door_sheet.vitalSigns ?? ''}
            onChange={(event) => set(['door_sheet', 'vitalSigns'], event.target.value)}
          />
        </label>
        <label className="field">
          <span>考生任務</span>
          <textarea
            className="textarea"
            value={station.door_sheet.task ?? ''}
            onChange={(event) => set(['door_sheet', 'task'], event.target.value)}
          />
        </label>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>提示卡</h3>
          <span className="hint">觸發詞是自練時語音解鎖用的，臨床內容不受影響</span>
        </div>

        {station.cue_cards.map((cue, index) => (
          <div key={cue.id ?? index} className="card" style={{ background: 'var(--bg)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>提示卡 {index + 1}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => removeItem('cue_cards', index)}>
                <Trash2 size={15} />
              </button>
            </div>

            <label className="field">
              <span>名稱（考官端看到的按鈕文字）</span>
              <input
                className="input"
                value={cue.label ?? ''}
                onChange={(event) => updateList('cue_cards', index, { label: event.target.value })}
              />
            </label>
            <label className="field">
              <span>內容（考生看到的檢查發現）</span>
              <textarea
                className="textarea"
                value={cue.content ?? ''}
                onChange={(event) => updateList('cue_cards', index, { content: event.target.value })}
              />
            </label>
            <div className="grid-2">
              <label className="field">
                <span>對應的身體檢查項目</span>
                <input
                  className="input"
                  value={cue.peItem ?? ''}
                  onChange={(event) => updateList('cue_cards', index, { peItem: event.target.value })}
                />
              </label>
              <label className="field">
                <span>語音觸發詞（逗號分隔）</span>
                <input
                  className="input"
                  value={(cue.triggerKeywords ?? []).join('、')}
                  onChange={(event) =>
                    updateList('cue_cards', index, {
                      triggerKeywords: event.target.value
                        .split(/[、,，]/)
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </label>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="btn"
          onClick={() =>
            addItem('cue_cards', {
              id: `cue_${station.cue_cards.length + 1}`,
              label: '',
              title: '',
              content: '',
              category: '',
              peItem: '',
              triggerKeywords: [],
            })
          }
        >
          <Plus size={15} />
          新增提示卡
        </button>
      </div>

      <div className="card">
        <div className="card-title">
          <h3>評分表</h3>
          <span className="hint">分類同時決定片段特訓能切出哪幾段</span>
        </div>

        {station.rubric_items.length === 0 && (
          <div className="notice notice-warn" style={{ marginBottom: '0.9rem' }}>
            這一題沒有評分表。多數教學案例與回憶版本來就不附評分表，OCR 也不會替你發明一份。
            但沒有評分表就<strong>無法用片段特訓、陪練也無法評分</strong>，報告只會有通用骨架那一層。
          </div>
        )}

        <div className="row" style={{ marginBottom: '0.9rem' }}>
          <button type="button" className="btn" onClick={applySkeleton}>
            <ListChecks size={15} />
            套用公告四大分類骨架
          </button>
          <button type="button" className="btn" disabled={deriving} onClick={deriveRubric}>
            <Wand2 size={15} />
            {deriving ? '重組中…' : '由本題內容產生草稿'}
          </button>
        </div>

        <p className="faint" style={{ marginBottom: '1rem' }}>
          左邊那顆是純文字骨架，措辭直接取自公告，零 AI 推論。
          右邊那顆會把這一題已經抄進來的問診內容、身評發現與診斷重點重組成評分項，
          並在每條後面附上它依據的原文供你核對——它只能重組，不會發明教案裡沒有的東西。
        </p>

        {deriveNotes.length > 0 && (
          <div className="notice" style={{ marginBottom: '1rem' }}>
            <strong>重組時發現的內容缺口：</strong>
            <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.1rem' }}>
              {deriveNotes.map((note, index) => <li key={index}>{note}</li>)}
            </ul>
          </div>
        )}

        {station.rubric_items.map((item, index) => (
          <div key={item.id ?? index} className="card" style={{ background: 'var(--bg)' }}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <strong>項目 {index + 1}</strong>
              <button type="button" className="btn btn-ghost" onClick={() => removeItem('rubric_items', index)}>
                <Trash2 size={15} />
              </button>
            </div>
            <div className="grid-2">
              <label className="field">
                <span>分類</span>
                <input
                  className="input"
                  value={item.category ?? ''}
                  onChange={(event) => updateList('rubric_items', index, { category: event.target.value })}
                />
              </label>
              <label className="field">
                <span>配分（公告未規定，照紙本填）</span>
                <input
                  className="input"
                  type="number"
                  value={item.maxPoints ?? ''}
                  onChange={(event) =>
                    updateList('rubric_items', index, {
                      maxPoints: event.target.value === '' ? null : Number(event.target.value),
                    })
                  }
                />
              </label>
            </div>
            <label className="field">
              <span>細項描述</span>
              <input
                className="input"
                value={item.title ?? ''}
                onChange={(event) => updateList('rubric_items', index, { title: event.target.value })}
              />
            </label>
          </div>
        ))}

        <button
          type="button"
          className="btn"
          onClick={() =>
            addItem('rubric_items', {
              id: `r_${station.rubric_items.length + 1}`,
              category: '',
              title: '',
              maxPoints: null,
              critical: false,
            })
          }
        >
          <Plus size={15} />
          新增評分項目
        </button>
      </div>

      <div className="card">
        <label className="row" style={{ alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={station.reviewed}
            onChange={(event) => set(['reviewed'], event.target.checked)}
          />
          <span>
            <strong>我已逐項確認過這題的臨床內容</strong>
            <br />
            <span className="faint">
              未勾選的題目在演練前會跳警告。AI 與 OCR 產出的內容沒有人背書，勾了就是你背書。
            </span>
          </span>
        </label>
      </div>

      {error && <div className="notice notice-danger">{error}</div>}

      <button
        type="button"
        className="btn btn-primary btn-lg btn-block"
        disabled={saving || !station.title.trim()}
        onClick={save}
      >
        <Save size={17} />
        {saving ? '儲存中…' : '儲存題目'}
      </button>
    </div>
  );
}
