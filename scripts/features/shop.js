/**
 * 상점 시스템
 * 아이템 구매 및 상점 UI 관리
 */

const shop = {
    /**
     * 상점 모달을 엽니다
     */
    open: () => {
        // title-screen은 숨기지 않고 모달만 표시
        openScreenOverlay('shop-modal', true);

        shop.render();
    },

    /**
     * 상점 모달을 닫습니다
     */
    close: () => {
        navigation.track('title-screen');
        closeScreenOverlay('shop-modal', true);
        // title-screen은 이미 표시되어 있으므로 다시 표시할 필요 없음
    },

    /**
     * 상점 UI를 렌더링합니다
     */
    render: () => {
        const container = document.getElementById('shop-container');
        container.innerHTML = '';
        document.getElementById('shop-gold').innerText = formatMenuNumber(db.gold);

        const isPurchased = (item) =>
            db.inventory.includes(item.id) ||
            Object.values(db.equipped).includes(item.id) ||
            db.owned.includes(item.id);

        // 경제형 무기
        let html = '<div class="shop-section">경제형 무기 · 골드 보너스</div>';
        weapons
            .filter((w) => w.multiplier > 1 && !isPurchased(w))
            .forEach((w) => (html += shop.createItemHtml(w, 'weapon')));

        // 스킨 무기
        html += '<div class="shop-section">스킨 무기 · 이펙트</div>';
        weapons
            .filter((w) => w.id !== 'basic' && w.multiplier === 1 && !isPurchased(w))
            .forEach((w) => (html += shop.createItemHtml(w, 'weapon')));

        // 유물
        html += '<div class="shop-section">유물 / 아이템</div>';
        relics
            .filter(
                (r) =>
                    !r.storyOnly &&
                    r.type !== 'skyfall' &&
                    ((r.type !== 'skill' && !isPurchased(r)) || r.id === 'backpack')
            )
            .forEach((r) => (html += shop.createItemHtml(r, r.type)));

        // 스킬 (항상 표시)
        html += '<div class="shop-section">스킬</div>';
        relics
            .filter((r) => r.type === 'skill')
            .forEach((r) => (html += shop.createItemHtml(r, r.type)));

        // 장비
        html += '<div class="shop-section">장비</div>';
        items
            .filter((i) => !isPurchased(i))
            .forEach((i) => (html += shop.createItemHtml(i, 'item')));

        container.innerHTML = html;

        // 구매 버튼은 이벤트 위임으로 처리 (onclick 문자열에 데이터를 직접 보간하지 않음)
        // render()가 여러 번 호출되어도 핸들러가 중복되지 않도록 onclick에 재할당
        container.onclick = (e) => {
            const btn = e.target.closest('.buy-btn');
            if (!btn || !container.contains(btn)) return;
            shop.buy(btn.dataset.id, btn.dataset.type);
        };
    },

    /**
     * 아이템 HTML을 생성합니다
     * @param {Object} item - 아이템 데이터
     * @param {string} type - 아이템 타입
     * @returns {string} HTML 문자열
     */
    createItemHtml: (item, type) => {
        const isSkill = type === 'skill';
        const name = isSkill
            ? `${itemDisplayName(item)} (현재 ${db.skills[item.id]}개)`
            : itemDisplayName(item);
        return `<div class="shop-item${isSkill ? ' shop-item-skill' : ''}"><div class="shop-item-art">${itemIconMarkup(item)}</div><div class="shop-item-copy"><b>${escapeHTML(name)}</b><br><span class="shop-item-description">${escapeHTML(item.desc)}</span></div><div class="shop-item-purchase"><strong class="shop-price">${formatMenuNumber(item.cost)} G</strong><button class="buy-btn" data-id="${escapeHTML(item.id)}" data-type="${escapeHTML(type)}" aria-label="${escapeHTML(name)} 구매">구매</button></div></div>`;
    },

    /**
     * 아이템을 구매합니다
     * @param {string} id - 아이템 ID
     * @param {string} type - 아이템 타입
     */
    buy: (id, type) => {
        const item =
            type === 'weapon'
                ? weapons.find((w) => w.id === id)
                : type === 'item'
                  ? items.find((i) => i.id === id)
                  : relics.find((r) => r.id === id && r.type === type);
        if (!item || item.storyOnly || !Number.isFinite(item.cost) || item.cost < 0) return;
        const cost = item.cost;
        if (
            !['skill', 'backpack'].includes(type) &&
            (db.has(id) || db.inventory.includes(id) || Object.values(db.equipped).includes(id))
        )
            return;
        if (db.gold < cost) {
            showToast('골드가 부족합니다.', 'error');
            return;
        }

        const isStorable = ['item', 'weapon', 'passive', 'consumable', 'effect', 'either'].includes(
            type
        );

        if (isStorable) {
            const currentSize = inventory.getStoredCount();
            if (currentSize >= db.inventoryCapacity) {
                showToast('인벤토리가 가득 찼습니다.', 'error');
                return;
            }
        }

        // 구매 결과는 사본에서 계산하고, 비용과 함께 저장된 뒤에 적용한다.
        const changes = { gold: db.gold - cost };

        if (type === 'item') {
            changes.inventory = [...db.inventory, id];
            if (item.durability) changes.durability = { ...db.durability, [id]: item.durability };
        } else if (type === 'backpack') {
            changes.inventoryCapacity = db.inventoryCapacity + 1;
        } else if (type === 'skill') {
            const skill = relics.find((r) => r.id === id);
            // hint/ultimate 외의 새 스킬은 db.skills에 키가 없어 undefined += n → NaN 이 되므로 가드
            changes.skills = { ...db.skills, [id]: (db.skills[id] || 0) + skill.uses };
        } else {
            // 무기 및 기타 유물
            changes.owned = [...db.owned, id];
            if (type === 'consumable') {
                const relic = relics.find((r) => r.id === id);
                changes.durability = { ...db.durability, [id]: relic.durability };
            }
        }

        if (!db.commitChanges(changes)) return;
        shop.render();
        inventory.render(); // 인벤토리 화면도 업데이트
    },

    /**
     * 아이템을 장착합니다
     * @param {string} id - 아이템 ID
     */
    equip: (id) => {
        db.equip(id);
        shop.render();
    },
};
