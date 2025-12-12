import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { MediaFormat } from '@/types';

// FFmpeg 경로 설정
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/opt/homebrew/bin/ffprobe';

ffmpeg.setFfmpegPath(FFMPEG_PATH);
ffmpeg.setFfprobePath(FFPROBE_PATH);

export interface ConvertOptions {
  inputPath: string;
  outputPath: string;
  outputFormat: MediaFormat;
  onProgress?: (progress: number) => void;
}

export async function convertMedia({
  inputPath,
  outputPath,
  outputFormat,
  onProgress,
}: ConvertOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    let duration: number = 0;
    let command: any = null;
    let progressTimer: NodeJS.Timeout | null = null;
    let lastProgress = 0;
    let stuckCounter = 0;

    try {
      command = ffmpeg(inputPath);

      // 비디오 형식 설정
      if (outputFormat === 'mp4' || outputFormat === 'mov') {
        command
          .videoCodec('libx264')
          .audioCodec('aac')
          .videoBitrate('5000k')
          .audioBitrate('192k')
          .outputOptions([
            '-preset fast',
            '-crf 23',
            '-max_muxing_queue_size 9999', // 큐 크기 증가
          ]);

        if (outputFormat === 'mp4') {
          command.outputOptions(['-movflags', '+faststart']);
        }
      }
      // 오디오 형식 설정
      else if (outputFormat === 'mp3') {
        command
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .noVideo();
      } else if (outputFormat === 'wav') {
        command
          .audioCodec('pcm_s16le')
          .noVideo();
      }

      // 멈춤 감지 타이머 (30초 동안 진행 없으면 에러)
      const resetStuckTimer = () => {
        if (progressTimer) {
          clearInterval(progressTimer);
        }
        stuckCounter = 0;
        progressTimer = setInterval(() => {
          stuckCounter++;
          if (stuckCounter > 30) { // 30초
            console.error('[FFMPEG] Process appears stuck, killing...');
            if (command) {
              command.kill('SIGKILL');
            }
            reject(new Error('변환이 30초 이상 응답 없음 - 중단됨'));
          }
        }, 1000);
      };

      resetStuckTimer();

      // 진행률 추적
      command
        .on('codecData', (data: any) => {
          // 전체 길이 추출
          const time = data.duration.split(':');
          duration = parseInt(time[0]) * 3600 + parseInt(time[1]) * 60 + parseFloat(time[2]);
          console.log(`[FFMPEG] Duration: ${duration}s for ${path.basename(inputPath)}`);
        })
        .on('progress', (progress: any) => {
          resetStuckTimer(); // 진행이 있으면 타이머 리셋

          if (duration > 0 && onProgress) {
            const time = progress.timemark.split(':');
            const currentTime = parseInt(time[0]) * 3600 + parseInt(time[1]) * 60 + parseFloat(time[2]);
            const percent = Math.min(Math.round((currentTime / duration) * 100), 100);

            // 진행률이 변경되었을 때만 업데이트
            if (percent !== lastProgress) {
              lastProgress = percent;
              onProgress(percent);
            }
          }
        })
        .on('end', () => {
          console.log(`[FFMPEG] Conversion completed: ${path.basename(outputPath)}`);
          if (progressTimer) {
            clearInterval(progressTimer);
          }
          resolve();
        })
        .on('error', (err: any) => {
          console.error(`[FFMPEG] Conversion error: ${err.message}`);
          if (progressTimer) {
            clearInterval(progressTimer);
          }
          reject(err);
        })
        .save(outputPath);
    } catch (err: any) {
      console.error(`[FFMPEG] Setup error: ${err.message}`);
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      reject(err);
    }
  });
}

// 미디어 정보 추출
export async function getMediaInfo(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

// 미디어 길이 추출 (초 단위)
export async function getMediaDuration(filePath: string): Promise<number> {
  const info = await getMediaInfo(filePath);
  return info.format.duration || 0;
}
