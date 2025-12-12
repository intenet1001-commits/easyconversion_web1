import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getPDFPageCount } from '@/lib/pdf-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, fileName } = await request.json();

    const filePath = path.join(process.cwd(), 'tmp', 'uploads', sessionId, fileName);
    const pageCount = await getPDFPageCount(filePath);

    return NextResponse.json({
      success: true,
      pageCount,
    });
  } catch (error: any) {
    console.error('[PDF PAGE COUNT ERROR]', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get page count' },
      { status: 500 }
    );
  }
}
