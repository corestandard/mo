// ==UserScript==
// @name         모닥 온라인 보스 오토봇 v4.00 (Periodic Inventory Check & Fixed Map Edges)
// @namespace    http://tampermonkey.net/
// @version      4.00
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
        "망자의 묘지": { x: 508.00, y: 280.75, wpIndex: 1 },
        "잊혀진 고성 중앙부": { x: 756.00, y: 107.25, wpIndex: 2 },
        "뼈바람 협곡": { x: 33.00, y: 432.67, wpIndex: 3 },
        "붉은숲 피난처": { x: -4.50, y: 605.75, wpIndex: 4 }
    };

    const TOWN_SHOP = { x: 32.53, y: 181.21 };
    const TOWN_BLACKSMITH = { x: 43.22, y: 204.41 };

    // 💡 [실측 기반 보스 전투 위치]
    const BOSS_TARGETS = {
        0: { map: "망국의 기록보관소", x: 637.19, y: 59.93, name: "악몽의 집합체" },
        1: { map: "망국의 병기창", entryPath: [{ x: 829.33, y: 167.58 }], x: 894.08, y: 179.42, name: "망국의 마장기" },
        2: { map: "잊혀진 고성 입구", x: 631.97, y: 122.18, name: "망령 공성대장" },
        3: { map: "망자의 묘지", x: 507.54, y: 193.27, name: "공허의 해골마도사" },
        4: { map: "초원", x: 271.29, y: 258.51, name: "고대 점액군주" },
        5: { map: "황야", x: 382.67, y: 335.82, name: "태양가시 거수" },
        6: { map: "그늘숲", x: -2.06, y: 324.96, name: "스컬 워로드" },
        7: { map: "협곡 진입로", x: -28.04, y: 400.46, name: "뼈바람 포식자" },
        8: { map: "수호자의 안식처", x: 45.31, y: 557.36, name: "뒤틀린 태초목" },
        9: { map: "붉은숲 피난처", x: -70.86, y: 618.30, name: "붉은송곳니 우두머리" },
        10: { map: "고요한 숲길", x: 127.50, y: 682.48, name: "숲길의 두 사슴" }
    };

    // 💡 [최우선 긴급 출동 보스 목록] (1: 망국의 마장기, 10: 숲길의 두 사슴)
    const PRIORITY_BOSSES = new Set([1, 10]);

    // 💡 [기본 내장 사냥터 실측 위치]
    const DEFAULT_HUNTING_GROUNDS = [
        { id: "wasteland_1", name: "황야1 (큰거 - 선인장 액기스)", map: "황야", x: 456.79, y: 294.49 },
        { id: "wasteland_2", name: "황야2 (작은거 - 선인장 액기스)", map: "황야", x: 390.16, y: 257.89 },
        { id: "canyon_entry", name: "협곡 진입로 (피울음 가죽갑옷)", map: "협곡 진입로", x: -26.91, y: 399.82 },
        { id: "bone_canyon", name: "뼈바람 협곡 (강철비 화살통, 혈석 반지)", map: "뼈바람 협곡", x: 56.67, y: 452.38 },
        { id: "bone_canyon_2", name: "뼈바람 협곡2 (강철비 화살통, 혈석 반지)", map: "뼈바람 협곡", entryPath: [{ x: 10.55, y: 447.72 }], x: -24.39, y: 464.18 },
        { id: "archive", name: "망국의 기록 보관소 (잊히지 않은 기도)", map: "망국의 기록보관소", x: 668.43, y: 44.19 },
        { id: "castle_center_east", name: "잊혀진 고성 중앙부_동쪽 (추격의 반지)", map: "잊혀진 고성 중앙부", x: 838.02, y: 107.28 },
        { id: "castle_center_west", name: "잊혀진 고성 중앙부_서쪽 (추격의 반지)", map: "잊혀진 고성 중앙부", x: 664.47, y: 107.39 },
        { id: "castle_center_south", name: "잊혀진 고성 중앙부_남쪽 (추격의 반지)", map: "잊혀진 고성 중앙부", x: 755.23, y: 144.00 },
        { id: "castle_center_north", name: "잊혀진 고성 중앙부_북쪽 (추격의 반지)", map: "잊혀진 고성 중앙부", x: 756.16, y: 65.20 },
        { id: "shade_forest_11", name: "그늘숲 11시 (오크의 전투나팔)", map: "그늘숲", x: 41.99, y: 312.38 },
        { id: "shade_forest_3", name: "그늘숲 3시 (오크의 전투나팔)", map: "그늘숲", x: 124.13, y: 331.56 }
    ];

    // 💡 사용자 커스텀 사냥터 로드/저장 및 통합 목록 반환
    function loadCustomHuntingGrounds() {
        try {
            const raw = localStorage.getItem('modak_custom_grounds');
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            return [];
        }
    }

    function saveCustomHuntingGrounds(list) {
        localStorage.setItem('modak_custom_grounds', JSON.stringify(list));
    }

    function getAllHuntingGrounds() {
        return [...DEFAULT_HUNTING_GROUNDS, ...loadCustomHuntingGrounds()];
    }

    // 💡 [월드맵 맵 간 연결 그래프 데이터]
    const MAP_EDGES = {
        "모닥 마을": [
            { to: "초원", portal: { x: 125.43, y: 222.57 } }
        ],
        "초원": [
            { to: "모닥 마을", portal: { x: 142.80, y: 235.07 } },
            { to: "그늘숲", portal: { x: 112.44, y: 273.75 } },
            { to: "황야", portal: { x: 247.12, y: 288.89 } }
        ],
        "황야": [
            { to: "초원", portal: { x: 278.65, y: 294.80 } },
            { to: "망자의 묘지", portal: { x: 435.56, y: 269.04 } }
        ],
        "망자의 묘지": [
            { to: "황야", portal: { x: 456.92, y: 260.22 } },
            { to: "잊혀진 고성 입구", portal: { x: 558.36, y: 207.16 } }
        ],
        "잊혀진 고성 입구": [
            { to: "망자의 묘지", portal: { x: 578.98, y: 197.53 } },
            { to: "잊혀진 고성 중앙부", portal: { x: 685.39, y: 144.09 } }
        ],
        "잊혀진 고성 중앙부": [
            { to: "잊혀진 고성 입구", portal: { x: 702.80, y: 134.99 } },
            { to: "망국의 병기창", portal: { x: 805.00, y: 132.80 } },
            { to: "망국의 기록보관소", portal: { x: 701.86, y: 81.54 } }
        ],
        "망국의 병기창": [
            { to: "잊혀진 고성 중앙부", portal: { x: 861.52, y: 127.07 }, waypoints: [{ x: 829.33, y: 167.58 }] }
        ],
        "망국의 기록보관소": [
            { to: "잊혀진 고성 중앙부", portal: { x: 654.92, y: 74.00 } }
        ],
        "뼈바람 협곡": [
            { to: "협곡 진입로", portal: { x: 1.59, y: 434.62 } }
        ],
        "협곡 진입로": [
            { to: "뼈바람 협곡", portal: { x: -13.71, y: 423.46 } },
            { to: "그늘숲", portal: { x: 4.23, y: 363.77 } }
        ],
        "그늘숲": [
            { to: "초원", portal: { x: 95.92, y: 287.17 } },
            { to: "협곡 진입로", portal: { x: 13.01, y: 355.61 } }
        ],
        "붉은숲 피난처": [
            { to: "수호자의 안식처", portal: { x: 58.76, y: 595.75 } },
            { to: "고요한 숲길", portal: { x: 35.06, y: 660.16 } }
        ],
        "수호자의 안식처": [
            { to: "붉은숲 피난처", portal: { x: 71.37, y: 583.74 } }
        ],
        "고요한 숲길": [
            { to: "붉은숲 피난처", portal: { x: 51.72, y: 670.36 } }
        ]
    };

    // 💡 상점 판매 등급 설정 로드/저장
    const ALL_SELL_GRADES = ["노멀", "매직", "레어"];
    function loadSellGrades() {
        try {
            const raw = localStorage.getItem('modak_shop_sell_grades');
            if (!raw) return ["노멀", "매직", "레어"];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : ["노멀", "매직", "레어"];
        } catch (e) {
            return ["노멀", "매직", "레어"];
        }
    }

    let selectedHuntingGround = localStorage.getItem('modak_default_ground') || "wasteland_1";
    let isBossHuntingEnabled = localStorage.getItem('modak_boss_hunt_enabled') !== 'false';
    let isShopSellEnabled = localStorage.getItem('modak_shop_sell_enabled') !== 'false';
    let shopSellSlotThreshold = parseInt(localStorage.getItem('modak_shop_slot_threshold') ?? '50', 10);
    let shopCheckIntervalMin = parseInt(localStorage.getItem('modak_shop_check_interval') ?? '30', 10);
    let shopSellGrades = loadSellGrades();
    let isExcludeRareGlovesBoots = localStorage.getItem('modak_shop_exclude_gloves_boots') !== 'false';
    let isAutoEnhanceEnabled = localStorage.getItem('modak_auto_enhance_enabled') !== 'false';
    let autoEnhanceTargetLevel = parseInt(localStorage.getItem('modak_auto_enhance_level') ?? '8', 10);
    let bossHuntStartHour = parseInt(localStorage.getItem('modak_boss_start_hour') ?? '0', 10);
    let bossHuntEndHour = parseInt(localStorage.getItem('modak_boss_end_hour') ?? '24', 10);

    let lastInventoryCheckTime = Date.now();

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

    // 💡 시즌 괄호 표기 제거 (예: '모닥 마을(겨울)' -> '모닥 마을')
    function getCurrentMapName() {
        const mapNameEl = document.getElementsByClassName("panel-list-name")[0];
        if (!mapNameEl) return "";
        return mapNameEl.innerText.replace(/\(.*?\)/g, '').trim();
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

                if (absX <= radiusX && absY <= radiusY) {
                    stopAll();
                    await sleep(60);
                    return true;
                }

                if (Math.abs(targetX - predictedX) <= radiusX && Math.abs(targetY - predictedY) <= radiusY && activeKeys.size > 0) {
                    stopAll();
                    await sleep(100);
                    prevPos = getCoords();
                    continue;
                }

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

    // 💡 [스마트 라우팅 엔진 - 포탈 직행(2회 이하) vs 캠프파이어 워프 비용 비교]
    async function navigateToMap(targetMap) {
        await setAutoHunting(false);

        let curMap = getCurrentMapName();
        if (curMap === targetMap) return true;

        console.log(`🗺️ [스마트 라우팅 시작] '${curMap}' ➔ '${targetMap}'`);

        const walkPath = findPathBetweenMaps(curMap, targetMap);

        let bestStartCamp = null;
        let pathToStartCamp = null;
        if (CAMPFIRES[curMap]) {
            bestStartCamp = curMap;
            pathToStartCamp = [];
        } else {
            for (const campMap of Object.keys(CAMPFIRES)) {
                const p = findPathBetweenMaps(curMap, campMap);
                if (p && (!pathToStartCamp || p.length < pathToStartCamp.length)) {
                    pathToStartCamp = p;
                    bestStartCamp = campMap;
                }
            }
        }

        let bestTargetCamp = null;
        let pathFromTargetCamp = null;
        if (CAMPFIRES[targetMap]) {
            bestTargetCamp = targetMap;
            pathFromTargetCamp = [];
        } else {
            for (const campMap of Object.keys(CAMPFIRES)) {
                const p = findPathBetweenMaps(campMap, targetMap);
                if (p && (!pathFromTargetCamp || p.length < pathFromTargetCamp.length)) {
                    pathFromTargetCamp = p;
                    bestTargetCamp = campMap;
                }
            }
        }

        const walkCost = walkPath ? walkPath.length : Infinity;
        const warpCost = (pathToStartCamp && pathFromTargetCamp)
            ? (pathToStartCamp.length + 1.2 + pathFromTargetCamp.length)
            : Infinity;

        if (walkPath && (walkPath.length <= 2 || walkCost <= warpCost)) {
            console.log(`  -> [포탈 직행] 캠프파이어 없이 포탈 ${walkPath.length}회 경유로 최단 이동합니다.`);
            for (const step of walkPath) {
                const ok = await traversePortalStep(step);
                if (!ok) return false;
            }
            return true;
        }

        console.log(`  -> [캠프파이어 워프] 원거리 이동 (도보 ${walkCost}회 vs 워프 경로)`);
        if (pathToStartCamp) {
            for (const step of pathToStartCamp) {
                const ok = await traversePortalStep(step);
                if (!ok) return false;
            }
            curMap = getCurrentMapName();
        } else {
            console.log("  -> 캠프파이어 보유 맵 연결 실패. 비상 마을 귀환(B) 실행");
            await smartReturnTown();
            curMap = getCurrentMapName();
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
                } else {
                    return false;
                }
            }

            for (const step of pathFromTargetCamp) {
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

        lastInventoryCheckTime = Date.now();
        return count;
    }

    function hasUrgentPriorityBossInQueue() {
        return bossQueue.some(b => PRIORITY_BOSSES.has(b.index) && !defeatedBosses.has(b.index));
    }

    // 💡 모닥 마을 상점 판매 루틴 (UI 선택 등급 + 레어 장갑·장화 제외 파생 옵션 반영)
    async function visitShopAndSellItems() {
        if (shopSellGrades.length === 0) {
            console.log("\n🏪 [상점 건너뜀] 선택된 판매 등급이 없습니다.");
            return;
        }

        const rareDesc = shopSellGrades.includes("레어")
            ? (isExcludeRareGlovesBoots ? "레어(장갑·장화 제외)" : "레어(전체)")
            : "";
        const displayGrades = shopSellGrades.map(g => g === "레어" ? rareDesc : g).join(', ');

        console.log(`\n🏪 [상점 방문] 선택 등급(${displayGrades}) 판매를 위해 모닥 마을 상점으로 이동합니다.`);
        const inTown = await navigateToMap("모닥 마을");
        if (!inTown) {
            console.log("  -> [상점 건너뜀] 모닥 마을 이동 실패");
            return;
        }
        if (hasUrgentPriorityBossInQueue()) return;

        await ensureMount();
        await glideToTarget(TOWN_SHOP.x, TOWN_SHOP.y, 2.5, 2.0, 8.0);
        await sleep(200);

        if (hasUrgentPriorityBossInQueue()) return;

        simulateKey('f');
        await randomSleep(900, 1300);

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
            await randomSleep(500, 800);
        }

        let clickedCount = 0;
        const shopButtons = Array.from(document.querySelectorAll('button[type="button"]'));

        for (const name of shopSellGrades) {
            if (name === "레어" && isExcludeRareGlovesBoots) {
                const rareSlots = Array.from(
                    document.querySelectorAll('.shop-item-grid button.inventory-slot.has-item.rarity-rare')
                );
                let excludedCount = 0;
                for (const slot of rareSlots) {
                    const itemName = slot.getAttribute('aria-label') || '';
                    if (itemName.includes("장갑") || itemName.includes("장화")) {
                        excludedCount++;
                        continue;
                    }
                    if (slot.getAttribute('aria-checked') !== 'true') {
                        forceClickElement(slot);
                        clickedCount++;
                        await randomSleep(80, 150);
                    }
                }
                console.log(`  -> [레어 필터링] 일반 레어 선택 완료 (장갑·장화 ${excludedCount}개 제외)`);
            } else {
                const btn = shopButtons.find(b => b.innerText.trim() === name);
                if (btn && !btn.disabled && !btn.hasAttribute('disabled')) {
                    forceClickElement(btn);
                    clickedCount++;
                    await randomSleep(300, 500);
                }
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
                await randomSleep(700, 1000);

                const confirmBtn = document.querySelector('button.is-danger') ||
                                   Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === "판매하기");
                if (confirmBtn) {
                    forceClickElement(confirmBtn);
                    await randomSleep(1500, 2000);
                }
            }
        }

        const closeBtn = document.querySelector('button[aria-label="상점 닫기"]');
        if (closeBtn) forceClickElement(closeBtn);
        else simulateKey('Escape');
        await sleep(300);
    }

    // 💡 모닥 마을 대장장이 +1~+9 선택형 자동 강화 루틴
    async function visitBlacksmithAndEnhance() {
        if (hasUrgentPriorityBossInQueue()) return;

        const targetLabel = `+${autoEnhanceTargetLevel}`;
        console.log(`\n🔨 [대장장이 방문] ${targetLabel} 자동 강화를 위해 대장장이로 이동합니다.`);
        const inTown = await navigateToMap("모닥 마을");
        if (!inTown) {
            console.log("  -> [대장장이 건너뜀] 모닥 마을 이동 실패");
            return;
        }
        if (hasUrgentPriorityBossInQueue()) return;

        await ensureMount();
        await glideToTarget(TOWN_BLACKSMITH.x, TOWN_BLACKSMITH.y, 2.3, 1.8, 10.0);
        await sleep(200);

        if (hasUrgentPriorityBossInQueue()) return;

        const closeReforgePanel = async () => {
            const closeBtn = document.querySelector('button[aria-label="강화소 닫기"]');
            if (closeBtn) forceClickElement(closeBtn);
            else simulateKey('Escape');
            await sleep(300);
        };

        simulateKey('f');
        let autoTabBtn = null;
        const tabWaitStart = Date.now();
        while (Date.now() - tabWaitStart < 3000) {
            const tabs = document.querySelectorAll('button[role="tab"]');
            for (const t of tabs) {
                if (t.innerText.includes("자동 강화")) {
                    autoTabBtn = t;
                    break;
                }
            }
            if (autoTabBtn) break;
            await sleep(150);
        }

        if (!autoTabBtn) {
            console.log("  -> [대장장이 실패] 자동 강화 탭을 찾지 못했습니다.");
            await closeReforgePanel();
            return;
        }

        if (autoTabBtn.getAttribute('aria-selected') !== 'true') {
            forceClickElement(autoTabBtn);
            await randomSleep(400, 600);
        }

        if (hasUrgentPriorityBossInQueue()) {
            await closeReforgePanel();
            return;
        }

        const targetPlusBtn = Array.from(document.querySelectorAll('.reforge-targets button, button[type="button"]')).find(
            b => b.innerText.replace(/\s+/g, '') === targetLabel
        );
        if (targetPlusBtn && targetPlusBtn.getAttribute('aria-pressed') !== 'true') {
            forceClickElement(targetPlusBtn);
            await randomSleep(300, 450);
        }

        const selectAllBtn = Array.from(document.querySelectorAll('.reforge-selection-controls button')).find(
            b => b.innerText.includes("전체 선택")
        );

        if (!selectAllBtn || selectAllBtn.disabled || selectAllBtn.hasAttribute('disabled')) {
            console.log(`  -> [자동 강화 건너뜀] ${targetLabel} 강화 가능한 대상 아이템이 없습니다.`);
            await closeReforgePanel();
            return;
        }

        forceClickElement(selectAllBtn);
        await randomSleep(400, 600);

        if (hasUrgentPriorityBossInQueue()) {
            await closeReforgePanel();
            return;
        }

        const getActionBtn = () => document.querySelector('button.reforge-action.reforge-primary-action');
        const startBtn = getActionBtn();

        if (!startBtn || startBtn.disabled || startBtn.hasAttribute('disabled')) {
            console.log("  -> [자동 강화 건너뜀] 시작 버튼 비활성 상태");
            await closeReforgePanel();
            return;
        }

        console.log(`🔥 [자동 강화 시작] ${targetLabel} 자동 강화를 진행합니다...`);
        forceClickElement(startBtn);
        await sleep(500);

        const enhanceStart = Date.now();
        let sawRunningState = false;

        while (Date.now() - enhanceStart < 90000) {
            await sleep(250);
            const actionBtn = getActionBtn();
            if (!actionBtn) break;

            const btnText = actionBtn.innerText.trim();
            const isEnhancing = btnText.includes("중지");

            if (isEnhancing) {
                sawRunningState = true;
            }

            if (hasUrgentPriorityBossInQueue()) {
                console.log("🚨 [긴급 탈출] 최우선 보스 출현 감지! 자동 강화를 즉시 중지하고 출동합니다.");
                if (isEnhancing) {
                    forceClickElement(actionBtn);
                    await sleep(300);
                }
                await closeReforgePanel();
                return;
            }

            if (!isEnhancing && btnText.includes("자동 강화 시작")) {
                if (sawRunningState || Date.now() - enhanceStart > 1200) {
                    console.log(`✅ [자동 강화 완료] 모든 대상 아이템의 ${targetLabel} 강화가 종료되었습니다.`);
                    break;
                }
            }
        }

        await randomSleep(400, 600);
        await closeReforgePanel();
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
        const allGrounds = getAllHuntingGrounds();
        const target = allGrounds.find(g => g.id === selectedHuntingGround) || allGrounds[0];
        console.log(`\n🎯 [복귀 및 정비 체크] 기본 사냥터 대상: '${target.name}' (${target.map})`);

        await setAutoHunting(false);

        if (isShopSellEnabled) {
            const slots = await checkInventorySlotCount();
            console.log(`🎒 [인벤토리 검사] 현재 슬롯 사용량: ${slots}/100 (판매 기준: ${shopSellSlotThreshold}칸 이상)`);

            if (slots >= shopSellSlotThreshold) {
                console.log(`⚠️ [가방 포화] ${shopSellSlotThreshold}칸 이상! 모닥 마을 상점 판매 및 대장장이 정비를 시작합니다.`);
                await visitShopAndSellItems();

                if (isAutoEnhanceEnabled && !hasUrgentPriorityBossInQueue()) {
                    await visitBlacksmithAndEnhance();
                }
            } else {
                console.log("✨ [가방 여유] 마을 방문 없이 최단 경로로 사냥터 직행");
            }
        }

        if (bossQueue.some(b => !defeatedBosses.has(b.index))) {
            console.log("⚔️ [예약 보스 감지] 대기 중인 보스 사냥으로 즉시 전환합니다.");
            return;
        }

        let mapOk = await navigateToMap(target.map);
        if (!mapOk) {
            if (bossQueue.some(b => !defeatedBosses.has(b.index))) return;
            console.log("  -> [사냥터 이동 실패] 마을 귀환 후 기본 사냥터 이동을 1회 재시도합니다.");
            await smartReturnTown();

            if (bossQueue.some(b => !defeatedBosses.has(b.index))) return;
            mapOk = await navigateToMap(target.map);
        }

        if (!mapOk) {
            console.log("  -> [실패] 사냥터 맵 최종 진입 실패");
            return;
        }

        if (bossQueue.some(b => !defeatedBosses.has(b.index))) {
            console.log("⚔️ [예약 보스 감지] 사냥터 도착 직후 대기 보스 출동으로 전환합니다.");
            return;
        }

        await ensureMount();

        if (target.entryPath) {
            for (const wp of target.entryPath) {
                if (bossQueue.some(b => !defeatedBosses.has(b.index))) return;
                await glideToTarget(wp.x, wp.y, 2.8, 2.3, 15);
            }
        }

        if (bossQueue.some(b => !defeatedBosses.has(b.index))) return;

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
            if (!isRunning && !isHandlingDeath && bossQueue.some(b => !defeatedBosses.has(b.index))) {
                console.log("🚀 [보스 워커 점화] 대기열에 예약된 보스 사냥을 시작합니다.");
                executeBossQueueWorker();
            }
        }
    }

    // 💡 [정기 인벤토리 체크 백그라운드 타이머] (15초마다 유휴 상태 확인 후 실행)
    setInterval(async () => {
        if (!isShopSellEnabled || shopCheckIntervalMin <= 0) return;
        if (isRunning || isReturning || isHandlingDeath) return;
        if (bossQueue.some(b => !defeatedBosses.has(b.index))) return;

        const elapsedMs = Date.now() - lastInventoryCheckTime;
        if (elapsedMs < shopCheckIntervalMin * 60 * 1000) return;

        lastInventoryCheckTime = Date.now();
        console.log(`\n⏰ [정기 인벤토리 점검] ${shopCheckIntervalMin}분 경과! 가방 상태를 확인합니다.`);
        await returnToDefaultHuntingGround();
    }, 15000);

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
                ? { index: currentBossIndex, name: BOSS_TARGETS[currentBossIndex]?.name || "보스", retries: 0 }
                : bossQueue.shift();

            const bossIndex = currentTarget.index;
            const targetInfo = BOSS_TARGETS[bossIndex];
            const retryCount = currentTarget.retries || 0;

            if (defeatedBosses.has(bossIndex)) {
                currentBossIndex = -1;
                continue;
            }

            currentBossIndex = bossIndex;
            let interruptedByPriority = false;
            let navFailed = false;

            console.log(`\n=== [보스 출동] [${bossIndex}] ${targetInfo.name} ${retryCount > 0 ? `(귀환 재시도 ${retryCount}/2)` : ''} ===`);

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
                } else {
                    navFailed = true;
                }
            } catch (e) {
                console.log("  -> [출동 오류]", e);
                navFailed = true;
            }

            if (isHandlingDeath) break;

            if (navFailed) {
                if (!defeatedBosses.has(bossIndex) && retryCount < 2) {
                    console.log(`  -> [출동 실패: 미처치] '${targetInfo.name}' 처치 미확인! 마을 귀환 후 재출동합니다. (${retryCount + 1}/2)`);
                    await smartReturnTown();

                    if (!defeatedBosses.has(bossIndex)) {
                        const retryTask = { index: bossIndex, name: targetInfo.name, retries: retryCount + 1 };
                        const firstNonPrio = bossQueue.findIndex(b => !PRIORITY_BOSSES.has(b.index));
                        if (firstNonPrio === -1) bossQueue.push(retryTask);
                        else bossQueue.splice(firstNonPrio, 0, retryTask);
                    }
                } else {
                    console.log(`  -> [출동 종료] '${targetInfo.name}' 처치 확인 또는 재시도 한도 초과. 다음 일정을 확인합니다.`);
                    if (bossQueue.some(b => !defeatedBosses.has(b.index))) {
                        await smartReturnTown();
                    }
                }
                currentBossIndex = -1;
                await sleep(300);
                continue;
            }

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
            console.log("  -> [전체 보스 루틴 종료] 예약 보스가 없으므로 기본 사냥터 복귀 및 정비 루틴을 시작합니다.");
            await returnToDefaultHuntingGround();
        } else if (!isHandlingDeath && bossQueue.some(b => !defeatedBosses.has(b.index))) {
            executeBossQueueWorker();
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
            if (firstNonPriorityIdx === -1) bossQueue.push({ index: bossIndex, name: bossName, retries: 0 });
            else bossQueue.splice(firstNonPriorityIdx, 0, { index: bossIndex, name: bossName, retries: 0 });

            if (isRunning && !PRIORITY_BOSSES.has(currentBossIndex)) {
                simulateKey('Escape');
            } else if (!isRunning && !isReturning && !isHandlingDeath) {
                executeBossQueueWorker();
            }
            return;
        }

        if (!bossQueue.some(b => b.index === bossIndex) && currentBossIndex !== bossIndex) {
            bossQueue.push({ index: bossIndex, name: bossName, retries: 0 });
        }
        if (!isRunning && !isReturning && !isHandlingDeath) executeBossQueueWorker();
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

    // 💡 설정 UI (상점 판매 조건 + 정기 체크 주기 + 레어 파생 옵션 포함)
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
            width: 300px;
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

        let enhanceOptionsHTML = '';
        for (let lv = 1; lv <= 9; lv++) {
            enhanceOptionsHTML += `<option value="${lv}" ${autoEnhanceTargetLevel === lv ? 'selected' : ''}>+${lv}</option>`;
        }

        let slotOptionsHTML = '';
        for (let s = 30; s <= 90; s += 10) {
            slotOptionsHTML += `<option value="${s}" ${shopSellSlotThreshold === s ? 'selected' : ''}>${s}칸↑</option>`;
        }

        const intervalChoices = [
            { val: 0, label: "사용안함" },
            { val: 10, label: "10분" },
            { val: 20, label: "20분" },
            { val: 30, label: "30분" },
            { val: 60, label: "60분" }
        ];
        const intervalOptionsHTML = intervalChoices.map(c =>
            `<option value="${c.val}" ${shopCheckIntervalMin === c.val ? 'selected' : ''}>${c.label}</option>`
        ).join('');

        const gradeCheckboxesHTML = ALL_SELL_GRADES.map(g => {
            const checked = shopSellGrades.includes(g) ? 'checked' : '';
            return `
                <label style="display:inline-flex;align-items:center;gap:3px;font-size:11px;color:#ddd;cursor:pointer;">
                    <input type="checkbox" class="sell-grade-chk" value="${g}" ${checked} style="margin:0;cursor:pointer;">
                    <span>${g}</span>
                </label>
            `;
        }).join('');

        const isRareChecked = shopSellGrades.includes("레어");

        panel.innerHTML = `
            <div id="bot-header" style="background:rgba(40,40,40,0.95);padding:10px 12px;border-top-left-radius:7px;border-top-right-radius:7px;font-weight:bold;display:flex;justify-content:space-between;align-items:center;cursor:move;border-bottom:1px solid #444;">
                <span style="pointer-events:none;">🛠️ 스마트 라우팅 v4.00</span>
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
                <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:5px;padding:6px 8px;margin-bottom:8px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                        <span style="font-size:12px;font-weight:bold;">상점 자동 판매:</span>
                        <div style="display:flex;align-items:center;gap:4px;">
                            <select id="shop-slot-select" title="가방 슬롯 판매 기준" style="padding:2px 4px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;font-size:11px;cursor:pointer;">
                                ${slotOptionsHTML}
                            </select>
                            <button id="toggle-shop-btn" style="padding:3px 8px;font-size:11px;border-radius:4px;border:none;cursor:pointer;background:${isShopSellEnabled ? '#2e7d32' : '#c62828'};color:#fff;">
                                ${isShopSellEnabled ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                        <span style="font-size:11px;color:#aaa;">정기 체크 주기:</span>
                        <select id="shop-interval-select" title="일반 사냥 중 주기적 가방 확인 시간" style="padding:2px 6px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;font-size:11px;cursor:pointer;">
                            ${intervalOptionsHTML}
                        </select>
                    </div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <span style="font-size:11px;color:#aaa;">판매 등급:</span>
                        <div style="display:flex;align-items:center;gap:8px;">
                            ${gradeCheckboxesHTML}
                        </div>
                    </div>
                    <div id="rare-sub-option-row" style="display:flex;justify-content:space-between;align-items:center;padding-top:4px;border-top:1px dashed rgba(255,255,255,0.08);opacity:${isRareChecked ? '1' : '0.45'};">
                        <span style="font-size:11px;color:#90caf9;">↳ 레어 세부 옵션:</span>
                        <label style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#e3f2fd;cursor:${isRareChecked ? 'pointer' : 'not-allowed'};">
                            <input type="checkbox" id="exclude-gloves-boots-chk" ${isExcludeRareGlovesBoots ? 'checked' : ''} ${isRareChecked ? '' : 'disabled'} style="margin:0;cursor:inherit;">
                            <span>장갑·장화 제외</span>
                        </label>
                    </div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                    <span style="font-size:12px;font-weight:bold;">자동 강화 목표:</span>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <select id="enhance-level-select" style="padding:2px 4px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;font-size:11px;cursor:pointer;">
                            ${enhanceOptionsHTML}
                        </select>
                        <button id="toggle-enhance-btn" style="padding:3px 8px;font-size:11px;border-radius:4px;border:none;cursor:pointer;background:${isAutoEnhanceEnabled ? '#2e7d32' : '#c62828'};color:#fff;">
                            ${isAutoEnhanceEnabled ? 'ON' : 'OFF'}
                        </button>
                    </div>
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
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                        <span style="font-size:12px;font-weight:bold;">기본 사냥터 선택:</span>
                        <button id="add-ground-btn" style="padding:2px 7px;font-size:11px;border-radius:4px;border:1px solid #4caf50;cursor:pointer;background:#1b5e20;color:#fff;" title="현재 서 있는 맵과 좌표를 기본 사냥터로 추가">
                            + 현재 위치
                        </button>
                    </div>
                    <select id="ground-select" style="width:100%;padding:5px;background:#333;color:#fff;border:1px solid #555;border-radius:4px;font-size:12px;cursor:pointer;margin-bottom:6px;">
                    </select>
                    <div id="custom-ground-controls" style="display:none;justify-content:flex-end;gap:5px;">
                        <button id="rename-ground-btn" style="padding:2px 8px;font-size:11px;border-radius:4px;border:1px solid #666;cursor:pointer;background:#37474f;color:#eee;">
                            이름 수정
                        </button>
                        <button id="delete-ground-btn" style="padding:2px 8px;font-size:11px;border-radius:4px;border:1px solid #8e2424;cursor:pointer;background:#5c1a1a;color:#ffcdd2;">
                            삭제
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        const groundSelectEl = panel.querySelector('#ground-select');
        const customControlsEl = panel.querySelector('#custom-ground-controls');

        const renderGroundOptions = () => {
            const defaultsHTML = DEFAULT_HUNTING_GROUNDS.map(g =>
                `<option value="${g.id}" ${selectedHuntingGround === g.id ? 'selected' : ''}>${g.name}</option>`
            ).join('');

            const customs = loadCustomHuntingGrounds();
            const customsHTML = customs.length > 0
                ? `<optgroup label="★ 내 저장 사냥터">` + customs.map(g =>
                    `<option value="${g.id}" ${selectedHuntingGround === g.id ? 'selected' : ''}>${g.name}</option>`
                ).join('') + `</optgroup>`
                : '';

            groundSelectEl.innerHTML = defaultsHTML + customsHTML;

            if (!getAllHuntingGrounds().some(g => g.id === selectedHuntingGround)) {
                selectedHuntingGround = DEFAULT_HUNTING_GROUNDS[0].id;
                localStorage.setItem('modak_default_ground', selectedHuntingGround);
                groundSelectEl.value = selectedHuntingGround;
            }

            const isCustomSelected = customs.some(g => g.id === selectedHuntingGround);
            customControlsEl.style.display = isCustomSelected ? 'flex' : 'none';
        };

        renderGroundOptions();

        panel.querySelector('#add-ground-btn').onclick = () => {
            const mapName = getCurrentMapName();
            const pos = getCoords();
            if (!mapName || !pos) {
                alert("현재 맵 또는 좌표를 읽을 수 없습니다.");
                return;
            }

            const rx = Number(pos.x.toFixed(2));
            const ry = Number(pos.y.toFixed(2));
            const defaultLabel = `${mapName} (${rx}, ${ry})`;
            const inputName = prompt(`현재 위치를 기본 사냥터에 추가합니다.\n맵: ${mapName} / 좌표: (${rx}, ${ry})\n\n저장할 사냥터 이름을 입력하세요:`, defaultLabel);

            if (inputName === null) return;
            const finalName = inputName.trim() || defaultLabel;

            const newId = `custom_${Date.now()}`;
            const customs = loadCustomHuntingGrounds();
            customs.push({
                id: newId,
                name: finalName,
                map: mapName,
                x: rx,
                y: ry
            });
            saveCustomHuntingGrounds(customs);

            selectedHuntingGround = newId;
            localStorage.setItem('modak_default_ground', selectedHuntingGround);
            renderGroundOptions();
            console.log(`✅ [커스텀 사냥터 추가] '${finalName}' (${mapName}: ${rx}, ${ry})`);
        };

        panel.querySelector('#rename-ground-btn').onclick = () => {
            const customs = loadCustomHuntingGrounds();
            const target = customs.find(g => g.id === selectedHuntingGround);
            if (!target) return;

            const newName = prompt(`사냥터 이름을 수정합니다.\n(${target.map}: ${target.x}, ${target.y})`, target.name);
            if (newName === null) return;
            const trimmed = newName.trim();
            if (!trimmed) return;

            target.name = trimmed;
            saveCustomHuntingGrounds(customs);
            renderGroundOptions();
            console.log(`✏️ [사냥터 이름 수정] '${trimmed}'`);
        };

        panel.querySelector('#delete-ground-btn').onclick = () => {
            const customs = loadCustomHuntingGrounds();
            const target = customs.find(g => g.id === selectedHuntingGround);
            if (!target) return;

            if (!confirm(`저장된 사냥터 '${target.name}'을(를) 삭제하시겠습니까?`)) return;

            const updated = customs.filter(g => g.id !== selectedHuntingGround);
            saveCustomHuntingGrounds(updated);
            selectedHuntingGround = DEFAULT_HUNTING_GROUNDS[0].id;
            localStorage.setItem('modak_default_ground', selectedHuntingGround);
            renderGroundOptions();
            console.log(`🗑️ [커스텀 사냥터 삭제] '${target.name}' 삭제 완료`);
        };

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

        const slotSelectEl = panel.querySelector('#shop-slot-select');
        slotSelectEl.addEventListener('click', () => window.focus());
        slotSelectEl.onchange = (e) => {
            shopSellSlotThreshold = parseInt(e.target.value, 10);
            localStorage.setItem('modak_shop_slot_threshold', shopSellSlotThreshold);
            console.log(`[상점 설정] 판매 시작 슬롯 기준 '${shopSellSlotThreshold}칸 이상'으로 변경 완료`);
            slotSelectEl.blur();
        };

        const intervalSelectEl = panel.querySelector('#shop-interval-select');
        intervalSelectEl.addEventListener('click', () => window.focus());
        intervalSelectEl.onchange = (e) => {
            shopCheckIntervalMin = parseInt(e.target.value, 10);
            localStorage.setItem('modak_shop_check_interval', shopCheckIntervalMin);
            lastInventoryCheckTime = Date.now();
            console.log(`[상점 설정] 정기 인벤토리 체크 주기 '${shopCheckIntervalMin > 0 ? shopCheckIntervalMin + '분' : '사용안함'}'(으)로 변경 완료`);
            intervalSelectEl.blur();
        };

        const rareSubRowEl = panel.querySelector('#rare-sub-option-row');
        const excludeChkEl = panel.querySelector('#exclude-gloves-boots-chk');

        panel.querySelectorAll('.sell-grade-chk').forEach(chk => {
            chk.onchange = () => {
                shopSellGrades = Array.from(panel.querySelectorAll('.sell-grade-chk:checked')).map(el => el.value);
                localStorage.setItem('modak_shop_sell_grades', JSON.stringify(shopSellGrades));

                const rareActive = shopSellGrades.includes("레어");
                rareSubRowEl.style.opacity = rareActive ? '1' : '0.45';
                excludeChkEl.disabled = !rareActive;
                excludeChkEl.parentElement.style.cursor = rareActive ? 'pointer' : 'not-allowed';

                console.log(`[상점 설정] 판매 등급: [${shopSellGrades.join(', ') || '없음'}]`);
            };
        });

        excludeChkEl.onchange = (e) => {
            isExcludeRareGlovesBoots = e.target.checked;
            localStorage.setItem('modak_shop_exclude_gloves_boots', isExcludeRareGlovesBoots);
            console.log(`[상점 설정] 레어 장갑·장화 제외: ${isExcludeRareGlovesBoots ? 'ON' : 'OFF'}`);
        };

        panel.querySelector('#toggle-shop-btn').onclick = (e) => {
            isShopSellEnabled = !isShopSellEnabled;
            localStorage.setItem('modak_shop_sell_enabled', isShopSellEnabled);
            e.target.style.background = isShopSellEnabled ? '#2e7d32' : '#c62828';
            e.target.innerText = isShopSellEnabled ? 'ON' : 'OFF';
        };
        const enhanceSelectEl = panel.querySelector('#enhance-level-select');
        enhanceSelectEl.addEventListener('click', () => window.focus());
        enhanceSelectEl.onchange = (e) => {
            autoEnhanceTargetLevel = parseInt(e.target.value, 10);
            localStorage.setItem('modak_auto_enhance_level', autoEnhanceTargetLevel);
            console.log(`[자동 강화 설정] 목표 수치 '+${autoEnhanceTargetLevel}'(으)로 변경 완료`);
            enhanceSelectEl.blur();
        };
        panel.querySelector('#toggle-enhance-btn').onclick = (e) => {
            isAutoEnhanceEnabled = !isAutoEnhanceEnabled;
            localStorage.setItem('modak_auto_enhance_enabled', isAutoEnhanceEnabled);
            e.target.style.background = isAutoEnhanceEnabled ? '#2e7d32' : '#c62828';
            e.target.innerText = isAutoEnhanceEnabled ? 'ON' : 'OFF';
        };
        panel.querySelector('#start-h').onchange = (e) => {
            bossHuntStartHour = parseInt(e.target.value, 10);
            localStorage.setItem('modak_boss_start_hour', bossHuntStartHour);
        };
        panel.querySelector('#end-h').onchange = (e) => {
            bossHuntEndHour = parseInt(e.target.value, 10);
            localStorage.setItem('modak_boss_end_hour', bossHuntEndHour);
        };

        groundSelectEl.addEventListener('click', () => window.focus());
        groundSelectEl.onchange = (e) => {
            selectedHuntingGround = e.target.value;
            localStorage.setItem('modak_default_ground', selectedHuntingGround);
            renderGroundOptions();
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
    window.testBlacksmith = visitBlacksmithAndEnhance;

    console.log("모닥 온라인 스마트 라우팅 네비게이션 v4.00 로딩 완료!");
})();
