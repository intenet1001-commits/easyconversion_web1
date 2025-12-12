import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { unlink, rm } from 'fs/promises';
import { existsSync } from 'fs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { filePaths, deleteAll } = await request.json();

    if (deleteAll) {
      // 전체 삭제: public/downloads 폴더 전체 삭제
      const downloadsDir = path.join(process.cwd(), 'public', 'downloads');

      if (existsSync(downloadsDir)) {
        await rm(downloadsDir, { recursive: true, force: true });
        console.log('[PROJECT FILES] Deleted all files');
      }

      return NextResponse.json({
        success: true,
        message: '모든 파일이 삭제되었습니다',
      });
    }

    if (!filePaths || !Array.isArray(filePaths)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file paths' },
        { status: 400 }
      );
    }

    // 선택 삭제
    let deletedCount = 0;
    for (const filePath of filePaths) {
      // /downloads/{sessionId}/{fileName} 형식
      const fullPath = path.join(process.cwd(), 'public', filePath);

      if (existsSync(fullPath)) {
        await unlink(fullPath);
        deletedCount++;
        console.log('[PROJECT FILES] Deleted:', filePath);
      }
    }

    return NextResponse.json({
      success: true,
      message: `${deletedCount}개 파일이 삭제되었습니다`,
      deletedCount,
    });
  } catch (error: any) {
    console.error('[PROJECT FILES DELETE ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete files' },
      { status: 500 }
    );
  }
}
