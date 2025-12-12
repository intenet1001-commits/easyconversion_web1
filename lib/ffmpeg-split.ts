import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { getMediaDuration, parseTime } from './ffmpeg-utils';

export interface SplitByTimepointsOptions {
  inputPath: string;
  outputDir: string;
  timepoints: string[]; // Array of time strings like ['00:01:30', '00:03:45']
  onProgress?: (segmentIndex: number, progress: number) => void;
}

export interface SplitBySegmentsOptions {
  inputPath: string;
  outputDir: string;
  segmentCount: number;
  onProgress?: (segmentIndex: number, progress: number) => void;
}

export interface SplitResult {
  segments: string[];
  outputUrls: string[];
}

/**
 * Split a media file by specified timepoints
 * Creates N+1 segments where N is the number of timepoints
 */
export async function splitByTimepoints({
  inputPath,
  outputDir,
  timepoints,
  onProgress,
}: SplitByTimepointsOptions): Promise<SplitResult> {
  const duration = await getMediaDuration(inputPath);
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  // Convert timepoint strings to seconds and add start/end
  const timesInSeconds = [0, ...timepoints.map(parseTime), duration];
  const segments: string[] = [];
  const outputUrls: string[] = [];

  for (let i = 0; i < timesInSeconds.length - 1; i++) {
    const startTime = timesInSeconds[i];
    const endTime = timesInSeconds[i + 1];
    const segmentDuration = endTime - startTime;

    const outputFileName = `${basename}_part${i + 1}${ext}`;
    const outputPath = path.join(outputDir, outputFileName);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(segmentDuration)
        .outputOptions(['-c copy']) // Copy codec for fast processing
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(i, Math.round(progress.percent));
          }
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });

    segments.push(outputPath);
    outputUrls.push(outputFileName);
  }

  return { segments, outputUrls };
}

/**
 * Split a media file into N equal segments
 */
export async function splitBySegments({
  inputPath,
  outputDir,
  segmentCount,
  onProgress,
}: SplitBySegmentsOptions): Promise<SplitResult> {
  const duration = await getMediaDuration(inputPath);
  const segmentDuration = duration / segmentCount;
  const ext = path.extname(inputPath);
  const basename = path.basename(inputPath, ext);

  const segments: string[] = [];
  const outputUrls: string[] = [];

  for (let i = 0; i < segmentCount; i++) {
    const startTime = i * segmentDuration;
    const outputFileName = `${basename}_part${i + 1}${ext}`;
    const outputPath = path.join(outputDir, outputFileName);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(segmentDuration)
        .outputOptions(['-c copy'])
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(i, Math.round(progress.percent));
          }
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });

    segments.push(outputPath);
    outputUrls.push(outputFileName);
  }

  return { segments, outputUrls };
}
