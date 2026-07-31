import { NextRequest, NextResponse } from 'next/server';
import { detectYouTubeUrlType, getYouTubeInfo, getYouTubePlaylistInfo } from '@/lib/youtube';

export async function POST(request: NextRequest) {
  try {
    const { url, cookies } = await request.json();
    const urlType = detectYouTubeUrlType(url);

    if (urlType === 'playlist') {
      const playlist = await getYouTubePlaylistInfo(url, cookies);
      return NextResponse.json({ success: true, type: 'playlist', playlist });
    }

    const info = await getYouTubeInfo(url, cookies);
    return NextResponse.json({ success: true, type: 'video', info });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 }
    );
  }
}
