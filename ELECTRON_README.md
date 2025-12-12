# Electron 앱 빌드 가이드

EasyConversion을 macOS 네이티브 앱(.app 및 .dmg)으로 빌드하는 방법입니다.

## 필요 사항

- Node.js 및 npm 설치
- macOS (DMG 빌드용)
- FFmpeg 설치 (`brew install ffmpeg`)

## 개발 모드에서 실행

Electron 앱을 개발 모드로 실행하려면:

```bash
npm run electron:dev
```

이 명령은:
1. Next.js 개발 서버를 port 9005에서 시작
2. Electron 앱을 실행하여 Next.js 서버에 연결

## 프로덕션 빌드

### 1. Next.js 빌드 (선택사항)

먼저 Next.js를 빌드합니다:

```bash
npm run build
```

### 2. macOS .app 및 .dmg 생성

```bash
npm run electron:build:mac
```

빌드가 완료되면 `dist/` 폴더에 다음 파일이 생성됩니다:
- `EasyConversion-0.1.0-arm64.dmg` (Apple Silicon용)
- `EasyConversion-0.1.0-x64.dmg` (Intel Mac용)
- `.app` 파일들

### 3. 모든 플랫폼 빌드

```bash
npm run electron:build
```

## 아이콘 설정

프로덕션 빌드 전에 `build/` 폴더의 플레이스홀더 아이콘을 실제 아이콘으로 교체하세요:

- `build/icon.icns` - macOS용 (512x512 PNG를 변환)
- `build/icon.ico` - Windows용 (256x256 PNG를 변환)
- `build/icon.png` - Linux용 (512x512)

### 아이콘 생성 도구

PNG 이미지를 icns/ico로 변환하려면:

```bash
# macOS .icns 생성
brew install imagemagick
mkdir icon.iconset
sips -z 16 16   icon-512.png --out icon.iconset/icon_16x16.png
sips -z 32 32   icon-512.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32   icon-512.png --out icon.iconset/icon_32x32.png
sips -z 64 64   icon-512.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon-512.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon-512.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon-512.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon-512.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon-512.png --out icon.iconset/icon_512x512.png
cp icon-512.png icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o build/icon.icns
```

## 앱 구조

```
easyconversion_web1/
├── electron/
│   ├── main.js      # Electron 메인 프로세스 (Next.js 서버 시작)
│   └── preload.js   # Preload 스크립트 (보안)
├── build/           # 앱 아이콘
├── dist/            # 빌드된 앱 출력
├── .next/           # Next.js 빌드 결과
└── electron-builder.yml  # Electron Builder 설정
```

## 작동 원리

1. Electron의 main.js가 Next.js 서버를 자식 프로세스로 실행
2. 서버가 준비되면 (port 9005) Electron 윈도우 생성
3. 윈도우는 `http://localhost:9005`에 연결
4. 모든 API Routes와 서버 기능이 정상 작동 (FFmpeg, PDF 처리, SSE 등)
5. 앱 종료시 Next.js 서버도 함께 종료

## 주의사항

- **FFmpeg 필수**: 미디어 변환 기능을 위해 시스템에 FFmpeg 설치 필요
- **Node.js 런타임**: Electron은 Node.js를 포함하므로 모든 API Routes가 작동
- **개발 vs 프로덕션**:
  - 개발: `npm run dev` (Hot Reload)
  - 프로덕션: `npm run start` (최적화된 빌드)
- **보안**: preload.js는 contextIsolation을 사용하여 안전한 IPC 통신 제공

## 배포

생성된 DMG 파일을 사용자에게 배포:
1. `dist/` 폴더의 DMG 파일을 공유
2. 사용자가 DMG를 열고 애플리케이션 폴더로 드래그
3. 앱 실행

### 코드 서명 (선택사항)

macOS에서 앱 서명을 위해 Apple Developer 계정 필요:

```bash
export CSC_LINK=/path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password
npm run electron:build:mac
```

## 문제 해결

### 포트 9005가 이미 사용 중

```bash
lsof -ti:9005 | xargs kill -9
```

### FFmpeg를 찾을 수 없음

```bash
brew install ffmpeg
```

### 빌드 실패

```bash
# node_modules 재설치
rm -rf node_modules package-lock.json
npm install
npm run electron:build:mac
```
