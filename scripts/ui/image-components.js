/** Shared presentation assets; item data and purchase rules stay in their existing modules. */
function itemIconMarkup(item) {
    const names = {
        goldDagger: 'weapon-gold-dagger',
        midasSword: 'weapon-midas-sword',
        tycoonAxe: 'weapon-tycoon-axe',
        basic: 'weapon-basic',
        sword: 'weapon-sword',
        fire: 'weapon-fire',
        ice: 'weapon-ice',
        lightning: 'weapon-lightning',
        void: 'weapon-void',
        shield_item: 'weapon-shield',
        helmet: 'item-helmet',
        boots: 'item-boots',
        hourglass: 'item-hourglass',
        goldGlove: 'item-glove',
        shield: 'item-shield',
        backpack: 'ui-backpack',
        hint: 'item-potion',
        ultimate: 'item-lightning',
        totalAssaultPause: 'item-hourglass',
        shadowCompass: 'item-scroll',
        shadowLantern: 'item-potion',
        wardingSigil: 'item-shield',
        pilgrimMedal: 'approved-coin',
    };
    const name = names[item.id] || 'item-scroll';
    return `<img class="item-art item-art-${item.id}" src="images/theme/parts/${name}.webp" alt="" aria-hidden="true" />`;
}

function itemDisplayName(item) {
    return item.name.replace(/^[\p{Extended_Pictographic}\uFE0F\s]+/u, '');
}

function formatMenuNumber(value) {
    return Number(value).toLocaleString('ko-KR');
}

// 생성된 부품 안의 실제 손잡이 위치. 같은 중심 좌표로 모든 무기를 붙이지 않는다.
const HELD_WEAPON_POSES = Object.freeze({
    basic: { gripX: 0.28, gripY: 0.74, size: 0.52 },
    sword: { gripX: 0.21, gripY: 0.76, size: 0.53 },
    goldDagger: { gripX: 0.32, gripY: 0.8, size: 0.42 },
    midasSword: { gripX: 0.215, gripY: 0.77, size: 0.54 },
    tycoonAxe: { gripX: 0.34, gripY: 0.78, size: 0.61 },
    fire: { gripX: 0.24, gripY: 0.78, size: 0.55 },
    ice: { gripX: 0.33, gripY: 0.79, size: 0.6 },
    lightning: { gripX: 0.35, gripY: 0.73, size: 0.62 },
    void: { gripX: 0.4, gripY: 0.75, size: 0.48 },
    shield_item: { gripX: 0.53, gripY: 0.5, size: 0.34 },
});

/** 같은 정사각형 부품을 겹쳐 장비 화면과 전투 화면의 착용 위치를 맞춘다. */
function renderEquipmentAvatar(root, { equipped, durability, weapons, items, fallback }) {
    if (!root) return;
    const appearance = equipmentRules.appearance(equipped, durability, fallback);
    root.dataset.helmet = String(appearance.helmet);
    const names = [];
    for (const [part, active] of Object.entries(appearance)) {
        const layers = root.querySelectorAll(`[data-avatar-part="${part}"]`);
        if (part === 'weapon' || part === 'secondary') {
            const weapon = weapons.find((item) => item.id === active);
            layers.forEach((layer) => {
                layer.hidden = !weapon;
                layer.dataset.weapon = weapon?.id || '';
                layer.dataset.element = weapon?.effect || 'basic';
                const pose = HELD_WEAPON_POSES[weapon?.id] || HELD_WEAPON_POSES.basic;
                const secondary = part === 'secondary';
                const shield = weapon?.id === 'shield_item';
                const size = shield ? pose.size : pose.size * (secondary ? 0.67 : 1);
                // 무기 없는 몸 그림의 주먹 중심. 손잡이와 손 마스크가 같은 좌표를 쓴다.
                const handX = secondary ? 0.885 : 0.41;
                const handY = secondary ? 0.585 : 0.62;
                for (const [name, value] of Object.entries({
                    size,
                    left: handX - pose.gripX * size,
                    top: handY - pose.gripY * size,
                    'hand-x': handX,
                    'hand-y': handY,
                    'grip-x': pose.gripX,
                    'grip-y': pose.gripY,
                }))
                    layer.style.setProperty(`--held-${name}`, `${value * 100}%`);
                layer.style.setProperty('--held-angle', `${shield ? 0 : secondary ? 128 : -60}deg`);
                layer.innerHTML = weapon ? itemIconMarkup(weapon) : '';
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
