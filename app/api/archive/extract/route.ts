import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import AdmZip from 'adm-zip';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface UploadedFile {
  originalName: string;
  savedPath: string;
  size: number;
}

// SSE 인코더
function encodeSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

// 디렉토리 내 모든 파일 재귀적으로 가져오기
function getAllFiles(dirPath: string, basePath: string = dirPath): Array<{ name: string; size: number; fullPath: string }> {
  const files: Array<{ name: string; size: number; fullPath: string }> = [];

  if (!fs.existsSync(dirPath)) return files;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllFiles(fullPath, basePath));
    } else {
      const stats = fs.statSync(fullPath);
      const relativeName = path.relative(basePath, fullPath);
      files.push({
        name: relativeName,
        size: stats.size,
        fullPath,
      });
    }
  }

  return files;
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

        // WinZip 스타일 분할 파일인지 확인 (.z01, .z02 등)
        const isWinZipSplit = filesData.some(f => /\.z\d{2}$/i.test(f.originalName));

        // 일반 분할 파일인지 확인 (.zip.001, .zip.002 등)
        const isStandardSplit = filesData.some(f => /\.(zip|7z)\.\d{3}$/i.test(f.originalName));

        let zipFilePath = '';
        let extractDir = '';
        const extractedFiles: Array<{ name: string; size: number; url: string }> = [];

        if (isWinZipSplit) {
          // WinZip 스타일 분할 압축 (.z01, .z02, ... + .zip)
          // 7z 명령어 사용
          controller.enqueue(encoder.encode(encodeSSE({
            type: 'progress',
            progress: 10,
            message: 'WinZip 분할 압축 파일 처리 중...'
          })));

          // .zip 파일 찾기 (메인 파일)
          const mainZipFile = filesData.find(f => f.originalName.toLowerCase().endsWith('.zip'));
          if (!mainZipFile) {
            throw new Error('.zip 파일이 필요합니다. 분할 압축의 모든 파일(.z01, .z02, ... 및 .zip)을 함께 업로드해주세요.');
          }

          // 추출 디렉토리 생성
          const baseName = path.basename(mainZipFile.originalName, '.zip');
          extractDir = path.join(outputDir, baseName + '_extracted');
          fs.mkdirSync(extractDir, { recursive: true });

          controller.enqueue(encoder.encode(encodeSSE({
            type: 'progress',
            progress: 30,
            message: '7z로 압축 해제 중...'
          })));

          // 7z 명령어로 압축 해제 (.zip 파일 경로 사용, 7z가 자동으로 .z01 등을 찾음)
          try {
            const { stdout, stderr } = await execAsync(
              `7z x "${mainZipFile.savedPath}" -o"${extractDir}" -y`,
              { maxBuffer: 50 * 1024 * 1024 }
            );
            console.log('7z stdout:', stdout);
            if (stderr) console.log('7z stderr:', stderr);
          } catch (error: any) {
            // 7z가 없으면 설치 안내
            if (error.message.includes('not found') || error.message.includes('ENOENT')) {
              throw new Error('7z가 설치되어 있지 않습니다. WinZip 분할 압축 파일을 해제하려면 p7zip을 설치해주세요.');
            }
            throw new Error(`압축 해제 실패: ${error.message}`);
          }

          controller.enqueue(encoder.encode(encodeSSE({
            type: 'progress',
            progress: 80,
            message: '파일 목록 생성 중...'
          })));

          // 추출된 파일 목록 생성
          const files = getAllFiles(extractDir);
          for (const file of files) {
            const relativePath = file.fullPath.replace(path.join(process.cwd(), 'public'), '');
            extractedFiles.push({
              name: file.name,
              size: file.size,
              url: relativePath,
            });

            controller.enqueue(encoder.encode(encodeSSE({
              type: 'file-extracted',
              fileName: file.name,
              size: file.size,
              url: relativePath,
            })));
          }

        } else if (isStandardSplit) {
          // 표준 분할 파일 (.zip.001, .zip.002 등) - 파일 합치기
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

          // 압축 해제할 폴더 생성
          const extractBaseName = path.basename(zipFilePath, '.zip').replace(/^_combined_/, '');
          extractDir = path.join(outputDir, extractBaseName + '_extracted');
          fs.mkdirSync(extractDir, { recursive: true });

          // adm-zip으로 압축 해제
          await extractWithAdmZip(zipFilePath, extractDir, extractedFiles, controller, encoder);

        } else {
          // 단일 ZIP 파일
          zipFilePath = filesData[0].savedPath;

          // ZIP 파일 존재 확인
          if (!fs.existsSync(zipFilePath)) {
            throw new Error('ZIP 파일을 찾을 수 없습니다');
          }

          // 압축 해제할 폴더 생성
          const extractBaseName = path.basename(filesData[0].originalName, '.zip');
          extractDir = path.join(outputDir, extractBaseName + '_extracted');
          fs.mkdirSync(extractDir, { recursive: true });

          // adm-zip으로 압축 해제
          await extractWithAdmZip(zipFilePath, extractDir, extractedFiles, controller, encoder);
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

// adm-zip을 사용한 압축 해제 함수
async function extractWithAdmZip(
  zipFilePath: string,
  extractDir: string,
  extractedFiles: Array<{ name: string; size: number; url: string }>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder
) {
  controller.enqueue(encoder.encode(encodeSSE({
    type: 'progress',
    progress: 40,
    message: '압축 해제 중...'
  })));

  const zip = new AdmZip(zipFilePath);
  const zipEntries = zip.getEntries();
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
}
