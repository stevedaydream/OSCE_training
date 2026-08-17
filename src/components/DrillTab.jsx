import { useEffect, useMemo, useState } from 'react';
import { Shuffle, Eye, ChevronRight, TrendingDown, Trash2 } from 'lucide-react';
import {
  DECK,
  GRADES,
  clearRecords,
  loadCard,
  loadRecords,
  missedThirdSlot,
  recordAttempt,
} from '../lib/drillDeck';

const SLOT_HINT = [
  { mark: '①', name: '最可能', ask: '寫出診斷，以及你的理由（引用情境裡的哪幾句）' },
  { mark: '②', name: '次可能', ask: '寫出診斷，以及**要出現什麼證據它才會翻上第一位**' },
  { mark: '③', name: '不能漏', ask: '漏掉會出事的那一個，以及**排除它的最低限度檢查**' },
];

function pickRandom(exceptPath) {
  const pool = DECK.length > 1 ? DECK.filter((entry) => entry.path !== exceptPath) : DECK;
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function DrillTab() {
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState(['', '', '']);
  const [revealed, setRevealed] = useState(false);
  const [grades, setGrades] = useState([null, null, null]);
  const [records, setRecords] = useState(() => loadRecords());

  async function draw(exceptPath) {
    setError('');
    setRevealed(false);
    setAnswers(['', '', '']);
    setGrades([null, null, null]);
    setCard(null);
    try {
      setCard(await loadCard(pickRandom(exceptPath)));
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => {
    draw();
    // 只在掛載時抽第一題。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const leaderboard = useMemo(() => missedThirdSlot(records), [records]);
  const totalAttempts = useMemo(
    () => Object.values(records).reduce((sum, row) => sum + (row.attempts ?? 0), 0),
    [records],
  );

  function reveal() {
    setRevealed(true);
  }

  function next() {
    // 有評過才記錄——只看答案不自評的那幾輪不該汙染統計。
    if (grades.some(Boolean) && card) {
      setRecords(recordAttempt(card.path, grades));
    }
    draw(card?.path);
  }

  return (
    <div className="page">
      <div className="card">
        <div className="card-title">
          <h3>推理速練</h3>
          <span className="hint">{DECK.length} 題　·　已練 {totalAttempts} 輪</span>
        </div>

        <p className="muted">
          看情境，把三格寫出來，再對答案自評。一輪兩三分鐘，練的是<strong>內容對不對</strong>，
          不是講得順不順。內容練熟了再去演練分頁用錄音練表達——
          <strong>內容還會錯的時候練口說，只會把錯的答案講得很流利。</strong>
        </p>

        <div className="notice notice-warn" style={{ marginTop: '0.8rem' }}>
          這套題目來自 <code>prompts/samples/stations/</code> 的 Prompt A 產出，
          <strong>臨床內容未經人工審核</strong>。對答案時請一併看「模型自己不確定的地方」那一段——
          那裡列的東西<strong>不要背</strong>，要自己查證或問資深同仁。
        </div>
      </div>

      {error && <div className="card"><div className="notice notice-danger">{error}</div></div>}

      {card && (
        <>
          <div className="card">
            <div className="card-title">
              <h3>情境</h3>
              <span className="hint">{card.code}　{card.label}</span>
            </div>
            <div className="door-block" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
              {card.scenario}
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <h3>你的三格</h3>
              <span className="hint">寫完再按對答案，不要偷看</span>
            </div>

            {SLOT_HINT.map((slot, index) => (
              <div key={slot.mark} style={{ marginBottom: '0.9rem' }}>
                <label className="muted" htmlFor={`slot-${index}`}>
                  <strong>{slot.mark} {slot.name}</strong>　·　{slot.ask.replace(/\*\*/g, '')}
                </label>
                <textarea
                  id={`slot-${index}`}
                  className="textarea"
                  rows={3}
                  value={answers[index]}
                  disabled={revealed}
                  onChange={(event) => {
                    const next = [...answers];
                    next[index] = event.target.value;
                    setAnswers(next);
                  }}
                  style={{ marginTop: '0.3rem' }}
                />
              </div>
            ))}

            {!revealed && (
              <button type="button" className="btn btn-primary" onClick={reveal}>
                <Eye size={16} />
                對答案
              </button>
            )}
          </div>

          {revealed && (
            <>
              <div className="card">
                <div className="card-title">
                  <h3>答案：{card.title}</h3>
                </div>
                <div className="prompt-preview" style={{ maxHeight: '30rem' }}>{card.section7}</div>
              </div>

              {card.section9 && (
                <div className="card">
                  <div className="card-title">
                    <h3>模型自己不確定的地方</h3>
                    <span className="hint">這裡列的不要背</span>
                  </div>
                  <div className="prompt-preview" style={{ maxHeight: '18rem' }}>{card.section9}</div>
                </div>
              )}

              <div className="card">
                <div className="card-title">
                  <h3>自評</h3>
                  <span className="hint">三格分別評，評完才會計入統計</span>
                </div>

                {SLOT_HINT.map((slot, index) => (
                  <div className="check-row" key={slot.mark} style={{ alignItems: 'center' }}>
                    <div className="check-body">
                      <strong>{slot.mark} {slot.name}</strong>
                      <div className="faint">{card.slots[index]?.name}</div>
                    </div>
                    <div className="score-levels">
                      {GRADES.map((grade) => (
                        <button
                          type="button"
                          key={grade.id}
                          className={`score-level ${grades[index] === grade.id ? `is-active ${grade.tone}` : ''}`}
                          onClick={() => {
                            const next = [...grades];
                            next[index] = grade.id;
                            setGrades(next);
                          }}
                        >
                          {grade.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="row" style={{ marginTop: '0.9rem' }}>
                  <button type="button" className="btn btn-primary" onClick={next}>
                    <ChevronRight size={16} />
                    下一題
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => draw(card.path)}>
                    <Shuffle size={16} />
                    跳過不計分
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {leaderboard.length > 0 && (
        <div className="card">
          <div className="card-title">
            <h3><TrendingDown size={16} /> 第三格常漏</h3>
            <span className="hint">「不能漏」那一格答不出來的題目</span>
          </div>

          <p className="muted" style={{ marginBottom: '0.7rem' }}>
            只統計第三格是刻意的。①②答錯多半是知識不足，多讀就好；
            <strong>③ 想不出來是思維習慣的問題</strong>——想不到「還有什麼漏掉會出事」，
            那才是這套題庫要練的東西。
          </p>

          {leaderboard.slice(0, 8).map((entry) => (
            <div className="check-row" key={entry.path} style={{ alignItems: 'center' }}>
              <span className="check-mark missed">{entry.missed}</span>
              <div className="check-body">
                <strong>{entry.code}　{entry.label}</strong>
                <div className="faint">練過 {entry.attempts} 輪</div>
              </div>
            </div>
          ))}

          <button
            type="button"
            className="btn btn-ghost"
            style={{ marginTop: '0.8rem' }}
            onClick={() => {
              clearRecords();
              setRecords({});
            }}
          >
            <Trash2 size={15} />
            清除速練紀錄
          </button>
        </div>
      )}
    </div>
  );
}
