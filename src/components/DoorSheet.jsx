/**
 * 門前 A4 試題貼紙。
 * 公告一、(二)：應考人於進入詢答區之檢查室前 2 分鐘，
 * 應詳細閱讀檢查室門前所提供之病人基本資料與主訴。
 *
 * 因此這張紙刻意只有三件事：病人基本資料與主訴、生命徵象、考生任務。
 * 任何多餘的資訊都會讓門前 2 分鐘失真。
 */
export default function DoorSheet({ title, doorSheet = {} }) {
  const { patient, chiefComplaint, vitalSigns, task } = doorSheet;

  return (
    <article className="door-sheet">
      <h1>{title || '（未命名考題）'}</h1>

      <div className="door-block">
        <h2>病人基本資料</h2>
        <p>{patient || '—'}</p>
      </div>

      <div className="door-block">
        <h2>主訴</h2>
        <p>{chiefComplaint || '—'}</p>
      </div>

      {vitalSigns && (
        <div className="door-block">
          <h2>生命徵象</h2>
          <div className="door-vitals">{vitalSigns}</div>
        </div>
      )}

      <div className="door-block">
        <h2>應考須知</h2>
        <p>{task || '—'}</p>
      </div>
    </article>
  );
}
