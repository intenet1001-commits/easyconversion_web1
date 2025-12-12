# EasyConversion Web - Execution Plan

## 목차
- [Phase 1: 프로젝트 셋업](#phase-1-프로젝트-셋업)
- [Phase 2: 미디어 변환](#phase-2-미디어-변환)
- [Phase 3: YouTube 다운로드](#phase-3-youtube-다운로드)
- [Phase 4: 비디오 분할/병합](#phase-4-비디오-분할병합)
- [Phase 5: 문서 변환](#phase-5-문서-변환)
- [Phase 6: 문서 병합/분할](#phase-6-문서-병합분할)
- [Phase 7: 테스트 & 최적화](#phase-7-테스트--최적화)

---

## Phase 1: 프로젝트 셋업

**목표**: Next.js 프로젝트 초기화 및 기본 UI 프레임워크 구축
**기간**: 1일
**독립 테스트 가능**: ✅ 기본 레이아웃과 탭 네비게이션 동작 확인

### 1.1 Next.js 프로젝트 초기화

#### 작업 내용
```bash
# Next.js 프로젝트 생성
npx create-next-app@latest easyconversion-web --typescript --tailwind --app --no-src-dir

# 프로젝트 디렉토리로 이동
cd easyconversion-web
```

#### 프로젝트 구조
```
easyconversion-web/
├── app/
│   ├── layout.tsx              # 루트 레이아웃
│   ├── page.tsx                # 메인 페이지
│   ├── api/                    # API Routes
│   │   ├── media/
│   │   ├── youtube/
│   │   └── document/
│   └── globals.css
├── components/
│   ├── ui/                     # shadcn/ui 컴포넌트
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Footer.tsx
│   │   └── MainLayout.tsx
│   ├── common/
│   │   ├── FileUploader.tsx
│   │   ├── ProgressBar.tsx
│   │   ├── FormatSelector.tsx
│   │   ├── FileList.tsx
│   │   └── LogViewer.tsx
│   └── tabs/
│       ├── YouTubeTab.tsx
│       ├── MediaConvertTab.tsx
│       ├── MediaSplitTab.tsx
│       ├── MediaMergeTab.tsx
│       ├── DocumentConvertTab.tsx
│       ├── DocumentMergeTab.tsx
│       └── DocumentSplitTab.tsx
├── lib/
│   ├── utils.ts                # 유틸리티 함수
│   ├── ffmpeg.ts               # FFmpeg 래퍼
│   ├── session.ts              # 세션 관리
│   └── file-validator.ts       # 파일 검증
├── store/
│   └── useConversionStore.ts   # Zustand 상태 관리
├── types/
│   └── index.ts                # TypeScript 타입 정의
├── public/
│   └── downloads/              # 변환된 파일 임시 저장
├── tmp/
│   ├── uploads/                # 업로드 파일
│   └── outputs/                # 변환 결과
└── package.json
```

### 1.2 의존성 설치

#### 필수 패키지 설치
```bash
# shadcn/ui 초기화
npx shadcn-ui@latest init

# shadcn/ui 컴포넌트 설치
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add select
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add progress
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add scroll-area
npx shadcn-ui@latest add radio-group
npx shadcn-ui@latest add label
npx shadcn-ui@latest add separator

# 파일 업로드
npm install react-dropzone

# 상태 관리
npm install zustand

# UUID 생성
npm install uuid
npm install -D @types/uuid

# 파일 타입 검증
npm install file-type

# 날짜 처리
npm install date-fns
```

#### Phase 2+ 패키지 (참고용)
```bash
# 미디어 처리 (Phase 2)
npm install fluent-ffmpeg
npm install -D @types/fluent-ffmpeg

# YouTube 다운로드 (Phase 3)
npm install @distube/ytdl-core

# 문서 처리 (Phase 5)
npm install pdf-lib
npm install docx
npm install pptxgenjs
npm install markdown-it
npm install -D @types/markdown-it
npm install cheerio
npm install puppeteer

# 파일 업로드 처리
npm install formidable
npm install -D @types/formidable

# 임시 파일 정리
npm install node-cron
npm install -D @types/node-cron
```

### 1.3 환경 변수 설정

#### `.env.local` 생성
```env
# 파일 스토리지 경로
UPLOAD_DIR=./tmp/uploads
OUTPUT_DIR=./tmp/outputs
PUBLIC_DOWNLOAD_DIR=./public/downloads

# 파일 크기 제한 (500MB)
MAX_FILE_SIZE=524288000

# FFmpeg 경로 (macOS Homebrew 기본)
FFMPEG_PATH=/opt/homebrew/bin/ffmpeg
FFPROBE_PATH=/opt/homebrew/bin/ffprobe

# 세션 정리 주기 (분)
SESSION_CLEANUP_INTERVAL=60

# 파일 자동 삭제 시간 (밀리초, 1시간)
FILE_AUTO_DELETE_TIME=3600000

# 병렬 처리 제한
MAX_CONCURRENT_CONVERSIONS=4

# Next.js
NEXT_PUBLIC_APP_NAME="EasyConversion Web"
```

### 1.4 TypeScript 타입 정의

#### `types/index.ts` 생성
```typescript
// 파일 형식
export type MediaFormat = 'mp4' | 'mp3' | 'mov' | 'wav';
export type DocumentFormat = 'pdf' | 'docx' | 'pptx' | 'md' | 'html';
export type YouTubeFormat = 'mp4' | 'mp3';

// 파일 정보
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  file: File;
}

// 변환 진행 상태
export interface ConversionProgress {
  fileId: string;
  fileName: string;
  progress: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
  outputUrl?: string;
}

// 미디어 분할 모드
export type SplitMode = 'timepoints' | 'segments';

// 문서 분할 모드
export type DocumentSplitMode = 'ranges' | 'equal' | 'pageCount' | 'heading' | 'section';

// API 응답
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// 세션 정보
export interface SessionInfo {
  sessionId: string;
  createdAt: number;
  expiresAt: number;
}
```

### 1.5 Zustand 상태 관리 설정

#### `store/useConversionStore.ts` 생성
```typescript
import { create } from 'zustand';
import { FileInfo, ConversionProgress } from '@/types';

interface ConversionStore {
  // 업로드된 파일
  files: FileInfo[];
  addFile: (file: FileInfo) => void;
  removeFile: (fileId: string) => void;
  clearFiles: () => void;
  reorderFiles: (startIndex: number, endIndex: number) => void;

  // 변환 진행 상태
  progressList: ConversionProgress[];
  updateProgress: (progress: ConversionProgress) => void;
  clearProgress: () => void;

  // 로그
  logs: string[];
  addLog: (log: string) => void;
  clearLogs: () => void;

  // 현재 탭
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // 세션 ID
  sessionId: string;
  setSessionId: (id: string) => void;
}

export const useConversionStore = create<ConversionStore>((set) => ({
  files: [],
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  removeFile: (fileId) =>
    set((state) => ({ files: state.files.filter((f) => f.id !== fileId) })),
  clearFiles: () => set({ files: [] }),
  reorderFiles: (startIndex, endIndex) =>
    set((state) => {
      const result = Array.from(state.files);
      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);
      return { files: result };
    }),

  progressList: [],
  updateProgress: (progress) =>
    set((state) => {
      const index = state.progressList.findIndex((p) => p.fileId === progress.fileId);
      if (index >= 0) {
        const newList = [...state.progressList];
        newList[index] = progress;
        return { progressList: newList };
      }
      return { progressList: [...state.progressList, progress] };
    }),
  clearProgress: () => set({ progressList: [] }),

  logs: [],
  addLog: (log) =>
    set((state) => ({
      logs: [...state.logs, `[${new Date().toLocaleTimeString()}] ${log}`],
    })),
  clearLogs: () => set({ logs: [] }),

  activeTab: 'youtube',
  setActiveTab: (tab) => set({ activeTab: tab }),

  sessionId: '',
  setSessionId: (id) => set({ sessionId: id }),
}));
```

### 1.6 유틸리티 함수

#### `lib/utils.ts` 확장
```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { v4 as uuidv4 } from 'uuid';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 파일 크기 포맷팅
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// 세션 ID 생성
export function generateSessionId(): string {
  return uuidv4();
}

// 파일 확장자 추출
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf('.') - 1) >>> 0) + 2).toLowerCase();
}

// 파일명에서 확장자 제거
export function removeFileExtension(filename: string): string {
  return filename.replace(/\.[^/.]+$/, '');
}

// 시간 포맷팅 (HH:MM:SS)
export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
}

// 시간 파싱 (HH:MM:SS -> seconds)
export function parseTime(timeString: string): number {
  const parts = timeString.split(':').map(Number);
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
}
```

#### `lib/file-validator.ts` 생성
```typescript
import { fileTypeFromBuffer } from 'file-type';

export const MEDIA_FORMATS = ['mp4', 'mp3', 'mov', 'wav', 'avi', 'mkv'];
export const DOCUMENT_FORMATS = ['pdf', 'docx', 'pptx', 'md', 'html'];

export async function validateFile(
  file: File,
  allowedFormats: string[]
): Promise<{ valid: boolean; error?: string }> {
  // 크기 확인
  const maxSize = parseInt(process.env.MAX_FILE_SIZE || '524288000');
  if (file.size > maxSize) {
    return {
      valid: false,
      error: `파일 크기가 너무 큽니다. (최대 ${Math.round(maxSize / 1024 / 1024)}MB)`,
    };
  }

  // 확장자 확인
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !allowedFormats.includes(ext)) {
    return {
      valid: false,
      error: `지원되지 않는 파일 형식입니다. (허용: ${allowedFormats.join(', ')})`,
    };
  }

  return { valid: true };
}

export function isMediaFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? MEDIA_FORMATS.includes(ext) : false;
}

export function isDocumentFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext ? DOCUMENT_FORMATS.includes(ext) : false;
}
```

### 1.7 기본 레이아웃 구현

#### `app/layout.tsx` 수정
```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EasyConversion Web",
  description: "올인원 파일 변환 웹 애플리케이션",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className={inter.className}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
```

#### `components/layout/Header.tsx` 생성
```typescript
export function Header() {
  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-3xl font-bold text-primary">
          EasyConversion Web
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          올인원 파일 변환 웹 애플리케이션
        </p>
      </div>
    </header>
  );
}
```

#### `components/layout/MainLayout.tsx` 생성
```typescript
import { ReactNode } from 'react';
import { Header } from './Header';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
}
```

### 1.8 탭 네비게이션 구현

#### `app/page.tsx` 구현
```typescript
'use client';

import { MainLayout } from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConversionStore } from '@/store/useConversionStore';
import { useEffect } from 'react';
import { generateSessionId } from '@/lib/utils';

// 탭 컴포넌트 (Phase 2+에서 구현)
import { YouTubeTab } from '@/components/tabs/YouTubeTab';
import { MediaConvertTab } from '@/components/tabs/MediaConvertTab';
import { MediaSplitTab } from '@/components/tabs/MediaSplitTab';
import { MediaMergeTab } from '@/components/tabs/MediaMergeTab';
import { DocumentConvertTab } from '@/components/tabs/DocumentConvertTab';
import { DocumentMergeTab } from '@/components/tabs/DocumentMergeTab';
import { DocumentSplitTab } from '@/components/tabs/DocumentSplitTab';

export default function Home() {
  const { activeTab, setActiveTab, setSessionId } = useConversionStore();

  useEffect(() => {
    // 세션 ID 생성
    const sessionId = generateSessionId();
    setSessionId(sessionId);
  }, [setSessionId]);

  return (
    <MainLayout>
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
    </MainLayout>
  );
}
```

### 1.9 공통 컴포넌트 구현

#### `components/common/FileUploader.tsx` 생성
```typescript
'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Card } from '@/components/ui/card';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploaderProps {
  onFilesAccepted: (files: File[]) => void;
  acceptedFormats?: string[];
  multiple?: boolean;
  maxSize?: number;
}

export function FileUploader({
  onFilesAccepted,
  acceptedFormats,
  multiple = true,
  maxSize = 524288000, // 500MB
}: FileUploaderProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      onFilesAccepted(acceptedFiles);
    },
    [onFilesAccepted]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple,
    maxSize,
    accept: acceptedFormats?.reduce((acc, format) => {
      acc[`.${format}`] = [];
      return acc;
    }, {} as Record<string, string[]>),
  });

  return (
    <Card
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed p-12 text-center cursor-pointer transition-colors',
        isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
      )}
    >
      <input {...getInputProps()} />
      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      {isDragActive ? (
        <p className="text-lg">파일을 드롭하세요...</p>
      ) : (
        <div>
          <p className="text-lg mb-2">파일을 드래그하거나 클릭하여 업로드</p>
          <p className="text-sm text-muted-foreground">
            {acceptedFormats ? `허용 형식: ${acceptedFormats.join(', ')}` : ''}
          </p>
        </div>
      )}
    </Card>
  );
}
```

#### `components/common/ProgressBar.tsx` 생성
```typescript
import { Progress } from '@/components/ui/progress';

interface ProgressBarProps {
  value: number;
  label?: string;
  showPercentage?: boolean;
}

export function ProgressBar({ value, label, showPercentage = true }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex justify-between text-sm">
          <span>{label}</span>
          {showPercentage && <span className="text-muted-foreground">{value}%</span>}
        </div>
      )}
      <Progress value={value} className="h-2" />
    </div>
  );
}
```

#### `components/common/LogViewer.tsx` 생성
```typescript
'use client';

import { useConversionStore } from '@/store/useConversionStore';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export function LogViewer() {
  const { logs, clearLogs } = useConversionStore();

  return (
    <Card className="p-4 mt-6">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">로그</h3>
        <Button variant="ghost" size="sm" onClick={clearLogs}>
          <Trash2 className="h-4 w-4 mr-2" />
          지우기
        </Button>
      </div>
      <ScrollArea className="h-48 w-full rounded border p-4 bg-muted/50">
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground">로그가 없습니다.</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log, index) => (
              <p key={index} className="text-xs font-mono">
                {log}
              </p>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
}
```

### 1.10 임시 탭 컴포넌트 (Placeholder)

각 탭 컴포넌트를 임시로 생성하여 Phase 1에서 레이아웃 테스트 가능하도록 합니다.

#### `components/tabs/YouTubeTab.tsx`
```typescript
import { Card } from '@/components/ui/card';

export function YouTubeTab() {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">YouTube 다운로드</h2>
      <p className="text-muted-foreground">Phase 3에서 구현 예정</p>
    </Card>
  );
}
```

#### `components/tabs/MediaConvertTab.tsx`
```typescript
import { Card } from '@/components/ui/card';

export function MediaConvertTab() {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4">미디어 변환</h2>
      <p className="text-muted-foreground">Phase 2에서 구현 예정</p>
    </Card>
  );
}
```

나머지 탭도 동일한 패턴으로 생성합니다.

### 1.11 Phase 1 테스트

#### 테스트 체크리스트
```bash
# 개발 서버 실행
npm run dev
```

**확인 사항**:
- [ ] 프로젝트가 http://localhost:3000에서 정상 실행
- [ ] Header가 올바르게 표시됨
- [ ] 7개 탭이 모두 표시되고 클릭 시 전환됨
- [ ] 각 탭에 placeholder 컨텐츠가 표시됨
- [ ] 반응형 레이아웃이 작동함 (브라우저 크기 조정 시)
- [ ] Tailwind CSS 스타일이 적용됨
- [ ] shadcn/ui 컴포넌트가 정상 렌더링됨
- [ ] 콘솔에 에러가 없음

#### 스크린샷 확인
- 메인 페이지 전체 레이아웃
- 각 탭 전환 동작
- 모바일/태블릿 반응형 뷰

---

## Phase 2: 미디어 변환

**목표**: FFmpeg 통합 및 미디어 파일 변환 기능 구현
**기간**: 3일
**독립 테스트 가능**: ✅ 미디어 파일 업로드 → 변환 → 다운로드 전체 플로우

### 2.1 사전 준비

#### FFmpeg 설치 확인
```bash
# macOS
brew install ffmpeg

# 설치 확인
ffmpeg -version
ffprobe -version

# 경로 확인
which ffmpeg
which ffprobe
```

#### 추가 패키지 설치
```bash
npm install fluent-ffmpeg
npm install -D @types/fluent-ffmpeg
npm install formidable
npm install -D @types/formidable
```

### 2.2 FFmpeg 래퍼 구현

#### `lib/ffmpeg.ts` 생성
```typescript
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import { MediaFormat } from '@/types';

// FFmpeg 경로 설정
const FFMPEG_PATH = process.env.FFMPEG_PATH || '/opt/homebrew/bin/ffmpeg';
const FFPROBE_PATH = process.env.FFPROBE_PATH || '/opt/homebrew/bin/ffprobe';

ffmpeg.setFfmpegPath(FFMPEG_PATH);
ffmpeg.setFfprobePath(FFPROBE_PATH);

export interface ConvertOptions {
  inputPath: string;
  outputPath: string;
  outputFormat: MediaFormat;
  onProgress?: (progress: number) => void;
}

export async function convertMedia({
  inputPath,
  outputPath,
  outputFormat,
  onProgress,
}: ConvertOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    let duration: number = 0;

    const command = ffmpeg(inputPath);

    // 비디오 형식 설정
    if (outputFormat === 'mp4' || outputFormat === 'mov') {
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .videoBitrate('5000k')
        .audioBitrate('192k')
        .outputOptions([
          '-preset fast',
          '-crf 23',
        ]);

      if (outputFormat === 'mp4') {
        command.outputOptions(['-movflags', '+faststart']);
      }
    }
    // 오디오 형식 설정
    else if (outputFormat === 'mp3') {
      command
        .audioCodec('libmp3lame')
        .audioBitrate('192k')
        .noVideo();
    } else if (outputFormat === 'wav') {
      command
        .audioCodec('pcm_s16le')
        .noVideo();
    }

    // 진행률 추적
    command
      .on('codecData', (data) => {
        // 전체 길이 추출
        const time = data.duration.split(':');
        duration = parseInt(time[0]) * 3600 + parseInt(time[1]) * 60 + parseFloat(time[2]);
      })
      .on('progress', (progress) => {
        if (duration > 0 && onProgress) {
          const time = progress.timemark.split(':');
          const currentTime = parseInt(time[0]) * 3600 + parseInt(time[1]) * 60 + parseFloat(time[2]);
          const percent = Math.min(Math.round((currentTime / duration) * 100), 100);
          onProgress(percent);
        }
      })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

// 미디어 정보 추출
export async function getMediaInfo(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) reject(err);
      else resolve(metadata);
    });
  });
}

// 미디어 길이 추출 (초 단위)
export async function getMediaDuration(filePath: string): Promise<number> {
  const info = await getMediaInfo(filePath);
  return info.format.duration || 0;
}
```

### 2.3 파일 업로드 API

#### `app/api/upload/route.ts` 생성
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const sessionId = formData.get('sessionId') as string;

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // 세션 업로드 디렉토리 생성
    const uploadDir = path.join(process.cwd(), 'tmp', 'uploads', sessionId);
    await mkdir(uploadDir, { recursive: true });

    const uploadedFiles = [];

    for (const file of files) {
      const fileId = uuidv4();
      const fileName = `${fileId}_${file.name}`;
      const filePath = path.join(uploadDir, fileName);

      // 파일 저장
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      await writeFile(filePath, buffer);

      uploadedFiles.push({
        fileId,
        originalName: file.name,
        savedName: fileName,
        path: filePath,
        size: file.size,
      });
    }

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

### 2.4 미디어 변환 API (SSE)

#### `app/api/media/convert/route.ts` 생성
```typescript
import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { convertMedia } from '@/lib/ffmpeg';
import { MediaFormat } from '@/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const formData = await request.formData();

  const filesData = JSON.parse(formData.get('filesData') as string);
  const outputFormat = formData.get('outputFormat') as MediaFormat;
  const sessionId = formData.get('sessionId') as string;

  // 출력 디렉토리 생성
  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for (let i = 0; i < filesData.length; i++) {
          const file = filesData[i];
          const inputPath = file.path;
          const baseName = path.parse(file.originalName).name;
          const outputFileName = `${baseName}.${outputFormat}`;
          const outputPath = path.join(outputDir, outputFileName);

          // 변환 시작 메시지
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'progress',
                fileIndex: i,
                fileName: file.originalName,
                progress: 0,
                message: `변환 시작: ${file.originalName}`,
              })}\n\n`
            )
          );

          // 변환 실행
          await convertMedia({
            inputPath,
            outputPath,
            outputFormat,
            onProgress: (progress) => {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'progress',
                    fileIndex: i,
                    fileName: file.originalName,
                    progress,
                    message: `변환 중: ${file.originalName} (${progress}%)`,
                  })}\n\n`
                )
              );
            },
          });

          // 완료 메시지
          const downloadUrl = `/downloads/${sessionId}/${outputFileName}`;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'complete',
                fileIndex: i,
                fileName: file.originalName,
                outputUrl: downloadUrl,
                message: `완료: ${outputFileName}`,
              })}\n\n`
            )
          );
        }

        // 모든 변환 완료
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'done', message: '모든 변환이 완료되었습니다.' })}\n\n`
          )
        );
        controller.close();
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

### 2.5 미디어 변환 탭 UI 구현

#### `components/tabs/MediaConvertTab.tsx` 완전 구현
```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileUploader } from '@/components/common/FileUploader';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { MediaFormat, FileInfo, ConversionProgress } from '@/types';
import { validateFile, MEDIA_FORMATS } from '@/lib/file-validator';
import { formatFileSize } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { X, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

export function MediaConvertTab() {
  const { toast } = useToast();
  const { files, addFile, removeFile, clearFiles, sessionId, addLog, progressList, updateProgress, clearProgress } = useConversionStore();
  const [outputFormat, setOutputFormat] = useState<MediaFormat>('mp4');
  const [isConverting, setIsConverting] = useState(false);

  const handleFilesAccepted = async (acceptedFiles: File[]) => {
    for (const file of acceptedFiles) {
      const validation = await validateFile(file, MEDIA_FORMATS);
      if (!validation.valid) {
        toast({ title: '파일 검증 실패', description: validation.error, variant: 'destructive' });
        continue;
      }

      const fileInfo: FileInfo = {
        id: uuidv4(),
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      };
      addFile(fileInfo);
      addLog(`파일 추가됨: ${file.name} (${formatFileSize(file.size)})`);
    }
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      toast({ title: '파일을 선택해주세요', variant: 'destructive' });
      return;
    }

    setIsConverting(true);
    clearProgress();
    addLog(`변환 시작: ${files.length}개 파일 → ${outputFormat.toUpperCase()}`);

    try {
      // 1. 파일 업로드
      const formData = new FormData();
      files.forEach((f) => formData.append('files', f.file));
      formData.append('sessionId', sessionId);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();

      if (!uploadData.success) {
        throw new Error(uploadData.error);
      }

      addLog('파일 업로드 완료');

      // 2. 변환 실행 (SSE)
      const convertFormData = new FormData();
      convertFormData.append('filesData', JSON.stringify(uploadData.files));
      convertFormData.append('outputFormat', outputFormat);
      convertFormData.append('sessionId', sessionId);

      const response = await fetch('/api/media/convert', {
        method: 'POST',
        body: convertFormData,
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('스트림을 읽을 수 없습니다');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));

            if (data.type === 'progress') {
              updateProgress({
                fileId: files[data.fileIndex].id,
                fileName: data.fileName,
                progress: data.progress,
                status: 'processing',
                message: data.message,
              });
            } else if (data.type === 'complete') {
              updateProgress({
                fileId: files[data.fileIndex].id,
                fileName: data.fileName,
                progress: 100,
                status: 'completed',
                outputUrl: data.outputUrl,
              });
              addLog(data.message);
            } else if (data.type === 'error') {
              toast({ title: '변환 실패', description: data.message, variant: 'destructive' });
              addLog(`오류: ${data.message}`);
            } else if (data.type === 'done') {
              addLog('모든 변환 완료!');
              toast({ title: '변환 완료', description: '모든 파일이 성공적으로 변환되었습니다.' });
            }
          }
        }
      }
    } catch (error: any) {
      toast({ title: '변환 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">미디어 변환</h2>

        <div className="space-y-4">
          <FileUploader
            onFilesAccepted={handleFilesAccepted}
            acceptedFormats={MEDIA_FORMATS}
            multiple
          />

          {files.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">업로드된 파일 ({files.length})</h3>
              {files.map((file) => (
                <div key={file.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeFile(file.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={clearFiles}>
                모두 제거
              </Button>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">출력 형식</label>
            <Select value={outputFormat} onValueChange={(v) => setOutputFormat(v as MediaFormat)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mp4">MP4 (비디오)</SelectItem>
                <SelectItem value="mov">MOV (비디오)</SelectItem>
                <SelectItem value="mp3">MP3 (오디오)</SelectItem>
                <SelectItem value="wav">WAV (오디오)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleConvert} disabled={isConverting || files.length === 0} className="w-full">
            {isConverting ? '변환 중...' : '변환 시작'}
          </Button>
        </div>
      </Card>

      {progressList.length > 0 && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">변환 진행률</h3>
          <div className="space-y-4">
            {progressList.map((p) => (
              <div key={p.fileId}>
                <ProgressBar value={p.progress} label={p.fileName} />
                {p.status === 'completed' && p.outputUrl && (
                  <a href={p.outputUrl} download className="inline-flex items-center text-sm text-primary mt-2">
                    <Download className="h-4 w-4 mr-1" />
                    다운로드
                  </a>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
```

### 2.6 Phase 2 테스트

#### 테스트 시나리오

**시나리오 1: 단일 파일 변환**
1. 미디어 변환 탭 선택
2. MP4 파일 1개 업로드
3. 출력 형식: MP3 선택
4. 변환 시작 클릭
5. 진행률 바 업데이트 확인
6. 변환 완료 후 다운로드 링크 클릭
7. 변환된 MP3 파일 재생 확인

**시나리오 2: 다중 파일 일괄 변환**
1. MP4, MOV 파일 3개 업로드
2. 출력 형식: MP4 선택
3. 변환 시작
4. 3개 파일 각각의 진행률 표시 확인
5. 모든 파일 변환 완료 확인
6. 각 파일 다운로드 가능 확인

**시나리오 3: 에러 처리**
1. 지원되지 않는 형식(.txt) 업로드 시도
2. 에러 토스트 표시 확인
3. 500MB 이상 파일 업로드 시도
4. 파일 크기 제한 에러 확인

**체크리스트**
- [ ] 파일 드래그 앤 드롭 동작
- [ ] 파일 업로드 완료
- [ ] FFmpeg 변환 실행
- [ ] SSE 진행률 실시간 업데이트
- [ ] 변환 완료 시 다운로드 링크 생성
- [ ] 다운로드한 파일이 정상 재생됨
- [ ] 로그에 모든 단계 기록됨
- [ ] 에러 발생 시 토스트 표시
- [ ] 여러 파일 병렬 처리

---

## Phase 3: YouTube 다운로드

**목표**: YouTube URL에서 비디오/오디오 다운로드 기능 구현
**기간**: 2일
**독립 테스트 가능**: ✅ YouTube URL 입력 → 다운로드 → 파일 확인

### 3.1 사전 준비

#### 패키지 설치
```bash
npm install @distube/ytdl-core
```

### 3.2 YouTube 다운로드 유틸리티

#### `lib/youtube.ts` 생성
```typescript
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import path from 'path';

export interface DownloadOptions {
  url: string;
  format: 'mp4' | 'mp3';
  outputPath: string;
  onProgress?: (progress: number) => void;
}

export async function downloadYouTube({
  url,
  format,
  outputPath,
  onProgress,
}: DownloadOptions): Promise<void> {
  return new Promise(async (resolve, reject) => {
    try {
      // URL 검증
      if (!ytdl.validateURL(url)) {
        throw new Error('유효하지 않은 YouTube URL입니다.');
      }

      // 비디오 정보 가져오기
      const info = await ytdl.getInfo(url);
      const title = info.videoDetails.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_');

      if (format === 'mp4') {
        // MP4 다운로드 (비디오 + 오디오)
        const videoStream = ytdl(url, { quality: 'highestvideo' });
        const audioStream = ytdl(url, { quality: 'highestaudio' });

        ffmpeg()
          .input(videoStream)
          .input(audioStream)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-preset fast', '-crf 23'])
          .on('progress', (progress) => {
            if (onProgress && progress.percent) {
              onProgress(Math.round(progress.percent));
            }
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      } else {
        // MP3 다운로드 (오디오만)
        const audioStream = ytdl(url, { quality: 'highestaudio' });

        ffmpeg(audioStream)
          .audioCodec('libmp3lame')
          .audioBitrate('192k')
          .toFormat('mp3')
          .on('progress', (progress) => {
            if (onProgress && progress.percent) {
              onProgress(Math.round(progress.percent));
            }
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .save(outputPath);
      }
    } catch (error) {
      reject(error);
    }
  });
}

// YouTube 비디오 정보만 가져오기
export async function getYouTubeInfo(url: string) {
  if (!ytdl.validateURL(url)) {
    throw new Error('유효하지 않은 YouTube URL입니다.');
  }

  const info = await ytdl.getInfo(url);
  return {
    title: info.videoDetails.title,
    duration: parseInt(info.videoDetails.lengthSeconds),
    thumbnail: info.videoDetails.thumbnails[0]?.url,
    author: info.videoDetails.author.name,
  };
}
```

### 3.3 YouTube 다운로드 API

#### `app/api/youtube/download/route.ts` 생성
```typescript
import { NextRequest } from 'next/server';
import path from 'path';
import { mkdir } from 'fs/promises';
import { downloadYouTube } from '@/lib/youtube';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const { url, format, sessionId } = await request.json();

  // 출력 디렉토리 생성
  const outputDir = path.join(process.cwd(), 'public', 'downloads', sessionId);
  await mkdir(outputDir, { recursive: true });

  const timestamp = Date.now();
  const outputFileName = `youtube_${timestamp}.${format}`;
  const outputPath = path.join(outputDir, outputFileName);

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'start', message: '다운로드를 시작합니다...' })}\n\n`
          )
        );

        await downloadYouTube({
          url,
          format,
          outputPath,
          onProgress: (progress) => {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'progress', progress, message: `다운로드 중: ${progress}%` })}\n\n`
              )
            );
          },
        });

        const downloadUrl = `/downloads/${sessionId}/${outputFileName}`;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'complete', outputUrl: downloadUrl, message: '다운로드 완료!' })}\n\n`
          )
        );
        controller.close();
      } catch (error: any) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

#### `app/api/youtube/info/route.ts` 생성
```typescript
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
```

### 3.4 YouTube 다운로드 탭 UI 구현

#### `components/tabs/YouTubeTab.tsx` 완전 구현
```typescript
'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ProgressBar } from '@/components/common/ProgressBar';
import { LogViewer } from '@/components/common/LogViewer';
import { useConversionStore } from '@/store/useConversionStore';
import { useToast } from '@/hooks/use-toast';
import { Download, Info, Loader2 } from 'lucide-react';

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

  const handleGetInfo = async () => {
    if (!url) {
      toast({ title: 'URL을 입력해주세요', variant: 'destructive' });
      return;
    }

    setIsLoadingInfo(true);
    addLog(`비디오 정보 가져오는 중: ${url}`);

    try {
      const res = await fetch('/api/youtube/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setVideoInfo(data.info);
      addLog(`제목: ${data.info.title}`);
      toast({ title: '정보 로드 완료', description: data.info.title });
    } catch (error: any) {
      toast({ title: '정보 로드 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsLoadingInfo(false);
    }
  };

  const handleDownload = async () => {
    if (!url) {
      toast({ title: 'URL을 입력해주세요', variant: 'destructive' });
      return;
    }

    setIsDownloading(true);
    setProgress(0);
    setDownloadUrl('');
    addLog(`다운로드 시작: ${url} (${format.toUpperCase()})`);

    try {
      const response = await fetch('/api/youtube/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, format, sessionId }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error('스트림을 읽을 수 없습니다');

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
              setDownloadUrl(data.outputUrl);
              addLog(data.message);
              toast({ title: '다운로드 완료' });
            } else if (data.type === 'error') {
              throw new Error(data.message);
            }

            if (data.message) {
              addLog(data.message);
            }
          }
        }
      }
    } catch (error: any) {
      toast({ title: '다운로드 실패', description: error.message, variant: 'destructive' });
      addLog(`오류: ${error.message}`);
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setUrl(text);
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

          <Button onClick={handleDownload} disabled={isDownloading || !url} className="w-full">
            {isDownloading ? '다운로드 중...' : '다운로드 시작'}
          </Button>
        </div>
      </Card>

      {isDownloading && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드 진행률</h3>
          <ProgressBar value={progress} label="YouTube 다운로드" />
        </Card>
      )}

      {downloadUrl && (
        <Card className="p-6">
          <h3 className="font-semibold mb-4">다운로드 완료</h3>
          <a href={downloadUrl} download className="inline-flex items-center text-primary">
            <Download className="h-4 w-4 mr-2" />
            파일 다운로드
          </a>
        </Card>
      )}

      <LogViewer />
    </div>
  );
}
```

### 3.5 Phase 3 테스트

#### 테스트 시나리오

**시나리오 1: MP4 다운로드**
1. YouTube 탭 선택
2. 유효한 YouTube URL 입력
3. 정보 버튼 클릭하여 비디오 정보 확인
4. 형식: MP4 선택
5. 다운로드 시작
6. 진행률 표시 확인
7. 다운로드 완료 후 파일 재생 확인

**시나리오 2: MP3 다운로드**
1. YouTube URL 입력
2. 형식: MP3 선택
3. 다운로드 시작
4. 오디오 파일 다운로드 및 재생 확인

**시나리오 3: 에러 처리**
1. 잘못된 URL 입력
2. 에러 메시지 표시 확인
3. 존재하지 않는 비디오 URL
4. 적절한 에러 핸들링 확인

**체크리스트**
- [ ] URL 검증 동작
- [ ] 비디오 정보 로드
- [ ] 썸네일 표시
- [ ] MP4 다운로드 성공
- [ ] MP3 다운로드 성공
- [ ] 진행률 실시간 업데이트
- [ ] 다운로드 완료 후 파일 재생 가능
- [ ] 에러 발생 시 토스트 표시

---

*다음 Phase 4-7은 별도 파일에 계속됩니다...*
