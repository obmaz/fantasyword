/**
 * 인벤토리 시스템
 * 아이템 장착, 해제, UI 렌더링 관리
 */

const inventory = {
    detailTrigger: null,
    slots: {
        gloves: {
            label: '장갑',
            accepts: '황금장갑 · 정답 골드 x1.5 · 30회',
            placeholder: 'goldGlove',
        },
        head: { label: '머리', accepts: '투구 · 무료 힌트 1회', placeholder: 'helmet' },
        'hand-1': {
            label: '오른손',
            accepts: '주무기 · 골드 보너스 · 3연속 정답 +10 G',
            placeholder: 'basic',
        },
        'hand-2': {
            label: '왼손',
            accepts: '보조 이펙트 · 방패는 재도전 1회',
            placeholder: 'shield_item',
        },
        'foot-1': {
            label: '왼발',
            accepts: '부츠 · 스토리 경로 선택 · 양발 함께 장착',
            placeholder: 'boots',
        },
        'foot-2': {
            label: '오른발',
            accepts: '부츠 · 스토리 경로 선택 · 양발 함께 장착',
            placeholder: 'boots',
        },
    },
    /** 구매/장착/해제/표시에서 같은 보관함 용량 규칙을 사용한다. */
    getStoredCount: (state = db) =>
        state.inventory.length +
        db.owned.filter(
            (id) =>
                id !== 'basic' &&
                !Object.values(state.equipped).includes(id) &&
                id !== state.equippedWeapon
        ).length,
    /**
     * 인벤토리 모달을 엽니다
     */
    open: () => {
        // title-screen은 숨기지 않고 모달만 표시
        openScreenOverlay('inventory-modal', true);

        inventory.hideDetails(false); // 열 때 이전 상세 화면과 포커스를 정리한다.
        inventory.render();

        // 접근성 / 작은 뷰포트 대응: 닫기 버튼이 도달 가능하도록 보장
        const closeBtn = document.querySelector('#inventory-modal .modal-header .modal-close-x');
        if (closeBtn) {
            try {
                closeBtn.focus({ preventScroll: true });
            } catch (err) {
                try {
                    closeBtn.focus();
                } catch (__) {
                    /* 무시 */
                }
            }
            try {
                closeBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            } catch (__) {
                /* 무시 */
            }
        }
    },

    /**
     * 인벤토리 모달을 닫습니다
     */
    close: () => {
        inventory.hideDetails(false);
        navigation.track('title-screen');
        closeScreenOverlay('inventory-modal', true);
        // title-screen은 이미 표시되어 있으므로 다시 표시할 필요 없음
    },

    /**
     * 인벤토리 UI를 렌더링합니다
     */
    render: () => {
        const invContainer = document.querySelector('.inv-items');
        invContainer.innerHTML = '';

        // 인벤토리 용량 표시
        document.getElementById('inv-cap').innerText = inventory.getStoredCount();
        document.getElementById('inv-max-cap').innerText = db.inventoryCapacity;
        const weapon = weapons.find((w) => w.id === db.equippedWeapon);
        const gloveMultiplier =
            db.equipped.gloves === 'goldGlove' && db.durability.goldGlove > 0 ? 1.5 : 1;
        document.getElementById('inv-gold-bonus').innerText =
            `×${Number(((weapon?.multiplier || 1) * gloveMultiplier).toFixed(2))}`;

        // 표시하는 슬롯은 실제 장착 위치와 같다. 비어 있는 오른손은 기본 검을 사용한다.
        for (const [slot, rule] of Object.entries(inventory.slots)) {
            const equipSlot = document.getElementById(`inv-${slot}`);
            if (!equipSlot) continue;
            const itemId = db.equipped[slot] || (slot === 'hand-1' ? 'basic' : null);
            const item = items.find((i) => i.id === itemId) || weapons.find((w) => w.id === itemId);
            const isDefault = item?.id === 'basic';
            equipSlot.dataset.empty = String(!item);
            equipSlot.disabled = !item || isDefault;
            equipSlot.title = `${rule.label} · ${rule.accepts}`;
            if (item) {
                equipSlot.innerHTML = itemIconMarkup(item);
                equipSlot.setAttribute(
                    'aria-label',
                    `${rule.label}: ${itemDisplayName(item)}, ${isDefault ? '기본 장비' : '장착 해제'}`
                );
            } else {
                equipSlot.innerHTML = itemIconMarkup({ id: rule.placeholder });
                equipSlot.setAttribute(
                    'aria-label',
                    `${rule.label} 슬롯: 비어 있음 · ${rule.accepts}`
                );
            }
        }

        // 히어로 장비 표시 초기화
        document.getElementById('hero-head').innerHTML = '';
        document.getElementById('hero-hand-1').innerHTML = '';
        document.getElementById('hero-hand-2').innerHTML = '';
        document.getElementById('hero-feet').innerHTML = '';

        // 히어로 스프라이트에 장착된 아이템 렌더링
        const headItem = items.find((i) => i.id === db.equipped['head']);
        if (headItem) {
            const el = document.getElementById('hero-head');
            if (el) el.innerHTML = itemIconMarkup(headItem);
        }
        const hand1Item = items.find((i) => i.id === db.equipped['hand-1']);
        if (hand1Item) {
            const el = document.getElementById('hero-hand-1');
            if (el) el.innerHTML = itemIconMarkup(hand1Item);
        }
        const hand2Item = items.find((i) => i.id === db.equipped['hand-2']);
        if (hand2Item) {
            const el = document.getElementById('hero-hand-2');
            if (el) el.innerHTML = itemIconMarkup(hand2Item);
        }
        const foot1Item = items.find((i) => i.id === db.equipped['foot-1']);
        if (foot1Item) {
            const el = document.getElementById('hero-feet');
            if (el) el.innerHTML = itemIconMarkup(foot1Item);
        }

        // 보관함의 아이템 렌더링
        db.inventory.forEach((itemId) => {
            const item = items.find((i) => i.id === itemId);
            if (item) {
                const itemEl = document.createElement('button');
                itemEl.type = 'button';
                itemEl.setAttribute('aria-label', item.name);
                itemEl.className = 'inv-item';
                itemEl.innerHTML = itemIconMarkup(item);
                itemEl.onclick = () => inventory.showDetails(itemId, 'item');
                invContainer.appendChild(itemEl);
            }
        });

        // 보관함의 보유 무기 렌더링
        db.owned.forEach((weaponId) => {
            const weapon = weapons.find((w) => w.id === weaponId);
            if (
                weapon &&
                weapon.id !== 'basic' &&
                weapon.id !== db.equippedWeapon &&
                !Object.values(db.equipped).includes(weaponId)
            ) {
                const itemEl = document.createElement('button');
                itemEl.type = 'button';
                itemEl.setAttribute('aria-label', weapon.name);
                itemEl.className = 'inv-item';
                itemEl.innerHTML = itemIconMarkup(weapon);
                itemEl.onclick = () => inventory.showDetails(weaponId, 'weapon');
                invContainer.appendChild(itemEl);
            }
        });

        if (!invContainer.children.length) {
            const empty = document.createElement('p');
            empty.className = 'inventory-empty';
            empty.innerText = '보관 중인 장비가 없습니다.';
            invContainer.appendChild(empty);
        }

        // 보유 유물 렌더링
        const relicsContainer = document.querySelector('.inv-relics');
        relicsContainer.innerHTML = '';
        db.owned.forEach((itemId) => {
            const relic = relics.find(
                (r) =>
                    r.id === itemId &&
                    (r.type === 'passive' || r.type === 'consumable' || r.type === 'backpack')
            );
            if (relic) {
                const relicEl = document.createElement('div');
                relicEl.className = 'relic-item';

                let relicInfo = `${itemIconMarkup(relic)}<span><b>${itemDisplayName(relic)}</b>: ${relic.desc}`;
                if (relic.type === 'consumable' && db.durability[relic.id]) {
                    relicInfo += ` (${db.durability[relic.id]}회 남음)`;
                }

                relicEl.innerHTML = relicInfo + '</span>';
                relicsContainer.appendChild(relicEl);
            }
        });

        // 접근성: Enter / Space로 포커스된 인벤토리 슬롯 활성화 허용
        document.querySelectorAll('.inv-slot[tabindex]').forEach((el) => {
            el.onkeydown = (ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    el.click();
                }
            };
        });
        ui.updateVisuals();
    },

    /**
     * 아이템 상세 정보를 표시합니다
     * @param {string} id - 아이템 ID
     * @param {string} type - 아이템 타입 ('item' 또는 'weapon')
     */
    showDetails: (id, type) => {
        const itemData =
            type === 'item' ? items.find((i) => i.id === id) : weapons.find((w) => w.id === id);
        if (!itemData) return;
        const trigger = document.activeElement;
        inventory.detailTrigger =
            trigger &&
            document.getElementById('inventory-modal').contains(trigger) &&
            !document.getElementById('inv-item-detail').contains(trigger)
                ? trigger
                : null;

        document.getElementById('detail-icon').innerHTML = itemIconMarkup(itemData);
        document.getElementById('detail-name').innerText = itemDisplayName(itemData);
        const allowedSlots = type === 'weapon' ? weaponEquipSlots(itemData) : [itemData.slot];
        const slotNames = allowedSlots.map((slot) => inventory.slots[slot]?.label).filter(Boolean);
        const placement = itemData.id === 'boots' ? '양발 함께' : slotNames.join(' 또는 ');
        let description = `${itemData.desc}\n장착 위치: ${placement}`;
        if (itemData.durability) description += `\n남은 사용: ${db.durability[id] || 0}회`;
        if (type === 'weapon' && allowedSlots.includes('hand-1'))
            description += '\n오른손: 3연속 정답마다 추가 공격 +10 G';
        if (type === 'weapon' && itemData.multiplier > 1)
            description += '\n골드 보너스는 오른손에 장착했을 때 적용됩니다.';
        document.getElementById('detail-desc').innerText = description;

        const actionsContainer = document.getElementById('detail-actions');
        actionsContainer.innerHTML = '';

        // 무기의 경우 정의된 슬롯에 장착 허용
        if (type === 'weapon') {
            for (const slot of allowedSlots) {
                const equipBtn = document.createElement('button');
                equipBtn.className = 'btn-main';
                equipBtn.innerText = `${inventory.slots[slot].label} 장착`;
                equipBtn.onclick = () => {
                    inventory.equip(id, 'weapon', slot);
                    inventory.hideDetails();
                };
                actionsContainer.appendChild(equipBtn);
            }

            // 현재 장착 중이면 해제 허용
            if (db.equippedWeapon === id || Object.values(db.equipped).includes(id)) {
                const unequipBtn = document.createElement('button');
                unequipBtn.className = 'btn-main btn-blue';
                unequipBtn.innerText = '해제';
                unequipBtn.onclick = () => {
                    const slot = Object.keys(db.equipped).find((s) => db.equipped[s] === id);
                    inventory.unequipWeapon(slot);
                    inventory.hideDetails();
                };
                actionsContainer.appendChild(unequipBtn);
            }
        } else {
            // 아이템 (소모품 / 장비)
            const equipBtn = document.createElement('button');
            equipBtn.className = 'btn-main';
            equipBtn.innerText = `${itemData.id === 'boots' ? '양발' : slotNames[0]} 장착`;
            equipBtn.onclick = () => {
                inventory.equip(id, type);
                inventory.hideDetails();
            };
            actionsContainer.appendChild(equipBtn);

            // 소모품이면 사용 버튼 추가
            const isConsumable = relics.find((r) => r.id === id && r.type === 'consumable');
            if (isConsumable) {
                const useBtn = document.createElement('button');
                useBtn.className = 'btn-main btn-blue';
                useBtn.innerText = '사용하기';
                useBtn.onclick = () => {
                    db.useItem(id);
                    inventory.hideDetails();
                };
                actionsContainer.appendChild(useBtn);
            }
        }

        document.getElementById('inv-item-detail').style.display = 'block';
        document.getElementById('inventory-modal').dataset.detailOpen = 'true';
        document.getElementById('detail-close').focus({ preventScroll: true });
    },

    /**
     * 아이템 상세 정보를 숨깁니다
     */
    hideDetails: (restoreFocus = true) => {
        const wasOpen = document.getElementById('inventory-modal').dataset.detailOpen === 'true';
        document.getElementById('inv-item-detail').style.display = 'none';
        document.getElementById('inventory-modal').dataset.detailOpen = 'false';
        const trigger = inventory.detailTrigger;
        inventory.detailTrigger = null;
        if (restoreFocus && wasOpen) {
            const target =
                trigger?.isConnected && !trigger.disabled
                    ? trigger
                    : document.querySelector('#inventory-modal .modal-header .modal-close-x');
            target?.focus({ preventScroll: true });
        }
    },

    /**
     * 아이템을 장착합니다
     * @param {string} id - 아이템 ID
     * @param {string} type - 아이템 타입
     * @param {string} targetSlot - 대상 슬롯
     */
    equip: (id, type, targetSlot) => {
        const item =
            type === 'weapon' ? weapons.find((w) => w.id === id) : items.find((i) => i.id === id);
        if (!item) return;
        if (type === 'weapon' ? !db.has(id) : !db.inventory.includes(id)) return;

        let slot = item.slot;
        if (type === 'weapon') {
            const allowedSlots = weaponEquipSlots(item);
            slot = targetSlot || allowedSlots[0];
            if (!allowedSlots.includes(slot)) {
                const positions = allowedSlots.map((s) => inventory.slots[s].label).join(' 또는 ');
                showToast(`${itemDisplayName(item)}은 ${positions}에 장착할 수 있습니다.`, 'error');
                return;
            }
        }

        // 최종 상태를 먼저 계산한다. 교체할 아이템을 빼기 전에 해제하면
        // 가득 찬 보관함에서 정상적인 교체까지 막히거나 용량을 초과할 수 있다.
        const equipped = { ...db.equipped };
        const stored = db.inventory.filter((value) => value !== id);
        for (const s of Object.keys(equipped)) {
            if (equipped[s] === id) delete equipped[s];
        }
        const slots = id === 'boots' ? ['foot-1', 'foot-2'] : [slot];
        for (const s of slots) {
            const old = equipped[s];
            if (old && !weapons.some((w) => w.id === old) && !stored.includes(old))
                stored.push(old);
            for (const oldSlot of Object.keys(equipped)) {
                if (old && equipped[oldSlot] === old) delete equipped[oldSlot];
            }
        }
        slots.forEach((s) => {
            equipped[s] = id;
        });
        const equippedWeapon = weapons.some((w) => w.id === equipped['hand-1'])
            ? equipped['hand-1']
            : 'basic';
        const next = { inventory: stored, equipped, equippedWeapon };
        if (
            inventory.getStoredCount(next) >
            Math.max(db.inventoryCapacity, inventory.getStoredCount())
        ) {
            showToast('인벤토리가 가득 찼습니다.', 'error');
            return;
        }
        Object.assign(db, next);

        db.save('owned', 'equip', 'dura', 'inventory', 'equipped');
        inventory.render();
        shop.render();
    },

    /**
     * 무기를 해제합니다
     * @param {string} slot - 슬롯 (선택사항)
     */
    unequipWeapon: (slot) => {
        const target =
            slot || Object.keys(db.equipped).find((s) => db.equipped[s] === db.equippedWeapon);
        if (target) inventory.unequip(target);
    },

    /**
     * 아이템을 해제합니다
     * @param {string} slot - 슬롯
     */
    unequip: (slot) => {
        const itemId = db.equipped[slot];
        if (!itemId) return;

        // 무기의 경우: db.inventory로 이동하지 않음 (db.owned에 유지)
        const isWeapon = !!weapons.find((w) => w.id === itemId);

        if (itemId !== 'basic' && inventory.getStoredCount() >= db.inventoryCapacity) {
            showToast('인벤토리가 가득 찼습니다.', 'error');
            return;
        }

        if (itemId === 'boots') {
            delete db.equipped['foot-1'];
            delete db.equipped['foot-2'];
        } else {
            delete db.equipped[slot];
        }

        // 활성 equippedWeapon이었다면 해제
        if (db.equippedWeapon === itemId) db.equippedWeapon = 'basic';

        // 무기가 아닌 아이템만 배낭 인벤토리에 추가
        if (!isWeapon && !db.inventory.includes(itemId)) {
            db.inventory.push(itemId);
        }

        db.save('owned', 'equip', 'dura', 'inventory', 'equipped');
        inventory.render();
    },
};
