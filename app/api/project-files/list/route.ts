import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
              path: `/downloads/${sessionId}/${fileName}`,
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
