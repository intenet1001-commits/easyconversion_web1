# easyconversion_web1 Context

## Project
Next.js file conversion web app. Port: **9005**.

## Dev Setup
```bash
npm install    # node_modules 없으면 port 미오픈 — 반드시 먼저 실행
npm run dev    # http://localhost:9005
```

## File Size Limits
두 곳이 독립적으로 존재 — 한 곳만 올리면 나머지가 막음:
- `lib/file-validator.ts`: `NEXT_PUBLIC_MAX_FILE_SIZE` 기본값 → **100GB** (107374182400)
- `app/api/upload/route.ts`: formidable `maxFileSize` → **100GB**

환경변수 `NEXT_PUBLIC_MAX_FILE_SIZE`로 재정의 가능.

## Key Paths
- 업로드 API: `app/api/upload/route.ts`
- 파일 검증: `lib/file-validator.ts`
- 업로드 컴포넌트: `components/common/FileUploader.tsx` (기본 50GB dropzone)

## Electron Build

### Build Command
UI에서 빌드 버튼 클릭 또는:
```bash
npx electron-builder --mac dmg   # Next.js 빌드 후 DMG 생성
```

### Prerequisites
- `build/icon.icns` 반드시 존재 (없으면 빌드 중단)

### Known Issues & Fixes

**canvas 호환성 (Electron 39 + V8)**
- canvas 2.x: `v8::Context::GetIsolate()` API 제거로 컴파일 실패
- `package.json` overrides로 canvas 3.2.3 강제 적용 중 (변경 금지)

**DMG 크기 폭증 방지**
- `public/downloads/`에 사용자 파일이 쌓이면 DMG에 포함 → 수 GB 증가
- `electron-builder.yml` files 섹션에서 명시 제외 중
- `node_modules/**/*`를 files에 추가하면 devDeps까지 전부 포함됨 — 제거 유지

**런타임 downloads 디렉토리**
- 패키지 앱에서 `public/downloads/` 자동 생성 로직 미구현 (TODO)

**Electron 다운로드: anchor click 방식 사용 금지**
- Next.js static files는 `Content-Disposition: attachment` 헤더가 없음
- Electron에서 `<a href=...>.click()` 방식은 다운로드가 아닌 페이지 내비게이션으로 처리됨
- **해결**: `lib/download.ts`의 `downloadFileFromUrl(url, filename)` 유틸 사용
  - `fetch()` → blob → `URL.createObjectURL()` → anchor click 순서로 처리
  - 모든 탭 컴포넌트(`components/tabs/*.tsx`)에서 이 유틸을 통해 다운로드
