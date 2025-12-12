import { NextResponse } from 'next/server';
import { readdir, stat, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * tmp/uploads 폴더 전체 비우기 (모든 세션 삭제)
 * 주의: 현재 활성 세션도 삭제됨!
 */
export async function POST() {
  try {
    const uploadsDir = path.join(process.cwd(), 'tmp', 'uploads');

    if (!existsSync(uploadsDir)) {
      return NextResponse.json({
        success: true,
        message: 'No uploads directory found',
        deletedSessions: [],
        freedSpace: 0,
      });
    }

    const deletedSessions: string[] = [];
    let totalFreedSpace = 0;

    // tmp/uploads의 모든 폴더/파일 확인
    const entries = await readdir(uploadsDir, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(uploadsDir, entry.name);

      try {
        // 폴더 크기 계산
        const size = entry.isDirectory()
          ? await getFolderSize(entryPath)
          : (await stat(entryPath)).size;

        // 삭제 전 로그
        console.log(`[CLEANUP-UPLOADS] Deleting: ${entry.name} (size: ${(size / (1024 * 1024)).toFixed(2)}MB)`);

        // 삭제
        await rm(entryPath, { recursive: true, force: true });

        deletedSessions.push(entry.name);
        totalFreedSpace += size;
      } catch (error: any) {
        console.error(`[CLEANUP-UPLOADS] Error deleting ${entry.name}:`, error.message);
        // 개별 실패는 무시하고 계속 진행
      }
    }

    const freedSpaceMB = (totalFreedSpace / (1024 * 1024)).toFixed(2);
    const freedSpaceGB = (totalFreedSpace / (1024 * 1024 * 1024)).toFixed(2);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedSessions.length} items`,
      deletedSessions,
      freedSpace: totalFreedSpace,
      freedSpaceMB: `${freedSpaceMB}MB`,
      freedSpaceGB: `${freedSpaceGB}GB`,
    });
  } catch (error: any) {
    console.error('[CLEANUP-UPLOADS ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Cleanup failed' },
      { status: 500 }
    );
  }
}

/**
 * 폴더 크기 계산 (재귀)
 */
async function getFolderSize(folderPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const entries = await readdir(folderPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);

      if (entry.isDirectory()) {
        totalSize += await getFolderSize(entryPath);
      } else {
        const stats = await stat(entryPath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    // 접근 불가 폴더는 무시
  }

  return totalSize;
}

/**
 * GET 요청 - 전체 크기 확인만 (삭제 안 함)
 */
export async function GET() {
  try {
    const uploadsDir = path.join(process.cwd(), 'tmp', 'uploads');

    if (!existsSync(uploadsDir)) {
      return NextResponse.json({
        success: true,
        totalSessions: 0,
        totalSize: 0,
        totalSizeMB: '0MB',
        totalSizeGB: '0GB',
      });
    }

    const entries = await readdir(uploadsDir, { withFileTypes: true });
    let totalSize = 0;
    const sessions: any[] = [];

    for (const entry of entries) {
      const entryPath = path.join(uploadsDir, entry.name);

      try {
        const stats = await stat(entryPath);
        const size = entry.isDirectory()
          ? await getFolderSize(entryPath)
          : stats.size;

        const sizeMB = (size / (1024 * 1024)).toFixed(2);
        const ageHours = Math.round((Date.now() - stats.mtimeMs) / (60 * 60 * 1000));

        sessions.push({
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
          ageHours,
          sizeMB: `${sizeMB}MB`,
          sizeBytes: size,
        });

        totalSize += size;
      } catch (error) {
        // 무시
      }
    }

    return NextResponse.json({
      success: true,
      totalSessions: sessions.length,
      sessions,
      totalSize,
      totalSizeMB: `${(totalSize / (1024 * 1024)).toFixed(2)}MB`,
      totalSizeGB: `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)}GB`,
    });
  } catch (error: any) {
    console.error('[CLEANUP-UPLOADS CHECK ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
