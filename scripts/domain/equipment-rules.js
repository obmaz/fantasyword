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
        return {
            weapon: Boolean(
                primary && primary.id !== 'shield_item' && primary.category !== 'effect'
            ),
            combo: 0,
            protection: equipped['hand-2'] === 'shield_item',
            insight: equipped.head === 'helmet',
            shield: equipped['hand-2'] === 'shield_item' ? 1 : 0,
            hint: equipped.head === 'helmet' ? 1 : 0,
            boots: equipped['foot-1'] === 'boots' && equipped['foot-2'] === 'boots',
            route: 'none',
        };
    },
    combo(state, correct) {
        if (!correct || !state.weapon) return { combo: 0, bonus: 0 };
        const combo = state.combo + 1;
        return combo === 3 ? { combo: 0, bonus: equipmentRules.comboBonus } : { combo, bonus: 0 };
    },
    routeBonus: (gain, route) => (route === 'treasure' ? Math.round(gain * 0.1) : 0),
    routeSeconds: (route) => (route === 'safe' ? 5 : 0),
    hint(word) {
        const letters = [...word.trim()];
        if (letters.length <= 1) return `전체 ${letters.length}글자`;
        const shown = letters.length === 2 ? 1 : 2;
        return `앞 ${shown}글자: ${letters.slice(0, shown).join('')} · 전체 ${letters.length}글자`;
    },
});
