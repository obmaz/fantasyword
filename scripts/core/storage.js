/** 저장소 접근 실패/손상된 JSON이 게임 전체의 로딩을 막지 않도록 한다. */
const gameStorage = {
    warned: false,
    get: (key, fallback = null) => {
        try {
            return localStorage.getItem(key) ?? fallback;
        } catch (error) {
            gameStorage.warn();
            return fallback;
        }
    },
    readJSON: (key, fallback) => {
        try {
            const raw = gameStorage.get(key);
            return raw === null ? fallback : (JSON.parse(raw) ?? fallback);
        } catch (error) {
            console.warn(`[storage] 저장 데이터 형식 오류: ${key}`);
            return fallback;
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            gameStorage.warn();
            return false;
        }
    },
    /** 관련 키를 함께 저장하고 쓰기 실패 시 이전 값을 복원한다. null은 삭제다. */
    setBatch: (values) => {
        const written = [];
        try {
            // 변경 전에 모든 키를 읽어, 읽기 실패 시에도 중간 변경을 남기지 않는다.
            const entries = Object.entries(values).map(([key, value]) => ({
                key,
                value: value === null ? null : String(value),
                previous: localStorage.getItem(key),
            }));
            for (const entry of entries) {
                if (entry.value === null) localStorage.removeItem(entry.key);
                else localStorage.setItem(entry.key, entry.value);
                written.push(entry);
            }
            return true;
        } catch (error) {
            for (const { key, previous } of written.reverse()) {
                try {
                    if (previous === null) localStorage.removeItem(key);
                    else localStorage.setItem(key, previous);
                } catch {
                    // 저장소 자체가 차단된 경우에도 로딩을 중단하지 않는다.
                }
            }
            gameStorage.warn();
            return false;
        }
    },
    /** 게임이 소유한 저장 키만 지운다. 같은 출처의 다른 데이터는 보존한다. */
    clearGameData: () => {
        try {
            const keys = [];
            for (let index = 0; index < localStorage.length; index++) {
                const key = localStorage.key(index);
                if (key?.startsWith('v7_') || key === 'selectedGameDataSet') keys.push(key);
            }
            return gameStorage.setBatch(Object.fromEntries(keys.map((key) => [key, null])));
        } catch (error) {
            gameStorage.warn();
            return false;
        }
    },
    warn: () => {
        if (gameStorage.warned) return;
        gameStorage.warned = true;
        console.warn(
            '[storage] 브라우저 저장소를 사용할 수 없습니다. 진행 상황이 저장되지 않을 수 있습니다.'
        );
        const notify = () => {
            if (typeof showToast === 'function') {
                showToast('저장소를 사용할 수 없어 진행 상황이 저장되지 않을 수 있습니다.', 'warn');
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', notify, { once: true });
        } else {
            setTimeout(notify, 0);
        }
    },
};
