/** 전투 화면의 몬스터 스프라이트 선택. */
(function () {
    const MONSTER_SPRITES = Object.freeze([
        'images/battle/monster-1.webp',
        'images/battle/monster-2.webp',
        'images/battle/monster-3.webp',
    ]);
    window.pickMonsterSprite = () =>
        MONSTER_SPRITES[Math.floor(Math.random() * MONSTER_SPRITES.length)];
})();
