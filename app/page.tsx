'use client';

import { useConversionStore } from '@/store/useConversionStore';
import { useEffect, useState, useRef } from 'react';
import { generateSessionId } from '@/lib/utils';
import { ProjectFilesDialog } from '@/components/common/ProjectFilesDialog';
import { useToast } from '@/hooks/use-toast';
import { restoreSession, clearSession } from '@/lib/sessionRestore';

import { YouTubeTab } from '@/components/tabs/YouTubeTab';
import { MediaConvertTab } from '@/components/tabs/MediaConvertTab';
import { MediaSplitTab } from '@/components/tabs/MediaSplitTab';
import { MediaMergeTab } from '@/components/tabs/MediaMergeTab';
import { DocumentConvertTab } from '@/components/tabs/DocumentConvertTab';
import { DocumentMergeTab } from '@/components/tabs/DocumentMergeTab';
import { DocumentSplitTab } from '@/components/tabs/DocumentSplitTab';
import { SplitArchiveTab } from '@/components/tabs/SplitArchiveTab';
import { ExtractArchiveTab } from '@/components/tabs/ExtractArchiveTab';

/* ── Icon helper ─────────────────────────────── */
function Ico({ d, size = 16, className }: { d: string | string[]; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      {(Array.isArray(d) ? d : [d]).map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICONS: Record<string, string[]> = {
  youtube: ['M2.5 5a3.5 3.5 0 013.5-3.5h12A3.5 3.5 0 0121.5 5v14a3.5 3.5 0 01-3.5 3.5H6A3.5 3.5 0 012.5 19V5z', 'M10.5 9.5v5l4.5-2.5z'],
  convert: ['M7 7h10l-3-3M17 17H7l3 3'],
  split:   ['M4 12h16M9 7l-5 5 5 5M15 7l5 5-5 5'],
  merge:   ['M4 7l5 5-5 5M20 7l-5 5 5 5M9 12h6'],
  doc:     ['M6 3h8l4 4v14H6z', 'M14 3v4h4'],
  archive: ['M3 4h18a1 1 0 011 1v3H2V5a1 1 0 011-1z', 'M5 8v12h14V8M10 12h4'],
  unarchive: ['M3 4h18a1 1 0 011 1v3H2V5a1 1 0 011-1z', 'M5 8v12h14V8M12 11v6M9 14l3 3 3-3'],
  media:   ['M3 4h18a2 2 0 012 2v12a2 2 0 01-2 2H3a2 2 0 01-2-2V6a2 2 0 012-2z', 'M10 9.5v5l4-2.5z'],
  settings: ['M12 9a3 3 0 100 6 3 3 0 000-6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z'],
  chevron: ['M6 9l6 6 6-6'],
  refresh: ['M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5'],
  folder:  ['M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z'],
  trash:   ['M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13'],
  clock:   ['M12 2a10 10 0 100 20A10 10 0 0012 2z', 'M12 6v6l4 2'],
  db:      ['M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3v14c0 1.7-3.6 3-8 3s-8-1.3-8-3V5z', 'M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3', 'M4 8.5c0 1.7 3.6 3 8 3s8-1.3 8-3'],
  cpu:     ['M5 5h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z', 'M9 9h6v6H9z', 'M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3'],
  sparkle: ['M12 3l1.8 5.5L19 10l-5.2 1.5L12 17l-1.8-5.5L5 10l5.2-1.5z'],
  copy:    ['M8 8h12v12H8z', 'M16 8V4H4v12h4'],
  restore: ['M3 12a9 9 0 109-9H9M3 3v6h6'],
};

const NAV_GROUPS = [
  { label: '다운로드', items: [
    { id: 'youtube',         label: 'YouTube 다운로드', icon: 'youtube',   desc: '동영상·오디오 추출' },
  ]},
  { label: '미디어', items: [
    { id: 'media-convert',   label: '미디어 변환',      icon: 'convert',   desc: '포맷 변경' },
    { id: 'media-split',     label: '미디어 분할',      icon: 'split',     desc: '구간으로 분리' },
    { id: 'media-merge',     label: '미디어 병합',      icon: 'merge',     desc: '하나로 합치기' },
  ]},
  { label: '문서', items: [
    { id: 'doc-convert',     label: '문서 변환',        icon: 'convert',   desc: 'PDF · DOCX · MD · HTML' },
    { id: 'doc-merge',       label: '문서 병합',        icon: 'merge',     desc: 'PDF 합치기' },
    { id: 'doc-split',       label: '문서 분할',        icon: 'split',     desc: 'PDF 페이지 분리' },
  ]},
  { label: '아카이브', items: [
    { id: 'split-archive',   label: '압축',             icon: 'archive',   desc: 'ZIP · 7z · 분할' },
    { id: 'extract-archive', label: '압축 풀기',        icon: 'unarchive', desc: '분할 압축 지원' },
  ]},
];

const ALL_NAV = NAV_GROUPS.flatMap(g => g.items);

function renderTab(id: string) {
  switch (id) {
    case 'youtube':          return <YouTubeTab />;
    case 'media-convert':    return <MediaConvertTab />;
    case 'media-split':      return <MediaSplitTab />;
    case 'media-merge':      return <MediaMergeTab />;
    case 'doc-convert':      return <DocumentConvertTab />;
    case 'doc-merge':        return <DocumentMergeTab />;
    case 'doc-split':        return <DocumentSplitTab />;
    case 'split-archive':    return <SplitArchiveTab />;
    case 'extract-archive':  return <ExtractArchiveTab />;
    default:                 return <YouTubeTab />;
  }
}

/* ── System menu ─────────────────────────────── */
function SystemMenu({ onBuildDMG, onBuildApp, onOpenDist, onOpenDownloads, onManageFiles, isBuilding }: {
  onBuildDMG: () => void; onBuildApp: () => void;
  onOpenDist: () => void; onOpenDownloads: () => void;
  onManageFiles: () => void; isBuilding: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items = [
    { label: 'DMG 빌드 및 설치', desc: 'macOS 패키지 생성', icon: 'cpu',    action: onBuildDMG, disabled: isBuilding },
    { label: '앱 빌드 및 설치',   desc: '데스크톱 앱 빌드', icon: 'cpu',    action: onBuildApp, disabled: isBuilding },
    { label: 'dist 폴더 열기',   desc: '빌드 출력 디렉터리', icon: 'folder', action: onOpenDist },
    { label: '다운로드 폴더 열기', desc: '결과물 저장 위치',  icon: 'folder', action: onOpenDownloads },
    { label: '프로젝트 파일 관리', desc: '전체 파일 트리',    icon: 'folder', action: onManageFiles },
  ];

  return (
    <div className="ec-sysmenu" ref={ref}>
      <button className="ec-sysmenu__trigger" onClick={() => setOpen(!open)}>
        <Ico d={ICONS.settings} size={14} />
        <span>시스템</span>
        <Ico d={ICONS.chevron} size={12} className={`ec-sysmenu__chev ${open ? 'is-open' : ''}`} />
      </button>
      {open && (
        <div className="ec-sysmenu__panel">
          <div className="ec-sysmenu__hdr">개발자 · 빌드 도구</div>
          {items.map((it, i) => (
            <button key={i} className="ec-sysmenu__item"
              disabled={it.disabled}
              onClick={() => { setOpen(false); it.action(); }}
              style={it.disabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
              <Ico d={ICONS[it.icon]} size={14} />
              <div>
                <div className="ec-sysmenu__lbl">{it.label}</div>
                <div className="ec-sysmenu__desc">{it.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main ────────────────────────────────────── */
export default function Home() {
  const {
    activeTab, setActiveTab,
    sessionId, setSessionId,
    addFile,
    logs, clearLogs,
  } = useConversionStore();
  const [isProjectFilesOpen, setIsProjectFilesOpen] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const [buildProgress, setBuildProgress] = useState(0);
  const [buildStage, setBuildStage] = useState('');
  const [totalStorage, setTotalStorage] = useState(0);
  const [canRestoreSession, setCanRestoreSession] = useState(false);
  const [isElectron, setIsElectron] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsElectron(navigator.userAgent.toLowerCase().includes('electron'));
  }, []);

  useEffect(() => {
    const prev = restoreSession();
    const newId = generateSessionId();
    setSessionId(newId);
    if (prev && prev.uploadedFiles.length > 0) {
      setCanRestoreSession(true);
      toast({ title: '이전 작업 발견', description: '이전에 작업하던 파일을 복구할 수 있습니다.', duration: 10000 });
    }
    const cleanup = () => {
      const blob = new Blob([JSON.stringify({ sessionId })], { type: 'application/json' });
      navigator.sendBeacon ? navigator.sendBeacon('/api/cleanup', blob)
        : fetch('/api/cleanup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId }), keepalive: true }).catch(() => {});
    };
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('pagehide', cleanup);
    return () => { window.removeEventListener('beforeunload', cleanup); window.removeEventListener('pagehide', cleanup); };
  }, [setSessionId]);

  const handleOpenDistFolder = async () => {
    const res = await fetch('/api/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openDistFolder: true }) });
    const d = await res.json();
    toast(d.success ? { title: '폴더 열기', description: 'dist 폴더를 열었습니다.' } : { title: 'DMG 빌드 안내', description: '먼저 DMG를 빌드하세요.' });
  };

  const handleOpenDownloadsFolder = async () => {
    try {
      const res = await fetch('/api/open-folder', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ openProjectDownloads: true }) });
      const d = await res.json();
      toast(d.success ? { title: '폴더 열기', description: 'downloads 폴더를 열었습니다.' } : { title: '폴더 열기 실패', description: d.error, variant: 'destructive' });
    } catch { toast({ title: '폴더 열기 실패', variant: 'destructive' }); }
  };

  const runBuild = async (endpoint: string, label: string) => {
    const { addLog, clearLogs } = useConversionStore.getState();
    clearLogs();
    setIsBuilding(true); setBuildProgress(0); setBuildStage(`${label} 준비 중...`);
    addLog(`${label}를 시작합니다...`);
    toast({ title: `${label} 시작`, description: '우측 진행률을 확인하세요.' });
    if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission();
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      if (!res.ok) throw new Error('요청 실패');
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() || '';
        for (const p of parts) {
          if (!p.startsWith('data: ')) continue;
          try {
            const d = JSON.parse(p.slice(6));
            if (d.type === 'progress') {
              if (d.percent !== undefined) { setBuildProgress(d.percent); setBuildStage(d.message); }
              addLog(d.message);
            } else if (d.type === 'complete') {
              setBuildProgress(100); setBuildStage('빌드 완료!'); setIsBuilding(false);
              addLog('🎉 빌드가 완료되었습니다!');
              toast({ title: '🎉 빌드 완료!', description: '설치가 완료되었습니다.', duration: 10000 });
              if ('Notification' in window && Notification.permission === 'granted')
                new Notification(`🎉 ${label} 완료!`, { body: 'EasyConversion 빌드 성공.' });
            } else if (d.type === 'error') {
              setIsBuilding(false); setBuildStage('빌드 실패'); addLog(`❌ ${d.error}`);
              toast({ title: '빌드 실패', description: d.error, variant: 'destructive' });
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setIsBuilding(false);
      const isNav = err?.name === 'AbortError' || !err?.message || err?.message?.includes('network') || err?.message?.includes('fetch');
      if (isNav) { setBuildStage('백그라운드 진행 중...'); toast({ title: '빌드 백그라운드 진행 중', description: '완료 시 알림이 옵니다.' }); return; }
      setBuildStage('빌드 실패'); addLog(`❌ ${err.message}`);
      toast({ title: '빌드 실패', description: err.message, variant: 'destructive' });
    }
  };

  const formatBytes = (b: number) => {
    if (!b) return '0 Bytes';
    const k = 1024, s = ['Bytes','KB','MB','GB','TB'], i = Math.floor(Math.log(b) / Math.log(k));
    return +(b / Math.pow(k, i)).toFixed(2) + ' ' + s[i];
  };

  const handleAutoCleanup = async () => {
    try {
      const check = await (await fetch('/api/cleanup/auto')).json();
      if (!check.success) throw new Error(check.error);
      if (!check.oldSessions?.length) { toast({ title: '정리 완료', description: '정리할 파일이 없습니다.' }); return; }
      if (!confirm(`${check.oldSessions.length}개 세션 (${check.totalOldSizeGB})를 삭제할까요?`)) return;
      const r = await (await fetch('/api/cleanup/auto', { method: 'POST' })).json();
      if (!r.success) throw new Error(r.error);
      toast({ title: '정리 완료', description: `${r.deletedSessions?.length || 0}개 삭제 (${r.freedSpaceGB} 확보)` });
    } catch (e: any) { toast({ title: '정리 실패', description: e.message, variant: 'destructive' }); }
  };

  const handleCleanupUploads = async () => {
    try {
      const check = await (await fetch('/api/cleanup/uploads')).json();
      if (!check.success) throw new Error(check.error);
      if (!check.totalSessions) { toast({ title: '정리 완료', description: 'tmp/uploads가 이미 비어있습니다.' }); return; }
      if (!confirm(`⚠️ tmp/uploads 전체 삭제 (${check.totalSessions}개, ${check.totalSizeGB})\n현재 세션도 삭제됩니다. 계속?`)) return;
      if (!confirm('정말 삭제하시겠습니까? 되돌릴 수 없습니다.')) return;
      const r = await (await fetch('/api/cleanup/uploads', { method: 'POST' })).json();
      if (!r.success) throw new Error(r.error);
      toast({ title: '삭제 완료', description: `${r.deletedSessions?.length || 0}개 삭제 (${r.freedSpaceGB} 확보)` });
      setSessionId(generateSessionId());
    } catch (e: any) { toast({ title: '삭제 실패', description: e.message, variant: 'destructive' }); }
  };

  const handleRestoreSession = () => {
    const prev = restoreSession();
    if (!prev) return;
    setSessionId(prev.sessionId);
    setActiveTab(prev.activeTab);
    prev.uploadedFiles.forEach(f => addFile({ id: f.id, name: f.name, size: f.size, type: f.type, file: new File([], f.name, { type: f.type }) }));
    setCanRestoreSession(false);
    toast({ title: '세션 복구 완료', description: `${prev.uploadedFiles.length}개 파일 복구됨` });
  };

  useEffect(() => {
    const fetch_ = async () => {
      try {
        const r = await fetch('/api/project-files/list');
        if (!r.ok) return;
        const d = await r.json();
        if (d.success && d.totalSize !== undefined) setTotalStorage(d.totalSize);
      } catch {}
    };
    const t = setTimeout(fetch_, 3000);
    const iv = setInterval(fetch_, 30000);
    return () => { clearTimeout(t); clearInterval(iv); };
  }, []);

  const activeTool = ALL_NAV.find(n => n.id === activeTab) || ALL_NAV[0];

  return (
    <div className="ec-app">
      {/* ── Topbar ── */}
      <header className="ec-topbar">
        <div className="ec-brand">
          <div className="ec-brand__mark">
            <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
              <defs>
                <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#312e81"/>
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#bg)"/>
              <path d="M11 11h10M11 16h6M11 21h10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="ec-brand__text">
            <div className="ec-brand__name">EasyConversion <span>Web</span></div>
            <div className="ec-brand__tag">올인원 파일 변환 워크스페이스</div>
          </div>
        </div>
        <div className="ec-topbar__actions">
          {!isElectron && (
            <SystemMenu
              onBuildDMG={() => runBuild('/api/build-dmg', 'DMG 빌드')}
              onBuildApp={() => runBuild('/api/build-app', '앱 빌드')}
              onOpenDist={handleOpenDistFolder}
              onOpenDownloads={handleOpenDownloadsFolder}
              onManageFiles={() => setIsProjectFilesOpen(true)}
              isBuilding={isBuilding}
            />
          )}
          <button className="ec-iconbtn ec-iconbtn--solid" onClick={() => window.location.reload()}>
            <Ico d={ICONS.refresh} size={13}/><span>새로고침</span>
          </button>
        </div>
      </header>

      {/* ── Shell ── */}
      <div className="ec-shell">
        {/* Sidebar */}
        <aside className="ec-sidebar">
          {NAV_GROUPS.map(g => (
            <div className="ec-navgroup" key={g.label}>
              <div className="ec-navgroup__label">{g.label}</div>
              {g.items.map(it => (
                <button
                  key={it.id}
                  className={`ec-navitem ${activeTab === it.id ? 'is-active' : ''}`}
                  onClick={() => setActiveTab(it.id)}>
                  <span className="ec-navitem__icon"><Ico d={ICONS[it.icon]} size={14}/></span>
                  <span className="ec-navitem__body">
                    <span className="ec-navitem__label">{it.label}</span>
                    <span className="ec-navitem__desc">{it.desc}</span>
                  </span>
                  {activeTab === it.id && <span className="ec-navitem__rail"/>}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Main content */}
        <main className="ec-main">
          {/* Session restore banner */}
          {canRestoreSession && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', background:'oklch(0.96 0.02 268)', border:'1px solid oklch(0.88 0.04 268)', borderRadius:10, fontSize:13 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Ico d={ICONS.restore} size={16}/>
                <div>
                  <div style={{ fontWeight:600 }}>이전 작업 세션이 발견되었습니다</div>
                  <div style={{ fontSize:12, opacity:0.75 }}>작업하던 파일을 복구하시겠습니까?</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="ec-iconbtn ec-iconbtn--solid" onClick={handleRestoreSession}>복구하기</button>
                <button className="ec-iconbtn" onClick={() => { clearSession(); setCanRestoreSession(false); }}>새로 시작</button>
              </div>
            </div>
          )}

          {/* Breadcrumb */}
          <div className="ec-breadcrumbs">
            <span>도구</span>
            <Ico d={ICONS.chevron} size={11} className="ec-bc-chev"/>
            <span className="is-here">{activeTool.label}</span>
          </div>

          {/* Main grid */}
          <div className="ec-main__grid">
            {/* Left: tool + log */}
            <div className="ec-main__col">
              {renderTab(activeTab)}

              {/* Log panel */}
              <section className="ec-card">
                <div className="ec-log__head">
                  <div className="ec-log__title">
                    <span className="ec-log__dot"/>
                    <span>실행 로그</span>
                    {logs.length > 0 && <span className="ec-pill ec-pill--neutral">{logs.length}</span>}
                  </div>
                  <div className="ec-log__actions">
                    <button className="ec-iconbtn" disabled={!logs.length}
                      onClick={() => navigator.clipboard?.writeText(logs.join('\n'))}>
                      <Ico d={ICONS.copy} size={13}/><span>복사</span>
                    </button>
                    <button className="ec-iconbtn" disabled={!logs.length} onClick={clearLogs}>
                      <Ico d={ICONS.trash} size={13}/><span>지우기</span>
                    </button>
                  </div>
                </div>
                <div className={`ec-log__body ${!logs.length ? 'is-empty' : ''}`}>
                  {!logs.length ? (
                    <div className="ec-log__empty">
                      <Ico d={ICONS.cpu} size={20}/>
                      <span>로그가 없습니다 — 작업을 시작하면 진행 상황이 표시됩니다</span>
                    </div>
                  ) : logs.map((l, i) => (
                    <div className="ec-log__line" key={i}>
                      <span className="ec-log__msg">{l}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            {/* Right rail */}
            <div className="ec-main__rail">
              {/* Build progress */}
              {!isElectron && isBuilding && (
                <section className="ec-card">
                  <div className="ec-build">
                    <div className="ec-build__hdr">
                      <span className="ec-build__label">{buildStage}</span>
                      <span className="ec-build__pct">{buildProgress}%</span>
                    </div>
                    <div className="ec-build__bar">
                      <div className="ec-build__fill" style={{ width: `${buildProgress}%` }}/>
                    </div>
                  </div>
                </section>
              )}

              {/* Status rail */}
              <section className="ec-card">
                <div className="ec-rail">
                  <div className="ec-rail__row">
                    <div className="ec-rail__icon"><Ico d={ICONS.db} size={15}/></div>
                    <div className="ec-rail__col">
                      <div className="ec-rail__label">저장 용량</div>
                      <div className="ec-rail__value">{formatBytes(totalStorage)}</div>
                    </div>
                  </div>
                  <div className="ec-rail__divider"/>
                  <div className="ec-rail__actions">
                    <button className="ec-rail__btn" onClick={handleAutoCleanup}>
                      <Ico d={ICONS.clock} size={13}/>
                      <span>임시 파일 정리 <em>24h+</em></span>
                    </button>
                    <button className="ec-rail__btn ec-rail__btn--danger" onClick={handleCleanupUploads}>
                      <Ico d={ICONS.trash} size={13}/>
                      <span>전체 삭제 (tmp/uploads)</span>
                    </button>
                    <button className="ec-rail__btn" onClick={() => setIsProjectFilesOpen(true)}>
                      <Ico d={ICONS.folder} size={13}/>
                      <span>프로젝트 파일 관리</span>
                    </button>
                  </div>
                </div>
              </section>

              {/* Tip card */}
              <section className="ec-card">
                <div className="ec-tip">
                  <div className="ec-tip__hdr">
                    <Ico d={ICONS.sparkle} size={14}/>
                    <span>빠른 팁</span>
                  </div>
                  <div className="ec-tip__body">
                    파일을 끌어다 놓는 대신 <kbd>⌘V</kbd> / <kbd>Ctrl+V</kbd>로 클립보드의 URL을 즉시 붙여넣을 수 있습니다.
                  </div>
                </div>
              </section>
            </div>
          </div>

          <footer className="ec-foot">
            <span>2026 CS &amp; Company. All rights reserved.</span>
            <span className="ec-foot__sep">·</span>
            <span>로컬 처리 — 업로드된 파일은 기기를 떠나지 않습니다</span>
          </footer>
        </main>
      </div>

      <ProjectFilesDialog
        isOpen={isProjectFilesOpen}
        onClose={() => setIsProjectFilesOpen(false)}
      />
    </div>
  );
}
