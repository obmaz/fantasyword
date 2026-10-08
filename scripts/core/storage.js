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
    /** 게임이 소유한 저장 키만 지운다. 같은 출처의 다른 데이터는 보존한다. */
    clearGameData: () => {
        try {
            const keys = [];
            for (let index = 0; index < localStorage.length; index++) {
                const key = localStorage.key(index);
                if (key?.startsWith('v7_') || key === 'selectedGameDataSet') keys.push(key);
            }
            keys.forEach((key) => localStorage.removeItem(key));
            return true;
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
