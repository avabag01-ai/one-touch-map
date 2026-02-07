
import re

original_file = "map.html"

# 1. 파일 읽기
with open(original_file, 'r') as f:
    content = f.read()

# 2. 버튼 HTML 제거 (꼼꼼하게)
# gpsModeBtn 시작부터 닫는 태그까지 삭제
content = re.sub(r'\s*<button id="gpsModeBtn".*?</button>', '', content, flags=re.DOTALL)

# 3. JS 부분 교체 (아까처럼 573라인 이후를 싹 갈아엎음)
# 파일 내용을 줄 단위로 다시 나눔
lines = content.splitlines(keepends=True)

# 573줄까지만 살리고
kept_lines = lines[:573]
final_content = "".join(kept_lines)

# 4. 심플하고 빠른 JS 로직 추가
new_js = """        // ========================================
        // 📍 초고속 반응 GPS 트래킹 (최종)
        // ========================================
        let gpsMarker = null;
        let watchId = null;
        let isTracking = false;
        let isUserInteracting = false; 

        function setupInteractionListeners() {
            if(!map) return;
            const pause = () => { isUserInteracting = true; };
            const resume = () => { setTimeout(() => isUserInteracting = false, 2000); };
            map.on('movestart', pause); map.on('zoomstart', pause); map.on('dragstart', pause);
            map.on('moveend', resume); map.on('zoomend', resume); map.on('dragend', resume);
        }

        document.getElementById('locationBtn').addEventListener('click', toggleTracking);

        function toggleTracking() {
            const btn = document.getElementById('locationBtn');
            
            // 이미 마커가 있으면 즉시 이동 (딜레이 없음)
            if (gpsMarker) {
                const dist = map.distance(map.getCenter(), gpsMarker.getLatLng());
                if (dist > 5) {
                     const bearing = (map.getBearing && typeof map.getBearing === 'function') ? map.getBearing() : 0;
                     map.setView(gpsMarker.getLatLng(), 17, {animate: true, duration: 0.3, bearing: bearing});
                     if(!isTracking) { isTracking = true; btn.classList.add('active'); startWatch(); }
                     return;
                }
            }

            if (isTracking) {
                stopWatch();
                btn.classList.remove('active');
            } else {
                startWatch();
                btn.classList.add('active');
            }
        }

        function startWatch() {
            if (!navigator.geolocation) { alert('GPS 불가'); return; }
            isTracking = true;
            setupInteractionListeners();
            if (!gpsMarker) navigator.geolocation.getCurrentPosition(updatePosition, null, {enableHighAccuracy: true});
            if (watchId === null) watchId = navigator.geolocation.watchPosition(updatePosition, console.error, {enableHighAccuracy: true, maximumAge: 0});
        }

        function stopWatch() {
            if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
            isTracking = false;
        }

        function updatePosition(pos) {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            
            if (!map.getPane('gpsPane')) { map.createPane('gpsPane'); map.getPane('gpsPane').style.zIndex = 2000; map.getPane('gpsPane').style.pointerEvents = 'none'; }

            if (!gpsMarker) {
                const icon = L.divIcon({className: 'gps-pulse-icon', html: '<div class="gps-dot"></div><div class="gps-pulse"></div>', iconSize: [20, 20]});
                gpsMarker = L.marker([lat, lng], {icon: icon, pane: 'gpsPane'}).addTo(map);
            } else {
                gpsMarker.setLatLng([lat, lng]);
            }

            if (isTracking && !isUserInteracting) {
                const bearing = (map.getBearing && typeof map.getBearing === 'function') ? map.getBearing() : 0;
                map.setView([lat, lng], 17, {bearing: bearing, animate: true, duration: 0.2});
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            initMap(); 
            document.getElementById('layerToggleBtn').addEventListener('click', () => document.getElementById('layerFilter').classList.toggle('open'));
            map.on('click', () => document.getElementById('layerFilter').classList.remove('open'));
            
            const relBtn = document.createElement('button');
            relBtn.textContent = '지번정렬'; relBtn.className = 'location-btn';
            relBtn.style.bottom = '140px'; relBtn.style.fontSize = '12px'; relBtn.style.background = '#FF5252'; relBtn.style.color = 'white';
            relBtn.onclick = relocateAllMarkers;
            document.body.appendChild(relBtn);
        });
    </script>
</body>
</html>"""

# 5. 파일 저장
with open(original_file, 'w') as f:
    f.write(final_content + new_js)

print("Map file completely fixed (Button Removed + Fast GPS).")
