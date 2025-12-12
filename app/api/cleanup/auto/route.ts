import { NextResponse } from 'next/server';
import { readdir, stat, rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

/**
 * 오래된 세션 자동 정리 API
 * - 24시간 이상 지난 세션 폴더만 삭제
 * - tmp/uploads만 대상 (public/downloads는 건드리지 않음)
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

    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24시간 (밀리초)

    const deletedSessions: string[] = [];
    let totalFreedSpace = 0;

    // tmp/uploads의 모든 폴더 확인
    const entries = await readdir(uploadsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sessionPath = path.join(uploadsDir, entry.name);

      try {
        const stats = await stat(sessionPath);
        const age = now - stats.mtimeMs; // 마지막 수정 시간 기준

        // 24시간 이상 지난 세션만 삭제
        if (age > maxAge) {
          // 폴더 크기 계산
          const size = await getFolderSize(sessionPath);

          // 삭제 전 로그
          console.log(`[AUTO-CLEANUP] Deleting old session: ${entry.name} (age: ${Math.round(age / (60 * 60 * 1000))}h, size: ${(size / (1024 * 1024)).toFixed(2)}MB)`);

          // 폴더 삭제
          await rm(sessionPath, { recursive: true, force: true });

          deletedSessions.push(entry.name);
          totalFreedSpace += size;
        } else {
          console.log(`[AUTO-CLEANUP] Keeping recent session: ${entry.name} (age: ${Math.round(age / (60 * 60 * 1000))}h)`);
        }
      } catch (error: any) {
        console.error(`[AUTO-CLEANUP] Error processing ${entry.name}:`, error.message);
        // 개별 폴더 처리 실패는 무시하고 계속 진행
      }
    }

    const freedSpaceMB = (totalFreedSpace / (1024 * 1024)).toFixed(2);
    const freedSpaceGB = (totalFreedSpace / (1024 * 1024 * 1024)).toFixed(2);

    return NextResponse.json({
      success: true,
      message: `Cleaned up ${deletedSessions.length} old sessions`,
      deletedSessions,
      freedSpace: totalFreedSpace,
      freedSpaceMB: `${freedSpaceMB}MB`,
      freedSpaceGB: `${freedSpaceGB}GB`,
    });
  } catch (error: any) {
    console.error('[AUTO-CLEANUP ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Auto cleanup failed' },
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
 * GET 요청 - 정리 대상 확인만 (실제 삭제 안 함)
 */
export async function GET() {
  try {
    const uploadsDir = path.join(process.cwd(), 'tmp', 'uploads');

    if (!existsSync(uploadsDir)) {
      return NextResponse.json({
        success: true,
        oldSessions: [],
        recentSessions: [],
        totalOldSize: 0,
      });
    }

    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    const oldSessions: any[] = [];
    const recentSessions: any[] = [];
    let totalOldSize = 0;

    const entries = await readdir(uploadsDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const sessionPath = path.join(uploadsDir, entry.name);

      try {
        const stats = await stat(sessionPath);
        const age = now - stats.mtimeMs;
        const size = await getFolderSize(sessionPath);
        const ageHours = Math.round(age / (60 * 60 * 1000));
        const sizeMB = (size / (1024 * 1024)).toFixed(2);

        const sessionInfo = {
          name: entry.name,
          ageHours,
          sizeMB: `${sizeMB}MB`,
          sizeBytes: size,
        };

        if (age > maxAge) {
          oldSessions.push(sessionInfo);
          totalOldSize += size;
        } else {
          recentSessions.push(sessionInfo);
        }
      } catch (error) {
        // 무시
      }
    }

    return NextResponse.json({
      success: true,
      oldSessions,
      recentSessions,
      totalOldSize,
      totalOldSizeMB: `${(totalOldSize / (1024 * 1024)).toFixed(2)}MB`,
      totalOldSizeGB: `${(totalOldSize / (1024 * 1024 * 1024)).toFixed(2)}GB`,
    });
  } catch (error: any) {
    console.error('[AUTO-CLEANUP CHECK ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
