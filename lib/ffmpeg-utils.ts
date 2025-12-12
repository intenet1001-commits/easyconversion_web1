import ffmpeg from 'fluent-ffmpeg';

/**
 * 미디어 파일의 duration을 가져오는 함수
 * 서버 사이드 전용 (fluent-ffmpeg 사용)
 */
export async function getMediaDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration || 0;
        resolve(duration);
      }
    });
  });
}

/**
 * 시간 파싱 (HH:MM:SS -> seconds)
 */
export function parseTime(timeString: string): number {
  const parts = timeString.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}
