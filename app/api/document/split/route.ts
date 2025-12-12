import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { splitPDF, getPDFPageCount } from '@/lib/pdf-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const fileData = formData.get('fileData') as string;
    const sessionId = formData.get('sessionId') as string;
    const ranges = formData.get('ranges') as string; // JSON array of {start, end, name?}
    const parsedFile = JSON.parse(fileData);
    const parsedRanges = JSON.parse(ranges);

    // 입력 파일 경로
    const inputPath = path.join(process.cwd(), 'tmp', 'uploads', sessionId, parsedFile.savedName);

    // 출력 디렉토리
    const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
    await mkdir(outputDir, { recursive: true });

    // 페이지 수 확인
    const pageCount = await getPDFPageCount(inputPath);

    const outputUrls: string[] = [];
    const baseName = parsedFile.originalName.replace(/\.pdf$/i, '');

    // 각 범위별로 분할
    for (let i = 0; i < parsedRanges.length; i++) {
      const range = parsedRanges[i];
      const { start, end, name } = range;

      // 유효성 검사
      if (start < 1 || end > pageCount || start > end) {
        throw new Error(`범위 ${i + 1}이 잘못되었습니다: ${start}-${end} (총 ${pageCount} 페이지)`);
      }

      const outputFileName = name
        ? `${name}.pdf`
        : `${baseName}_pages${start}-${end}.pdf`;

      const outputPath = path.join(outputDir, outputFileName);

      await splitPDF(inputPath, outputPath, start, end);

      outputUrls.push(`/downloads/${sessionId}/${outputFileName}`);
    }

    return NextResponse.json({
      success: true,
      outputUrls,
      message: `${parsedRanges.length}개 파일로 분할되었습니다.`,
    });
  } catch (error: any) {
    console.error('[DOCUMENT SPLIT ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'PDF 분할 실패' },
      { status: 500 }
    );
  }
}
