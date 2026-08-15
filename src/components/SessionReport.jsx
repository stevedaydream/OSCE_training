import { useMemo } from 'react';
import { ArrowLeft, Info } from 'lucide-react';
import { CORE_CHECKLIST, CORE_CATEGORIES, PASSING_SCORE } from '../lib/constants';
import { formatScore, humanDuration, mmss, officialAverage } from '../lib/format';

function CheckRow({ label, met, evidence, note, atSeconds }) {
  return (
    <div className="check-row">
      <span className={`check-mark ${met ? 'met' : 'missed'}`}>{met ? '✓' : '✕'}</span>
      <div className="check-body">
        <strong>{label}</strong>
        {typeof atSeconds === 'number' && atSeconds >= 0 && (
          <span className="faint">　{mmss(atSeconds)}</span>
        )}
        {evidence && <div className="check-evidence">「{evidence}」</div>}
        {note && !met && <div className="faint" style={{ marginTop: '0.2rem' }}>{note}</div>}
      </div>
    </div>
  );
}

export default function SessionReport({ session, onBack }) {
  const analysis = session.analysis ?? {};
  const station = session.station_snapshot ?? {};

  const coreByCategory = useMemo(() => {
    const results = new Map((analysis.coreChecks ?? []).map((c) => [c.key, c]));
    return CORE_CATEGORIES.map((category) => ({
      category,
      items: CORE_CHECKLIST.filter((c) => c.category === category).map((c) => ({
        ...c,
        result: results.get(c.key),
      })),
    }));
  }, [analysis.coreChecks]);

  const coreMet = (analysis.coreChecks ?? []).filter((c) => c.met).length;
  const coreTotal = CORE_CHECKLIST.length;

  const sayDo = analysis.sayDoFindings ?? [];
  const sayDoComplete = sayDo.filter(
    (f) => f.statedPurpose && f.statedItem && f.statedSite,
  ).length;

  const scores = session.examiner_scores ?? [];
  const officialScore = scores.length
    ? officialAverage(scores.map((s) => Number(s.total)))
    : null;

  return (
    <div className="page">
      {onBack && (
        <button type="button" className="btn btn-ghost" onClick={onBack} style={{ marginBottom: '1rem' }}>
          <ArrowLeft size={16} />
          回到演練
        </button>
      )}

      <div className="card">
        <div className="card-title">
          <h2>{station.title || '（未命名考題）'}</h2>
        </div>
        <div className="row">
          <span className="pill">
            {session.mode === 'segment' ? `片段特訓｜${session.segment_category}` : '完整演練'}
          </span>
          <span className="pill">{session.practice_kind === 'solo' ? '自己練' : '有人陪練'}</span>
          <span className="pill">實際 {humanDuration(session.duration_seconds ?? 0)}</span>
        </div>

        <div className="notice" style={{ marginTop: '1rem' }}>
          <Info size={14} style={{ verticalAlign: '-2px', marginRight: '0.35rem' }} />
          這份報告只驗證<strong>你說了什麼</strong>。純錄音無法得知你的手做了什麼，
          所以「做了卻沒說」這一類失分，這裡永遠抓不到——但那正好也是口試委員聽不到的部分。
          報告刻意不含分數：公告未規定細項配分，任何由 AI 生出的分數對「會不會過」沒有預測力。
        </div>
      </div>

      {/* 說做合一是核心考點，放在最前面 */}
      <div className="card">
        <div className="card-title">
          <h3>說做合一</h3>
          <span className="hint">
            公告一、(三)：執行身體健康評估時，須同時說明檢查目的、項目及部位
          </span>
        </div>

        {sayDo.length === 0 ? (
          <p className="muted">錄音中沒有偵測到任何身體檢查的口述。</p>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: '0.9rem' }}>
              共 {sayDo.length} 次身體檢查口述，其中 <strong>{sayDoComplete}</strong> 次三要素齊全。
            </p>

            {sayDo.map((finding, index) => (
              <div className="check-row" key={`${finding.examName}-${index}`}>
                <span className={`check-mark ${finding.statedPurpose && finding.statedItem && finding.statedSite ? 'met' : 'missed'}`}>
                  {finding.statedPurpose && finding.statedItem && finding.statedSite ? '✓' : '✕'}
                </span>
                <div className="check-body">
                  <strong>{finding.examName}</strong>
                  {typeof finding.atSeconds === 'number' && (
                    <span className="faint">　{mmss(finding.atSeconds)}</span>
                  )}
                  <div className="row" style={{ gap: '0.35rem', marginTop: '0.3rem' }}>
                    <span className={`pill ${finding.statedPurpose ? 'pill-ok' : 'pill-danger'}`}>目的</span>
                    <span className={`pill ${finding.statedItem ? 'pill-ok' : 'pill-danger'}`}>項目</span>
                    <span className={`pill ${finding.statedSite ? 'pill-ok' : 'pill-danger'}`}>部位</span>
                  </div>
                  {finding.quote && <div className="check-evidence">「{finding.quote}」</div>}
                  {finding.missing && (
                    <div className="faint" style={{ marginTop: '0.2rem' }}>{finding.missing}</div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h3>通用骨架檢核</h3>
          <span className="hint">
            完成 {coreMet} / {coreTotal}　這一層跨題累積，是「反覆漏掉」排行榜的來源
          </span>
        </div>

        {coreByCategory.map(({ category, items }) => (
          <div className="check-group" key={category}>
            <h3>{category}</h3>
            {items.map((item) => (
              <CheckRow
                key={item.key}
                label={item.label}
                met={item.result?.met ?? false}
                evidence={item.result?.evidence}
                note={item.result?.note ?? (item.result ? '' : '本次分析未回報此項')}
                atSeconds={item.result?.atSeconds}
              />
            ))}
          </div>
        ))}
      </div>

      {(analysis.stationChecks ?? []).length > 0 && (
        <div className="card">
          <div className="card-title">
            <h3>本題專屬檢核</h3>
            <span className="hint">只看這一題，不進排行榜</span>
          </div>
          {analysis.stationChecks.map((check) => (
            <CheckRow
              key={check.key}
              label={check.label || check.key}
              met={check.met}
              evidence={check.evidence}
              note={check.note}
              atSeconds={check.atSeconds}
            />
          ))}
        </div>
      )}

      {(analysis.cueAudit ?? []).length > 0 && (
        <div className="card">
          <div className="card-title">
            <h3>提示卡稽核</h3>
            <span className="hint">你是不是在還沒做到該項檢查之前就先看了答案</span>
          </div>
          {analysis.cueAudit.map((item) => (
            <CheckRow
              key={item.cueId}
              label={item.label}
              met={item.precededByRelevantSpeech}
              note={item.note}
              atSeconds={item.atSeconds}
            />
          ))}
        </div>
      )}

      {analysis.observations && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title"><h3>做到的</h3></div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }} className="muted">
              {(analysis.observations.strengths ?? []).map((item, index) => (
                <li key={index} style={{ marginBottom: '0.4rem' }}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="card">
            <div className="card-title"><h3>下一場要補的</h3></div>
            <ul style={{ margin: 0, paddingLeft: '1.1rem' }} className="muted">
              {(analysis.observations.gaps ?? []).map((item, index) => (
                <li key={index} style={{ marginBottom: '0.4rem' }}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {analysis.observations?.closingBehaviour && (
        <div className="card">
          <div className="card-title">
            <h3>收尾</h3>
            <span className="hint">公告要求向病人解釋評估結果與下一步計畫或注意事項</span>
          </div>
          <p className="muted">{analysis.observations.closingBehaviour}</p>
        </div>
      )}

      {scores.length > 0 && (
        <div className="card">
          <div className="card-title">
            <h3>口試委員評分</h3>
            <span className="hint">公告一、(六)：2 位委員評分總和之平均，第 3 位小數無條件捨去</span>
          </div>
          {scores.map((entry) => (
            <p className="muted" key={entry.examinerLabel}>
              {entry.examinerLabel}：{entry.total} 分
            </p>
          ))}
          <p style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '0.75rem' }}>
            實得成績 {formatScore(officialScore)}
            <span className={`pill ${officialScore >= PASSING_SCORE ? 'pill-ok' : 'pill-danger'}`} style={{ marginLeft: '0.6rem' }}>
              {officialScore >= PASSING_SCORE ? '及格' : '未達 60.00'}
            </span>
          </p>
          {scores.length < 2 && (
            <p className="faint">
              公告的算式是 2 位委員的平均，本場只有 {scores.length} 位評分，這個數字僅供參考。
            </p>
          )}
        </div>
      )}

      {session.transcript && (
        <div className="card">
          <div className="card-title"><h3>逐字稿</h3></div>
          <div className="transcript">{session.transcript}</div>
        </div>
      )}
    </div>
  );
}
