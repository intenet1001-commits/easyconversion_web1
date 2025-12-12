export const MEDIA_FORMATS = ['mp4', 'mp3', 'mov', 'wav', 'avi', 'mkv'];
export const DOCUMENT_FORMATS = ['pdf', 'docx', 'pptx', 'md', 'html'];

export async function validateFile(
  file: File,
  allowedFormats: string[]
): Promise<{ valid: boolean; error?: string }> {
  // 크기 확인
  const maxSize = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '524288000');
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `파일 크기가 너무 큽니다. (최대 ${Math.round(maxSize / 1024 / 1024)}MB)`,
    };
  }

  // 확장자 확인
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !allowedFormats.includes(ext)) {
    return {
      valid: false,
      error: `지원되지 않는 파일 형식입니다. (허용: ${allowedFormats.join(', ')})`,
    };
  }

  return { valid: true };
}

export function isMediaFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? MEDIA_FORMATS.includes(ext) : false;
}

export function isDocumentFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? DOCUMENT_FORMATS.includes(ext) : false;
}
