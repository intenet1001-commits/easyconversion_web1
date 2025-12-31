import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';

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
      let combinedZipPath = '';

      try {
        const formData = await request.formData();
        const filesDataStr = formData.get('filesData') as string;
        const sessionId = formData.get('sessionId') as string;

        if (!filesDataStr) {
          controller.enqueue(encoder.encode(encodeSSE({
            type: 'error',
            message: '필수 파라미터가 누락되었습니다'
          })));
          controller.close();
          return;
        }

        const filesData: UploadedFile[] = JSON.parse(filesDataStr);

        if (filesData.length === 0) {
          controller.enqueue(encoder.encode(encodeSSE({
            type: 'error',
            message: '압축 해제할 파일이 없습니다'
          })));
          controller.close();
          return;
        }

        // 출력 디렉토리 생성
        const outputDir = path.join(process.cwd(), 'public', 'output', sessionId || uuidv4());
        fs.mkdirSync(outputDir, { recursive: true });

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'progress',
          progress: 5,
          message: `${filesData.length}개 파일 처리 시작`
        })));

        // 분할 파일인지 확인 (.zip.001, .zip.002 등)
        const isSplitArchive = filesData.some(f => /\.(zip|z|7z)\.\d{3}$/i.test(f.originalName));

        let zipFilePath = '';

        if (isSplitArchive) {
          // 분할 파일을 하나로 합치기
          controller.enqueue(encoder.encode(encodeSSE({
            type: 'progress',
            progress: 10,
            message: '분할 파일 합치는 중...'
          })));

          // 파일을 파트 번호 순서로 정렬
          const sortedFiles = [...filesData].sort((a, b) => {
            const aNum = parseInt(a.originalName.match(/\.(\d{3})$/)?.[1] || '0');
            const bNum = parseInt(b.originalName.match(/\.(\d{3})$/)?.[1] || '0');
            return aNum - bNum;
          });

          // 기본 파일명 추출 (예: archive.zip.001 -> archive.zip)
          const baseFileName = sortedFiles[0].originalName.replace(/\.\d{3}$/, '');
          combinedZipPath = path.join(outputDir, `_combined_${baseFileName}`);
          zipFilePath = combinedZipPath;

          // 파일 합치기
          const writeStream = fs.createWriteStream(combinedZipPath);

          for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            controller.enqueue(encoder.encode(encodeSSE({
              type: 'progress',
              progress: Math.round(10 + (i / sortedFiles.length) * 20),
              message: `파트 ${i + 1}/${sortedFiles.length} 합치는 중: ${file.originalName}`
            })));

            const partData = fs.readFileSync(file.savedPath);
            writeStream.write(partData);
          }

          writeStream.end();
          await new Promise<void>((resolve) => writeStream.on('close', resolve));

          controller.enqueue(encoder.encode(encodeSSE({
            type: 'progress',
            progress: 35,
            message: '분할 파일 합치기 완료'
          })));
        } else {
          // 단일 ZIP 파일
          zipFilePath = filesData[0].savedPath;
        }

        // ZIP 파일 존재 확인
        if (!fs.existsSync(zipFilePath)) {
          throw new Error('ZIP 파일을 찾을 수 없습니다');
        }

        // 압축 해제할 폴더 생성
        const extractBaseName = path.basename(zipFilePath, '.zip').replace(/^_combined_/, '');
        const extractDir = path.join(outputDir, extractBaseName + '_extracted');
        fs.mkdirSync(extractDir, { recursive: true });

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'progress',
          progress: 40,
          message: '압축 해제 중...'
        })));

        // adm-zip을 사용하여 압축 해제
        const zip = new AdmZip(zipFilePath);
        const zipEntries = zip.getEntries();

        const extractedFiles: Array<{ name: string; size: number; url: string }> = [];
        const totalEntries = zipEntries.length;

        for (let i = 0; i < zipEntries.length; i++) {
          const entry = zipEntries[i];

          if (entry.isDirectory) {
            const dirPath = path.join(extractDir, entry.entryName);
            fs.mkdirSync(dirPath, { recursive: true });
          } else {
            const filePath = path.join(extractDir, entry.entryName);
            const fileDir = path.dirname(filePath);
            fs.mkdirSync(fileDir, { recursive: true });

            // 파일 추출
            const fileContent = entry.getData();
            fs.writeFileSync(filePath, fileContent);

            const relativePath = filePath.replace(path.join(process.cwd(), 'public'), '');
            extractedFiles.push({
              name: entry.entryName,
              size: entry.header.size,
              url: relativePath,
            });

            controller.enqueue(encoder.encode(encodeSSE({
              type: 'file-extracted',
              fileName: entry.entryName,
              size: entry.header.size,
              url: relativePath,
            })));
          }

          // 진행률 업데이트 (40% ~ 95%)
          const progress = Math.round(40 + (i / totalEntries) * 55);
          if (i % Math.max(1, Math.floor(totalEntries / 10)) === 0) {
            controller.enqueue(encoder.encode(encodeSSE({
              type: 'progress',
              progress,
              message: `파일 추출 중: ${i + 1}/${totalEntries}`
            })));
          }
        }

        // 합쳐진 임시 ZIP 파일 삭제
        if (combinedZipPath && fs.existsSync(combinedZipPath)) {
          try {
            fs.unlinkSync(combinedZipPath);
          } catch (e) {
            // 무시
          }
        }

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

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'progress',
          progress: 100,
          message: '압축 해제 완료'
        })));

        // 추출 폴더의 상대 경로
        const extractDirRelative = extractDir.replace(path.join(process.cwd(), 'public'), '');

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'complete',
          totalFiles: extractedFiles.length,
          files: extractedFiles,
          extractDir: extractDirRelative,
        })));

      } catch (error: any) {
        // 에러 발생 시 임시 파일 정리
        if (combinedZipPath && fs.existsSync(combinedZipPath)) {
          try {
            fs.unlinkSync(combinedZipPath);
          } catch (e) {
            // 무시
          }
        }

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'error',
          message: error.message || '압축 해제 중 오류가 발생했습니다'
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
