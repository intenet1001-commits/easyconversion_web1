# EasyConversion Web - Execution Plan (Part 2)

> Phase 4-7 상세 실행 계획

## Phase 4: 비디오 분할/병합

**목표**: 비디오 분할 및 병합 기능 구현
**기간**: 3일
**독립 테스트 가능**: ✅ 비디오 분할/병합 전체 플로우

### 4.1 비디오 분할 구현

#### `lib/ffmpeg-split.ts` 생성
```typescript
import ffmpeg from 'fluent-ffmpeg';
import { getMediaDuration } from './ffmpeg';

export interface SplitByTimepointsOptions {
  inputPath: string;
  outputDir: string;
  baseFileName: string;
  timepoints: string[]; // ["00:30:00", "01:15:00"]
  onProgress?: (partIndex: number, progress: number) => void;
}

export interface SplitBySegmentsOptions {
  inputPath: string;
  outputDir: string;
  baseFileName: string;
  segments: number; // 분할 개수
  onProgress?: (partIndex: number, progress: number) => void;
}

// 시간 포인트 기준 분할
export async function splitByTimepoints({
  inputPath,
  outputDir,
  baseFileName,
  timepoints,
  onProgress,
}: SplitByTimepointsOptions): Promise<string[]> {
  const duration = await getMediaDuration(inputPath);
  const ext = inputPath.split('.').pop();
  const outputFiles: string[] = [];

  // 시간 포인트를 초 단위로 변환
  const timepointsInSeconds = timepoints.map((tp) => {
    const [h, m, s] = tp.split(':').map(Number);
    return h * 3600 + m * 60 + s;
  });

  // 시작-끝 구간 배열 생성
  const segments = [
    { start: 0, end: timepointsInSeconds[0] },
    ...timepointsInSeconds.slice(0, -1).map((start, i) => ({
      start,
      end: timepointsInSeconds[i + 1],
    })),
    { start: timepointsInSeconds[timepointsInSeconds.length - 1], end: duration },
  ];

  // 각 구간 분할
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const outputPath = `${outputDir}/${baseFileName}_part${i + 1}.${ext}`;
    outputFiles.push(outputPath);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(segment.start)
        .setDuration(segment.end - segment.start)
        .outputOptions(['-c', 'copy']) // Stream copy (빠른 처리)
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(i, Math.round(progress.percent));
          }
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  return outputFiles;
}

// 균등 분할
export async function splitBySegments({
  inputPath,
  outputDir,
  baseFileName,
  segments,
  onProgress,
}: SplitBySegmentsOptions): Promise<string[]> {
  const duration = await getMediaDuration(inputPath);
  const segmentDuration = duration / segments;
  const ext = inputPath.split('.').pop();
  const outputFiles: string[] = [];

  for (let i = 0; i < segments; i++) {
    const startTime = i * segmentDuration;
    const outputPath = `${outputDir}/${baseFileName}_part${i + 1}.${ext}`;
    outputFiles.push(outputPath);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(startTime)
        .setDuration(segmentDuration)
        .outputOptions(['-c', 'copy'])
        .on('progress', (progress) => {
          if (onProgress && progress.percent) {
            onProgress(i, Math.round(progress.percent));
          }
        })
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .save(outputPath);
    });
  }

  return outputFiles;
}
```

#### `app/api/media/split/route.ts` 생성
```typescript
import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { splitByTimepoints, splitBySegments } from '@/lib/ffmpeg-split';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const formData = await request.formData();

  const file = formData.get('file') as File;
  const mode = formData.get('mode') as 'timepoints' | 'segments';
  const sessionId = formData.get('sessionId') as string;

  // 파일 저장
  const uploadDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
  await mkdir(uploadDir, { recursive: true });

  const fileId = uuidv4();
  const fileName = `${fileId}_${file.name}`;
  const inputPath = path.join(uploadDir, fileName);
  const bytes = await file.arrayBuffer();
  await writeFile(inputPath, Buffer.from(bytes));

  // 출력 디렉토리
  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const baseName = path.parse(file.name).name;

  const stream = new ReadableStream({
    async start(controller) {
      try {
        let outputFiles: string[] = [];

        if (mode === 'timepoints') {
          const timepoints = JSON.parse(formData.get('timepoints') as string);

          outputFiles = await splitByTimepoints({
            inputPath,
            outputDir,
            baseFileName: baseName,
            timepoints,
            onProgress: (partIndex, progress) => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    partIndex,
                    progress,
                    message: `Part ${partIndex + 1} 분할 중: ${progress}%`,
                  })}\n\n`
                )
              );
            },
          });
        } else {
          const segments = parseInt(formData.get('segments') as string);

          outputFiles = await splitBySegments({
            inputPath,
            outputDir,
            baseFileName: baseName,
            segments,
            onProgress: (partIndex, progress) => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    partIndex,
                    progress,
                    message: `Part ${partIndex + 1} 분할 중: ${progress}%`,
                  })}\n\n`
                )
              );
            },
          });
        }

        // 다운로드 URL 생성
        const downloadUrls = outputFiles.map((f) => {
          const fileName = path.basename(f);
          return `/downloads/${sessionId}/${fileName}`;
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'complete',
              outputUrls: downloadUrls,
              message: `${outputFiles.length}개 파일로 분할 완료`,
            })}\n\n`
          )
        );
        controller.close();
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 4.2 비디오 병합 구현

#### `lib/ffmpeg-merge.ts` 생성
```typescript
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs/promises';
import path from 'path';

export interface MergeOptions {
  inputPaths: string[];
  outputPath: string;
  outputFormat: string;
  onProgress?: (progress: number) => void;
}

export async function mergeMedia({
  inputPaths,
  outputPath,
  outputFormat,
  onProgress,
}: MergeOptions): Promise<void> {
  // concat 파일 목록 생성
  const concatListPath = path.join(path.dirname(outputPath), 'concat_list.txt');
  const concatContent = inputPaths.map((p) => `file '${p}'`).join('\n');
  await fs.writeFile(concatListPath, concatContent);

  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy']) // Stream copy (빠름)
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      })
      .on('end', async () => {
        // concat 파일 삭제
        await fs.unlink(concatListPath).catch(() => {});
        resolve();
      })
      .on('error', async (err) => {
        await fs.unlink(concatListPath).catch(() => {});
        reject(err);
      })
      .save(outputPath);
  });
}

// 코덱이 다른 경우 재인코딩 병합
export async function mergeMediaWithReencode({
  inputPaths,
  outputPath,
  outputFormat,
  onProgress,
}: MergeOptions): Promise<void> {
  const concatListPath = path.join(path.dirname(outputPath), 'concat_list.txt');
  const concatContent = inputPaths.map((p) => `file '${p}'`).join('\n');
  await fs.writeFile(concatListPath, concatContent);

  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0']);

    if (outputFormat === 'mp4' || outputFormat === 'mov') {
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate('5000k')
        .audioBitrate('192k')
        .outputOptions(['-preset', 'fast']);
    } else if (outputFormat === 'mp3') {
      command.audioCodec('libmp3lame').audioBitrate('192k').noVideo();
    } else if (outputFormat === 'wav') {
      command.audioCodec('pcm_s16le').noVideo();
    }

    command
      .on('progress', (progress) => {
        if (onProgress && progress.percent) {
          onProgress(Math.round(progress.percent));
        }
      })
      .on('end', async () => {
        await fs.unlink(concatListPath).catch(() => {});
        resolve();
      })
      .on('error', async (err) => {
        await fs.unlink(concatListPath).catch(() => {});
        reject(err);
      })
      .save(outputPath);
  });
}
```

#### `app/api/media/merge/route.ts` 생성
```typescript
import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { mergeMedia, mergeMediaWithReencode } from '@/lib/ffmpeg-merge';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const formData = await request.formData();

  const files = formData.getAll('files') as File[];
  const outputFormat = formData.get('outputFormat') as string;
  const sessionId = formData.get('sessionId') as string;
  const useReencode = formData.get('useReencode') === 'true';

  // 파일 저장
  const uploadDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
  await mkdir(uploadDir, { recursive: true });

  const inputPaths: string[] = [];
  for (const file of files) {
    const fileId = uuidv4();
    const fileName = `${fileId}_${file.name}`;
    const filePath = path.join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));
    inputPaths.push(filePath);
  }

  // 출력 설정
  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const outputFileName = `merged_${Date.now()}.${outputFormat}`;
  const outputPath = path.join(outputDir, outputFileName);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'start', message: '병합 시작...' })}\n\n`
          )
        );

        if (useReencode) {
          await mergeMediaWithReencode({
            inputPaths,
            outputPath,
            outputFormat,
            onProgress: (progress) => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'progress', progress, message: `병합 중: ${progress}%` })}\n\n`
                )
              );
            },
          });
        } else {
          await mergeMedia({
            inputPaths,
            outputPath,
            outputFormat,
            onProgress: (progress) => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'progress', progress, message: `병합 중: ${progress}%` })}\n\n`
                )
              );
            },
          });
        }

        const downloadUrl = `/downloads/${sessionId}/${outputFileName}`;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'complete', outputUrl: downloadUrl, message: '병합 완료!' })}\n\n`
          )
        );
        controller.close();
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 4.3 분할/병합 탭 UI 구현

#### `components/tabs/MediaSplitTab.tsx` 구현
```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Download } from 'lucide-react';

export function MediaSplitTab() {
  const { toast } = useToast();
  const { sessionId, addLog } = useConversionStore();
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<'timepoints' | 'segments'>('timepoints');
  const [timepoints, setTimepoints] = useState<string[]>(['00:00:30', '00:01:00']);
  const [segments, setSegments] = useState(3);
  const [isSplitting, setIsSplitting] = useState(false);
  const [progressList, setProgressList] = useState<{ partIndex: number; progress: number }[]>([]);
  const [outputUrls, setOutputUrls] = useState<string[]>([]);

  const handleFileAccepted = (files: File[]) => {
    if (files.length > 0) {
      setFile(files[0]);
      addLog(`파일 선택: ${files[0].name}`);
    }
  };

  const addTimepoint = () => {
    if (timepoints.length < 10) {
      setTimepoints([...timepoints, '00:00:00']);
    }
  };

  const updateTimepoint = (index: number, value: string) => {
    const newTimepoints = [...timepoints];
    newTimepoints[index] = value;
    setTimepoints(newTimepoints);
  };

  const removeTimepoint = (index: number) => {
    if (timepoints.length > 1) {
      setTimepoints(timepoints.filter((_, i) => i !== index));
    }
  };

  const handleSplit = async () => {
    if (!file) {
      toast({ title: '파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    setIsSplitting(true);
    setProgressList([]);
    setOutputUrls([]);
    addLog(`분할 시작: ${mode === 'timepoints' ? '시간 기준' : '구간 수 기준'}`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('mode', mode);
      formData.append('sessionId', sessionId);

      if (mode === 'timepoints') {
        formData.append('timepoints', JSON.stringify(timepoints));
      } else {
        formData.append('segments', segments.toString());
      }

      const response = await fetch('/api/media/split', {
        method: 'POST',
        body: formData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('스트림을 읽을 수 없습니다');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              setProgressList((prev) => {
                const newList = [...prev];
                const index = newList.findIndex((p) => p.partIndex === data.partIndex);
                if (index >= 0) {
                  newList[index].progress = data.progress;
                } else {
                  newList.push({ partIndex: data.partIndex, progress: data.progress });
                }
                return newList;
              });
            } else if (data.type === 'complete') {
              setOutputUrls(data.outputUrls);
              addLog(data.message);
              toast({ title: '분할 완료' });
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }

            if (data.message) {
              addLog(data.message);
            }
          }
        }
      }
    } catch (error: any) {
      toast({ title: '분할 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsSplitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">비디오 분할</h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFileAccepted}
            acceptedFormats={['mp4', 'mov', 'avi', 'mkv']}
            multiple={false}
          />

          {file && (
            <div className="p-3 border rounded bg-muted/50">
              <p className="font-medium">{file.name}</p>
            </div>
          )}

          <div>
            <Label>분할 모드</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as any)} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="timepoints" id="mode-timepoints" />
                <Label htmlFor="mode-timepoints">시간 기준</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="segments" id="mode-segments" />
                <Label htmlFor="mode-segments">구간 수</Label>
              </div>
            </RadioGroup>
          </div>

          {mode === 'timepoints' && (
            <div className="space-y-2">
              <Label>시간 포인트 (HH:MM:SS)</Label>
              {timepoints.map((tp, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={tp}
                    onChange={(e) => updateTimepoint(index, e.target.value)}
                    placeholder="00:00:00"
                  />
                  <Button variant="ghost" size="icon" onClick={() => removeTimepoint(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={addTimepoint} disabled={timepoints.length >= 10}>
                <Plus className="h-4 w-4 mr-2" />
                추가 (최대 10개)
              </Button>
            </div>
          )}

          {mode === 'segments' && (
            <div>
              <Label>구간 수 (2-10)</Label>
              <Input
                type="number"
                min={2}
                max={10}
                value={segments}
                onChange={(e) => setSegments(parseInt(e.target.value))}
              />
            </div>
          )}

          <Button onClick={handleSplit} disabled={isSplitting || !file} className="w-full">
            {isSplitting ? '분할 중...' : '분할 시작'}
          </Button>
        </div>
      </Card>

      {progressList.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">분할 진행률</h3>
          <div className="space-y-3">
            {progressList.map((p) => (
              <ProgressBar key={p.partIndex} value={p.progress} label={`Part ${p.partIndex + 1}`} />
            ))}
          </div>
        </Card>
      )}

      {outputUrls.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드</h3>
          <div className="space-y-2">
            {outputUrls.map((url, index) => (
              <a key={index} href={url} download className="flex items-center text-primary">
                <Download className="h-4 w-4 mr-2" />
                Part {index + 1} 다운로드
              </a>
            ))}
          </div>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
```

#### `components/tabs/MediaMergeTab.tsx` 구현
```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/lib/utils';
import { X, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface FileItem {
  id: string;
  file: File;
}

export function MediaMergeTab() {
  const { toast } = useToast();
  const { sessionId, addLog } = useConversionStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [outputFormat, setOutputFormat] = useState('mp4');
  const [useReencode, setUseReencode] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputUrl, setOutputUrl] = useState('');

  const handleFilesAccepted = (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((f) => ({ id: uuidv4(), file: f }));
    setFiles([...files, ...newFiles]);
    addLog(`${acceptedFiles.length}개 파일 추가됨`);
  };

  const removeFile = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const moveUp = (index: number) => {
    if (index > 0) {
      const newFiles = [...files];
      [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
      setFiles(newFiles);
    }
  };

  const moveDown = (index: number) => {
    if (index < files.length - 1) {
      const newFiles = [...files];
      [newFiles[index], newFiles[index + 1]] = [newFiles[index + 1], newFiles[index]];
      setFiles(newFiles);
    }
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      toast({ title: '최소 2개 이상의 파일이 필요합니다', variant: 'destructive' });
      return;
    }

    setIsMerging(true);
    setProgress(0);
    setOutputUrl('');
    addLog(`병합 시작: ${files.length}개 파일 → ${outputFormat.toUpperCase()}`);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f.file));
      formData.append('outputFormat', outputFormat);
      formData.append('sessionId', sessionId);
      formData.append('useReencode', useReencode.toString());

      const response = await fetch('/api/media/merge', {
        method: 'POST',
        body: formData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('스트림을 읽을 수 없습니다');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              setProgress(data.progress);
            } else if (data.type === 'complete') {
              setOutputUrl(data.outputUrl);
              addLog(data.message);
              toast({ title: '병합 완료' });
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }

            if (data.message) {
              addLog(data.message);
            }
          }
        }
      }
    } catch (error: any) {
      toast({ title: '병합 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">미디어 병합</h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={['mp4', 'mov', 'mp3', 'wav']}
            multiple
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <Label>병합할 파일 ({files.length}개) - 드래그로 순서 조정</Label>
              {files.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2 p-3 border rounded">
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveUp(index)} disabled={index === 0}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveDown(index)} disabled={index === files.length - 1}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {index + 1}. {item.file.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(item.file.size)}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => removeFile(item.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div>
            <Label>출력 형식</Label>
            <Select value={outputFormat} onValueChange={setOutputFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4</SelectItem>
                <SelectItem value="mov">MOV</SelectItem>
                <SelectItem value="mp3">MP3</SelectItem>
                <SelectItem value="wav">WAV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox id="reencode" checked={useReencode} onCheckedChange={(checked) => setUseReencode(checked as boolean)} />
            <Label htmlFor="reencode" className="text-sm">
              재인코딩 (코덱이 다를 경우 필수, 느림)
            </Label>
          </div>

          <Button onClick={handleMerge} disabled={isMerging || files.length < 2} className="w-full">
            {isMerging ? '병합 중...' : '병합 시작'}
          </Button>
        </div>
      </Card>

      {isMerging && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">병합 진행률</h3>
          <ProgressBar value={progress} label="미디어 병합" />
        </Card>
      )}

      {outputUrl && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드</h3>
          <a href={outputUrl} download className="inline-flex items-center text-primary">
            <Download className="h-4 w-4 mr-2" />
            병합된 파일 다운로드
          </a>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
```

### 4.4 Phase 4 테스트

#### 테스트 시나리오

**분할 테스트**
- [ ] 시간 기준 분할 (3개 포인트)
- [ ] 균등 분할 (5개 구간)
- [ ] 모든 분할 파일 재생 확인
- [ ] 진행률 표시 확인

**병합 테스트**
- [ ] 동일 코덱 병합 (빠른 처리)
- [ ] 다른 코덱 병합 (재인코딩)
- [ ] 순서 변경 동작 확인
- [ ] 병합 파일 재생 확인

---

## Phase 5: 문서 변환

**목표**: PDF, DOCX, PPTX, MD, HTML 간 상호 변환 구현
**기간**: 4일
**독립 테스트 가능**: ✅ 각 변환 조합별 독립 테스트

### 5.1 사전 준비

#### 패키지 설치
```bash
npm install pdf-lib
npm install docx
npm install pptxgenjs
npm install markdown-it
npm install -D @types/markdown-it
npm install cheerio
npm install puppeteer
npm install turndown
npm install mammoth
npm install html-to-docx
```

### 5.2 문서 변환 유틸리티

#### `lib/document-converters.ts` 생성
```typescript
import { PDFDocument } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import pptxgen from 'pptxgenjs';
import MarkdownIt from 'markdown-it';
import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import TurndownService from 'turndown';
import mammoth from 'mammoth';
import HTMLtoDOCX from 'html-to-docx';

// PDF → DOCX
export async function pdfToDocx(pdfPath: string, outputPath: string): Promise<void> {
  // pdf-parse로 텍스트 추출 후 DOCX 생성
  const pdfParse = require('pdf-parse');
  const dataBuffer = await fs.readFile(pdfPath);
  const pdfData = await pdfParse(dataBuffer);

  const doc = new Document({
    sections: [{
      properties: {},
      children: pdfData.text.split('\n').map((line: string) =>
        new Paragraph({ children: [new TextRun(line)] })
      ),
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outputPath, buffer);
}

// PDF → Markdown
export async function pdfToMarkdown(pdfPath: string, outputPath: string): Promise<void> {
  const pdfParse = require('pdf-parse');
  const dataBuffer = await fs.readFile(pdfPath);
  const pdfData = await pdfParse(dataBuffer);

  await fs.writeFile(outputPath, pdfData.text);
}

// PDF → HTML
export async function pdfToHtml(pdfPath: string, outputPath: string): Promise<void> {
  const pdfParse = require('pdf-parse');
  const dataBuffer = await fs.readFile(pdfPath);
  const pdfData = await pdfParse(dataBuffer);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>PDF to HTML</title></head>
<body>
<pre>${pdfData.text}</pre>
</body>
</html>`;

  await fs.writeFile(outputPath, html);
}

// DOCX → PDF
export async function docxToPdf(docxPath: string, outputPath: string): Promise<void> {
  // mammoth로 HTML 변환 후 puppeteer로 PDF 생성
  const result = await mammoth.convertToHtml({ path: docxPath });
  const html = result.value;

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html);
  await page.pdf({ path: outputPath, format: 'A4' });
  await browser.close();
}

// DOCX → Markdown
export async function docxToMarkdown(docxPath: string, outputPath: string): Promise<void> {
  const result = await mammoth.convertToHtml({ path: docxPath });
  const turndown = new TurndownService();
  const markdown = turndown.turndown(result.value);
  await fs.writeFile(outputPath, markdown);
}

// DOCX → HTML
export async function docxToHtml(docxPath: string, outputPath: string): Promise<void> {
  const result = await mammoth.convertToHtml({ path: docxPath });
  await fs.writeFile(outputPath, result.value);
}

// Markdown → PDF
export async function markdownToPdf(mdPath: string, outputPath: string): Promise<void> {
  const mdContent = await fs.readFile(mdPath, 'utf-8');
  const md = new MarkdownIt();
  const html = md.render(mdContent);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html);
  await page.pdf({ path: outputPath, format: 'A4' });
  await browser.close();
}

// Markdown → DOCX
export async function markdownToDocx(mdPath: string, outputPath: string): Promise<void> {
  const mdContent = await fs.readFile(mdPath, 'utf-8');
  const md = new MarkdownIt();
  const html = md.render(mdContent);

  const docxBuffer = await HTMLtoDOCX(html);
  await fs.writeFile(outputPath, docxBuffer);
}

// Markdown → HTML
export async function markdownToHtml(mdPath: string, outputPath: string): Promise<void> {
  const mdContent = await fs.readFile(mdPath, 'utf-8');
  const md = new MarkdownIt();
  const html = md.render(mdContent);

  const fullHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Markdown to HTML</title></head>
<body>
${html}
</body>
</html>`;

  await fs.writeFile(outputPath, fullHtml);
}

// HTML → PDF
export async function htmlToPdf(htmlPath: string, outputPath: string): Promise<void> {
  const html = await fs.readFile(htmlPath, 'utf-8');

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(html);
  await page.pdf({ path: outputPath, format: 'A4' });
  await browser.close();
}

// HTML → DOCX
export async function htmlToDocx(htmlPath: string, outputPath: string): Promise<void> {
  const html = await fs.readFile(htmlPath, 'utf-8');
  const docxBuffer = await HTMLtoDOCX(html);
  await fs.writeFile(outputPath, docxBuffer);
}

// HTML → Markdown
export async function htmlToMarkdown(htmlPath: string, outputPath: string): Promise<void> {
  const html = await fs.readFile(htmlPath, 'utf-8');
  const turndown = new TurndownService();
  const markdown = turndown.turndown(html);
  await fs.writeFile(outputPath, markdown);
}

// PPTX → PDF
export async function pptxToPdf(pptxPath: string, outputPath: string): Promise<void> {
  // PPTX를 이미지로 변환 후 PDF에 삽입
  // 복잡한 구현이므로 간단하게 LibreOffice 사용 권장
  throw new Error('PPTX → PDF 변환은 LibreOffice가 필요합니다');
}

// 변환 라우터
export async function convertDocument(
  inputPath: string,
  outputPath: string,
  fromFormat: string,
  toFormat: string
): Promise<void> {
  const key = `${fromFormat}_to_${toFormat}`;

  const converters: Record<string, () => Promise<void>> = {
    pdf_to_docx: () => pdfToDocx(inputPath, outputPath),
    pdf_to_md: () => pdfToMarkdown(inputPath, outputPath),
    pdf_to_html: () => pdfToHtml(inputPath, outputPath),
    docx_to_pdf: () => docxToPdf(inputPath, outputPath),
    docx_to_md: () => docxToMarkdown(inputPath, outputPath),
    docx_to_html: () => docxToHtml(inputPath, outputPath),
    md_to_pdf: () => markdownToPdf(inputPath, outputPath),
    md_to_docx: () => markdownToDocx(inputPath, outputPath),
    md_to_html: () => markdownToHtml(inputPath, outputPath),
    html_to_pdf: () => htmlToPdf(inputPath, outputPath),
    html_to_docx: () => htmlToDocx(inputPath, outputPath),
    html_to_md: () => htmlToMarkdown(inputPath, outputPath),
  };

  const converter = converters[key];
  if (!converter) {
    throw new Error(`지원되지 않는 변환: ${fromFormat} → ${toFormat}`);
  }

  await converter();
}
```

### 5.3 문서 변환 API

#### `app/api/document/convert/route.ts` 생성
```typescript
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { convertDocument } from '@/lib/document-converters';
import { v4 as uuidv4 } from 'uuid';
import { getFileExtension } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const outputFormat = formData.get('outputFormat') as string;
    const sessionId = formData.get('sessionId') as string;

    // 디렉토리 생성
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
    const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
    await mkdir(uploadDir, { recursive: true });
    await mkdir(outputDir, { recursive: true });

    const results = [];

    for (const file of files) {
      const fileId = uuidv4();
      const inputFileName = `${fileId}_${file.name}`;
      const inputPath = path.join(uploadDir, inputFileName);

      // 입력 파일 저장
      const bytes = await file.arrayBuffer();
      await writeFile(inputPath, Buffer.from(bytes));

      // 변환
      const baseName = path.parse(file.name).name;
      const outputFileName = `${baseName}.${outputFormat}`;
      const outputPath = path.join(outputDir, outputFileName);

      const inputFormat = getFileExtension(file.name);
      await convertDocument(inputPath, outputPath, inputFormat, outputFormat);

      results.push({
        originalName: file.name,
        outputUrl: `/downloads/${sessionId}/${outputFileName}`,
        outputName: outputFileName,
      });
    }

    return NextResponse.json({
      success: true,
      files: results,
    });
  } catch (error: any) {
    console.error('Conversion error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### 5.4 문서 변환 탭 UI 구현

#### `components/tabs/DocumentConvertTab.tsx` 구현
```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUploader } from '@/components/common/FileUploader';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { useToast } from '@/hooks/use-toast';
import { formatFileSize } from '@/lib/utils';
import { X, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

interface FileItem {
  id: string;
  file: File;
}

export function DocumentConvertTab() {
  const { toast } = useToast();
  const { sessionId, addLog } = useConversionStore();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [outputFormat, setOutputFormat] = useState('docx');
  const [isConverting, setIsConverting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const handleFilesAccepted = (acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map((f) => ({ id: uuidv4(), file: f }));
    setFiles([...files, ...newFiles]);
    addLog(`${acceptedFiles.length}개 파일 추가됨`);
  };

  const removeFile = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast({ title: '파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    setIsConverting(true);
    setResults([]);
    addLog(`문서 변환 시작: ${files.length}개 파일 → ${outputFormat.toUpperCase()}`);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f.file));
      formData.append('outputFormat', outputFormat);
      formData.append('sessionId', sessionId);

      const response = await fetch('/api/document/convert', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setResults(data.files);
      addLog(`변환 완료: ${data.files.length}개 파일`);
      toast({ title: '변환 완료' });
    } catch (error: any) {
      toast({ title: '변환 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">문서 변환</h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={['pdf', 'docx', 'pptx', 'md', 'html']}
            multiple
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium">업로드된 파일 ({files.length})</p>
              {files.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{item.file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(item.file.size)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeFile(item.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">변환 형식</label>
            <Select value={outputFormat} onValueChange={setOutputFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="docx">DOCX (Word)</SelectItem>
                <SelectItem value="pptx">PPTX (PowerPoint)</SelectItem>
                <SelectItem value="md">Markdown</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleConvert} disabled={isConverting || files.length === 0} className="w-full">
            {isConverting ? '변환 중...' : '변환 시작'}
          </Button>
        </div>
      </Card>

      {results.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드</h3>
          <div className="space-y-2">
            {results.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded">
                <div>
                  <p className="font-medium">{result.outputName}</p>
                  <p className="text-sm text-muted-foreground">원본: {result.originalName}</p>
                </div>
                <a href={result.outputUrl} download>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    다운로드
                  </Button>
                </a>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
```

### 5.5 Phase 5 테스트

#### 테스트 매트릭스 (15개 변환 조합)
- [ ] PDF → DOCX
- [ ] PDF → MD
- [ ] PDF → HTML
- [ ] DOCX → PDF
- [ ] DOCX → MD
- [ ] DOCX → HTML
- [ ] MD → PDF
- [ ] MD → DOCX
- [ ] MD → HTML
- [ ] HTML → PDF
- [ ] HTML → DOCX
- [ ] HTML → MD
- [ ] PPTX → PDF (optional)
- [ ] PPTX → DOCX
- [ ] PPTX → MD

---

*Phase 6-7은 다음 메시지에서 계속...*
