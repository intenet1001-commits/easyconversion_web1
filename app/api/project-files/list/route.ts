import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';

interface FileInfo {
  name: string;
  path: string;
  size: number;
  sessionId: string;
  createdAt: number;
}

export async function GET(request: NextRequest) {
  try {
    const downloadsDir = path.join(process.cwd(), 'public', 'downloads');

    if (!existsSync(downloadsDir)) {
      return NextResponse.json({ success: true, files: [] });
    }

    const files: FileInfo[] = [];
    const sessionDirs = await readdir(downloadsDir);

    // 각 세션 폴더를 순회
    for (const sessionId of sessionDirs) {
      const sessionPath = path.join(downloadsDir, sessionId);
      const sessionStat = await stat(sessionPath);

      if (sessionStat.isDirectory()) {
        const sessionFiles = await readdir(sessionPath);

        for (const fileName of sessionFiles) {
          const filePath = path.join(sessionPath, fileName);
          const fileStat = await stat(filePath);

          if (fileStat.isFile()) {
            files.push({
              name: fileName,
              // 파일명에 URL 특수문자(#, ? 등)가 포함될 수 있어 인코딩해서 내려준다.
              // (# 는 fetch/브라우저가 URL 프래그먼트로 해석해 요청 경로가 잘려나가
              // "#"부터 나머지 파일명이 누락되고, 이 때문에 존재하는 파일도 404가 났었다.)
              path: `/downloads/${encodeURIComponent(sessionId)}/${encodeURIComponent(fileName)}`,
              size: fileStat.size,
              sessionId,
              createdAt: fileStat.mtimeMs,
            });
          }
        }
      }
    }

    // 최신 파일부터 정렬
    files.sort((a, b) => b.createdAt - a.createdAt);

    // 전체 용량 계산
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);

    return NextResponse.json({ success: true, files, totalSize });
  } catch (error: any) {
    console.error('[PROJECT FILES LIST ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to list files' },
      { status: 500 }
    );
  }
}
