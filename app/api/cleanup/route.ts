import { NextRequest, NextResponse } from 'next/server';
import { rm } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // 세션 업로드 디렉토리 (임시 파일만 삭제)
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);

    // 다운로드 파일은 영구 보관 (삭제하지 않음)
    let deletedCount = 0;

    // 업로드 디렉토리만 삭제
    if (existsSync(uploadDir)) {
      await rm(uploadDir, { recursive: true, force: true });
      deletedCount++;
      console.log(`[CLEANUP] Deleted upload directory: ${uploadDir}`);
    } else {
      console.log(`[CLEANUP] Upload directory not found: ${uploadDir}`);
    }

    if (deletedCount === 0) {
      console.log(`[CLEANUP] No directories found for session: ${sessionId}`);
    }

    return NextResponse.json({
      success: true,
      message: `${deletedCount} directories cleaned up`,
    });
  } catch (error: any) {
    console.error('[CLEANUP ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Cleanup failed' },
      { status: 500 }
    );
  }
}
