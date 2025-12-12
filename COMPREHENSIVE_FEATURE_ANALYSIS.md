# EasyConversion Web1 - Complete Feature Analysis Report

**Project Location:** `/Users/gwanli/Documents/GitHub/myproduct_v4/easyconversion_web1`

**Technology Stack:** Next.js 15, React 18, TypeScript, Node.js, FFmpeg, Electron

---

## 1. COMPLETE FEATURE LIST

### 1.1 Main Application Features

#### A. YouTube Download
- Download YouTube videos as MP4 (video + audio)
- Download YouTube videos as MP3 (audio only)
- Video information retrieval (title, duration, thumbnail, author)
- URL validation and error handling
- Real-time download progress tracking
- Session-based file management

#### B. Media Conversion (Video/Audio)
- Batch file conversion support
- Multiple input file handling
- Real-time conversion progress per file
- File retry logic (up to 2 retries on failure)
- Codec detection and configuration
- Preset quality options (fast encoding, CRF 23)
- Output format selection
- File download management

#### C. Media File Splitting
- Split media by timepoints (user-defined split points)
- Split media into equal segments (N segments)
- Timepoint-based splitting with custom time inputs
- Segment count-based equal division
- Fast processing using codec copy method
- Progress tracking per segment
- Bulk input support for timepoints
- File numbering and organization

#### D. Media File Merging
- Merge multiple media files into single output
- Automatic codec compatibility detection
- Fast merge method (codec copy) for compatible files
- Re-encoding mode for incompatible codecs
- Drag-and-drop file reordering
- User choice to force re-encoding
- Progress tracking during merge
- Output format selection

#### E. Document Conversion (PDF, DOCX, HTML, Markdown)
- PDF to HTML conversion
- PDF to Markdown conversion
- DOCX to PDF conversion
- DOCX to HTML conversion
- DOCX to Markdown conversion
- HTML to PDF conversion
- HTML to DOCX conversion
- HTML to Markdown conversion
- Markdown to PDF conversion
- Markdown to HTML conversion
- Markdown to DOCX conversion
- Progress tracking per file
- Batch document conversion
- Intelligent conversion routing

#### F. Document Merging (PDF)
- Merge multiple PDF files
- Page order preservation
- File reordering with drag-and-drop UI
- Quick merge without re-encoding
- Batch merge support

#### G. Document Splitting (PDF)
- Split PDFs by page ranges
- Custom range extraction
- Multiple range extraction in single operation
- Page count detection and validation
- Custom output naming per range
- 1-based page numbering (user-friendly)
- Range validation with error messages

#### H. Application Build & Distribution
- DMG build and installation (macOS)
- App package creation (Electron)
- Build progress logging
- Real-time build status feedback
- Desktop installation support

#### I. File Management
- File upload with progress tracking
- Large file support (up to 50GB per file)
- Session-based file organization
- Project files listing
- Individual file deletion
- Storage usage calculation
- Download folder management

#### J. Session Management
- Automatic session creation on app start
- Previous session restoration
- Session recovery with file list restoration
- Session-based cleanup
- Configurable session cleanup (24+ hours old sessions)
- Cleanup confirmation dialogs

#### K. Storage & Cleanup
- Automatic temporary file cleanup
- Manual cleanup options (24+ hour old sessions)
- Full tmp/uploads cleanup
- Storage usage display (bytes to TB conversion)
- Freed space calculation
- Batch session deletion

#### L. UI/UX Features
- 7-tab interface (YouTube, Media Convert, Media Split, Media Merge, Doc Convert, Doc Merge, Doc Split)
- Real-time progress bars
- Log viewer with message history
- Toast notifications
- Session recovery alerts
- File selection checkboxes
- Batch download operations
- File name customization on download
- Folder opening (dist, downloads)
- Electron environment detection

---

## 2. ALL API ENDPOINTS

### 2.1 Media Conversion APIs

**POST /api/media/convert**
- Input: FormData with files, sessionId, outputFormat
- Output: Server-Sent Events (SSE) stream
- Features: Batch conversion, file retry logic, progress tracking
- Response types: progress, complete, file-error, done, error

**POST /api/media/split**
- Input: FormData with fileData, sessionId, mode (timepoints|segments)
- Input modes:
  - timepoints: array of time strings (HH:MM:SS format)
  - segments: integer segment count
- Output: SSE stream with segment progress
- Response types: start, info, progress, complete, error

**POST /api/media/merge**
- Input: FormData with filesData, sessionId, outputFormat, reencode flag
- Features: Codec compatibility check, fast/re-encode modes
- Output: SSE stream
- Response types: start, info, progress, complete, error

### 2.2 Document Conversion APIs

**POST /api/document/convert**
- Input: FormData with filesData, sessionId, outputFormat
- Supported conversions:
  - PDF: html, md
  - DOCX: pdf, html, md
  - HTML: pdf, docx, md
  - Markdown: pdf, html, docx
- Output: SSE stream
- Response types: start, info, progress, complete, error

**POST /api/document/merge**
- Input: FormData with filesData, sessionId
- Features: PDF-specific merging
- Output: JSON response with outputUrl
- Returns: success, outputUrl, message

**POST /api/document/split**
- Input: FormData with fileData, sessionId, ranges (JSON)
- Range format: [{start: number, end: number, name?: string}]
- Features: Multi-range extraction, custom naming
- Output: JSON response
- Returns: success, outputUrls, message

**POST /api/document/page-count**
- Input: JSON with sessionId, fileName
- Features: PDF page count detection
- Output: JSON with pageCount
- Returns: success, pageCount

### 2.3 YouTube APIs

**POST /api/youtube/download**
- Input: JSON with url, format (mp4|mp3), sessionId
- Features: Video/audio download, quality selection
- Output: SSE stream
- Response types: start, progress, complete, error

**POST /api/youtube/info**
- Input: JSON with url
- Features: Video metadata retrieval
- Output: JSON with video info
- Returns: success, info (title, duration, thumbnail, author)

### 2.4 File Management APIs

**POST /api/upload**
- Input: FormData with files, sessionId
- Features: Streaming upload, large file support (50GB)
- Output: JSON
- Returns: success, files array with metadata

**POST /api/project-files/list**
- Input: None (GET equivalent)
- Features: Directory listing and size calculation
- Output: JSON with file list and total size
- Returns: success, files, totalSize

**POST /api/project-files/delete**
- Input: JSON with sessionId, filePath
- Features: Individual file deletion
- Output: JSON
- Returns: success, message

**POST /api/cleanup**
- Input: JSON with sessionId
- Features: Session-specific cleanup
- Output: JSON
- Returns: success

**POST /api/cleanup/auto**
- GET: Check old sessions (24+ hours)
- POST: Execute cleanup
- Output: JSON with session info
- Returns: success, oldSessions, totalOldSizeGB, deletedSessions, freedSpaceGB

**POST /api/cleanup/uploads**
- GET: Check total upload sizes
- POST: Execute full cleanup
- Output: JSON
- Returns: success, totalSessions, totalSizeGB, deletedSessions, freedSpaceGB

### 2.5 Build APIs

**POST /api/build-dmg**
- Features: macOS DMG package creation and installation
- Output: SSE stream
- Response types: progress, complete, error

**POST /api/build-app**
- Features: Electron app package creation and installation
- Output: SSE stream
- Response types: progress, complete, error

### 2.6 Utility APIs

**POST /api/open-folder**
- Input: JSON with openDistFolder or openProjectDownloads flags
- Features: Open file explorer to specific folders
- Output: JSON
- Returns: success, message

---

## 3. SUPPORTED FILE FORMATS BY CONVERSION TYPE

### 3.1 Media Conversion Formats

**Video Formats:**
- MP4 (MPEG-4 video, H.264 codec, AAC audio)
- MOV (QuickTime format, H.264 codec, AAC audio)
- AVI (Windows video format)
- MKV (Matroska video format)
- WebM (Web video format)

**Audio Formats:**
- MP3 (MPEG Layer III, 192k bitrate)
- WAV (PCM uncompressed audio)

**Quality Settings:**
- Video: 5000k bitrate, CRF 23 (preset: fast)
- Audio: 192k bitrate
- Fast start enabled for MP4 (for streaming)

### 3.2 Document Conversion Formats

**Input/Output Formats:**
- PDF (PDF documents)
- DOCX (Microsoft Word)
- HTML (Web documents)
- Markdown (Markdown text)
- PPTX (PowerPoint - listed but not implemented in Phase 5)

**Conversion Matrix:**
```
PDF → HTML, Markdown
DOCX → PDF, HTML, Markdown
HTML → PDF, DOCX, Markdown
Markdown → PDF, HTML, DOCX
PPTX → (not supported)
```

**Page Handling:**
- PDF page counting and extraction
- 1-based page numbering (user-friendly)
- Page range extraction support

### 3.3 YouTube Download Formats

**Download Formats:**
- MP4 (highest video quality + audio)
- MP3 (highest audio quality, audio only)

**Quality Selection:**
- highestvideo stream for MP4
- highestaudio stream for MP3
- Automatic codec selection

---

## 4. YOUTUBE DOWNLOAD FUNCTIONALITY - DETAILED

### 4.1 Core Capabilities

**URL Handling:**
- YouTube URL validation using @distube/ytdl-core
- Support for standard YouTube URLs
- Support for YouTube Shorts
- URL format detection

**Video Information Retrieval:**
- Title (filename safe, special character removal)
- Duration (in seconds)
- Thumbnail URL (highest quality)
- Author/Channel name
- Video metadata caching during session

**Download Modes:**

1. **MP4 Download Mode:**
   - Separate video stream download (highest quality)
   - Separate audio stream download (highest quality)
   - FFmpeg audio-video merge
   - H.264 video codec
   - AAC audio codec
   - Fast preset encoding
   - Real-time progress reporting

2. **MP3 Download Mode:**
   - Audio-only stream download
   - FFmpeg MP3 encoding
   - 192k bitrate
   - LibMP3Lame codec
   - No video data
   - Smaller file size

### 4.2 Progress Tracking

- Real-time progress percentage (0-100%)
- Per-file progress updates
- Event-based progress streaming
- Progress percentage capping at 100%

### 4.3 Error Handling

- Invalid URL detection
- Network error handling
- Stream error recovery
- Timeout protection
- FFmpeg process error capture

### 4.4 Technical Implementation

**Libraries:**
- @distube/ytdl-core (stream fetching)
- fluent-ffmpeg (audio/video processing)
- Node.js streams for efficient data transfer

**Performance:**
- Stream-based processing (low memory usage)
- No temporary video files stored
- Direct stream to output file
- Progress callback mechanism

---

## 5. FILE MERGE/SPLIT CAPABILITIES - DETAILED

### 5.1 Media File Splitting

**Split Methods:**

1. **Timepoint-based Splitting:**
   - User specifies split points in HH:MM:SS format
   - Creates N+1 segments from N timepoints
   - Example: 3 timepoints create 4 segments
   - Segment boundaries: [0, tp1, tp2, tp3, end]

2. **Segment Count-based Splitting:**
   - Divide file into N equal segments
   - Automatic duration calculation
   - Equal segment duration
   - Example: 10-minute file split into 3 = 3:20, 3:20, 3:20

**Implementation Details:**
- FFmpeg codec copy method (fast, no re-encoding)
- Per-segment progress tracking
- Output file naming: `originalName_part1`, `originalName_part2`, etc.
- Extension preservation

**Features:**
- Batch timepoint input (multiple lines)
- Segment count adjustment
- Real-time progress per segment
- Automatic file numbering

### 5.2 Media File Merging

**Merge Methods:**

1. **Fast Merge (Codec Copy):**
   - Used when all input files have same codecs
   - No re-encoding required
   - Concat demuxer with `-f concat` option
   - Fastest performance
   - Preserves original quality

2. **Re-encoding Merge:**
   - Used for codec mismatch
   - All files re-encoded to target format
   - Slower but compatible with any input
   - Video: libx264, AAC audio
   - User-selectable force re-encoding option

**Codec Detection:**
- Automatic codec info extraction via ffprobe
- Video codec detection
- Audio codec detection
- Compatibility matrix creation

**Features:**
- File reordering with drag-and-drop
- Automatic merge mode selection
- Progress tracking
- Output format selection

### 5.3 Document File Splitting (PDF)

**Split Capabilities:**
- Page range extraction (e.g., pages 5-12)
- Multiple ranges in single operation
- Example: Extract pages 1-5, 10-15, 20-25 from one PDF
- Page range validation
- Custom output file naming per range

**Implementation:**
- PDF-lib library for manipulation
- Page index conversion (1-based to 0-based)
- New PDF creation for each range
- No re-encoding (pure PDF manipulation)

**Features:**
- Page count detection before splitting
- Range validation with error messages
- Default naming: `filename_pages1-5.pdf`
- Custom naming: user-defined name per range

### 5.4 Document File Merging (PDF)

**Merge Capabilities:**
- Multiple PDF file combination
- Page order preservation
- File sequence control via drag-and-drop
- PDF-lib for page copying

**Implementation:**
- Create new PDF document
- Copy pages from each input PDF
- Sequential page addition
- No data loss

**Features:**
- File reordering UI
- Batch merge support
- Single output file
- Quick operation (no encoding)

---

## 6. UI COMPONENTS AND FEATURES

### 6.1 Main Layout Components

**MainLayout Component:**
- Header with branding
- Footer with information
- Tab navigation system
- Responsive design
- Toast notification system

**Header Component:**
- Application title
- Navigation breadcrumb
- Session information display
- Dark mode toggle (tailwind support)

**Footer Component:**
- Information/help text
- Version information
- Links to resources

### 6.2 Tab Components

#### YouTubeTab
- URL input field
- Format selection (MP4/MP3)
- Video info button with loading state
- Download button with state management
- Progress bar display
- Download link display
- Log viewer
- Metadata display (title, author, duration, thumbnail)

#### MediaConvertTab
- File uploader (drag-drop support)
- Output format selector (mp4, mp3, mov, wav, avi, mkv)
- File list with size display
- Progress bars per file
- Download button (single/batch)
- File name customization on download
- File selection checkboxes
- Select all/none toggle
- Log viewer
- Conversion status indicator

#### MediaSplitTab
- Single file upload (one at a time)
- Mode selector (timepoints/segments)
- Timepoint input with add/remove
- Segment count input
- Bulk timepoint input (textarea)
- Progress tracking per segment
- Output file list
- File download options
- Folder open button
- Log viewer

#### MediaMergeTab
- Multi-file uploader
- File list with reordering
- Drag-and-drop file reordering
- File removal buttons
- Output format selector
- Re-encoding toggle checkbox
- Progress bar
- Download button
- Log viewer

#### DocumentConvertTab
- Multi-file uploader
- Output format selector
- Conversion matrix validation
- File list display
- Progress bars per file
- Download buttons (single/batch)
- File name customization
- Status indicators (success/error icons)
- Log viewer

#### DocumentMergeTab
- Multi-file uploader
- File list with reordering
- Drag-and-drop reordering
- File numbering display
- Merge button
- Progress tracking
- Download button
- Log viewer

#### DocumentSplitTab
- Single PDF upload
- Page count detection
- Dynamic range input UI
- Range add/remove buttons
- Custom naming per range
- Range validation
- Progress tracking
- File download with names
- Log viewer
- Selected files tracking

### 6.3 Common Components

**FileUploader Component:**
- Drag-and-drop zone
- Click to browse
- File type validation
- File size display
- Multiple file support options
- Accept file types configuration

**ProgressBar Component:**
- Percentage display
- Visual progress indicator
- Animation support
- Completion state

**LogViewer Component:**
- Message history display
- Auto-scroll to latest message
- Clear logs button
- Message timestamps
- Scrollable area (scroll-area from UI library)

**TimeInput Component:**
- HH:MM:SS format input
- Time validation
- Individual spinners for hours/minutes/seconds
- Increment/decrement controls

**ProjectFilesDialog Component:**
- File browser modal
- File listing with sizes
- Delete file functionality
- Total storage display
- Directory navigation (if applicable)

### 6.4 UI Libraries & Features

**Radix UI Components Used:**
- Checkbox (with label)
- Label (form labels)
- Progress bar
- Radio group
- Scroll area
- Select (dropdown)
- Tabs (tabbed interface)
- Toast (notifications)
- Textarea

**Custom UI Components:**
- Button (with variants: default, outline, destructive, ghost)
- Card (content container)
- Input (text field)

**Icons Used (Lucide React):**
- Download (download actions)
- FileUpload (file operations)
- Folder/FolderOpen (folder navigation)
- Plus/Minus (add/remove items)
- Trash2 (delete actions)
- X (close buttons)
- CheckSquare/Square (selection)
- CheckCircle2 (success states)
- XCircle (error states)
- GripVertical (drag handle)
- RotateCcw (refresh/restore)
- Package (build actions)
- Info (information)
- Loader2 (loading states)

### 6.5 State Management

**Zustand Store (useConversionStore):**
- activeTab (current tab state)
- sessionId (user session)
- files (uploaded files list)
- progressList (conversion progress)
- logs (conversion logs)
- Functions:
  - setActiveTab()
  - setSessionId()
  - addFile()
  - removeFile()
  - clearFiles()
  - addLog()
  - clearLogs()
  - updateProgress()
  - clearProgress()

**Local Component State:**
- Form inputs
- Progress percentages
- Selection states (checkboxes)
- Modal open/close states
- File upload progress
- Download URLs

### 6.6 Toast Notification Features

- Success notifications
- Error notifications (destructive variant)
- Info notifications
- Warning notifications
- Custom duration
- Auto-dismiss
- Manual dismiss button

---

## 7. ADVANCED FEATURES & TECHNICAL DETAILS

### 7.1 Session Management

**Session System:**
- Automatic UUID session generation
- Session-specific file storage in `tmp/uploads/{sessionId}`
- Session-based cleanup on browser close
- Previous session restoration from localStorage
- File list restoration on session recovery

**Session Cleanup:**
- Automatic cleanup on page unload
- sendBeacon API for reliable transmission
- Fallback to fetch with keepalive
- Both beforeunload and pagehide events
- Periodic auto-cleanup of 24+ hour old sessions

### 7.2 Error Handling & Retry Logic

**Media Conversion Retry:**
- Automatic retry up to 2 times
- 2-second delay between retries
- Individual file failure doesn't stop batch
- Detailed error messages per file
- Success/failure summary

**FFmpeg Timeout Protection:**
- 30-second no-response timeout
- Process killing on timeout
- Stuck process detection
- Timer reset on progress update
- Clear error messages

**Validation:**
- File size validation (max: 500MB default, configurable)
- File type validation (extension check)
- Format compatibility checking
- Page range validation for PDFs
- URL validation for YouTube

### 7.3 Performance Optimizations

**FFmpeg Settings:**
- Codec copy for fast merge/split (when applicable)
- Preset: fast for video encoding
- CRF: 23 for quality/size balance
- Max muxing queue size: 9999
- movflags: +faststart for MP4 (streaming)

**Upload Handling:**
- Streaming upload with formidable
- No file size memory limit (50GB support)
- Separate temp directory handling
- Atomic file move after upload

**Progress Tracking:**
- Real-time percentage updates
- Granular per-file tracking
- Per-segment tracking for splits
- Codec compatibility pre-check (cached)

### 7.4 Storage Management

**Directory Structure:**
```
project_root/
├── tmp/
│   └── uploads/
│       ├── temp/ (temporary upload staging)
│       └── {sessionId}/ (session-specific files)
├── public/
│   └── downloads/
│       └── {sessionId}/ (downloadable output files)
└── [other project files]
```

**Storage Calculation:**
- Recursive directory size calculation
- GB/MB/KB/Bytes formatting
- Real-time storage display (updates every 5s)
- Freed space calculation after cleanup

### 7.5 Build System Integration

**Electron Builder:**
- DMG creation for macOS
- App directory creation
- Automated installation to Applications folder
- Build progress streaming
- Real-time log output

**Build Commands:**
- `npm run electron:dev` - Development mode
- `npm run electron:build` - Full build
- `npm run electron:build:mac` - macOS DMG
- `npm run electron:build:mac:app` - macOS app directory

### 7.6 Security Features

**File Validation:**
- Extension-based file type checking
- File size limits
- MIME type consideration (in form upload)
- Session ID validation
- URL validation for YouTube

**Path Security:**
- Path joining with `path.join()` to prevent traversal
- Session-scoped file access
- Temporary file cleanup

**Input Sanitization:**
- YouTube title special character removal
- File name sanitization
- JSON parsing error handling

### 7.7 Accessibility Features

- Label associations with form inputs
- Keyboard navigation support (radio groups, select)
- Icon + text for buttons
- Progress indicators
- Clear error messages
- Loading states

---

## 8. SUPPORTED MEDIA CODECS & STREAMING

### 8.1 Video Codecs

**Input Support (via FFmpeg):**
- H.264/AVC
- H.265/HEVC
- VP8/VP9
- AV1
- MPEG-2
- MPEG-4

**Output Video Codec:**
- H.264 (libx264)
- Settings: CRF 23, fast preset, 5000k bitrate

**Output Audio Codec:**
- AAC (for video outputs)
- Settings: 192k bitrate
- LibMP3Lame MP3 (for audio-only)
- PCM (WAV output)

### 8.2 Container Formats

**Supported Output:**
- MP4 (.mp4) with faststart flag
- MOV (.mov) QuickTime format
- WAV (.wav) uncompressed
- MP3 (.mp3) MPEG audio
- MKV (.mkv) Matroska
- AVI (.avi) Windows video

### 8.3 FFmpeg Configuration

**Video Encoding Parameters:**
```
Codec: libx264
Bitrate: 5000k (video), 192k (audio)
Preset: fast
CRF: 23 (quality scale)
Max Muxing Queue: 9999
```

**Audio Encoding Parameters:**
```
For MP4/MOV: AAC, 192k
For MP3: libmp3lame, 192k
For WAV: PCM (16-bit)
```

**Merge Filter Complex:**
- Concat filter for multiple inputs
- Video and audio stream mapping
- Automatic stream selection

---

## 9. DATA FLOW & ARCHITECTURE

### 9.1 File Upload Flow

1. User selects file via FileUploader component
2. File validation (size, type)
3. FormData created with file + sessionId
4. POST to `/api/upload` endpoint
5. Formidable parses streaming request
6. File saved to `tmp/uploads/{sessionId}/`
7. File metadata returned to client
8. Progress updated in store

### 9.2 Conversion Flow (Media)

1. User selects format and clicks convert
2. Files uploaded via `/api/upload`
3. FormData sent to `/api/media/convert`
4. SSE stream established
5. FFmpeg conversion per file
6. Progress events streamed to client
7. Converted files saved to `public/downloads/{sessionId}/`
8. Download URLs returned in SSE
9. Client displays download link

### 9.3 Document Conversion Flow

1. User selects files and output format
2. Conversion matrix validation
3. Files uploaded via `/api/upload`
4. FormData sent to `/api/document/convert`
5. SSE stream for progress
6. Document converter routes based on format pair
7. Intermediate formats created if needed (e.g., DOCX → HTML → PDF)
8. Output saved to `public/downloads/{sessionId}/`
9. Download URLs returned

### 9.4 Merge Flow

**Media Merge:**
1. Multiple files selected
2. Files uploaded
3. Codec compatibility check via ffprobe
4. Fast merge or re-encode selected
5. FFmpeg concat or filter complex applied
6. Single output file created
7. Download URL provided

**Document Merge:**
1. Multiple PDFs selected with reordering
2. Files uploaded
3. pdf-lib creates new document
4. Pages copied from each PDF in order
5. Single output PDF created
6. Download URL provided

### 9.5 Split Flow

**Media Split by Timepoints:**
1. Single file uploaded
2. Duration retrieved via ffprobe
3. Timepoints converted to seconds
4. Segment duration calculated
5. FFmpeg codec copy for each segment
6. Individual segment files created
7. Output URLs provided

**Document Split:**
1. PDF uploaded
2. Page count retrieved
3. Ranges validated against page count
4. pdf-lib extracts each range
5. Individual PDFs created per range
6. Download URLs provided

---

## 10. STORAGE & PERFORMANCE CHARACTERISTICS

### 10.1 File Size Limits

- Individual file upload: 50GB (formidable config)
- Total project: No enforced limit
- Temporary storage: Auto-cleanup enabled
- Download folder: Accessible via UI

### 10.2 Conversion Performance

**Media Conversion Speed:**
- H.264 encoding: ~5 Mbps output per core
- Duration: Depends on file size and codec
- Example: 100MB file → ~20-60 seconds

**Media Merge Performance:**
- Fast mode (codec copy): 100-500 Mbps (no encoding)
- Re-encode mode: 5-50 Mbps (depends on settings)
- Time: Near-linear with file size in fast mode

**Document Conversion Performance:**
- PDF to HTML: < 1 second (pure text extraction)
- DOCX to PDF: 1-5 seconds (HTML intermediate)
- HTML to PDF: 2-10 seconds (rendering)
- All operations: Single-file processing

### 10.3 Memory Management

- FFmpeg streaming (not in-memory files)
- Upload streaming (formidable)
- SSE for progress (no buffering)
- Automatic session cleanup
- No persistent file caching

---

## 11. CONFIGURATION & ENVIRONMENT VARIABLES

**Key Environment Variables:**
- `FFMPEG_PATH` - FFmpeg binary location (default: /opt/homebrew/bin/ffmpeg)
- `FFPROBE_PATH` - FFprobe binary location (default: /opt/homebrew/bin/ffprobe)
- `NEXT_PUBLIC_MAX_FILE_SIZE` - Max upload size in bytes (default: 524288000 = 500MB)

**Build Configuration:**
- electron-builder.yml for DMG/app builds
- next.config.js for Next.js settings
- tailwind.config.ts for styling

---

## 12. SUMMARY TABLE: All Conversion Types

| Category | From | To | Supported | Method |
|----------|------|----|-----------|----|
| **Media** | Any | MP4 | Yes | FFmpeg H.264 |
| **Media** | Any | MP3 | Yes | FFmpeg MP3 |
| **Media** | Any | MOV | Yes | FFmpeg H.264 |
| **Media** | Any | WAV | Yes | FFmpeg PCM |
| **Media** | Any | AVI | Yes | FFmpeg |
| **Media** | Any | MKV | Yes | FFmpeg |
| **Document** | PDF | HTML | Yes | PDF-lib + text stub |
| **Document** | PDF | Markdown | Yes | PDF-lib + text stub |
| **Document** | DOCX | PDF | Yes | Mammoth + html-pdf-node |
| **Document** | DOCX | HTML | Yes | Mammoth |
| **Document** | DOCX | Markdown | Yes | Mammoth + regex |
| **Document** | HTML | PDF | Yes | html-pdf-node |
| **Document** | HTML | DOCX | Yes | docx + text strip |
| **Document** | HTML | Markdown | Yes | regex parsing |
| **Document** | Markdown | PDF | Yes | marked + html-pdf-node |
| **Document** | Markdown | HTML | Yes | marked |
| **Document** | Markdown | DOCX | Yes | docx + parsing |
| **YouTube** | URL | MP4 | Yes | ytdl-core + FFmpeg |
| **YouTube** | URL | MP3 | Yes | ytdl-core + FFmpeg |
| **Operations** | N Files | Merged | Yes | FFmpeg concat/filter |
| **Operations** | 1 File | N Segments | Yes | FFmpeg split |
| **Operations** | N PDFs | 1 PDF | Yes | pdf-lib merge |
| **Operations** | 1 PDF | N PDFs | Yes | pdf-lib split |

---

## 13. COMPONENT TREE

```
App (page.tsx)
├── MainLayout
│   ├── Header
│   ├── Tabs (7 total)
│   │   ├── YouTubeTab
│   │   │   ├── FileUploader (hidden, URL input)
│   │   │   ├── ProgressBar
│   │   │   └── LogViewer
│   │   ├── MediaConvertTab
│   │   │   ├── FileUploader
│   │   │   ├── Select (format)
│   │   │   ├── ProgressBar
│   │   │   └── LogViewer
│   │   ├── MediaSplitTab
│   │   │   ├── FileUploader
│   │   │   ├── RadioGroup (mode)
│   │   │   ├── TimeInput (repeated)
│   │   │   ├── ProgressBar
│   │   │   └── LogViewer
│   │   ├── MediaMergeTab
│   │   │   ├── FileUploader
│   │   │   ├── SortableFileItem (repeated, dnd-kit)
│   │   │   ├── Select (format)
│   │   │   ├── Checkbox (reencode)
│   │   │   ├── ProgressBar
│   │   │   └── LogViewer
│   │   ├── DocumentConvertTab
│   │   │   ├── FileUploader
│   │   │   ├── Select (format)
│   │   │   ├── ProgressBar
│   │   │   └── LogViewer
│   │   ├── DocumentMergeTab
│   │   │   ├── FileUploader
│   │   │   ├── SortableFileItem (repeated)
│   │   │   ├── ProgressBar
│   │   │   └── LogViewer
│   │   └── DocumentSplitTab
│   │       ├── FileUploader
│   │       ├── Input (page ranges)
│   │       ├── ProgressBar
│   │       └── LogViewer
│   ├── ProjectFilesDialog
│   └── Footer
└── Session Recovery Banner (conditional)
    ├── Button (Restore)
    └── Button (New Session)
```

---

## 14. THIRD-PARTY DEPENDENCIES USED

**Core Framework:**
- next@15.0.0
- react@18.3.0
- react-dom@18.3.0

**Audio/Video Processing:**
- fluent-ffmpeg@2.1.3
- @distube/ytdl-core@4.16.12

**Document Processing:**
- pdf-lib@1.17.1
- pdfkit@0.17.2
- mammoth@1.11.0
- docx@9.5.1
- marked@17.0.1
- xlsx@0.18.5
- html-pdf-node@1.0.8
- inline-css@4.0.3
- extract-css@3.0.2

**UI Components:**
- @radix-ui/* (checkbox, label, progress, radio-group, scroll-area, select, separator, slot, tabs, toast)
- lucide-react@0.344.0

**Utilities:**
- uuid@10.0.0
- date-fns@3.0.0
- clsx@2.1.0
- tailwind-merge@2.2.0
- class-variance-authority@0.7.0
- tailwindcss-animate@1.0.7

**Drag & Drop:**
- @dnd-kit/core@6.3.1
- @dnd-kit/sortable@10.0.0
- @dnd-kit/utilities@3.2.2

**File Upload:**
- react-dropzone@14.2.3
- formidable@3.5.4

**State Management:**
- zustand@4.4.7

**Build/Dev Tools:**
- electron@39.2.6
- electron-builder@26.0.12
- typescript@5
- tailwindcss@3.4.0
- autoprefixer@10.0.1
- postcss@8
- eslint@8

---

## 15. RUNTIME ENVIRONMENTS

**Frontend:**
- Browser environment (Next.js with React)
- Electron environment detection
- Toast notification system
- Local storage for session restoration

**Backend:**
- Node.js runtime (Next.js API routes)
- Server-Sent Events (SSE) for streaming
- FFmpeg system binary execution
- File system operations
- Stream-based processing

**Desktop:**
- Electron runtime for app packaging
- Native file system access
- Directory opening via native APIs
- App installation to Applications folder

