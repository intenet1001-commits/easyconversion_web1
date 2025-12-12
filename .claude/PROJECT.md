# EasyConversion Web v1

Next.js 기반 미디어/문서 변환 웹 애플리케이션

## 프로젝트 개요

Python/Tkinter 데스크톱 애플리케이션(EasyConversion v4)을 Next.js 15 웹 애플리케이션으로 전환한 프로젝트입니다.

## 기술 스택

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: shadcn/ui
- **State Management**: Zustand
- **Media Processing**: FFmpeg (fluent-ffmpeg)
- **Document Processing**: pdf-lib, mammoth, docx, marked
- **PDF Processing**: pdf-lib
- **File Upload**: formidable (대용량 파일 스트리밍)
- **Drag & Drop**: @dnd-kit (파일 순서 조정)
- **YouTube**: @distube/ytdl-core
- **Desktop App**: Electron (macOS .app + .dmg 빌드)

## 주요 기능

### 1. YouTube 다운로드
- URL 입력으로 비디오/오디오 다운로드
- 포맷 선택 (mp4, mp3, webm 등)
- 실시간 진행률 표시

### 2. 미디어 변환 ⭐⭐
- **순차 처리**: 여러 파일 선택 시 한 번에 업로드하지 않고 순차적으로 처리
- **메모리 효율**: 파일 1개씩 업로드 → 변환 → 다음 파일
- **포맷 변환**: mp4, mov, mp3, wav 등
- **업로드 진행률**: XMLHttpRequest를 통한 실시간 진행률
- **변환 진행률**: SSE로 FFmpeg 진행률 실시간 표시
- **파일명 커스터마이징**: 각 파일별 사용자 지정 이름
- **선택/전체 다운로드**: 체크박스로 원하는 파일만 다운로드
- **폴더 열기**: ~/Downloads 폴더 바로 열기
- **안정성 개선** ⭐ NEW:
  - 30초 멈춤 감지 및 자동 재시작
  - 최대 2회 자동 재시도
  - 개별 파일 실패 시 다음 파일 계속 처리
  - FFmpeg 큐 크기 증가 (대용량 파일 안정성)
  - 상세 로깅 (디버깅 용이)

### 3. 비디오 분할 ⭐
- **시간 지점 분할**: 사용자 지정 시간(HH:MM:SS)으로 분할
- **균등 분할**: N개 구간으로 동일하게 분할
- **일괄 시간 입력**: 여러 시간을 한 번에 붙여넣기 (예: "02 45 16" 형식)
- **자동 시간 포맷팅**: 콜론 자동 삽입
- **파일명 커스터마이징**: 각 구간별 파일명 입력 가능
- **선택/전체 다운로드**: 체크박스로 원하는 파일만 다운로드
- **폴더 열기**: macOS Finder/Windows 탐색기로 다운로드 폴더 바로 열기
- **대용량 파일 지원**: 50GB까지 업로드 가능 (스트리밍 방식)
- **실시간 진행률**: 업로드 및 각 구간별 분할 진행률 표시

### 4. 미디어 병합
- 여러 미디어 파일 병합
- Drag & Drop 파일 순서 조정
- 코덱 일치 시 빠른 병합 / 불일치 시 재인코딩
- 출력 포맷 선택

### 5. 문서 변환
- PDF ↔ Word (DOCX)
- Markdown → PDF/HTML
- Excel (XLSX) → CSV
- HTML → PDF (Puppeteer)

### 6. 문서 병합 (PDF) ⭐ NEW
- **여러 PDF 병합**: 2개 이상의 PDF 파일 병합
- **드래그 앤 드롭 순서 변경**: @dnd-kit으로 병합 순서 조정
- **업로드 진행률**: 실시간 업로드 진행률 표시
- **파일명 커스터마이징**: 병합된 파일의 이름 지정
- **다운로드 폴더 열기**: ~/Movies 폴더 바로 열기

### 7. 문서 분할 (PDF) ⭐ NEW
- **페이지 범위 분할**: 시작/끝 페이지 지정으로 분할
- **다중 범위 설정**: 여러 개의 분할 범위 추가 가능
- **자동 페이지 수 확인**: 업로드 시 PDF 페이지 수 자동 확인
- **범위별 파일명**: 각 분할 파일에 대한 커스텀 파일명
- **선택/전체 다운로드**: 체크박스로 원하는 파일만 다운로드
- **폴더 열기**: ~/Movies 폴더 바로 열기

### 8. 프로젝트 파일 관리 ⭐⭐ NEW
- **파일 목록 조회**: `public/downloads/` 폴더의 모든 파일 표시
- **파일 정보**: 파일명, 크기, 생성일시 표시
- **저장 용량 표시**: 메인 화면에 실시간 전체 용량 표시
- **영구 보관**: 새로고침해도 파일 유지 (다운로드만 삭제)
- **선택/전체 선택**: 체크박스로 파일 선택
- **새로고침**: 파일 목록 갱신
- **선택 다운로드**: 선택한 파일들만 다운로드
- **프로젝트 폴더 열기**: `public/downloads/` 폴더를 Finder/탐색기에서 열기
- **선택 삭제**: 선택한 파일들 서버에서 삭제
- **전체 삭제**: 모든 파일 한 번에 삭제

### 9. 세션 복구 ⭐ NEW
- **자동 저장**: 작업 상태를 localStorage에 자동 저장
- **세션 ID**: 고유 세션 식별자로 파일 관리
- **활성 탭 복구**: 마지막 작업 탭 기억
- **업로드 파일 복구**: 이전에 업로드한 파일 목록 복원
- **24시간 유효**: 24시간 이내 세션만 복구 가능
- **선택적 복구**: "복구하기" 또는 "새로 시작" 선택 가능

### 10. UI 개선 ⭐ NEW
- **동적 Footer**: 현재 연도 자동 표시 (2025 CS & Company)
- **DMG 빌드 버튼**: 웹 UI에서 빌드 명령 복사 및 dist 폴더 열기
- **저장 용량 표시**: 프로젝트 파일 관리 버튼 옆에 실시간 용량 (5초 간격 업데이트)

## 아키텍처

### 디렉토리 구조

```
easyconversion_web1/
├── app/
│   ├── api/
│   │   ├── upload/route.ts          # 대용량 파일 업로드 (formidable 스트리밍)
│   │   ├── cleanup/route.ts         # 세션 종료 시 파일 정리
│   │   ├── open-folder/route.ts     # OS별 폴더 열기 (프로젝트/Movies)
│   │   ├── media/
│   │   │   ├── convert/route.ts     # 미디어 변환 (SSE)
│   │   │   ├── split/route.ts       # 비디오 분할 (SSE)
│   │   │   └── merge/route.ts       # 미디어 병합 (SSE)
│   │   ├── youtube/
│   │   │   └── download/route.ts    # YouTube 다운로드 (SSE)
│   │   ├── document/
│   │   │   ├── convert/route.ts     # 문서 변환
│   │   │   ├── merge/route.ts       # PDF 병합
│   │   │   ├── split/route.ts       # PDF 분할
│   │   │   └── page-count/route.ts  # PDF 페이지 수 조회
│   │   └── project-files/
│   │       ├── list/route.ts        # 프로젝트 파일 목록 조회
│   │       └── delete/route.ts      # 프로젝트 파일 삭제
│   ├── page.tsx                     # 메인 페이지 (세션 관리, cleanup 이벤트, 파일 관리 팝업)
│   └── layout.tsx
├── components/
│   ├── tabs/
│   │   ├── MediaSplitTab.tsx        # 비디오 분할 UI
│   │   ├── MediaMergeTab.tsx
│   │   ├── MediaConvertTab.tsx      # 순차 처리 방식
│   │   ├── YouTubeTab.tsx
│   │   ├── DocumentConvertTab.tsx
│   │   ├── DocumentMergeTab.tsx     # PDF 병합 (드래그 앤 드롭)
│   │   └── DocumentSplitTab.tsx     # PDF 분할 (다중 범위)
│   ├── common/
│   │   ├── FileUploader.tsx         # 드래그앤드롭 업로더
│   │   ├── ProgressBar.tsx          # 진행률 표시
│   │   ├── LogViewer.tsx            # 로그 뷰어 (복사 기능)
│   │   ├── TimeInput.tsx            # 시간 입력 (자동 포맷팅)
│   │   └── ProjectFilesDialog.tsx   # 프로젝트 파일 관리 팝업
│   └── ui/                          # shadcn/ui 컴포넌트
├── lib/
│   ├── ffmpeg-split.ts              # FFmpeg 분할 로직
│   ├── ffmpeg-merge.ts              # FFmpeg 병합 로직
│   ├── ffmpeg-utils.ts              # FFmpeg 유틸리티 (서버 전용)
│   ├── pdf-utils.ts                 # PDF 유틸리티 (병합/분할/페이지수)
│   ├── upload-with-progress.ts     # XMLHttpRequest 업로드 진행률
│   ├── file-validator.ts           # 파일 검증
│   └── utils.ts                     # 공용 유틸리티
├── store/
│   └── useConversionStore.ts       # Zustand 전역 상태
├── public/
│   └── downloads/                   # 세션별 다운로드 파일
└── tmp/
    └── uploads/                     # 세션별 업로드 파일
```

### 주요 기술 결정

#### 1. 대용량 파일 업로드 (50GB)
- **문제**: Next.js의 기본 `request.formData()`는 전체 파일을 메모리에 로드하여 OOM 발생
- **해결**:
  - `formidable` 라이브러리로 스트리밍 방식 업로드
  - Next.js Request를 Node.js Readable Stream으로 변환
  - 디스크에 직접 스트리밍 저장 (메모리 사용 최소화)
  - `next.config.js`에서 `bodySizeLimit: '50gb'` 설정

#### 2. 업로드 진행률 표시
- **문제**: `fetch` API는 업로드 진행률 추적 불가
- **해결**:
  - `XMLHttpRequest`를 Promise로 래핑한 `uploadWithProgress` 유틸리티 생성
  - `xhr.upload.addEventListener('progress')` 이벤트로 진행률 추적
  - Response 객체로 변환하여 일관된 API 유지

#### 3. 실시간 처리 진행률 (SSE)
- **문제**: FFmpeg 작업은 시간이 오래 걸림
- **해결**:
  - Server-Sent Events (SSE)로 실시간 진행률 스트리밍
  - `ReadableStream` + `TextEncoder`로 이벤트 전송
  - 클라이언트에서 `response.body.getReader()`로 수신

#### 4. 세션 기반 파일 관리
- **문제**: 여러 사용자의 파일이 섞이거나 디스크 공간 낭비
- **해결**:
  - UUID 기반 세션 ID 생성
  - 업로드: `tmp/uploads/{sessionId}/`
  - 다운로드: `public/downloads/{sessionId}/`
  - 브라우저 닫힘/새로고침 시 `navigator.sendBeacon()`으로 cleanup API 호출
  - `beforeunload`, `pagehide` 이벤트 활용

#### 5. FFmpeg 클라이언트 번들링 방지
- **문제**: `fluent-ffmpeg`는 Node.js 전용이지만 클라이언트에서 import 시 번들링 에러
- **해결**:
  - FFmpeg 관련 함수를 `lib/ffmpeg-utils.ts`로 분리 (서버 전용)
  - 클라이언트/서버 공용 유틸리티는 `lib/utils.ts`에 유지

#### 6. 순차 처리 vs 배치 처리
- **문제**: 여러 대용량 파일을 동시에 업로드하면 메모리 부족
- **해결**:
  - MediaConvertTab에서 순차 처리 패턴 도입
  - 파일 1개 업로드 → 변환 → 완료 → 다음 파일
  - 메모리 효율성과 명확한 진행률 표시
  - 에러 격리 (한 파일 실패해도 다른 파일 계속 처리)

#### 7. PDF 조작 (병합/분할)
- **문제**: PDF 파일 조작이 필요
- **해결**:
  - `pdf-lib` 라이브러리 사용
  - `mergePDFs()`: 여러 PDF를 하나로 병합
  - `splitPDF()`: 특정 페이지 범위 추출
  - `getPDFPageCount()`: 페이지 수 조회

#### 8. 드래그 앤 드롭 순서 조정
- **문제**: PDF 병합 시 파일 순서가 중요
- **해결**:
  - `@dnd-kit` 라이브러리 사용
  - SortableContext + useSortable 훅
  - arrayMove로 배열 순서 변경

## 주요 컴포넌트 상세

### MediaConvertTab.tsx (순차 처리)

**순차 처리 로직**:
```typescript
for (let i = 0; i < files.length; i++) {
  const file = files[i];

  // 1. 개별 파일 업로드
  const uploadRes = await uploadWithProgress({
    url: '/api/upload',
    formData,
    onProgress: (progress) => setUploadProgress(progress),
  });

  // 2. 개별 파일 변환 (SSE)
  const response = await fetch('/api/media/convert', {
    method: 'POST',
    body: convertFormData,
  });

  // SSE 수신...
}
```

### DocumentMergeTab.tsx (드래그 앤 드롭)

**드래그 앤 드롭 구현**:
```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    const oldIndex = files.findIndex(f => f.id === active.id);
    const newIndex = files.findIndex(f => f.id === over.id);
    const reorderedFiles = arrayMove(files, oldIndex, newIndex);
    // 파일 순서 업데이트
  }
};
```

### DocumentSplitTab.tsx (다중 범위)

**범위 관리**:
```typescript
interface SplitRange {
  id: string;
  start: number;  // 1-based
  end: number;    // 1-based
  name: string;   // 커스텀 파일명
}

const [ranges, setRanges] = useState<SplitRange[]>([
  { id: uuidv4(), start: 1, end: 10, name: '' }
]);
```

### ProjectFilesDialog.tsx (파일 관리 팝업)

**기능**:
- 파일 목록 조회: GET `/api/project-files/list`
- 파일 삭제: POST `/api/project-files/delete`
- 체크박스 선택: Set<string>으로 관리
- 새로고침: fetchFiles() 재호출

### MediaSplitTab.tsx

**상태 관리**:
```typescript
const [file, setFile] = useState<FileInfo | null>(null);
const [mode, setMode] = useState<'timepoints' | 'segments'>('segments');
const [segmentCount, setSegmentCount] = useState(3);
const [timepoints, setTimepoints] = useState<string[]>(['00:01:00']);
const [uploadProgress, setUploadProgress] = useState(0);
const [progress, setProgress] = useState<{ [key: number]: number }>({});
const [outputUrls, setOutputUrls] = useState<string[]>([]);
const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
const [fileNames, setFileNames] = useState<{ [key: number]: string }>({});
```

**주요 기능**:
1. **파일 업로드**: `uploadWithProgress()`로 진행률 추적
2. **일괄 시간 입력**: 여러 줄 텍스트를 파싱하여 시간 배열로 변환
3. **SSE 수신**: 각 구간별 분할 진행률 실시간 업데이트
4. **파일명 입력**: 각 구간별 사용자 지정 파일명
5. **선택/전체 다운로드**: Set으로 선택 상태 관리

### TimeInput.tsx

**자동 포맷팅**:
```typescript
const formatTime = (input: string): string => {
  const numbers = input.replace(/\D/g, ''); // 숫자만 추출
  const truncated = numbers.slice(0, 6); // 최대 6자리
  let formatted = '';
  for (let i = 0; i < truncated.length; i++) {
    if (i === 2 || i === 4) formatted += ':'; // 콜론 자동 삽입
    formatted += truncated[i];
  }
  return formatted;
};
```

**붙여넣기 처리**:
- "02 45 16" → "02:45:16"
- "024516" → "02:45:16"
- "2:45:16" → "02:45:16"

### LogViewer.tsx

**기능**:
- Zustand store의 로그 배열 표시
- ScrollArea로 자동 스크롤
- 복사 버튼: `navigator.clipboard.writeText(logs.join('\n'))`
- 지우기 버튼: 로그 초기화

## API 엔드포인트

### POST /api/upload

**요청**:
- FormData with `files` and `sessionId`
- formidable을 통한 스트리밍 파싱

**응답**:
```json
{
  "success": true,
  "files": [
    {
      "fileId": "uuid",
      "originalName": "video.mp4",
      "savedName": "uuid_video.mp4",
      "path": "/absolute/path",
      "size": 9500000000
    }
  ]
}
```

### POST /api/media/split

**요청**:
- FormData with `fileData`, `sessionId`, `mode`, `timepoints`/`segmentCount`

**응답** (SSE):
```
data: {"type":"start","message":"분할 시작..."}

data: {"type":"progress","segmentIndex":0,"progress":45,"message":"구간 1 분할 중: 45%"}

data: {"type":"complete","outputUrls":["/downloads/session/file1.mp4"],"downloadFolder":"/path","message":"분할 완료!"}
```

### POST /api/media/convert

**요청**:
- FormData with `filesData`, `outputFormat`, `sessionId`

**응답** (SSE):
```
data: {"type":"progress","fileName":"video.mp4","progress":35,"message":"변환 중: 35%"}

data: {"type":"complete","fileName":"video.mp4","outputUrl":"/downloads/session/converted.mp4"}
```

### POST /api/document/merge

**요청**:
```json
{
  "filesData": "[{\"savedName\":\"file1.pdf\"}, ...]",
  "sessionId": "uuid"
}
```

**응답**:
```json
{
  "success": true,
  "outputUrl": "/downloads/session/merged_timestamp.pdf",
  "message": "N개 파일이 병합되었습니다."
}
```

### POST /api/document/split

**요청**:
```json
{
  "fileData": "{\"savedName\":\"file.pdf\"}",
  "sessionId": "uuid",
  "ranges": "[{\"start\":1,\"end\":5,\"name\":\"chapter1\"}, ...]"
}
```

**응답**:
```json
{
  "success": true,
  "outputUrls": ["/downloads/session/chapter1.pdf", ...],
  "message": "N개 파일로 분할되었습니다."
}
```

### POST /api/document/page-count

**요청**:
```json
{
  "sessionId": "uuid",
  "fileName": "file.pdf"
}
```

**응답**:
```json
{
  "success": true,
  "pageCount": 42
}
```

### GET /api/project-files/list

**응답**:
```json
{
  "success": true,
  "files": [
    {
      "name": "video.mp4",
      "path": "/downloads/session/video.mp4",
      "size": 1000000,
      "sessionId": "uuid",
      "createdAt": 1234567890
    }
  ]
}
```

### POST /api/project-files/delete

**요청**:
```json
{
  "filePaths": ["/downloads/session/file1.mp4"],
  "deleteAll": false
}
```

**응답**:
```json
{
  "success": true,
  "message": "N개 파일이 삭제되었습니다.",
  "deletedCount": 3
}
```

### POST /api/cleanup

**요청**:
```json
{ "sessionId": "uuid" }
```

**동작**:
- `tmp/uploads/{sessionId}` 삭제
- `public/downloads/{sessionId}` 삭제

### POST /api/open-folder

**요청**:
```json
{
  "openUserDownloads": true,      // ~/Movies
  "openProjectDownloads": true,   // public/downloads
  "folderPath": "/custom/path"    // 커스텀 경로
}
```

**동작**:
- macOS: `open "{path}"`
- Windows: `explorer "{path}"`
- Linux: `xdg-open "{path}"`

## 환경 변수

`.env.local`:
```bash
# 파일 크기 제한 (50GB)
MAX_FILE_SIZE=53687091200
NEXT_PUBLIC_MAX_FILE_SIZE=53687091200
```

## 개발 서버

```bash
npm run dev
```

- Port: 9005
- URL: http://localhost:9005

## 주요 이슈 및 해결

### 이슈 #1: 8.85GB 파일 업로드 실패 (500 에러)
- **원인**: `request.formData()`가 전체 파일을 메모리에 로드
- **해결**: formidable 스트리밍 방식으로 전환

### 이슈 #2: 업로드 진행률 표시 불가
- **원인**: fetch API는 업로드 진행률 추적 미지원
- **해결**: XMLHttpRequest 사용

### 이슈 #3: fluent-ffmpeg 번들링 에러
- **원인**: 클라이언트 컴포넌트에서 import된 utils.ts에 ffmpeg 포함
- **해결**: ffmpeg-utils.ts로 분리 (서버 전용)

### 이슈 #4: 시간 입력 UX 불편
- **원인**: 콜론 수동 입력 필요
- **해결**: TimeInput 컴포넌트로 자동 포맷팅

### 이슈 #5: 여러 시간 입력 불편
- **원인**: 각 시간을 개별 입력 필요
- **해결**: Textarea 일괄 입력 + 파싱 기능

### 이슈 #6: 다운로드 폴더 혼동
- **원인**: 프로젝트 폴더와 사용자 다운로드 폴더 구분 필요
- **해결**:
  - "다운로드 폴더 열기" → ~/Movies
  - "프로젝트 파일 관리" 팝업 추가
  - "프로젝트 폴더 열기" → public/downloads

### 이슈 #7: 여러 대용량 파일 동시 업로드 시 메모리 부족
- **원인**: 모든 파일을 동시에 업로드하면 메모리 초과
- **해결**: 순차 처리 방식으로 변경 (MediaConvertTab)

### 이슈 #8: Electron 패키징된 앱 실행 안 됨
- **원인 1**: `process.env.NODE_ENV !== 'production'`이 패키징 후에도 dev 모드로 감지
- **해결**: `!app.isPackaged`로 변경
- **원인 2**: `process.execPath`가 Electron 바이너리를 가리켜 Next.js 서버 실행 실패
- **해결**: `command = 'node'`로 변경하여 Node.js 사용
- **원인 3**: app.asar에 압축된 파일은 런타임에 접근 불가
- **해결**: `asarUnpack` 설정으로 필요 파일 압축 제외

### 이슈 #9: .next 폴더 캐시 손상 (Webpack 에러)
- **원인**: dist 폴더 열기 등 특정 작업 후 `.next` 빌드 캐시가 손상
- **증상**: "Cannot find module './873.js'" 등의 ENOENT 에러
- **해결**: `실행.command` 스크립트에 자동 캐시 정리 추가 (`rm -rf .next`)

### 이슈 #10: 동영상 변환 중 멈춤 (여러 파일 처리 시)
- **원인**: FFmpeg 프로세스 응답 없음, 타임아웃 미처리
- **해결**:
  - **멈춤 감지**: 30초 응답 없으면 프로세스 강제 종료 (`ffmpeg.ts`)
  - **자동 재시도**: 최대 2회 재시도 로직 (`route.ts`)
  - **개별 에러 처리**: 한 파일 실패해도 다음 파일 계속 처리
  - **FFmpeg 최적화**: `-max_muxing_queue_size 9999` 옵션 추가
  - **SSE 이벤트 처리**: `done`, `file-error` 타입 추가 (`MediaConvertTab.tsx`)

### 이슈 #11: 세션 복구 후 파일 업로드 안 됨
- **원인**: MediaConvertTab에서 SSE 스트림 `done` 이벤트 미처리로 `fileCompleted` false 유지
- **해결**: `done` 타입과 `file-error` 타입 이벤트 처리 추가

### 이슈 #12: 개발 서버 시작 시 manifest 파일 누락 오류 ⭐ NEW
- **증상**:
  - `ENOENT: no such file or directory, open '.next/server/middleware-manifest.json'`
  - `ENOENT: no such file or directory, open '.next/server/pages-manifest.json'`
  - `ENOENT: no such file or directory, open '.next/server/app-paths-manifest.json'`
  - `ENOENT: no such file or directory, open '.next/server/next-font-manifest.json'`
  - HTTP 500 에러 또는 404 에러 발생
- **원인**:
  - Next.js 15 개발 모드에서 `.next/server` 디렉토리가 자동 생성되지 않는 버그
  - `.next` 빌드 캐시 삭제 후 재시작 시 필수 파일 미생성
- **해결**:
  ```bash
  # .next/server 디렉토리 생성
  mkdir -p .next/server

  # 필수 manifest 파일들 생성
  echo '{"version":3,"middleware":{},"functions":{},"sortedMiddleware":[]}' > .next/server/middleware-manifest.json
  echo '{}' > .next/server/pages-manifest.json
  echo '{}' > .next/server/app-paths-manifest.json
  echo '{"pages":{},"app":{},"appUsingSizeAdjust":false,"pagesUsingSizeAdjust":false}' > .next/server/next-font-manifest.json
  ```

### 이슈 #13: TypeScript 빌드 타입 에러 ⭐ NEW
- **원인 1**: `app/page.tsx:53` - `newSessionId` 변수가 스코프 밖에서 참조됨
  - **해결**: `sessionId` 상태 변수로 변경
- **원인 2**: `app/page.tsx:142` - FileInfo 인터페이스에 `file` 속성이 없음
  - **해결**: 세션 복구 시 더미 File 객체 생성하여 전달
  ```typescript
  const dummyFile = new File([], file.name, { type: file.type });
  addFile({ ...file, file: dummyFile });
  ```
- **원인 3**: `lib/ffmpeg.ts:86,92,114` - 이벤트 핸들러 파라미터에 타입이 없음
  - **해결**: `(data: any)`, `(progress: any)`, `(err: any)` 타입 추가

### 이슈 #15: 개발 서버 포트 충돌 (EADDRINUSE) ⭐ NEW
- **증상**: `npm run dev` 실행 시 "Error: listen EADDRINUSE: address already in use :::9005"
- **원인**: 이전에 실행된 서버 프로세스가 종료되지 않고 포트 9005를 계속 점유
- **해결**:
  ```bash
  # 포트 9005 사용 중인 프로세스 찾아서 종료
  lsof -i :9005 | grep LISTEN | awk '{print $2}' | xargs kill -9

  # 서버 재시작
  npm run dev
  ```
- **예방**:
  - `Ctrl+C`로 서버 종료 시 프로세스가 완전히 종료되었는지 확인
  - 필요 시 `killall -9 node` 명령으로 모든 Node.js 프로세스 종료

## 알려진 이슈 및 해결 방법 ⭐ NEW

### 포트 9005가 열리지 않을 때

**증상**: 개발 서버 실행 후 HTTP 500/404 에러 또는 EADDRINUSE 에러

**해결 순서**:
1. 기존 프로세스 종료:
   ```bash
   lsof -i :9005 | grep LISTEN | awk '{print $2}' | xargs kill -9
   # 또는
   lsof -ti:9005 | xargs kill -9
   ```

2. .next 캐시 삭제 (manifest 에러 시):
   ```bash
   rm -rf .next
   ```

3. manifest 파일 생성 (ENOENT 에러 시):
   ```bash
   mkdir -p .next/server
   echo '{"version":3,"middleware":{},"functions":{},"sortedMiddleware":[]}' > .next/server/middleware-manifest.json
   echo '{}' > .next/server/pages-manifest.json
   echo '{}' > .next/server/app-paths-manifest.json
   echo '{"pages":{},"app":{},"appUsingSizeAdjust":false,"pagesUsingSizeAdjust":false}' > .next/server/next-font-manifest.json
   ```

4. 개발 서버 재시작:
   ```bash
   npm run dev
   ```

5. 브라우저에서 확인:
   ```bash
   open http://localhost:9005
   ```

**빠른 해결 (포트 충돌만 발생한 경우)**:
```bash
lsof -i :9005 | grep LISTEN | awk '{print $2}' | xargs kill -9 && npm run dev
```

### TypeScript 빌드 에러 발생 시

**증상**: `npm run build` 실패, 타입 에러 발생

**해결**:
- `app/page.tsx`, `lib/ffmpeg.ts` 파일의 타입 에러 확인
- 이벤트 핸들러에 `any` 타입 추가
- FileInfo 인터페이스에 `file` 속성 포함 확인

## 완료된 Phase

- [x] Phase 1: 프로젝트 초기 설정
- [x] Phase 2: YouTube 다운로드
- [x] Phase 3: 미디어 변환
- [x] Phase 4: 미디어 분할/병합
- [x] Phase 5: 대용량 파일 지원, UX 개선
- [x] Phase 6: 문서 병합/분할, 프로젝트 파일 관리

## Electron 데스크톱 앱

### 개요
Next.js 웹 앱을 Electron으로 패키징하여 macOS 네이티브 앱(.app + .dmg)으로 빌드

### 파일 구조
```
easyconversion_web1/
├── electron/
│   ├── main.js           # Electron 메인 프로세스 (Next.js 서버 자동 시작)
│   └── preload.js        # Preload 스크립트 (보안)
├── electron-builder.yml  # Electron Builder 설정
├── build/                # 앱 아이콘
│   ├── icon.icns         # macOS 아이콘
│   ├── icon.ico          # Windows 아이콘
│   └── icon.png          # Linux 아이콘
├── dist/                 # 빌드 결과
│   ├── EasyConversion-0.1.0-arm64.dmg
│   └── mac-arm64/
│       └── EasyConversion.app
└── 실행.command          # 웹 서버 실행 스크립트 (.next 캐시 자동 정리)
```

### 주요 스크립트

**웹 개발 서버:**
```bash
npm run dev              # Next.js 개발 서버 (port 9005)
./실행.command           # 캐시 정리 + 서버 시작 (더블클릭 실행 가능)
```

**Electron 앱:**
```bash
npm run electron:dev          # Electron 개발 모드
npm run electron:build        # 모든 플랫폼 빌드
npm run electron:build:mac    # macOS .app + .dmg 빌드
```

### 웹 UI 기능

**DMG 빌드 관련 버튼 (상단):**
- **DMG 빌드 명령 복사**: `npm run electron:build:mac` 명령을 클립보드에 복사
- **dist 폴더 열기**: 빌드된 DMG/앱이 있는 dist 폴더를 Finder에서 열기
- **프로젝트 파일 관리**: 프로젝트 다운로드 파일 관리 팝업

### Electron 작동 방식

1. **main.js**가 Next.js 서버를 자식 프로세스로 실행
2. 서버 준비 완료 후 Electron 윈도우 생성
3. 윈도우는 `http://localhost:9005`에 연결
4. 모든 API Routes와 서버 기능 정상 작동 (FFmpeg, PDF 처리, SSE 등)
5. 앱 종료 시 Next.js 서버도 함께 종료

### 패키징 전략

**asarUnpack 설정:**
- `.next/` - Next.js 빌드 결과
- `node_modules/next/` - Next.js 런타임
- `node_modules/@next/` - Next.js 의존성
- `node_modules/sharp/` - 이미지 처리
- `node_modules/formidable/` - 파일 업로드
- `node_modules/fluent-ffmpeg/` - FFmpeg
- `node_modules/pdf-lib/` - PDF 처리
- `public/` - 정적 파일

이 파일들은 app.asar에 압축되지 않고 app.asar.unpacked에 위치하여 런타임에 접근 가능

### Footer

- 동적 copyright: `2025 CS & Company. All rights reserved.`
- 연도는 자동으로 현재 연도로 업데이트됨

### 주요 이슈 및 해결

**이슈 #8: Electron 패키징 후 실행 불가**
- **원인 1**: `process.env.NODE_ENV`로 개발/프로덕션 구분이 제대로 안됨
- **해결 1**: `app.isPackaged`로 변경

- **원인 2**: `process.execPath`가 Electron 바이너리를 가리킴
- **해결 2**: `node` 명령어로 Next.js 실행

- **원인 3**: asar 압축으로 파일 접근 불가
- **해결 3**: `asarUnpack` 설정으로 필요한 파일 제외

**이슈 #9: dist 폴더 열기 후 웹 서버 오류**
- **원인**: .next 빌드 캐시 손상
- **해결**: `실행.command`에서 자동으로 .next 폴더 삭제 후 서버 시작

**이슈 #14: Electron 앱 빌드 후 흰 화면 표시** ⭐ NEW
- **증상**:
  - 앱이 실행되지만 UI가 표시되지 않고 흰 화면만 보임
  - 첫 번째 빌드에서는 깨진 레이아웃으로 잠깐 보이다가 흰 화면으로 변경
- **원인 1**: `.next` 디렉토리가 빌드에 포함되지 않음
  - electron-builder가 dotfiles(`.`로 시작하는 파일/폴더)를 기본적으로 무시
  - Next.js 프로덕션 서버가 `.next` 빌드 결과를 찾지 못함
  - 에러: `Could not find a production build in the '.next' directory`
- **해결 1**: `electron-builder.yml`의 files 섹션 수정
  ```yaml
  files:
    - "**/*"              # 모든 파일 포함
    - electron/**/*
    - .next/**/*          # .next 명시적 포함
    - node_modules/**/*
    - package.json
    - public/**/*
    - "!dist/**/*"        # 불필요한 폴더 제외
    - "!build/**/*"
    - "!tmp/**/*"
  ```

- **원인 2**: `react`와 `react-dom` 모듈이 asar에 압축되어 접근 불가
  - 에러: `Cannot find module 'react'`
  - 에러: `Cannot find module 'react-dom'`
  - Next.js 서버가 런타임에 react 모듈을 찾지 못함
- **해결 2**: `electron-builder.yml`의 asarUnpack 섹션에 추가
  ```yaml
  asarUnpack:
    - "**/*.node"
    - ".next/**/*"
    - "node_modules/next/**/*"
    - "node_modules/@next/**/*"
    - "node_modules/@swc/**/*"
    - "node_modules/styled-jsx/**/*"
    - "node_modules/react/**/*"       # 추가
    - "node_modules/react-dom/**/*"   # 추가
    - "node_modules/sharp/**/*"
    - "node_modules/formidable/**/*"
    - "node_modules/fluent-ffmpeg/**/*"
    - "node_modules/pdf-lib/**/*"
    - "public/**/*"
  ```

- **테스트 방법**:
  1. 모든 프로세스 종료: `killall -9 EasyConversion && killall -9 node`
  2. 앱 빌드: `npm run electron:build:mac:app`
  3. Applications에 설치: `cp -R dist/mac-arm64/EasyConversion.app /Applications/`
  4. 앱 실행 후 로그 확인: `/Applications/EasyConversion.app/Contents/MacOS/EasyConversion`

**개선 사항: 앱 빌드 자동화** ⭐ NEW
- **이전 방식**: "앱 빌드 명령 복사" 버튼 → 수동으로 터미널에서 실행
- **새로운 방식**: "앱 빌드 및 설치" 버튼 → 자동으로 빌드하고 Applications에 설치
- **구현**:
  - 새 API 엔드포인트: `app/api/build-app/route.ts`
  - 기능:
    1. 실행 중인 EasyConversion/node 프로세스 종료
    2. `npm run electron:build:mac:app` 실행
    3. `dist/mac-arm64/EasyConversion.app`을 `/Applications/`로 자동 복사
  - UI 변경: `app/page.tsx`
    - `copyAppBuildCommand()` → `handleBuildApp()`
    - 빌드 시작/완료/실패 토스트 알림 추가

**개선 사항: 임시 파일 자동 정리** ⭐ NEW
- **목적**: `tmp/uploads/` 폴더의 오래된 세션 파일 정리 (68GB → 관리 가능한 크기)
- **구현**:
  - **자동 정리 API**: `app/api/cleanup/auto/route.ts`
    - 24시간 이상 지난 세션만 삭제
    - 안전한 방식으로 오래된 파일만 제거
  - **전체 정리 API**: `app/api/cleanup/uploads/route.ts`
    - `tmp/uploads/` 폴더 전체 삭제
    - 이중 확인 필요 (모든 업로드 파일 삭제)
- **UI**: `app/page.tsx`
  - "임시 파일 정리 (24h+)" 버튼: 안전한 자동 정리
  - "전체 삭제 (tmp/uploads)" 버튼: 모든 업로드 파일 삭제 (위험, 빨간색)
  - 삭제 전 확인 다이얼로그

### 참고 문서
- 자세한 빌드 방법: `ELECTRON_README.md`
- 재사용 가능한 프롬프트: `.claude/PROMPTS.md`

## 향후 개선 사항

- [ ] Phase 7: Electron 앱 최종 테스트 및 안정화
- [ ] 에러 핸들링 강화
- [ ] 다국어 지원
- [ ] 사용자 설정 저장 (LocalStorage)
- [ ] 배치 작업 지원
- [ ] 작업 큐 시스템
- [ ] 프리셋 관리
- [ ] 코드 서명 (Apple Developer 인증)
- [ ] Windows/Linux 빌드

## 라이선스

Private

## 작성일

2025-12-06 (최초 작성)
2025-12-09 (최종 업데이트)
