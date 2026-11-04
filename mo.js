// ==UserScript==
// @name         모닥 온라인 보스 오토봇 v3.50
// @namespace    http://tampermonkey.net/
// @version      3.50
// @match        https://modakmmo.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/corestandard/mo/refs/heads/main/mo.js
// @updateURL    https://raw.githubusercontent.com/corestandard/mo/refs/heads/main/mo.js
// ==/UserScript==

(function() {
    'use strict';

    function simulateKey(keyChar, duration = 200) {
        const char = keyChar.toLowerCase();
        const keyCode = char.charCodeAt(0);

        const downEvt = new KeyboardEvent('keydown', { key: char, code: 'Key' + char.toUpperCase(), keyCode: keyCode, which: keyCode, bubbles: true });
        const pressEvt = new KeyboardEvent('keypress', { key: char, code: 'Key' + char.toUpperCase(), keyCode: keyCode, which: keyCode, bubbles: true });
        const upEvt = new KeyboardEvent('keyup', { key: char, code: 'Key' + char.toUpperCase(), keyCode: keyCode, which: keyCode, bubbles: true });

        document.dispatchEvent(downEvt);
        document.dispatchEvent(pressEvt);

        setTimeout(() => {
            document.dispatchEvent(upEvt);
        }, duration);
    }

    function holdKey(keyChar, durationSec) {
        return new Promise(resolve => {
            const char = keyChar.toLowerCase();
            const keyCode = char.charCodeAt(0);
            const downEvt = new KeyboardEvent('keydown', { key: char, code: 'Key' + char.toUpperCase(), keyCode: keyCode, which: keyCode, bubbles: true });

            console.log(`  -> [이동] '${char.toUpperCase()}' 방향 ${durationSec}초간 유지`);
            document.dispatchEvent(downEvt);

            setTimeout(() => {
                const upEvt = new KeyboardEvent('keyup', { key: char, code: 'Key' + char.toUpperCase(), keyCode: keyCode, which: keyCode, bubbles: true });
                document.dispatchEvent(upEvt);
                setTimeout(resolve, 200);
            }, durationSec * 1000);
        });
    }

    function holdTwoKeys(keyChars, durationSec) {
        return new Promise(resolve => {
            const chars = [keyChars[0].toLowerCase(), keyChars[1].toLowerCase()];
            console.log(`  -> [동시 이동] '${chars[0].toUpperCase()}+${chars[1].toUpperCase()}' 방향 ${durationSec}초간 유지`);

            chars.forEach(char => {
                const keyCode = char.charCodeAt(0);
                const downEvt = new KeyboardEvent('keydown', { key: char, code: 'Key' + char.toUpperCase(), keyCode: keyCode, which: keyCode, bubbles: true });
                document.dispatchEvent(downEvt);
            });

            setTimeout(() => {
                chars.forEach(char => {
                    const keyCode = char.charCodeAt(0);
                    const upEvt = new KeyboardEvent('keyup', { key: char, code: 'Key' + char.toUpperCase(), keyCode: keyCode, which: keyCode, bubbles: true });
                    document.dispatchEvent(upEvt);
                });
                setTimeout(resolve, 200);
            }, durationSec * 1000);
        });
    }

    const randomSleep = (minMs, maxMs) => {
        const randomTime = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
        return new Promise(resolve => setTimeout(resolve, randomTime));
    };

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

    async function ensureMount(maxRetries = 5) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (isCurrentlyMounted()) {
                console.log("  -> [탈것 판별 완료] 이미 탈것에 정상 탑승 중입니다.");
                return true;
            }

            const mountBtn = getMountButton();
            if (!mountBtn) {
                console.log(`  -> [탈것 시도 ${attempt}/${maxRetries}] DOM 버튼을 찾지 못해 'r' 키를 입력합니다.`);
                simulateKey('r');
            } else {
                console.log(`  -> [탈것 시도 ${attempt}/${maxRetries}] 미탑승 상태 확인! '탑승' 버튼을 클릭합니다.`);
                mountBtn.click();
            }

            let waitStart = Date.now();
            while (Date.now() - waitStart < 2000) {
                await randomSleep(200, 300);
                if (isCurrentlyMounted()) {
                    console.log(`  -> [탈것 탑승 성공] ${attempt}번째 시도 만에 탈것 탑승이 확인되었습니다!`);
                    await randomSleep(300, 500);
                    return true;
                }
            }

            console.log(`  -> [탈것 미탑승 감지] ${attempt}번째 탑승 실패. UI 정리(ESC) 후 재시도합니다...`);
            simulateKey('Escape');
            await randomSleep(400, 700);
        }

        console.log("  -> [탈것 탑승 최종 실패] 최대 재시도 횟수를 초과했습니다.");
        return false;
    }

    function getCurrentMapName() {
        const mapNameEl = document.getElementsByClassName("panel-list-name")[0];
        return mapNameEl ? mapNameEl.innerText.trim() : "";
    }

    async function waitForMap(expectedName, timeoutSec = 15) {
        console.log(`  -> [맵 검증 대기] '${expectedName}' 진입 대기 중 (최대 ${timeoutSec}초)...`);
        let startTime = Date.now();
        while (Date.now() - startTime < timeoutSec * 1000) {
            let currentMap = getCurrentMapName();
            if (currentMap.includes(expectedName)) {
                console.log(`  -> [맵 진입 확인] 현재 위치: '${currentMap}'`);
                await randomSleep(600, 1000);
                return true;
            }
            await randomSleep(200, 400);
        }
        console.log(`  -> [맵 진입 시간 초과] '${expectedName}'로 이동 실패`);
        return false;
    }

    async function waitForWaypointMenu(timeoutMs = 4000) {
        console.log("  -> [웨이포인트 대기] 목적지 창 렌더링 확인 중...");
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const destinations = document.getElementsByClassName("waypoint-destination");
            if (destinations && destinations.length > 0) {
                await randomSleep(250, 400);
                return true;
            }
            await randomSleep(150, 250);
        }
        console.log("  -> [웨이포인트 대기 시간 초과] 목적지 목록을 찾지 못했습니다.");
        return false;
    }

    const HUNTING_GROUNDS = [
        { id: "wasteland_1", name: "황야1 (큰거 - 선인장 액기스)", escapeKey: "s", escapeSec: 2.0 },
        { id: "wasteland_2", name: "황야2 (작은거 - 선인장 액기스)", escapeKey: "s", escapeSec: 2.0 },
        { id: "canyon_entry", name: "협곡 진입로 (피울음 가죽갑옷)", escapeKey: "d", escapeSec: 2.0 },
        { id: "bone_canyon", name: "뼈바람 협곡 (강철비 화살통, 주술사의 혈석 반지)", escapeKey: "w", escapeSec: 2.0 },
        { id: "archive", name: "망국의 기록 보관소 (잊히지 않은 기도)", escapeKey: "a", escapeSec: 2.0 },
        { id: "castle_center_east", name: "잊혀진 고성 중앙부_동쪽 (집요한 추격의 반지)", escapeKey: "a", escapeSec: 2.0 },
        { id: "castle_center_west", name: "잊혀진 고성 중앙부_서쪽 (집요한 추격의 반지)", escapeKey: "d", escapeSec: 2.0 },
        { id: "castle_center_south", name: "잊혀진 고성 중앙부_남쪽 (집요한 추격의 반지)", escapeKey: "w", escapeSec: 2.0 },
        { id: "castle_center_north", name: "잊혀진 고성 중앙부_북쪽 (집요한 추격의 반지)", escapeKey: "s", escapeSec: 2.0 },
        { id: "shade_forest_11", name: "그늘숲 11시 (오크의 전투나팔)", escapeKey: "w", escapeSec: 2.0 },
        { id: "shade_forest_3", name: "그늘숲 3시 (오크의 전투나팔)", escapeKey: "d", escapeSec: 2.0 }
    ];

    let selectedHuntingGround = localStorage.getItem('modak_default_ground') || "wasteland_1";
    let isBossHuntingEnabled = localStorage.getItem('modak_boss_hunt_enabled') !== 'false';
    let savedPosX = localStorage.getItem('modak_ui_pos_x');
    let savedPosY = localStorage.getItem('modak_ui_pos_y');

    function getCurrentHuntingGroundConfig() {
        return HUNTING_GROUNDS.find(g => g.id === selectedHuntingGround) || HUNTING_GROUNDS[0];
    }

    function createSettingsUI() {
        if (document.getElementById('modak-bot-settings-ui')) return;

        const panel = document.createElement('div');
        panel.id = 'modak-bot-settings-ui';
        panel.tabIndex = -1;

        let initialStyle = `
            position: fixed;
            z-index: 99999;
            background: rgba(20, 20, 20, 0.9);
            color: #ffffff;
            width: 280px;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.6);
            font-family: sans-serif;
            font-size: 13px;
            border: 1px solid rgba(255,255,255,0.2);
            user-select: none;
        `;

        if (savedPosX !== null && savedPosY !== null) {
            initialStyle += `left: ${savedPosX}px; top: ${savedPosY}px;`;
        } else {
            initialStyle += `bottom: 20px; right: 20px;`;
        }

        panel.style.cssText = initialStyle;

        let optionsHTML = HUNTING_GROUNDS.map(g => 
            `<option value="${g.id}" ${selectedHuntingGround === g.id ? 'selected' : ''}>${g.name}</option>`
        ).join('');

        panel.innerHTML = `
            <div id="bot-ui-header" style="background: rgba(40,40,40,0.95); padding: 10px 12px; border-top-left-radius: 7px; border-top-right-radius: 7px; font-weight: bold; display: flex; justify-content: space-between; align-items: center; cursor: move; border-bottom: 1px solid #444;">
                <span style="pointer-events: none;">🛠️ 오토봇 기본 사냥터 설정</span>
                <div>
                    <span id="bot-ui-toggle" style="cursor: pointer; font-size: 11px; color: #aaa; margin-right: 8px; padding: 2px 4px;">[접기]</span>
                </div>
            </div>
            <div id="bot-ui-content" style="padding: 12px 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <span style="font-size: 12px; font-weight: bold;">보스 자동 사냥:</span>
                    <button id="boss-hunt-toggle-btn" style="padding: 4px 12px; font-size: 11px; font-weight: bold; border-radius: 4px; border: none; cursor: pointer; background: ${isBossHuntingEnabled ? '#2e7d32' : '#c62828'}; color: #fff;">
                        ${isBossHuntingEnabled ? 'ON (일반 보스 진행)' : 'OFF (마장기만 출동)'}
                    </button>
                </div>
                <select id="hunting-ground-select" style="width: 100%; padding: 6px; background: #333; color: #fff; border: 1px solid #555; border-radius: 4px; cursor: pointer; font-size: 12px;">
                    ${optionsHTML}
                </select>
                <div style="margin-top: 8px; font-size: 11px; color: #88f; text-align: right;">v3.50 활성화됨</div>
            </div>
        `;

        document.body.appendChild(panel);

        const bossToggleBtn = document.getElementById('boss-hunt-toggle-btn');
        bossToggleBtn.addEventListener('click', () => {
            isBossHuntingEnabled = !isBossHuntingEnabled;
            localStorage.setItem('modak_boss_hunt_enabled', isBossHuntingEnabled);
            bossToggleBtn.style.background = isBossHuntingEnabled ? '#2e7d32' : '#c62828';
            bossToggleBtn.innerText = isBossHuntingEnabled ? 'ON (일반 보스 진행)' : 'OFF (마장기만 출동)';
            console.log(`[보스 설정] 보스 사냥 상태: ${isBossHuntingEnabled ? 'ON' : 'OFF (망국의 마장기만 예외 출동)'}`);
            bossToggleBtn.blur();
        });

        const selectElem = document.getElementById('hunting-ground-select');
        selectElem.addEventListener('change', (e) => {
            selectedHuntingGround = e.target.value;
            localStorage.setItem('modak_default_ground', selectedHuntingGround);
            console.log(`[사냥터 변경] 기본 사냥터가 '${selectedHuntingGround}'(으)로 설정되었습니다.`);
            selectElem.blur();
        });

        selectElem.addEventListener('click', () => {
            window.focus();
        });

        const header = document.getElementById('bot-ui-header');
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

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        function onMouseMove(e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            panel.style.left = newLeft + 'px';
            panel.style.top = newTop + 'px';
        }

        function onMouseUp() {
            if (isDragging) {
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                const rect = panel.getBoundingClientRect();
                localStorage.setItem('modak_ui_pos_x', rect.left);
                localStorage.setItem('modak_ui_pos_y', rect.top);
            }
        }

        const toggleBtn = document.getElementById('bot-ui-toggle');
        const contentDiv = document.getElementById('bot-ui-content');
        let isCollapsed = false;
        toggleBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            contentDiv.style.display = isCollapsed ? 'none' : 'block';
            toggleBtn.innerText = isCollapsed ? '[펼치기]' : '[접기]';
            toggleBtn.blur();
        });
    }

    const BOSS_LIST = [
        { index: 0, name: "악몽의 집합체" },
        { index: 1, name: "망국의 마장기" },
        { index: 2, name: "망령 공성대장" },
        { index: 3, name: "공허의 해골마도사" },
        { index: 4, name: "고대 점액군주" },
        { index: 5, name: "태양가시 거수" },
        { index: 6, name: "스컬 워로드" },
        { index: 7, name: "뼈바람 포식자" },
        { index: 8, name: "뒤틀린 태초목" },
        { index: 9, name: "붉은송곳니 우두머리" }
    ];

    const BOSS_ROUTES = {
        0: [
            { type: "js", script: () => document.getElementsByClassName("waypoint-destination")[2].click(), wait: 3.0 },
            { type: "wait_map", name: "잊혀진 고성 중앙부", timeout: 10 },
            { type: "move", key: "a", duration: 1.5 },
            { type: "move", key: "w", duration: 1.5 },
            { type: "move", key: "f", duration: 1.0 },
            { type: "wait_map", name: "망국의 기록보관소", timeout: 15 },
            { type: "hunt_boss" },
            { type: "return_hunting_ground" }
        ],
        1: [
            { type: "js", script: () => document.getElementsByClassName("waypoint-destination")[2].click(), wait: 3.0 },
            { type: "wait_map", name: "잊혀진 고성 중앙부", timeout: 10 },
            { type: "move", key: "d", duration: 1.5 },
            { type: "move", key: "s", duration: 1.5 },
            { type: "move", key: "f", duration: 1.0 },
            { type: "wait_map", name: "망국의 병기창", timeout: 15 },
            { type: "move", key: "s", duration: 1.5 },
            { type: "move", key: "a", duration: 1.5 },
            { type: "move", key: "s", duration: 1.5 },
            { type: "move", key: "d", duration: 2.3 },
            { type: "hunt_boss" },
            { type: "return_hunting_ground" }
        ],
        2: [
            { type: "js", script: () => document.getElementsByClassName("waypoint-destination")[2].click(), wait: 3.0 },
            { type: "wait_map", name: "잊혀진 고성 중앙부", timeout: 10 },
            { type: "move", key: "s", duration: 1.5 },
            { type: "move", key: "a", duration: 1.5 },
            { type: "move", key: "f", duration: 1.0 },
            { type: "wait_map", name: "잊혀진 고성 입구", timeout: 15 },
            { type: "move", key: "w", duration: 5.0 },
            { type: "hunt_boss" },
            { type: "return_hunting_ground" }
        ],
        3: [
            { type: "js", script: () => document.getElementsByClassName("waypoint-destination")[1].click(), wait: 3.0 },
            { type: "wait_map", name: "망자의 묘지", timeout: 15 },
            { type: "move", key: "w", duration: 10.0 },
            { type: "hunt_boss" },
            { type: "move", key: "w", duration: 3.0 },
            { type: "return_hunting_ground" }
        ],
        4: [
            { type: "esc", wait: 1.0 },
            { type: "move", key: "d", duration: 1.5 },
            { type: "move", key: "s", duration: 1.5 },
            { type: "move", key: "f", duration: 1.0 },
            { type: "wait_map", name: "초원", timeout: 15 },
            { type: "move", key: "d", duration: 6.0 },
            { type: "move", key: "a", duration: 1.0 },
            { type: "hunt_boss" },
            { type: "return_hunting_ground" }
        ],
        5: [
            { type: "js", script: () => document.getElementsByClassName("waypoint-destination")[1].click(), wait: 3.0 },
            { type: "wait_map", name: "망자의 묘지", timeout: 10 },
            { type: "move", key: "a", duration: 2.0 },
            { type: "move", key: "f", duration: 1.0 },
            { type: "wait_map", name: "황야", timeout: 15 },
            { type: "move", key: "s", duration: 8.0 },
            { type: "move", key: "w", duration: 0.3 },
            { type: "hunt_boss" },
            { type: "return_hunting_ground" }
        ],
        6: [
            { type: "js", script: () => document.getElementsByClassName("waypoint-destination")[3].click(), wait: 3.0 },
            { type: "wait_map", name: "뼈바람 협곡", timeout: 10 },
            { type: "move", key: "a", duration: 1.3 },
            { type: "move", key: "w", duration: 0.8 },
            { type: "move", key: "f", duration: 1.0 },
            { type: "wait_map", name: "협곡 진입로", timeout: 15 },
            { type: "move", key: "d", duration: 4.3 },
            { type: "move", key: "w", duration: 2.2 },
            { type: "move", key: "f", duration: 1.0 },
            { type: "wait_map", name: "그늘숲", timeout: 15 },
            { type: "move", key: "a", duration: 2.0 },
            { type: "move", key: "w", duration: 0.7 },
            { type: "hunt_boss" },
            { type: "return_hunting_ground" }
        ],
        7: [
            { type: "js", script: () => document.getElementsByClassName("waypoint-destination")[3].click(), wait: 3.0 },
            { type: "wait_map", name: "뼈바람 협곡", timeout: 10 },
            { type: "move", key: "a", duration: 1.3 },
            { type: "move", key: "w", duration: 0.8 },
            { type: "move", key: "f", duration: 1.0 },
            { type: "wait_map", name: "협곡 진입로", timeout: 15 },
            { type: "move", key: "w", duration: 1.5 },
            { type: "hunt_boss" },
            { type: "move", key: "d", duration: 3.0 },
            { type: "return_hunting_ground" }
        ],
        8: [
            { type: "js", script: () => document.getElementsByClassName("waypoint-destination")[4].click(), wait: 3.0 },
            { type: "wait_map", name: "붉은숲 피난처", timeout: 10 },
            { type: "move", key: "d", duration: 2.0 },
            { type: "move", key: "w", duration: 0.2 },
            { type: "move", key: "f", duration: 1.0 },
            { type: "wait_map", name: "수호자의 안식처", timeout: 15 },
            { type: "move", key: "a", duration: 1.8 },
            { type: "move", key: "w", duration: 0.4 },
            { type: "hunt_boss" },
            { type: "return_hunting_ground" }
        ],
        9: [
            { type: "js", script: () => document.getElementsByClassName("waypoint-destination")[4].click(), wait: 3.0 },
            { type: "wait_map", name: "붉은숲 피난처", timeout: 15 },
            { type: "move", key: "a", duration: 3.0 },
            { type: "hunt_boss" },
            { type: "return_hunting_ground" }
        ]
    };

    let isRunning = false;
    let currentBossIndex = -1;
    let pendingBossData = null;
    let isHandlingDeath = false;
    let isReturning = false;
    const defeatedBosses = new Set();

    async function moveToSelectedHuntingGround() {
        console.log(`\n--- [99] 선택된 기본 사냥터 이동 시작: ${selectedHuntingGround} ---`);

        const returnSuccess = await returnTownAndClickCampfire(false);
        if (!returnSuccess) {
            console.log("  -> [중단] 마을 귀환 실패로 기본 사냥터 이동을 취소합니다.");
            return;
        }

        await waitForWaypointMenu(4000);

        switch (selectedHuntingGround) {
            case "wasteland_1":
                try { document.getElementsByClassName("waypoint-destination")[1].click(); } catch(e) {}
                await waitForMap("망자의 묘지", 15);
                await randomSleep(500, 1450);
                await holdKey("a", 2.0);
                await holdKey("f", 1.0);
                await waitForMap("황야", 15);
                await randomSleep(500, 767);
                await holdKey("a", 0.7);
                break;

            case "wasteland_2":
                try { document.getElementsByClassName("waypoint-destination")[1].click(); } catch(e) {}
                await waitForMap("망자의 묘지", 15);
                await randomSleep(500, 1450);
                await holdKey("a", 2.0);
                await holdKey("f", 1.0);
                await waitForMap("황야", 15);
                await randomSleep(500, 767);
                await holdKey("a", 3.6);
                break;

            case "canyon_entry":
                try { document.getElementsByClassName("waypoint-destination")[3].click(); } catch(e) {}
                await waitForMap("뼈바람 협곡", 15);
                await randomSleep(500, 1450);
                await holdKey("a", 1.3);
                await holdKey("w", 0.8);
                await holdKey("f", 1.0);
                await waitForMap("협곡 진입로", 15);
                await randomSleep(500, 767);
                await holdKey("w", 1.5);
                break;

            case "bone_canyon":
                try { document.getElementsByClassName("waypoint-destination")[3].click(); } catch(e) {}
                await waitForMap("뼈바람 협곡", 15);
                await randomSleep(500, 767);
                await holdKey("s", 2.2);
                break;

            case "archive":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                await waitForMap("잊혀진 고성 중앙부", 15);
                await randomSleep(500, 1450);
                await holdKey("a", 1.5);
                await holdKey("w", 1.5);
                await holdKey("f", 1.0);
                await waitForMap("망국의 기록보관소", 15);
                await randomSleep(500, 767);
                await holdKey("d", 1.7);
                await holdKey("w", 0.6);
                await holdKey("f", 1.0);
                break;

            case "castle_center_south":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                await waitForMap("잊혀진 고성 중앙부", 15);
                await randomSleep(500, 1450);
                await holdKey("s", 2.3);
                break;

            case "castle_center_west":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                await waitForMap("잊혀진 고성 중앙부", 15);
                await randomSleep(500, 1450);
                await holdKey("a", 2.8);
                await holdKey("s", 0.2);
                break;

            case "castle_center_east":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                await waitForMap("잊혀진 고성 중앙부", 15);
                await randomSleep(500, 1450);
                await holdKey("d", 2.5);
                break;

            case "castle_center_north":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                await waitForMap("잊혀진 고성 중앙부", 15);
                await randomSleep(500, 1450);
                await holdKey("w", 2.5);
                await holdKey("d", 0.3);
                break;

            case "shade_forest_11":
                try { document.getElementsByClassName("waypoint-destination")[3].click(); } catch(e) {}
                await waitForMap("뼈바람 협곡", 15);
                await randomSleep(500, 1450);
                await holdKey("a", 1.3);
                await holdKey("w", 0.8);
                await holdKey("f", 1.0);
                await waitForMap("협곡 진입로", 15);
                await randomSleep(500, 767);
                await holdKey("d", 4.3);
                await holdKey("w", 2.2);
                await holdKey("f", 1.0);
                await waitForMap("그늘숲", 15);
                await randomSleep(500, 767);
                await holdKey("w", 2.0);
                break;

            case "shade_forest_3":
                try { document.getElementsByClassName("waypoint-destination")[3].click(); } catch(e) {}
                await waitForMap("뼈바람 협곡", 15);
                await randomSleep(500, 1450);
                await holdKey("a", 1.3);
                await holdKey("w", 0.8);
                await holdKey("f", 1.0);
                await waitForMap("협곡 진입로", 15);
                await randomSleep(500, 767);
                await holdKey("d", 4.3);
                await holdKey("w", 2.2);
                await holdKey("f", 1.0);
                await waitForMap("그늘숲", 15);
                await randomSleep(500, 767);
                await holdKey("w", 1.5);
                await holdKey("d", 3.0);
                break;

            default:
                break;
        }

        simulateKey('Escape');
        await randomSleep(250, 450);
        simulateKey('z');
        console.log("--- [99] 기본 사냥터 이동 완료 ---");
    }

    async function returnToDefaultHuntingGround() {
        if (isReturning) return;
        isReturning = true;
        try {
            await moveToSelectedHuntingGround();
        } finally {
            isReturning = false;
        }
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
        if (getCurrentMapName() === "모닥 마을") {
            return true;
        }

        console.log("  -> [스마트 귀환 시작] UI 정돈 후 귀환 시도");
        simulateKey('Escape');
        await randomSleep(250, 400);
        simulateKey('z');
        await randomSleep(350, 500);

        const currentGroundConfig = getCurrentHuntingGroundConfig();
        const escapeKey = currentGroundConfig.escapeKey || 's';
        const escapeSec = currentGroundConfig.escapeSec || 2.0;

        for (let attempt = 1; attempt <= 10; attempt++) {
            if (getCurrentMapName() === "모닥 마을") return true;

            const portalBtn = getTownPortalButton();
            if (portalBtn && !isTownPortalActive()) {
                console.log(`  -> [귀환 시도 ${attempt}/10] '마을 귀환' 클릭`);
                portalBtn.click();
            } else if (!portalBtn && !isTownPortalActive()) {
                simulateKey('b');
            }

            let castStart = Date.now();
            let isCastingInterrupted = false;

            while (Date.now() - castStart < 3600) {
                await randomSleep(150, 250);
                if (getCurrentMapName() === "모닥 마을") {
                    console.log("  -> [귀환 완료] 모닥 마을 진입 성공!");
                    return true;
                }
                if (!isTownPortalActive() && Date.now() - castStart > 1200) {
                    isCastingInterrupted = true;
                    break;
                }
            }

            if (isCastingInterrupted) {
                console.log(`  -> [귀환 취소 감지] 피격 발생. '${escapeKey.toUpperCase()}' 방향 ${escapeSec}초 이동 후 재시도`);
                await holdKey(escapeKey, escapeSec);
                await randomSleep(400, 700);
            }
        }

        console.log("  -> [귀환 최종 실패] 최대 시도 횟수를 초과했습니다.");
        return false;
    }

    async function returnTownAndClickCampfire(skipCampfire = false) {
        let currentMap = getCurrentMapName();
        if (currentMap === "모닥 마을") {
            console.log(`  -> [마을 상태 확인] 현재 위치('${currentMap}')가 이미 '모닥 마을'이므로 귀환을 생략합니다.`);
        } else {
            const success = await smartReturnTown();
            if (!success) {
                console.log("  -> [오류] 마을 귀환 실패로 정비 및 상호작용 단계를 중단합니다.");
                return false;
            }
        }

        await randomSleep(600, 1000);
        simulateKey('Escape');
        await randomSleep(200, 350);
        
        await ensureMount();

        if (skipCampfire) {
            console.log("  -> [고대 점액군주] 캠프파이어 상호작용('f')을 생략합니다.");
        } else {
            console.log("  -> [캠프파이어 상호작용] 'f' 키 입력");
            simulateKey('f');
            await randomSleep(600, 1000);
        }

        return true;
    }

    async function huntBossAndLoot(timeoutSec = 240) {
        simulateKey('z');
        let startTime = Date.now();
        while (Date.now() - startTime < timeoutSec * 1000) {
            await randomSleep(900, 1300);

            if (pendingBossData && pendingBossData.index === 1 && currentBossIndex !== 1) {
                console.log("  -> [긴급 탈출] 사냥 중 1번 마장기 예약 감지! 즉시 루틴을 중단합니다.");
                simulateKey('Escape');
                return "urgent_switch";
            }

            const closeBtn = document.querySelector('section.loot-panel button[aria-label="전리품 닫기"]');
            if (closeBtn) {
                await randomSleep(1255, 1876);
                closeBtn.click();
                await randomSleep(800, 1200);
                return true;
            }
        }
        simulateKey('Escape');
        return false;
    }

    // 💡 단일 루프 큐 방식으로 개편된 보스 수행 메인 함수
    async function executeBossTask(initialBossIndex, initialBossName) {
        if (!isBossHuntingEnabled && initialBossIndex !== 1) {
            console.log(`  -> [보스 사냥 OFF] '${initialBossName}' 출동을 건너뜁니다.`);
            return;
        }

        // 이미 실행 중이면 예약만 등록하고 메인 루프에 위임
        if (isRunning || isReturning) {
            if (initialBossIndex === 1) {
                console.log(`[우선순위 갱신] 1번 마장기가 예약되었습니다. 기존 예약을 교체합니다.`);
                pendingBossData = { index: initialBossIndex, name: initialBossName };
            } else if (isBossHuntingEnabled && !pendingBossData && !defeatedBosses.has(initialBossIndex)) {
                console.log(`[보스 예약됨] 현재 작업 진행 중이므로 [${initialBossIndex}] ${initialBossName}을(를) 예약합니다.`);
                pendingBossData = { index: initialBossIndex, name: initialBossName };
            }
            return;
        }

        isRunning = true;
        let currentTarget = { index: initialBossIndex, name: initialBossName };

        // 큐 소모 메인 루프 (예약이 있으면 연달아 처리)
        while (currentTarget) {
            let bossIndex = currentTarget.index;
            let bossName = currentTarget.name;
            currentBossIndex = bossIndex;
            let routeSuccess = true;

            console.log(`\n=== [보스 출동 시작] [${bossIndex}] ${bossName} ===`);

            if (defeatedBosses.has(bossIndex)) {
                console.log(`  -> [출동 취소] '${bossName}'(은)는 이미 처치된 보스입니다.`);
                routeSuccess = false;
            } else {
                try {
                    const townReturned = await returnTownAndClickCampfire(bossIndex === 4);
                    if (!townReturned) {
                        console.log("  -> [중단] 마을 귀환 실패로 보스 출동을 취소합니다.");
                        routeSuccess = false;
                    } else {
                        const route = BOSS_ROUTES[bossIndex];
                        if (route) {
                            for (let i = 0; i < route.length; i++) {
                                const step = route[i];

                                // 1번 마장기 긴급 전환 확인
                                if (pendingBossData && pendingBossData.index === 1 && currentBossIndex !== 1) {
                                    console.log(`  -> [1번 마장기 긴급 전환] 현재 보스 중단 및 마장기 전환!`);
                                    simulateKey('Escape');
                                    routeSuccess = false;
                                    break;
                                }

                                // 이동 중 목표 보스가 처치되었는지 확인
                                if (defeatedBosses.has(currentBossIndex)) {
                                    console.log(`  -> [이동 중 취소] 현재 목표 '${bossName}' 처치 확인! 이동을 중단합니다.`);
                                    simulateKey('Escape');
                                    routeSuccess = false;
                                    break;
                                }

                                if (isHandlingDeath || currentBossIndex === -1) break;

                                if (step.type === "js") {
                                    if (i === 0 && bossIndex !== 4) {
                                        const opened = await waitForWaypointMenu(4000);
                                        if (!opened) {
                                            simulateKey('f');
                                            await waitForWaypointMenu(3000);
                                        }
                                    }

                                    try {
                                        let success = false;
                                        let startAttempt = Date.now();
                                        while (Date.now() - startAttempt < 3000) {
                                            try { 
                                                step.script(); 
                                                success = true; 
                                                break; 
                                            } catch (err) { 
                                                await randomSleep(150, 300); 
                                            }
                                        }
                                    } catch(e) {}
                                    await randomSleep((step.wait * 1000) - 200, (step.wait * 1000) + 400);
                                    simulateKey('Escape');
                                    await randomSleep(250, 400);
                                } else if (step.type === "wait_map") {
                                    const isSuccess = await waitForMap(step.name, step.timeout);
                                    if (!isSuccess) {
                                        simulateKey('Escape');
                                        await randomSleep(400, 600);
                                        let currentMap = getCurrentMapName();

                                        if (currentMap === "모닥 마을") {
                                            simulateKey('Escape');
                                            await randomSleep(250, 450);
                                            await ensureMount();
                                            await holdKey('s', 6.5);
                                            await holdKey('w', 3.6);
                                            await randomSleep(300, 600);
                                            simulateKey('f');
                                            await randomSleep(1000, 1500);
                                        } else {
                                            await returnTownAndClickCampfire(bossIndex === 4);
                                        }
                                        routeSuccess = false;
                                        break;
                                    }
                                } else if (step.type === "move") {
                                    if (step.key.length > 1) await holdTwoKeys(step.key, step.duration);
                                    else await holdKey(step.key, step.duration);
                                    await randomSleep(150, 350);
                                } else if (step.type === "esc") {
                                    simulateKey('Escape');
                                    await randomSleep(((step.wait || 0.3) * 1000), ((step.wait || 0.3) * 1000) + 300);
                                } else if (step.type === "hunt_boss") {
                                    if (pendingBossData && pendingBossData.index === 1 && currentBossIndex !== 1) {
                                        break;
                                    }
                                    const lootResult = await huntBossAndLoot(240);
                                    if (lootResult === "urgent_switch") {
                                        routeSuccess = false;
                                        break;
                                    }
                                } else if (step.type === "return_hunting_ground") {
                                    // 💡 보스 사냥 완료! 예약이 있으면 루프를 계속 돌고, 없으면 기본 사냥터로
                                    break;
                                }
                            }
                        }
                    }
                } catch (err) {
                    routeSuccess = false;
                }
            }

            // 💡 현재 보스 루틴 종료 후 예약 검사 (재귀 호출 대신 큐 전환)
            if (pendingBossData && !defeatedBosses.has(pendingBossData.index) && (isBossHuntingEnabled || pendingBossData.index === 1)) {
                console.log(`  -> [예약 연계 출동] 다음 예약된 보스(${pendingBossData.name})로 전환합니다!`);
                currentTarget = pendingBossData;
                pendingBossData = null;
                await randomSleep(500, 1000);
            } else {
                currentTarget = null;
                pendingBossData = null;
            }
        }

        currentBossIndex = -1;
        isRunning = false;

        // 모든 보스 처치 또는 취소 후 기본 사냥터 복귀
        if (!isHandlingDeath) {
            console.log("  -> [보스 루틴 완전 종료] 기본 사냥터로 복귀합니다.");
            await returnToDefaultHuntingGround();
        }
    }

    function checkAndHandleDeath() {
        if (isHandlingDeath || isReturning) return;

        const deathOverlay = document.querySelector('div.death-overlay');
        if (deathOverlay) {
            if (isRunning) return;

            const buttons = deathOverlay.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.innerText.includes("마을로 돌아가기")) {
                    isHandlingDeath = true;
                    isRunning = false;
                    currentBossIndex = -1;
                    pendingBossData = null;

                    setTimeout(async () => {
                        await randomSleep(600, 1200);
                        btn.click();

                        setTimeout(async () => {
                            isReturning = true;
                            await randomSleep(400, 800);
                            simulateKey('Escape');
                            await randomSleep(250, 450);
                            await ensureMount();
                            await holdKey('s', 6.5);
                            await holdKey('w', 3.6);
                            await randomSleep(300, 600);
                            simulateKey('f');
                            await randomSleep(1500, 2000);

                            isReturning = false;
                            isHandlingDeath = false;

                            if (pendingBossData && !defeatedBosses.has(pendingBossData.index) && (isBossHuntingEnabled || pendingBossData.index === 1)) {
                                let next = pendingBossData;
                                pendingBossData = null;
                                executeBossTask(next.index, next.name);
                            } else {
                                pendingBossData = null;
                                await returnToDefaultHuntingGround();
                            }
                        }, 1500);
                    }, 300);
                    break;
                }
            }
        }
    }

    const globalObserver = new MutationObserver((mutations) => {
        checkAndHandleDeath();
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.classList && node.classList.contains('is-world_event')) {
                        handleWorldEventChat(node);
                    } else {
                        const events = node.querySelectorAll?.('.chat-feed-item.is-world_event');
                        events?.forEach(handleWorldEventChat);
                    }
                }
            }
        }
    });

    globalObserver.observe(document.body, { childList: true, subtree: true });

    const processedMessages = new Set();
    function handleWorldEventChat(node) {
        const textEl = node.querySelector('.chat-msg-text');
        const timeEl = node.querySelector('.chat-msg-time');
        if (!textEl) return;

        const msgText = textEl.innerText.trim();
        const msgId = (timeEl ? timeEl.getAttribute('datetime') : '') + '_' + msgText;

        if (processedMessages.has(msgId)) return;
        processedMessages.add(msgId);

        const matchedBoss = BOSS_LIST.find(b => msgText.includes(b.name));
        if (!matchedBoss) return;

        // 1. 보스 출현 감지
        if (msgText.includes("출현")) {
            console.log(`[보스 출현 감지] [${matchedBoss.index}] ${matchedBoss.name}`);
            defeatedBosses.delete(matchedBoss.index);

            // 1번 마장기는 항상 출동
            if (matchedBoss.index === 1) {
                console.log("⚡ [긴급] 1번 망국의 마장기 출현! (사냥 옵션 무시 및 즉시 출동)");
                pendingBossData = { index: matchedBoss.index, name: matchedBoss.name };
                if (isRunning) {
                    simulateKey('Escape');
                } else {
                    let next = pendingBossData;
                    pendingBossData = null;
                    executeBossTask(next.index, next.name);
                }
                return;
            }

            // 보스 사냥 OFF 상태면 일반 보스는 완전 무시
            if (!isBossHuntingEnabled) {
                console.log(`  -> [보스 사냥 OFF] '${matchedBoss.name}' 출현을 무시하며, 현재 사냥을 계속 유지합니다.`);
                return;
            }

            setTimeout(() => {
                executeBossTask(matchedBoss.index, matchedBoss.name);
            }, Math.floor(Math.random() * 500) + 300);
        }

        // 2. 보스 처치 감지
        if (msgText.includes("처치되었습니다")) {
            console.log(`[보스 처치 감지] '${matchedBoss.name}'(이)가 처치되었습니다.`);
            defeatedBosses.add(matchedBoss.index);

            if (pendingBossData && pendingBossData.index === matchedBoss.index) {
                console.log(`  -> [예약 취소] 예약 목록에 있던 '${matchedBoss.name}'(이)가 처치되어 예약을 비웁니다.`);
                pendingBossData = null;
            }

            // 현재 잡던 보스가 잡힌 경우 루프 조기 탈출 유도
            if (isRunning && currentBossIndex === matchedBoss.index) {
                console.log("  -> [목표 보스 처치 확인] 현재 진행 중인 보스 작업의 잔여 단계를 스킵합니다.");
                simulateKey('Escape');
            }
        }
    }

    window.addEventListener('load', () => { createSettingsUI(); });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        createSettingsUI();
    }

    window.testBoss = executeBossTask;
    window.testHuntingGround = returnToDefaultHuntingGround;

    console.log("모닥 온라인 단독 오토봇 헬퍼 v3.50 가동 완료!");

})();
