import { X } from 'lucide-react';

/**
 * 提示卡覆蓋層。
 *
 * 提示卡不是這套系統發明的輔具，而是真實考場的既有機制：
 * 標準化病人身上不會有梅杜莎頭這類特殊表徵，所以考生做到該項身體檢查時，
 * 由考官出示卡片告知檢查發現。
 */
export default function CueOverlay({ cue, onClose }) {
  if (!cue) return null;

  return (
    <div className="cue-overlay" role="dialog" aria-modal="true">
      <div className="cue-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '1rem',
          }}
        >
          <div>
            {cue.category && (
              <span className="pill" style={{ marginBottom: '0.5rem' }}>
                {cue.category}
              </span>
            )}
            <h2>{cue.title || cue.label}</h2>
          </div>
          {onClose && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              aria-label="關閉提示卡"
              style={{ color: '#0f172a', borderColor: '#cbd5e1' }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        <p className="cue-body" style={{ marginTop: '0.75rem' }}>
          {cue.content}
        </p>
      </div>
    </div>
  );
}
