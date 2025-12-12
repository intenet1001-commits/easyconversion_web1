import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { splitByTimepoints, splitBySegments } from '@/lib/ffmpeg-split';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const formData = await request.formData();

  const mode = formData.get('mode') as 'timepoints' | 'segments';
  const fileData = formData.get('fileData') as string;
  const sessionId = formData.get('sessionId') as string;
  const parsedFileData = JSON.parse(fileData);

  const inputPath = path.join(process.cwd(), 'tmp', 'uploads', sessionId, parsedFileData.savedName);
  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'start', message: '분할을 시작합니다...' })}\n\n`
          )
        );

        let result;

        if (mode === 'timepoints') {
          const timepointsStr = formData.get('timepoints') as string;
          const timepoints = JSON.parse(timepointsStr);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'info',
                message: `시간 기준으로 ${timepoints.length + 1}개 구간으로 분할합니다...`
              })}\n\n`
            )
          );

          result = await splitByTimepoints({
            inputPath,
            outputDir,
            timepoints,
            onProgress: (segmentIndex, progress) => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    segmentIndex,
                    progress,
                    message: `구간 ${segmentIndex + 1} 처리 중: ${progress}%`
                  })}\n\n`
                )
              );
            },
          });
        } else {
          const segmentCount = parseInt(formData.get('segmentCount') as string);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'info',
                message: `${segmentCount}개의 동일한 구간으로 분할합니다...`
              })}\n\n`
            )
          );

          result = await splitBySegments({
            inputPath,
            outputDir,
            segmentCount,
            onProgress: (segmentIndex, progress) => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    segmentIndex,
                    progress,
                    message: `구간 ${segmentIndex + 1} 처리 중: ${progress}%`
                  })}\n\n`
                )
              );
            },
          });
        }

        // Send completion with all output URLs
        const outputUrls = result.outputUrls.map((fileName) => `/downloads/${sessionId}/${fileName}`);
        const downloadFolder = outputDir;

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'complete',
              outputUrls,
              downloadFolder,
              message: `분할 완료! ${result.segments.length}개 파일이 생성되었습니다.`
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
