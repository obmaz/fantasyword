/**
 * 아이템 데이터 로더
 * 외부 데이터 파일에서 아이템 데이터를 로드합니다 (CORS 문제 방지를 위해 JavaScript 변수로 래핑)
 * 데이터 파일이 로드되지 않으면 빈 fallback 사용
 */
const weapons = typeof window !== 'undefined' && window.weaponsData ? window.weaponsData : [];
const relics = typeof window !== 'undefined' && window.relicsData ? window.relicsData : [];
const items = typeof window !== 'undefined' && window.itemsData ? window.itemsData : [];

/** 장착 버튼, 실제 장착, 이전 저장 복원에서 공유하는 손 슬롯 규칙. */
function weaponEquipSlots(weapon) {
    if (!weapon) return [];
    if (weapon.category === 'weapon') return ['hand-1'];
    if (weapon.category === 'effect') return ['hand-2'];
    if (weapon.slot === 'either-hand' || !weapon.slot) return ['hand-1', 'hand-2'];
    return ['hand-1', 'hand-2'].includes(weapon.slot) ? [weapon.slot] : [];
}
