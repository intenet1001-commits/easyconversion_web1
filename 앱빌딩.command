#!/bin/bash

# 현재 스크립트가 있는 디렉토리로 이동
cd "$(dirname "$0")"

echo "================================================"
echo "  EasyConversion 앱 빌딩 스크립트"
echo "================================================"
echo ""

# 1. 실행 중인 프로세스 종료
echo "🔄 [1/6] 실행 중인 프로세스 종료 중..."
killall -9 node 2>/dev/null
killall -9 EasyConversion 2>/dev/null
killall -9 electron 2>/dev/null
killall -9 electron-builder 2>/dev/null
sleep 2
echo "✅ 프로세스 종료 완료"
echo ""

# 2. 기존 빌드 파일 정리
echo "🧹 [2/6] 기존 빌드 파일 정리 중..."
rm -rf .next
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

# 4. .next 디렉토리 교체
echo "📦 [4/6] 빌드 파일 준비 중..."
rm -rf .next
cp -R .next-prod .next
echo "✅ 빌드 파일 준비 완료"
echo ""

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
if [ -f "dist/EasyConversion-0.1.0-arm64.dmg" ]; then
    DMG_SIZE=$(du -h "dist/EasyConversion-0.1.0-arm64.dmg" | cut -f1)
    echo "✅ DMG 파일 생성 성공!"
    echo "   파일: dist/EasyConversion-0.1.0-arm64.dmg"
    echo "   크기: $DMG_SIZE"
else
    echo "❌ DMG 파일을 찾을 수 없습니다."
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
echo "  open dist/EasyConversion-0.1.0-arm64.dmg"
echo ""
echo "또는 Applications 폴더에 직접 복사:"
echo "  cp -R dist/mac-arm64/EasyConversion.app /Applications/"
echo ""

# 사용자 입력 대기 (터미널 자동 종료 방지)
read -p "아무 키나 눌러 종료..."
