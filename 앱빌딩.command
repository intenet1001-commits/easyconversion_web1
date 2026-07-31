#!/bin/bash

# 현재 스크립트가 있는 디렉토리로 이동
cd "$(dirname "$0")"

echo "================================================"
echo "  EasyConversion 앱 빌딩 스크립트"
echo "================================================"
echo ""

# 1. 실행 중인 프로세스 종료
echo "🔄 [1/6] 실행 중인 프로세스 종료 중..."
lsof -ti:9005 | xargs kill -9 2>/dev/null
pkill -9 -f "EasyConversion" 2>/dev/null
pkill -9 -f "electron.*easyconversion" 2>/dev/null
sleep 1
echo "✅ 프로세스 종료 완료"
echo ""

# 2. 기존 빌드 파일 정리
echo "🧹 [2/6] 기존 빌드 파일 정리 중..."
rm -rf .next .next-build
rm -rf dist/mac-arm64
rm -rf dist/*.blockmap
rm -f dist/builder-debug.yml
echo "✅ 정리 완료"
echo ""

# 3. Next.js 프로덕션 빌드
echo "🔨 [3/6] Next.js 프로덕션 빌드 시작..."
NODE_ENV=production npx next build
if [ $? -ne 0 ]; then
    echo "❌ Next.js 빌드 실패"
    exit 1
fi
echo "✅ Next.js 빌드 완료"
echo ""

# 4. (next.config.js가 NODE_ENV=production 시 .next-build를 distDir로 사용 — 복사 불필요)

# 5. Electron 앱 빌드
echo "🚀 [5/6] Electron 앱 빌드 시작..."
echo "    (이 과정은 3-5분 정도 소요됩니다)"
npx electron-builder --mac dmg
if [ $? -ne 0 ]; then
    echo "❌ Electron 빌드 실패"
    exit 1
fi
echo "✅ Electron 빌드 완료"
echo ""

# 6. 빌드 결과 확인
echo "📋 [6/6] 빌드 결과 확인..."
echo ""
VERSION=$(node -p "require('./package.json').version")
DMG_FILE="dist/EasyConversion-${VERSION}-arm64.dmg"
if [ -f "$DMG_FILE" ]; then
    DMG_SIZE=$(du -h "$DMG_FILE" | cut -f1)
    echo "✅ DMG 파일 생성 성공!"
    echo "   파일: $DMG_FILE"
    echo "   크기: $DMG_SIZE"
else
    echo "❌ DMG 파일을 찾을 수 없습니다. (예상 경로: $DMG_FILE)"
fi
echo ""

if [ -d "dist/mac-arm64/EasyConversion.app" ]; then
    APP_SIZE=$(du -sh "dist/mac-arm64/EasyConversion.app" | cut -f1)
    echo "✅ 앱 파일 생성 성공!"
    echo "   파일: dist/mac-arm64/EasyConversion.app"
    echo "   크기: $APP_SIZE"
else
    echo "❌ .app 파일을 찾을 수 없습니다."
fi
echo ""

echo "================================================"
echo "  빌드 완료!"
echo "================================================"
echo ""
echo "다음 명령어로 앱을 설치할 수 있습니다:"
echo "  open $DMG_FILE"
echo ""
echo "또는 Applications 폴더에 직접 복사:"
echo "  cp -R dist/mac-arm64/EasyConversion.app /Applications/"
echo ""

# 사용자 입력 대기 (터미널 자동 종료 방지)
read -p "아무 키나 눌러 종료..."
