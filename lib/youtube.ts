import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export interface DownloadOptions {
  url: string;
  format: 'mp4' | 'mp3';
  outputPath: string;
  onProgress?: (progress: number) => void;
}

export async function downloadYouTube({
  url,
  format,
  outputPath,
  onProgress,
}: DownloadOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const args: string[] = [];

      if (format === 'mp4') {
        // MP4 다운로드 (비디오 + 오디오 병합)
        args.push(
          '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
          '--merge-output-format', 'mp4',
          '-o', outputPath,
          '--no-warnings',
          '--newline',
          url
        );
      } else {
        // MP3 다운로드 (오디오만)
        args.push(
          '-f', 'bestaudio/best',
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '192K',
          '-o', outputPath,
          '--no-warnings',
          '--newline',
          url
        );
      }

      const ytdlp = spawn('yt-dlp', args);
      let lastProgress = 0;
      let downloadCount = 0; // 비디오+오디오 = 2개 다운로드
      let currentFileProgress = 0;

      ytdlp.stdout.on('data', (data: Buffer) => {
        const output = data.toString();
        console.log('yt-dlp:', output.trim());

        // 새 파일 다운로드 시작 감지
        if (output.includes('[download] Destination:')) {
          downloadCount++;
          currentFileProgress = 0;
        }

        // 진행률 파싱: [download]  50.0% of 100.00MiB
        const match = output.match(/\[download\]\s+([\d.]+)%/);
        if (match && onProgress) {
          currentFileProgress = parseFloat(match[1]);
          // 2개 파일 다운로드 시 각각 45%, 병합 10%
          let totalProgress: number;
          if (downloadCount <= 1) {
            totalProgress = Math.round(currentFileProgress * 0.45);
          } else {
            totalProgress = Math.round(45 + currentFileProgress * 0.45);
          }
          if (totalProgress > lastProgress) {
            lastProgress = totalProgress;
            onProgress(Math.min(totalProgress, 90)); // 최대 90%까지 (병합 대기)
          }
        }

        // 병합 완료 감지
        if (output.includes('[Merger]') || output.includes('Merging formats')) {
          onProgress?.(95);
        }
      });

      ytdlp.stderr.on('data', (data: Buffer) => {
        console.error('yt-dlp stderr:', data.toString());
      });

      ytdlp.on('close', (code) => {
        if (code === 0) {
          onProgress?.(100);
          resolve();
        } else {
          reject(new Error(`yt-dlp 종료 코드: ${code}`));
        }
      });

      ytdlp.on('error', (err) => {
        reject(new Error(`yt-dlp 실행 오류: ${err.message}`));
      });
    } catch (error) {
      reject(error);
    }
  });
}

// YouTube URL 유효성 검사
function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

// YouTube 비디오 정보만 가져오기
export async function getYouTubeInfo(url: string) {
  if (!isValidYouTubeUrl(url)) {
    throw new Error('유효하지 않은 YouTube URL입니다.');
  }

  return new Promise<{
    title: string;
    duration: number;
    thumbnail: string;
    author: string;
  }>((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-warnings',
      url
    ];

    const ytdlp = spawn('yt-dlp', args);
    let output = '';

    ytdlp.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(output);
          resolve({
            title: info.title || 'Unknown',
            duration: info.duration || 0,
            thumbnail: info.thumbnail || '',
            author: info.uploader || info.channel || 'Unknown',
          });
        } catch {
          reject(new Error('비디오 정보 파싱 실패'));
        }
      } else {
        reject(new Error('비디오 정보를 가져올 수 없습니다.'));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp 실행 오류: ${err.message}`));
    });
  });
}
