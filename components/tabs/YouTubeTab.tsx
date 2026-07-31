'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { useToast } from '@/hooks/use-toast';
import { Download, Info, Loader2, ChevronDown, ChevronUp, FolderOpen } from 'lucide-react';
import {
  type CookieSettings,
  loadCookieSettings,
  saveCookieSettings,
} from '@/lib/ytdlpSettings';

type PlaylistEntry = {
  id: string;
  title: string;
  url: string;
  duration?: number;
};

type PlaylistInfo = {
  title: string;
  count: number;
  entries: PlaylistEntry[];
};

type CompletedItem = {
  id: string;
  title: string;
  outputUrl: string;
};

type FailedItem = {
  id: string;
  title: string;
  error: string;
};

// 클라이언트 측 재생목록 URL 감지 (lib/youtube.ts의 detectYouTubeUrlType과 동일한 판별 기준)
// lib/youtube.ts는 child_process를 사용하므로 클라이언트 번들에 포함시키지 않기 위해 여기서 별도 구현
// 클립보드/입력값이 최소한 YouTube URL 형태인지 검사 (붙여넣기 시 로그 텍스트 등
// 엉뚱한 문자열이 그대로 URL로 들어가는 것을 막기 위함)
function isYouTubeUrl(u: string): boolean {
  const trimmed = u.trim();
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|m\.youtube\.com)\//.test(trimmed);
}

function isPlaylistUrl(u: string): boolean {
  const channelPatterns = [
    /^https?:\/\/(www\.)?youtube\.com\/channel\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/c\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/user\/[\w-]+/,
    /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+/,
  ];
  return /[?&]list=/.test(u) || channelPatterns.some((pattern) => pattern.test(u));
}

function formatDuration(seconds?: number): string {
  if (seconds === undefined || seconds === null || isNaN(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function YouTubeTab() {
  const { toast } = useToast();
  const { sessionId, addLog } = useConversionStore();
  const [url, setUrl] = useState('');
  const [format, setFormat] = useState<'mp4' | 'mp3'>('mp4');
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState<any>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(false);

  // 재생목록 상태
  const [playlist, setPlaylist] = useState<PlaylistInfo | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const [currentPlaylistItem, setCurrentPlaylistItem] = useState<string | null>(null);
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);
  const [isSavingAll, setIsSavingAll] = useState(false);

  // 쿠키 설정
  const [cookieSettings, setCookieSettings] = useState<CookieSettings>({
    mode: 'none',
    browser: 'chrome',
  });
  const [showCookieSettings, setShowCookieSettings] = useState(false);
  const [browserProfiles, setBrowserProfiles] = useState<
    { folder: string; displayName: string; email?: string }[]
  >([]);
  const [isLoadingProfiles, setIsLoadingProfiles] = useState(false);

  useEffect(() => {
    setCookieSettings(loadCookieSettings());
  }, []);

  // 선택된 브라우저의 실제 프로필 목록(폴더명 + 화면 표시 이름)을 가져온다.
  // 사용자가 "chunsung" 같은 화면 표시 이름을 --cookies-from-browser에 필요한
  // 실제 폴더명("Profile 1")으로 착각해 잘못 입력하는 문제를 막기 위함.
  useEffect(() => {
    if (cookieSettings.mode !== 'browser') return;

    let cancelled = false;
    setIsLoadingProfiles(true);
    fetch(`/api/youtube/browser-profiles?browser=${cookieSettings.browser}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setBrowserProfiles(data.success ? data.profiles : []);
      })
      .catch(() => {
        if (!cancelled) setBrowserProfiles([]);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingProfiles(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cookieSettings.mode, cookieSettings.browser]);

  const updateCookieSettings = (next: CookieSettings) => {
    setCookieSettings(next);
    saveCookieSettings(next);
  };

  // /api/youtube/info 호출 + 결과에 따른 상태 갱신 로직을 공유 함수로 분리
  // (handleGetInfo와 handleDownload의 플레이리스트 자동 감지 경로에서 함께 사용)
  const fetchYoutubeInfo = async (): Promise<any> => {
    const res = await fetch('/api/youtube/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, cookies: cookieSettings }),
    });
    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    if (data.type === 'playlist') {
      // 재생목록 정보 로드 — 기존 단일 영상 상태는 초기화
      setVideoInfo(null);
      setPlaylist(data.playlist);
      setSelectedIds(new Set(data.playlist.entries.map((e: PlaylistEntry) => e.id)));
      setCompletedItems([]);
      setFailedItems([]);
    } else {
      // 단일 영상 정보 로드 — 기존 재생목록 상태는 초기화
      setPlaylist(null);
      setSelectedIds(new Set());
      setCompletedItems([]);
      setFailedItems([]);
      setVideoInfo(data.info);
    }

    return data;
  };

  const handleGetInfo = async () => {
    if (!url) {
      toast({ title: 'URL을 입력해주세요', variant: 'destructive' });
      return;
    }
    if (!isYouTubeUrl(url)) {
      toast({ title: '유효한 YouTube URL이 아닙니다', variant: 'destructive' });
      return;
    }

    setIsLoadingInfo(true);
    addLog(`비디오 정보 가져오는 중: ${url}`);

    try {
      const data = await fetchYoutubeInfo();

      if (data.type === 'playlist') {
        addLog(`재생목록: ${data.playlist.title} (${data.playlist.count}개 영상)`);
        toast({ title: '재생목록 로드 완료', description: `${data.playlist.title} (${data.playlist.count}개)` });
      } else {
        addLog(`제목: ${data.info.title}`);
        toast({ title: '정보 로드 완료', description: data.info.title });
      }
    } catch (error: any) {
      toast({ title: '정보 로드 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  // 단일 영상 SSE 다운로드를 재사용 가능한 함수로 분리
  const downloadOne = async (videoUrl: string, title?: string): Promise<string> => {
    const response = await fetch('/api/youtube/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: videoUrl, format, sessionId, cookies: cookieSettings, title }),
    });

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) throw new Error('스트림을 읽을 수 없습니다');

    let resultUrl = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));

          if (data.type === 'progress') {
            setProgress(data.progress);
          } else if (data.type === 'complete') {
            resultUrl = data.outputUrl;
            addLog(data.message);
          } else if (data.type === 'error') {
            throw new Error(data.message);
          }

          if (data.message) {
            addLog(data.message);
          }
        }
      }
    }

    if (!resultUrl) {
      throw new Error('다운로드가 완료되지 않았습니다');
    }

    // 데스크톱 앱이라 서버(Node)가 이미 이 파일을 로컬 디스크(public/downloads)에
    // 직접 저장해뒀다. 브라우저 fetch+blob으로 "한 번 더" 다운로드를 시도하면
    // Electron 다운로드 매니저와 충돌해 큰 파일에서 자주 실패하므로 시도하지 않는다.
    // 사용자는 "폴더 열기"로 실제 파일 위치에 바로 접근한다.
    return resultUrl;
  };

  // 단일 영상 다운로드 실행부 (기존 handleDownload 로직 그대로, 재사용을 위해 분리)
  const runSingleDownload = async () => {
    setIsDownloading(true);
    setProgress(0);
    setDownloadUrl('');
    addLog(`다운로드 시작: ${url} (${format.toUpperCase()})`);

    try {
      const resultUrl = await downloadOne(url, videoInfo?.title);
      setDownloadUrl(resultUrl);
      addLog('다운로드 완료 — 파일이 로컬에 저장되었습니다');
      toast({ title: '다운로드 완료' });
    } catch (error: any) {
      toast({ title: '다운로드 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDownload = async () => {
    if (!url) {
      toast({ title: 'URL을 입력해주세요', variant: 'destructive' });
      return;
    }
    if (!playlist && !isYouTubeUrl(url)) {
      toast({ title: '유효한 YouTube URL이 아닙니다', variant: 'destructive' });
      return;
    }

    // 하단 메인 버튼은 "전체 다운로드" — 체크박스 선택 상태와 무관하게 재생목록
    // 전체를 내려받는다. (개별 선택 다운로드는 목록 위쪽의 "선택 항목 다운로드" 버튼 담당)
    if (playlist) {
      const allIds = new Set(playlist.entries.map((e) => e.id));
      await handleDownloadAll(playlist.entries, allIds);
      return;
    }

    // 재생목록 URL로 보이지만 아직 정보를 불러오지 않은 경우:
    // "정보 가져오기"를 강제하지 않고 여기서 바로 정보를 가져온 뒤 전체 항목을 이어서 다운로드
    if (isPlaylistUrl(url)) {
      setIsLoadingInfo(true);
      addLog(`재생목록 URL 감지: 정보를 가져온 뒤 자동으로 다운로드를 시작합니다. (${url})`);

      let data: any;
      try {
        data = await fetchYoutubeInfo();
      } catch (error: any) {
        toast({ title: '정보 로드 실패', description: error.message, variant: 'destructive' });
        addLog(`오류: ${error.message}`);
        setIsLoadingInfo(false);
        return;
      }
      setIsLoadingInfo(false);

      if (data.type === 'playlist') {
        const allIds = new Set<string>(data.playlist.entries.map((e: PlaylistEntry) => e.id));
        addLog(`재생목록: ${data.playlist.title} (${data.playlist.count}개 영상) — 다운로드를 시작합니다.`);
        await handleDownloadAll(data.playlist.entries, allIds);
      } else {
        // 실제로는 단일 영상으로 판별된 경우 — 그대로 단일 다운로드 진행
        await runSingleDownload();
      }
      return;
    }

    // 단일 영상 다운로드
    await runSingleDownload();
  };

  const handleDownloadAll = async (overrideEntries?: PlaylistEntry[], overrideIds?: Set<string>) => {
    const entries = overrideEntries ?? playlist?.entries;
    const ids = overrideIds ?? selectedIds;
    if (!entries || ids.size === 0) return;

    setIsDownloadingAll(true);
    setCompletedItems([]);
    setFailedItems([]);
    setProgress(0);

    const targets = entries.filter((entry) => ids.has(entry.id));
    addLog(`재생목록 다운로드 시작: ${targets.length}개 항목`);

    for (const entry of targets) {
      setCurrentPlaylistItem(entry.id);
      setProgress(0);
      addLog(`다운로드 중: ${entry.title}`);

      try {
        const resultUrl = await downloadOne(entry.url, entry.title);
        setCompletedItems((prev) => [...prev, { id: entry.id, title: entry.title, outputUrl: resultUrl }]);
      } catch (error: any) {
        addLog(`오류 (${entry.title}): ${error.message}`);
        setFailedItems((prev) => [...prev, { id: entry.id, title: entry.title, error: error.message }]);
        toast({ title: '항목 다운로드 실패', description: entry.title, variant: 'destructive' });
        // 개별 실패는 건너뛰고 다음 항목 계속 진행
        continue;
      }
    }

    setCurrentPlaylistItem(null);
    setIsDownloadingAll(false);
    addLog('재생목록 다운로드 완료 — 파일이 로컬에 저장되었습니다');
    toast({ title: '재생목록 다운로드 완료' });
  };

  // 다운로드된 파일이 저장된 폴더를 Finder/탐색기로 직접 연다.
  // (브라우저 fetch+blob 재다운로드는 Electron에서 큰 파일일수록 자주 실패해 사용하지 않음)
  const openDownloadFolder = async () => {
    setIsSavingAll(true);
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openProjectDownloads: true }),
      });
      const data = await response.json();
      if (data.success) {
        toast({ title: '다운로드 폴더를 열었습니다' });
      } else {
        toast({ title: '폴더 열기 실패', description: data.error, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: '폴더 열기 실패', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingAll(false);
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const trimmed = text.trim();
      if (!isYouTubeUrl(trimmed)) {
        toast({
          title: '유효한 YouTube URL이 아닙니다',
          description: '클립보드 내용이 YouTube 링크 형식이 아니에요. 복사한 내용을 확인해주세요.',
          variant: 'destructive',
        });
        return;
      }
      setUrl(trimmed);
      toast({ title: 'URL 붙여넣기 완료' });
    } catch (error) {
      toast({ title: 'clipboard 접근 실패', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">YouTube 다운로드</h2>

        <div className="space-y-4">
          <div>
            <Label htmlFor="youtube-url">YouTube URL</Label>
            <div className="flex gap-2 mt-2">
              <Input
                id="youtube-url"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button variant="outline" onClick={handlePaste}>
                붙여넣기
              </Button>
              <Button variant="outline" onClick={handleGetInfo} disabled={isLoadingInfo}>
                {isLoadingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Info className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* 고급 설정 · 쿠키 인증 */}
          <Card className="p-0 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium"
              onClick={() => setShowCookieSettings((v) => !v)}
            >
              <span>고급 설정 · 쿠키 인증</span>
              {showCookieSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showCookieSettings && (
              <div className="px-4 pb-4 space-y-4 border-t pt-4">
                <div>
                  <Label>인증 방식</Label>
                  <RadioGroup
                    value={cookieSettings.mode}
                    onValueChange={(v) =>
                      updateCookieSettings({ ...cookieSettings, mode: v as CookieSettings['mode'] })
                    }
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="none" id="cookie-none" />
                      <Label htmlFor="cookie-none">인증 없음</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="browser" id="cookie-browser" />
                      <Label htmlFor="cookie-browser">브라우저 세션 사용</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="file" id="cookie-file" />
                      <Label htmlFor="cookie-file">cookies.txt 파일 사용</Label>
                    </div>
                  </RadioGroup>
                </div>

                {cookieSettings.mode === 'browser' && (
                  <div className="space-y-3 pl-6">
                    <div>
                      <Label htmlFor="cookie-browser-select">브라우저</Label>
                      <Select
                        value={cookieSettings.browser}
                        onValueChange={(v) =>
                          updateCookieSettings({ ...cookieSettings, browser: v as CookieSettings['browser'] })
                        }
                      >
                        <SelectTrigger id="cookie-browser-select" className="mt-2">
                          <SelectValue placeholder="브라우저 선택" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="chrome">Chrome</SelectItem>
                          <SelectItem value="edge">Edge</SelectItem>
                          <SelectItem value="whale">Whale</SelectItem>
                          <SelectItem value="firefox">Firefox</SelectItem>
                          <SelectItem value="brave">Brave</SelectItem>
                          <SelectItem value="vivaldi">Vivaldi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="cookie-profile">프로필 (선택)</Label>
                      {browserProfiles.length > 0 ? (
                        <Select
                          value={cookieSettings.profile ?? '__default__'}
                          onValueChange={(v) =>
                            updateCookieSettings({
                              ...cookieSettings,
                              profile: v === '__default__' ? undefined : v,
                            })
                          }
                        >
                          <SelectTrigger id="cookie-profile" className="mt-2">
                            <SelectValue placeholder="프로필 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__default__">기본 프로필 자동 선택</SelectItem>
                            {browserProfiles.map((p) => (
                              <SelectItem key={p.folder} value={p.folder}>
                                {p.displayName}
                                {p.email ? ` (${p.email})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          id="cookie-profile"
                          placeholder={
                            isLoadingProfiles
                              ? '프로필 목록 불러오는 중...'
                              : '프로필을 자동으로 찾지 못했습니다. 폴더명 직접 입력 (예: Profile 1)'
                          }
                          value={cookieSettings.profile ?? ''}
                          onChange={(e) =>
                            updateCookieSettings({ ...cookieSettings, profile: e.target.value })
                          }
                          className="mt-2"
                        />
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        여러 프로필이 동시에 열려있으면 자동 감지가 안 될 수 있으니, 사용할 계정 프로필을 직접 선택하는 걸 권장합니다.
                      </p>
                    </div>
                  </div>
                )}

                {cookieSettings.mode === 'file' && (
                  <div className="pl-6">
                    <Label htmlFor="cookie-file-path">쿠키 파일 경로</Label>
                    <Input
                      id="cookie-file-path"
                      placeholder="예: /Users/username/cookies.txt"
                      value={cookieSettings.cookieFilePath ?? ''}
                      onChange={(e) =>
                        updateCookieSettings({ ...cookieSettings, cookieFilePath: e.target.value })
                      }
                      className="mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      이 앱을 실행 중인 기기의 로컬 절대 경로를 입력하세요.
                    </p>
                  </div>
                )}
              </div>
            )}
          </Card>

          {videoInfo && (
            <Card className="p-4 bg-muted">
              <div className="flex gap-4">
                {videoInfo.thumbnail && (
                  <img src={videoInfo.thumbnail} alt="썸네일" className="w-32 h-auto rounded" />
                )}
                <div>
                  <h3 className="font-semibold">{videoInfo.title}</h3>
                  <p className="text-sm text-muted-foreground">채널: {videoInfo.author}</p>
                  <p className="text-sm text-muted-foreground">
                    길이: {Math.floor(videoInfo.duration / 60)}분 {videoInfo.duration % 60}초
                  </p>
                </div>
              </div>
            </Card>
          )}

          {playlist && (
            <Card className="p-4 bg-muted">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold">{playlist.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    총 {playlist.count}개 영상 · {selectedIds.size}개 선택됨
                  </p>
                </div>
              </div>

              <ScrollArea className="h-64 rounded border bg-background">
                {/* Radix ScrollArea의 내부 뷰포트는 display:table 래퍼를 쓰기 때문에,
                    자식의 "줄바꿈 없는 원래 너비"를 기준으로 table처럼 폭을 계산해버려
                    truncate가 먹지 않는다. w-px(=1px) + min-w-full(=100%)을 함께 주면
                    min-width가 width보다 우선이라 결과적으로 정확히 부모 너비로 강제된다. */}
                <div className="divide-y pr-4 w-px min-w-full">
                  {playlist.entries.map((entry) => {
                    const isCompleted = completedItems.some((c) => c.id === entry.id);
                    const isFailed = failedItems.some((f) => f.id === entry.id);
                    const isCurrent = currentPlaylistItem === entry.id;
                    return (
                      <div key={entry.id} className="flex items-center gap-3 px-3 py-2 min-w-0">
                        <Checkbox
                          checked={selectedIds.has(entry.id)}
                          onCheckedChange={() => toggleSelected(entry.id)}
                          disabled={isDownloadingAll}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate">{entry.title || '(제목 없음)'}</p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDuration(entry.duration)}
                        </span>
                        {isCurrent && <Loader2 className="h-3 w-3 animate-spin shrink-0" />}
                        {isCompleted && <span className="text-xs text-green-600 shrink-0">완료</span>}
                        {isFailed && <span className="text-xs text-destructive shrink-0">실패</span>}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <Button
                onClick={() => handleDownloadAll()}
                disabled={selectedIds.size === 0 || isDownloadingAll}
                className="w-full mt-3"
              >
                {isDownloadingAll ? '다운로드 중...' : '선택 항목 다운로드'}
              </Button>
            </Card>
          )}

          <div>
            <Label>출력 형식</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'mp4' | 'mp3')} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mp4" id="format-mp4" />
                <Label htmlFor="format-mp4">MP4 (비디오)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="mp3" id="format-mp3" />
                <Label htmlFor="format-mp3">MP3 (오디오)</Label>
              </div>
            </RadioGroup>
          </div>

          <Button
            onClick={handleDownload}
            disabled={isDownloading || isDownloadingAll || isLoadingInfo || !url}
            className="w-full"
          >
            {isLoadingInfo
              ? '재생목록 정보 가져오는 중...'
              : isDownloading || isDownloadingAll
                ? '다운로드 중...'
                : playlist
                  ? '전체 다운로드'
                  : '다운로드 시작'}
          </Button>
        </div>
      </Card>

      {(isDownloading || isDownloadingAll) && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드 진행률</h3>
          <ProgressBar value={progress} label="YouTube 다운로드" />
        </Card>
      )}

      {downloadUrl && !playlist && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드 완료</h3>
          <a href={downloadUrl} download className="inline-flex items-center text-primary">
            <Download className="h-4 w-4 mr-2" />
            파일 다운로드
          </a>
        </Card>
      )}

      {(completedItems.length > 0 || failedItems.length > 0) && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">재생목록 다운로드 결과</h3>
            {completedItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={openDownloadFolder}
                disabled={isSavingAll}
              >
                {isSavingAll ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    여는 중...
                  </>
                ) : (
                  <>
                    <FolderOpen className="h-4 w-4 mr-2" />
                    폴더 열기
                  </>
                )}
              </Button>
            )}
          </div>
          <div className="space-y-2">
            {completedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-4">
                <span className="text-sm truncate min-w-0">{item.title}</span>
                <a href={item.outputUrl} download className="inline-flex items-center text-primary shrink-0">
                  <Download className="h-4 w-4 mr-1" />
                  다운로드
                </a>
              </div>
            ))}
            {failedItems.map((item) => (
              <div key={item.id} className="flex flex-col gap-1">
                <span className="text-sm truncate text-muted-foreground">{item.title}</span>
                <span className="text-xs text-destructive break-words">실패: {item.error}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
