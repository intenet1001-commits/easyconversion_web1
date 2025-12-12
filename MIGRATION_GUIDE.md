# EasyConversion: Electron to Tauri Migration Guide

## Overview

This document outlines the migration path from **Electron + Next.js** to **Tauri + React/Vite** for the EasyConversion application.

---

## Phase 1: Analysis & Planning

### Current Architecture Assessment

**Strengths of Current Setup:**
- Clean separation between frontend (React) and backend (Node.js)
- Most IPC communication is HTTP-based (easier to port)
- Well-organized component structure with Zustand state management
- Clear API route structure that maps directly to Tauri commands

**Pain Points to Address:**
- Large dependency tree (Next.js, 200+ npm packages)
- File serving mechanism (public/downloads) needs reimplementation
- Streaming progress updates (SSE) need command-based equivalent
- FFmpeg binary path hardcoded to macOS path

---

## Phase 2: Setup & Infrastructure

### Step 1: Initialize Tauri Project

```bash
# Create new Tauri project (if starting fresh)
npm create tauri-app@latest

# Or in existing project:
npm install @tauri-apps/cli
npm install @tauri-apps/api
```

### Step 2: Preserve React Frontend

**Files to Copy/Adapt:**
- `/components/*` → Keep as-is (100% compatible with Vite)
- `/lib/*` → Keep business logic (mostly)
- `/store/useConversionStore.ts` → Zustand works in Tauri
- `/types/*` → All TypeScript types work
- Tailwind CSS config → Copy to Tauri project
- Global CSS files

**What Changes:**
- `/app/page.tsx` → New `/src/App.tsx` (single-page app)
- `/app/layout.tsx` → Merge into main layout
- CSS/Tailwind → Keep configuration, update imports

### Step 3: Configure Tauri

**File: `src-tauri/tauri.conf.json`**

```json
{
  "appId": "com.easyconversion.app",
  "productName": "EasyConversion",
  "build": {
    "devPath": "http://localhost:5173",
    "distDir": "../dist",
    "withGlobalTauri": false
  },
  "fs": {
    "scope": [
      "$APPDATA/**",
      "$APPCACHE/**",
      "$APPDOCUMENTS/**",
      "$APPDOWNLOADS/**",
      "$HOME/Downloads/**",
      "/tmp/**"
    ]
  },
  "shell": {
    "open": true,
    "execute": true
  }
}
```

---

## Phase 3: Backend Migration

### API Routes → Tauri Commands

**Pattern Change:**

```typescript
// BEFORE (Next.js API Route)
// /app/api/media/convert/route.ts
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const formData = await request.formData();
  
  const stream = new ReadableStream({
    async start(controller) {
      // ... streaming logic
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({...})}\n\n`));
      controller.close();
    },
  });
  
  return new Response(stream, { ... });
}

// AFTER (Tauri Command)
// src-tauri/src/commands/media.rs
#[tauri::command]
pub async fn convert_media(
    input_path: String,
    output_path: String,
    format: String,
    window: tauri::Window,
) -> Result<String, String> {
    // ... FFmpeg logic
    // Send progress updates via window.emit()
    window.emit("conversion-progress", progress_data)?;
    Ok(output_path)
}
```

### File Management Strategy

**Option 1: Built-in Static File Serving (Recommended)**

```rust
// Use Tauri's built-in file serving for /public/downloads
// Configure in tauri.conf.json for static assets
```

**Option 2: Custom HTTP Handler**

```rust
// Spawn local HTTP server on separate port for file serving
// Similar to Next.js but with explicit control
```

### Session Management

```typescript
// Keep localStorage for session data
const sessionId = localStorage.getItem('sessionId') || generateSessionId();

// Configure Tauri file scope to allow tmp/uploads and public/downloads
// Update paths in commands to use proper Tauri APIs

// Use @tauri-apps/api/fs for file operations
import { writeTextFile, readDir } from '@tauri-apps/api/fs';
```

---

## Phase 4: Core Functionality Migration

### 4.1 Media Conversion (FFmpeg)

**Current Issues to Fix:**
- Hardcoded FFmpeg path: `/opt/homebrew/bin/ffmpeg`
- Need cross-platform support

**Migration Steps:**

```rust
// src-tauri/src/ffmpeg.rs
use std::process::Command;
use tauri::State;

#[tauri::command]
pub async fn convert_media(
    input_path: String,
    output_path: String,
    format: String,
    window: tauri::Window,
) -> Result<(), String> {
    // Detect FFmpeg path cross-platform
    let ffmpeg_path = get_ffmpeg_path()?;
    
    let mut cmd = Command::new(&ffmpeg_path)
        .arg("-i").arg(&input_path)
        // ... codec args
        .arg(&output_path)
        .spawn()
        .map_err(|e| e.to_string())?;
    
    // Track progress via process output
    let status = cmd.wait().map_err(|e| e.to_string())?;
    
    if status.success() {
        window.emit("conversion-complete", &output_path)?;
        Ok(())
    } else {
        Err("Conversion failed".to_string())
    }
}

fn get_ffmpeg_path() -> Result<String, String> {
    // Try common installation paths
    #[cfg(target_os = "macos")]
    let paths = vec![
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
    ];
    
    #[cfg(target_os = "windows")]
    let paths = vec!["ffmpeg.exe"];
    
    #[cfg(target_os = "linux")]
    let paths = vec!["/usr/bin/ffmpeg"];
    
    for path in paths {
        if std::path::Path::new(path).exists() {
            return Ok(path.to_string());
        }
    }
    Err("FFmpeg not found".to_string())
}
```

### 4.2 Document Conversion

These libraries work in Node.js/JavaScript directly:

- `pdf-lib` ✓ Works as-is
- `mammoth` ✓ Works as-is
- `docx` ✓ Works as-is
- `marked` ✓ Works as-is
- `html-pdf-node` ✓ Works as-is

**Migration Path:**

```typescript
// Keep all conversion logic in TypeScript
// Create Tauri commands that call these libraries

import { convertDocument } from '@/lib/document-converter';

#[tauri::command]
pub async fn convert_doc(
    input_path: String,
    output_path: String,
    input_format: String,
    output_format: String,
) -> Result<String, String> {
    // Call JavaScript library from Rust
    // Or keep in JavaScript and invoke from frontend
}
```

### 4.3 YouTube Download

**Current Setup:**
- Uses `@distube/ytdl-core` (JavaScript library)
- Works in Node.js and browser (with CORS workarounds)

**Migration Options:**

Option A: Keep in JavaScript
```typescript
// Invoke from frontend directly or via command
#[tauri::command]
pub async fn youtube_info(url: String) -> Result<VideoInfo, String> {
    // Call JavaScript function
}
```

Option B: Use Rust alternative
```rust
// Consider youtube-dl or youtube-rs crate for Rust
// More control over cross-platform compatibility
```

### 4.4 File Upload & Streaming

**Before (Next.js Formidable):**
```typescript
const form = formidable({ uploadDir: uploadDir, ... });
const [fields, files] = await form.parse(nodeReq);
```

**After (Tauri):**
```typescript
// Use Tauri's built-in file drop handling
// Or implement manual file reading with progress tracking

// frontend: Drop files on window → invoke command
// backend: Receive file path from OS, process with Rust/Node

#[tauri::command]
pub async fn process_upload(
    file_paths: Vec<String>,
    session_id: String,
) -> Result<Vec<FileInfo>, String> {
    // Process files with Tauri fs API
}
```

---

## Phase 5: UI & Communication Layer

### Event System

**Replace SSE with Tauri Events:**

```typescript
// Before: Server-Sent Events
const reader = response.body?.getReader();
const decoder = new TextDecoder();
// ... complex streaming logic

// After: Tauri Events
import { listen } from '@tauri-apps/api/event';

const unlisten = await listen('conversion-progress', (event) => {
    console.log('Progress:', event.payload);
    // Update UI
});
```

### IPC Communication

**New Commands Structure:**

```typescript
// src-tauri/src/commands/mod.rs
pub mod media;
pub mod document;
pub mod youtube;
pub mod system;
pub mod files;

// In main.rs:
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        media::convert_media,
        media::split_media,
        media::merge_media,
        document::convert_doc,
        youtube::download_video,
        system::open_folder,
        files::list_files,
        // ... more
    ])
```

### Frontend Command Invocation

```typescript
// Replace HTTP calls with Tauri invoke

// Before:
const response = await fetch('/api/media/convert', {
    method: 'POST',
    body: formData,
});

// After:
import { invoke } from '@tauri-apps/api/tauri';

const result = await invoke('convert_media', {
    inputPath: filePath,
    outputPath: outputPath,
    format: selectedFormat,
});
```

---

## Phase 6: File Management

### Directory Structure

```
src-tauri/
├── src/
│   ├── main.rs          - App entry point
│   ├── lib.rs
│   ├── commands/
│   │   ├── mod.rs
│   │   ├── media.rs     - Media conversion commands
│   │   ├── document.rs  - Document conversion
│   │   ├── youtube.rs   - YouTube download
│   │   ├── system.rs    - System operations
│   │   └── files.rs     - File management
│   └── utils/
│       ├── ffmpeg.rs    - FFmpeg integration
│       └── paths.rs     - Path utilities
└── Cargo.toml

src/
├── components/          - React components (unchanged)
├── lib/                 - TypeScript utilities (mostly unchanged)
├── store/               - Zustand store (unchanged)
├── App.tsx              - Main app component
├── main.tsx             - React entry point
└── index.css            - Global styles
```

### Temporary & Output Files

```rust
// Use Tauri's standard directories
use tauri::api::path;

let cache_dir = path::cache_dir().join("easyconversion");
let downloads_dir = path::download_dir();

// Set up paths in app initialization
#[tauri::command]
pub fn get_app_paths() -> Result<AppPaths, String> {
    Ok(AppPaths {
        cache: cache_dir.to_string_lossy().to_string(),
        downloads: downloads_dir.to_string_lossy().to_string(),
        temp: std::env::temp_dir().to_string_lossy().to_string(),
    })
}
```

---

## Phase 7: Build & Distribution

### Tauri Build Configuration

**Replace `electron-builder.yml` with `tauri.conf.json`:**

```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "beforeDevCommand": "npm run dev",
    "devPath": "http://localhost:5173",
    "distDir": "../dist"
  },
  "tauri": {
    "bundle": {
      "active": true,
      "targets": ["dmg", "zip"],
      "macOS": {
        "frameworks": []
      },
      "windows": ["nsis", "zip"],
      "linux": ["appimage", "deb"]
    }
  }
}
```

### Build Commands

```bash
# Development
npm run tauri dev

# Build for distribution
npm run tauri build

# Platform-specific
npm run tauri build -- --target universal-apple-darwin  # macOS universal
npm run tauri build -- --target x86_64-pc-windows-msvc  # Windows
npm run tauri build -- --target x86_64-unknown-linux-gnu # Linux
```

---

## Migration Timeline

### Week 1: Foundation
- [ ] Set up Tauri project scaffold
- [ ] Copy React components and prepare for Vite
- [ ] Set up TypeScript configuration
- [ ] Configure Tauri file permissions

### Week 2: Core Features
- [ ] Migrate media conversion to Tauri commands
- [ ] Implement FFmpeg path detection
- [ ] Set up event system for progress updates
- [ ] Test basic conversion flow

### Week 3: Advanced Features
- [ ] Document conversion (mostly TypeScript)
- [ ] YouTube download integration
- [ ] File upload and streaming
- [ ] Session management update

### Week 4: Polish & Testing
- [ ] System operations (open folder, etc.)
- [ ] Build system setup
- [ ] Cross-platform testing
- [ ] Performance optimization

---

## Testing Strategy

### Unit Tests
```typescript
// Keep existing logic tests
// Update mock APIs to use Tauri invoke patterns
```

### Integration Tests
```rust
// Test Tauri commands
// Test file I/O operations
// Test FFmpeg integration
```

### E2E Tests
```typescript
// Test full conversion workflows
// Verify UI updates with events
// Test cross-platform functionality
```

---

## Risk & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| FFmpeg binary availability | High | Implement robust path detection, bundle with app if needed |
| Large file handling | High | Test 50GB files, optimize streaming |
| YouTube library changes | Medium | Have backup library option ready |
| Cross-platform differences | Medium | Extensive testing on each platform |
| Performance regression | Medium | Profile and optimize hot paths |
| Breaking API changes | Low | Lock dependency versions, test regularly |

---

## Success Criteria

- All 7 feature tabs functional
- All conversion formats working
- Progress tracking working smoothly
- File management operational
- Cross-platform builds successful
- Performance equivalent or better than Electron version
- Smaller bundle size than current Electron app

---

## Resources & References

- **Tauri Docs:** https://tauri.app/v1/guides/
- **Tauri Commands:** https://tauri.app/v1/guides/features/command/
- **File System:** https://tauri.app/v1/api/js/modules/fs/
- **Events:** https://tauri.app/v1/api/js/classes/event.EventTarget/

---

## Post-Migration Improvements

Once fully migrated:

1. **Performance:** Rust backend will be faster than Node.js
2. **Security:** Explicit permission scopes
3. **Bundle Size:** ~50-70% smaller than Electron
4. **Memory Usage:** Significantly reduced
5. **Startup Time:** Much faster app launch
6. **Native Integration:** Better OS-level integration

