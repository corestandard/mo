// ==UserScript==
// @name         모닥 온라인 보스 오토봇 v3.66
// @namespace    http://tampermonkey.net/
// @version      3.66
// @match        https://modakmmo.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/corestandard/mo/refs/heads/main/mo.js
// @updateURL    https://raw.githubusercontent.com/corestandard/mo/refs/heads/main/mo.js
// ==/UserScript==

(function() {
    'use strict';

    // 💡 [상점 이동 시간 설정]
    const SHOP_CONFIG = {
        toShopA: 1.2,   // 상점 갈 때: A 키 유지 시간(초)
        toShopW: 0.7,   // 상점 갈 때: W 키 유지 시간(초)
        toCampS: 1.2,   // 복귀할 때: S 키 유지 시간(초)
        toCampD: 0.7    // 복귀할 때: D 키 유지 시간(초)
    };

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

    // 💡 콘솔 활성화 상태에서도 포커스 유실 없이 강제 마우스 클릭 이벤트 전달
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

    // 💡 자동 사냥 상태 검증 및 안전 제어
    function getAutoHuntButton() {
        return document.querySelector('button.quick-action-slot[aria-label="자동 사냥"]');
    }

    function isAutoHuntingActive() {
        const btn = getAutoHuntButton();
        if (!btn) return false;
        return btn.getAttribute('aria-pressed') === 'true' || btn.classList.contains('is-active');
    }

    async function setAutoHunting(enable) {
        const current = isAutoHuntingActive();
        if (current === enable) return;

        const btn = getAutoHuntButton();
        if (btn) {
            forceClickElement(btn);
        } else {
            simulateKey('z');
        }

        const start = Date.now();
        while (Date.now() - start < 1500) {
            await randomSleep(150, 250);
            if (isAutoHuntingActive() === enable) {
                console.log(`⚔️ [자동 사냥] 상태 전환 완료: ${enable ? 'ON' : 'OFF'}`);
                return;
            }
        }
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

    async function ensureMount(maxRetries = 5) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (isCurrentlyMounted()) {
                console.log("  -> [탈것 판별 완료] 이미 탈것에 정상 탑승 중입니다.");
                return true;
            }

            if (document.querySelector('section.loot-panel')) {
                await ensureLootPanelClosed(2000);
            }

            const mountBtn = getMountButton();
            if (!mountBtn) {
                console.log(`  -> [탈것 시도 ${attempt}/${maxRetries}] DOM 버튼을 찾지 못해 'r' 키를 입력합니다.`);
                simulateKey('r');
            } else {
                console.log(`  -> [탈것 시도 ${attempt}/${maxRetries}] 미탑승 상태 확인! '탑승' 버튼을 클릭합니다.`);
                forceClickElement(mountBtn);
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
        
        console.log("  -> [웨이포인트 미발견] 창 정리(ESC) 후 캠프파이어(F) 재상호작용 시도...");
        await ensureLootPanelClosed(2000);
        simulateKey('Escape');
        await randomSleep(300, 500);
        simulateKey('f');
        
        const retryStart = Date.now();
        while (Date.now() - retryStart < 3000) {
            const destinations = document.getElementsByClassName("waypoint-destination");
            if (destinations && destinations.length > 0) {
                await randomSleep(250, 400);
                return true;
            }
            await randomSleep(150, 250);
        }

        console.log("  -> [웨이포인트 대기 최종 초과] 목적지 목록을 찾지 못했습니다.");
        return false;
    }

    // 💡 전리품 창(section.loot-panel) 닫기 검증
    async function ensureLootPanelClosed(timeoutMs = 4000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const lootPanel = document.querySelector('section.loot-panel');
            const closeBtn = document.querySelector('button[aria-label="전리품 닫기"]') ||
                             (lootPanel && lootPanel.querySelector('button[aria-label="전리품 닫기"]'));

            if (!lootPanel && !closeBtn) {
                return true;
            }

            if (closeBtn) {
                console.log("  -> [전리품 닫기] '전리품 닫기' 버튼 강제 클릭 실행!");
                forceClickElement(closeBtn);
            } else {
                console.log("  -> [전리품 닫기] 닫기 버튼 미발견으로 Escape 입력...");
                simulateKey('Escape');
            }

            await randomSleep(350, 500);
        }
        return false;
    }

    // 💡 상점 창(section.shop-panel) 닫기 검증
    async function ensureShopPanelClosed(timeoutMs = 5000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            const shopPanel = document.querySelector('section.shop-panel');
            if (!shopPanel) {
                console.log("  -> [상점 정리] 상점 창이 완전히 닫힌 것을 확인했습니다.");
                return true;
            }

            const closeBtn = document.querySelector('button[aria-label="상점 닫기"]') || 
                             (shopPanel && shopPanel.querySelector('button[aria-label="상점 닫기"]'));
            if (closeBtn) {
                console.log("  -> [상점 닫기] '상점 닫기' 버튼 강제 클릭!");
                forceClickElement(closeBtn);
            } else {
                console.log("  -> [상점 닫기] 닫기 버튼 미발견으로 Escape를 입력합니다...");
                simulateKey('Escape');
            }

            await randomSleep(350, 500);
        }
        return false;
    }

    // 💡 인벤토리 용량 확인
    async function checkInventorySlotCount() {
        console.log("🎒 [가방 검사] 'i' 키를 눌러 인벤토리 용량을 확인합니다...");
        await ensureLootPanelClosed(2000);
        simulateKey('Escape');
        await randomSleep(250, 400);
        
        simulateKey('i');
        await randomSleep(600, 900);

        let count = 0;
        const start = Date.now();
        while (Date.now() - start < 3000) {
            const gridEl = document.querySelector('.equipment-inventory[aria-label*="가방"]');
            if (gridEl) {
                const label = gridEl.getAttribute('aria-label') || '';
                const match = label.match(/가방\s*(\d+)\s*\/\s*\d+/);
                if (match) {
                    count = parseInt(match[1], 10);
                    break;
                }
            }

            const countSpan = document.querySelector('.inventory-heading-count');
            if (countSpan && countSpan.innerText) {
                const match = countSpan.innerText.match(/(\d+)\s*\/\s*\d+/);
                if (match) {
                    count = parseInt(match[1], 10);
                    break;
                }
            }
            await randomSleep(150, 250);
        }

        console.log("  -> 인벤토리 닫기 ('i' 토글 및 'Escape' 정리)");
        simulateKey('i');
        await randomSleep(250, 350);
        simulateKey('Escape');
        await randomSleep(350, 500);

        console.log(`🎒 [가방 상태 확인 완료] 현재 슬롯 사용량: ${count}/100`);
        return count;
    }

    // 💡 상점 방문 및 아이템 판매 루틴[cite: 1, 2, 3, 4, 5]
    async function visitShopAndSellItems() {
        console.log("\n🏪 [상점 방문 시작] 가방 정리(판매)를 위해 상점 NPC로 이동합니다.");
        
        await ensureMount();
        
        // 1. 상점 이동 (A ➔ W ➔ F)
        await holdKey('a', SHOP_CONFIG.toShopA);
        await randomSleep(300, 500);
        await holdKey('w', SHOP_CONFIG.toShopW);
        await randomSleep(400, 600);

        console.log("  -> [상점 상호작용] 'f' 키 입력");
        simulateKey('f');
        await randomSleep(1200, 1600);

        // 2. 판매 탭 찾기 및 클릭[cite: 1]
        let sellTabBtn = null;
        const tabStart = Date.now();
        while (Date.now() - tabStart < 3000) {
            const tabs = document.querySelectorAll('button[role="tab"]');
            for (const t of tabs) {
                if (t.innerText.includes("판매")) {
                    sellTabBtn = t;
                    break;
                }
            }
            if (sellTabBtn) break;
            await randomSleep(150, 250);
        }

        if (sellTabBtn) {
            console.log("  -> [1번] '판매' 탭 클릭");
            forceClickElement(sellTabBtn);
            await randomSleep(700, 1000);
        } else {
            console.log("  -> [경고] 판매 탭 버튼을 찾지 못했습니다.");
        }

        // 3. 등급 필터 클릭[cite: 2, 5]
        const gradeNames = ["노멀", "매직", "레어"];
        let clickedCount = 0;
        const shopButtons = Array.from(document.querySelectorAll('button[type="button"]'));

        for (const name of gradeNames) {
            const btn = shopButtons.find(b => b.innerText.trim() === name);
            if (btn && !btn.disabled && !btn.hasAttribute('disabled')) {
                console.log(`  -> [2번] 등급 필터 클릭: '${name}'`);
                forceClickElement(btn);
                clickedCount++;
                await randomSleep(400, 600);
            } else if (btn) {
                console.log(`  -> [2번] 등급 필터 비활성(스킵): '${name}'`);
            }
        }

        if (clickedCount === 0) {
            console.log("  -> [판매 대상 없음] 모든 등급 버튼이 비활성화 상태입니다. 상점을 닫고 캠프파이어로 복귀합니다.");
            await ensureShopPanelClosed(5000);
            await randomSleep(400, 600);

            console.log("  -> [캠프파이어 복귀 이동] S ➔ D 이동");
            await holdKey('s', SHOP_CONFIG.toCampS);
            await randomSleep(300, 500);
            await holdKey('d', SHOP_CONFIG.toCampD);
            await randomSleep(400, 600);

            console.log("  -> [캠프파이어 상호작용] 'f' 키 입력");
            simulateKey('f');
            await randomSleep(1000, 1500);
            return;
        }

        // 4. '선택 판매' 버튼 활성화 대기 및 클릭[cite: 3]
        console.log("  -> [3번 대기] '선택 판매' 버튼 활성화 확인 중...");
        let selectSellBtn = null;
        const selectStart = Date.now();

        while (Date.now() - selectStart < 3500) {
            const btns = Array.from(document.querySelectorAll('button'));
            const found = btns.find(b => b.innerText.includes("선택 판매"));
            if (found && !found.disabled && !found.hasAttribute('disabled')) {
                selectSellBtn = found;
                break;
            }
            await randomSleep(200, 300);
        }

        if (selectSellBtn) {
            console.log("  -> [3번] '선택 판매' 버튼 클릭!");
            forceClickElement(selectSellBtn);
            await randomSleep(1000, 1400);

            // 5. 최종 '판매하기' 버튼 확인 및 클릭[cite: 4]
            console.log("  -> [4번 대기] '판매하기' 확인 버튼 확인 중...");
            let confirmBtn = null;
            const confirmStart = Date.now();

            while (Date.now() - confirmStart < 3500) {
                confirmBtn = document.querySelector('button.is-danger') || 
                             Array.from(document.querySelectorAll('button')).find(b => b.innerText.trim() === "판매하기");
                if (confirmBtn) break;
                await randomSleep(200, 300);
            }

            if (confirmBtn) {
                console.log("  -> [4번] 최종 '판매하기' 버튼 클릭 완료!");
                forceClickElement(confirmBtn);
                await randomSleep(2000, 2500);
            } else {
                console.log("  -> [경고] 최종 '판매하기' 확인 버튼을 찾지 못했습니다.");
            }
        } else {
            console.log("  -> [경고] '선택 판매' 버튼이 활성화되지 않아 판매를 진행하지 못했습니다.");
        }

        // 6. 상점 창 닫기
        console.log("  -> [상점 종료] 상점 창 닫기 검증 시작...");
        await ensureShopPanelClosed(5000);
        await randomSleep(500, 800);

        // 7. 캠프파이어 복귀: S ➔ D ➔ F
        console.log("  -> [캠프파이어 복귀 이동] S ➔ D 이동");
        await holdKey('s', SHOP_CONFIG.toCampS);
        await randomSleep(300, 500);
        await holdKey('d', SHOP_CONFIG.toCampD);
        await randomSleep(400, 600);

        console.log("  -> [캠프파이어 상호작용] 'f' 키 입력");
        simulateKey('f');
        await randomSleep(1000, 1500);
        console.log("🏪 [상점 방문 완료] 캠프파이어 위치로 복귀 완료.");
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
                <div style="margin-top: 8px; font-size: 11px; color: #88f; text-align: right;">v3.66 활성화됨</div>
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
    let isHandlingDeath = false;
    let isReturning = false;
    const defeatedBosses = new Set();
    const bossQueue = [];
    const bossRetryCount = new Map();

    async function moveToSelectedHuntingGround() {
        console.log(`\n--- [99] 선택된 기본 사냥터 이동 시작: ${selectedHuntingGround} ---`);

        const returnSuccess = await returnTownAndClickCampfire(true);
        if (!returnSuccess) {
            console.log("  -> [중단] 마을 귀환 실패로 기본 사냥터 이동을 취소합니다.");
            return;
        }

        const slotCount = await checkInventorySlotCount();
        if (slotCount >= 50) {
            console.log(`🚨 [가방 정리 필요] 사용 슬롯이 ${slotCount}개(>=50)입니다. 상점으로 이동합니다.`);
            await visitShopAndSellItems();
        } else {
            console.log(`✅ [가방 여유] 사용 슬롯(${slotCount}개)이 50개 미만이므로 캠프파이어로 바로 상호작용합니다.`);
            simulateKey('f');
            await randomSleep(600, 1000);
        }

        const menuReady = await waitForWaypointMenu(4000);
        if (!menuReady) {
            console.log("  -> [오류] 마을 웨이포인트 창 로딩 실패. 기본 사냥터 이동을 중단합니다.");
            simulateKey('Escape');
            return;
        }

        let mapSuccess = false;

        switch (selectedHuntingGround) {
            case "wasteland_1":
                try { document.getElementsByClassName("waypoint-destination")[1].click(); } catch(e) {}
                mapSuccess = await waitForMap("망자의 묘지", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("a", 2.0);
                await holdKey("f", 1.0);
                if (await waitForMap("황야", 15)) {
                    await randomSleep(500, 767);
                    await holdKey("a", 0.7);
                }
                break;

            case "wasteland_2":
                try { document.getElementsByClassName("waypoint-destination")[1].click(); } catch(e) {}
                mapSuccess = await waitForMap("망자의 묘지", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("a", 2.0);
                await holdKey("f", 1.0);
                if (await waitForMap("황야", 15)) {
                    await randomSleep(500, 767);
                    await holdKey("a", 3.6);
                }
                break;

            case "canyon_entry":
                try { document.getElementsByClassName("waypoint-destination")[3].click(); } catch(e) {}
                mapSuccess = await waitForMap("뼈바람 협곡", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("a", 1.3);
                await holdKey("w", 0.8);
                await holdKey("f", 1.0);
                if (await waitForMap("협곡 진입로", 15)) {
                    await randomSleep(500, 767);
                    await holdKey("w", 1.5);
                }
                break;

            case "bone_canyon":
                try { document.getElementsByClassName("waypoint-destination")[3].click(); } catch(e) {}
                mapSuccess = await waitForMap("뼈바람 협곡", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 767);
                await holdKey("s", 2.2);
                break;

            case "archive":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                mapSuccess = await waitForMap("잊혀진 고성 중앙부", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("a", 1.5);
                await holdKey("w", 1.5);
                await holdKey("f", 1.0);
                if (await waitForMap("망국의 기록보관소", 15)) {
                    await randomSleep(500, 767);
                    await holdKey("d", 1.7);
                    await holdKey("w", 0.6);
                    await holdKey("f", 1.0);
                }
                break;

            case "castle_center_south":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                mapSuccess = await waitForMap("잊혀진 고성 중앙부", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("s", 2.3);
                break;

            case "castle_center_west":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                mapSuccess = await waitForMap("잊혀진 고성 중앙부", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("a", 2.8);
                await holdKey("s", 0.2);
                break;

            case "castle_center_east":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                mapSuccess = await waitForMap("잊혀진 고성 중앙부", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("d", 2.5);
                break;

            case "castle_center_north":
                try { document.getElementsByClassName("waypoint-destination")[2].click(); } catch(e) {}
                mapSuccess = await waitForMap("잊혀진 고성 중앙부", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("w", 2.5);
                await holdKey("d", 0.3);
                break;

            case "shade_forest_11":
                try { document.getElementsByClassName("waypoint-destination")[3].click(); } catch(e) {}
                mapSuccess = await waitForMap("뼈바람 협곡", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("a", 1.3);
                await holdKey("w", 0.8);
                await holdKey("f", 1.0);
                if (await waitForMap("협곡 진입로", 15)) {
                    await randomSleep(500, 767);
                    await holdKey("d", 4.3);
                    await holdKey("w", 2.2);
                    await holdKey("f", 1.0);
                    if (await waitForMap("그늘숲", 15)) {
                        await randomSleep(500, 767);
                        await holdKey("w", 2.0);
                    }
                }
                break;

            case "shade_forest_3":
                try { document.getElementsByClassName("waypoint-destination")[3].click(); } catch(e) {}
                mapSuccess = await waitForMap("뼈바람 협곡", 15);
                if (!mapSuccess) break;
                await randomSleep(500, 1450);
                await holdKey("a", 1.3);
                await holdKey("w", 0.8);
                await holdKey("f", 1.0);
                if (await waitForMap("협곡 진입로", 15)) {
                    await randomSleep(500, 767);
                    await holdKey("d", 4.3);
                    await holdKey("w", 2.2);
                    await holdKey("f", 1.0);
                    if (await waitForMap("그늘숲", 15)) {
                        await randomSleep(500, 767);
                        await holdKey("w", 1.5);
                        await holdKey("d", 3.0);
                    }
                }
                break;

            default:
                break;
        }

        simulateKey('Escape');
        await randomSleep(250, 450);
        if (mapSuccess) {
            await setAutoHunting(true);
            console.log("--- [99] 기본 사냥터 이동 완료 및 자동 사냥 시작 ---");
        } else {
            console.log("--- [99] 기본 사냥터 맵 이동 실패로 키 입력을 건너뜁니다 ---");
        }
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

        console.log("  -> [스마트 귀환 시작] 전리품 창 확인 및 자동 사냥 종료 후 귀환 시도");
        await ensureLootPanelClosed(3000);
        simulateKey('Escape');
        await randomSleep(250, 400);
        await setAutoHunting(false);
        await randomSleep(350, 500);

        const currentGroundConfig = getCurrentHuntingGroundConfig();
        const escapeKey = currentGroundConfig.escapeKey || 's';
        const escapeSec = currentGroundConfig.escapeSec || 2.0;

        for (let attempt = 1; attempt <= 10; attempt++) {
            if (getCurrentMapName() === "모닥 마을") return true;

            if (document.querySelector('section.loot-panel')) {
                await ensureLootPanelClosed(2500);
                await randomSleep(200, 350);
            }

            const portalBtn = getTownPortalButton();
            if (portalBtn && !isTownPortalActive()) {
                console.log(`  -> [귀환 시도 ${attempt}/10] '마을 귀환' 클릭`);
                forceClickElement(portalBtn);
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

    // 💡 [핵심] 마을 귀환 시마다 부활 복구 루틴(S 6.5s ➔ W 3.6s)을 실행하여 벽에 오차 상쇄 후 모닥불 정렬[cite: 8]
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
        if (document.querySelector('section.loot-panel')) {
            await ensureLootPanelClosed(3000);
        }
        simulateKey('Escape');
        await randomSleep(200, 350);
        
        await ensureMount();

        // 💡 랜덤 스폰 보정: 부활 복구와 동일하게 아래쪽 벽으로 비빈 뒤 캠프파이어로 진입[cite: 8]
        console.log("  -> [마을 정렬 이동] 랜덤 스폰 오차 상쇄: S 6.5초 ➔ W 3.6초");
        await holdKey('s', 6.5);
        await holdKey('w', 3.6);
        await randomSleep(400, 700);

        if (skipCampfire) {
            console.log("  -> [캠프파이어 생략] 상점 방문 또는 점액군주용으로 상호작용 생략");
        } else {
            console.log("  -> [캠프파이어 상호작용] 'f' 키 입력");
            simulateKey('f');
            await randomSleep(600, 1000);
        }

        return true;
    }

    // 💡 보스 처치 메시지가 먼저 떠도 전리품 창 렌더링을 기다렸다가 닫고 종료[cite: 8]
    async function huntBossAndLoot(timeoutSec = 240) {
        await setAutoHunting(true);
        let startTime = Date.now();
        let bossDefeatedTime = null;

        while (Date.now() - startTime < timeoutSec * 1000) {
            await randomSleep(500, 800);

            if (isHandlingDeath || document.querySelector('div.death-overlay')) {
                return "dead";
            }

            // 1. 전리품 창 최우선 확인
            const lootPanel = document.querySelector('section.loot-panel');
            const closeBtn = document.querySelector('button[aria-label="전리품 닫기"]');
            if (lootPanel || closeBtn) {
                console.log("  -> [전리품 발견] 보스 전리품 창 감지! 수거 및 닫기를 진행합니다.");
                await randomSleep(1000, 1400);
                await ensureLootPanelClosed(4000);
                await randomSleep(500, 800);
                return true;
            }

            // 2. 긴급 1번 마장기 출현 확인
            if (bossQueue.length > 0 && bossQueue[0].index === 1 && currentBossIndex !== 1) {
                console.log("  -> [긴급 탈출] 사냥 중 1번 마장기 출현 감지! 즉시 루틴을 중단합니다.");
                await ensureLootPanelClosed(2000);
                return "urgent_switch";
            }

            // 3. 처치 감지 시 최대 3.5초간 전리품 창 대기
            if (defeatedBosses.has(currentBossIndex)) {
                if (!bossDefeatedTime) {
                    bossDefeatedTime = Date.now();
                    console.log("  -> [처치 확인] 보스 처치 감지됨! 전리품 창 팝업을 최대 3.5초간 대기합니다...");
                } else if (Date.now() - bossDefeatedTime > 3500) {
                    console.log("  -> [전리품 없음] 3.5초간 전리품 창이 뜨지 않아 사냥을 종료합니다.");
                    await ensureLootPanelClosed(1500);
                    return "defeated";
                }
            }
        }

        await ensureLootPanelClosed(2000);
        return false;
    }

    async function executeBossQueueWorker() {
        if (isRunning || isReturning || isHandlingDeath) return;
        isRunning = true;

        while (bossQueue.length > 0 || currentBossIndex !== -1) {
            if (isHandlingDeath) break;

            let currentTarget;
            if (currentBossIndex !== -1) {
                currentTarget = { index: currentBossIndex, name: BOSS_LIST[currentBossIndex]?.name || "보스" };
            } else {
                currentTarget = bossQueue.shift();
            }

            const bossIndex = currentTarget.index;
            const bossName = currentTarget.name;

            if (defeatedBosses.has(bossIndex)) {
                console.log(`  -> [대기열 스킵] '${bossName}'(은)는 이미 처치되었습니다.`);
                bossRetryCount.delete(bossIndex);
                currentBossIndex = -1;
                continue;
            }

            currentBossIndex = bossIndex;
            let routeSuccess = true;
            let interruptedByMajangi = false;

            console.log(`\n=== [보스 출동 시작] [${bossIndex}] ${bossName} (남은 대기열: ${bossQueue.length}마리) ===`);

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

                            if (isHandlingDeath || document.querySelector('div.death-overlay')) {
                                routeSuccess = false;
                                break;
                            }

                            if (bossQueue.length > 0 && bossQueue[0].index === 1 && currentBossIndex !== 1) {
                                console.log(`  -> [1번 마장기 긴급 전환] 현재 보스('${bossName}') 중단! 마장기 처치 후 재도전하도록 큐에 보존합니다.`);
                                simulateKey('Escape');
                                routeSuccess = false;
                                interruptedByMajangi = true;
                                break;
                            }

                            if (step.type !== "hunt_boss" && step.type !== "return_hunting_ground" && defeatedBosses.has(currentBossIndex)) {
                                console.log(`  -> [이동 중 취소] 현재 목표 '${bossName}' 처치 확인! 이동을 중단합니다.`);
                                simulateKey('Escape');
                                routeSuccess = false;
                                break;
                            }

                            if (step.type === "js") {
                                if (i === 0 && bossIndex !== 4) {
                                    const opened = await waitForWaypointMenu(4000);
                                    if (!opened) {
                                        simulateKey('f');
                                        await waitForWaypointMenu(3000);
                                    }
                                }

                                try {
                                    let startAttempt = Date.now();
                                    while (Date.now() - startAttempt < 3000) {
                                        try { 
                                            step.script(); 
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
                                if (bossQueue.length > 0 && bossQueue[0].index === 1 && currentBossIndex !== 1) {
                                    break;
                                }
                                const lootResult = await huntBossAndLoot(240);
                                if (lootResult === "urgent_switch") {
                                    routeSuccess = false;
                                    interruptedByMajangi = true;
                                    break;
                                } else if (lootResult === "dead" || lootResult === "defeated") {
                                    routeSuccess = false;
                                    break;
                                }
                            } else if (step.type === "return_hunting_ground") {
                                break;
                            }
                        }
                    }
                }
            } catch (err) {
                routeSuccess = false;
            }

            if (isHandlingDeath) break;

            if (interruptedByMajangi && !defeatedBosses.has(bossIndex)) {
                bossQueue.splice(1, 0, currentTarget);
                console.log(`  -> [대기열 복원] '${bossName}'을(를) 마장기 다음 순번으로 대기열에 유지합니다.`);
            } 
            else if (!routeSuccess && !defeatedBosses.has(bossIndex)) {
                const retries = bossRetryCount.get(bossIndex) || 0;
                const MAX_RETRIES = 2;

                if (retries < MAX_RETRIES) {
                    bossRetryCount.set(bossIndex, retries + 1);
                    console.log(`⚠️ [이동 실패 재시도] '${bossName}' 아직 생존 확인! (${retries + 1}/${MAX_RETRIES}회 재시도 등록)`);
                    bossQueue.unshift(currentTarget);
                } else {
                    console.log(`❌ [재시도 초과] '${bossName}' 이동 재시도 한도를 초과하여 스킵합니다.`);
                    bossRetryCount.delete(bossIndex);
                }
            } 
            else {
                bossRetryCount.delete(bossIndex);
            }

            currentBossIndex = -1;
            await randomSleep(600, 1000);
        }

        isRunning = false;

        if (!isHandlingDeath && bossQueue.length === 0) {
            console.log("  -> [보스 루틴 완전 종료] 남은 보스가 없으므로 기본 사냥터로 복귀합니다.");
            await returnToDefaultHuntingGround();
        }
    }

    function enqueueBossTask(bossIndex, bossName) {
        if (!isBossHuntingEnabled && bossIndex !== 1) {
            console.log(`  -> [보스 사냥 OFF] '${bossName}' 출동을 건너뜁니다.`);
            return;
        }

        if (defeatedBosses.has(bossIndex)) {
            console.log(`  -> [등록 취소] '${bossName}'(은)는 이미 처치된 보스입니다.`);
            return;
        }

        if (bossIndex === 1) {
            const alreadyInQueue = bossQueue.findIndex(b => b.index === 1);
            if (alreadyInQueue !== -1) bossQueue.splice(alreadyInQueue, 1);

            console.log("⚡ [긴급] 1번 망국의 마장기를 대기열 최우선(맨 앞)으로 등록합니다!");
            bossQueue.unshift({ index: bossIndex, name: bossName });

            if (isRunning && currentBossIndex !== 1) {
                simulateKey('Escape');
            } else if (!isRunning && !isHandlingDeath) {
                executeBossQueueWorker();
            }
            return;
        }

        if (!bossQueue.some(b => b.index === bossIndex) && currentBossIndex !== bossIndex) {
            bossQueue.push({ index: bossIndex, name: bossName });
            console.log(`[보스 대기열 등록] [${bossIndex}] ${bossName} (대기 순번: ${bossQueue.length}번째)`);
        }

        if (!isRunning && !isHandlingDeath) {
            executeBossQueueWorker();
        }
    }

    async function checkAndHandleDeath() {
        if (isHandlingDeath) return;

        const deathOverlay = document.querySelector('div.death-overlay');
        if (!deathOverlay) return;

        isHandlingDeath = true;
        const deadBossIndex = currentBossIndex;
        const deadBossName = deadBossIndex !== -1 ? (BOSS_LIST[deadBossIndex]?.name || "보스") : null;

        console.log(`💀 [캐릭터 사망 감지] 사망 화면 감지됨. (진행 중이던 보스: ${deadBossName || '없음'})`);

        simulateKey('Escape');
        isRunning = false;

        if (deadBossIndex !== -1 && !defeatedBosses.has(deadBossIndex)) {
            console.log(`  -> [처치 대기] '${deadBossName}' 처치 메시지가 뜰 때까지 누워서 대기합니다 (최대 180초)...`);
            const waitStart = Date.now();
            while (Date.now() - waitStart < 180000) {
                await randomSleep(1000, 1500);
                if (defeatedBosses.has(deadBossIndex)) {
                    console.log(`  -> [처치 완료 확인] '${deadBossName}' 처치 확인! 부활 절차를 시작합니다.`);
                    break;
                }
            }
        }

        console.log("  -> [부활 시도] '마을로 돌아가기' 버튼을 찾습니다.");
        let revivalClicked = false;
        const currentOverlay = document.querySelector('div.death-overlay');
        if (currentOverlay) {
            const buttons = currentOverlay.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.innerText.includes("마을로 돌아가기")) {
                    await randomSleep(800, 1300);
                    forceClickElement(btn);
                    revivalClicked = true;
                    console.log("  -> [부활 클릭 완료] 마을로 복귀 중...");
                    break;
                }
            }
        }

        if (!revivalClicked) {
            console.log("  -> [버튼 미발견] 부활 버튼 클릭 실패. 상태를 리셋합니다.");
            isHandlingDeath = false;
            currentBossIndex = -1;
            return;
        }

        isReturning = true;
        const villageLoaded = await waitForMap("모닥 마을", 15);
        if (!villageLoaded) {
            console.log("  -> [경고] 모닥 마을 로딩 확인 실패. 2초 대기 후 정비를 강행합니다.");
            await randomSleep(2000, 2500);
        }

        await randomSleep(800, 1200);
        await ensureLootPanelClosed(3000);
        simulateKey('Escape');
        await randomSleep(300, 500);

        await ensureMount();

        console.log("  -> [부활 정비 이동] 캠프파이어 위치로 이동: S 6.5초 ➔ W 3.6초");
        await holdKey('s', 6.5);
        await holdKey('w', 3.6);
        await randomSleep(400, 700);

        console.log("  -> [캠프파이어 확인] 'f' 키 상호작용 후 닫기");
        simulateKey('f');
        await randomSleep(1500, 2000);
        simulateKey('Escape');
        await randomSleep(400, 600);

        isReturning = false;
        isHandlingDeath = false;
        currentBossIndex = -1;

        if (bossQueue.length > 0) {
            console.log(`  -> [연계 출동] 사망 복구 완료! 남은 대기열(${bossQueue.length}마리) 보스 출동을 시작합니다.`);
            executeBossQueueWorker();
        } else {
            console.log("  -> [복구 완료] 남은 보스 대기열이 없으므로 기본 사냥터로 복귀합니다.");
            await returnToDefaultHuntingGround();
        }
    }

    // 💡 기본 사냥 중 백그라운드 전리품 자동 수거 루틴
    let isAutoHandlingLoot = false;
    async function checkAndHandleBackgroundLoot() {
        if (isAutoHandlingLoot || isRunning || isReturning || isHandlingDeath) return;

        const lootBtn = document.querySelector('button[aria-label="전리품 닫기"]');
        if (!lootBtn) return;

        isAutoHandlingLoot = true;
        console.log("🎁 [필드 전리품 감지] 기본 사냥터에서 전리품 창이 감지되었습니다. 1.2초 후 수거합니다.");

        setTimeout(async () => {
            try {
                await ensureLootPanelClosed(4000);
                await randomSleep(400, 700);
                await setAutoHunting(true);
                console.log("  -> [사냥 지속] 전리품 수거 완료 후 자동 사냥 상태를 복구했습니다.");
            } finally {
                isAutoHandlingLoot = false;
            }
        }, 1200);
    }

    const globalObserver = new MutationObserver((mutations) => {
        checkAndHandleDeath();
        checkAndHandleBackgroundLoot();

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
            bossRetryCount.delete(matchedBoss.index);

            if (matchedBoss.index === 1) {
                enqueueBossTask(matchedBoss.index, matchedBoss.name);
                return;
            }

            if (!isBossHuntingEnabled) {
                console.log(`  -> [보스 사냥 OFF] '${matchedBoss.name}' 출현을 무시하며, 현재 사냥을 계속 유지합니다.`);
                return;
            }

            setTimeout(() => {
                enqueueBossTask(matchedBoss.index, matchedBoss.name);
            }, Math.floor(Math.random() * 500) + 300);
        }

        // 2. 보스 처치 감지
        if (msgText.includes("처치되었습니다")) {
            console.log(`[보스 처치 감지] '${matchedBoss.name}'(이)가 처치되었습니다.`);
            defeatedBosses.add(matchedBoss.index);
            bossRetryCount.delete(matchedBoss.index);

            const queueIdx = bossQueue.findIndex(b => b.index === matchedBoss.index);
            if (queueIdx !== -1) {
                console.log(`  -> [대기열 제거] 대기열에 있던 '${matchedBoss.name}'(이)가 처치되어 대기열에서 삭제합니다.`);
                bossQueue.splice(queueIdx, 1);
            }
        }
    }

    window.addEventListener('load', () => { createSettingsUI(); });
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        createSettingsUI();
    }

    window.testBoss = enqueueBossTask;
    window.testHuntingGround = returnToDefaultHuntingGround;
    window.testShop = visitShopAndSellItems;
    window.testAutoHunt = setAutoHunting;

    console.log("모닥 온라인 단독 오토봇 헬퍼 v3.66 가동 완료!");

})();
