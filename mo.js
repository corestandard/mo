// ==UserScript==
// @name         모닥 온라인 보스 오토봇 v3.86 (1s Departure & 8x Portal Retry)
// @namespace    http://tampermonkey.net/
// @version      3.86
// @match        https://modakmmo.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/corestandard/mo/refs/heads/main/mo.js
// @updateURL    https://raw.githubusercontent.com/corestandard/mo/refs/heads/main/mo.js
// ==/UserScript==

(function() {
    'use strict';

    // 💡 [전체 캠프파이어 좌표]
    const CAMPFIRES = {
        "모닥 마을": { x: 73.00, y: 194.70, wpIndex: 0 },
        "망자의 묘지": { x: 561.00, y: 304.50, wpIndex: 1 },
        "잊혀진 고성 중앙부": { x: 783.00, y: 116.00, wpIndex: 2 },
        "뼈바람 협곡": { x: 33.00, y: 432.67, wpIndex: 3 },
        "붉은숲 피난처": { x: -4.50, y: 605.75, wpIndex: 4 }
    };

    const TOWN_SHOP = { x: 42.40, y: 184.74 };

    // 💡 [실측 기반 보스 전투 위치]
    const BOSS_TARGETS = {
        0: { map: "망국의 기록보관소", x: 669.62, y: 64.92, name: "악몽의 집합체" },
        1: { map: "망국의 병기창", x: 911.74, y: 198.19, name: "망국의 마장기", entryPath: [{ x: 867.44, y: 175.89 }] },
        2: { map: "잊혀진 고성 입구", x: 676.55, y: 138.20, name: "망령 공성대장" },
        3: { map: "망자의 묘지", x: 563.44, y: 211.36, name: "공허의 해골마도사" },
        4: { map: "초원", x: 270.64, y: 258.64, name: "고대 점액군주" },
        5: { map: "황야", x: 375.49, y: 336.55, name: "태양가시 거수" },
        6: { map: "그늘숲", x: -5.14, y: 323.57, name: "스컬 워로드" },
        7: { map: "협곡 진입로", x: -30.19, y: 399.00, name: "뼈바람 포식자" },
        8: { map: "수호자의 안식처", x: 37.21, y: 558.92, name: "뒤틀린 태초목" },
        9: { map: "붉은숲 피난처", x: -72.18, y: 616.09, name: "붉은송곳니 우두머리" },
        10: { map: "고요한 숲길", x: 133.08, y: 683.38, name: "숲길의 두 사슴" }
    };

    // 💡 [최우선 긴급 출동 보스 목록] (1: 망국의 마장기, 10: 숲길의 두 사슴)
    const PRIORITY_BOSSES = new Set([1, 10]);

    // 💡 [기본 사냥터 실측 위치]
    const HUNTING_GROUNDS = [
        { id: "wasteland_1", name: "황야1 (큰거 - 선인장 액기스)", map: "황야", x: 428.85, y: 291.00 },
        { id: "wasteland_2", name: "황야2 (작은거 - 선인장 액기스)", map: "황야", x: 349.09, y: 290.61 },
        { id: "canyon_entry", name: "협곡 진입로 (피울음 가죽갑옷)", map: "협곡 진입로", x: -28.44, y: 394.10 },
        { id: "bone_canyon", name: "뼈바람 협곡 (강철비 화살통, 혈석 반지)", map: "뼈바람 협곡", x: 61.13, y: 455.27 },
        { id: "bone_canyon_2", name: "뼈바람 협곡2 (강철비 화살통, 혈석 반지)", map: "뼈바람 협곡", x: -27.93, y: 462.34 },
        { id: "archive", name: "망국의 기록 보관소 (잊히지 않은 기도)", map: "망국의 기록보관소", x: 700.23, y: 47.21 },
        { id: "castle_center_east", name: "잊혀진 고성 중앙부_동쪽 (추격의 반지)", map: "잊혀진 고성 중앙부", x: 858.13, y: 114.99 },
        { id: "castle_center_west", name: "잊혀진 고성 중앙부_서쪽 (추격의 반지)", map: "잊혀진 고성 중앙부", x: 696.95, y: 114.46 },
        { id: "castle_center_south", name: "잊혀진 고성 중앙부_남쪽 (추격의 반지)", map: "잊혀진 고성 중앙부", x: 783.05, y: 153.89 },
        { id: "castle_center_north", name: "잊혀진 고성 중앙부_북쪽 (추격의 반지)", map: "잊혀진 고성 중앙부", x: 780.01, y: 78.05 },
        { id: "shade_forest_11", name: "그늘숲 11시 (오크의 전투나팔)", map: "그늘숲", x: 38.35, y: 311.38 },
        { id: "shade_forest_3", name: "그늘숲 3시 (오크의 전투나팔)", map: "그늘숲", x: 139.18, y: 331.48 }
    ];

    // 💡 [월드맵 맵 간 연결 그래프 데이터]
    const MAP_EDGES = {
        "모닥 마을": [
            { to: "초원", portal: { x: 121.60, y: 218.42 } }
        ],
        "초원": [
            { to: "모닥 마을", portal: { x: 136.51, y: 234.65 } },
            { to: "그늘숲", portal: { x: 107.04, y: 270.50 } },
            { to: "황야", portal: { x: 242.69, y: 285.56 } }
        ],
        "황야": [
            { to: "초원", portal: { x: 273.07, y: 291.00 } },
            { to: "망자의 묘지", portal: { x: 476.91, y: 292.01 } }
        ],
        "망자의 묘지": [
            { to: "황야", portal: { x: 512.98, y: 287.69 } },
            { to: "잊혀진 고성 입구", portal: { x: 611.46, y: 231.74 } }
        ],
        "잊혀진 고성 입구": [
            { to: "망자의 묘지", portal: { x: 625.01, y: 216.63 } },
            { to: "잊혀진 고성 중앙부", portal: { x: 729.80, y: 163.28 } }
        ],
        "잊혀진 고성 중앙부": [
            { to: "잊혀진 고성 입구", portal: { x: 736.21, y: 140.12 } },
            { to: "망국의 병기창", portal: { x: 825.89, y: 137.35 } },
            { to: "망국의 기록보관소", portal: { x: 733.03, y: 91.28 } }
        ],
        "망국의 병기창": [
            { to: "잊혀진 고성 중앙부", portal: { x: 899.13, y: 141.24 }, waypoints: [{ x: 867.44, y: 175.89 }] }
        ],
        "망국의 기록보관소": [
            { to: "잊혀진 고성 중앙부", portal: { x: 687.38, y: 74.65 } }
        ],
        "뼈바람 협곡": [
            { to: "협곡 진입로", portal: { x: 3.94, y: 433.45 } }
        ],
        "협곡 진입로": [
            { to: "뼈바람 협곡", portal: { x: -11.66, y: 424.02 } },
            { to: "그늘숲", portal: { x: 3.57, y: 366.65 } }
        ],
        "그늘숲": [
            { to: "협곡 진입로", portal: { x: 15.36, y: 355.78 } }
        ],
        "붉은숲 피난처": [
            { to: "수호자의 안식처", portal: { x: 62.15, y: 594.78 } },
            { to: "고요한 숲길", portal: { x: 35.46, y: 658.50 } }
        ],
        "수호자의 안식처": [
            { to: "붉은숲 피난처", portal: { x: 70.13, y: 584.31 } }
        ],
        "고요한 숲길": [
            { to: "붉은숲 피난처", portal: { x: 50.61, y: 670.04 } }
        ]
    };

    let selectedHuntingGround = localStorage.getItem('modak_default_ground') || "wasteland_1";
    let isBossHuntingEnabled = localStorage.getItem('modak_boss_hunt_enabled') !== 'false';
    let isShopSellEnabled = localStorage.getItem('modak_shop_sell_enabled') !== 'false';
    let bossHuntStartHour = parseInt(localStorage.getItem('modak_boss_start_hour') ?? '0', 10);
    let bossHuntEndHour = parseInt(localStorage.getItem('modak_boss_end_hour') ?? '24', 10);

    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    const randomSleep = (minMs, maxMs) => new Promise(r => setTimeout(r, Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs));

    function fireKey(type, keyChar) {
        const char = keyChar.toLowerCase();
        const code = char.charCodeAt(0);
        document.dispatchEvent(new KeyboardEvent(type, { key: char, code: 'Key' + char.toUpperCase(), keyCode: code, which: code, bubbles: true }));
    }

    function simulateKey(keyChar, duration = 100) {
        fireKey('keydown', keyChar);
        setTimeout(() => fireKey('keyup', keyChar), duration);
    }

    function getCoords() {
        const svg = document.querySelector('svg.hud-minimap-image');
        if (!svg) return null;
        const viewBox = svg.getAttribute('viewBox');
        if (!viewBox) return null;
        const [vx, vy, vw, vh] = viewBox.split(' ').map(Number);

        const calibratedX = vx + (vw - 150) / 2;
        const calibratedY = vy + (vh - 112.5) / 2;

        return { x: calibratedX, y: calibratedY };
    }

    function getCurrentMapName() {
        const mapNameEl = document.getElementsByClassName("panel-list-name")[0];
        return mapNameEl ? mapNameEl.innerText.trim() : "";
    }

    async function waitForMap(expectedName, timeoutSec = 15) {
        console.log(`  -> [맵 전환 대기] '${expectedName}' 확인 중 (최대 ${timeoutSec}초)`);
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutSec * 1000) {
            const cur = getCurrentMapName();
            if (cur.includes(expectedName)) {
                await randomSleep(250, 400);
                return true;
            }
            await sleep(150);
        }
        return false;
    }

    function forceClickElement(el) {
        if (!el) return;
        try {
            if (window.focus) window.focus();
            el.focus?.();
            const opts = { bubbles: true, cancelable: true, view: window };
            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.click();
        } catch (e) {
            el.click();
        }
    }

    // 💡 연속 글라이딩 + 관성 예측 조기 브레이크 엔진
    async function glideToTarget(targetX, targetY, radiusX = 3.5, radiusY = 2.8, maxTimeoutSec = 20) {
        console.log(`🧭 [글라이딩] (${targetX.toFixed(2)}, ${targetY.toFixed(2)}) 이동 시작`);
        const startTime = Date.now();
        let activeKeys = new Set();

        const updateKeys = (desiredKeys) => {
            const nextSet = new Set(desiredKeys);
            for (const k of activeKeys) {
                if (!nextSet.has(k)) fireKey('keyup', k);
            }
            for (const k of nextSet) {
                if (!activeKeys.has(k)) fireKey('keydown', k);
            }
            activeKeys = nextSet;
        };

        const stopAll = () => {
            for (const k of activeKeys) fireKey('keyup', k);
            activeKeys.clear();
        };

        let prevPos = null;
        let lastMoveProgressTime = Date.now();

        try {
            while (Date.now() - startTime < maxTimeoutSec * 1000) {
                const cur = getCoords();
                if (!cur) { await sleep(45); continue; }

                const velX = prevPos ? (cur.x - prevPos.x) : 0;
                const velY = prevPos ? (cur.y - prevPos.y) : 0;

                const predictedX = cur.x + velX * 1.2;
                const predictedY = cur.y + velY * 1.2;

                const diffX = targetX - cur.x;
                const diffY = targetY - cur.y;
                const absX = Math.abs(diffX);
                const absY = Math.abs(diffY);

                // 1. 목표 반경 진입 시 즉시 정지
                if (absX <= radiusX && absY <= radiusY) {
                    stopAll();
                    await sleep(60);
                    return true;
                }

                // 2. 관성 예측 위치가 목표 반경 안이면 미리 키를 떼고 자연스럽게 감속
                if (Math.abs(targetX - predictedX) <= radiusX && Math.abs(targetY - predictedY) <= radiusY && activeKeys.size > 0) {
                    stopAll();
                    await sleep(100);
                    prevPos = getCoords();
                    continue;
                }

                // 3. 완전히 멈춘 상태에서 코앞(4.5 이내) 미세 보정
                if (absX <= 4.5 && absY <= 4.5 && Math.hypot(velX, velY) < 0.15) {
                    const nudgeKeys = [];
                    if (diffX > radiusX) nudgeKeys.push('d');
                    else if (diffX < -radiusX) nudgeKeys.push('a');
                    if (diffY > radiusY) nudgeKeys.push('s');
                    else if (diffY < -radiusY) nudgeKeys.push('w');

                    if (nudgeKeys.length === 0) return true;

                    for (const k of nudgeKeys) fireKey('keydown', k);
                    await sleep(110);
                    for (const k of nudgeKeys) fireKey('keyup', k);
                    await sleep(85);
                    prevPos = getCoords();
                    continue;
                }

                // 4. 원거리(4.5 초과) 끼임 감지
                if (absX > 4.5 || absY > 4.5) {
                    if (prevPos) {
                        const distMoved = Math.hypot(velX, velY);
                        if (distMoved > 0.35) {
                            lastMoveProgressTime = Date.now();
                        } else if (Date.now() - lastMoveProgressTime > 900) {
                            stopAll();
                            const unstickKey = diffX > 0 ? 's' : 'w';
                            fireKey('keydown', unstickKey);
                            await sleep(220);
                            fireKey('keyup', unstickKey);
                            lastMoveProgressTime = Date.now();
                            prevPos = getCoords();
                            continue;
                        }
                    }
                }

                // 5. 기본 연속 주행
                const desired = [];
                if (diffX > radiusX) desired.push('d');
                else if (diffX < -radiusX) desired.push('a');

                if (diffY > radiusY) desired.push('s');
                else if (diffY < -radiusY) desired.push('w');

                updateKeys(desired);
                prevPos = cur;
                await sleep(45);
            }
        } finally {
            stopAll();
        }
        return false;
    }

    function getMountButton() {
        return document.querySelector('.hud-movement-actions button.quick-action-slot[aria-label="탑승"], .hud-movement-actions button.quick-action-slot[aria-label="내리기"]') ||
               document.querySelector('button.quick-action-slot[title*="탑승"], button.quick-action-slot[title*="내리기"]');
    }

    function isCurrentlyMounted() {
        const btn = getMountButton();
        if (!btn) return false;
        return btn.getAttribute('aria-pressed') === 'true' ||
               btn.classList.contains('is-active') ||
               btn.getAttribute('aria-label') === '내리기';
    }

    // 💡 [초고속 탑승] 불필요한 대기 제거 (이미 탑승 중이면 즉시 통과)
    async function ensureMount(maxRetries = 3) {
        if (isCurrentlyMounted()) return true;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (document.querySelector('section.loot-panel')) {
                await ensureLootPanelClosed(600);
            }

            const mountBtn = getMountButton();
            if (!mountBtn) simulateKey('r', 80);
            else forceClickElement(mountBtn);

            const waitStart = Date.now();
            while (Date.now() - waitStart < 900) {
                await sleep(80);
                if (isCurrentlyMounted()) {
                    await sleep(80);
                    return true;
                }
            }
            simulateKey('Escape');
            await sleep(120);
        }
        return false;
    }

    async function ensureLootPanelClosed(timeoutMs = 3000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const lootPanel = document.querySelector('section.loot-panel');
            const closeBtn = document.querySelector('button[aria-label="전리품 닫기"]') ||
                             (lootPanel && lootPanel.querySelector('button[aria-label="전리품 닫기"]'));

            if (!lootPanel && !closeBtn) return true;
            if (closeBtn) forceClickElement(closeBtn);
            else simulateKey('Escape');
            await sleep(250);
        }
        return false;
    }

    async function checkWaypointMenu(timeoutMs = 2500) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (document.getElementsByClassName("waypoint-destination").length > 0) return "campfire";
            const wrong = document.querySelector('section.job-panel, [aria-labelledby="promotion-title"], section.shop-panel, .dialogue-box');
            if (wrong) {
                simulateKey('Escape');
                await sleep(200);
                return "wrong_npc";
            }
            await sleep(100);
        }
        return "none";
    }

    // 💡 현재 맵에 존재하는 캠프파이어와 상호작용
    async function interactWithLocalCampfire() {
        const curMap = getCurrentMapName();
        const camp = CAMPFIRES[curMap];
        if (!camp) return false;

        console.log(`🔥 [캠프파이어 접근] ${curMap} 모닥불로 글라이딩...`);
        await setAutoHunting(false);
        await ensureMount();

        for (let attempt = 1; attempt <= 3; attempt++) {
            await glideToTarget(camp.x, camp.y, 2.5, 2.0, 12);
            await sleep(120);

            simulateKey('f');
            const res = await checkWaypointMenu(2000);

            if (res === "campfire") {
                console.log(`🎉 [모닥불 열림] ${curMap} 웨이포인트 메뉴 오픈 성공`);
                return true;
            } else if (res === "wrong_npc") {
                fireKey('keydown', 's');
                await sleep(300);
                fireKey('keyup', 's');
                await sleep(150);
            } else {
                simulateKey('Escape');
                await sleep(250);
            }
        }
        return false;
    }

    // 💡 최단 경로(BFS) 탐색: startMap -> targetMap 이동 계획 수립
    function findPathBetweenMaps(startMap, targetMap) {
        if (startMap === targetMap) return [];

        const queue = [[startMap, []]];
        const visited = new Set([startMap]);

        while (queue.length > 0) {
            const [current, path] = queue.shift();
            const edges = MAP_EDGES[current] || [];

            for (const edge of edges) {
                if (edge.to === targetMap) {
                    return [...path, edge];
                }
                if (!visited.has(edge.to)) {
                    visited.add(edge.to);
                    queue.push([edge.to, [...path, edge]]);
                }
            }
        }
        return null;
    }

    // 💡 [포탈 재시도 8회 적용] 매 시도마다 탈것 확인 + 포탈 정중앙 재이동 + F 입력을 함께 수행
    async function traversePortalStep(step) {
        await ensureMount();

        if (step.waypoints) {
            for (const wp of step.waypoints) {
                await glideToTarget(wp.x, wp.y, 2.5, 2.0, 15);
            }
        }

        for (let attempt = 1; attempt <= 8; attempt++) {
            if (getCurrentMapName().includes(step.to)) return true;

            const rx = attempt === 1 ? 1.8 : 1.2;
            const ry = attempt === 1 ? 1.6 : 1.2;

            await ensureMount();
            await glideToTarget(step.portal.x, step.portal.y, rx, ry, 10);
            await sleep(60);

            if (document.querySelector('section.loot-panel')) {
                await ensureLootPanelClosed(600);
            }

            simulateKey('f', 100);

            const waitStart = Date.now();
            while (Date.now() - waitStart < 1500) {
                if (getCurrentMapName().includes(step.to)) {
                    await sleep(250);
                    return true;
                }
                await sleep(100);
            }

            console.log(`  -> [포탈 재시도 ${attempt}/8] '${step.to}' 포탈 정중앙 재이동 후 다시 진입합니다.`);
        }

        return false;
    }

    // 💡 [핵심 라우터] 이동 시작 시 자동 전투를 먼저 끄고 최단 경로로 이동
    async function navigateToMap(targetMap) {
        await setAutoHunting(false);

        let curMap = getCurrentMapName();
        if (curMap === targetMap) return true;

        console.log(`🗺️ [스마트 라우팅 시작] '${curMap}' ➔ '${targetMap}'`);

        // 1. 도보 연결 거리 확인 (포탈 1회 이하 경유로 직행 가능한지)
        const walkPath = findPathBetweenMaps(curMap, targetMap);

        if (walkPath && walkPath.length <= 1) {
            console.log(`  -> [인접 포탈 직행] 포탈 ${walkPath.length}회 경유로 이동합니다.`);
            for (const step of walkPath) {
                const ok = await traversePortalStep(step);
                if (!ok) return false;
            }
            return true;
        }

        // 2. 현재 맵에 캠프파이어가 없다면, 가장 가까운 캠프파이어가 있는 맵으로 이동
        if (!CAMPFIRES[curMap]) {
            console.log(`  -> 현재 맵('${curMap}')에 캠프파이어 없음. 캠프파이어 보유 맵으로 이동합니다.`);
            let bestPath = null;

            for (const campMap of Object.keys(CAMPFIRES)) {
                const p = findPathBetweenMaps(curMap, campMap);
                if (p && (!bestPath || p.length < bestPath.length)) {
                    bestPath = p;
                }
            }

            if (bestPath) {
                for (const step of bestPath) {
                    const ok = await traversePortalStep(step);
                    if (!ok) return false;
                }
                curMap = getCurrentMapName();
            } else {
                console.log("  -> 캠프파이어 보유 맵 연결 실패. 비상 마을 귀환(B) 실행");
                await smartReturnTown();
                curMap = getCurrentMapName();
            }
        }

        // 3. 목표 맵에 캠프파이어가 직접 있다면 웨이포인트 즉시 탑승
        if (CAMPFIRES[targetMap]) {
            const ok = await interactWithLocalCampfire();
            if (!ok) return false;

            const dests = document.getElementsByClassName("waypoint-destination");
            const wpIdx = CAMPFIRES[targetMap].wpIndex;
            if (dests && dests[wpIdx]) {
                dests[wpIdx].click();
                return await waitForMap(targetMap, 15);
            }
            return false;
        }

        // 4. 목표 맵에 캠프파이어가 없다면, 목표 맵과 가장 인접한 캠프파이어 맵으로 웨이포인트 이동 후 포탈 탑승
        let bestTargetCamp = null;
        let bestSubPath = null;

        for (const campMap of Object.keys(CAMPFIRES)) {
            const p = findPathBetweenMaps(campMap, targetMap);
            if (p && (!bestSubPath || p.length < bestSubPath.length)) {
                bestSubPath = p;
                bestTargetCamp = campMap;
            }
        }

        if (bestTargetCamp) {
            if (curMap !== bestTargetCamp) {
                const ok = await interactWithLocalCampfire();
                if (!ok) return false;

                const dests = document.getElementsByClassName("waypoint-destination");
                const wpIdx = CAMPFIRES[bestTargetCamp].wpIndex;
                if (dests && dests[wpIdx]) {
                    dests[wpIdx].click();
                    const transOk = await waitForMap(bestTargetCamp, 15);
                    if (!transOk) return false;
                }
            }

            for (const step of bestSubPath) {
                const ok = await traversePortalStep(step);
                if (!ok) return false;
            }
            return true;
        }

        return false;
    }

    function getAutoHuntButton() {
        return document.querySelector('button.quick-action-slot[aria-label="자동 사냥"]');
    }
    function isAutoHuntingActive() {
        const btn = getAutoHuntButton();
        if (!btn) return false;
        return btn.getAttribute('aria-pressed') === 'true' || btn.classList.contains('is-active');
    }
    async function setAutoHunting(enable) {
        if (isAutoHuntingActive() === enable) return;
        const btn = getAutoHuntButton();
        if (btn) forceClickElement(btn);
        else simulateKey('z');

        const start = Date.now();
        while (Date.now() - start < 1500) {
            await sleep(100);
            if (isAutoHuntingActive() === enable) return;
        }
    }

    // 💡 [열림/닫힘 이중 검증] i키 입력 후 실제 인벤토리 오픈 및 클로즈 완벽 검증
    async function checkInventorySlotCount() {
        await ensureLootPanelClosed(1500);

        const isInventoryOpen = () => {
            return !!document.querySelector('.equipment-inventory[aria-label*="가방"], .inventory-heading-count');
        };

        for (let attempt = 1; attempt <= 3; attempt++) {
            if (isInventoryOpen()) break;

            if (window.focus) window.focus();
            document.body.focus?.();
            await sleep(150);

            simulateKey('i', 120);

            const openWaitStart = Date.now();
            while (Date.now() - openWaitStart < 1000) {
                if (isInventoryOpen()) break;
                await sleep(100);
            }

            if (isInventoryOpen()) {
                console.log(`🎒 [인벤토리 열림 확인] (${attempt}차 시도 성공)`);
                break;
            } else {
                console.log(`⚠️ [인벤토리 미반응] 재시도 중... (${attempt}/3)`);
            }
        }

        if (!isInventoryOpen()) {
            console.log("❌ [인벤토리 오픈 실패] 슬롯 확인 건너뜀");
            return 0;
        }

        await sleep(250);

        let count = 0;
        const gridEl = document.querySelector('.equipment-inventory[aria-label*="가방"]');
        if (gridEl) {
            const match = (gridEl.getAttribute('aria-label') || '').match(/가방\s*(\d+)\s*\/\s*\d+/);
            if (match) count = parseInt(match[1], 10);
        }
        if (count === 0) {
            const countSpan = document.querySelector('.inventory-heading-count');
            if (countSpan && countSpan.innerText) {
                const match = countSpan.innerText.match(/(\d+)\s*\/\s*\d+/);
                if (match) count = parseInt(match[1], 10);
            }
        }

        for (let closeAttempt = 1; closeAttempt <= 3; closeAttempt++) {
            if (!isInventoryOpen()) break;

            simulateKey('i', 120);

            const closeWaitStart = Date.now();
            while (Date.now() - closeWaitStart < 900) {
                if (!isInventoryOpen()) break;
                await sleep(100);
            }

            if (!isInventoryOpen()) {
                console.log("🎒 [인벤토리 닫힘 확인 완료]");
                break;
            }
        }

        return count;
    }

    // 💡 모닥 마을 상점 판매 루틴
    async function visitShopAndSellItems() {
        console.log("\n🏪 [상점 방문] 가까운 캠프파이어를 이용해 모닥 마을 상점으로 이동합니다.");
        await navigateToMap("모닥 마을");
        await ensureMount();
        await glideToTarget(TOWN_SHOP.x, TOWN_SHOP.y, 2.5, 2.0, 8.0);
        await sleep(200);

        simulateKey('f');
        await randomSleep(1000, 1500);

        let sellTabBtn = null;
        const tabStart = Date.now();
        while (Date.now() - tabStart < 3000) {
            const tabs = document.querySelectorAll('button[role="tab"]');
            for (const t of tabs) {
                if (t.innerText.includes("판매")) { sellTabBtn = t; break; }
            }
            if (sellTabBtn) break;
            await sleep(200);
        }

        if (sellTabBtn) {
            forceClickElement(sellTabBtn);
            await randomSleep(600, 900);
        }

        const gradeNames = ["노멀", "매직", "레어"];
        let clickedCount = 0;
        const shopButtons = Array.from(document.querySelectorAll('button[type="button"]'));

        for (const name of gradeNames) {
            const btn = shopButtons.find(b => b.innerText.trim() === name);
            if (btn && !btn.disabled && !btn.hasAttribute('disabled')) {
                forceClickElement(btn);
                clickedCount++;
                await randomSleep(350, 550);
            }
        }

        if (clickedCount > 0) {
            let selectSellBtn = null;
            const selectStart = Date.now();
            while (Date.now() - selectStart < 3500) {
                const found = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes("선택 판매"));
                if (found && !found.disabled && !found.hasAttribute('disabled')) {
                    selectSellBtn = found;
                    break;
                }
                await sleep(200);
            }

            if (selectSellBtn) {
                forceClickElement(selectSellBtn);
                await randomSleep(800, 1200);

                const confirmBtn = document.querySelector('button.is-danger') ||
                                   Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === "판매하기");
                if (confirmBtn) {
                    forceClickElement(confirmBtn);
                    await randomSleep(1800, 2300);
                }
            }
        }

        const closeBtn = document.querySelector('button[aria-label="상점 닫기"]');
        if (closeBtn) forceClickElement(closeBtn);
        else simulateKey('Escape');
        await sleep(300);
    }

    function getTownPortalButton() {
        return document.querySelector('.hud-movement-actions button.quick-action-slot[aria-label="마을 귀환"], .hud-movement-actions button.quick-action-slot[aria-label="귀환 취소"]');
    }
    function isTownPortalActive() {
        const btn = getTownPortalButton();
        if (!btn) return false;
        return btn.classList.contains('is-active') || btn.getAttribute('aria-label') === '귀환 취소';
    }
    async function smartReturnTown() {
        if (getCurrentMapName() === "모닥 마을") return true;
        await ensureLootPanelClosed(2000);
        simulateKey('Escape');
        await sleep(200);
        await setAutoHunting(false);
        await sleep(300);

        for (let attempt = 1; attempt <= 10; attempt++) {
            if (getCurrentMapName() === "모닥 마을") return true;

            const portalBtn = getTownPortalButton();
            if (portalBtn && !isTownPortalActive()) forceClickElement(portalBtn);
            else if (!portalBtn && !isTownPortalActive()) simulateKey('b');

            const castStart = Date.now();
            let isInterrupted = false;

            while (Date.now() - castStart < 3800) {
                await sleep(200);
                if (getCurrentMapName() === "모닥 마을") return true;
                if (!isTownPortalActive() && Date.now() - castStart > 1200) {
                    isInterrupted = true;
                    break;
                }
            }

            if (isInterrupted) {
                fireKey('keydown', 's');
                await sleep(1500);
                fireKey('keyup', 's');
                await sleep(400);
            }
        }
        return false;
    }

    // 💡 [기본 사냥터 복귀 및 인벤토리 분기 실행]
    async function moveToSelectedHuntingGround() {
        const target = HUNTING_GROUNDS.find(g => g.id === selectedHuntingGround) || HUNTING_GROUNDS[0];
        console.log(`\n🎯 [기본 사냥터 복귀 시작] 대상: '${target.name}' (${target.map})`);

        await setAutoHunting(false);

        if (isShopSellEnabled) {
            const slots = await checkInventorySlotCount();
            console.log(`🎒 [인벤토리 검사] 현재 슬롯 사용량: ${slots}/100`);

            if (slots >= 50) {
                console.log("⚠️ [가방 포화] 50칸 이상! 가까운 캠프파이어를 타고 마을 상점으로 이동합니다.");
                await visitShopAndSellItems();
            } else {
                console.log("✨ [가방 여유] 마을 방문 없이 최단 경로로 사냥터 직행");
            }
        }

        const mapOk = await navigateToMap(target.map);
        if (!mapOk) {
            console.log("  -> [실패] 사냥터 맵 진입 실패");
            return;
        }

        await ensureMount();
        await glideToTarget(target.x, target.y, 3.2, 2.5, 20);
        await setAutoHunting(true);
        console.log("--- [기본 사냥터 안착] 자동 사냥 활성화 ---");
    }

    let isReturning = false;
    async function returnToDefaultHuntingGround() {
        if (isReturning) return;
        isReturning = true;
        try {
            await moveToSelectedHuntingGround();
        } finally {
            isReturning = false;
        }
    }

    // 💡 [보스 큐 및 실행 엔진]
    let isRunning = false;
    let currentBossIndex = -1;
    let isHandlingDeath = false;
    const defeatedBosses = new Set();
    const bossQueue = [];

    function getBossEnabledStatus(bossIndex) {
        return localStorage.getItem(`modak_boss_enabled_${bossIndex}`) !== 'false';
    }
    function setBossEnabledStatus(bossIndex, val) {
        localStorage.setItem(`modak_boss_enabled_${bossIndex}`, val);
    }
    function isCurrentTimeInBossRange() {
        const cur = new Date().getHours();
        if (bossHuntStartHour === bossHuntEndHour) return true;
        if (bossHuntStartHour < bossHuntEndHour) return cur >= bossHuntStartHour && cur < bossHuntEndHour;
        return cur >= bossHuntStartHour || cur < bossHuntEndHour;
    }

    async function huntBossAndLoot(timeoutSec = 240) {
        await setAutoHunting(true);
        const startTime = Date.now();
        let bossDefeatedTime = null;

        while (Date.now() - startTime < timeoutSec * 1000) {
            await sleep(500);
            if (isHandlingDeath || document.querySelector('div.death-overlay')) return "dead";

            const lootPanel = document.querySelector('section.loot-panel');
            const closeBtn = document.querySelector('button[aria-label="전리품 닫기"]');
            if (lootPanel || closeBtn) {
                console.log("  -> [전리품 감지] 전리품 수거 및 창 닫기");
                await randomSleep(800, 1200);
                await ensureLootPanelClosed(4000);
                await setAutoHunting(false);
                return true;
            }

            if (bossQueue.length > 0 && PRIORITY_BOSSES.has(bossQueue[0].index) && !PRIORITY_BOSSES.has(currentBossIndex)) {
                console.log(`  -> [긴급 탈출] 최우선 보스(${bossQueue[0].name}) 출현으로 현재 보스 취소`);
                await ensureLootPanelClosed(2000);
                await setAutoHunting(false);
                return "urgent_switch";
            }

            if (defeatedBosses.has(currentBossIndex)) {
                if (!bossDefeatedTime) bossDefeatedTime = Date.now();
                else if (Date.now() - bossDefeatedTime > 3000) {
                    await ensureLootPanelClosed(2000);
                    await setAutoHunting(false);
                    return "defeated";
                }
            }
        }
        await ensureLootPanelClosed(2000);
        await setAutoHunting(false);
        return false;
    }

    async function executeBossQueueWorker() {
        if (isRunning || isReturning || isHandlingDeath) return;
        isRunning = true;

        await setAutoHunting(false);

        while (bossQueue.length > 0 || currentBossIndex !== -1) {
            if (isHandlingDeath) break;

            let currentTarget = currentBossIndex !== -1
                ? { index: currentBossIndex, name: BOSS_TARGETS[currentBossIndex]?.name || "보스" }
                : bossQueue.shift();

            const bossIndex = currentTarget.index;
            const targetInfo = BOSS_TARGETS[bossIndex];

            if (defeatedBosses.has(bossIndex)) {
                currentBossIndex = -1;
                continue;
            }

            currentBossIndex = bossIndex;
            let interruptedByPriority = false;

            console.log(`\n=== [보스 출동] [${bossIndex}] ${targetInfo.name} ===`);

            try {
                await setAutoHunting(false);

                const mapOk = await navigateToMap(targetInfo.map);
                if (mapOk) {
                    await ensureMount();
                    if (targetInfo.entryPath) {
                        for (const wp of targetInfo.entryPath) await glideToTarget(wp.x, wp.y, 2.8, 2.3, 15);
                    }
                    await glideToTarget(targetInfo.x, targetInfo.y, 3.2, 2.5, 20);

                    const res = await huntBossAndLoot(240);
                    if (res === "urgent_switch") {
                        interruptedByPriority = true;
                    }
                }
            } catch (e) {
                console.log("  -> [출동 오류]", e);
            }

            if (isHandlingDeath) break;

            if (interruptedByPriority && !defeatedBosses.has(bossIndex)) {
                const insertPos = bossQueue.findIndex(b => !PRIORITY_BOSSES.has(b.index));
                if (insertPos === -1) bossQueue.push(currentTarget);
                else bossQueue.splice(insertPos, 0, currentTarget);
            }
            currentBossIndex = -1;
            await sleep(400);
        }

        isRunning = false;

        if (!isHandlingDeath && bossQueue.length === 0) {
            console.log("  -> [전체 보스 루틴 종료] 기본 사냥터 복귀 루틴을 시작합니다.");
            await returnToDefaultHuntingGround();
        }
    }

    function enqueueBossTask(bossIndex, bossName) {
        if (!getBossEnabledStatus(bossIndex)) return;
        const isPriority = PRIORITY_BOSSES.has(bossIndex);

        if (!isBossHuntingEnabled && !isPriority) return;
        if (!isPriority && !isCurrentTimeInBossRange()) return;
        if (defeatedBosses.has(bossIndex)) return;

        if (isPriority) {
            const idx = bossQueue.findIndex(b => b.index === bossIndex);
            if (idx !== -1) bossQueue.splice(idx, 1);

            const firstNonPriorityIdx = bossQueue.findIndex(b => !PRIORITY_BOSSES.has(b.index));
            if (firstNonPriorityIdx === -1) bossQueue.push({ index: bossIndex, name: bossName });
            else bossQueue.splice(firstNonPriorityIdx, 0, { index: bossIndex, name: bossName });

            if (isRunning && !PRIORITY_BOSSES.has(currentBossIndex)) {
                simulateKey('Escape');
            } else if (!isRunning && !isHandlingDeath) {
                executeBossQueueWorker();
            }
            return;
        }

        if (!bossQueue.some(b => b.index === bossIndex) && currentBossIndex !== bossIndex) {
            bossQueue.push({ index: bossIndex, name: bossName });
        }
        if (!isRunning && !isHandlingDeath) executeBossQueueWorker();
    }

    async function checkAndHandleDeath() {
        if (isHandlingDeath) return;
        const deathOverlay = document.querySelector('div.death-overlay');
        if (!deathOverlay) return;

        isHandlingDeath = true;
        simulateKey('Escape');
        isRunning = false;

        const deadBoss = currentBossIndex;
        if (deadBoss !== -1 && !defeatedBosses.has(deadBoss)) {
            const start = Date.now();
            while (Date.now() - start < 180000) {
                await sleep(1500);
                if (defeatedBosses.has(deadBoss)) break;
            }
        }

        const overlay = document.querySelector('div.death-overlay');
        if (overlay) {
            const btn = Array.from(overlay.querySelectorAll('button')).find(b => b.innerText.includes("마을로 돌아가기"));
            if (btn) {
                await sleep(800);
                forceClickElement(btn);
            }
        }

        await waitForMap("모닥 마을", 15);
        await sleep(800);
        await ensureLootPanelClosed(3000);
        simulateKey('Escape');

        isHandlingDeath = false;
        currentBossIndex = -1;

        if (bossQueue.length > 0) {
            executeBossQueueWorker();
        } else {
            console.log("  -> [부활 완료] 잔여 보스가 없으므로 기본 사냥터로 복귀합니다.");
            await returnToDefaultHuntingGround();
        }
    }

    // 💡 설정 모달 UI
    function openBossFilterModal() {
        let modal = document.getElementById('modak-boss-modal');
        if (modal) { modal.style.display = 'flex'; return; }

        modal = document.createElement('div');
        modal.id = 'modak-boss-modal';
        modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.6);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;user-select:none;';

        const listHTML = Object.entries(BOSS_TARGETS).map(([idx, b]) => {
            const isPrio = PRIORITY_BOSSES.has(Number(idx));
            const badge = isPrio ? '<span style="color:#ffca28;font-size:11px;margin-left:6px;">[최우선]</span>' : '';
            return `
                <label style="display:flex;align-items:center;padding:6px 8px;margin-bottom:4px;background:rgba(255,255,255,0.05);border-radius:4px;cursor:pointer;font-size:13px;">
                    <input type="checkbox" class="boss-chk" data-idx="${idx}" ${getBossEnabledStatus(idx) ? 'checked' : ''} style="margin-right:10px;cursor:pointer;width:15px;height:15px;">
                    <span style="color:#eee;">[${idx}] ${b.name}${badge}</span>
                </label>
            `;
        }).join('');

        modal.innerHTML = `
            <div style="background:#202020;border:1px solid rgba(255,255,255,0.2);border-radius:8px;width:320px;box-shadow:0 8px 25px rgba(0,0,0,0.8);overflow:hidden;">
                <div style="background:#2b2b2b;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #444;">
                    <span style="font-weight:bold;color:#fff;font-size:13px;">🎯 보스별 사냥 여부 선택</span>
                    <button id="boss-modal-x" style="background:none;border:none;color:#aaa;cursor:pointer;font-size:16px;">✕</button>
                </div>
                <div style="padding:12px 14px;max-height:380px;overflow-y:auto;">
                    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                        <button id="boss-all-on" style="background:#333;color:#88f;border:1px solid #555;padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;">전체 선택</button>
                        <button id="boss-all-off" style="background:#333;color:#f88;border:1px solid #555;padding:3px 8px;border-radius:4px;font-size:11px;cursor:pointer;">전체 해제</button>
                    </div>
                    ${listHTML}
                </div>
                <div style="padding:10px 14px;background:#282828;text-align:right;border-top:1px solid #444;">
                    <button id="boss-modal-ok" style="background:#2e7d32;color:#fff;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:bold;font-size:12px;">확인 및 저장</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const close = () => { modal.style.display = 'none'; };
        modal.querySelector('#boss-modal-x').onclick = close;
        modal.querySelector('#boss-modal-ok').onclick = close;

        modal.querySelectorAll('.boss-chk').forEach(c => {
            c.onchange = (e) => setBossEnabledStatus(e.target.dataset.idx, e.target.checked);
        });
        modal.querySelector('#boss-all-on').onclick = () => {
            modal.querySelectorAll('.boss-chk').forEach(c => { c.checked = true; setBossEnabledStatus(c.dataset.idx, true); });
        };
        modal.querySelector('#boss-all-off').onclick = () => {
            modal.querySelectorAll('.boss-chk').forEach(c => { c.checked = false; setBossEnabledStatus(c.dataset.idx, false); });
        };
    }

    // 💡 설정 UI (드래그 이동 및 위치 저장)
    function createSettingsUI() {
        if (document.getElementById('modak-bot-settings-ui')) return;
        const panel = document.createElement('div');
        panel.id = 'modak-bot-settings-ui';
        panel.tabIndex = -1;

        const savedX = localStorage.getItem('modak_ui_pos_x');
        const savedY = localStorage.getItem('modak_ui_pos_y');

        let posStyle = 'bottom: 20px; right: 20px;';
        if (savedX !== null && savedY !== null) {
            posStyle = `left: ${savedX}px; top: ${savedY}px;`;
        }

        panel.style.cssText = `
            position: fixed;
            z-index: 99999;
            background: rgba(20, 20, 20, 0.92);
            color: #fff;
            width: 290px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.6);
            font-family: sans-serif;
            font-size: 13px;
            border: 1px solid rgba(255,255,255,0.2);
            user-select: none;
            ${posStyle}
        `;

        let startH = '', endH = '';
        for (let h = 0; h <= 24; h++) {
            const lbl = `${String(h).padStart(2, '0')}:00`;
            startH += `<option value="${h}" ${bossHuntStartHour === h ? 'selected' : ''}>${lbl}</option>`;
            endH += `<option value="${h}" ${bossHuntEndHour === h ? 'selected' : ''}>${lbl}</option>`;
        }

        const groundsHTML = HUNTING_GROUNDS.map(g =>
            `<option value="${g.id}" ${selectedHuntingGround === g.id ? 'selected' : ''}>${g.name}</option>`
        ).join('');

        panel.innerHTML = `
            <div id="bot-header" style="background:rgba(40,40,40,0.95);padding:10px 12px;border-top-left-radius:7px;border-top-right-radius:7px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;cursor:move;border-bottom:1px solid #444;">
                <span style="pointer-events:none;">🛠️ 스마트 라우팅 v3.86</span>
                <div>
                    <span id="bot-toggle" style="cursor:pointer;font-size:11px;color:#aaa;padding:2px 4px;">[접기]</span>
                </div>
            </div>
            <div id="bot-content" style="padding:12px 14px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-size:12px;font-weight:bold;">보스 자동 사냥:</span>
                    <button id="toggle-boss-btn" style="padding:3px 8px;font-size:11px;border-radius:4px;border:none;cursor:pointer;background:${isBossHuntingEnabled ? '#2e7d32' : '#c62828'};color:#fff;">
                        ${isBossHuntingEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-size:12px;font-weight:bold;">보스 목록 필터:</span>
                    <button id="open-filter-btn" style="padding:3px 8px;font-size:11px;border-radius:4px;border:1px solid #555;cursor:pointer;background:#3b4252;color:#fff;">
                        선택 ⚙️
                    </button>
                </div>
                <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                    <span style="font-size:12px;font-weight:bold;">상점 자동 판매:</span>
                    <button id="toggle-shop-btn" style="padding:3px 8px;font-size:11px;border-radius:4px;border:none;cursor:pointer;background:${isShopSellEnabled ? '#2e7d32' : '#c62828'};color:#fff;">
                        ${isShopSellEnabled ? 'ON' : 'OFF'}
                    </button>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <span style="font-size:12px;font-weight:bold;">사냥 시간대:</span>
                    <div style="display:flex;align-items:center;gap:3px;">
                        <select id="start-h" style="padding:2px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;font-size:11px;">${startH}</select>
                        <span style="font-size:11px;">~</span>
                        <select id="end-h" style="padding:2px;background:#333;color:#fff;border:1px solid #555;border-radius:3px;font-size:11px;">${endH}</select>
                    </div>
                </div>
                <div style="border-top:1px solid rgba(255,255,255,0.1);padding-top:8px;">
                    <div style="font-size:12px;font-weight:bold;margin-bottom:4px;">기본 사냥터 선택:</div>
                    <select id="ground-select" style="width:100%;padding:5px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;font-size:12px;cursor:pointer;">
                        ${groundsHTML}
                    </select>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        const header = panel.querySelector('#bot-header');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;

            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
            panel.style.left = initialLeft + 'px';
            panel.style.top = initialTop + 'px';

            const onMouseMove = (moveEvt) => {
                if (!isDragging) return;
                const dx = moveEvt.clientX - startX;
                const dy = moveEvt.clientY - startY;
                panel.style.left = (initialLeft + dx) + 'px';
                panel.style.top = (initialTop + dy) + 'px';
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    const finalRect = panel.getBoundingClientRect();
                    localStorage.setItem('modak_ui_pos_x', finalRect.left);
                    localStorage.setItem('modak_ui_pos_y', finalRect.top);
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        panel.querySelector('#toggle-boss-btn').onclick = (e) => {
            isBossHuntingEnabled = !isBossHuntingEnabled;
            localStorage.setItem('modak_boss_hunt_enabled', isBossHuntingEnabled);
            e.target.style.background = isBossHuntingEnabled ? '#2e7d32' : '#c62828';
            e.target.innerText = isBossHuntingEnabled ? 'ON' : 'OFF';
        };
        panel.querySelector('#open-filter-btn').onclick = openBossFilterModal;
        panel.querySelector('#toggle-shop-btn').onclick = (e) => {
            isShopSellEnabled = !isShopSellEnabled;
            localStorage.setItem('modak_shop_sell_enabled', isShopSellEnabled);
            e.target.style.background = isShopSellEnabled ? '#2e7d32' : '#c62828';
            e.target.innerText = isShopSellEnabled ? 'ON' : 'OFF';
        };
        panel.querySelector('#start-h').onchange = (e) => {
            bossHuntStartHour = parseInt(e.target.value, 10);
            localStorage.setItem('modak_boss_start_hour', bossHuntStartHour);
        };
        panel.querySelector('#end-h').onchange = (e) => {
            bossHuntEndHour = parseInt(e.target.value, 10);
            localStorage.setItem('modak_boss_end_hour', bossHuntEndHour);
        };

        const groundSelectEl = panel.querySelector('#ground-select');
        groundSelectEl.addEventListener('click', () => window.focus());
        groundSelectEl.onchange = (e) => {
            selectedHuntingGround = e.target.value;
            localStorage.setItem('modak_default_ground', selectedHuntingGround);
            console.log(`[사냥터 설정] '${selectedHuntingGround}'(으)로 변경 완료`);
            groundSelectEl.blur();
        };

        const toggleBtn = panel.querySelector('#bot-toggle');
        const content = panel.querySelector('#bot-content');
        let collapsed = false;
        toggleBtn.onclick = () => {
            collapsed = !collapsed;
            content.style.display = collapsed ? 'none' : 'block';
            toggleBtn.innerText = collapsed ? '[펼치기]' : '[접기]';
        };
    }

    // 💡 월드 이벤트 채팅 감시 (출발 지연 약 1초 적용)
    const processedMessages = new Set();
    function handleWorldChat(node) {
        const textEl = node.querySelector('.chat-msg-text');
        const timeEl = node.querySelector('.chat-msg-time');
        if (!textEl) return;

        const text = textEl.innerText.trim();
        const id = (timeEl ? timeEl.getAttribute('datetime') : '') + '_' + text;
        if (processedMessages.has(id)) return;
        processedMessages.add(id);

        const matchedEntry = Object.entries(BOSS_TARGETS).find(([_, b]) => text.includes(b.name));
        if (!matchedEntry) return;

        const bIdx = parseInt(matchedEntry[0], 10);
        const bName = matchedEntry[1].name;

        if (text.includes("출현")) {
            console.log(`[출현 감지] [${bIdx}] ${bName}`);
            defeatedBosses.delete(bIdx);
            if (!getBossEnabledStatus(bIdx)) return;

            const isPriority = PRIORITY_BOSSES.has(bIdx);
            if (isPriority || isBossHuntingEnabled) {
                const reactionDelay = Math.floor(Math.random() * 251) + 900; // 약 1초 (900 ~ 1150ms)
                setTimeout(() => enqueueBossTask(bIdx, bName), reactionDelay);
            }
        } else if (text.includes("처치되었습니다")) {
            console.log(`[처치 감지] [${bIdx}] ${bName}`);
            defeatedBosses.add(bIdx);
            const qIdx = bossQueue.findIndex(b => b.index === bIdx);
            if (qIdx !== -1) bossQueue.splice(qIdx, 1);
        }
    }

    const observer = new MutationObserver((mutations) => {
        checkAndHandleDeath();
        for (const m of mutations) {
            for (const n of m.addedNodes) {
                if (n.nodeType === 1) {
                    if (n.classList && n.classList.contains('is-world_event')) handleWorldChat(n);
                    else n.querySelectorAll?.('.chat-feed-item.is-world_event')?.forEach(handleWorldChat);
                }
            }
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('load', createSettingsUI);
    if (document.readyState === 'complete' || document.readyState === 'interactive') createSettingsUI();

    window.testCoords = getCoords;
    window.testGlide = glideToTarget;
    window.testNavigate = navigateToMap;
    window.testBossTask = enqueueBossTask;
    window.testMoveHuntingGround = returnToDefaultHuntingGround;
    window.testCheckBag = checkInventorySlotCount;

    console.log("모닥 온라인 스마트 라우팅 네비게이션 v3.86 로딩 완료!");
})();
