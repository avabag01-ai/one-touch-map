#!/usr/bin/env python3
# 간단한 웹 서버 - One-Touch Map 테스트용

import http.server
import socketserver
import os

PORT = 8888
DIRECTORY = "www"

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)
    
    def end_headers(self):
        # CORS 헤더 추가
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

if __name__ == '__main__':
    os.chdir('/Users/mac/Documents/GitHub/one-touch-map')
    
    print(f"\n🚀 One-Touch Map 웹 서버 시작")
    print(f"📂 디렉토리: {os.path.join(os.getcwd(), DIRECTORY)}")
    print(f"🌐 URL: http://localhost:{PORT}")
    print(f"🌐 메인 페이지: http://localhost:{PORT}/index.html")
    print(f"🌐 리스트: http://localhost:{PORT}/list.html")
    print(f"🌐 지도: http://localhost:{PORT}/map.html")
    print(f"🌐 설정: http://localhost:{PORT}/settings.html")
    print(f"\n⏹️  종료: Ctrl+C\n")
    
    with socketserver.TCPServer(("", PORT), MyHTTPRequestHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n\n👋 서버 종료")
