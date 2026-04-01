#!/bin/bash
# Firebase 배포 스크립트
# .env에서 GEMINI_API_KEY를 읽어 public/index.html에 주입 후 배포

set -e

# .env 파일 로드
if [ ! -f .env ]; then
  echo "❌ .env 파일이 없습니다."
  exit 1
fi

export $(grep -v '^#' .env | xargs)

if [ -z "$GEMINI_API_KEY" ]; then
  echo "❌ .env에 GEMINI_API_KEY가 없습니다."
  exit 1
fi

# 템플릿에서 키 주입 → public/index.html 생성
sed "s|__GEMINI_API_KEY__|$GEMINI_API_KEY|g" public/index.template.html > public/index.html

echo "✅ public/index.html 생성 완료"

# Firebase 배포
firebase deploy

echo "🚀 배포 완료!"
