import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { convertDocument, isSupportedConversion } from '@/lib/document-converter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for long conversions

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const formData = await request.formData();

  const filesDataStr = formData.get('filesData') as string;
  const sessionId = formData.get('sessionId') as string;
  const outputFormat = formData.get('outputFormat') as string;

  const filesData = JSON.parse(filesDataStr);

  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'start', message: '문서 변환을 시작합니다...' })}\n\n`
          )
        );

        for (let i = 0; i < filesData.length; i++) {
          const fileData = filesData[i];
          const inputPath = path.join(process.cwd(), 'tmp', 'uploads', sessionId, fileData.savedName);
          const inputFormat = path.extname(fileData.savedName).substring(1).toLowerCase();

          // 변환 지원 여부 확인
          if (!isSupportedConversion(inputFormat, outputFormat)) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  fileIndex: i,
                  fileName: fileData.originalName,
                  message: `${inputFormat.toUpperCase()} → ${outputFormat.toUpperCase()} 변환은 지원되지 않습니다.`
                })}\n\n`
              )
            );
            continue;
          }

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'info',
                fileIndex: i,
                fileName: fileData.originalName,
                message: `${fileData.originalName} 변환 중...`
              })}\n\n`
            )
          );

          const timestamp = Date.now();
          const baseName = path.basename(fileData.originalName, path.extname(fileData.originalName));
          const outputFileName = `${baseName}_${timestamp}.${outputFormat}`;
          const outputPath = path.join(outputDir, outputFileName);

          try {
            await convertDocument({
              inputPath,
              outputPath,
              inputFormat,
              outputFormat,
              onProgress: (progress) => {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: 'progress',
                      fileIndex: i,
                      fileName: fileData.originalName,
                      progress,
                      message: `${fileData.originalName}: ${progress}%`
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
                  fileIndex: i,
                  fileName: fileData.originalName,
                  outputUrl: downloadUrl,
                  message: `${fileData.originalName} 변환 완료`
                })}\n\n`
              )
            );
          } catch (error: any) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'error',
                  fileIndex: i,
                  fileName: fileData.originalName,
                  message: `${fileData.originalName} 변환 실패: ${error.message}`
                })}\n\n`
              )
            );
          }
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', message: '모든 문서 변환 완료!' })}\n\n`
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
