/** Shared presentation assets; item data and purchase rules stay in their existing modules. */
function itemIconMarkup(item) {
    const names = {
        goldDagger: 'item-dagger',
        midasSword: 'item-swords',
        tycoonAxe: 'item-axe',
        basic: 'item-dagger',
        sword: 'item-dagger',
        fire: 'item-fire',
        ice: 'item-ice',
        lightning: 'item-trident',
        void: 'item-orb',
        shield_item: 'item-shield',
        helmet: 'item-helmet',
        boots: 'item-boots',
        hourglass: 'item-hourglass',
        goldGlove: 'item-glove',
        shield: 'item-shield',
        backpack: 'ui-backpack',
        hint: 'item-potion',
        ultimate: 'item-lightning',
        totalAssaultPause: 'item-hourglass',
    };
    const name = names[item.id] || 'item-scroll';
    return `<img class="item-art" src="images/theme/parts/${name}.webp" alt="" aria-hidden="true" />`;
}

function itemDisplayName(item) {
    return item.name.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '');
}

function formatMenuNumber(value) {
    return Number(value).toLocaleString('ko-KR');
}

/** 같은 정사각형 부품을 겹쳐 장비 화면과 전투 화면의 착용 위치를 맞춘다. */
function renderEquipmentAvatar(root, { equipped, durability, weapons, items, fallback }) {
    if (!root) return;
    const appearance = equipmentRules.appearance(equipped, durability, fallback);
    const names = [];
    for (const [part, active] of Object.entries(appearance)) {
        const layers = root.querySelectorAll(`[data-avatar-part="${part}"]`);
        if (part === 'weapon' || part === 'secondary') {
            const weapon = weapons.find((item) => item.id === active);
            layers.forEach((layer) => {
                layer.hidden = !weapon;
                layer.dataset.weapon = weapon?.id || '';
                layer.dataset.element = weapon?.effect || 'basic';
                // 공격 속성 아이콘 대신 손에 쥔 무기의 실루엣을 표시한다.
                const blade = ['basic', 'sword', 'goldDagger', 'midasSword', 'fire', 'ice'];
                layer.innerHTML = weapon
                    ? itemIconMarkup(blade.includes(weapon.id) ? { id: 'sword' } : weapon)
                    : '';
            });
            if (weapon) names.push(itemDisplayName(weapon));
        } else {
            layers.forEach((layer) => (layer.hidden = !active));
            const id = { helmet: 'helmet', gloves: 'goldGlove', boots: 'boots' }[part];
            const item = items.find((item) => item.id === id);
            if (active && item) names.push(itemDisplayName(item));
        }
    }
    root.setAttribute('role', 'img');
    root.setAttribute('aria-label', `모험가 · ${names.join(', ')}`);
}
