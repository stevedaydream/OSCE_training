import html2pdf from 'html2pdf.js';

export function exportReportToPDF(elementId, filename = 'OSCE_Exam_Report.pdf') {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found for PDF export:', elementId);
    return;
  }

  const opt = {
    margin:       [0.4, 0.4, 0.4, 0.4],
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' }
  };

  return html2pdf().set(opt).from(element).save();
}

export function exportStationToJSON(station) {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(station, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${station.title || 'OSCE_Station'}_${Date.now()}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

export function importStationFromJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        resolve(json);
      } catch (err) {
        reject(new Error('JSON 格式不正確：' + err.message));
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
