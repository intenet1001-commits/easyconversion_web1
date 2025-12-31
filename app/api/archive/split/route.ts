import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';

interface UploadedFile {
  originalName: string;
  savedPath: string;
  size: number;
}

// SSE 인코더
function encodeSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let tempZipPath = '';

      try {
        const formData = await request.formData();
        const filesDataStr = formData.get('filesData') as string;
        const splitSizeStr = formData.get('splitSize') as string;
        const sessionId = formData.get('sessionId') as string;

        if (!filesDataStr || !splitSizeStr) {
          controller.enqueue(encoder.encode(encodeSSE({
            type: 'error',
            message: '필수 파라미터가 누락되었습니다'
          })));
          controller.close();
          return;
        }

        const filesData: UploadedFile[] = JSON.parse(filesDataStr);
        const splitSize = parseInt(splitSizeStr, 10);

        if (filesData.length === 0) {
          controller.enqueue(encoder.encode(encodeSSE({
            type: 'error',
            message: '분할할 파일이 없습니다'
          })));
          controller.close();
          return;
        }

        // 출력 디렉토리 생성
        const outputDir = path.join(process.cwd(), 'public', 'output', sessionId || uuidv4());
        fs.mkdirSync(outputDir, { recursive: true });

        // 기본 파일명 결정
        const baseFileName = filesData.length === 1
          ? path.basename(filesData[0].originalName, path.extname(filesData[0].originalName))
          : 'archive';

        // 전체 파일 크기 계산
        const totalSize = filesData.reduce((sum, f) => sum + f.size, 0);
        const estimatedParts = Math.ceil(totalSize / splitSize);

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'progress',
          progress: 5,
          message: `총 ${filesData.length}개 파일 (${(totalSize / 1024 / 1024).toFixed(1)}MB), 예상 ${estimatedParts}개 파트`
        })));

        // 1단계: 먼저 전체 ZIP 파일 생성
        controller.enqueue(encoder.encode(encodeSSE({
          type: 'progress',
          progress: 10,
          message: '압축 파일 생성 중...'
        })));

        tempZipPath = path.join(outputDir, `${baseFileName}_temp.zip`);
        const tempZipStream = fs.createWriteStream(tempZipPath);
        const archive = archiver('zip', {
          zlib: { level: 6 }
        });

        archive.pipe(tempZipStream);

        // 모든 파일을 아카이브에 추가
        for (let i = 0; i < filesData.length; i++) {
          const file = filesData[i];
          if (fs.existsSync(file.savedPath)) {
            archive.file(file.savedPath, { name: file.originalName });
            controller.enqueue(encoder.encode(encodeSSE({
              type: 'progress',
              progress: Math.round(10 + (i / filesData.length) * 30),
              message: `파일 추가 중: ${file.originalName}`
            })));
          } else {
            controller.enqueue(encoder.encode(encodeSSE({
              type: 'progress',
              progress: Math.round(10 + (i / filesData.length) * 30),
              message: `경고: 파일을 찾을 수 없음 - ${file.originalName}`
            })));
          }
        }

        await archive.finalize();

        // 압축 완료 대기
        await new Promise<void>((resolve, reject) => {
          tempZipStream.on('close', resolve);
          tempZipStream.on('error', reject);
        });

        const zipStats = fs.statSync(tempZipPath);
        const zipSize = zipStats.size;

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'progress',
          progress: 45,
          message: `압축 완료: ${(zipSize / 1024 / 1024).toFixed(1)}MB`
        })));

        // 2단계: ZIP 파일을 분할 크기로 나누기
        const actualParts = Math.ceil(zipSize / splitSize);
        const results: Array<{ fileName: string; url: string; size: number; partNumber: number }> = [];

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'progress',
          progress: 50,
          message: `${actualParts}개 파트로 분할 중...`
        })));

        // ZIP 파일 읽기
        const zipBuffer = fs.readFileSync(tempZipPath);

        for (let partNum = 1; partNum <= actualParts; partNum++) {
          const startOffset = (partNum - 1) * splitSize;
          const endOffset = Math.min(partNum * splitSize, zipSize);
          const partData = zipBuffer.slice(startOffset, endOffset);

          // 파트 파일명 생성
          const partFileName = actualParts === 1
            ? `${baseFileName}.zip`
            : `${baseFileName}.zip.${String(partNum).padStart(3, '0')}`;
          const partFilePath = path.join(outputDir, partFileName);

          // 파트 파일 저장
          fs.writeFileSync(partFilePath, partData);

          const partStats = fs.statSync(partFilePath);
          const relativePath = partFilePath.replace(path.join(process.cwd(), 'public'), '');

          results.push({
            fileName: partFileName,
            url: relativePath,
            size: partStats.size,
            partNumber: partNum,
          });

          controller.enqueue(encoder.encode(encodeSSE({
            type: 'part-complete',
            partNumber: partNum,
            fileName: partFileName,
            url: relativePath,
            size: partStats.size,
          })));

          controller.enqueue(encoder.encode(encodeSSE({
            type: 'progress',
            progress: Math.round(50 + (partNum / actualParts) * 45),
            message: `파트 ${partNum}/${actualParts} 완료: ${partFileName}`
          })));
        }

        // 임시 ZIP 파일 삭제
        try {
          fs.unlinkSync(tempZipPath);
        } catch (e) {
          // 무시
        }

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'progress',
          progress: 100,
          message: '분할 압축 완료'
        })));

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'complete',
          totalParts: results.length,
          files: results,
        })));

        // 원본 업로드된 파일 정리
        for (const file of filesData) {
          try {
            if (fs.existsSync(file.savedPath)) {
              fs.unlinkSync(file.savedPath);
            }
          } catch (e) {
            // 정리 실패해도 계속 진행
          }
        }

      } catch (error: any) {
        // 에러 발생 시 임시 파일 정리
        if (tempZipPath && fs.existsSync(tempZipPath)) {
          try {
            fs.unlinkSync(tempZipPath);
          } catch (e) {
            // 무시
          }
        }

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'error',
          message: error.message || '분할 압축 중 오류가 발생했습니다'
        })));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
