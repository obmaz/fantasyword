/**
 * 인벤토리 시스템
 * 아이템 장착, 해제, UI 렌더링 관리
 */

const inventory = {
    detailTrigger: null,
    /** 총공세 보상도 상점과 같은 저장·용량 규칙을 따른다. */
    grantReward: (id) => {
        const relic = relics.find((entry) => entry.id === id);
        if (!relic) return null;
        let changes;
        if (relic.type === 'skill') {
            changes = { skills: { ...db.skills, [id]: (db.skills[id] || 0) + (relic.uses || 1) } };
        } else if (relic.type === 'backpack') {
            changes = { inventoryCapacity: db.inventoryCapacity + 1 };
        } else if (relic.type === 'passive') {
            if (db.has(id) || inventory.getStoredCount() >= db.inventoryCapacity) return null;
            changes = { owned: [...db.owned, id] };
        } else return null;
        if (!db.commitChanges(changes)) return null;
        inventory.refresh();
        shop.refresh();
        gamePresentation.notify({
            title: '전리품 획득',
            detail: itemDisplayName(relic),
            item: relic,
        });
        return itemDisplayName(relic);
    },
    slots: {
        gloves: {
            label: '장갑',
            accepts: `미다스의 건틀릿 · 정답 골드 x${EQUIPMENT_CONFIG.gloveMultiplier} · ${EQUIPMENT_CONFIG.gloveUses}회`,
            placeholder: 'goldGlove',
        },
        head: { label: '머리', accepts: '통찰의 헬름 · 무료 힌트 1회', placeholder: 'helmet' },
        'hand-1': {
            label: '오른손',
            accepts: `주무기 · 골드 보너스 · 3연속 정답 +${equipmentRules.comboBonus} G`,
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
    getStoredEntries: (state = db) => {
        const equipped = Object.values(state.equipped);
        const ids = [...new Set([...state.inventory, ...(state.owned || db.owned)])];
        return ids
            .filter((id) => id !== 'basic' && id !== state.equippedWeapon && !equipped.includes(id))
            .map((id) => {
                const item = items.find((entry) => entry.id === id);
                const weapon = weapons.find((entry) => entry.id === id);
                const relic = relics.find(
                    (entry) => entry.id === id && ['passive', 'consumable'].includes(entry.type)
                );
                return item
                    ? { item, type: 'item' }
                    : weapon
                      ? { item: weapon, type: 'weapon' }
                      : relic
                        ? { item: relic, type: 'relic' }
                        : null;
            })
            .filter(Boolean);
    },
    getStoredCount: (state = db) => inventory.getStoredEntries(state).length,
    capacitySummary: (used = inventory.getStoredCount()) =>
        `보관함 ${used} / ${db.inventoryCapacity}칸 · 빈칸 ${Math.max(0, db.inventoryCapacity - used)}칸`,
    renderCapacity: (used = inventory.getStoredCount()) => {
        document.getElementById('inv-cap').textContent = used;
        document.getElementById('inv-max-cap').textContent = db.inventoryCapacity;
        document.getElementById('inventory-capacity-summary').textContent =
            inventory.capacitySummary(used);
    },
    refresh: () => {
        if (document.getElementById('inventory-modal').open) inventory.render();
        else {
            inventory.renderCapacity();
            ui.updateVisuals();
            ui.updateSkills();
        }
    },
    /**
     * 인벤토리 모달을 엽니다
     */
    open: () => {
        // title-screen은 숨기지 않고 모달만 표시
        inventory.hideDetails(false); // 열 때 이전 상세 화면과 포커스를 정리한다.
        inventory.render();
        openScreenOverlay('inventory-modal', true);

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
        invContainer.replaceChildren();

        // 인벤토리 용량 표시
        const entries = inventory.getStoredEntries();
        inventory.renderCapacity(entries.length);
        const weapon = weapons.find((w) => w.id === db.equippedWeapon);
        const gloveMultiplier =
            db.equipped.gloves === 'goldGlove' && db.durability.goldGlove > 0
                ? EQUIPMENT_CONFIG.gloveMultiplier
                : 1;
        document.getElementById('inv-gold-bonus').textContent =
            `×${Number(((weapon?.multiplier || 1) * gloveMultiplier).toFixed(2))}`;

        // 표시하는 슬롯은 실제 장착 위치와 같다. 장착하지 않은 슬롯은 빈 칸으로 둔다.
        for (const [slot, rule] of Object.entries(inventory.slots)) {
            const equipSlot = document.getElementById(`inv-${slot}`);
            if (!equipSlot) continue;
            const itemId = db.equipped[slot] || null;
            const item = items.find((i) => i.id === itemId) || weapons.find((w) => w.id === itemId);
            equipSlot.dataset.empty = String(!item);
            equipSlot.disabled = !item;
            equipSlot.title = `${rule.label} · ${rule.accepts}`;
            if (item) {
                equipSlot.innerHTML = itemIconMarkup(item);
                equipSlot.setAttribute(
                    'aria-label',
                    `${rule.label}: ${itemDisplayName(item)}, 장착 해제`
                );
            } else {
                equipSlot.innerHTML = '<span class="inv-slot-empty" aria-hidden="true">·</span>';
                equipSlot.setAttribute(
                    'aria-label',
                    `${rule.label} 슬롯: 비어 있음 · ${rule.accepts}`
                );
            }
        }

        // 용량에 포함되는 장비와 슬롯 없는 유물을 같은 목록에 표시한다.
        entries.forEach(({ item, type }) => {
            const itemEl = document.createElement('button');
            itemEl.type = 'button';
            itemEl.setAttribute('aria-label', itemDisplayName(item));
            itemEl.className = 'inv-item';
            itemEl.innerHTML = itemIconMarkup(item);
            itemEl.onclick = () => inventory.showDetails(item.id, type);
            invContainer.appendChild(itemEl);
        });

        if (!invContainer.children.length) {
            const empty = document.createElement('p');
            empty.className = 'inventory-empty';
            empty.textContent = '보관 중인 장비가 없습니다.';
            invContainer.appendChild(empty);
        }

        // 보유 유물 렌더링
        const relicsContainer = document.querySelector('.inv-relics');
        relicsContainer.replaceChildren();
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
        ui.updateSkills();
    },

    /**
     * 아이템 상세 정보를 표시합니다
     * @param {string} id - 아이템 ID
     * @param {string} type - 아이템 타입 ('item' 또는 'weapon')
     */
    showDetails: (id, type) => {
        const itemData =
            type === 'item'
                ? items.find((i) => i.id === id)
                : type === 'relic'
                  ? relics.find((r) => r.id === id)
                  : weapons.find((w) => w.id === id);
        if (!itemData) return;
        const trigger = document.activeElement;
        inventory.detailTrigger =
            trigger &&
            document.getElementById('inventory-modal').contains(trigger) &&
            !document.getElementById('inv-item-detail').contains(trigger)
                ? trigger
                : null;

        document.getElementById('detail-icon').innerHTML = itemIconMarkup(itemData);
        document.getElementById('detail-name').textContent = itemDisplayName(itemData);
        const allowedSlots = type === 'weapon' ? weaponEquipSlots(itemData) : [itemData.slot];
        const slotNames = allowedSlots.map((slot) => inventory.slots[slot]?.label).filter(Boolean);
        const placement = itemData.id === 'boots' ? '양발 함께' : slotNames.join(' 또는 ');
        let description =
            type === 'relic'
                ? `${itemData.desc}\n보유 중 효과 적용 · 보관함 1칸 사용`
                : `${itemData.desc}\n장착 위치: ${placement}`;
        if (itemData.durability) description += `\n남은 사용: ${db.durability[id] || 0}회`;
        if (
            type === 'weapon' &&
            allowedSlots.includes('hand-1') &&
            !itemData.desc?.includes('3연속')
        )
            description += `\n오른손: 3연속 정답마다 추가 공격 +${equipmentRules.comboBonus} G`;
        if (type === 'weapon' && itemData.multiplier > 1)
            description += '\n골드 보너스는 오른손에 장착했을 때 적용됩니다.';
        document.getElementById('detail-desc').textContent = description;

        const actionsContainer = document.getElementById('detail-actions');
        actionsContainer.replaceChildren();

        // 무기의 경우 정의된 슬롯에 장착 허용
        if (type === 'weapon') {
            for (const slot of allowedSlots) {
                const equipBtn = document.createElement('button');
                equipBtn.className = 'btn-main';
                equipBtn.dataset.confirmTone = 'execute';
                const current = db.equipped[slot];
                equipBtn.textContent = `${inventory.slots[slot].label} ${current === id ? '장착 중' : current ? '교체' : '장착'}`;
                equipBtn.disabled = current === id;
                equipBtn.onclick = () => {
                    if (inventory.equip(id, 'weapon', slot)) inventory.hideDetails();
                };
                actionsContainer.appendChild(equipBtn);
            }

            // 현재 장착 중이면 해제 허용
            if (db.equippedWeapon === id || Object.values(db.equipped).includes(id)) {
                const unequipBtn = document.createElement('button');
                unequipBtn.className = 'btn-main btn-blue';
                unequipBtn.dataset.confirmTone = 'cancel';
                unequipBtn.textContent = '해제';
                unequipBtn.onclick = () => {
                    const slot = Object.keys(db.equipped).find((s) => db.equipped[s] === id);
                    if (inventory.unequipWeapon(slot)) inventory.hideDetails();
                };
                actionsContainer.appendChild(unequipBtn);
            }
        } else if (type === 'item') {
            // 아이템 (소모품 / 장비)
            const equipBtn = document.createElement('button');
            equipBtn.className = 'btn-main';
            equipBtn.dataset.confirmTone = 'execute';
            equipBtn.textContent = `${itemData.id === 'boots' ? '양발' : slotNames[0]} 장착`;
            equipBtn.onclick = () => {
                if (inventory.equip(id, type)) inventory.hideDetails();
            };
            actionsContainer.appendChild(equipBtn);

            // 소모품이면 사용 버튼 추가
            const isConsumable = relics.find((r) => r.id === id && r.type === 'consumable');
            if (isConsumable) {
                const useBtn = document.createElement('button');
                useBtn.className = 'btn-main btn-blue';
                useBtn.dataset.confirmTone = 'execute';
                useBtn.textContent = '사용하기';
                useBtn.onclick = () => {
                    if (db.useItem(id)) inventory.hideDetails();
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
        const replaced = [
            ...new Set(slots.map((s) => db.equipped[s]).filter((old) => old && old !== id)),
        ];
        if (!db.commitChanges(next)) {
            showToast('장착 변경을 저장하지 못했습니다. 다시 시도해 주세요.', 'error');
            return false;
        }
        if (replaced.length) {
            const previousNames = replaced.map((old) =>
                itemDisplayName(
                    weapons.find((w) => w.id === old) || items.find((i) => i.id === old)
                )
            );
            showToast(
                `${previousNames.join(', ')} 해제 · ${itemDisplayName(item)} 장착`,
                'success'
            );
        }
        inventory.refresh();
        shop.refresh();
        gamePresentation.equip(
            { ...item, name: itemDisplayName(item) },
            document.getElementById('inventory-avatar')
        );
        for (const target of slots)
            gamePresentation.highlight?.(document.getElementById(`inv-${target}`));
        return true;
    },

    /**
     * 무기를 해제합니다
     * @param {string} slot - 슬롯 (선택사항)
     */
    unequipWeapon: (slot) => {
        const target =
            slot || Object.keys(db.equipped).find((s) => db.equipped[s] === db.equippedWeapon);
        if (target) return inventory.unequip(target);
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

        const equipped = { ...db.equipped };
        if (itemId === 'boots') {
            delete equipped['foot-1'];
            delete equipped['foot-2'];
        } else {
            delete equipped[slot];
        }
        const changes = {
            equipped,
            equippedWeapon: db.equippedWeapon === itemId ? 'basic' : db.equippedWeapon,
            inventory:
                !isWeapon && !db.inventory.includes(itemId)
                    ? [...db.inventory, itemId]
                    : [...db.inventory],
        };
        if (!db.commitChanges(changes)) {
            showToast('장비 해제를 저장하지 못했습니다. 다시 시도해 주세요.', 'error');
            return false;
        }
        inventory.refresh();
        shop.refresh();
        return true;
    },
};
