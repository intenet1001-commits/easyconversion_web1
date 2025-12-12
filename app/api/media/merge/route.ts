import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { mergeMedia, canUseFastConcat } from '@/lib/ffmpeg-merge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const formData = await request.formData();

  const filesDataStr = formData.get('filesData') as string;
  const sessionId = formData.get('sessionId') as string;
  const outputFormat = formData.get('outputFormat') as string;
  const reencode = formData.get('reencode') === 'true';

  const filesData = JSON.parse(filesDataStr);

  const inputPaths = filesData.map((file: any) =>
    path.join(process.cwd(), 'tmp', 'uploads', sessionId, file.savedName)
  );

  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const timestamp = Date.now();
  const outputFileName = `merged_${timestamp}.${outputFormat}`;
  const outputPath = path.join(outputDir, outputFileName);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'start', message: '병합을 시작합니다...' })}\n\n`
          )
        );

        // Check if fast concat is possible
        let useFastMethod = !reencode;
        if (!reencode) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'info', message: '파일 호환성 확인 중...' })}\n\n`
            )
          );

          useFastMethod = await canUseFastConcat(inputPaths);

          if (useFastMethod) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'info',
                  message: '빠른 병합 모드 사용 (코덱 복사)'
                })}\n\n`
              )
            );
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'info',
                  message: '재인코딩 모드 사용 (코덱 불일치)'
                })}\n\n`
              )
            );
          }
        } else {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'info',
                message: '재인코딩 모드 사용 (사용자 선택)'
              })}\n\n`
            )
          );
        }

        await mergeMedia({
          inputPaths,
          outputPath,
          outputFormat,
          reencode: !useFastMethod,
          onProgress: (progress) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'progress',
                  progress,
                  message: `병합 중: ${progress}%`
                })}\n\n`
              )
            );
          },
        });

        const downloadUrl = `/downloads/${sessionId}/${outputFileName}`;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'complete',
              outputUrl: downloadUrl,
              message: '병합 완료!'
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
