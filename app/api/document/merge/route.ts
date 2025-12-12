import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { mergePDFs } from '@/lib/pdf-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const filesData = formData.get('filesData') as string;
    const sessionId = formData.get('sessionId') as string;
    const parsedFiles = JSON.parse(filesData);

    // 입력 파일 경로들
    const inputPaths = parsedFiles.map((f: any) =>
      path.join(process.cwd(), 'tmp', 'uploads', sessionId, f.savedName)
    );

    // 출력 디렉토리
    const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
    await mkdir(outputDir, { recursive: true });

    const outputFileName = `merged_${Date.now()}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);

    // PDF 병합
    await mergePDFs(inputPaths, outputPath);

    const outputUrl = `/downloads/${sessionId}/${outputFileName}`;

    return NextResponse.json({
      success: true,
      outputUrl,
      message: `${parsedFiles.length}개 파일이 병합되었습니다.`,
    });
  } catch (error: any) {
    console.error('[DOCUMENT MERGE ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'PDF 병합 실패' },
      { status: 500 }
    );
  }
}
