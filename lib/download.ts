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
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}
