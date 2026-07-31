export async function downloadFileFromUrl(url: string, filename: string): Promise<void> {
  const fullUrl = url.startsWith('/') ? `${window.location.origin}${url}` : url;
  const response = await fetch(fullUrl);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename || url.split('/').pop() || 'download';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // 큰 파일(영상 등)은 브라우저/Electron 다운로드 매니저가 blob을 실제로 다 읽어가기까지
  // 시간이 걸린다. 너무 일찍 revoke하면 "File wasn't available on site" 오류로 다운로드가
  // 끊긴다. 넉넉하게 지연 후 해제한다.
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
}
