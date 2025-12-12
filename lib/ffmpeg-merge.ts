import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs/promises';

export interface MergeMediaOptions {
  inputPaths: string[];
  outputPath: string;
  outputFormat?: string;
  reencode?: boolean; // If true, re-encode to ensure compatibility
  onProgress?: (progress: number) => void;
}

/**
 * Merge multiple media files into one
 * If all inputs have same codec, uses concat demuxer (fast)
 * Otherwise, re-encodes all files (slower but guaranteed to work)
 */
export async function mergeMedia({
  inputPaths,
  outputPath,
  outputFormat,
  reencode = false,
  onProgress,
}: MergeMediaOptions): Promise<void> {
  if (inputPaths.length === 0) {
    throw new Error('최소 1개 이상의 파일이 필요합니다');
  }

  if (inputPaths.length === 1) {
    // Single file - just copy
    await fs.copyFile(inputPaths[0], outputPath);
    return;
  }

  if (reencode) {
    // Re-encode method: slower but works for all files
    return mergeMediaWithReencode({ inputPaths, outputPath, outputFormat, onProgress });
  } else {
    // Concat demuxer method: fast but requires same codec
    return mergeMediaWithConcat({ inputPaths, outputPath, onProgress });
  }
}

/**
 * Fast merge using concat demuxer (requires same codec/parameters)
 */
async function mergeMediaWithConcat({
  inputPaths,
  outputPath,
  onProgress,
}: {
  inputPaths: string[];
  outputPath: string;
  onProgress?: (progress: number) => void;
}): Promise<void> {
  // Create a temporary concat file
  const concatFilePath = path.join(path.dirname(outputPath), 'concat_list.txt');
  const concatContent = inputPaths.map((p) => `file '${p}'`).join('\n');
  await fs.writeFile(concatFilePath, concatContent);

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(concatFilePath)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy']) // Copy codec for speed
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      })
      .on('end', async () => {
        // Clean up concat file
        await fs.unlink(concatFilePath).catch(() => {});
        resolve();
      })
      .on('error', async (err) => {
        // Clean up concat file on error
        await fs.unlink(concatFilePath).catch(() => {});
        reject(err);
      })
      .save(outputPath);
  });
}

/**
 * Merge with re-encoding (slower but works with different codecs)
 */
export async function mergeMediaWithReencode({
  inputPaths,
  outputPath,
  outputFormat,
  onProgress,
}: {
  inputPaths: string[];
  outputPath: string;
  outputFormat?: string;
  onProgress?: (progress: number) => void;
}): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const command = ffmpeg();

    // Add all input files
    inputPaths.forEach((inputPath) => {
      command.input(inputPath);
    });

    // Create filter complex for concatenation
    const filterComplex = [];
    for (let i = 0; i < inputPaths.length; i++) {
      filterComplex.push(`[${i}:v][${i}:a]`);
    }
    filterComplex.push(`concat=n=${inputPaths.length}:v=1:a=1[outv][outa]`);

    command
      .complexFilter(filterComplex.join(''))
      .outputOptions(['-map [outv]', '-map [outa]'])
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
  });
}

/**
 * Detect if files have compatible codecs for fast concat
 */
export async function canUseFastConcat(inputPaths: string[]): Promise<boolean> {
  try {
    const codecInfos = await Promise.all(
      inputPaths.map((inputPath) => getCodecInfo(inputPath))
    );

    // Check if all files have same video and audio codec
    const firstCodec = codecInfos[0];
    return codecInfos.every(
      (info) =>
        info.videoCodec === firstCodec.videoCodec &&
        info.audioCodec === firstCodec.audioCodec
    );
  } catch (error) {
    return false;
  }
}

/**
 * Get codec information for a media file
 */
function getCodecInfo(
  filePath: string
): Promise<{ videoCodec: string; audioCodec: string }> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(err);
        return;
      }

      const videoStream = metadata.streams.find((s) => s.codec_type === 'video');
      const audioStream = metadata.streams.find((s) => s.codec_type === 'audio');

      resolve({
        videoCodec: videoStream?.codec_name || 'unknown',
        audioCodec: audioStream?.codec_name || 'unknown',
      });
    });
  });
}
