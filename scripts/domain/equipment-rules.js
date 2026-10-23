/** 장비의 전투 능력. 소유만 한 장비는 활성화하지 않는다. */
const equipmentRules = Object.freeze({
    comboBonus: 3,
    appearance(equipped, durability, fallback = 'basic') {
        return {
            weapon: equipped['hand-1'] || fallback,
            secondary: equipped['hand-2'] || null,
            helmet: equipped.head === 'helmet',
            gloves: equipped.gloves === 'goldGlove' && durability.goldGlove > 0,
            boots: equipped['foot-1'] === 'boots' && equipped['foot-2'] === 'boots',
        };
    },
    load(equipped, weapons, fallback = 'basic') {
        const primary = weapons.find((w) => w.id === (equipped['hand-1'] || fallback));
        const isLightning = primary?.id === 'lightning';
        const isIce = primary?.id === 'ice';
        return {
            weapon: Boolean(
                primary && primary.id !== 'shield_item' && primary.category !== 'effect'
            ),
            combo: 0,
            comboEvery: isLightning
                ? EQUIPMENT_CONFIG.lightningComboEvery
                : EQUIPMENT_CONFIG.comboEvery,
            comboReward: isLightning
                ? EQUIPMENT_CONFIG.lightningComboBonus
                : equipmentRules.comboBonus,
            fireBonus: primary?.id === 'fire' ? EQUIPMENT_CONFIG.fireCorrectBonus : 0,
            protection: equipped['hand-2'] === 'shield_item' || isIce,
            insight: equipped.head === 'helmet',
            shield: equipped['hand-2'] === 'shield_item' || isIce ? 1 : 0,
            hint: equipped.head === 'helmet' ? 1 : 0,
            boots: equipped['foot-1'] === 'boots' && equipped['foot-2'] === 'boots',
            route: 'none',
        };
    },
    combo(state, correct) {
        if (!correct || !state.weapon) return { combo: 0, bonus: 0 };
        const combo = state.combo + 1;
        return {
            combo,
            bonus:
                combo % (state.comboEvery || EQUIPMENT_CONFIG.comboEvery) === 0
                    ? state.comboReward || equipmentRules.comboBonus
                    : 0,
        };
    },
    routeBonus: (gain, route) =>
        route === 'treasure' ? Math.round(gain * EQUIPMENT_CONFIG.treasureRate) : 0,
    routeSeconds: (route) => (route === 'safe' ? EQUIPMENT_CONFIG.safeRouteSeconds : 0),
    canHint(word, fixedHints = '') {
        const letters = [...word.trim()];
        if (letters.length <= 1) return false;
        const shown = letters.length === 2 ? 1 : 2;
        return letters
            .slice(0, shown)
            .some(
                (letter, index) => /[a-z]/i.test(letter) && !/[a-z]/i.test(fixedHints[index] || '')
            );
    },
    hint(word) {
        const letters = [...word.trim()];
        if (letters.length <= 1) return `전체 ${letters.length}글자`;
        const shown = letters.length === 2 ? 1 : 2;
        return `앞 ${shown}글자: ${letters.slice(0, shown).join('')} · 전체 ${letters.length}글자`;
    },
});
