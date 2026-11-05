/** Opens (desktop) or downloads (iOS/Android) a base64 PDF — legacy `MediaService.downloadPDF`. */
export function downloadPdf(pdfData: string, fileName = 'document.pdf'): void {
  try {
    const bytes = atob(pdfData.replace('data:application/pdf;base64,', ''));
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));

    if (/iPad|iPhone|iPod|Android/.test(navigator.userAgent)) {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 100);
    } else {
      window.open(url);
    }
  } catch (e) {
    console.error(e);
  }
}

/**
 * Opens a base64 PDF in a new tab sized to the whole window and starts the print dialog from there. The frame must be
 * full size: a hidden / 0x0 frame makes the browser's PDF viewer print only the first page.
 */
export function printPdf(pdfData: string): void {
  const bytes = atob(pdfData.replace('data:application/pdf;base64,', ''));
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' }));
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(
    `<html><body style="margin:0"><iframe id="pdf" src="${url}" style="width:100%;height:100vh;border:none"></iframe>` +
    `<script>document.getElementById('pdf').onload=function(){this.contentWindow.focus();this.contentWindow.print();}<\/script></body></html>`,
  );
  w.document.close();
}
