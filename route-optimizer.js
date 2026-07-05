// 배송 경로 최적화 모듈 (Route Optimizer)
// 기능: 현재 위치 기준 최단 경로 정렬, 주소 좌표 변환

// API 키는 config.js의 CONFIG.VWORLD_API_KEY 에서 가져옴 (없으면 fallback)
const VWORLD_API_KEY_OPT = (window.CONFIG && CONFIG.VWORLD_API_KEY) || '259F9CF5-8FAE-303B-8D16-A8F8B7B9C46D';

const RouteOptimizer = {
    // 메인 함수: 배송 리스트를 받아 최적화된 리스트를 반환
    async optimize(deliveries) {
        if (!deliveries || deliveries.length === 0) return deliveries;

        try {
            // 1. 현재 사용자 위치(GPS) 가져오기
            const currentPos = await this.getCurrentPosition();
            console.log('현재 위치:', currentPos);

            // 2. 좌표가 없는 배송지의 좌표 채우기
            await this.fillCoordinates(deliveries);

            // 3. 최단 경로 알고리즘 (Nearest Neighbor) 적용
            const sortedList = this.sortByNearest(currentPos, deliveries);

            return sortedList;

        } catch (error) {
            console.error('최적화 실패:', error);
            throw error;
        }
    },

    // 현재 위치 가져오기 (Promise)
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject('위치 정보를 사용할 수 없습니다.');
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        lat: pos.coords.latitude,
                        lng: pos.coords.longitude
                    });
                },
                (err) => {
                    console.warn('위치 확인 실패(기본값 사용):', err);
                    // 실패 시 VWorld 본사 근처(임시) 또는 첫 번째 배송지 근처로 설정
                    // 여기서는 에러를 던져서 알림을 주는 게 나음
                    reject('현재 위치를 찾을 수 없습니다. GPS를 켜주세요.');
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        });
    },

    // 좌표 없는 데이터 채우기
    async fillCoordinates(list) {
        let needSave = false;

        for (let item of list) {
            if (!item.lat || !item.lng) {
                // 좌표 검색
                const coords = await this.fetchVWorldCoord(item.fullAddress);
                if (coords) {
                    item.lat = coords.lat;
                    item.lng = coords.lng;
                    needSave = true;
                }
                // API 속도 제한 고려
                await new Promise(r => setTimeout(r, 100)); // 0.1초 딜레이
            }
        }

        return needSave;
    },

    // VWorld Geocoder API (JSONP 방식 - CORS 해결)
    // ✅ 전국 모드 지원: 특정 지역을 하드코딩하지 않고 주소 그대로 사용
    // ✅ 주소 유형 자동 판별: 도로명(로/길 포함)이면 ROAD 우선, 아니면 PARCEL 우선
    async fetchVWorldCoord(address) {
        if (!address) return null;

        // fullAddress 형식: "도로명주소/지번주소" 또는 "지번주소"
        // "/" 로 분리해서 도로명과 지번을 개별 시도
        const parts = address.split('/');
        const firstPart = parts[0] ? parts[0].trim() : null;
        const secondPart = parts[1] ? parts[1].trim() : null;

        // 주소 유형 자동 판별: 로/길/대로가 있으면 도로명
        const isRoadAddress = (addr) => addr && /[로길](\s|\d|$)|대로/.test(addr);

        let coords = null;

        if (parts.length >= 2 && firstPart && secondPart) {
            // "/" 구분자가 있으면: 도로명/지번 쌍
            // 도로명 파트를 ROAD로, 지번 파트를 PARCEL로 시도
            if (isRoadAddress(firstPart)) {
                coords = await this._fetchGeocode(firstPart, 'ROAD');
                if (!coords) coords = await this._fetchGeocode(secondPart, 'PARCEL');
            } else {
                coords = await this._fetchGeocode(secondPart, 'ROAD');
                if (!coords) coords = await this._fetchGeocode(firstPart, 'PARCEL');
            }
        } else {
            // 단일 주소: 유형 판별 후 적합한 타입 먼저 시도
            if (isRoadAddress(address)) {
                coords = await this._fetchGeocode(address, 'ROAD');
                if (!coords) coords = await this._fetchGeocode(address, 'PARCEL');
            } else {
                // 지번 주소 → PARCEL 먼저 (ROAD 먼저 하면 NOT_FOUND)
                coords = await this._fetchGeocode(address, 'PARCEL');
                if (!coords) coords = await this._fetchGeocode(address, 'ROAD');

                // 지번 검색 성공 시, ROAD 타입도 추가 시도하여 다른 도로명 후보 수집
                if (coords) {
                    const roadResult = await this._fetchGeocode(address, 'ROAD');
                    if (roadResult && roadResult.roadAddress && roadResult.roadAddress !== coords.roadAddress) {
                        if (!coords.roadCandidates) coords.roadCandidates = [];
                        if (coords.roadAddress) coords.roadCandidates.push(coords.roadAddress);
                        coords.roadCandidates.push(roadResult.roadAddress);
                    }
                }
            }
        }

        return coords;
    },

    // JSONP 기반 Geocoding (VWorld FAQ 권장 방식 - CORS 에러 없음)
    _fetchGeocode(address, type) {
        return new Promise((resolve) => {
            const callbackName = 'vworld_' + Date.now() + '_' + Math.round(Math.random() * 100000);
            const script = document.createElement('script');
            let completed = false;

            // 5초 타임아웃 (무한 대기 방지)
            const timeout = setTimeout(() => {
                if (!completed) {
                    completed = true;
                    cleanup();
                    console.warn('Geocoding timeout:', address);
                    resolve(null);
                }
            }, 5000);

            // 정리 함수
            const cleanup = () => {
                clearTimeout(timeout);
                delete window[callbackName];
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
            };

            // 콜백 함수
            window[callbackName] = function (data) {
                if (completed) return;
                completed = true;
                cleanup();

                if (data && data.response && data.response.status === 'OK' && data.response.result && data.response.result.point) {
                    const point = data.response.result.point;
                    const result = {
                        lat: parseFloat(point.y),
                        lng: parseFloat(point.x)
                    };
                    // API 응답에 도로명주소가 포함되어 있으면 함께 반환
                    // (역지오코딩보다 정확 — 좌표 오차로 옆 건물 주소 나오는 문제 방지)
                    const text = data.response.result.text;
                    if (text && /[로길]\s*\d/.test(text)) {
                        result.roadAddress = text;
                    }
                    resolve(result);
                } else {
                    resolve(null);
                }
            };

            // 에러 처리
            script.onerror = () => {
                if (completed) return;
                completed = true;
                cleanup();
                resolve(null);
            };

            // API 호출 (JSONP 방식)
            script.src = `https://api.vworld.kr/req/address?service=address&request=getcoord&version=2.0&crs=epsg:4326&address=${encodeURIComponent(address)}&refine=true&simple=false&format=json&type=${type}&key=${window.__VW_KEY__ || VWORLD_API_KEY_OPT}&callback=${callbackName}`;
            document.body.appendChild(script);
        });
    },

    // 최단 거리 정렬 (Greedy - Nearest Neighbor)
    sortByNearest(startPos, list) {
        // 좌표 있는 것과 없는 것 분리
        const validList = list.filter(d => d.lat && d.lng);
        const invalidList = list.filter(d => !d.lat || !d.lng);

        if (validList.length === 0) return list; // 정렬 불가

        const sorted = [];
        let currentPos = startPos;
        let unvisited = [...validList];

        while (unvisited.length > 0) {
            let nearestIndex = -1;
            let minDist = Infinity;

            // 가장 가까운 다음 지점 찾기
            for (let i = 0; i < unvisited.length; i++) {
                const dist = this.getDistance(
                    currentPos.lat, currentPos.lng,
                    unvisited[i].lat, unvisited[i].lng
                );

                if (dist < minDist) {
                    minDist = dist;
                    nearestIndex = i;
                }
            }

            if (nearestIndex !== -1) {
                // 선택된 지점을 결과 리스트로 이동
                const nextItem = unvisited.splice(nearestIndex, 1)[0];
                sorted.push(nextItem);

                // 현재 위치를 이동한 지점으로 업데이트 (거기서 또 다음 가까운 곳 찾기)
                currentPos = { lat: nextItem.lat, lng: nextItem.lng };
            } else {
                break;
            }
        }

        // 결과: 정렬된 리스트 + (좌표 없어서 정렬 못한 애들)
        return [...sorted, ...invalidList];
    },

    // 거리 계산 (Haversine Formula)
    getDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }
};
