#!/bin/bash
# APK 파일 정리 스크립트

echo "🗂️  APK 파일 정리 시작..."

# 백업 디렉토리 생성
BACKUP_DIR="$HOME/Desktop/one-touch-map-apk-backup-$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

echo "📦 백업 위치: $BACKUP_DIR"

# APK 파일 이동
cd /Users/mac/Documents/GitHub/one-touch-map
mv *.apk "$BACKUP_DIR/" 2>/dev/null

echo "✅ APK 파일을 백업 폴더로 이동했습니다."
echo "📍 위치: $BACKUP_DIR"
echo ""
echo "Git에서 제거하려면 다음 명령을 실행하세요:"
echo "  cd /Users/mac/Documents/GitHub/one-touch-map"
echo "  git rm --cached *.apk"
echo "  git commit -m 'Remove APK files from repository'"
