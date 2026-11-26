for (const name of shopSellGrades) {
            if (isAborted(token) || hasHighPriorityBossInQueue()) {
                await closeShopPanel();
                return;
            }

            if (name === "레어" && isExcludeRareGlovesBoots) {
                const rareSlots = Array.from(
                    document.querySelectorAll('.shop-item-grid button.inventory-slot.has-item.rarity-rare')
                );
                let excludedCount = 0;
                for (const slot of rareSlots) {
                    if (isAborted(token) || hasHighPriorityBossInQueue()) {
                        await closeShopPanel();
                        return;
                    }
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
                // 1) 신규 체크박스 UI (.shop-rarity-select label.shop-selection-toggle) 대응
                const rarityLabels = Array.from(
                    document.querySelectorAll('.shop-rarity-select label.shop-selection-toggle, section.shop-panel label.shop-selection-toggle')
                );
                const matchedLabel = rarityLabels.find(lbl => {
                    const span = lbl.querySelector('span');
                    return (span ? span.innerText.trim() : lbl.innerText.trim()) === name;
                });

                if (matchedLabel) {
                    const chk = matchedLabel.querySelector('input[type="checkbox"]');
                    if (chk && !chk.disabled) {
                        if (!chk.checked) {
                            forceClickElement(chk);
                            await sleep(100);
                            if (!chk.checked) forceClickElement(matchedLabel);
                        }
                        clickedCount++;
                        console.log(`  -> [등급 체크] '${name}' 체크박스 선택 완료`);
                        await randomSleep(250, 400);
                    }
                } else {
                    // 2) 구버전 버튼 폴백
                    const currentShopButtons = Array.from(document.querySelectorAll('section.shop-panel button[type="button"]'));
                    const btn = currentShopButtons.find(b => b.innerText.trim() === name);
                    if (btn && !btn.disabled && !btn.hasAttribute('disabled')) {
                        forceClickElement(btn);
                        clickedCount++;
                        await randomSleep(300, 500);
                    }
                }
            }
        }
