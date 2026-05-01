import { NextRequest } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

const execFileAsync = promisify(execFile);

interface UploadedFile {
  originalName: string;
  savedPath: string;
  size: number;
}

interface PartResult {
  fileName: string;
  url: string;
  size: number;
  partNumber: number;
}

function encodeSSE(data: object): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const formData = await request.formData();
        const filesDataStr = formData.get('filesData') as string;
        const splitSizeStr = formData.get('splitSize') as string;
        const sessionId = formData.get('sessionId') as string;
        const enableSplit = formData.get('enableSplit') !== 'false';
        const password = (formData.get('password') as string) || '';

        if (!filesDataStr) {
          controller.enqueue(encoder.encode(encodeSSE({ type: 'error', message: '필수 파라미터가 누락되었습니다' })));
          controller.close();
          return;
        }

        const filesData: UploadedFile[] = JSON.parse(filesDataStr);
        const splitSize = parseInt(splitSizeStr || '104857600', 10);

        if (filesData.length === 0) {
          controller.enqueue(encoder.encode(encodeSSE({ type: 'error', message: '압축할 파일이 없습니다' })));
          controller.close();
          return;
        }

        const outputDir = path.join(process.cwd(), 'public', 'output', sessionId || uuidv4());
        fs.mkdirSync(outputDir, { recursive: true });

        const baseFileName = filesData.length === 1
          ? path.basename(filesData[0].originalName, path.extname(filesData[0].originalName))
          : 'archive';

        const totalSize = filesData.reduce((sum, f) => sum + f.size, 0);

        controller.enqueue(encoder.encode(encodeSSE({
          type: 'progress',
          progress: 5,
          message: `총 ${filesData.length}개 파일 (${(totalSize / 1024 / 1024).toFixed(1)}MB) 처리 중...`,
        })));

        if (password) {
          await processWithSevenZip(filesData, outputDir, baseFileName, password, enableSplit, splitSize, controller, encoder);
        } else if (enableSplit) {
          await processWithArchiverSplit(filesData, outputDir, baseFileName, splitSize, controller, encoder);
        } else {
          await processWithArchiverSingle(filesData, outputDir, baseFileName, controller, encoder);
        }

        for (const file of filesData) {
          try {
            if (fs.existsSync(file.savedPath)) fs.unlinkSync(file.savedPath);
          } catch {}
        }

      } catch (error: any) {
        controller.enqueue(encoder.encode(encodeSSE({
          type: 'error',
          message: error.message || '압축 중 오류가 발생했습니다',
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

async function processWithSevenZip(
  filesData: UploadedFile[],
  outputDir: string,
  baseFileName: string,
  password: string,
  enableSplit: boolean,
  splitSize: number,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const sevenZipPath = process.env.SEVENZIP_PATH || '/opt/homebrew/bin/7z';

  // 원본 파일명으로 스테이징 디렉토리에 복사
  const stagingDir = path.join(outputDir, '_staging');
  fs.mkdirSync(stagingDir, { recursive: true });

  controller.enqueue(encoder.encode(encodeSSE({ type: 'progress', progress: 15, message: '파일 준비 중...' })));

  const stagedFiles: string[] = [];
  for (const file of filesData) {
    if (fs.existsSync(file.savedPath)) {
      const dest = path.join(stagingDir, file.originalName);
      fs.copyFileSync(file.savedPath, dest);
      stagedFiles.push(dest);
    }
  }

  const outputZipPath = path.join(outputDir, `${baseFileName}.zip`);
  const args = ['a', '-tzip', `-p${password}`, '-mem=AES256'];
  if (enableSplit) args.push(`-v${splitSize}b`);
  args.push(outputZipPath, ...stagedFiles);

  controller.enqueue(encoder.encode(encodeSSE({
    type: 'progress',
    progress: 30,
    message: `비밀번호 적용${enableSplit ? ' + 분할' : ''} 압축 중...`,
  })));

  await execFileAsync(sevenZipPath, args);

  fs.rmSync(stagingDir, { recursive: true, force: true });

  controller.enqueue(encoder.encode(encodeSSE({ type: 'progress', progress: 80, message: '파일 목록 확인 중...' })));

  const resultFiles = fs.readdirSync(outputDir)
    .filter(f => f.startsWith(baseFileName + '.zip'))
    .sort();

  const results: PartResult[] = resultFiles.map((fileName, idx) => {
    const filePath = path.join(outputDir, fileName);
    const stats = fs.statSync(filePath);
    const url = filePath.replace(path.join(process.cwd(), 'public'), '');
    return { fileName, url, size: stats.size, partNumber: idx + 1 };
  });

  for (const result of results) {
    controller.enqueue(encoder.encode(encodeSSE({ type: 'part-complete', ...result })));
  }

  controller.enqueue(encoder.encode(encodeSSE({ type: 'progress', progress: 100, message: '압축 완료 (비밀번호 적용)' })));
  controller.enqueue(encoder.encode(encodeSSE({ type: 'complete', totalParts: results.length, files: results })));
}

async function processWithArchiverSingle(
  filesData: UploadedFile[],
  outputDir: string,
  baseFileName: string,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const outputZipPath = path.join(outputDir, `${baseFileName}.zip`);
  const writeStream = fs.createWriteStream(outputZipPath);
  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.pipe(writeStream);

  for (let i = 0; i < filesData.length; i++) {
    const file = filesData[i];
    if (fs.existsSync(file.savedPath)) {
      archive.file(file.savedPath, { name: file.originalName });
    }
    controller.enqueue(encoder.encode(encodeSSE({
      type: 'progress',
      progress: Math.round(20 + (i / filesData.length) * 60),
      message: `파일 추가 중: ${file.originalName}`,
    })));
  }

  await archive.finalize();
  await new Promise<void>((resolve, reject) => {
    writeStream.on('close', resolve);
    writeStream.on('error', reject);
  });

  const stats = fs.statSync(outputZipPath);
  const url = outputZipPath.replace(path.join(process.cwd(), 'public'), '');
  const result: PartResult = { fileName: `${baseFileName}.zip`, url, size: stats.size, partNumber: 1 };

  controller.enqueue(encoder.encode(encodeSSE({ type: 'part-complete', ...result })));
  controller.enqueue(encoder.encode(encodeSSE({ type: 'progress', progress: 100, message: `압축 완료: ${baseFileName}.zip` })));
  controller.enqueue(encoder.encode(encodeSSE({ type: 'complete', totalParts: 1, files: [result] })));
}

async function processWithArchiverSplit(
  filesData: UploadedFile[],
  outputDir: string,
  baseFileName: string,
  splitSize: number,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
) {
  const tempZipPath = path.join(outputDir, `${baseFileName}_temp.zip`);
  const tempZipStream = fs.createWriteStream(tempZipPath);
  const archive = archiver('zip', { zlib: { level: 6 } });

  archive.pipe(tempZipStream);

  for (let i = 0; i < filesData.length; i++) {
    const file = filesData[i];
    if (fs.existsSync(file.savedPath)) {
      archive.file(file.savedPath, { name: file.originalName });
    }
    controller.enqueue(encoder.encode(encodeSSE({
      type: 'progress',
      progress: Math.round(10 + (i / filesData.length) * 30),
      message: `파일 추가 중: ${file.originalName}`,
    })));
  }

  await archive.finalize();
  await new Promise<void>((resolve, reject) => {
    tempZipStream.on('close', resolve);
    tempZipStream.on('error', reject);
  });

  const zipSize = fs.statSync(tempZipPath).size;
  const actualParts = Math.ceil(zipSize / splitSize);

  controller.enqueue(encoder.encode(encodeSSE({
    type: 'progress',
    progress: 45,
    message: `압축 완료: ${(zipSize / 1024 / 1024).toFixed(1)}MB → ${actualParts}개 파트로 분할 중...`,
  })));

  const zipBuffer = fs.readFileSync(tempZipPath);
  const results: PartResult[] = [];

  for (let partNum = 1; partNum <= actualParts; partNum++) {
    const startOffset = (partNum - 1) * splitSize;
    const partData = zipBuffer.slice(startOffset, Math.min(partNum * splitSize, zipSize));

    const partFileName = actualParts === 1
      ? `${baseFileName}.zip`
      : `${baseFileName}.zip.${String(partNum).padStart(3, '0')}`;
    const partFilePath = path.join(outputDir, partFileName);

    fs.writeFileSync(partFilePath, partData);

    const stats = fs.statSync(partFilePath);
    const url = partFilePath.replace(path.join(process.cwd(), 'public'), '');

    results.push({ fileName: partFileName, url, size: stats.size, partNumber: partNum });

    controller.enqueue(encoder.encode(encodeSSE({ type: 'part-complete', partNumber: partNum, fileName: partFileName, url, size: stats.size })));
    controller.enqueue(encoder.encode(encodeSSE({
      type: 'progress',
      progress: Math.round(50 + (partNum / actualParts) * 45),
      message: `파트 ${partNum}/${actualParts} 완료`,
    })));
  }

  try { fs.unlinkSync(tempZipPath); } catch {}

  controller.enqueue(encoder.encode(encodeSSE({ type: 'progress', progress: 100, message: '분할 압축 완료' })));
  controller.enqueue(encoder.encode(encodeSSE({ type: 'complete', totalParts: results.length, files: results })));
}
