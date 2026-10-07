/** 무기 형태와 속성은 별개로 선택한다. 왼손 이펙트가 오른손 모션을 덮어쓰지 않는다. */
const battleAttackProfiles = (() => {
    const weapons = Object.freeze({
        basic: { motion: 'slash', icon: 'item-dagger', impactMs: 200 },
        sword: { motion: 'cross', icon: 'item-dagger', impactMs: 200 },
        goldDagger: { motion: 'dagger', icon: 'item-dagger', impactMs: 150 },
        midasSword: { motion: 'royal', icon: 'item-swords', impactMs: 220 },
        tycoonAxe: { motion: 'axe', icon: 'item-axe', impactMs: 300 },
        fire: { motion: 'rise', icon: 'item-fire', impactMs: 240 },
        ice: { motion: 'reap', icon: 'item-ice', impactMs: 240 },
        lightning: { motion: 'thrust', icon: 'item-trident', impactMs: 180 },
    });
    const elements = ['basic', 'fire', 'ice', 'lightning', 'void', 'gold'];
    function resolve(input = {}) {
        if (typeof input === 'string') input = { weaponId: input, effect: input };
        const weaponId = Object.hasOwn(weapons, input.weaponId) ? input.weaponId : 'basic';
        const element = elements.includes(input.effect) ? input.effect : 'basic';
        const secondary =
            elements.includes(input.secondaryEffect) && input.secondaryEffect !== element
                ? input.secondaryEffect
                : null;
        return {
            ...weapons[weaponId],
            weaponId,
            element,
            secondary,
            combo: input.combo === true,
            echo: ['sword', 'goldDagger', 'midasSword'].includes(weaponId) || input.combo === true,
            durationMs: 720,
        };
    }
    return Object.freeze({ resolve, weapons });
})();
