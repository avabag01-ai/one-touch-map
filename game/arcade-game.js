// 동네 오락실 — 전래놀이 미니게임 6종 + 서바이벌 모드 (완전 독립 모듈)
// 기존 앱 코드 참조 없음. 캐릭터는 원터치 디펜스의 슬라임 세계관 공유.

(function () {
    'use strict';

    const $ = id => document.getElementById(id);
    const menuScreen = $('menuScreen'), gameScreen = $('gameScreen');
    const canvas = $('gc'), ctx = canvas.getContext('2d');
    const livesLabel = $('livesLabel'), roundLabel = $('roundLabel');
    const introOverlay = $('introOverlay'), resultOverlay = $('resultOverlay');

    let W = 0, H = 0, dpr = 1;
    function resize() {
        dpr = window.devicePixelRatio || 1;
        W = canvas.clientWidth; H = canvas.clientHeight;
        canvas.width = W * dpr; canvas.height = H * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    window.addEventListener('resize', resize);

    // ===== 오디오 (WebAudio 비프 — 파일 의존 없음) =====
    let ac = null;
    function ensureAudio() {
        if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { } }
        if (ac && ac.state === 'suspended') ac.resume();
    }
    function beep(freq, dur, type, vol) {
        if (!ac) return;
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type || 'square'; o.frequency.value = freq;
        g.gain.value = vol || 0.12;
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
        o.connect(g).connect(ac.destination);
        o.start(); o.stop(ac.currentTime + dur);
    }
    function speak(text, rate) {
        try {
            const u = new SpeechSynthesisUtterance(text);
            u.lang = 'ko-KR'; u.rate = rate || 1;
            speechSynthesis.cancel(); speechSynthesis.speak(u);
        } catch (e) { }
    }

    const rand = (a, b) => a + Math.random() * (b - a);
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    function roundRect(x, y, w, h, r) {
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    // ===== 슬라임 (디펜스와 동일 DNA) =====
    // o: {color, dark, dirX(눈 방향), crown, angry, frozen(얼음 표정), t(통통 위상), squash(0=정지)}
    function drawSlime(x, y, r, o) {
        o = o || {};
        const color = o.color || '#e53935', dark = o.dark || '#b71c1c';
        const sq = (o.squash === 0 ? 0 : Math.sin((o.t || 0) / 150 + (o.seed || 0)) * 0.07);
        const rx = r * (1.05 - sq), ry = r * (0.88 + sq);
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = dark; ctx.lineWidth = Math.max(1, r * 0.08); ctx.stroke();
        ctx.beginPath();
        ctx.arc(x - rx * 0.45, y - ry * 0.5, Math.max(1.5, r * 0.14), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fill();

        if (o.crown) {
            const w2 = r * 0.55, ch = r * 0.55, y0 = y - ry * 0.95;
            ctx.beginPath();
            ctx.moveTo(x - w2, y0); ctx.lineTo(x - w2 * 0.66, y0 - ch);
            ctx.lineTo(x - w2 * 0.33, y0 - ch * 0.45); ctx.lineTo(x, y0 - ch * 1.15);
            ctx.lineTo(x + w2 * 0.33, y0 - ch * 0.45); ctx.lineTo(x + w2 * 0.66, y0 - ch);
            ctx.lineTo(x + w2, y0); ctx.closePath();
            ctx.fillStyle = '#fbc02d'; ctx.fill();
            ctx.strokeStyle = '#f57f17'; ctx.lineWidth = 1; ctx.stroke();
        }
        if (o.noFace) return;

        const exOff = rx * 0.38, eyeY = y - ry * 0.15;
        const eyeR = Math.max(2, r * 0.3), pupilR = Math.max(1, r * 0.14);
        const dirX = o.dirX || 0;
        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.arc(x + side * exOff, eyeY, eyeR, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
            if (o.frozen) { // 얼음! 눈동자 가운데 작게
                ctx.beginPath();
                ctx.arc(x + side * exOff, eyeY, pupilR * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = '#263238'; ctx.fill();
            } else {
                ctx.beginPath();
                ctx.arc(x + side * exOff + dirX * eyeR * 0.35, eyeY + eyeR * 0.15, pupilR, 0, Math.PI * 2);
                ctx.fillStyle = o.angry ? '#b71c1c' : '#263238'; ctx.fill();
            }
        }
        if (o.angry) {
            ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.lineCap = 'round';
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.moveTo(x + side * (exOff + eyeR), eyeY - eyeR * 1.3);
                ctx.lineTo(x + side * (exOff - eyeR * 0.5), eyeY - eyeR * 0.55);
                ctx.stroke();
            }
        }
        ctx.strokeStyle = dark; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
        ctx.beginPath();
        if (o.frozen) {
            ctx.moveTo(x - r * 0.22, y + ry * 0.42);
            ctx.lineTo(x + r * 0.22, y + ry * 0.42);
        } else {
            ctx.arc(x, y + ry * 0.28, r * 0.3, Math.PI * 0.2, Math.PI * 0.8);
        }
        ctx.stroke();
    }

    // ===== 파티클 =====
    let particles = [];
    function burst(x, y, colors, n, spd) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, v = rand(40, spd || 180);
            particles.push({
                x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
                life: rand(0.4, 0.9), color: colors[i % colors.length], size: rand(2, 5),
            });
        }
    }
    function updateParticles(dt) {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.life -= dt;
            if (p.life <= 0) { particles.splice(i, 1); continue; }
            p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        }
    }
    function renderParticles() {
        for (const p of particles) {
            ctx.globalAlpha = clamp(p.life / 0.5, 0, 1);
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }
        ctx.globalAlpha = 1;
    }
    const CONFETTI = ['#fbbf24', '#34d399', '#60a5fa', '#f87171', '#e879f9'];

    // ===== 씬 매니저 =====
    const GAMES = ['mugunghwa', 'dalgona', 'ddakji', 'jegi', 'bridge', 'tug'];
    const META = {
        mugunghwa: { icon: '🌺', title: '무궁화 꽃이 피었습니다', rule: '화면을 누르면 달리고 떼면 멈춥니다.\n술래가 돌아봤을 때 움직이면 탈락!' },
        dalgona: { icon: '🍪', title: '달고나', rule: '손가락으로 모양 선을 따라 천천히 긋습니다.\n선을 벗어나거나 급하면 금이 가요. 금 3번 = 와장창' },
        ddakji: { icon: '🟦', title: '딱지치기', rule: '아래로 세게 스와이프해서 딱지를 내리칩니다.\n너무 약해도, 너무 막 쳐도 안 뒤집혀요. 5판 안에 2번!' },
        jegi: { icon: '🪶', title: '제기차기', rule: '제기가 발 높이로 떨어질 때 탭!\n바닥에 떨어뜨리지 말고 10개를 차세요. 기회 3번' },
        bridge: { icon: '🌉', title: '징검다리', rule: '3초 동안 안전한 유리를 외우세요.\n그다음 기억대로 7칸을 건너면 성공!' },
        tug: { icon: '🪢', title: '줄다리기', rule: '왼쪽, 오른쪽을 번갈아 연타해서 줄을 당기세요.\n같은 쪽만 두드리면 힘이 안 들어가요!' },
    };

    let mode = 'free';       // free | survival
    let lives = 3, roundIdx = 0, score = 0;
    let scene = null, sceneKey = null, running = false;
    let lastTs = 0;

    function updateHud() {
        livesLabel.textContent = mode === 'survival' ? '❤️'.repeat(Math.max(0, lives)) : '';
        const m = META[sceneKey];
        roundLabel.textContent = mode === 'survival'
            ? `제${roundIdx + 1}게임 · ${m.title}` : m.title;
    }

    function showIntro() {
        const m = META[sceneKey];
        $('introKicker').textContent = mode === 'survival' ? `제 ${roundIdx + 1} 게임` : '연습 한 판';
        $('introTitle').textContent = `${m.icon} ${m.title}`;
        $('introRule').textContent = m.rule;
        introOverlay.classList.remove('hidden');
        resultOverlay.classList.add('hidden');
        running = false;
    }

    function launch(key) {
        sceneKey = key;
        scene = makeScene[key]();
        particles = [];
        updateHud();
        showIntro();
    }

    function startSurvival() {
        mode = 'survival'; lives = 3; roundIdx = 0; score = 0;
        enterGameScreen();
        launch(GAMES[0]);
    }
    function startFree(key) {
        mode = 'free';
        enterGameScreen();
        launch(key);
    }
    function enterGameScreen() {
        menuScreen.style.display = 'none';
        gameScreen.classList.add('on');
        resize();
    }
    function backToMenu() {
        running = false;
        gameScreen.classList.remove('on');
        menuScreen.style.display = 'block';
        try { speechSynthesis.cancel(); } catch (e) { }
    }

    // 라운드 종료 처리 (성공/실패 → 서바이벌 진행 or 결과창)
    function finishRound(ok, detail) {
        running = false;
        const emoji = $('resultEmoji'), title = $('resultTitle'), det = $('resultDetail'), next = $('resultNext');
        if (ok) burst(W / 2, H / 2, CONFETTI, 50, 260);

        if (mode === 'survival') {
            if (ok) {
                score += 100;
                if (roundIdx >= GAMES.length - 1) {
                    score += lives * 100;
                    emoji.textContent = '🏆';
                    title.textContent = '동네 챔피언!';
                    det.textContent = `6라운드 전부 클리어 — 점수 ${score}점 (남은 목숨 보너스 포함)`;
                    next.textContent = '처음부터';
                    next.onclick = startSurvival;
                } else {
                    emoji.textContent = '✅';
                    title.textContent = `제${roundIdx + 1}게임 통과!`;
                    det.textContent = detail || '';
                    next.textContent = '다음 게임';
                    next.onclick = () => { roundIdx++; launch(GAMES[roundIdx]); };
                }
            } else {
                lives--;
                updateHud();
                if (lives <= 0) {
                    emoji.textContent = '💀';
                    title.textContent = '탈락';
                    det.textContent = `${detail || ''}\n제${roundIdx + 1}게임에서 목숨을 모두 잃었습니다`;
                    next.textContent = '처음부터';
                    next.onclick = startSurvival;
                } else {
                    emoji.textContent = '😵';
                    title.textContent = '실패…';
                    det.textContent = `${detail || ''}\n남은 목숨 ${lives}개로 재도전!`;
                    next.textContent = `다시 도전 (❤️${lives})`;
                    next.onclick = () => launch(sceneKey);
                }
            }
        } else {
            emoji.textContent = ok ? '🎉' : '😵';
            title.textContent = ok ? '성공!' : '실패…';
            det.textContent = detail || '';
            next.textContent = '다시';
            next.onclick = () => launch(sceneKey);
        }
        resultOverlay.classList.remove('hidden');
    }

    // ===== 입력 (포인터 통합) =====
    function localXY(e) {
        const r = canvas.getBoundingClientRect();
        return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    canvas.addEventListener('pointerdown', e => {
        ensureAudio();
        if (!running || !scene) return;
        const p = localXY(e);
        scene.down && scene.down(p.x, p.y, e.pointerId);
    });
    window.addEventListener('pointermove', e => {
        if (!running || !scene) return;
        const p = localXY(e);
        scene.move && scene.move(p.x, p.y, e.pointerId);
    });
    window.addEventListener('pointerup', e => {
        if (!running || !scene) return;
        const p = localXY(e);
        scene.up && scene.up(p.x, p.y, e.pointerId);
    });

    // ===== 메인 루프 =====
    function loop(ts) {
        requestAnimationFrame(loop);
        const dt = Math.min(0.05, (ts - lastTs) / 1000);
        lastTs = ts;
        if (!gameScreen.classList.contains('on')) return;
        if (running && scene) scene.update(dt, ts);
        ctx.clearRect(0, 0, W, H);
        if (scene) scene.render(ts);
        updateParticles(dt);
        renderParticles();
    }

    // 캔버스 상단 공용 안내 텍스트
    function topText(text, sub) {
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        ctx.fillStyle = '#fff';
        ctx.font = '800 22px -apple-system, sans-serif';
        ctx.fillText(text, W / 2, 74);
        if (sub) {
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '600 13px -apple-system, sans-serif';
            ctx.fillText(sub, W / 2, 102);
        }
    }

    // ===== 씬 팩토리 =====
    const makeScene = {};

    // ---------- 1. 무궁화 꽃이 피었습니다 ----------
    makeScene.mugunghwa = () => {
        const CHANT = '무궁화 꽃이 피었습니다';
        let pos = 0, holding = false, phase = 'chant', phaseT = 0, phaseDur = 2;
        let chantSyl = 0, watchGrace = 0, timeLeft = 60, caughtAnim = 0;

        function newChant() {
            phase = 'chant'; phaseT = 0;
            phaseDur = rand(1.0, 2.8) * (1 - pos * 0.25); // 막판일수록 빨라짐
            chantSyl = 0;
            speak(CHANT, clamp(2.3 - phaseDur * 0.6, 0.8, 2));
        }
        newChant();

        return {
            update(dt) {
                timeLeft -= dt;
                if (timeLeft <= 0) { finishRound(false, '시간 초과 — 해 떨어졌다'); return; }
                phaseT += dt;

                if (phase === 'chant') {
                    const sylCount = Math.floor((phaseT / phaseDur) * CHANT.length);
                    if (sylCount > chantSyl && CHANT[chantSyl] !== ' ') beep(rand(500, 700), 0.05, 'square', 0.05);
                    chantSyl = sylCount;
                    if (phaseT >= phaseDur) { phase = 'warn'; phaseT = 0; beep(220, 0.2, 'sawtooth'); }
                } else if (phase === 'warn') {
                    if (phaseT >= 0.35) { phase = 'watch'; phaseT = 0; phaseDur = rand(0.9, 2.2); watchGrace = 0.15; }
                } else if (phase === 'watch') {
                    watchGrace -= dt;
                    if (holding && watchGrace <= 0) {
                        beep(120, 0.5, 'sawtooth', 0.2);
                        if (navigator.vibrate) navigator.vibrate(150);
                        finishRound(false, '술래에게 들켰다!');
                        return;
                    }
                    if (phaseT >= phaseDur) newChant();
                }

                if (holding && phase !== 'watch') {
                    pos += dt / 8;
                    if (pos >= 1) { pos = 1; finishRound(true, `${Math.ceil(timeLeft)}초 남기고 도착!`); }
                }
            },
            down() { holding = true; },
            up() { holding = false; },
            render(ts) {
                // 들판 + 길
                ctx.fillStyle = '#86c06c'; ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = '#e8d8a8'; ctx.fillRect(W / 2 - 70, 0, 140, H);
                ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2;
                ctx.strokeRect(W / 2 - 70, -2, 140, H + 4);

                const startY = H - 110, finishY = 170;
                // 결승선 (체크무늬)
                for (let i = 0; i < 14; i++) {
                    ctx.fillStyle = i % 2 ? '#fff' : '#333';
                    ctx.fillRect(W / 2 - 70 + i * 10, finishY - 6, 10, 12);
                }
                // 술래 (보스 슬라임)
                const watching = phase === 'watch' || phase === 'warn';
                if (watching) {
                    ctx.beginPath();
                    ctx.arc(W / 2, 120, 38, 0, Math.PI * 2);
                    ctx.fillStyle = phase === 'warn' ? 'rgba(251,192,45,0.25)' : 'rgba(229,57,53,0.25)';
                    ctx.fill();
                }
                drawSlime(W / 2, 120, 26, { color: '#4a148c', dark: '#2d0a52', crown: true, angry: watching, noFace: !watching, t: ts, squash: watching ? 0 : 1 });
                // 앵멸이 말풍선
                if (phase === 'chant') {
                    const txt = CHANT.slice(0, chantSyl);
                    if (txt) {
                        ctx.font = '800 17px -apple-system, sans-serif';
                        const tw = ctx.measureText(txt).width;
                        ctx.fillStyle = 'rgba(255,255,255,0.95)';
                        roundRect(W / 2 - tw / 2 - 12, 38, tw + 24, 30, 15); ctx.fill();
                        ctx.fillStyle = '#333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                        ctx.fillText(txt, W / 2, 54);
                    }
                } else if (phase === 'watch') {
                    ctx.font = '800 18px -apple-system, sans-serif';
                    ctx.fillStyle = '#b71c1c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                    ctx.fillText('👀 보고 있다!', W / 2, 54);
                }
                // 플레이어 슬라임
                const py = startY - (startY - finishY - 40) * pos;
                drawSlime(W / 2, py, 17, { t: ts, squash: holding && phase !== 'watch' ? 1 : 0, frozen: !holding, dirX: 0 });
                // 진행/시간
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                roundRect(14, H - 64, W - 28, 10, 5); ctx.fill();
                ctx.fillStyle = '#fbbf24';
                roundRect(15, H - 63, (W - 30) * pos, 8, 4); ctx.fill();
                ctx.font = '700 14px -apple-system, sans-serif';
                ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText(`⏱ ${Math.ceil(timeLeft)}초 · ${holding ? '달리는 중!' : '꾹 누르면 달려요'}`, W / 2, H - 48);
            },
        };
    };

    // ---------- 2. 달고나 ----------
    makeScene.dalgona = () => {
        const cx0 = () => W / 2, cy0 = () => H * 0.44;
        const R = () => Math.min(W, H) * 0.36;
        let pts = [], covered = [], cracks = 0, crackLines = [], offT = 0, invuln = 0;
        let timeLeft = 75, fingerOn = false, fx = 0, fy = 0, lastT = 0, done = false;

        function buildShape() {
            pts = [];
            const kind = ['triangle', 'star', 'circle'][Math.floor(Math.random() * 3)];
            const r = R() * 0.62, cx = cx0(), cy = cy0();
            const N = 130;
            for (let i = 0; i <= N; i++) {
                const t = i / N;
                let x, y;
                if (kind === 'circle') {
                    x = cx + Math.cos(t * Math.PI * 2) * r;
                    y = cy + Math.sin(t * Math.PI * 2) * r;
                } else if (kind === 'triangle') {
                    const seg = t * 3, k = Math.floor(seg) % 3, f = seg - Math.floor(seg);
                    const ang = a => -Math.PI / 2 + a * Math.PI * 2 / 3;
                    const ax = cx + Math.cos(ang(k)) * r, ay = cy + Math.sin(ang(k)) * r;
                    const bx = cx + Math.cos(ang(k + 1)) * r, by = cy + Math.sin(ang(k + 1)) * r;
                    x = ax + (bx - ax) * f; y = ay + (by - ay) * f;
                } else { // star
                    const seg = t * 10, k = Math.floor(seg) % 10, f = seg - Math.floor(seg);
                    const pr = i2 => (i2 % 2 === 0 ? r : r * 0.45);
                    const ang = i2 => -Math.PI / 2 + i2 * Math.PI / 5;
                    const ax = cx + Math.cos(ang(k)) * pr(k), ay = cy + Math.sin(ang(k)) * pr(k);
                    const bx = cx + Math.cos(ang(k + 1)) * pr(k + 1), by = cy + Math.sin(ang(k + 1)) * pr(k + 1);
                    x = ax + (bx - ax) * f; y = ay + (by - ay) * f;
                }
                pts.push({ x, y });
            }
            covered = new Array(pts.length).fill(false);
        }
        buildShape();

        function addCrack() {
            cracks++; invuln = 0.6; offT = 0;
            beep(150, 0.3, 'sawtooth', 0.2);
            if (navigator.vibrate) navigator.vibrate(80);
            const a = Math.random() * Math.PI * 2, cx = cx0(), cy = cy0();
            const segs = [];
            let x = cx + Math.cos(a) * R(), y = cy + Math.sin(a) * R();
            for (let i = 0; i < 5; i++) {
                segs.push({ x, y });
                x += (cx - x) * 0.3 + rand(-18, 18);
                y += (cy - y) * 0.3 + rand(-18, 18);
            }
            crackLines.push(segs);
            burst(x, y, ['#b07f30', '#8a5a18'], 10, 120);
            if (cracks >= 3 && !done) { done = true; finishRound(false, '달고나가 와장창 깨졌다…'); }
        }

        return {
            update(dt) {
                if (done) return;
                timeLeft -= dt; invuln = Math.max(0, invuln - dt);
                if (timeLeft <= 0) { done = true; finishRound(false, '시간 초과 — 달고나가 식었다'); return; }
                const ratio = covered.filter(Boolean).length / covered.length;
                if (ratio >= 0.92) {
                    done = true;
                    burst(cx0(), cy0(), CONFETTI, 40, 220);
                    finishRound(true, `금 ${cracks}번만 내고 모양을 떼어냈다!`);
                }
            },
            down(x, y) { fingerOn = true; fx = x; fy = y; lastT = performance.now(); },
            move(x, y) {
                if (!fingerOn || done) return;
                const now = performance.now();
                const dtm = Math.max(1, now - lastT);
                const speed = Math.hypot(x - fx, y - fy) / dtm * 1000;
                fx = x; fy = y; lastT = now;

                const inCandy = Math.hypot(x - cx0(), y - cy0()) < R();
                let minD = 1e9, minI = -1;
                for (let i = 0; i < pts.length; i++) {
                    const d = Math.hypot(pts[i].x - x, pts[i].y - y);
                    if (d < minD) { minD = d; minI = i; }
                }
                if (minD < 14) {
                    if (speed > 650 && invuln <= 0) { addCrack(); return; } // 너무 급함
                    if (speed < 650) {
                        for (let i = 0; i < pts.length; i++) {
                            if (Math.hypot(pts[i].x - x, pts[i].y - y) < 12) covered[i] = true;
                        }
                        if (Math.random() < 0.3) beep(rand(900, 1100), 0.03, 'sine', 0.04);
                    }
                    offT = 0;
                } else if (inCandy && invuln <= 0) {
                    offT += dtm / 1000;
                    if (offT > 0.13) addCrack();
                }
            },
            up() { fingerOn = false; offT = 0; },
            render() {
                ctx.fillStyle = '#3b2f23'; ctx.fillRect(0, 0, W, H);
                const cx = cx0(), cy = cy0(), r = R();
                // 달고나 판
                ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
                ctx.fillStyle = '#d4a24c'; ctx.fill();
                ctx.strokeStyle = '#b07f30'; ctx.lineWidth = 5; ctx.stroke();
                // 설탕 질감
                ctx.fillStyle = 'rgba(255,255,255,0.12)';
                for (let i = 0; i < 24; i++) {
                    const a = i * 2.61, rr = (i * 37 % 100) / 100 * r * 0.9;
                    ctx.fillRect(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 2.5, 2.5);
                }
                // 모양 선
                ctx.strokeStyle = '#8a5a18'; ctx.lineWidth = 3; ctx.setLineDash([6, 5]);
                ctx.beginPath();
                pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
                ctx.stroke(); ctx.setLineDash([]);
                // 판 부분
                ctx.strokeStyle = '#16a34a'; ctx.lineWidth = 5; ctx.lineCap = 'round';
                for (let i = 1; i < pts.length; i++) {
                    if (covered[i] && covered[i - 1]) {
                        ctx.beginPath();
                        ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
                        ctx.lineTo(pts[i].x, pts[i].y);
                        ctx.stroke();
                    }
                }
                // 금
                ctx.strokeStyle = 'rgba(90,55,15,0.85)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
                for (const seg of crackLines) {
                    ctx.beginPath();
                    seg.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
                    ctx.stroke();
                }
                // 바늘 (손가락 위치)
                if (fingerOn) {
                    ctx.strokeStyle = '#cbd5e1'; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.moveTo(fx + 10, fy - 26); ctx.lineTo(fx, fy); ctx.stroke();
                    ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#94a3b8'; ctx.fill();
                }
                const ratio = Math.round(covered.filter(Boolean).length / covered.length * 100);
                topText(`완성도 ${ratio}%`, `금 ${cracks}/3 · ⏱ ${Math.ceil(timeLeft)}초 · 천천히 따라 그으세요`);
            },
        };
    };

    // ---------- 3. 딱지치기 ----------
    makeScene.ddakji = () => {
        let throwsLeft = 5, flips = 0, state = 'aim'; // aim | fly | impact
        let trail = [], power = 0, lastPower = 0, flyT = 0, willFlip = false;
        let oppFlip = 0, shake = 0, msg = '아래로 세게 스와이프!';
        const oppPos = () => ({ x: W / 2, y: H * 0.6 });

        function flipChance(p, vertical) {
            let c;
            if (p < 400) c = 0.05;
            else if (p < 1500) c = 0.1 + (p - 400) / 1100 * 0.78;
            else if (p < 2400) c = 0.88;
            else c = 0.35; // 너무 세면 튕겨나감
            return c * (vertical ? 1 : 0.45);
        }

        return {
            update(dt) {
                shake = Math.max(0, shake - dt * 3);
                if (state === 'fly') {
                    flyT += dt * 4;
                    if (flyT >= 1) {
                        state = 'impact'; flyT = 0; shake = 1;
                        beep(90, 0.15, 'square', 0.25);
                        if (navigator.vibrate) navigator.vibrate(60);
                        const o = oppPos();
                        burst(o.x, o.y, ['#cbd5e1', '#94a3b8'], 16, 200);
                        if (willFlip) { flips++; oppFlip = 1; beep(660, 0.25, 'triangle', 0.2); msg = '뒤집었다!! 🎉'; }
                        else msg = ['꿈쩍도 안 한다…', '아깝다!', '바람만 일었다'][Math.floor(Math.random() * 3)];
                    }
                } else if (state === 'impact') {
                    oppFlip = Math.max(0, oppFlip - dt * 2.2);
                    flyT += dt;
                    if (flyT > 0.9) {
                        if (flips >= 2) { finishRound(true, `${5 - throwsLeft}번 만에 2승!`); return; }
                        if (throwsLeft <= 0) { finishRound(false, `5판 동안 ${flips}번밖에 못 뒤집었다`); return; }
                        state = 'aim'; flyT = 0;
                    }
                }
            },
            down(x, y) { if (state === 'aim') trail = [{ x, y, t: performance.now() }]; },
            move(x, y) { if (state === 'aim' && trail.length) { trail.push({ x, y, t: performance.now() }); if (trail.length > 14) trail.shift(); } },
            up(x, y) {
                if (state !== 'aim' || trail.length < 2) { trail = []; return; }
                const a = trail[0], b = trail[trail.length - 1];
                const dt2 = Math.max(16, b.t - a.t);
                const dx = b.x - a.x, dy = b.y - a.y;
                const dist = Math.hypot(dx, dy);
                if (dist < 30) { trail = []; return; }
                power = dist / dt2 * 1000;
                lastPower = power;
                const vertical = dy / dist > 0.55; // 아래 방향 비율
                willFlip = Math.random() < flipChance(power, vertical);
                state = 'fly'; flyT = 0; throwsLeft--;
                msg = vertical ? '' : '비스듬했다!';
                trail = [];
            },
            render(ts) {
                const sx = shake > 0 ? rand(-6, 6) * shake : 0;
                const sy = shake > 0 ? rand(-4, 4) * shake : 0;
                ctx.save(); ctx.translate(sx, sy);
                ctx.fillStyle = '#8d7355'; ctx.fillRect(0, 0, W, H); // 흙바닥
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                for (let i = 0; i < 5; i++) ctx.fillRect(0, H * 0.2 * i, W, 2);

                const o = oppPos();
                // 상대 딱지 (파랑) — 뒤집힘 애니메이션
                const flipScale = oppFlip > 0 ? Math.cos(oppFlip * Math.PI) : 1;
                ctx.save();
                ctx.translate(o.x, o.y);
                ctx.scale(1, Math.abs(flipScale) < 0.1 ? 0.1 : flipScale);
                ctx.fillStyle = flipScale < 0 ? '#fca5a5' : '#3b82f6'; // 뒤집히는 동안 배면 노출
                roundRect(-46, -46, 92, 92, 8); ctx.fill();
                ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(-46, 0); ctx.lineTo(46, 0); ctx.moveTo(0, -46); ctx.lineTo(0, 46); ctx.stroke();
                ctx.restore();

                // 내 딱지 (빨강) — 날아가는 중
                if (state === 'fly') {
                    const t = flyT;
                    const x = W / 2, y0 = -60, y = y0 + (o.y - y0) * (t * t);
                    ctx.save();
                    ctx.translate(x, y); ctx.rotate(t * 9);
                    ctx.fillStyle = '#e53935';
                    roundRect(-40, -40, 80, 80, 8); ctx.fill();
                    ctx.restore();
                } else {
                    ctx.save();
                    ctx.translate(W * 0.5, H * 0.87);
                    ctx.fillStyle = '#e53935';
                    roundRect(-36, -36, 72, 72, 7); ctx.fill();
                    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
                    ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(36, 0); ctx.moveTo(0, -36); ctx.lineTo(0, 36); ctx.stroke();
                    ctx.restore();
                }

                // 파워 게이지 (스위트 존 표시)
                const gx = 20, gw = W - 40, gy = H - 56;
                ctx.fillStyle = 'rgba(0,0,0,0.35)';
                roundRect(gx, gy, gw, 12, 6); ctx.fill();
                const sweetA = gx + gw * (400 / 2600), sweetB = gx + gw * (2400 / 2600);
                ctx.fillStyle = 'rgba(74,222,128,0.45)';
                roundRect(sweetA, gy, sweetB - sweetA, 12, 6); ctx.fill();
                if (lastPower > 0) {
                    const px = gx + gw * clamp(lastPower / 2600, 0, 1);
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillRect(px - 2, gy - 4, 4, 20);
                }
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.font = '600 12px -apple-system, sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'top';
                ctx.fillText('약함 ←  스윙 세기  → 너무 셈', W / 2, gy + 18);

                topText(`${flips}/2 뒤집기 · 남은 기회 ${throwsLeft}`, msg);
                ctx.restore();
            },
        };
    };

    // ---------- 4. 제기차기 ----------
    makeScene.jegi = () => {
        let jx = 0, jy = 0, vx = 0, vy = 0, kicks = 0, attempts = 3, spin = 0;
        let footX = 0, kickFlash = 0, started = false;
        function toss() {
            jx = W / 2; jy = H * 0.35; vx = rand(-40, 40); vy = -150;
            started = true;
        }
        return {
            update(dt) {
                if (!started) { toss(); footX = W / 2; }
                kickFlash = Math.max(0, kickFlash - dt * 4);
                vy += 1050 * dt;
                jx += vx * dt; jy += vy * dt;
                spin += vx * dt * 0.02;
                if (jx < 30) { jx = 30; vx = Math.abs(vx) * 0.8; }
                if (jx > W - 30) { jx = W - 30; vx = -Math.abs(vx) * 0.8; }
                footX += (jx - footX) * Math.min(1, dt * 6);
                if (jy > H - 120) {
                    attempts--;
                    beep(140, 0.3, 'sawtooth', 0.2);
                    if (attempts <= 0) { finishRound(false, `${kicks}개에서 떨어뜨렸다`); return; }
                    toss();
                }
            },
            down(x, y) {
                if (jy > H * 0.45 && jy < H - 110) {
                    kicks++; kickFlash = 1;
                    vy = -(640 + rand(0, 130));
                    vx = clamp((W / 2 - jx) * 1.6 + rand(-90, 90), -280, 280);
                    beep(rand(700, 880), 0.08, 'triangle', 0.15);
                    if (navigator.vibrate) navigator.vibrate(25);
                    burst(jx, jy + 10, ['#fbbf24', '#fff'], 6, 120);
                    if (kicks >= 10) finishRound(true, `목숨 ${attempts}개 남기고 10개 달성!`);
                }
            },
            render(ts) {
                ctx.fillStyle = '#7dd3fc'; ctx.fillRect(0, 0, W, H); // 하늘
                ctx.fillStyle = '#86c06c'; ctx.fillRect(0, H - 100, W, 100); // 잔디
                // 킥 존 표시
                ctx.fillStyle = 'rgba(255,255,255,0.18)';
                ctx.fillRect(0, H * 0.45, W, H - 110 - H * 0.45);
                ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.setLineDash([8, 8]); ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(0, H * 0.45); ctx.lineTo(W, H * 0.45); ctx.stroke();
                ctx.setLineDash([]);
                // 제기 (술 3가닥 + 엽전)
                ctx.save();
                ctx.translate(jx, jy); ctx.rotate(spin);
                const cols = ['#f87171', '#fbbf24', '#60a5fa'];
                for (let i = -1; i <= 1; i++) {
                    ctx.strokeStyle = cols[i + 1]; ctx.lineWidth = 4; ctx.lineCap = 'round';
                    ctx.beginPath(); ctx.moveTo(0, 0);
                    ctx.quadraticCurveTo(i * 10, -16, i * 14, -30);
                    ctx.stroke();
                }
                ctx.beginPath(); ctx.arc(0, 4, 9, 0, Math.PI * 2);
                ctx.fillStyle = '#d4a24c'; ctx.fill();
                ctx.strokeStyle = '#8a5a18'; ctx.lineWidth = 2; ctx.stroke();
                ctx.beginPath(); ctx.arc(0, 4, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#8a5a18'; ctx.fill();
                ctx.restore();
                // 차는 사람 (슬라임)
                drawSlime(footX, H - 86, 17, { t: ts, squash: 1, dirX: 0 });
                if (kickFlash > 0) {
                    ctx.strokeStyle = `rgba(255,255,255,${kickFlash})`; ctx.lineWidth = 3;
                    ctx.beginPath(); ctx.arc(footX, H - 100, 24 + (1 - kickFlash) * 16, 0, Math.PI * 2); ctx.stroke();
                }
                topText(`${kicks} / 10개`, `기회 ${'🩴'.repeat(attempts)} · 띠가 흰 구간에 올 때 탭!`);
            },
        };
    };

    // ---------- 5. 징검다리 ----------
    makeScene.bridge = () => {
        const ROWS = 7;
        const safe = Array.from({ length: ROWS }, () => Math.random() < 0.5 ? 0 : 1);
        let step = 0, phase = 'preview', t = 3.2, anim = 0, animFrom = null, falling = 0, failed = false;
        const paneY = i => H - 180 - i * ((H - 320) / (ROWS - 1));
        const paneX = s => W / 2 + (s === 0 ? -80 : 80);

        return {
            update(dt) {
                if (phase === 'preview') {
                    t -= dt;
                    if (t <= 0) { phase = 'play'; beep(520, 0.15, 'triangle'); }
                } else if (phase === 'hop') {
                    anim += dt * 4;
                    if (anim >= 1) { phase = 'play'; anim = 0; }
                } else if (phase === 'fall') {
                    falling += dt;
                    if (falling > 0.8 && !failed) { failed = true; finishRound(false, `${step + 1}번째 칸에서 유리가 깨졌다!`); }
                }
            },
            down(x, y) {
                if (phase !== 'play' || step >= ROWS) return;
                const py = paneY(step);
                if (Math.abs(y - py) > 40) return;
                const side = x < W / 2 ? 0 : 1;
                if (side === safe[step]) {
                    animFrom = { x: step === 0 ? W / 2 : paneX(safe[step - 1]), y: step === 0 ? H - 110 : paneY(step - 1) };
                    phase = 'hop'; anim = 0;
                    beep(620 + step * 40, 0.1, 'triangle', 0.15);
                    step++;
                    if (step >= ROWS) setTimeout(() => finishRound(true, '7칸 전부 기억해냈다!'), 350);
                } else {
                    phase = 'fall'; falling = 0;
                    beep(130, 0.6, 'sawtooth', 0.25);
                    if (navigator.vibrate) navigator.vibrate(200);
                    burst(paneX(side), paneY(step), ['#bae6fd', '#7dd3fc', '#fff'], 24, 260);
                }
            },
            render(ts) {
                ctx.fillStyle = '#0c1322'; ctx.fillRect(0, 0, W, H);
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                for (let i = 0; i < 30; i++) {
                    ctx.globalAlpha = 0.2 + (i * 37 % 10) / 20;
                    ctx.fillRect((i * 97) % W, (i * 211) % H, 1.5, 1.5);
                }
                ctx.globalAlpha = 1;
                // 시작 발판 (도착은 맨 윗줄 너머 — 상단 안내와 겹쳐서 라벨 생략)
                ctx.fillStyle = '#475569';
                roundRect(W / 2 - 90, H - 140, 180, 60, 10); ctx.fill();
                // 유리판
                for (let i = 0; i < ROWS; i++) {
                    for (const s of [0, 1]) {
                        const px = paneX(s), py = paneY(i);
                        const isSafe = safe[i] === s;
                        const revealed = phase === 'preview' || (i < step) || (phase === 'fall' && i === step);
                        ctx.fillStyle = revealed && isSafe ? 'rgba(74,222,128,0.4)'
                            : revealed && !isSafe ? 'rgba(248,113,113,0.25)'
                                : 'rgba(125,211,252,0.28)';
                        roundRect(px - 56, py - 20, 112, 40, 8); ctx.fill();
                        ctx.strokeStyle = 'rgba(186,230,253,0.6)'; ctx.lineWidth = 1.5;
                        roundRect(px - 56, py - 20, 112, 40, 8); ctx.stroke();
                        if (phase === 'preview' && isSafe) {
                            ctx.fillStyle = '#bbf7d0'; ctx.font = '800 18px -apple-system, sans-serif';
                            ctx.fillText('✓', px, py);
                        }
                    }
                }
                // 슬라임
                let sx2, sy2;
                if (phase === 'fall') {
                    sx2 = paneX(1 - safe[step]); sy2 = paneY(step) + falling * falling * 900;
                } else if (phase === 'hop' && animFrom) {
                    const tx = paneX(safe[step - 1]), ty2 = paneY(step - 1);
                    sx2 = animFrom.x + (tx - animFrom.x) * anim;
                    sy2 = animFrom.y + (ty2 - animFrom.y) * anim - Math.sin(anim * Math.PI) * 46;
                } else if (step === 0) {
                    sx2 = W / 2; sy2 = H - 110;
                } else {
                    sx2 = paneX(safe[step - 1]); sy2 = paneY(step - 1) - 8;
                }
                drawSlime(sx2, sy2, 16, { t: ts, squash: phase === 'hop' ? 1 : 0, dirX: 0 });
                topText(
                    phase === 'preview' ? `외워! ${Math.ceil(t)}` : `${step} / ${ROWS}칸`,
                    phase === 'preview' ? '초록 ✓ 가 안전한 유리' : '기억대로 안전한 쪽을 탭!'
                );
            },
        };
    };

    // ---------- 6. 줄다리기 ----------
    makeScene.tug = () => {
        let m = 0, lastSide = null, t = 0, hint = 0, jerk = 0, done = false;
        return {
            update(dt) {
                if (done) return;
                t += dt;
                m += (0.055 + t * 0.005) * dt; // 상대팀이 점점 세게 당김
                jerk = Math.max(0, jerk - dt * 6);
                hint = Math.max(0, hint - dt * 2);
                if (m >= 0.45) { done = true; finishRound(false, '진흙탕에 끌려갔다…'); }
                if (m <= -0.45) { done = true; finishRound(true, `${Math.ceil(t)}초 만에 끌어왔다!`); }
                if (t > 30 && !done) { done = true; finishRound(m < 0, m < 0 ? '판정승!' : '판정패…'); }
            },
            down(x) {
                if (done) return;
                const side = x < W / 2 ? 'L' : 'R';
                if (side !== lastSide) {
                    lastSide = side;
                    m -= 0.032; jerk = 1;
                    beep(side === 'L' ? 300 : 380, 0.05, 'square', 0.1);
                    if (navigator.vibrate) navigator.vibrate(12);
                } else {
                    hint = 1;
                }
            },
            render(ts) {
                ctx.fillStyle = '#86c06c'; ctx.fillRect(0, 0, W, H);
                // 진흙탕
                ctx.fillStyle = '#8d7355';
                ctx.beginPath(); ctx.ellipse(W / 2, H * 0.5, 70, 34, 0, 0, Math.PI * 2); ctx.fill();
                // 줄
                const ropeY = H * 0.5, fx = W / 2 + m * W * 0.7;
                ctx.strokeStyle = '#b8a06a'; ctx.lineWidth = 9; ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(40, ropeY + (jerk ? rand(-3, 3) : 0));
                ctx.lineTo(W - 40, ropeY + (jerk ? rand(-3, 3) : 0));
                ctx.stroke();
                // 가운데 깃발 (m 따라 이동)
                ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
                ctx.beginPath(); ctx.moveTo(fx, ropeY); ctx.lineTo(fx, ropeY - 36); ctx.stroke();
                ctx.fillStyle = '#e53935';
                ctx.beginPath(); ctx.moveTo(fx, ropeY - 36); ctx.lineTo(fx + 26, ropeY - 28); ctx.lineTo(fx, ropeY - 20); ctx.closePath(); ctx.fill();
                // 승부선
                ctx.strokeStyle = 'rgba(229,57,53,0.7)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2;
                ctx.beginPath(); ctx.moveTo(W / 2 - 0.45 * W * 0.7, ropeY - 50); ctx.lineTo(W / 2 - 0.45 * W * 0.7, ropeY + 50); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(W / 2 + 0.45 * W * 0.7, ropeY - 50); ctx.lineTo(W / 2 + 0.45 * W * 0.7, ropeY + 50); ctx.stroke();
                ctx.setLineDash([]);
                // 우리팀 슬라임 (왼쪽 3) — 줄 따라 같이 이동
                for (let i = 0; i < 3; i++) {
                    drawSlime(fx - 60 - i * 44, ropeY + 6, 15, { t: ts + i * 300, squash: 1, dirX: -1 });
                }
                // 상대팀 보스 슬라임 (오른쪽 3)
                for (let i = 0; i < 3; i++) {
                    drawSlime(fx + 60 + i * 48, ropeY + 6, 16, { t: ts + i * 200, squash: 1, dirX: 1, color: '#8e24aa', dark: '#4a148c', crown: i === 2, angry: true });
                }
                // 탭 존 안내
                const expectL = lastSide !== 'L';
                ctx.fillStyle = expectL ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)';
                roundRect(16, H - 150, W / 2 - 28, 110, 14); ctx.fill();
                ctx.fillStyle = !expectL ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.07)';
                roundRect(W / 2 + 12, H - 150, W / 2 - 28, 110, 14); ctx.fill();
                ctx.fillStyle = 'rgba(0,0,0,0.55)';
                ctx.font = '800 22px -apple-system, sans-serif';
                ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
                ctx.fillText('왼쪽', W * 0.27, H - 95);
                ctx.fillText('오른쪽', W * 0.73, H - 95);
                topText('영차! 영차!', hint > 0.3 ? '⚠️ 번갈아 두드려야 힘이 실려요!' : `⏱ ${Math.ceil(Math.max(0, 30 - t))}초 · 빨간 선까지 끌어오면 승리`);
            },
        };
    };

    // ===== 메뉴/버튼 배선 =====
    document.querySelectorAll('.gameCard').forEach(btn => {
        btn.addEventListener('click', () => { ensureAudio(); startFree(btn.dataset.game); });
    });
    document.querySelector('.survivalCard').addEventListener('click', () => { ensureAudio(); startSurvival(); });
    $('introStart').addEventListener('click', () => {
        introOverlay.classList.add('hidden');
        resize();
        running = true;
    });
    $('resultMenu').addEventListener('click', backToMenu);
    $('quitBtn').addEventListener('click', backToMenu);

    // 디버그/테스트용 핸들
    window.__arcade = { startFree, startSurvival, finishRound: (ok) => finishRound(ok, '디버그') };

    resize();
    requestAnimationFrame(ts => { lastTs = ts; requestAnimationFrame(loop); });
})();
