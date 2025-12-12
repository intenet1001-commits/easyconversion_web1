import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { downloadYouTube } from '@/lib/youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const { url, format, sessionId } = await request.json();

  // 출력 디렉토리 생성
  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const timestamp = Date.now();
  const outputFileName = `youtube_${timestamp}.${format}`;
  const outputPath = path.join(outputDir, outputFileName);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'start', message: '다운로드를 시작합니다...' })}\n\n`
          )
        );

        await downloadYouTube({
          url,
          format,
          outputPath,
          onProgress: (progress) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'progress', progress, message: `다운로드 중: ${progress}%` })}\n\n`
              )
            );
          },
        });

        const downloadUrl = `/downloads/${sessionId}/${outputFileName}`;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'complete', outputUrl: downloadUrl, message: '다운로드 완료!' })}\n\n`
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
