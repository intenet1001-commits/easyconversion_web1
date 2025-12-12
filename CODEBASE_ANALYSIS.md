# EasyConversion Web - Comprehensive Codebase Analysis
## Next.js + Electron Application Structure Review

**Date:** December 9, 2025
**Project Location:** `/Users/gwanli/Documents/GitHub/myproduct_v4/easyconversion_web1`

---

## 1. MAIN APPLICATION FEATURES

### Overview
EasyConversion is a **powerful, all-in-one file conversion and processing application** designed as a desktop application using Next.js frontend with Electron wrapper. The application supports multiple file transformation workflows across documents, media, and online content.

### Core Capabilities
- **YouTube Download & Conversion**: Download videos from YouTube in MP4 or MP3 format
- **Media Format Conversion**: Convert between MP4, MP3, MOV, and WAV formats
- **Media Editing**: Split and merge audio/video files with advanced options
- **Document Conversion**: Convert between PDF, DOCX, PPTX, Markdown, and HTML formats
- **Document Operations**: Merge and split PDF/document files
- **File Management**: Session-based upload management with automatic cleanup
- **DMG Building**: Supports building and packaging the app for macOS distribution
- **Real-time Progress Tracking**: Server-sent events (SSE) for streaming conversion progress

---

## 2. KEY FILE CONVERSION CAPABILITIES

### Media Conversions (FFmpeg-based)
**Supported Formats:** MP4, MP3, MOV, WAV

**File:** `/lib/ffmpeg.ts`
- **MP4/MOV:** Uses libx264 video codec, AAC audio codec
- **MP3:** Uses libmp3lame codec, 192k bitrate
- **WAV:** Uses pcm_s16le codec
- Features: Automatic progress tracking, stuck-process detection (30-second timeout), retry logic

**Splitting/Merging:** 
- `ffmpeg-split.ts` - Supports timepoint-based and segment-based splitting
- `ffmpeg-merge.ts` - Combines multiple media files

### Document Conversions
**File:** `/lib/document-converter.ts`

**Supported Conversions:**
- **PDF:** → HTML, Markdown
- **DOCX:** → PDF, HTML, Markdown
- **HTML:** → PDF, DOCX, Markdown
- **Markdown:** → PDF, HTML, DOCX
- **PPTX:** Limited support through file conversion

**Libraries Used:**
- `pdf-lib` - PDF manipulation and rendering
- `mammoth` - DOCX to HTML conversion
- `docx` - HTML to DOCX conversion
- `marked` - Markdown parsing
- `html-pdf-node` - HTML to PDF rendering
- `@distube/ytdl-core` - YouTube video information and stream access

### YouTube Processing
**File:** `/lib/youtube.ts`

**Features:**
- Video info extraction (title, duration, thumbnail, author)
- Download in MP4 (video + audio) or MP3 (audio only) format
- Uses highest quality streams available
- Real-time progress tracking

---

## 3. ELECTRON INTEGRATION SETUP

### Electron Architecture
**Main Process:** `/electron/main.js`

**Key Features:**
- Spawns Next.js development/production server on port 9005
- Automatically detects if port is already in use
- Loads Next.js app into BrowserWindow
- Auto-starts Next.js server on app launch
- Graceful shutdown handling for both Electron and Next.js processes

**Security Configuration:**
- Context isolation enabled (`contextIsolation: true`)
- Node integration disabled (`nodeIntegration: false`)
- Preload script setup for safe IPC (minimal usage currently)

**Preload Script:** `/electron/preload.js`
- Currently minimal - exposes Electron API through context bridge
- Placeholder for IPC method exposure (can be expanded for Tauri migration)

### Build Configuration
**File:** `electron-builder.yml`

**ASAR Unpacking Strategy:**
```yaml
asarUnpack:
  - Native modules (*.node)
  - Next.js build artifacts (.next/**)
  - Core Node modules (react, react-dom, @next, @swc)
  - Media libraries (fluent-ffmpeg, pdf-lib)
  - File parsing (formidable)
```

**Targets:**
- macOS: DMG + ZIP
- Windows: NSIS installer
- Linux: AppImage + DEB package

**macOS Settings:**
- Minimum system version: 10.13.0
- Dark mode support enabled
- App category: productivity

---

## 4. API ROUTES AND BACKEND LOGIC

### Route Structure: `/app/api/`

#### File Upload
- **Route:** `/api/upload`
- **Handler:** `route.ts`
- **Method:** POST with multipart/form-data
- **Logic:**
  - Uses `formidable` library for stream-based file parsing
  - Supports files up to 50GB
  - Creates session-based directories: `tmp/uploads/{sessionId}/{fileId}_{filename}`
  - Returns file metadata (fileId, originalName, savedName, path, size)

#### Media Processing
1. **Convert** (`/api/media/convert`)
   - Streams FFmpeg conversion progress via Server-Sent Events
   - Retry logic (2 retries on failure)
   - Outputs to `public/downloads/{sessionId}/`

2. **Split** (`/api/media/split`)
   - Two modes: timepoint-based and segment-based
   - Generates multiple output files with progress tracking

3. **Merge** (`/api/media/merge`)
   - Combines multiple media files into single output
   - Uses FFmpeg concat protocol

#### Document Processing
1. **Convert** (`/api/document/convert`)
   - Conversion matrix: PDF↔HTML↔Markdown, DOCX↔PDF/HTML/Markdown
   - Validation of supported conversions
   - SSE streaming for progress updates

2. **Merge** (`/api/document/merge`)
   - PDF-specific merging (merge all uploaded PDFs)
   - Output: `public/downloads/{sessionId}/merged_{timestamp}.pdf`

3. **Split** (`/api/document/split`)
   - Multiple modes: ranges, equal segments, page count, heading-based, section-based
   - Generates multiple PDF outputs

4. **Page Count** (`/api/document/page-count`)
   - Analyzes PDF structure for splitting options

#### YouTube Download
- **Route:** `/api/youtube/download`
- **Route:** `/api/youtube/info`
- **Logic:**
  - Validates YouTube URLs
  - Fetches video metadata
  - Streams download progress to client
  - Outputs: `public/downloads/{sessionId}/youtube_{timestamp}.{mp4|mp3}`

#### System Operations
1. **Open Folder** (`/api/open-folder`)
   - Cross-platform folder opening (macOS: `open`, Windows: `explorer`, Linux: `xdg-open`)
   - Supports: dist folder, project downloads, user downloads, custom paths

2. **Cleanup** (`/api/cleanup`)
   - `/cleanup/auto` - Removes sessions older than 24 hours
   - `/cleanup/uploads` - Clears entire tmp/uploads directory
   - Returns storage stats (session count, size)

3. **Build Operations**
   - `/api/build-dmg` - Triggers electron-builder for DMG creation
   - `/api/build-app` - Builds app for Applications folder
   - Both stream progress via SSE

4. **Project Files** (`/api/project-files`)
   - `/list` - Lists all downloaded files with total storage usage
   - `/delete` - Removes specific files

### Backend Patterns
- **Streaming:** Server-Sent Events (SSE) for real-time progress
- **Session Management:** Session ID-based file organization
- **Error Handling:** Per-file error handling with continuation
- **Retry Logic:** Automatic retry on media conversion failures
- **Node.js Runtime:** All routes use `runtime = 'nodejs'` for system access
- **Long Timeouts:** 5-minute (300s) max duration for conversion operations

---

## 5. FRONTEND COMPONENTS AND UI STRUCTURE

### Layout Components
- **MainLayout** (`/components/layout/MainLayout`)
  - Wraps all pages with navigation and header
  - Manages overall app structure

### Tab System
**Main Tab Interface:** `/app/page.tsx` (7 tabs)

1. **YouTubeTab** (`YouTubeTab.tsx`)
   - URL input with paste functionality
   - Video info display (title, thumbnail, duration, author)
   - Format selection (MP4/MP3)
   - Progress bar with download streaming
   - Direct file download link

2. **MediaConvertTab** (`MediaConvertTab.tsx`)
   - Multi-file upload (drag-and-drop)
   - Format selection with codec options
   - Batch conversion with individual progress tracking
   - File reordering support (drag-and-drop)

3. **MediaSplitTab** (`MediaSplitTab.tsx`)
   - Mode selection (timepoint vs. segment)
   - Duration preview
   - Dynamic timepoint/segment input
   - Progress tracking per segment

4. **MediaMergeTab** (`MediaMergeTab.tsx`)
   - Multi-file upload
   - File ordering (drag-and-drop)
   - Format selection for output
   - Batch merge processing

5. **DocumentConvertTab** (`DocumentConvertTab.tsx`)
   - Multi-document upload
   - Format matrix selection (PDF↔DOCX↔HTML↔Markdown)
   - Conversion progress tracking
   - Output file download

6. **DocumentMergeTab** (`DocumentMergeTab.tsx`)
   - PDF-focused merge operation
   - File ordering
   - Merge with progress tracking

7. **DocumentSplitTab** (`DocumentSplitTab.tsx`)
   - Multiple split modes UI
   - Page range, equal division, or heading-based splitting
   - Preview of split results
   - Batch download of split files

### Common Components
- **ProgressBar** - Visual progress indicator with percentage
- **LogViewer** - Real-time log display with scrolling
- **ProjectFilesDialog** - File manager for downloaded files
- **FileUploader** - Drag-and-drop file upload component

### UI Framework
- **Radix UI Components:**
  - Dialog, Tabs, RadioGroup, Checkbox, Label
  - ScrollArea, Separator, Toast notifications
  - Select, Progress bar
  
- **Tailwind CSS:** Styling and layout
- **Lucide React:** Icons (60+ icon types used)
- **Class Variance Authority:** Component styling patterns

### Toast/Notification System
- **Toast Hook:** `/hooks/use-toast`
- Real-time user feedback for operations
- Success, error, and info notifications
- Configurable duration and variants

---

## 6. KEY DEPENDENCIES AND PURPOSES

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| `next` | ^15.0.0 | React framework with SSR, API routes, file-based routing |
| `react` | ^18.3.0 | UI component library |
| `react-dom` | ^18.3.0 | React DOM rendering |
| `electron` | ^39.2.6 | Desktop app wrapper |
| `electron-builder` | ^26.0.12 | App packaging and distribution |

### Media Processing
| Package | Version | Purpose |
|---------|---------|---------|
| `fluent-ffmpeg` | ^2.1.3 | Video/audio conversion wrapper (requires FFmpeg binary) |
| `@distube/ytdl-core` | ^4.16.12 | YouTube video download and streaming |

### Document Processing
| Package | Version | Purpose |
|---------|---------|---------|
| `pdf-lib` | ^1.17.1 | PDF manipulation and rendering |
| `pdfkit` | ^0.17.2 | PDF generation |
| `mammoth` | ^1.11.0 | DOCX to HTML conversion |
| `docx` | ^9.5.1 | Generate DOCX files programmatically |
| `xlsx` | ^0.18.5 | Excel file handling |
| `marked` | ^17.0.1 | Markdown to HTML parsing |
| `html-pdf-node` | ^1.0.8 | HTML to PDF conversion |

### Form & File Handling
| Package | Version | Purpose |
|---------|---------|---------|
| `formidable` | ^3.5.4 | Form data & file upload parsing (stream-based) |
| `react-dropzone` | ^14.2.3 | Drag-and-drop file upload |

### UI & Styling
| Package | Version | Purpose |
|---------|---------|---------|
| `@radix-ui/*` | ^1.x | Accessible component primitives (10 packages) |
| `tailwindcss` | ^3.4.0 | Utility-first CSS framework |
| `tailwindcss-animate` | ^1.0.7 | Animation utilities |
| `class-variance-authority` | ^0.7.0 | Type-safe component variants |
| `clsx` | ^2.1.0 | Conditional className utility |
| `lucide-react` | ^0.344.0 | Icon library (60+ icons) |
| `tailwind-merge` | ^2.2.0 | Merge Tailwind class names |

### State Management & Utilities
| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | ^4.4.7 | Lightweight state management store |
| `uuid` | ^10.0.0 | UUID generation for file IDs |
| `date-fns` | ^3.0.0 | Date formatting and manipulation |
| `emitter` | ^0.0.5 | Event emitter for custom events |

### Drag-and-Drop
| Package | Version | Purpose |
|---------|---------|---------|
| `@dnd-kit/core` | ^6.3.1 | Drag-and-drop engine |
| `@dnd-kit/sortable` | ^10.0.0 | Sortable list implementation |
| `@dnd-kit/utilities` | ^3.2.2 | DnD utilities |

### Development Tools
| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5 | Static type checking |
| `eslint` | ^8 | Code linting |
| `autoprefixer` | ^10.0.1 | CSS vendor prefixes |
| `postcss` | ^8 | CSS processing |

### System Requirements
- **FFmpeg:** Required for media conversion (binary path: `/opt/homebrew/bin/ffmpeg`)
- **FFprobe:** Required for media info extraction (binary path: `/opt/homebrew/bin/ffprobe`)
- **Node.js:** Included with Electron runtime in packaged app

---

## 7. OVERALL ARCHITECTURE AND DATA FLOW

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Main Process                      │
│  - Spawn Next.js server (port 9005)                          │
│  - Manage BrowserWindow                                       │
│  - Handle app lifecycle                                       │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ IPC (minimal currently)
                     │
┌────────────────────▼────────────────────────────────────────┐
│              Next.js Frontend (React 18)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  UI Layer (Tabs: YouTube/Media/Document)             │   │
│  │  - YouTubeTab, MediaConvertTab, DocumentConvertTab  │   │
│  │  - File uploads, format selection, progress UI       │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  State Management (Zustand)                          │   │
│  │  - useConversionStore: files, progress, logs, tabs  │   │
│  │  - Session persistence via localStorage              │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
         │  HTTP/SSE │           │
         │           │           │
┌────────▼───────────▼───────────▼────────────────────────────┐
│            Next.js Backend (Node.js)                         │
│                  API Routes                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ File Upload        /api/upload                       │   │
│  │ Media Processing   /api/media/convert|split|merge   │   │
│  │ Document Process   /api/document/convert|merge|split│   │
│  │ YouTube Download   /api/youtube/download|info       │   │
│  │ System Operations  /api/open-folder|cleanup|build    │   │
│  │ Project Files      /api/project-files/list|delete    │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Libraries & Tools                                    │   │
│  │ - FFmpeg (fluent-ffmpeg): Media conversion          │   │
│  │ - PDF-lib, Mammoth, docx: Document conversion       │   │
│  │ - ytdl-core: YouTube processing                      │   │
│  │ - Formidable: File upload parsing                   │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
         ┌───────────┼───────────────────┐
         │           │                   │
         ▼           ▼                   ▼
    ┌─────────┐ ┌─────────────┐  ┌──────────────┐
    │   File  │ │   External  │  │   System     │
    │ System  │ │   Services  │  │   Commands   │
    │         │ │             │  │              │
    │ tmp/    │ │ YouTube     │  │ open folder  │
    │uploads/ │ │ FFmpeg      │  │ exec shell   │
    │public/  │ │ binaries    │  │              │
    │downloads│ │             │  │              │
    └─────────┘ └─────────────┘  └──────────────┘
```

### Data Flow Example: Media Conversion
```
User Input (YouTubeTab/MediaConvertTab)
    ↓
File Upload (/api/upload)
    ↓ (file saved to tmp/uploads/{sessionId}/)
Add to Zustand Store
    ↓
User clicks "Convert"
    ↓
Frontend streams request to /api/media/convert
    ↓
Backend receives request
    ├─ Creates output directory (public/downloads/{sessionId}/)
    ├─ Calls convertMedia() [ffmpeg.ts]
    │  ├─ Validates inputs
    │  ├─ Spawns FFmpeg process
    │  ├─ Tracks duration and progress
    │  └─ Emits progress via SSE
    │
    └─ Streams progress back to frontend via ReadableStream
        ↓
Frontend receives SSE updates
    ├─ Updates progress bar
    ├─ Logs messages to LogViewer
    └─ Shows download link on completion
```

### Session Management
- **Session ID:** Generated on app start (UUID v4)
- **Storage:** `tmp/uploads/{sessionId}/`
- **Persistence:** Session data saved to localStorage
- **Cleanup:**
  - Automatic: Sessions older than 24 hours
  - Manual: User can force cleanup
  - On exit: Cleanup triggered via `beforeunload` event

### File Organization
```
project_root/
├── tmp/
│   └── uploads/
│       └── {sessionId}/
│           └── {fileId}_{filename}  ← Uploaded files
├── public/
│   └── downloads/
│       └── {sessionId}/
│           ├── converted_file.mp4
│           ├── merged_file.pdf
│           └── ...              ← Output files (downloadable via HTTP)
├── app/
│   ├── page.tsx              ← Main UI
│   ├── layout.tsx            ← Root layout
│   └── api/
│       ├── upload/
│       ├── media/
│       ├── document/
│       ├── youtube/
│       ├── open-folder/
│       ├── cleanup/
│       ├── project-files/
│       └── build-*/ (DMG/app building)
├── components/
│   ├── layout/
│   ├── tabs/                 ← Tab UI components
│   ├── common/               ← Shared components
│   └── ui/                   ← Radix UI components
├── lib/
│   ├── ffmpeg.ts            ← Media conversion
│   ├── document-converter.ts ← Doc conversion
│   ├── youtube.ts           ← YouTube download
│   ├── ffmpeg-split.ts      ← Media splitting
│   ├── ffmpeg-merge.ts      ← Media merging
│   ├── pdf-utils.ts         ← PDF utilities
│   └── ...
├── store/
│   └── useConversionStore.ts ← Zustand state
├── types/
│   └── index.ts             ← TypeScript interfaces
├── electron/
│   ├── main.js              ← Electron main process
│   └── preload.js           ← Preload script
└── electron-builder.yml     ← Build configuration
```

---

## 8. MIGRATION CONSIDERATIONS FOR TAURI

### What Will Change

#### 1. **Electron to Tauri Core**
- Replace `electron/main.js` → Tauri Rust backend
- Remove `electron-builder.yml` → Use Tauri configuration
- Preload scripts → Tauri commands/invoke system

#### 2. **IPC Communication**
- Current: Minimal direct IPC (mostly HTTP)
- Future: Use Tauri `invoke()` for system operations
  - File operations (open-folder)
  - Build commands
  - System-level interactions

#### 3. **File System Access**
- Current: Direct Node.js `fs` module
- Future: Tauri's `fs` module with permission scopes
- Requires defining allowed paths in `tauri.conf.json`

#### 4. **External Binary Access**
- Current: Shell exec commands, child_process spawning
- Future: Tauri's `Command` system or shell module
- FFmpeg/FFprobe integration needs adjustment

#### 5. **Build Process**
- Simplification: Tauri handles packaging for all platforms
- No need for `electron-builder.yml`
- Cross-compilation possible from single machine

### What Stays the Same
- **React Frontend:** 100% compatible (Vite will replace Next.js in dev)
- **API Routes:** Convert to Tauri commands
- **Libraries:** Most npm packages work unchanged
- **UI Components:** All Radix UI and Tailwind CSS compatible
- **State Management:** Zustand remains unchanged
- **Styling:** Tailwind CSS configuration ports directly
- **Business Logic:** FFmpeg, document conversion, YouTube logic all work

### What Needs Careful Planning
1. **Large File Handling:** Tauri has different approaches for large uploads
2. **Streaming Responses:** SSE pattern changes to command-based updates
3. **Session Management:** localStorage still works, but file serving changes
4. **Development Workflow:** Next.js dev server → Tauri dev mode
5. **Permission Model:** Define explicit capabilities in Tauri config

---

## 9. SUMMARY TABLE

| Aspect | Technology | Details |
|--------|-----------|---------|
| **Desktop Framework** | Electron | v39.2.6, spawns Next.js server |
| **Frontend Framework** | Next.js 15 | App Router, API routes, SSR |
| **UI Library** | React 18 | Client components, hooks |
| **State Management** | Zustand | Store for files, progress, logs |
| **Styling** | Tailwind CSS 3 | Utility-first CSS framework |
| **UI Components** | Radix UI | Accessible component primitives |
| **Icons** | Lucide React | 60+ icons for UI |
| **Media Processing** | FFmpeg (fluent-ffmpeg) | Video/audio conversion, splitting, merging |
| **Document Conversion** | pdf-lib, mammoth, docx | PDF/DOCX/HTML/Markdown conversions |
| **YouTube Download** | @distube/ytdl-core | Video info & streaming download |
| **File Upload** | Formidable | Streaming file upload parsing |
| **Drag-and-Drop** | dnd-kit | File reordering and list sorting |
| **Notifications** | Radix Toast | User feedback system |
| **Type Safety** | TypeScript 5 | Full codebase typing |
| **Language** | Korean | UI labels and messages are in Korean |

---

## 10. KEY METRICS

- **Total Dependencies:** ~200+ npm packages
- **API Routes:** 18 endpoint groups covering all features
- **UI Tabs:** 7 major feature tabs
- **Supported Formats:**
  - Media: MP4, MP3, MOV, WAV (4 formats)
  - Documents: PDF, DOCX, PPTX, HTML, Markdown (5 formats)
  - Conversions: ~12+ conversion paths
- **File Size Limit:** 50GB per file (50687091200 bytes)
- **Timeout:** 5 minutes (300 seconds) for operations
- **Progress Tracking:** Real-time via Server-Sent Events
- **Session Retention:** 24 hours default

