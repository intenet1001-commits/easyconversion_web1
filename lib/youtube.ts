import { spawn, execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

let cachedYtDlpPath: string | null = null;

function resolveYtDlpPath(): string {
  if (cachedYtDlpPath) return cachedYtDlpPath;

  const home = os.homedir();
  const candidates = [
    process.env.YTDLP_PATH,
    path.join(home, '.pyenv', 'shims', 'yt-dlp'),
    '/opt/homebrew/bin/yt-dlp',
    '/opt/homebrew/anaconda3/bin/yt-dlp',
    '/usr/local/bin/yt-dlp',
    'yt-dlp',
  ].filter((p): p is string => Boolean(p));

  let best: { path: string; version: string } | null = null;
  for (const candidate of candidates) {
    try {
      const version = execFileSync(candidate, ['--version'], { encoding: 'utf-8', timeout: 5000 }).trim();
      if (!best || version > best.version) {
        best = { path: candidate, version };
      }
    } catch {
      continue;
    }
  }

  cachedYtDlpPath = best?.path ?? 'yt-dlp';
  if (process.env.YTDLP_DEBUG) {
    console.log('[yt-dlp resolved]', cachedYtDlpPath, best?.version ?? '(none found, falling back to PATH)');
  }
  return cachedYtDlpPath;
}

// 유튜브의 서명(n-challenge) 해독을 위해 yt-dlp가 필요로 하는 원격 챌린지 솔버
// 스크립트(EJS) 다운로드를 허용한다. deno 등 JS 런타임만 설치돼 있어도 이 컴포넌트가
// 없으면 "n challenge solving failed"로 대부분의 포맷이 비어버린다.
const REMOTE_COMPONENTS_ARGS = ['--remote-components', 'ejs:github'];

// yt-dlp가 내부적으로 호출하는 python 환경의 잡음(pip 의존성 경고 등)을 걸러내고
// 실제 원인 파악에 도움되는 줄(ERROR: 로 시작하는 줄 우선)만 추려서 반환한다.
function extractErrorDetail(stderr: string, maxLines = 5): string {
  const lines = stderr
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/Warning|warnings\.warn\(/i.test(line));

  const errorLines = lines.filter((line) => /^ERROR:/.test(line));
  const relevant = errorLines.length > 0 ? errorLines : lines;
  return relevant.slice(-maxLines).join(' | ');
}

export type BrowserProfile = {
  folder: string; // yt-dlp --cookies-from-browser에 실제로 넘겨야 하는 값 (예: "Profile 1")
  displayName: string; // Chrome 등 브라우저 UI에 표시되는 이름 (예: "chunsung") — 혼동 방지용, --cookies-from-browser에는 사용 불가
  email?: string;
};

// 크로미움 계열 브라우저의 프로필 목록을 Local State 파일에서 읽어온다.
// 사용자가 화면에 보이는 표시 이름(displayName)과 yt-dlp가 요구하는 실제 폴더명(folder)을
// 혼동해서 잘못 입력하는 문제를 막기 위해, 폴더명 대신 실제 프로필을 골라 선택하게 한다.
const BROWSER_PROFILE_DIR_SEGMENTS: Record<string, string[]> = {
  chrome: ['Google', 'Chrome'],
  edge: ['Microsoft Edge'],
  brave: ['BraveSoftware', 'Brave-Browser'],
  vivaldi: ['Vivaldi'],
  whale: ['Naver', 'Whale'],
};

export function listBrowserProfiles(browser: string): BrowserProfile[] {
  const segments = BROWSER_PROFILE_DIR_SEGMENTS[browser];
  if (!segments) return [];

  const localStatePath = path.join(
    os.homedir(),
    'Library',
    'Application Support',
    ...segments,
    'Local State'
  );

  try {
    const raw = fs.readFileSync(localStatePath, 'utf-8');
    const data = JSON.parse(raw);
    const cache = data?.profile?.info_cache ?? {};
    return Object.entries(cache).map(([folder, info]: [string, any]) => ({
      folder,
      displayName: info?.name || folder,
      email: info?.user_name || undefined,
    }));
  } catch {
    return [];
  }
}

export type CookieOptions = {
  mode: 'none' | 'browser' | 'file';
  browser?: string;
  profile?: string;
  cookieFilePath?: string;
};

function cookieArgs(c?: CookieOptions): string[] {
  if (!c || c.mode === 'none') {
    return [];
  }
  if (c.mode === 'browser' && c.browser) {
    return ['--cookies-from-browser', c.profile ? `${c.browser}:${c.profile}` : c.browser];
  }
  if (c.mode === 'file' && c.cookieFilePath) {
    return ['--cookies', c.cookieFilePath];
  }
  return [];
}

export interface DownloadOptions {
  url: string;
  format: 'mp4' | 'mp3';
  outputPath: string;
  onProgress?: (progress: number) => void;
  cookies?: CookieOptions;
}

// yt-dlp 1회 실행 (다운로드) — 진행률 파싱 + stderr 캡처 포함
function runYtDlpDownload(
  args: string[],
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (process.env.YTDLP_DEBUG) console.log('[yt-dlp args]', args.join(' '));
    const ytdlp = spawn(resolveYtDlpPath(), args);
    let lastProgress = 0;
    let downloadCount = 0; // 비디오+오디오 = 2개 다운로드
    let currentFileProgress = 0;
    let stderrBuffer = '';

    ytdlp.stdout.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('yt-dlp:', output.trim());

      // 새 파일 다운로드 시작 감지
      if (output.includes('[download] Destination:')) {
        downloadCount++;
        currentFileProgress = 0;
      }

      // 진행률 파싱: [download]  50.0% of 100.00MiB
      const match = output.match(/\[download\]\s+([\d.]+)%/);
      if (match && onProgress) {
        currentFileProgress = parseFloat(match[1]);
        // 2개 파일 다운로드 시 각각 45%, 병합 10%
        let totalProgress: number;
        if (downloadCount <= 1) {
          totalProgress = Math.round(currentFileProgress * 0.45);
        } else {
          totalProgress = Math.round(45 + currentFileProgress * 0.45);
        }
        if (totalProgress > lastProgress) {
          lastProgress = totalProgress;
          onProgress(Math.min(totalProgress, 90)); // 최대 90%까지 (병합 대기)
        }
      }

      // 병합 완료 감지
      if (output.includes('[Merger]') || output.includes('Merging formats')) {
        onProgress?.(95);
      }
    });

    ytdlp.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      console.error('yt-dlp stderr:', text);
      stderrBuffer += text;
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        onProgress?.(100);
        resolve();
      } else {
        // stderr 마지막 몇 줄만 추려서 에러 메시지에 포함 (원인 파악용)
        const lastLines = extractErrorDetail(stderrBuffer);
        const detail = lastLines ? ` — ${lastLines}` : '';
        reject(new Error(`yt-dlp 종료 코드: ${code}${detail}`));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp 실행 오류: ${err.message}`));
    });
  });
}

export async function downloadYouTube({
  url,
  format,
  outputPath,
  onProgress,
  cookies,
}: DownloadOptions): Promise<void> {
  const baseArgs: string[] =
    format === 'mp4'
      ? [
          '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/bestvideo+bestaudio/best',
          '--merge-output-format', 'mp4',
          '-o', outputPath,
          '--no-warnings',
          '--newline',
          ...REMOTE_COMPONENTS_ARGS,
        ]
      : [
          '-f', 'bestaudio/best',
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '192K',
          '-o', outputPath,
          '--no-warnings',
          '--newline',
          ...REMOTE_COMPONENTS_ARGS,
        ];

  const cookieFlags = cookieArgs(cookies);

  // 쿠키를 사용하지 않는 경우: 기존과 동일하게 1회 실행
  if (cookieFlags.length === 0) {
    return runYtDlpDownload([...baseArgs, url], onProgress);
  }

  // 쿠키(--cookies-from-browser 등)를 사용하는 경우:
  // 로그인 상태로 전환되면 yt-dlp가 쿠키를 지원하지 않는 클라이언트(android_vr 등,
  // 서명 챌린지 없이 바로 재생 가능)를 건너뛰고 로그인 가능한 tv/web 계열 클라이언트로
  // 폴백한다. 이 클라이언트들은 n-challenge(서명 해독)를 JS로 풀어야 하는데, 로컬
  // yt-dlp 환경에 해당 챌린지 솔버가 없으면 그 클라이언트의 포맷이 전부 깨져서
  // ("Requested format is not available") 로그인 없이는 멀쩡히 받아지던 일반 공개
  // 영상까지 실패한다. → 먼저 쿠키 없이 시도하고, 그때만 실패하면(연령제한/비공개 등
  // 실제로 로그인이 필요한 경우일 수 있음) 쿠키를 붙여 재시도한다.
  try {
    return await runYtDlpDownload([...baseArgs, url], onProgress);
  } catch (firstError) {
    console.warn(
      'yt-dlp: 쿠키 없이 다운로드 실패, --cookies-from-browser로 재시도합니다.',
      firstError instanceof Error ? firstError.message : firstError
    );
    try {
      return await runYtDlpDownload([...baseArgs, ...cookieFlags, url], onProgress);
    } catch (secondError) {
      // 두 시도 모두 실패 — 원본(쿠키 없음) 에러가 더 유용한 정보를 담고 있는 경우가
      // 많으므로 두 에러 메시지를 모두 포함해 재던진다.
      const firstMsg = firstError instanceof Error ? firstError.message : String(firstError);
      const secondMsg = secondError instanceof Error ? secondError.message : String(secondError);
      throw new Error(`${secondMsg} (쿠키 없이도 실패: ${firstMsg})`);
    }
  }
}

// YouTube URL 유효성 검사
function isValidYouTubeUrl(url: string): boolean {
  const patterns = [
    /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
    /^https?:\/\/youtu\.be\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[\w-]+/,
    /[?&]list=[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/channel\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/c\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/user\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+/,
  ];
  return patterns.some(pattern => pattern.test(url));
}

// YouTube URL 타입 감지 (재생목록 vs 단일 영상)
export function detectYouTubeUrlType(url: string): 'playlist' | 'video' {
  const channelPatterns = [
    /^https?:\/\/(www\.)?youtube\.com\/channel\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/c\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/user\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+/,
  ];
  if (/[?&]list=/.test(url) || channelPatterns.some(pattern => pattern.test(url))) {
    return 'playlist';
  }
  return 'video';
}

// YouTube 비디오 정보만 가져오기
export async function getYouTubeInfo(url: string, cookies?: CookieOptions) {
  if (!isValidYouTubeUrl(url)) {
    throw new Error('유효하지 않은 YouTube URL입니다.');
  }

  return new Promise<{
    title: string;
    duration: number;
    thumbnail: string;
    author: string;
  }>((resolve, reject) => {
    const args = [
      '--dump-json',
      '--no-warnings',
      ...REMOTE_COMPONENTS_ARGS,
      ...cookieArgs(cookies),
      url
    ];

    if (process.env.YTDLP_DEBUG) console.log('[yt-dlp args]', args.join(' '));
    const ytdlp = spawn(resolveYtDlpPath(), args);
    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        try {
          const info = JSON.parse(output);
          resolve({
            title: info.title || 'Unknown',
            duration: info.duration || 0,
            thumbnail: info.thumbnail || '',
            author: info.uploader || info.channel || 'Unknown',
          });
        } catch {
          reject(new Error('비디오 정보 파싱 실패'));
        }
      } else {
        const detail = extractErrorDetail(errorOutput);
        reject(new Error(`비디오 정보를 가져올 수 없습니다.${detail ? ` (${detail})` : ''}`));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp 실행 오류: ${err.message}`));
    });
  });
}

export type PlaylistEntry = {
  id: string;
  title: string;
  url: string;
  duration?: number;
};

// YouTube 재생목록 정보 가져오기
export async function getYouTubePlaylistInfo(
  url: string,
  cookies?: CookieOptions
): Promise<{ title: string; count: number; entries: PlaylistEntry[] }> {
  return new Promise((resolve, reject) => {
    const args = [
      '--flat-playlist',
      '--dump-single-json',
      '--no-warnings',
      '--playlist-end', '200',
      ...cookieArgs(cookies),
      url
    ];

    if (process.env.YTDLP_DEBUG) console.log('[yt-dlp args]', args.join(' '));
    const ytdlp = spawn(resolveYtDlpPath(), args);
    let output = '';
    let errorOutput = '';

    ytdlp.stdout.on('data', (data: Buffer) => {
      output += data.toString();
    });

    ytdlp.stderr.on('data', (data: Buffer) => {
      errorOutput += data.toString();
    });

    ytdlp.on('close', (code) => {
      if (code === 0) {
        try {
          const json = JSON.parse(output);
          const rawEntries: any[] = Array.isArray(json.entries) ? json.entries : [];

          // yt-dlp가 오래된 버전일 경우 재생목록 메타데이터(title, playlist_count)는
          // 정상적으로 가져오면서도 flat-playlist 항목 파싱만 실패해 entries가
          // 빈 배열로 반환되는 경우가 있다 (exit code 0, 에러 없음 — 조용한 실패).
          // playlist_count가 0보다 큰데 entries가 비어있다면 이 상황으로 간주하고
          // 원인을 알 수 있는 에러로 변환한다.
          const declaredCount =
            typeof json.playlist_count === 'number' ? json.playlist_count : null;
          if (rawEntries.length === 0 && declaredCount && declaredCount > 0) {
            reject(
              new Error(
                `재생목록 항목을 가져오지 못했습니다 (제목은 확인됨, 영상 ${declaredCount}개 예상되나 0개 수신). ` +
                  `yt-dlp가 오래되어 발생하는 문제일 수 있습니다. 터미널에서 "yt-dlp -U"로 업데이트한 뒤 다시 시도해주세요.`
              )
            );
            return;
          }

          const entries: PlaylistEntry[] = rawEntries.map((entry) => ({
            id: entry.id,
            title: entry.title,
            url: entry.url || `https://youtube.com/watch?v=${entry.id}`,
            duration: entry.duration,
          }));
          resolve({
            title: json.title || 'Unknown',
            count: entries.length,
            entries,
          });
        } catch {
          reject(new Error('재생목록 정보 파싱 실패'));
        }
      } else {
        const detail = extractErrorDetail(errorOutput);
        reject(new Error(`재생목록 정보를 가져올 수 없습니다.${detail ? ` (${detail})` : ''}`));
      }
    });

    ytdlp.on('error', (err) => {
      reject(new Error(`yt-dlp 실행 오류: ${err.message}`));
    });
  });
}
