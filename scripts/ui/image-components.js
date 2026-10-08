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
