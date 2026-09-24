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
