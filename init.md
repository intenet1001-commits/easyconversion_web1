# EasyConversion Web - Product Requirements Document (PRD)

## 1. 프로젝트 개요

### 1.1 프로젝트 명
**EasyConversion Web** - 올인원 파일 변환 웹 애플리케이션

### 1.2 목적
기존 Python/Tkinter 기반 데스크톱 애플리케이션인 EasyConversion v4를 Next.js 기반 웹 애플리케이션으로 재구현하여, 브라우저에서 사용 가능한 파일 변환 도구를 제공합니다. (배포 없이 로컬 개발 환경에서 실행)

### 1.3 기술 스택
- **Frontend**: Next.js 14/15 (App Router), shadcn/ui, Tailwind CSS
- **Backend**: Next.js API Routes, Node.js
- **File Processing**: FFmpeg (Node.js), pdf-lib, docx, pptxgenjs, markdown-it, puppeteer
- **State Management**: Zustand 또는 Jotai
- **Real-time Updates**: Server-Sent Events (SSE) 또는 WebSocket
- **File Upload**: react-dropzone
- **Queue Management**: Bull + Redis (optional)

---

## 2. 핵심 기능 (Features)

### 2.1 YouTube 다운로드
#### 기능 설명
YouTube URL을 입력받아 비디오(MP4) 또는 오디오(MP3)로 다운로드

#### 세부 사항
- **입력**: YouTube URL
- **출력 형식**: MP4 (비디오), MP3 (오디오)
- **품질 옵션**:
  - MP4: 최고 화질 (best available)
  - MP3: 192kbps
- **진행률 표시**: 실시간 다운로드 진행률
- **저장 위치**: 브라우저 다운로드 폴더 또는 사용자 지정

#### 기술 구현
- **백엔드**: ytdl-core 또는 yt-dlp wrapper
- **API Endpoint**: `POST /api/youtube/download`
- **Progress**: SSE 또는 WebSocket

---

### 2.2 미디어 변환
#### 기능 설명
비디오/오디오 파일을 다른 형식으로 변환

#### 세부 사항
- **지원 형식**: MP4, MP3, MOV, WAV
- **변환 모드**:
  - 단일 파일 변환
  - 다중 파일 일괄 변환 (배치 처리)
- **변환 옵션**:
  - 비디오 코덱: H.264 (libx264)
  - 오디오 코덱: AAC, MP3 (libmp3lame), PCM (WAV)
  - 비트레이트: 비디오 5Mbps, 오디오 192kbps
  - 해상도: 원본 유지 (추후 커스텀 옵션 추가 가능)
- **진행률 표시**: 각 파일별 변환 진행률 (%)
- **병렬 처리**: 여러 파일 동시 변환 (최대 4개)

#### 기술 구현
- **Backend**: FFmpeg (fluent-ffmpeg npm package)
- **API Endpoint**: `POST /api/media/convert`
- **Progress**: SSE streaming
- **Queue**: Bull Queue (선택적, 대량 처리 시)

---

### 2.3 비디오 분할 (Video Split)
#### 기능 설명
비디오 파일을 여러 구간으로 분할

#### 세부 사항
- **분할 모드 1: 시간 기준 분할**
  - 사용자가 지정한 시간 포인트에서 분할 (HH:MM:SS)
  - 최소 2개 ~ 최대 10개 분할점
  - 예: 00:30, 01:15, 02:45 → 4개 파일 생성

- **분할 모드 2: 구간 수 분할**
  - 전체 길이를 N개 구간으로 균등 분할
  - 입력: 구간 수 (2~10)
  - 자동으로 시간 계산하여 분할

- **출력 파일명**: `원본파일명_part1.mp4`, `원본파일명_part2.mp4`, ...
- **진행률**: 각 구간별 분할 진행률

#### 기술 구현
- **Backend**: FFmpeg `-ss` (start time), `-t` (duration) 옵션
- **API Endpoint**: `POST /api/media/split`
- **Duration Detection**: ffprobe

---

### 2.4 미디어 병합 (Media Merge)
#### 기능 설명
여러 비디오/오디오 파일을 하나로 병합

#### 세부 사항
- **입력**: 2개 이상의 미디어 파일
- **파일 순서 조정**: 드래그 앤 드롭으로 순서 변경
- **지원 형식**: MP4, MOV, MP3, WAV
- **출력 형식**: 사용자 선택 (MP4, MOV, MP3, WAV)
- **스마트 병합**:
  - 동일 코덱: Stream copy (빠른 병합, 재인코딩 없음)
  - 다른 코덱: 자동 재인코딩
  - 형식 변환: 자동 감지 및 처리 (예: MOV+MOV → MP4)
- **진행률 표시**: 병합 진행률

#### 기술 구현
- **Backend**: FFmpeg concat demuxer 또는 filter
- **API Endpoint**: `POST /api/media/merge`
- **Format Detection**: ffprobe (코덱 호환성 확인)

---

### 2.5 문서 변환 (Document Conversion)
#### 기능 설명
다양한 문서 형식 간 상호 변환

#### 지원 변환 매트릭스
| From/To | PDF | DOCX | PPTX | MD | HTML |
|---------|-----|------|------|----|------|
| PDF     | -   | ✅   | ✅   | ✅ | ✅   |
| DOCX    | ✅  | -    | ✅   | ✅ | ✅   |
| PPTX    | ✅  | ✅   | -    | ✅ | ❌   |
| MD      | ✅  | ✅   | ✅   | -  | ✅   |
| HTML    | ✅  | ✅   | ❌   | ✅ | -    |

#### 세부 사항
- **단일/다중 파일**: 일괄 변환 지원
- **테이블 지원**: 표 구조 유지하며 변환
- **이미지 포함**: 문서 내 이미지 자동 처리
- **레이아웃 보존**: 최대한 원본 레이아웃 유지

#### 기술 구현
- **PDF 처리**: pdf-lib (생성/편집), puppeteer (HTML→PDF)
- **DOCX 처리**: docx (npm package)
- **PPTX 처리**: pptxgenjs
- **Markdown 처리**: markdown-it (파싱), unified/remark (변환)
- **HTML 처리**: puppeteer (렌더링)
- **API Endpoint**: `POST /api/document/convert`

---

### 2.6 문서 병합 (Document Merge) ✨ NEW
#### 기능 설명
동일 형식의 여러 문서 파일을 하나로 병합

#### 지원 형식
- **PDF**: 여러 PDF → 단일 PDF
- **DOCX**: 여러 DOCX → 단일 DOCX
- **PPTX**: 여러 PPTX → 단일 PPTX (슬라이드 순서대로 병합)
- **Markdown**: 여러 MD → 단일 MD (구분선 추가 옵션)
- **HTML**: 여러 HTML → 단일 HTML (섹션으로 구분)

#### 세부 사항
- **파일 순서 조정**: 드래그 앤 드롭으로 병합 순서 변경
- **최소 파일 수**: 2개 이상
- **최대 파일 수**: 제한 없음 (성능상 권장: 20개 이하)
- **병합 옵션**:
  - **페이지 구분선 추가**: 각 문서 사이 구분선 삽입 (선택적)
  - **목차 자동 생성**: 병합된 문서에 파일명 기반 목차 추가 (선택적)
  - **페이지 번호 재정렬**: PDF/DOCX 페이지 번호 연속으로 정렬

#### 병합 로직
- **PDF**: PyPDF2 또는 pdf-lib의 페이지 병합 기능
- **DOCX**: 각 문서의 단락/섹션을 순차적으로 추가
- **PPTX**: 모든 슬라이드를 순서대로 단일 프레젠테이션에 추가
- **Markdown**: 텍스트 연결 + `---` 구분선
- **HTML**: `<section>` 태그로 각 파일 구분하여 병합

#### 기술 구현
- **API Endpoint**: `POST /api/document/merge`
- **Libraries**:
  - PDF: pdf-lib (`PDFDocument.copyPages()`)
  - DOCX: docx (`Document.concat()` 또는 수동 병합)
  - PPTX: pptxgenjs (슬라이드 복사)
  - MD/HTML: 직접 문자열 조작

---

### 2.7 문서 분할 (Document Split) ✨ NEW
#### 기능 설명
단일 문서를 여러 파일로 분할

#### 지원 형식
- **PDF**: 페이지 기준 분할
- **DOCX**: 페이지/섹션 기준 분할
- **PPTX**: 슬라이드 기준 분할
- **Markdown**: 헤딩(#) 기준 분할
- **HTML**: 섹션/헤딩 기준 분할

#### 분할 모드

##### 1. PDF 분할
- **모드 A: 페이지 범위 지정**
  - 예: 1-5, 6-10, 11-15 → 3개 파일
  - UI: 범위 입력 필드 (1-5, 6-10 형식)

- **모드 B: 균등 분할**
  - 전체 페이지를 N개 파일로 균등 분할
  - 예: 30페이지 → 3개 파일 (각 10페이지)

- **모드 C: 페이지 수 기준**
  - 매 N페이지마다 새 파일 생성
  - 예: 5페이지씩 → 6개 파일 (30페이지 기준)

##### 2. DOCX 분할
- **모드 A: 페이지 수 기준**
  - 매 N페이지마다 분할 (근사치, Word 페이징 기준)

- **모드 B: 섹션 브레이크 기준**
  - Word 문서의 섹션 구분 기준으로 분할

##### 3. PPTX 분할
- **모드 A: 슬라이드 범위 지정**
  - 예: 1-10, 11-20 → 2개 파일

- **모드 B: 균등 분할**
  - N개 파일로 슬라이드 균등 분할

##### 4. Markdown 분할
- **모드 A: 헤딩 레벨 기준**
  - H1 (`#`) 기준 분할: 각 H1마다 새 파일
  - H2 (`##`) 기준 분할: 각 H2마다 새 파일

- **모드 B: 수동 구분선 기준**
  - `---` (horizontal rule) 기준 분할

##### 5. HTML 분할
- **모드 A: 섹션 태그 기준**
  - `<section>` 또는 `<article>` 태그마다 분할

- **모드 B: 헤딩 기준**
  - `<h1>` 또는 `<h2>` 태그 기준 분할

#### 출력 파일명
- **패턴**: `원본파일명_part1.pdf`, `원본파일명_part2.pdf`, ...
- **커스텀 접두사**: 사용자 지정 가능

#### 기술 구현
- **API Endpoint**: `POST /api/document/split`
- **Libraries**:
  - PDF: pdf-lib (`PDFDocument.getPages()`, page extraction)
  - DOCX: docx (section/paragraph iteration)
  - PPTX: pptxgenjs (slide extraction)
  - MD: markdown-it + AST parsing
  - HTML: cheerio (DOM parsing)

---

## 3. UI/UX 설계

### 3.1 전체 레이아웃
```
┌─────────────────────────────────────────────┐
│  Header (로고, 제목)                         │
├─────────────────────────────────────────────┤
│  Navigation Tabs                             │
│  [YouTube] [미디어 변환] [분할] [병합]       │
│  [문서 변환] [문서 병합] [문서 분할]          │
├─────────────────────────────────────────────┤
│                                              │
│  Main Content Area                           │
│  (각 탭별 UI)                                │
│                                              │
├─────────────────────────────────────────────┤
│  Progress/Status Area                        │
│  - 진행률 바                                 │
│  - 로그 메시지                               │
│  - 에러 표시                                 │
└─────────────────────────────────────────────┘
```

### 3.2 공통 컴포넌트 (shadcn/ui 활용)
- **FileUploader**: 드래그 앤 드롭 파일 업로드 (react-dropzone + shadcn Card)
- **ProgressBar**: 진행률 표시 (shadcn Progress)
- **FormatSelector**: 형식 선택 드롭다운 (shadcn Select)
- **FileList**: 업로드된 파일 목록 + 순서 조정 (react-beautiful-dnd)
- **LogViewer**: 실시간 로그 출력 (shadcn Textarea/ScrollArea)
- **Toast**: 알림 메시지 (shadcn Toast/Sonner)
- **Button**: 변환/다운로드 버튼 (shadcn Button)
- **Tabs**: 메인 네비게이션 (shadcn Tabs)

### 3.3 탭별 UI 설계

#### Tab 1: YouTube 다운로드
```
┌─────────────────────────────────────────┐
│  YouTube URL 입력                        │
│  [____________________________] [붙여넣기]│
│                                          │
│  출력 형식: ( ) MP4  (•) MP3             │
│                                          │
│  [다운로드 시작]                          │
│                                          │
│  Progress: ████████░░░░░░ 65%           │
└─────────────────────────────────────────┘
```

#### Tab 2: 미디어 변환
```
┌─────────────────────────────────────────┐
│  파일 업로드 (드래그 앤 드롭)             │
│  ┌─────────────────────────────┐        │
│  │  📁 파일을 드롭하거나 클릭   │        │
│  └─────────────────────────────┘        │
│                                          │
│  업로드된 파일:                          │
│  ✓ video1.mov  [X]                      │
│  ✓ audio1.wav  [X]                      │
│                                          │
│  출력 형식: [MP4 ▼]                      │
│                                          │
│  [변환 시작]                             │
│                                          │
│  video1.mov → MP4: ████░░ 80%           │
│  audio1.wav → MP4: 대기 중...            │
└─────────────────────────────────────────┘
```

#### Tab 3: 비디오 분할
```
┌─────────────────────────────────────────┐
│  파일 선택: [video.mp4]  [업로드]        │
│                                          │
│  분할 모드:                              │
│  (•) 시간 기준  ( ) 구간 수              │
│                                          │
│  시간 포인트 (HH:MM:SS):                 │
│  [00:30:00] [01:15:00] [02:45:00]       │
│  [+ 추가] (최대 10개)                    │
│                                          │
│  [분할 시작]                             │
│                                          │
│  Part 1: ██████████ 100% ✓              │
│  Part 2: ████░░░░░░ 45%                 │
│  Part 3: 대기 중...                      │
└─────────────────────────────────────────┘
```

#### Tab 4: 미디어 병합
```
┌─────────────────────────────────────────┐
│  파일 추가 (2개 이상)                     │
│  [파일 선택]                             │
│                                          │
│  병합할 파일 (드래그로 순서 조정):        │
│  ☰ 1. intro.mp4        [↑][↓][X]       │
│  ☰ 2. main.mp4         [↑][↓][X]       │
│  ☰ 3. outro.mp4        [↑][↓][X]       │
│                                          │
│  출력 형식: [MP4 ▼]                      │
│                                          │
│  [병합 시작]                             │
│                                          │
│  Progress: ████████░░ 75%               │
└─────────────────────────────────────────┘
```

#### Tab 5: 문서 변환
```
┌─────────────────────────────────────────┐
│  파일 업로드                             │
│  ┌─────────────────────────────┐        │
│  │  📄 문서를 드롭하세요        │        │
│  └─────────────────────────────┘        │
│                                          │
│  업로드된 파일:                          │
│  ✓ report.pdf                           │
│                                          │
│  변환 형식: [DOCX ▼]                     │
│                                          │
│  [변환 시작]                             │
└─────────────────────────────────────────┘
```

#### Tab 6: 문서 병합 ✨
```
┌─────────────────────────────────────────┐
│  문서 형식 선택: [PDF ▼]                 │
│                                          │
│  파일 추가 (2개 이상, 동일 형식)          │
│  [파일 선택]                             │
│                                          │
│  병합할 문서 (드래그로 순서 조정):        │
│  ☰ 1. chapter1.pdf     [↑][↓][X]       │
│  ☰ 2. chapter2.pdf     [↑][↓][X]       │
│  ☰ 3. appendix.pdf     [↑][↓][X]       │
│                                          │
│  옵션:                                   │
│  [✓] 구분선 추가                         │
│  [✓] 목차 자동 생성                      │
│  [ ] 페이지 번호 재정렬                  │
│                                          │
│  [병합 시작]                             │
└─────────────────────────────────────────┘
```

#### Tab 7: 문서 분할 ✨
```
┌─────────────────────────────────────────┐
│  파일 선택: [document.pdf]  [업로드]     │
│                                          │
│  문서 정보:                              │
│  - 형식: PDF                             │
│  - 총 페이지: 30                         │
│                                          │
│  분할 모드:                              │
│  (•) 페이지 범위 지정                    │
│  ( ) 균등 분할                           │
│  ( ) 페이지 수 기준                      │
│                                          │
│  페이지 범위 (예: 1-10, 11-20):          │
│  [1-10] [11-20] [21-30] [+ 추가]        │
│                                          │
│  출력 파일명 접두사: [document_part]     │
│                                          │
│  [분할 시작]                             │
│                                          │
│  Preview:                                │
│  - document_part1.pdf (10 pages)        │
│  - document_part2.pdf (10 pages)        │
│  - document_part3.pdf (10 pages)        │
└─────────────────────────────────────────┘
```

---

## 4. API 설계

### 4.1 API Endpoints

#### YouTube 다운로드
```
POST /api/youtube/download
Request Body:
{
  "url": "https://youtube.com/watch?v=...",
  "format": "mp4" | "mp3"
}
Response:
{
  "success": true,
  "fileUrl": "/downloads/video.mp4",
  "filename": "video.mp4"
}
```

#### 미디어 변환
```
POST /api/media/convert
Request: multipart/form-data
- files: File[]
- outputFormat: "mp4" | "mp3" | "mov" | "wav"

Response (SSE Stream):
{
  "type": "progress",
  "fileIndex": 0,
  "progress": 65,
  "message": "Converting video1.mov..."
}
{
  "type": "complete",
  "fileIndex": 0,
  "outputUrl": "/downloads/video1.mp4"
}
```

#### 비디오 분할
```
POST /api/media/split
Request Body:
{
  "file": File,
  "mode": "timepoints" | "segments",
  "timepoints": ["00:30:00", "01:15:00"], // if mode=timepoints
  "segments": 3 // if mode=segments
}
Response (SSE Stream):
{
  "type": "progress",
  "partIndex": 0,
  "progress": 100,
  "outputUrl": "/downloads/video_part1.mp4"
}
```

#### 미디어 병합
```
POST /api/media/merge
Request: multipart/form-data
- files: File[] (ordered)
- outputFormat: "mp4" | "mov" | "mp3" | "wav"

Response (SSE Stream):
{
  "type": "progress",
  "progress": 75
}
{
  "type": "complete",
  "outputUrl": "/downloads/merged.mp4"
}
```

#### 문서 변환
```
POST /api/document/convert
Request: multipart/form-data
- files: File[]
- outputFormat: "pdf" | "docx" | "pptx" | "md" | "html"

Response:
{
  "success": true,
  "files": [
    { "originalName": "report.pdf", "outputUrl": "/downloads/report.docx" }
  ]
}
```

#### 문서 병합
```
POST /api/document/merge
Request: multipart/form-data
- files: File[] (ordered, same format)
- inputFormat: "pdf" | "docx" | "pptx" | "md" | "html"
- options: {
    addSeparator: boolean,
    generateTOC: boolean,
    renumberPages: boolean
  }

Response:
{
  "success": true,
  "outputUrl": "/downloads/merged.pdf",
  "filename": "merged.pdf"
}
```

#### 문서 분할
```
POST /api/document/split
Request: multipart/form-data
- file: File
- mode: "ranges" | "equal" | "pageCount" | "heading" | "section"
- ranges: ["1-10", "11-20"] // if mode=ranges
- parts: 3 // if mode=equal
- pageCount: 5 // if mode=pageCount
- headingLevel: 1 | 2 // if mode=heading (for MD/HTML)
- prefix: "document_part" // output filename prefix

Response:
{
  "success": true,
  "files": [
    { "filename": "document_part1.pdf", "url": "/downloads/document_part1.pdf", "pages": 10 },
    { "filename": "document_part2.pdf", "url": "/downloads/document_part2.pdf", "pages": 10 }
  ]
}
```

---

## 5. 파일 스토리지 전략

### 5.1 로컬 스토리지 (배포 없음)
- **업로드 파일**: `/tmp/uploads/[session-id]/`
- **변환 결과**: `/tmp/outputs/[session-id]/`
- **자동 정리**: 세션 종료 시 또는 1시간 후 자동 삭제

### 5.2 세션 관리
- **Session ID**: UUID 생성 (클라이언트)
- **Cleanup**: Node.js cron job (node-cron)

---

## 6. 에러 핸들링

### 6.1 파일 업로드 에러
- 파일 크기 제한: 500MB (조정 가능)
- 지원되지 않는 형식
- 손상된 파일

### 6.2 변환 에러
- FFmpeg 실행 실패
- 코덱 호환성 문제
- 디스크 공간 부족

### 6.3 UI 에러 표시
- Toast 알림 (shadcn Toast)
- 인라인 에러 메시지
- 로그 영역에 상세 에러

---

## 7. 성능 최적화

### 7.1 파일 처리
- **Streaming**: Node.js Streams API 사용
- **청크 업로드**: 대용량 파일 청크 업로드
- **메모리 관리**: 파일 스트림 처리로 메모리 절약

### 7.2 병렬 처리
- **Worker Threads**: CPU 집약적 작업
- **Queue**: Bull + Redis (선택적)
- **동시 처리 제한**: 최대 4개 파일

### 7.3 프론트엔드
- **Lazy Loading**: 탭 컴포넌트 지연 로딩
- **Code Splitting**: Next.js 자동 코드 분할
- **Debouncing**: 입력 이벤트 최적화

---

## 8. 보안

### 8.1 파일 검증
- MIME type 검증
- 파일 시그니처 확인 (magic bytes)
- 파일 크기 제한

### 8.2 경로 보안
- Path traversal 방지
- 임시 파일 자동 삭제
- Session isolation

### 8.3 Rate Limiting
- API 요청 제한 (선택적)

---

## 9. 개발 로드맵

### Phase 1: 프로젝트 셋업 (1일)
- [x] Next.js 프로젝트 초기화
- [ ] shadcn/ui 설치 및 설정
- [ ] Tailwind CSS 커스터마이징
- [ ] 기본 레이아웃 구현

### Phase 2: 미디어 변환 (3일)
- [ ] FFmpeg 통합
- [ ] 파일 업로드 UI
- [ ] 미디어 변환 API
- [ ] 진행률 표시 (SSE)

### Phase 3: YouTube 다운로드 (2일)
- [ ] ytdl-core 통합
- [ ] 다운로드 API
- [ ] UI 구현

### Phase 4: 비디오 분할/병합 (3일)
- [ ] 분할 로직 구현
- [ ] 병합 로직 구현
- [ ] UI 구현 (시간 입력, 파일 순서 조정)

### Phase 5: 문서 변환 (4일)
- [ ] pdf-lib, docx, pptxgenjs 통합
- [ ] 변환 로직 구현 (15개 변환 조합)
- [ ] UI 구현

### Phase 6: 문서 병합/분할 (4일)
- [ ] 문서 병합 로직
- [ ] 문서 분할 로직 (5가지 형식)
- [ ] UI 구현 (모드 선택, 옵션)

### Phase 7: 테스트 & 최적화 (3일)
- [ ] 통합 테스트
- [ ] 성능 최적화
- [ ] 버그 수정

---

## 10. 기술적 고려사항

### 10.1 FFmpeg 설치
- 로컬 환경: `brew install ffmpeg` (macOS)
- Docker: FFmpeg 포함 이미지 사용

### 10.2 의존성
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.0.0",
    "react-dropzone": "^14.0.0",
    "fluent-ffmpeg": "^2.1.2",
    "ytdl-core": "^4.11.0",
    "pdf-lib": "^1.17.1",
    "docx": "^8.0.0",
    "pptxgenjs": "^3.12.0",
    "markdown-it": "^14.0.0",
    "puppeteer": "^21.0.0",
    "bull": "^4.11.0",
    "redis": "^4.6.0",
    "zustand": "^4.4.0"
  }
}
```

### 10.3 환경 변수
```env
# .env.local
UPLOAD_DIR=/tmp/uploads
OUTPUT_DIR=/tmp/outputs
MAX_FILE_SIZE=524288000  # 500MB in bytes
FFMPEG_PATH=/usr/local/bin/ffmpeg
REDIS_URL=redis://localhost:6379
```

---

## 11. 성공 지표

### 11.1 기능 완성도
- [ ] 모든 7개 탭 기능 구현
- [ ] 15개 문서 변환 조합 지원
- [ ] 문서 병합/분할 5가지 형식 지원

### 11.2 성능
- 작은 파일 (<100MB): 변환 시간 < 30초
- 큰 파일 (100MB-500MB): 병렬 처리로 시간 단축
- 진행률 실시간 업데이트 (지연 < 1초)

### 11.3 사용성
- 직관적인 UI (학습 시간 < 5분)
- 명확한 에러 메시지
- 반응형 디자인 (모바일/태블릿 지원 선택적)

---

## 12. 참고 자료

### 12.1 기존 프로젝트
- 소스 코드: `/Users/gwanli/Documents/GitHub/myproduct_v4/easyconversionv4/src/easyconversion/main.py`
- README: `/Users/gwanli/Documents/GitHub/myproduct_v4/easyconversionv4/README.md`

### 12.2 기술 문서
- Next.js: https://nextjs.org/docs
- shadcn/ui: https://ui.shadcn.com
- FFmpeg: https://ffmpeg.org/documentation.html
- pdf-lib: https://pdf-lib.js.org

---

## 13. 추가 개선 사항 (향후)

- [ ] 클라우드 스토리지 연동 (Google Drive, Dropbox)
- [ ] 배치 처리 대시보드
- [ ] 변환 히스토리 저장
- [ ] 사용자 프리셋 저장 (자주 쓰는 설정)
- [ ] 워터마크 추가 기능
- [ ] 비디오 자막 추출/추가
- [ ] 오디오 정규화/노이즈 제거
- [ ] OCR (이미지→텍스트)
- [ ] 다국어 지원

---

**문서 버전**: 1.0
**작성일**: 2025-12-06
**작성자**: EasyConversion Web Development Team
