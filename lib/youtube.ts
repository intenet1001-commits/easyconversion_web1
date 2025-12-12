import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
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
  return new Promise(async (resolve, reject) => {
    try {
      // URL 검증
      if (!ytdl.validateURL(url)) {
        throw new Error('유효하지 않은 YouTube URL입니다.');
      }

      // 비디오 정보 가져오기
      const info = await ytdl.getInfo(url);
      const title = info.videoDetails.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_');

      if (format === 'mp4') {
        // MP4 다운로드 (비디오 + 오디오)
        const videoStream = ytdl(url, { quality: 'highestvideo' });
        const audioStream = ytdl(url, { quality: 'highestaudio' });

        ffmpeg()
          .input(videoStream)
          .input(audioStream)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-preset fast', '-crf 23'])
          .on('progress', (progress) => {
            if (onProgress && progress.percent) {
              onProgress(Math.round(progress.percent));
            }
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      } else {
        // MP3 다운로드 (오디오만)
        const audioStream = ytdl(url, { quality: 'highestaudio' });

        ffmpeg(audioStream)
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .toFormat('mp3')
          .on('progress', (progress) => {
            if (onProgress && progress.percent) {
              onProgress(Math.round(progress.percent));
            }
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// YouTube 비디오 정보만 가져오기
export async function getYouTubeInfo(url: string) {
  if (!ytdl.validateURL(url)) {
    throw new Error('유효하지 않은 YouTube URL입니다.');
  }

  const info = await ytdl.getInfo(url);
  return {
    title: info.videoDetails.title,
    duration: parseInt(info.videoDetails.lengthSeconds),
    thumbnail: info.videoDetails.thumbnails[0]?.url,
    author: info.videoDetails.author.name,
  };
}
