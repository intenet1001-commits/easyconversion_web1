import { NextRequest, NextResponse } from 'next/server';
import { getYouTubeInfo } from '@/lib/youtube';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();
    const info = await getYouTubeInfo(url);
    return NextResponse.json({ success: true, info });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
