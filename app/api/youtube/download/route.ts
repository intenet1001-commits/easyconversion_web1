import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { downloadYouTube } from '@/lib/youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 영상 제목을 파일 시스템에서 안전하게 쓸 수 있는 파일명으로 변환
function sanitizeFilename(title: string | undefined): string {
  const fallback = 'youtube_video';
  if (!title || !title.trim()) return fallback;
  return title
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_') // 파일명에 쓸 수 없는 문자 치환
    .replace(/\s+/g, ' ')
    .slice(0, 100) // 너무 긴 제목 방지
    .trim() || fallback;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const { url, format, sessionId, cookies, title } = await request.json();

  // 출력 디렉토리 생성
  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const uniqueSuffix = crypto.randomUUID().slice(0, 6);
  const outputFileName = `${sanitizeFilename(title)}_${uniqueSuffix}.${format}`;
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
          cookies,
          onProgress: (progress) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'progress', progress, message: `다운로드 중: ${progress}%` })}\n\n`
              )
            );
          },
        });

        // 파일명에 URL 특수문자(#, ? 등)가 들어갈 수 있어 인코딩해서 내려준다
        const downloadUrl = `/downloads/${encodeURIComponent(sessionId)}/${encodeURIComponent(outputFileName)}`;
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
