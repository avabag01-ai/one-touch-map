// 원터치 디펜스 — 지도 기반 타워 디펜스 (완전 독립 모듈)
// 기존 앱 코드를 일절 참조하지 않는다. 지도는 OSM 타일(키 불필요),
// 적 경로는 OSRM 공개 서버의 실제 도로 경로(실패 시 직선 폴백).

(function () {
    'use strict';

    // ===== 설정 =====
    const CFG = {
        startView: { lat: 37.6063, lng: 127.0925, zoom: 16 }, // 앱 기본 동네
        startGold: 120,
        startLife: 10,
        totalWaves: 10,
        routeCount: 3,             // 적 진입로 수
        spawnDistMin: 550,         // 기지로부터 스폰 거리(m)
        spawnDistMax: 750,
        towerCost: 50,
        towerMaxLevel: 4,
        upgradeCost: lv => 60 * lv,            // 현재 레벨 → 다음 레벨 비용
        towerDamage: lv => 20 + 14 * (lv - 1),
        towerRange: lv => 90 + 12 * (lv - 1),  // m
        towerFireRate: 2,          // 발/초
        bulletSpeed: 150,          // m/s
        killGold: 8,
        waveBonus: n => 25 + 5 * n,
        enemyBaseHp: n => 55 * Math.pow(1.22, n - 1),
        enemySpeed: 20,            // m/s
        waveCount: n => 5 + 3 * (n - 1),
        spawnInterval: 0.85,       // s
        intermission: 2.5,         // 웨이브 사이(s)
    };

    const ENEMY_TYPES = {
        normal: { hpMul: 1, spdMul: 1, radius: 9, color: '#e53935', dark: '#b71c1c', gold: 1, lifeDmg: 1 },
        runner: { hpMul: 0.55, spdMul: 1.7, radius: 7, color: '#fb8c00', dark: '#e65100', gold: 1, lifeDmg: 1 },
        tank: { hpMul: 3.2, spdMul: 0.65, radius: 13, color: '#8e24aa', dark: '#4a148c', gold: 2, lifeDmg: 2 },
        boss: { hpMul: 9, spdMul: 0.5, radius: 18, color: '#4a148c', dark: '#2d0a52', gold: 8, lifeDmg: 3 },
    };

    // ===== 상태 =====
    let map, canvas, ctx, dpr = 1;
    let phase = 'placing';   // placing | ready | loading | playing | won | lost
    let base = null;         // L.LatLng
    let baseMarker = null;
    let routeLines = [];     // Leaflet polylines (표시용)
    let routes = [];         // [{pts:[{x,y}], cum:[m], total:m}] (로컬 미터 좌표)
    let gold = 0, life = 0, wave = 0;
    let towers = [], enemies = [], bullets = [], particles = [];
    let spawnQueue = [];     // [{type, route}]
    let spawnTimer = 0, intermissionTimer = 0, waveActive = false;
    let speedMul = 1, paused = false;
    let lastTs = 0, rafId = null;

    // ===== DOM =====
    const $ = id => document.getElementById(id);
    const msgEl = $('message'), actionBtn = $('actionBtn');
    const lifeEl = $('lifeVal'), goldEl = $('goldVal'), waveEl = $('waveVal');
    const overlay = $('resultOverlay'), resultTitle = $('resultTitle'), resultDetail = $('resultDetail');
    const flashEl = $('damageFlash'), toastEl = $('toast');

    // ===== 지오 유틸 (기지 기준 로컬 미터 좌표계) =====
    const R_EARTH = 6371000;
    function toLocal(latlng) {
        const dLat = (latlng.lat - base.lat) * Math.PI / 180;
        const dLng = (latlng.lng - base.lng) * Math.PI / 180;
        const cosLat = Math.cos(base.lat * Math.PI / 180);
        return { x: dLng * cosLat * R_EARTH, y: dLat * R_EARTH };
    }
    function destPoint(latlng, bearingDeg, distM) {
        const br = bearingDeg * Math.PI / 180;
        const dLat = (distM * Math.cos(br)) / R_EARTH * 180 / Math.PI;
        const dLng = (distM * Math.sin(br)) / (R_EARTH * Math.cos(latlng.lat * Math.PI / 180)) * 180 / Math.PI;
        return L.latLng(latlng.lat + dLat, latlng.lng + dLng);
    }
    function metersPerPixel() {
        return 156543.03392 * Math.cos(base.lat * Math.PI / 180) / Math.pow(2, map.getZoom());
    }
    function toScreen(p) { // 로컬 미터 → 화면 px
        const bp = map.latLngToContainerPoint(base);
        const mpp = metersPerPixel();
        return { x: bp.x + p.x / mpp, y: bp.y - p.y / mpp };
    }
    function tapToLocal(latlng) { return toLocal(latlng); }
    function dist2(a, b) { const dx = a.x - b.x, dy = a.y - b.y; return dx * dx + dy * dy; }

    // ===== 경로 =====
    async function fetchRoadRoute(from, to) {
        const url = `https://router.project-osrm.org/route/v1/driving/` +
            `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            const json = await res.json();
            if (json.code !== 'Ok' || !json.routes?.length) return null;
            return json.routes[0].geometry.coordinates.map(c => L.latLng(c[1], c[0]));
        } catch (e) {
            return null;
        } finally {
            clearTimeout(t);
        }
    }

    function buildPath(latlngs) {
        // 경로 끝이 기지와 떨어져 있으면(도로 스냅 갭) 기지까지 직선 구간 추가
        const pts = latlngs.map(toLocal);
        const last = pts[pts.length - 1];
        if (Math.sqrt(dist2(last, { x: 0, y: 0 })) > 15) pts.push({ x: 0, y: 0 });
        const cum = [0];
        for (let i = 1; i < pts.length; i++) {
            cum.push(cum[i - 1] + Math.sqrt(dist2(pts[i], pts[i - 1])));
        }
        return { pts, cum, total: cum[cum.length - 1] };
    }

    function posAtDist(path, d, hint) {
        if (d <= 0) return { p: path.pts[0], i: 0 };
        if (d >= path.total) return { p: path.pts[path.pts.length - 1], i: path.pts.length - 1 };
        let i = Math.max(1, hint || 1);
        while (path.cum[i] < d) i++;
        while (path.cum[i - 1] > d) i--;
        const segLen = path.cum[i] - path.cum[i - 1] || 1;
        const t = (d - path.cum[i - 1]) / segLen;
        const a = path.pts[i - 1], b = path.pts[i];
        return { p: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, i };
    }

    async function prepareRoutes() {
        phase = 'loading';
        setMessage('도로 경로 불러오는 중…');
        actionBtn.classList.add('hidden');

        const baseBearing = Math.random() * 360;
        const jobs = [];
        for (let k = 0; k < CFG.routeCount; k++) {
            const bearing = baseBearing + k * (360 / CFG.routeCount) + (Math.random() * 40 - 20);
            const dist = CFG.spawnDistMin + Math.random() * (CFG.spawnDistMax - CFG.spawnDistMin);
            const spawn = destPoint(base, bearing, dist);
            jobs.push(fetchRoadRoute(spawn, base).then(r => r || [spawn, base])); // 폴백: 직선
        }
        const latlngRoutes = await Promise.all(jobs);

        let roadOk = 0;
        routes = latlngRoutes.map(lls => {
            if (lls.length > 2) roadOk++;
            return buildPath(lls);
        });

        // 진입로 표시
        const colors = ['#d32f2f', '#f57c00', '#7b1fa2'];
        routeLines = latlngRoutes.map((lls, i) =>
            L.polyline(lls, { color: colors[i % colors.length], weight: 4, opacity: 0.55, dashArray: '8 8' }).addTo(map));

        return roadOk;
    }

    // ===== 게임 흐름 =====
    function setMessage(text) {
        msgEl.textContent = text;
        msgEl.classList.remove('hidden');
    }
    function showToast(text) {
        toastEl.textContent = text;
        toastEl.classList.add('on');
        setTimeout(() => toastEl.classList.remove('on'), 900);
    }
    function updateHud() {
        lifeEl.textContent = life;
        goldEl.textContent = gold;
        waveEl.textContent = wave > 0 ? `${wave}/${CFG.totalWaves}` : '-';
    }

    const BASE_ICON_HTML =
        '<svg width="40" height="40" viewBox="0 0 40 40" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.35))">' +
        '<line x1="30" y1="6" x2="30" y2="16" stroke="#6d4c41" stroke-width="2"/>' +
        '<path d="M30 6 L39 9.5 L30 13 Z" fill="#e53935"/>' +
        '<rect x="9" y="12" width="5" height="7" fill="#a1887f" stroke="#6d4c41" stroke-width="0.8"/>' +
        '<rect x="17.5" y="12" width="5" height="7" fill="#a1887f" stroke="#6d4c41" stroke-width="0.8"/>' +
        '<rect x="26" y="12" width="5" height="7" fill="#a1887f" stroke="#6d4c41" stroke-width="0.8"/>' +
        '<rect x="7" y="17" width="26" height="17" rx="2" fill="#a1887f" stroke="#6d4c41" stroke-width="1"/>' +
        '<rect x="16" y="25" width="8" height="9" rx="3.5" fill="#5d4037"/>' +
        '</svg>';

    function placeBase(latlng) {
        base = latlng;
        if (!baseMarker) {
            baseMarker = L.marker(latlng, {
                icon: L.divIcon({ className: '', html: BASE_ICON_HTML, iconSize: [40, 40], iconAnchor: [20, 24] }),
            }).addTo(map);
        } else {
            baseMarker.setLatLng(latlng);
        }
        phase = 'ready';
        setMessage('위치 확인! 다른 곳을 탭하면 옮길 수 있어요');
        actionBtn.textContent = '웨이브 시작';
        actionBtn.classList.remove('hidden');
    }

    function lockMap() {
        map.dragging.disable();
        map.touchZoom.disable();
        map.doubleClickZoom.disable();
        map.scrollWheelZoom.disable();
        map.boxZoom.disable();
        map.keyboard.disable();
    }
    function unlockMap() {
        map.dragging.enable();
        map.touchZoom.enable();
        map.doubleClickZoom.enable();
        map.scrollWheelZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
    }

    async function startGame() {
        lockMap();
        const roadOk = await prepareRoutes();
        gold = CFG.startGold;
        life = CFG.startLife;
        wave = 0;
        towers = []; enemies = []; bullets = []; particles = [];
        waveActive = false;
        intermissionTimer = 1.2;
        phase = 'playing';
        updateHud();
        setMessage(roadOk > 0
            ? '빈 곳 탭 = 타워 건설(💰50) · 타워 탭 = 업그레이드'
            : '⚠️ 도로 경로 실패 — 직선 경로로 진행합니다');
    }

    function startWave() {
        wave++;
        waveActive = true;
        spawnQueue = [];
        const count = CFG.waveCount(wave);
        for (let i = 0; i < count; i++) {
            let type = 'normal';
            if (wave >= 3 && i % 4 === 3) type = 'runner';
            if (wave >= 5 && i % 5 === 4) type = 'tank';
            spawnQueue.push({ type, route: Math.floor(Math.random() * routes.length) });
        }
        if (wave === CFG.totalWaves) spawnQueue.push({ type: 'boss', route: 0 });
        spawnTimer = 0;
        setMessage(`🌊 웨이브 ${wave} 시작!`);
        updateHud();
    }

    function spawnEnemy(job) {
        const t = ENEMY_TYPES[job.type];
        enemies.push({
            type: job.type, route: job.route,
            d: 0, segHint: 1,
            hp: CFG.enemyBaseHp(wave) * t.hpMul,
            maxHp: CFG.enemyBaseHp(wave) * t.hpMul,
            spd: CFG.enemySpeed * t.spdMul * (0.92 + Math.random() * 0.16),
            pos: { ...routes[job.route].pts[0] },
            seed: Math.random() * Math.PI * 2, // 통통 애니메이션 위상
            dirX: 1,                            // 진행 방향 (눈동자/잔상용)
        });
    }

    function baseHit(enemy) {
        life -= ENEMY_TYPES[enemy.type].lifeDmg;
        updateHud();
        flashEl.classList.add('on');
        setTimeout(() => flashEl.classList.remove('on'), 60);
        if (navigator.vibrate) navigator.vibrate(40);
        if (life <= 0) {
            life = 0;
            updateHud();
            endGame(false);
        }
    }

    function endGame(won) {
        phase = won ? 'won' : 'lost';
        resultTitle.textContent = won ? '🏆 승리!' : '💀 패배';
        resultDetail.textContent = won
            ? `${CFG.totalWaves}웨이브 방어 성공 — 이 동네는 안전합니다`
            : `웨이브 ${wave}에서 기지 함락 — 길목을 다시 살펴보세요`;
        overlay.classList.remove('hidden');
    }

    function resetForRetry(keepBase) {
        overlay.classList.add('hidden');
        enemies = []; bullets = []; particles = []; towers = [];
        spawnQueue = []; waveActive = false; wave = 0;
        updateHud();
        if (keepBase) {
            startGame2();
        } else {
            routeLines.forEach(l => map.removeLayer(l));
            routeLines = []; routes = [];
            unlockMap();
            phase = 'placing';
            setMessage('기지를 세울 곳을 지도에서 탭하세요');
            actionBtn.classList.add('hidden');
        }
    }

    // 같은 기지/경로 재사용 빠른 재시작
    function startGame2() {
        gold = CFG.startGold;
        life = CFG.startLife;
        intermissionTimer = 1.2;
        phase = 'playing';
        updateHud();
        setMessage('빈 곳 탭 = 타워 건설(💰50) · 타워 탭 = 업그레이드');
    }

    // ===== 타워 =====
    function handleGameTap(latlng) {
        const p = tapToLocal(latlng);
        const mpp = metersPerPixel();
        // 기존 타워 탭? (화면상 28px 이내)
        for (const tw of towers) {
            if (Math.sqrt(dist2(tw.pos, p)) / mpp < 28) {
                if (tw.level >= CFG.towerMaxLevel) { showToast('최대 레벨'); return; }
                const cost = CFG.upgradeCost(tw.level);
                if (gold < cost) { showToast(`업그레이드 💰${cost} 필요`); return; }
                gold -= cost;
                tw.level++;
                updateHud();
                spawnParticles(tw.pos, '#2196F3', 10);
                return;
            }
        }
        // 새 타워
        if (gold < CFG.towerCost) { showToast(`타워 💰${CFG.towerCost} 필요`); return; }
        gold -= CFG.towerCost;
        towers.push({ pos: p, level: 1, cooldown: 0, angle: 0 });
        updateHud();
        spawnParticles(p, '#90caf9', 8);
    }

    function towerUpdate(dt) {
        for (const tw of towers) {
            tw.cooldown -= dt;
            if (tw.flash > 0) tw.flash -= dt;
            if (tw.cooldown > 0) continue;
            const range = CFG.towerRange(tw.level);
            let best = null;
            for (const e of enemies) {
                if (dist2(tw.pos, e.pos) <= range * range && (!best || e.d > best.d)) best = e;
            }
            if (best) {
                tw.cooldown = 1 / CFG.towerFireRate;
                tw.flash = 0.08; // 머즐 플래시 타이머
                tw.angle = Math.atan2(best.pos.y - tw.pos.y, best.pos.x - tw.pos.x);
                bullets.push({
                    pos: { ...tw.pos }, target: best,
                    dmg: CFG.towerDamage(tw.level),
                    trail: [],
                });
            }
        }
    }

    // ===== 파티클 =====
    function spawnParticles(pos, color, n) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = 20 + Math.random() * 50;
            particles.push({
                pos: { ...pos }, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                life: 0.4 + Math.random() * 0.3, color,
            });
        }
    }

    // ===== 메인 루프 =====
    function update(dt) {
        // 웨이브 진행
        if (!waveActive) {
            intermissionTimer -= dt;
            if (intermissionTimer <= 0) {
                if (wave >= CFG.totalWaves) { endGame(true); return; }
                startWave();
            }
        } else {
            if (spawnQueue.length > 0) {
                spawnTimer -= dt;
                if (spawnTimer <= 0) {
                    spawnTimer = CFG.spawnInterval;
                    spawnEnemy(spawnQueue.shift());
                }
            } else if (enemies.length === 0) {
                waveActive = false;
                gold += CFG.waveBonus(wave);
                updateHud();
                if (wave >= CFG.totalWaves) { endGame(true); return; }
                intermissionTimer = CFG.intermission;
                setMessage(`웨이브 ${wave} 클리어! +💰${CFG.waveBonus(wave)}`);
            }
        }

        // 적 이동
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            const path = routes[e.route];
            e.d += e.spd * dt;
            const r = posAtDist(path, e.d, e.segHint);
            if (Math.abs(r.p.x - e.pos.x) > 0.01) e.dirX = r.p.x > e.pos.x ? 1 : -1;
            e.pos = r.p; e.segHint = r.i;
            if (e.d >= path.total) {
                enemies.splice(i, 1);
                baseHit(e);
                if (phase !== 'playing') return;
            }
        }

        towerUpdate(dt);

        // 투사체
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (!enemies.includes(b.target)) { bullets.splice(i, 1); continue; }
            const dx = b.target.pos.x - b.pos.x, dy = b.target.pos.y - b.pos.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            const step = CFG.bulletSpeed * dt;
            if (d <= step + ENEMY_TYPES[b.target.type].radius * 0.5) {
                // 명중
                b.target.hp -= b.dmg;
                if (b.target.hp <= 0) {
                    const idx = enemies.indexOf(b.target);
                    if (idx >= 0) {
                        spawnParticles(b.target.pos, ENEMY_TYPES[b.target.type].color, 8);
                        gold += CFG.killGold * ENEMY_TYPES[b.target.type].gold;
                        enemies.splice(idx, 1);
                        updateHud();
                    }
                }
                bullets.splice(i, 1);
            } else {
                b.trail.unshift({ x: b.pos.x, y: b.pos.y });
                if (b.trail.length > 2) b.trail.pop();
                b.pos.x += dx / d * step;
                b.pos.y += dy / d * step;
            }
        }

        // 파티클
        for (let i = particles.length - 1; i >= 0; i--) {
            const pt = particles[i];
            pt.life -= dt;
            if (pt.life <= 0) { particles.splice(i, 1); continue; }
            pt.pos.x += pt.vx * dt;
            pt.pos.y += pt.vy * dt;
        }
    }

    // 둥근 사각형 path (구형 webview 폴백 포함)
    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    // 슬라임 캐릭터: 통통 튀는 몸체 + 진행 방향 보는 눈 + 타입별 장식
    function drawSlime(e, now) {
        const t = ENEMY_TYPES[e.type];
        const s = toScreen(e.pos);
        const r = t.radius;
        const sq = Math.sin(now / 150 + e.seed) * 0.07; // squash & stretch
        const rx = r * (1.05 - sq);
        const ry = r * (0.88 + sq);

        // 러너: 속도 잔상
        if (e.type === 'runner') {
            ctx.strokeStyle = t.color;
            ctx.globalAlpha = 0.45;
            ctx.lineWidth = 1.5;
            ctx.lineCap = 'round';
            const bx = s.x - e.dirX * (rx + 3);
            for (let k = -1; k <= 1; k++) {
                ctx.beginPath();
                ctx.moveTo(bx, s.y + k * 4);
                ctx.lineTo(bx - e.dirX * (9 - Math.abs(k) * 2), s.y + k * 4);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
        }

        // 몸체
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = t.color;
        ctx.fill();
        ctx.strokeStyle = t.dark;
        ctx.lineWidth = 1;
        ctx.stroke();

        // 하이라이트
        ctx.beginPath();
        ctx.arc(s.x - rx * 0.45, s.y - ry * 0.5, Math.max(1.2, r * 0.14), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();

        // 탱크: 투구 + 리벳
        if (e.type === 'tank') {
            ctx.beginPath();
            ctx.ellipse(s.x, s.y - ry * 0.3, rx * 0.92, ry * 0.72, 0, Math.PI, Math.PI * 2);
            ctx.fillStyle = t.dark;
            ctx.fill();
            ctx.fillStyle = '#ce93d8';
            for (let k = -1; k <= 1; k++) {
                ctx.beginPath();
                ctx.arc(s.x + k * rx * 0.4, s.y - ry * (k === 0 ? 0.78 : 0.62), 1.2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 보스: 금왕관 + 성난 눈썹
        if (e.type === 'boss') {
            const w2 = r * 0.55, ch = r * 0.55, y0 = s.y - ry * 0.95;
            ctx.beginPath();
            ctx.moveTo(s.x - w2, y0);
            ctx.lineTo(s.x - w2 * 0.66, y0 - ch);
            ctx.lineTo(s.x - w2 * 0.33, y0 - ch * 0.45);
            ctx.lineTo(s.x, y0 - ch * 1.15);
            ctx.lineTo(s.x + w2 * 0.33, y0 - ch * 0.45);
            ctx.lineTo(s.x + w2 * 0.66, y0 - ch);
            ctx.lineTo(s.x + w2, y0);
            ctx.closePath();
            ctx.fillStyle = '#fbc02d';
            ctx.fill();
            ctx.strokeStyle = '#f57f17';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        // 눈 (눈동자는 진행 방향을 봄)
        const exOff = rx * 0.38;
        const eyeY = s.y - ry * 0.15;
        const eyeR = Math.max(2, r * 0.3);
        const pupilR = Math.max(1, r * 0.14);
        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(s.x + side * exOff, eyeY, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.beginPath();
            ctx.arc(s.x + side * exOff + e.dirX * eyeR * 0.35, eyeY + eyeR * 0.15, pupilR, 0, Math.PI * 2);
            ctx.fillStyle = e.type === 'boss' ? '#b71c1c' : '#263238';
            ctx.fill();
        }
        if (e.type === 'boss') {
            ctx.strokeStyle = t.dark;
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(s.x + side * (exOff + eyeR), eyeY - eyeR * 1.3);
                ctx.lineTo(s.x + side * (exOff - eyeR * 0.5), eyeY - eyeR * 0.55);
                ctx.stroke();
            }
        }

        // 입: 보스는 지그재그, 나머지는 미소
        ctx.strokeStyle = t.dark;
        ctx.lineWidth = 1.2;
        ctx.lineCap = 'round';
        const my = s.y + ry * 0.4;
        ctx.beginPath();
        if (e.type === 'boss') {
            ctx.moveTo(s.x - r * 0.3, my);
            for (let k = 0; k < 4; k++) {
                ctx.lineTo(s.x - r * 0.3 + (k + 1) * r * 0.15, my + (k % 2 === 0 ? -2.5 : 0));
            }
        } else {
            ctx.arc(s.x, my - r * 0.15, r * 0.3, Math.PI * 0.2, Math.PI * 0.8);
        }
        ctx.stroke();

        // HP바 (둥근 모서리, 빈사 시 빨강)
        const bw = r * 2.2;
        const hpY = s.y - ry - 9;
        ctx.fillStyle = 'rgba(38, 50, 56, 0.75)';
        roundRect(s.x - bw / 2, hpY, bw, 4.5, 2.2);
        ctx.fill();
        const hpRatio = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = hpRatio < 0.35 ? '#ef5350' : '#66bb6a';
        roundRect(s.x - bw / 2 + 0.8, hpY + 0.8, (bw - 1.6) * hpRatio, 2.9, 1.4);
        ctx.fill();
    }

    function render() {
        const w = canvas.width / dpr, h = canvas.height / dpr;
        ctx.clearRect(0, 0, w, h);
        if (!base) return;
        const mpp = metersPerPixel();

        // 타워 사거리 (은은하게)
        for (const tw of towers) {
            const s = toScreen(tw.pos);
            ctx.beginPath();
            ctx.arc(s.x, s.y, CFG.towerRange(tw.level) / mpp, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(33, 150, 243, 0.07)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(33, 150, 243, 0.25)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // 타워 (포탑: 회전 포신 + 이중 원 + 레벨)
        for (const tw of towers) {
            const s = toScreen(tw.pos);
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(-tw.angle); // 화면 y축은 아래가 + 라서 부호 반전
            ctx.fillStyle = '#37474f';
            roundRect(0, -3.5, 20, 7, 3);
            ctx.fill();
            ctx.fillStyle = '#263238';
            roundRect(18, -5, 4, 10, 2);
            ctx.fill();
            if (tw.flash > 0) { // 머즐 플래시
                ctx.beginPath();
                ctx.arc(24, 0, 5, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 235, 59, 0.85)';
                ctx.fill();
            }
            ctx.restore();
            ctx.beginPath();
            ctx.arc(s.x, s.y, 13, 0, Math.PI * 2);
            ctx.fillStyle = '#1976d2';
            ctx.fill();
            ctx.strokeStyle = '#0d47a1';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(s.x, s.y, 8.5, 0, Math.PI * 2);
            ctx.fillStyle = '#0d47a1';
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '600 11px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tw.level, s.x, s.y + 0.5);
        }

        // 적 (슬라임 군단)
        const now = performance.now();
        for (const e of enemies) {
            drawSlime(e, now);
        }

        // 투사체 (트레이서 + 탄두)
        for (const b of bullets) {
            const s = toScreen(b.pos);
            for (let i = b.trail.length - 1; i >= 0; i--) {
                const ts = toScreen(b.trail[i]);
                ctx.globalAlpha = 0.25 + 0.25 * (b.trail.length - 1 - i);
                ctx.beginPath();
                ctx.arc(ts.x, ts.y, 2 + (b.trail.length - 1 - i) * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = '#fdd835';
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.beginPath();
            ctx.arc(s.x, s.y, 3.2, 0, Math.PI * 2);
            ctx.fillStyle = '#fdd835';
            ctx.fill();
            ctx.strokeStyle = '#f9a825';
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        // 파티클
        for (const pt of particles) {
            const s = toScreen(pt.pos);
            ctx.globalAlpha = Math.max(0, pt.life / 0.5);
            ctx.fillStyle = pt.color;
            ctx.fillRect(s.x - 2, s.y - 2, 4, 4);
        }
        ctx.globalAlpha = 1;
    }

    function loop(ts) {
        rafId = requestAnimationFrame(loop);
        const dt = Math.min(0.05, (ts - lastTs) / 1000);
        lastTs = ts;
        if (phase === 'playing' && !paused) {
            update(dt * speedMul);
        }
        render();
    }

    // ===== 초기화 =====
    function resizeCanvas() {
        dpr = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function init() {
        map = L.map('map', { zoomControl: false })
            .setView([CFG.startView.lat, CFG.startView.lng], CFG.startView.zoom);
        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '© OpenStreetMap',
        }).addTo(map);

        canvas = $('gameCanvas');
        ctx = canvas.getContext('2d');
        resizeCanvas();
        window.addEventListener('resize', () => { resizeCanvas(); map.invalidateSize(); });

        map.on('click', ev => {
            if (phase === 'placing' || phase === 'ready') placeBase(ev.latlng);
            else if (phase === 'playing' && !paused) handleGameTap(ev.latlng);
        });

        actionBtn.addEventListener('click', () => {
            if (phase === 'ready') startGame();
            actionBtn.classList.add('hidden');
        });

        $('speedBtn').addEventListener('click', () => {
            speedMul = speedMul === 1 ? 2 : 1;
            $('speedBtn').textContent = `▶︎ x${speedMul}`;
        });
        $('pauseBtn').addEventListener('click', () => {
            paused = !paused;
            $('pauseBtn').textContent = paused ? '▶︎' : '⏸';
            if (phase === 'playing') setMessage(paused ? '일시정지' : '재개!');
        });
        $('retryBtn').addEventListener('click', () => resetForRetry(true));
        $('moveBtn').addEventListener('click', () => resetForRetry(false));

        updateHud();
        lastTs = performance.now();
        rafId = requestAnimationFrame(loop);
    }

    document.addEventListener('DOMContentLoaded', init);
})();
