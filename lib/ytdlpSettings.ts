// yt-dlp 쿠키 설정을 위한 유틸리티 함수

export type CookieSettings = {
  mode: 'none' | 'browser' | 'file';
  browser: 'chrome' | 'edge' | 'whale' | 'firefox' | 'brave' | 'vivaldi';
  profile?: string;
  cookieFilePath?: string;
};

const YTDLP_SETTINGS_KEY = 'easyconversion_ytdlp_cookies';

const DEFAULT_COOKIE_SETTINGS: CookieSettings = {
  mode: 'none',
  browser: 'chrome',
};

/**
 * localStorage에서 yt-dlp 쿠키 설정을 불러옴
 * SSR, 미존재, 파싱 오류 시 기본값 반환
 */
export function loadCookieSettings(): CookieSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_COOKIE_SETTINGS;
  }

  try {
    const stored = localStorage.getItem(YTDLP_SETTINGS_KEY);
    if (!stored) return DEFAULT_COOKIE_SETTINGS;

    const data: CookieSettings = JSON.parse(stored);
    return data;
  } catch (error) {
    console.error('Failed to load cookie settings:', error);
    return DEFAULT_COOKIE_SETTINGS;
  }
}

/**
 * yt-dlp 쿠키 설정을 localStorage에 저장
 */
export function saveCookieSettings(settings: CookieSettings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(YTDLP_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save cookie settings:', error);
  }
}
