import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { convertMedia } from '@/lib/ffmpeg';
import { MediaFormat } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5분 타임아웃

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const formData = await request.formData();

  const filesData = JSON.parse(formData.get('filesData') as string);
  const outputFormat = formData.get('outputFormat') as MediaFormat;
  const sessionId = formData.get('sessionId') as string;

  console.log(`[CONVERT API] Starting conversion for ${filesData.length} files`);

  // 출력 디렉토리 생성
  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const stream = new ReadableStream({
    async start(controller) {
      let successCount = 0;
      let failedCount = 0;

      try {
        for (let i = 0; i < filesData.length; i++) {
          const file = filesData[i];
          const inputPath = file.path;
          const baseName = path.parse(file.originalName).name;
          const outputFileName = `${baseName}.${outputFormat}`;
          const outputPath = path.join(outputDir, outputFileName);

          console.log(`[CONVERT API] Processing file ${i + 1}/${filesData.length}: ${file.originalName}`);

          // 변환 시작 메시지
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'progress',
                fileIndex: i,
                fileName: file.originalName,
                progress: 0,
                message: `변환 시작: ${file.originalName} (${i + 1}/${filesData.length})`,
              })}\n\n`
            )
          );

          try {
            // 변환 실행 (재시도 로직 포함)
            let retryCount = 0;
            const maxRetries = 2;
            let lastError: Error | null = null;

            while (retryCount <= maxRetries) {
              try {
                await convertMedia({
                  inputPath,
                  outputPath,
                  outputFormat,
                  onProgress: (progress) => {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({
                          type: 'progress',
                          fileIndex: i,
                          fileName: file.originalName,
                          progress,
                          message: `변환 중: ${file.originalName} (${progress}%)`,
                        })}\n\n`
                      )
                    );
                  },
                });

                // 성공
                console.log(`[CONVERT API] Successfully converted: ${file.originalName}`);
                successCount++;
                break;
              } catch (err: any) {
                lastError = err;
                retryCount++;

                if (retryCount <= maxRetries) {
                  console.warn(`[CONVERT API] Retry ${retryCount}/${maxRetries} for ${file.originalName}: ${err.message}`);

                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({
                        type: 'progress',
                        fileIndex: i,
                        fileName: file.originalName,
                        progress: 0,
                        message: `재시도 중 (${retryCount}/${maxRetries}): ${file.originalName}`,
                      })}\n\n`
                    )
                  );

                  // 재시도 전 대기
                  await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                  throw lastError;
                }
              }
            }

            // 완료 메시지
            const downloadUrl = `/downloads/${sessionId}/${outputFileName}`;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'complete',
                  fileIndex: i,
                  fileName: file.originalName,
                  outputUrl: downloadUrl,
                  message: `완료: ${outputFileName}`,
                })}\n\n`
              )
            );

          } catch (fileError: any) {
            // 개별 파일 변환 실패
            console.error(`[CONVERT API] Failed to convert ${file.originalName}:`, fileError.message);
            failedCount++;

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'file-error',
                  fileIndex: i,
                  fileName: file.originalName,
                  message: `실패: ${file.originalName} - ${fileError.message}`,
                })}\n\n`
              )
            );

            // 개별 파일 실패해도 다음 파일 계속 처리
            continue;
          }
        }

        // 모든 변환 완료
        const summary = `완료: ${successCount}개, 실패: ${failedCount}개`;
        console.log(`[CONVERT API] ${summary}`);

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'done',
              message: `모든 변환이 완료되었습니다. ${summary}`,
              successCount,
              failedCount,
            })}\n\n`
          )
        );
        controller.close();

      } catch (error: any) {
        console.error('[CONVERT API] Fatal error:', error.message);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'error',
              message: `치명적 오류: ${error.message}`,
            })}\n\n`
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
