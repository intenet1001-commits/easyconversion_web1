'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useConversionStore } from '@/store/useConversionStore';
import { useEffect, useState } from 'react';
import { generateSessionId } from '@/lib/utils';
import { FolderOpen, Package, RotateCcw, Trash2 } from 'lucide-react';
import { ProjectFilesDialog } from '@/components/common/ProjectFilesDialog';
import { useToast } from '@/hooks/use-toast';
import { restoreSession, clearSession } from '@/lib/sessionRestore';

// 탭 컴포넌트
import { YouTubeTab } from '@/components/tabs/YouTubeTab';
import { MediaConvertTab } from '@/components/tabs/MediaConvertTab';
import { MediaSplitTab } from '@/components/tabs/MediaSplitTab';
import { MediaMergeTab } from '@/components/tabs/MediaMergeTab';
import { DocumentConvertTab } from '@/components/tabs/DocumentConvertTab';
import { DocumentMergeTab } from '@/components/tabs/DocumentMergeTab';
import { DocumentSplitTab } from '@/components/tabs/DocumentSplitTab';

export default function Home() {
  const { activeTab, setActiveTab, sessionId, setSessionId, addFile } = useConversionStore();
  const [isProjectFilesOpen, setIsProjectFilesOpen] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [totalStorage, setTotalStorage] = useState(0);
  const [canRestoreSession, setCanRestoreSession] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Electron 환경 감지
    const checkElectron = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      setIsElectron(userAgent.includes('electron'));
    };
    checkElectron();
  }, []);

  useEffect(() => {
    // 이전 세션 복구 가능 여부 확인
    const previousSession = restoreSession();

    if (previousSession && previousSession.uploadedFiles.length > 0) {
      setCanRestoreSession(true);
      toast({
        title: '이전 작업 발견',
        description: '이전에 작업하던 파일을 복구할 수 있습니다.',
        duration: 10000,
      });
    } else {
      // 이전 세션이 없으면 새로 생성
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
    }

    // 페이지 언로드 시 cleanup 호출
    const handleBeforeUnload = () => {
      // sendBeacon을 사용하여 비동기적으로 cleanup 요청 (페이지 닫힐 때도 전송 보장)
      if (navigator.sendBeacon) {
        const blob = new Blob(
          [JSON.stringify({ sessionId })],
          { type: 'application/json' }
        );
        navigator.sendBeacon('/api/cleanup', blob);
      } else {
        // fallback: 동기 fetch (권장하지 않지만 sendBeacon 미지원 시)
        fetch('/api/cleanup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
          keepalive: true,
        }).catch(() => {
          // 에러 무시 (페이지가 이미 언로드 중일 수 있음)
        });
      }
    };

    // 브라우저 닫힘, 새로고침, 페이지 이동 시 cleanup
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [setSessionId]);

  const handleOpenDistFolder = async () => {
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openDistFolder: true }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: '폴더 열기',
          description: 'dist 폴더를 열었습니다.',
        });
      } else {
        toast({
          title: 'DMG 빌드 안내',
          description: '터미널에서 "npm run electron:build:mac" 명령을 실행하세요.',
        });
      }
    } catch (error) {
      toast({
        title: 'DMG 빌드 방법',
        description: '터미널에서 "npm run electron:build:mac" 명령을 실행하세요.',
      });
    }
  };

  const handleOpenDownloadsFolder = async () => {
    try {
      const response = await fetch('/api/open-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openProjectDownloads: true }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: '폴더 열기',
          description: 'public/downloads 폴더를 열었습니다.',
        });
      } else {
        toast({
          title: '폴더 열기 실패',
          description: data.error || '폴더를 열 수 없습니다.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: '폴더 열기 실패',
        description: '폴더를 열 수 없습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleBuildDMG = async () => {
    const { addLog, clearLogs } = useConversionStore.getState();

    try {
      clearLogs();
      addLog('DMG 빌드를 시작합니다...');

      toast({
        title: 'DMG 빌드 시작',
        description: '진행 상황은 로그를 확인하세요.',
      });

      // 알림 권한 요청
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const response = await fetch('/api/build-dmg', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('빌드 요청 실패');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('응답을 읽을 수 없습니다');
      }

      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'progress') {
                  addLog(data.message);
                } else if (data.type === 'complete') {
                  addLog(data.message);
                  addLog('');
                  addLog('🎉🎉🎉 빌드가 완료되었습니다! 🎉🎉🎉');
                  addLog('📁 DMG 파일 위치: dist 폴더');
                  addLog('💻 앱 설치 위치: Applications 폴더');

                  toast({
                    title: '🎉 빌드 완료!',
                    description: 'DMG 파일이 dist 폴더에 생성되고 Applications 폴더에 설치되었습니다.',
                    duration: 10000,
                  });

                  // 브라우저 알림 표시
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('🎉 DMG 빌드 완료!', {
                      body: 'EasyConversion 앱 빌드가 성공적으로 완료되었습니다.',
                      icon: '/favicon.ico',
                    });
                  }

                  // 소리 재생 (시스템 알림음)
                  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZUQ8PVKzn77BdGgo+ltTuymomBSd+zPLaizsIGGS56eqeUBANUKXi8LRiHAU5j9Xxynw=');
                  audio.play().catch(() => {});
                } else if (data.type === 'error') {
                  addLog(`❌ 에러: ${data.error}`);
                  toast({
                    title: '빌드 실패',
                    description: data.error,
                    variant: 'destructive',
                  });
                }
              } catch (e) {
                console.error('JSON 파싱 에러:', e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      addLog(`❌ 에러: ${error.message}`);
      toast({
        title: 'DMG 빌드 실패',
        description: error.message || '빌드 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleBuildApp = async () => {
    const { addLog, clearLogs } = useConversionStore.getState();

    try {
      clearLogs();
      addLog('앱 빌드를 시작합니다...');

      toast({
        title: '앱 빌드 시작',
        description: '진행 상황은 로그를 확인하세요.',
      });

      // 알림 권한 요청
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      const response = await fetch('/api/build-app', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('빌드 요청 실패');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('응답을 읽을 수 없습니다');
      }

      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;

        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === 'progress') {
                  addLog(data.message);
                } else if (data.type === 'complete') {
                  addLog(data.message);
                  addLog('');
                  addLog('🎉🎉🎉 빌드가 완료되었습니다! 🎉🎉🎉');
                  addLog('💻 앱 설치 위치: Applications 폴더');

                  toast({
                    title: '🎉 빌드 완료!',
                    description: 'Applications 폴더에 앱이 설치되었습니다.',
                    duration: 10000,
                  });

                  // 브라우저 알림 표시
                  if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('🎉 앱 빌드 완료!', {
                      body: 'EasyConversion 앱 빌드가 성공적으로 완료되었습니다.',
                      icon: '/favicon.ico',
                    });
                  }

                  // 소리 재생 (시스템 알림음)
                  const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjGH0fPTgjMGHm7A7+OZUQ8PVKzn77BdGgo+ltTuymomBSd+zPLaizsIGGS56eqeUBANUKXi8LRiHAU5j9Xxynw=');
                  audio.play().catch(() => {});
                } else if (data.type === 'error') {
                  addLog(`❌ 에러: ${data.error}`);
                  toast({
                    title: '빌드 실패',
                    description: data.error,
                    variant: 'destructive',
                  });
                }
              } catch (e) {
                console.error('JSON 파싱 에러:', e);
              }
            }
          }
        }
      }
    } catch (error: any) {
      addLog(`❌ 에러: ${error.message}`);
      toast({
        title: '빌드 실패',
        description: error.message || '빌드 중 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleRestoreSession = async () => {
    const previousSession = restoreSession();
    if (!previousSession) return;

    // 세션 ID 복구
    setSessionId(previousSession.sessionId);

    // 활성 탭 복구
    setActiveTab(previousSession.activeTab);

    // 업로드된 파일 목록 복구
    previousSession.uploadedFiles.forEach(file => {
      // 세션 복구 시에는 실제 File 객체가 없으므로 더미 객체 생성
      const dummyFile = new File([], file.name, { type: file.type });
      addFile({
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        file: dummyFile,
      });
    });

    setCanRestoreSession(false);

    toast({
      title: '세션 복구 완료',
      description: `${previousSession.uploadedFiles.length}개의 파일이 복구되었습니다.`,
    });
  };

  const handleStartNewSession = () => {
    clearSession();
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    setCanRestoreSession(false);

    toast({
      title: '새 세션 시작',
      description: '새로운 작업을 시작합니다.',
    });
  };

  const handleAutoCleanup = async () => {
    try {
      // 먼저 정리 대상 확인
      const checkRes = await fetch('/api/cleanup/auto');
      const checkData = await checkRes.json();

      if (!checkData.success) {
        throw new Error(checkData.error);
      }

      const oldSessionsCount = checkData.oldSessions?.length || 0;
      const totalOldSizeGB = checkData.totalOldSizeGB || '0GB';

      if (oldSessionsCount === 0) {
        toast({
          title: '정리 완료',
          description: '정리할 오래된 파일이 없습니다.',
        });
        return;
      }

      // 사용자에게 확인
      if (!confirm(`24시간 이상 지난 세션 ${oldSessionsCount}개 (${totalOldSizeGB})를 삭제하시겠습니까?\n\n최근 24시간 이내 세션은 유지됩니다.`)) {
        return;
      }

      // 실제 정리 실행
      const cleanupRes = await fetch('/api/cleanup/auto', { method: 'POST' });
      const cleanupData = await cleanupRes.json();

      if (!cleanupData.success) {
        throw new Error(cleanupData.error);
      }

      toast({
        title: '자동 정리 완료',
        description: `${cleanupData.deletedSessions?.length || 0}개 세션 삭제 (${cleanupData.freedSpaceGB || '0GB'} 확보)`,
        duration: 5000,
      });
    } catch (error: any) {
      toast({
        title: '자동 정리 실패',
        description: error.message || '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const handleCleanupUploads = async () => {
    try {
      // 먼저 전체 크기 확인
      const checkRes = await fetch('/api/cleanup/uploads');
      const checkData = await checkRes.json();

      if (!checkData.success) {
        throw new Error(checkData.error);
      }

      const totalSessions = checkData.totalSessions || 0;
      const totalSizeGB = checkData.totalSizeGB || '0GB';

      if (totalSessions === 0) {
        toast({
          title: '정리 완료',
          description: 'tmp/uploads 폴더가 이미 비어있습니다.',
        });
        return;
      }

      // 사용자에게 경고
      if (!confirm(`⚠️ 경고: tmp/uploads 전체를 삭제합니다!\n\n삭제 대상: ${totalSessions}개 항목 (${totalSizeGB})\n현재 작업 중인 세션도 삭제됩니다.\n\n계속하시겠습니까?`)) {
        return;
      }

      // 한 번 더 확인
      if (!confirm('정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
        return;
      }

      // 실제 정리 실행
      const cleanupRes = await fetch('/api/cleanup/uploads', { method: 'POST' });
      const cleanupData = await cleanupRes.json();

      if (!cleanupData.success) {
        throw new Error(cleanupData.error);
      }

      toast({
        title: 'tmp/uploads 정리 완료',
        description: `${cleanupData.deletedSessions?.length || 0}개 항목 삭제 (${cleanupData.freedSpaceGB || '0GB'} 확보)`,
        duration: 5000,
      });

      // 현재 세션도 삭제되었으므로 새 세션 시작
      const newSessionId = generateSessionId();
      setSessionId(newSessionId);
    } catch (error: any) {
      toast({
        title: 'tmp/uploads 정리 실패',
        description: error.message || '알 수 없는 오류가 발생했습니다.',
        variant: 'destructive',
      });
    }
  };

  const fetchTotalStorage = async () => {
    try {
      const response = await fetch('/api/project-files/list');

      if (!response.ok) {
        // 서버 응답이 정상이 아닌 경우 무시
        console.warn(`[fetchTotalStorage] Server responded with status ${response.status}`);
        return;
      }

      const data = await response.json();
      if (data.success && data.totalSize !== undefined) {
        setTotalStorage(data.totalSize);
      }
    } catch (error) {
      // fetch 에러 발생 시 무시 (네트워크 문제 등)
      // 백그라운드 업데이트이므로 사용자에게 알리지 않음
      console.warn('[fetchTotalStorage] Fetch failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  };

  useEffect(() => {
    // 초기 로드 시 용량 가져오기
    fetchTotalStorage();

    // 5초마다 용량 업데이트
    const interval = setInterval(fetchTotalStorage, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <MainLayout>
      {canRestoreSession && (
        <div className="mb-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <div>
              <p className="font-medium text-blue-900 dark:text-blue-100">
                이전 작업 세션이 발견되었습니다
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                작업하던 파일을 복구하시겠습니까?
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleRestoreSession}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              복구하기
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleStartNewSession}
            >
              새로 시작
            </Button>
          </div>
        </div>
      )}

      <div className="mb-4 flex justify-between items-center">
        <div className="flex gap-2">
          {!isElectron && (
            <>
              <Button
                variant="default"
                size="sm"
                onClick={handleBuildDMG}
              >
                <Package className="h-4 w-4 mr-2" />
                DMG 빌드 및 설치
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleBuildApp}
              >
                <Package className="h-4 w-4 mr-2" />
                앱 빌드 및 설치
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenDistFolder}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                dist 폴더 열기
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenDownloadsFolder}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                다운로드 폴더 열기
              </Button>
            </>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={handleAutoCleanup}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            임시 파일 정리 (24h+)
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCleanupUploads}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            전체 삭제 (tmp/uploads)
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            저장 용량: {formatBytes(totalStorage)}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsProjectFilesOpen(true)}
          >
            <FolderOpen className="h-4 w-4 mr-2" />
            프로젝트 파일 관리
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="youtube">YouTube</TabsTrigger>
          <TabsTrigger value="media-convert">미디어 변환</TabsTrigger>
          <TabsTrigger value="media-split">비디오 분할</TabsTrigger>
          <TabsTrigger value="media-merge">미디어 병합</TabsTrigger>
          <TabsTrigger value="doc-convert">문서 변환</TabsTrigger>
          <TabsTrigger value="doc-merge">문서 병합</TabsTrigger>
          <TabsTrigger value="doc-split">문서 분할</TabsTrigger>
        </TabsList>

        <TabsContent value="youtube" className="mt-6">
          <YouTubeTab />
        </TabsContent>
        <TabsContent value="media-convert" className="mt-6">
          <MediaConvertTab />
        </TabsContent>
        <TabsContent value="media-split" className="mt-6">
          <MediaSplitTab />
        </TabsContent>
        <TabsContent value="media-merge" className="mt-6">
          <MediaMergeTab />
        </TabsContent>
        <TabsContent value="doc-convert" className="mt-6">
          <DocumentConvertTab />
        </TabsContent>
        <TabsContent value="doc-merge" className="mt-6">
          <DocumentMergeTab />
        </TabsContent>
        <TabsContent value="doc-split" className="mt-6">
          <DocumentSplitTab />
        </TabsContent>
      </Tabs>

      <ProjectFilesDialog
        isOpen={isProjectFilesOpen}
        onClose={() => setIsProjectFilesOpen(false)}
      />
    </MainLayout>
  );
}
