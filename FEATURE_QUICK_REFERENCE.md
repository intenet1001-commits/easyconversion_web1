# EasyConversion Web1 - Feature Quick Reference

## Core Features At A Glance

### 1. YouTube Download
- **Formats:** MP4 (video+audio), MP3 (audio only)
- **API:** POST /api/youtube/download, /api/youtube/info
- **Quality:** Highest available (auto-selected)
- **Progress:** Real-time SSE streaming

### 2. Media Conversion
- **Input Formats:** MP4, MOV, AVI, MKV, WebM (any FFmpeg supported)
- **Output Formats:** MP4, MOV, AVI, MKV, MP3, WAV
- **Features:** Batch conversion, retry logic (2x), per-file progress
- **API:** POST /api/media/convert
- **Quality:** H.264 video (5000k), 192k audio, CRF 23 preset

### 3. Media Split
- **Methods:** By timepoints (HH:MM:SS) or equal segments
- **API:** POST /api/media/split
- **Speed:** Fast (codec copy, no re-encoding)
- **Output:** Multiple numbered files (part1, part2, etc.)

### 4. Media Merge
- **Input:** 2+ video/audio files with drag-and-drop reordering
- **Modes:** Fast (codec copy) or Re-encode (compatibility)
- **API:** POST /api/media/merge
- **Auto-detection:** Codec compatibility checking via ffprobe

### 5. Document Conversion
- **Formats:** PDF, DOCX, HTML, Markdown (PPTX listed but not implemented)
- **Conversions:** 11 supported pairs (see matrix below)
- **Features:** Batch conversion, progress tracking
- **API:** POST /api/document/convert

**Conversion Matrix:**
```
PDF    → HTML, Markdown
DOCX   → PDF, HTML, Markdown
HTML   → PDF, DOCX, Markdown
Markdown → PDF, HTML, DOCX
```

### 6. Document Merge
- **Type:** PDF only
- **Features:** Drag-and-drop reordering, page order preserved
- **API:** POST /api/document/merge
- **Speed:** Instant (no re-encoding)

### 7. Document Split
- **Type:** PDF only
- **Features:** Multiple page ranges, custom naming per range
- **API:** POST /api/document/split
- **Example:** Extract pages 1-5, 10-20, 30-35 from one PDF

### 8. File Management
- **Max size:** 50GB per file
- **Upload:** Streaming with formidable
- **Storage:** Session-based in tmp/uploads/{sessionId}
- **APIs:** /api/upload, /api/project-files/list, /api/project-files/delete

### 9. Session Management
- **Auto-create:** UUID on app start
- **Restore:** Previous session recovery on reload
- **Cleanup:** 24+ hour auto-cleanup, manual cleanup options
- **APIs:** /api/cleanup, /api/cleanup/auto, /api/cleanup/uploads

### 10. Build & Distribution
- **macOS:** DMG creation and installation
- **Format:** Electron packaging
- **APIs:** /api/build-dmg, /api/build-app

---

## Quick API Reference

| Endpoint | Method | Input | Output | Use Case |
|----------|--------|-------|--------|----------|
| /api/media/convert | POST | files, format | SSE stream | Convert audio/video |
| /api/media/split | POST | file, mode, params | SSE stream | Split audio/video |
| /api/media/merge | POST | files, format | SSE stream | Combine videos |
| /api/document/convert | POST | files, format | SSE stream | Convert documents |
| /api/document/merge | POST | files | JSON | Merge PDFs |
| /api/document/split | POST | file, ranges | JSON | Extract PDF pages |
| /api/youtube/download | POST | url, format | SSE stream | Download YouTube |
| /api/youtube/info | POST | url | JSON | Get video metadata |
| /api/upload | POST | files, sessionId | JSON | Upload files |
| /api/document/page-count | POST | sessionId, fileName | JSON | Get PDF page count |
| /api/project-files/list | GET | - | JSON | List all files |
| /api/project-files/delete | POST | sessionId, path | JSON | Delete file |
| /api/cleanup | POST | sessionId | JSON | Clean session |
| /api/cleanup/auto | GET/POST | - | JSON | Auto-cleanup old |
| /api/cleanup/uploads | GET/POST | - | JSON | Clear all uploads |
| /api/open-folder | POST | flag | JSON | Open folder |
| /api/build-dmg | POST | - | SSE stream | Build macOS DMG |
| /api/build-app | POST | - | SSE stream | Build Electron app |

---

## UI Tabs (7 Total)

1. **YouTube** - Download videos/audio from YouTube
2. **Media Convert** - Convert between audio/video formats
3. **Media Split** - Split video/audio into segments
4. **Media Merge** - Combine multiple videos/audio
5. **Doc Convert** - Convert between PDF/DOCX/HTML/Markdown
6. **Doc Merge** - Merge multiple PDFs
7. **Doc Split** - Extract page ranges from PDF

---

## File Format Support Summary

### Media Formats
**Input:** Any FFmpeg-supported format (MP4, MOV, AVI, MKV, WebM, MP3, WAV, etc.)
**Output:** MP4, MOV, AVI, MKV, MP3, WAV, WebM

### Document Formats
**Input:** PDF, DOCX, HTML, Markdown
**Output:** PDF, DOCX, HTML, Markdown

### YouTube Download
**Output:** MP4, MP3
**Quality:** Highest available

---

## Key Technical Details

### Performance
- **Media Encoding:** H.264 fast preset, ~5 Mbps per core
- **Merge Fast Mode:** 100-500 Mbps (codec copy)
- **Upload:** 50GB max, streaming
- **Timeout:** 30-second stuck detection + kill

### Error Handling
- **Retry Logic:** Up to 2 automatic retries with 2s delay
- **Validation:** File size, type, format compatibility
- **Feedback:** Real-time progress, detailed error messages

### Storage
```
tmp/uploads/{sessionId}/  - Working files
public/downloads/{sessionId}/ - Output files
Auto-cleanup: 24+ hours old sessions
```

### Security
- Extension validation
- Session-scoped file access
- Path traversal prevention
- Input sanitization

---

## Component Architecture

**Main Tabs:** 7 independent tab components
**State Management:** Zustand store (useConversionStore)
**UI Framework:** Radix UI + Tailwind CSS + Lucide Icons
**Drag-Drop:** @dnd-kit (for file reordering)
**File Upload:** react-dropzone + formidable

---

## Download & Installation

**Max File Size:** 50GB per file (configurable via env var)
**Batch Download:** Download multiple files sequentially
**Naming:** Custom file name on download or default generated name

---

## Environment Setup

**FFmpeg Paths:**
- Default macOS: /opt/homebrew/bin/ffmpeg
- Customizable: FFMPEG_PATH, FFPROBE_PATH env vars

**Server Timeout:** 5 minutes per request (300s)

---

## Feature Completeness

**Total Features:** 40+ distinct operations
**Supported Conversions:** 23 documented pairs
**API Endpoints:** 18 endpoints
**UI Components:** 28+ (including tabs, dialogs, forms)
**File Formats:** 10+ media, 4 document formats

---

## Session Features

- Auto-restore on reload
- Confirmation dialogs for destructive actions
- Real-time storage display
- File organization by session
- Progress tracking per operation
- Log viewer for all operations

---

**Last Updated:** 2025-12-09
**Project:** EasyConversion Web1 v0.1.0
**Location:** /Users/gwanli/Documents/GitHub/myproduct_v4/easyconversion_web1
