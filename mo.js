// ==UserScript==
// @name         모닥 온라인 보스 오토봇 v3.11
// @namespace    http://tampermonkey.net/
// @version      3.11
// @match        https://modakmmo.com/*
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/corestandard/mo/refs/heads/main/mo.js
// @updateURL    https://raw.githubusercontent.com/corestandard/mo/refs/heads/main/mo.js
// ==/UserScript==


(function() {
    'use strict';

    // 브라우저 환경에서 사용할 키보드 시뮬레이터 (keydown -> keypress -> keyup)
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

    // 특정 시간 동안 키를 꾹 누르는 시뮬레이션
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

    // 두 키 동시 누르기 (예: 대각선 이동)
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

    // 일정 시간 대기 헬퍼
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // 현재 미니맵 맵 이름 가져오기 함수
    function getCurrentMapName() {
        const mapNameEl = document.getElementsByClassName("panel-list-name")[0];
        return mapNameEl ? mapNameEl.innerText.trim() : "";
    }

    // 특정 맵 이름이 될 때까지 대기하는 함수
    async function waitForMap(expectedName, timeoutSec = 15) {
        console.log(`  -> [맵 검증 대기] '${expectedName}' 진입 대기 중 (최대 ${timeoutSec}초)...`);
        let startTime = Date.now();
        while (Date.now() - startTime < timeoutSec * 1000) {
            let currentMap = getCurrentMapName();
            if (currentMap.includes(expectedName)) {
                console.log(`  -> [맵 진입 확인] 현재 위치: '${currentMap}'`);
                await sleep(800);
                return true;
            }
            await sleep(300);
        }
        console.log(`  -> [맵 진입 시간 초과] '${expectedName}'로 이동 실패`);
        return false;
    }

    // 보스 목록 정의
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

    // 보스 이동 경로 정의
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
            { type: "move", key: "s", duration: 1.0 },
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

    // 기본 사냥터 복귀 공통 함수
    async function returnToDefaultHuntingGround() {
        if (isReturning) return;
        isReturning = true;

        console.log("\n--- [99] 기본 사냥터 복귀 시작 ---");
        await returnTownAndClickCampfire(false);
        await sleep(1000);

        try {
            await sleep(800);
            let success = false;
            let startAttempt = Date.now();
            while (Date.now() - startAttempt < 3000) {
                try {
                    document.getElementsByClassName("waypoint-destination")[4].click();
                    success = true;
                    break;
                } catch (err) {
                    await sleep(200);
                }
            }
        } catch(e) {}

        await waitForMap("붉은숲 피난처", 15);
        await holdKey("s", 1.5);
        await holdKey("d", 1.0);
        await holdKey("s", 0.5);
        simulateKey('Escape');
        await sleep(300);
        console.log("  -> [사냥 시작] 'z' 키 입력 (기본 사냥터 자동전투 ON)");
        simulateKey('z');
        console.log("--- [99] 기본 사냥터 복귀 완료 ---");
        isReturning = false;
    }

    // 마을 귀환 및 부활 후속 이동 (구석 이동 후 캠프파이어 상호작용)
    async function returnTownAndClickCampfire(skipCampfire = false) {
        let currentMap = getCurrentMapName();
        if (currentMap === "모닥 마을") {
            console.log(`  -> [마을 상태 확인] 현재 위치('${currentMap}')가 이미 '모닥 마을'이므로 귀환(B)을 생략합니다.`);
        } else {
            console.log("  -> [귀환 전 정리] 혹시 남아있을지 모르는 UI 창 닫기 (ESC)");
            simulateKey('Escape');
            await sleep(300);
            simulateKey('z');
            await sleep(300);

            console.log("  -> [귀환 시도] B키 입력 시작");
            let success = false;
            for (let i = 1; i <= 10; i++) {
                if (getCurrentMapName() === "모닥 마을") {
                    success = true;
                    break;
                }
                console.log(`  -> [귀환 시도] B키 입력 (${i}/10)`);
                simulateKey('b');
                if (await waitForMap("모닥 마을", 5.0)) {
                    success = true;
                    break;
                } else {
                    console.log("  -> [귀환 취소됨] W키 1.5초 이동 후 재시도합니다.");
                    await holdKey('w', 1.5);
                }
            }
        }

        await sleep(1000);
        simulateKey('Escape');
        await sleep(300);
        
        console.log("  -> [부활 후속조치] 맵 구석으로 이동 및 포탈/캠프파이어 탑승 시작");
        await holdKey('r', 1.0);
        await holdKey('s', 6.5);
        await holdKey('d', 2.5);
        await holdKey('w', 0.2);

        if (skipCampfire) {
            console.log("  -> [고대 점액군주] 캠프파이어 상호작용('f')을 생략합니다.");
        } else {
            console.log("  -> [캠프파이어 상호작용] 'f' 키 입력");
            simulateKey('f');
            await sleep(1000);
        }

        return true;
    }

    // 전리품 창 체크 루틴
    async function huntBossAndLoot(timeoutSec = 240) {
        console.log("  -> [전투 시작] 'z' 키 입력 (자동전투 ON)");
        simulateKey('z');

        let startTime = Date.now();
        while (Date.now() - startTime < timeoutSec * 1000) {
            await sleep(1000);

            // 전리품 창 닫기 감지
            const closeBtn = document.querySelector('section.loot-panel button[aria-label="전리품 닫기"]');
            if (closeBtn) {
                console.log("  -> [전리품 확인 완료] '전리품 닫기' 버튼을 직접 클릭합니다.");
                closeBtn.click();
                await sleep(1000);
                return true;
            }

            if (Date.now() - startTime > timeoutSec * 1000) {
                console.log("  -> [시간 초과] 전리품 창이 뜨지 않아 안전을 위해 탈출합니다.");
                simulateKey('Escape');
                await sleep(500);
                return false;
            }
        }

        simulateKey('Escape');
        return false;
    }

    // 보스 수행 메인 함수
    async function executeBossTask(bossIndex, bossName) {
        // 👉 복귀/부활 후속조치 중(isReturning)이거나 다른 보스 진행 중이면 예약으로 등록
        if (isRunning || isReturning) {
            console.log(`[보스 예약됨] 현재 복귀/부활 후속 조치 중이거나 다른 보스 진행 중이므로 [${bossIndex}] ${bossName}을(를) 예약합니다.`);
            pendingBossData = { index: bossIndex, name: bossName };
            return;
        }

        isRunning = true;
        currentBossIndex = bossIndex;

        try {
            console.log(`\n==========================================`);
            console.log(`[보스 출동] [${bossIndex}] ${bossName}`);
            console.log(`==========================================`);

            if (bossIndex === 4) {
                console.log("  -> [고대 점액군주 감지] 마을 귀환 후 캠프파이어 상호작용을 생략합니다.");
                await returnTownAndClickCampfire(true);
            } else {
                await returnTownAndClickCampfire(false);
            }

            const route = BOSS_ROUTES[bossIndex];
            if (route) {
                for (const step of route) {
                    if (isHandlingDeath || isReturning) break;

                    if (step.type === "js") {
                        console.log("  -> [DOM 제어 실행]");
                        try {
                            await sleep(800);
                            let success = false;
                            let startAttempt = Date.now();
                            while (Date.now() - startAttempt < 3000) {
                                try {
                                    step.script();
                                    success = true;
                                    break;
                                } catch (err) {
                                    await sleep(200);
                                }
                            }
                            if (!success) {
                                console.log("  -> [DOM 제어 실패] 요소를 찾지 못했습니다.");
                            }
                        } catch(e) {
                            console.log("  -> [DOM 제어 오류]", e);
                        }
                        await sleep(step.wait * 1000);
                        simulateKey('Escape');
                        await sleep(300);
                    } else if (step.type === "wait_map") {
                        await waitForMap(step.name, step.timeout);
                    } else if (step.type === "move") {
                        if (step.key.length > 1) {
                            await holdTwoKeys(step.key, step.duration);
                        } else {
                            await holdKey(step.key, step.duration);
                        }
                    } else if (step.type === "esc") {
                        simulateKey('Escape');
                        await sleep((step.wait || 0.3) * 1000);
                    } else if (step.type === "hunt_boss") {
                        await huntBossAndLoot(240);
                    } else if (step.type === "return_hunting_ground") {
                        await returnToDefaultHuntingGround();
                    }
                }
            }

        } catch (err) {
            console.log("[오류 발생]", err);
        } finally {
            if (!isHandlingDeath && !isReturning) {
                isRunning = false;
                currentBossIndex = -1;
                console.log("--- 보스 루틴 세션 종료 ---");

                if (pendingBossData) {
                    let next = pendingBossData;
                    pendingBossData = null;
                    executeBossTask(next.index, next.name);
                }
            }
        }
    }

    // 🔴 [상시 전역 감시자] 사망 패널 감지 로직
    function checkAndHandleDeath() {
        if (isHandlingDeath || isReturning) return;

        const deathOverlay = document.querySelector('div.death-overlay');
        if (deathOverlay) {
            if (isRunning) {
                return; // 보스 잡는 중이면 대기
            }

            const buttons = deathOverlay.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.innerText.includes("마을로 돌아가기")) {
                    isHandlingDeath = true;
                    console.log("  -> [일반 사냥 사망 감지] '마을로 돌아가기' 버튼 발견! 부활 후속 조치를 시작합니다.");
                    
                    isRunning = false;
                    currentBossIndex = -1;
                    pendingBossData = null;

                    btn.click();
                    
                    // 👉 부활 후속조치(마을 구석 이동 -> 포탈 탑승으로 초원 이동)를 완벽히 수행
                    setTimeout(async () => {
                        isReturning = true;
                        
                        // 1. 마을 귀환 정리 및 탈것 탑승 후 구석 이동 (`r`, `s`, `d`, `w`, `f`)
                        await sleep(500);
                        simulateKey('Escape');
                        await sleep(300);
                        console.log("  -> [부활 후속조치] 맵 구석으로 이동 및 포탈 탑승 시작");
                        await holdKey('r', 1.0);
                        await holdKey('s', 6.5);
                        await holdKey('d', 2.2);
                        await holdKey('w', 0.2);
                        console.log("  -> [캠프파이어/포탈 상호작용] 'f' 키 입력");
                        simulateKey('f');
                        await sleep(1000);

                        isReturning = false;
                        isHandlingDeath = false;
                        console.log("  -> [부활 후속조치 완료] 초원 진입 완료. 예약된 보스가 있다면 처리합니다.");

                        // 👉 부활 후속조치가 끝난 시점에 예약된 보스가 있다면 즉시 실행!
                        if (pendingBossData) {
                            let next = pendingBossData;
                            pendingBossData = null;
                            executeBossTask(next.index, next.name);
                        } else {
                            // 예약된 보스가 없다면 기본 사냥터 복귀 루틴 실행
                            await returnToDefaultHuntingGround();
                        }
                    }, 1500);
                    break;
                }
            }
        }
    }

    // 실시간 DOM 감시자 (채팅 및 사망 패널 통합 감시)
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

    // 채팅창 이벤트 처리 함수
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

        if (msgText.includes("출현")) {
            console.log(`[보스 출현 감지] [${matchedBoss.index}] ${matchedBoss.name}`);
            executeBossTask(matchedBoss.index, matchedBoss.name);
        }

        if (msgText.includes("처치되었습니다")) {
            console.log(`[보스 처치 감지] '${matchedBoss.name}'(이)가 이미 처치되었습니다.`);
            
            const deathOverlay = document.querySelector('div.death-overlay');
            if (deathOverlay && isRunning && currentBossIndex === matchedBoss.index) {
                const btn = Array.from(deathOverlay.querySelectorAll('button')).find(b => b.innerText.includes("마을로 돌아가기"));
                if (btn) {
                    isHandlingDeath = true;
                    console.log(`  -> [보스 사망 후 처치 확인] 보스가 잡혔으므로 사망 창을 닫고 복귀합니다.`);
                    simulateKey('Escape');
                    isRunning = false;
                    currentBossIndex = -1;
                    pendingBossData = null;
                    btn.click();
                    setTimeout(async () => {
                        await returnToDefaultHuntingGround();
                        isHandlingDeath = false;
                    }, 1500);
                    return;
                }
            }

            if (isRunning && currentBossIndex === matchedBoss.index) {
                console.log(`  -> [조기 종료] 추적 중이던 보스가 이미 잡혔으므로 작업을 중단하고 사냥터로 복귀합니다.`);
                simulateKey('Escape');
                isRunning = false;
                currentBossIndex = -1;
                pendingBossData = null;
                returnToDefaultHuntingGround();
            }
        }
    }

    // 콘솔창 테스트용 전역 등록
    window.testBoss = executeBossTask;

    console.log("모닥 온라인 단독 오토봇 헬퍼 v3.11 가동 완료!");

})();
