import { NextRequest, NextResponse } from 'next/server';
import { listBrowserProfiles } from '@/lib/youtube';

export async function GET(request: NextRequest) {
  const browser = request.nextUrl.searchParams.get('browser') || 'chrome';
  const profiles = listBrowserProfiles(browser);
  return NextResponse.json({ success: true, profiles });
}
