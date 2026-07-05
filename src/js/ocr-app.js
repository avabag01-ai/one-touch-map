// 주소빨리찾기 V2 - OCR (배송전표 최적화)

// 1. 설정 관리 - 동 약자 매핑 포함
function getDeliveryConfig() {
    const defaultDongs = ['전국코드', '중화동', '묵동', '망우동', '신내동', '면목동', '상봉동'];
    let savedDongs = defaultDongs;

    try {
        const saved = localStorage.getItem('deliverySettings');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.dongs && parsed.dongs.length > 0) {
                savedDongs = parsed.dongs;
            }
        }
    } catch (e) {
        console.error('설정 로드 실패', e);
    }

    // 동 약자 매핑 (배송전표 형식: 묵157-23 → 묵동 157-23)
    const dongNames = {};
    const shortMap = {};  // 1글자 약자 → 풀네임

    savedDongs.forEach(dong => {
        if (dong === '전국코드') return;
        const short1 = dong.substring(0, 1); // 묵, 중, 망, 신...
        const short2 = dong.substring(0, 2); // 묵동, 중화, 망우, 신내...

        dongNames[dong] = dong;     // 묵동 → 묵동
        dongNames[short2] = dong;   // 묵동 → 묵동
        dongNames[short1] = dong;   // 묵 → 묵동
        shortMap[short1] = dong;    // 묵 → 묵동
    });

    return {
        dongNames: dongNames,
        shortMap: shortMap,
        whitelist: '0123456789-., ' + Object.keys(shortMap).join('')
    };
}

// 2. OCR 실행
let worker = null;

async function recognizeAddress(blob) {
    const config = getDeliveryConfig();

    if (!worker) {
        worker = Tesseract.createWorker({
            logger: m => {}
        });
        await worker.load();
        await worker.loadLanguage('kor');
        await worker.initialize('kor');
    }

    await worker.setParameters({});

    const { data } = await worker.recognize(blob);
    console.log('OCR 원본 결과:', data.text);

    return parseDeliverySheet(data.text, config);
}

// 3. 배송전표 전용 파싱 (묵157-23, 중110-105 등) + 전화번호/용량 추출
function parseDeliverySheet(text, config) {
    const detectedItems = [];
    const lines = text.split('\n');

    // 동 약자 1글자 목록 (묵, 중, 망, 신, 면, 상...)
    const shortKeys = Object.keys(config.shortMap);
    // 동 약자 패턴: (묵|중|망|신|면|상)
    const shortPattern = shortKeys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');

    // 패턴1: 동약자+숫자-숫자 (묵157-23, 중110-105, 신409-3)
    const pattern1 = new RegExp(`(${shortPattern})\\s*(\\d+)\\s*[-\\s]\\s*(\\d+)`);
    // 패턴2: 동약자+숫자만 (묵235, 중330)
    const pattern2 = new RegExp(`(${shortPattern})\\s*(\\d{2,})`);

    // 전화번호 패턴: 010-1234-5678, 010 1234 5678, 01012345678 등
    const phonePattern = /01[016789][-.\s]?\d{3,4}[-.\s]?\d{4}/;
    // 용량(톤) 패턴: 0.5, 1.5, 2.5 등 소수점 숫자
    const tonnagePattern = /\b(\d{1,2}\.\d{1,2})\b/;

    // OCR 오인식 보정 (유사 글자 치환)
    const typoMap = {
        '종': '중', '증': '중', '충': '중', '즁': '중', '쫑': '중',
        '목': '묵', '뭇': '묵', '둑': '묵', '북': '묵',
        '방': '망', '맘': '망', '앙': '망',
        '산': '신', '씬': '신', '선': '신',
        '먼': '면', '민': '면',
        '상': '상', '쌍': '상'
    };

    const found = new Set();

    // === 줄 단위 파싱 (전화번호/용량을 주소와 매핑하기 위해) ===
    lines.forEach(rawLine => {
        let line = rawLine.trim();
        if (!line || line.length < 3) return;

        // 오타 보정 적용
        for (const [wrong, right] of Object.entries(typoMap)) {
            line = line.replace(new RegExp(wrong, 'g'), right);
        }

        // 전화번호 추출
        let phone = '';
        const phoneMatch = line.match(phonePattern);
        if (phoneMatch) {
            phone = phoneMatch[0].replace(/[-.\s]/g, '');  // 01012345678 형태로 정규화
            // 하이픈 넣기: 010-1234-5678
            if (phone.length === 11) {
                phone = phone.substring(0, 3) + '-' + phone.substring(3, 7) + '-' + phone.substring(7);
            } else if (phone.length === 10) {
                phone = phone.substring(0, 3) + '-' + phone.substring(3, 6) + '-' + phone.substring(6);
            }
        }
        // " (쌍따옴표) 는 동일번호 표시 - 이전 항목 전화번호 복사
        if (!phone && (line.includes('"') || line.includes('"') || line.includes('"'))) {
            if (detectedItems.length > 0) {
                const prev = detectedItems[detectedItems.length - 1];
                if (prev.phone) phone = prev.phone;
            }
        }

        // 용량(톤) 추출
        let tonnage = '';
        const tonnageMatch = line.match(tonnagePattern);
        if (tonnageMatch) {
            tonnage = tonnageMatch[1];
        }

        // 주소 추출 - 패턴1 (하이픈 있는 것)
        let match = line.match(pattern1);
        if (match) {
            const dongChar = match[1];
            const fullDong = config.shortMap[dongChar];
            if (fullDong) {
                const jibun = `${match[2]}-${match[3]}`;
                const key = `${fullDong}_${jibun}`;
                if (!found.has(key)) {
                    found.add(key);
                    detectedItems.push({
                        dong: fullDong,
                        jibun: jibun,
                        fullAddress: `${fullDong} ${jibun}`,
                        phone: phone,
                        tonnage: tonnage
                    });
                }
                return; // 이 줄은 처리 완료
            }
        }

        // 패턴2 (하이픈 없는 것)
        match = line.match(pattern2);
        if (match) {
            const dongChar = match[1];
            const fullDong = config.shortMap[dongChar];
            if (fullDong) {
                const num = match[2];
                const alreadyFound = detectedItems.some(item =>
                    item.dong === fullDong && item.jibun.startsWith(num)
                );
                if (!alreadyFound) {
                    const key = `${fullDong}_${num}`;
                    if (!found.has(key)) {
                        found.add(key);
                        detectedItems.push({
                            dong: fullDong,
                            jibun: num,
                            fullAddress: `${fullDong} ${num}`,
                            phone: phone,
                            tonnage: tonnage
                        });
                    }
                }
                return;
            }
        }
    });

    // 기존 풀네임 방식도 폴백으로 시도
    if (detectedItems.length === 0) {
        lines.forEach(rawLine => {
            let line = rawLine.trim();
            // 오타 보정
            for (const [wrong, right] of Object.entries(typoMap)) {
                line = line.replace(new RegExp(wrong, 'g'), right);
            }
            const cleanedLine = line.replace(/[\.\,]/g, ' ').replace(/\s+/g, ' ').trim();
            if (!cleanedLine) return;

            // 전화번호/용량 추출
            let phone = '';
            const phoneMatch = cleanedLine.match(phonePattern);
            if (phoneMatch) {
                phone = phoneMatch[0].replace(/[-.\s]/g, '');
                if (phone.length === 11) phone = phone.substring(0, 3) + '-' + phone.substring(3, 7) + '-' + phone.substring(7);
            }
            let tonnage = '';
            const tonnageMatch = cleanedLine.match(tonnagePattern);
            if (tonnageMatch) tonnage = tonnageMatch[1];

            let foundDong = null;
            const availableDongs = Object.keys(config.dongNames);
            for (const dong of availableDongs) {
                if (cleanedLine.includes(dong)) {
                    foundDong = config.dongNames[dong];
                    break;
                }
            }

            if (foundDong) {
                const afterDong = cleanedLine.split(foundDong)[1] || cleanedLine;
                const jibunMatch = afterDong.match(/(\d+)[\s-]*(\d*)/);
                if (jibunMatch) {
                    const num1 = jibunMatch[1];
                    const num2 = jibunMatch[2];
                    const jibun = num2 ? `${num1}-${num2}` : num1;
                    const key = `${foundDong}_${jibun}`;
                    if (!found.has(key)) {
                        found.add(key);
                        detectedItems.push({
                            dong: foundDong,
                            jibun: jibun,
                            fullAddress: `${foundDong} ${jibun}`,
                            phone: phone,
                            tonnage: tonnage
                        });
                    }
                }
            }
        });
    }

    console.log('파싱 결과:', detectedItems);
    return detectedItems;
}


// === UI 연동 ===

let scannedItems = [];

// 공통 OCR 이미지 처리 함수
async function processOcrImage(file) {
    if (typeof showToast === 'function') showToast('스캔 중... 📸');

    try {
        const resizedBlob = await preprocessImage(file, 1600);
        const results = await recognizeAddress(resizedBlob);

        if (results.length > 0) {
            scannedItems = [];
            results.forEach(item => {
                const exists = scannedItems.some(existing =>
                    existing.dong === item.dong && existing.jibun === item.jibun
                );
                if (!exists) {
                    scannedItems.push({
                        id: Date.now() + Math.random(),
                        dong: item.dong,
                        jibun: item.jibun,
                        checked: true,
                        phone: item.phone || '',
                        tonnage: item.tonnage || ''
                    });
                }
            });
            renderScannedList();
            openOcrModal();
        } else {
            if (typeof showToast === 'function') showToast('인식 실패. 다시 시도해주세요.');
            scannedItems = [{ id: Date.now(), dong: '묵동', jibun: '', checked: true }];
            renderScannedList();
            openOcrModal();
        }
    } catch (error) {
        console.error('OCR Error:', error);
        if (typeof showToast === 'function') showToast('에러 발생');
        if (worker) {
            await worker.terminate();
            worker = null;
        }
    }
}

function setupScanFeature() {
    const scanBtn = document.getElementById('scanBtn');
    const fileBtn = document.getElementById('fileBtn');
    const cameraInput = document.getElementById('cameraInput');
    const fileInput = document.getElementById('fileInput');
    const addManualBtn = document.getElementById('addManualBtn');
    const cancelScanBtn = document.getElementById('cancelScanBtn');
    const confirmScanBtn = document.getElementById('confirmScanBtn');

    const cropModal = document.getElementById('cropModal');
    if (cropModal) cropModal.style.display = 'none';

    // 촬영 버튼 - 카메라
    if (scanBtn && cameraInput) {
        scanBtn.addEventListener('click', () => {
            cameraInput.click();
        });
    }

    // 파일 버튼 - 갤러리/파일에서 선택
    if (fileBtn && fileInput) {
        fileBtn.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await processOcrImage(file);
            fileInput.value = '';
        });
    }

    if (cameraInput) {
        cameraInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            await processOcrImage(file);
            cameraInput.value = '';
        });
    }

    if (addManualBtn) addManualBtn.addEventListener('click', () => addScannedItem('묵동', ''));
    if (cancelScanBtn) cancelScanBtn.addEventListener('click', closeOcrModal);
    if (confirmScanBtn) confirmScanBtn.addEventListener('click', confirmRegistration);
}

function renderScannedList() {
    const container = document.getElementById('scannedList');
    container.innerHTML = '';

    const saved = localStorage.getItem('deliverySettings');
    let availableDongs = ['묵동', '중화동', '망우동', '신내동', '상봉동', '면목동'];
    if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dongs && parsed.dongs.length > 0) availableDongs = parsed.dongs.filter(d => d !== '전국코드');
    }

    // 헤더: 전체선택 + 인식 건수
    const header = document.createElement('div');
    header.className = 'scan-row scan-row-header';
    const allChecked = scannedItems.length > 0 && scannedItems.every(i => i.checked !== false);
    header.innerHTML = `
        <input type="checkbox" class="scan-check-all" ${allChecked ? 'checked' : ''}>
        <span class="scan-header-label">전체선택</span>
        <span class="scan-count">${scannedItems.length}건 인식됨</span>
    `;
    header.querySelector('.scan-check-all').addEventListener('change', (e) => {
        scannedItems.forEach(i => i.checked = e.target.checked);
        renderScannedList();
    });
    container.appendChild(header);

    scannedItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'scan-row';
        div.dataset.id = item.id;

        let options = availableDongs.map(d =>
            `<option value="${d}" ${item.dong === d ? 'selected' : ''}>${d}</option>`
        ).join('');

        div.innerHTML = `
            <input type="checkbox" class="scan-check" ${item.checked !== false ? 'checked' : ''}>
            <select class="scan-dong">${options}</select>
            <input type="text" class="scan-jibun" value="${item.jibun}" placeholder="123-45">
            <button class="btn-remove-item">X</button>
        `;

        div.querySelector('.scan-check').addEventListener('change', (e) => { item.checked = e.target.checked; });
        div.querySelector('.scan-dong').addEventListener('change', (e) => { item.dong = e.target.value; });
        div.querySelector('.scan-jibun').addEventListener('input', (e) => { item.jibun = e.target.value; });
        div.querySelector('.btn-remove-item').addEventListener('click', () => {
            scannedItems = scannedItems.filter(i => i.id !== item.id);
            renderScannedList();
        });

        container.appendChild(div);
    });
}

function addScannedItem(dong, jibun) {
    scannedItems.push({ id: Date.now(), dong: dong, jibun: jibun, checked: true, phone: '', tonnage: '' });
    renderScannedList();
    const c = document.getElementById('scannedList');
    setTimeout(() => { c.scrollTop = c.scrollHeight; }, 100);
}

function openOcrModal() { document.getElementById('ocrModal').style.display = 'flex'; }
function closeOcrModal() { document.getElementById('ocrModal').style.display = 'none'; }


// === 최종 저장 ===
async function confirmRegistration() {
    const validItems = scannedItems.filter(item => item.checked !== false && item.jibun.trim() !== '');

    if (validItems.length === 0) {
        closeOcrModal();
        return;
    }

    closeOcrModal();

    let deliveries = JSON.parse(localStorage.getItem('deliveries') || '[]');
    let newDeliveries = [];
    let updatedCount = 0;

    validItems.forEach(item => {
        const fullAddress = `${item.dong} ${item.jibun}`;
        const existing = deliveries.find(d => d.dong === item.dong && d.jibun === item.jibun);

        if (existing) {
            // 기존 항목이 있으면 전화번호/용량 업데이트
            let changed = false;
            if (item.phone && item.phone !== existing.phone) {
                existing.phone = item.phone;
                changed = true;
            }
            if (item.tonnage && item.tonnage !== existing.tonnage) {
                existing.tonnage = item.tonnage;
                changed = true;
            }
            if (changed) updatedCount++;
        } else {
            // 새 항목 추가
            newDeliveries.push({
                id: Date.now() + Math.random(),
                dong: item.dong,
                jibun: item.jibun,
                fullAddress: fullAddress,
                addressBefore: item.jibun,
                addressAfter: '',
                phone: item.phone || '',
                tonnage: item.tonnage || '',
                memo: '',
                priority: 'normal',
                status: 'pending',
                layer: 0,
                createdAt: new Date().toISOString().split('T')[0],
                lat: null, lng: null
            });
        }
    });

    // 새 항목을 맨 앞에 추가 (최신이 위로)
    if (newDeliveries.length > 0 || updatedCount > 0) {
        deliveries = [...newDeliveries, ...deliveries];
        localStorage.setItem('deliveries', JSON.stringify(deliveries));

        const msgs = [];
        if (newDeliveries.length > 0) msgs.push(`${newDeliveries.length}건 등록`);
        if (updatedCount > 0) msgs.push(`${updatedCount}건 업데이트`);
        if (typeof showToast === 'function') showToast(`${msgs.join(', ')} 완료!`);

        if (typeof RouteOptimizer !== 'undefined') {
            try {
                await RouteOptimizer.fillCoordinates(newDeliveries);
                localStorage.setItem('deliveries', JSON.stringify(deliveries));
            } catch (e) { console.warn('배경 좌표 변환 실패', e); }
        }
    } else {
        if (typeof showToast === 'function') showToast('이미 등록된 주소들입니다.');
    }

    if (typeof onDeliveriesUpdated === 'function') onDeliveriesUpdated();
}


// === 이미지 전처리 (흑백 + 명암대비 + 이진화 - 속도 최적화) ===
function preprocessImage(file, maxWidth) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function (e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function () {
                let w = img.width, h = img.height;
                // 해상도 줄여서 속도 개선 (1200px이면 충분)
                const mw = 1200;
                if (w > mw) { h = h * (mw / w); w = mw; }

                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                const imageData = ctx.getImageData(0, 0, w, h);
                const d = imageData.data;
                const len = d.length;

                // 1패스: 그레이스케일 + min/max 동시 계산
                let mn = 255, mx = 0;
                for (let i = 0; i < len; i += 4) {
                    const g = (d[i] * 77 + d[i+1] * 150 + d[i+2] * 29) >> 8;
                    d[i] = d[i+1] = d[i+2] = g;
                    if (g < mn) mn = g;
                    if (g > mx) mx = g;
                }

                // 2패스: 명암대비 + 히스토그램 동시
                const rng = mx - mn || 1;
                const hist = new Uint32Array(256);
                for (let i = 0; i < len; i += 4) {
                    const v = ((d[i] - mn) * 255 / rng) | 0;
                    d[i] = d[i+1] = d[i+2] = v;
                    hist[v]++;
                }

                // Otsu 임계값
                const total = w * h;
                let sum = 0;
                for (let i = 0; i < 256; i++) sum += i * hist[i];
                let sB = 0, wB = 0, maxV = 0, thr = 128;
                for (let t = 0; t < 256; t++) {
                    wB += hist[t];
                    if (wB === 0) continue;
                    const wF = total - wB;
                    if (wF === 0) break;
                    sB += t * hist[t];
                    const diff = sB / wB - (sum - sB) / wF;
                    const v = wB * wF * diff * diff;
                    if (v > maxV) { maxV = v; thr = t; }
                }

                // 3패스: 이진화
                for (let i = 0; i < len; i += 4) {
                    const v = d[i] < thr ? 0 : 255;
                    d[i] = d[i+1] = d[i+2] = v;
                }

                ctx.putImageData(imageData, 0, 0);
                canvas.toBlob(resolve, 'image/jpeg', 0.92);
            };
        };
    });
}
