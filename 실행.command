#!/bin/bash

# 현재 스크립트의 디렉토리로 이동
cd "$(dirname "$0")"

echo "=================================="
echo "  EasyConversion 웹 서버 시작"
echo "=================================="
echo ""

# 포트 9005가 사용 중인지 확인
if lsof -Pi :9005 -sTCP:LISTEN -t >/dev/null ; then
    echo "⚠️  포트 9005가 이미 사용 중입니다."
    echo "기존 프로세스를 종료하고 다시 시작합니다..."
    lsof -ti:9005 | xargs kill -9 2>/dev/null
    sleep 2
fi

echo "🚀 Next.js 개발 서버를 시작합니다..."
echo ""

# 브라우저 자동 오픈 (3초 후 서버 준비되면)
sleep 5 && open http://localhost:9005 &

# npm run dev 실행
npm run dev

# 서버가 종료되면 메시지 표시
echo ""
echo "=================================="
echo "  서버가 종료되었습니다."
echo "=================================="
