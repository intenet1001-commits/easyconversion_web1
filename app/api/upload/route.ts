import { NextRequest, NextResponse } from 'next/server';
import { mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import formidable from 'formidable';
import { Readable } from 'stream';

// 대용량 파일 업로드를 위한 설정
export const runtime = 'nodejs';
export const maxDuration = 300; // 5분 타임아웃

// Next.js Request를 Node.js IncomingMessage로 변환
async function toNodeRequest(request: NextRequest): Promise<any> {
  const body = request.body;
  if (!body) throw new Error('No body in request');

  const reader = body.getReader();
  const stream = new Readable({
    async read() {
      try {
        const { done, value } = await reader.read();
        if (done) {
          this.push(null);
        } else {
          this.push(Buffer.from(value));
        }
      } catch (err) {
        this.destroy(err as Error);
      }
    },
  });

  // IncomingMessage처럼 보이게 만들기
  (stream as any).headers = Object.fromEntries(request.headers.entries());
  (stream as any).method = request.method;
  (stream as any).url = new URL(request.url).pathname;

  return stream;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[UPLOAD] Starting file upload with formidable');

    // 세션 ID를 URL 쿼리에서 가져오기 (또는 헤더에서)
    const url = new URL(request.url);
    let sessionId = url.searchParams.get('sessionId') || request.headers.get('x-session-id');

    // Node.js request로 변환
    const nodeReq = await toNodeRequest(request);

    // 임시 업로드 디렉토리
    const tempUploadDir = path.join(process.cwd(), 'tmp', 'uploads', 'temp');
    await mkdir(tempUploadDir, { recursive: true });

    console.log(`[UPLOAD] Temp directory: ${tempUploadDir}`);

    // formidable 설정 (스트리밍 모드, 메모리 제한 없음)
    const form = formidable({
      uploadDir: tempUploadDir,
      keepExtensions: true,
      maxFileSize: 53687091200, // 50GB
      allowEmptyFiles: false,
      multiples: true,
    });

    console.log('[UPLOAD] Parsing form data with formidable...');

    // formidable로 파싱 (스트리밍)
    const [fields, files] = await new Promise<[formidable.Fields, formidable.Files]>(
      (resolve, reject) => {
        form.parse(nodeReq, (err, fields, files) => {
          if (err) {
            console.error('[UPLOAD] Formidable parse error:', err);
            reject(err);
          } else {
            resolve([fields, files]);
          }
        });
      }
    );

    console.log('[UPLOAD] Formidable parsing complete');
    console.log(`[UPLOAD] Fields:`, Object.keys(fields));
    console.log(`[UPLOAD] Files:`, Object.keys(files));

    // sessionId가 없으면 fields에서 가져오기
    if (!sessionId && fields.sessionId) {
      sessionId = Array.isArray(fields.sessionId)
        ? fields.sessionId[0]
        : fields.sessionId;
    }

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // 세션 업로드 디렉토리 생성
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
    console.log(`[UPLOAD] Creating session directory: ${uploadDir}`);
    await mkdir(uploadDir, { recursive: true });

    const uploadedFiles = [];
    const fileArray = Array.isArray(files.files) ? files.files : [files.files];

    for (const file of fileArray) {
      if (!file) continue;

      const fileId = uuidv4();
      const fileName = `${fileId}_${file.originalFilename || 'unknown'}`;
      const finalPath = path.join(uploadDir, fileName);

      console.log(`[UPLOAD] Moving file: ${file.originalFilename} (${file.size} bytes)`);
      console.log(`[UPLOAD] From: ${file.filepath}`);
      console.log(`[UPLOAD] To: ${finalPath}`);

      // 임시 파일을 최종 위치로 이동
      const fs = await import('fs/promises');
      await fs.rename(file.filepath, finalPath);

      console.log(`[UPLOAD] File moved successfully: ${fileName}`);

      uploadedFiles.push({
        fileId,
        originalName: file.originalFilename || 'unknown',
        savedName: fileName,
        path: finalPath,
        size: file.size,
      });
    }

    console.log(`[UPLOAD] All files uploaded successfully. Count: ${uploadedFiles.length}`);
    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error: any) {
    console.error('[UPLOAD ERROR] Full error details:', error);
    console.error('[UPLOAD ERROR] Error stack:', error.stack);
    return NextResponse.json(
      { success: false, error: error.message || 'Upload failed' },
      { status: 500 }
    );
  }
}
