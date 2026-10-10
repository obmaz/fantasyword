/**
 * 설정 관리자
 * - 설정 모달 제어
 * - 오디오/TTS 설정 관리
 * - 게임 설정 초기화 및 검증
 */

const settingsManager = {
    adminUnlocked: false,
    musicTogglePairs: 0,
    awaitingMusicOn: false,
    musicToggleTimer: null,
    hideAdmin: () => {
        clearTimeout(settingsManager.musicToggleTimer);
        settingsManager.musicTogglePairs = 0;
        settingsManager.awaitingMusicOn = false;
        settingsManager.adminUnlocked = false;
        for (const id of ['settings-admin-gold', 'settings-admin-stats'])
            document.getElementById(id).hidden = true;
    },
    recordMusicToggle: (enabled) => {
        clearTimeout(settingsManager.musicToggleTimer);
        if (settingsManager.adminUnlocked) return;
        if (!enabled) settingsManager.awaitingMusicOn = true;
        else if (settingsManager.awaitingMusicOn) {
            settingsManager.musicTogglePairs += 1;
            settingsManager.awaitingMusicOn = false;
            if (settingsManager.musicTogglePairs === 3) {
                settingsManager.adminUnlocked = true;
                for (const id of ['settings-admin-gold', 'settings-admin-stats'])
                    document.getElementById(id).hidden = false;
                return;
            }
        } else settingsManager.musicTogglePairs = 0;
        settingsManager.musicToggleTimer = setTimeout(settingsManager.hideAdmin, 5000);
    },
    init: () => {
        // 1. 설정 데이터 검증 및 초기화
        // 참고: 음악 트랙 잠금(unlockedMusicTracks / musicUnlockThresholds)은 제거되었습니다.
        // 해금 조건이 구현된 적이 없어 항상 전 트랙이 열린 상태였고,
        // database.js의 settings 로더가 두 필드(musicPlay/wordRead)만 복원하므로
        // 저장되지도 않는 죽은 상태였습니다. 모든 트랙은 항상 재생 가능합니다.
        if (!db.settings) {
            db.settings = { musicPlay: true, wordRead: true };
        }

        // 2. UI 이벤트 리스너 설정
        const musicCheck = document.getElementById('setting-music-play');
        const wordCheck = document.getElementById('setting-word-read');

        if (musicCheck) {
            musicCheck.checked = db.settings.musicPlay !== false;
            musicCheck.addEventListener('change', () => {
                settingsManager.recordMusicToggle(musicCheck.checked);
                db.settings.musicPlay = musicCheck.checked;
                db.save('settings');
                // 오디오 매니저가 있다면 상태 업데이트가 필요할 수 있음
                // (현재 playMusic 함수는 호출 시 db.settings를 확인하므로 즉시 반영됨)
                if (!db.settings.musicPlay) {
                    const bgMusic = document.getElementById('background-music');
                    if (bgMusic) bgMusic.pause();
                } else {
                    // 켜면 현재 모드 음악 재생 시도? (일단 보류, 사용자가 직접 켜는 흐름)
                }
            });
        }

        if (wordCheck) {
            wordCheck.checked = db.settings.wordRead !== false;
            wordCheck.addEventListener('change', () => {
                if (!settingsManager.adminUnlocked) settingsManager.hideAdmin();
                db.settings.wordRead = wordCheck.checked;
                db.save('settings');
                if (!wordCheck.checked) practiceMemorization.stopSpeech();
            });
        }
        document.getElementById('settings-gold-down').addEventListener('click', () => {
            secret.updateGoldEdit(-500);
        });
        document.getElementById('settings-gold-up').addEventListener('click', () => {
            secret.updateGoldEdit(500);
        });
    },

    showPanel: (panelId) => {
        for (const id of [
            'gold-adjuster-modal',
            'password-modal',
            'gold-edit-modal',
            'print-day-select-modal',
        ]) {
            const panel = document.getElementById(id);
            panel.style.display = id === panelId ? 'flex' : 'none';
        }
        document.getElementById(panelId).querySelector('input, select, button')?.focus();
    },

    open: () => {
        settingsManager.hideAdmin();
        secret.cancelTimers();
        secret.entered = '';
        secret.pendingAction = null;
        secret.previousModal = null;
        settingsManager.showPanel('gold-adjuster-modal');
        document.getElementById('setting-music-play').checked = db.settings.musicPlay;
        document.getElementById('setting-word-read').checked = db.settings.wordRead;
        openScreenOverlay('setting-modal');
        settingsManager.showPanel('gold-adjuster-modal');
        secret.editGold = db.gold;
        secret.updateGoldEdit(0);
        document.getElementById('settings-current-gold').innerText = formatMenuNumber(db.gold);
    },
    close: () => {
        settingsManager.hideAdmin();
        secret.cancelTimers();
        secret.entered = '';
        secret.pendingAction = null;
        secret.previousModal = null;
        closeScreenOverlay('setting-modal');
        navigation.track('title-screen');
    },
    resetGame: async () => {
        const confirmed = await showConfirm(
            '골드, 장비, 스토리 진행, 외운 단어, 복수 퀘스트, 통계와 설정을 모두 삭제하고 기본 99골드로 처음부터 시작합니다. 되돌릴 수 없습니다.',
            { okText: '모두 삭제', cancelText: '돌아가기' }
        );
        if (!confirmed) return;
        if (!gameStorage.clearGameData()) {
            showToast('저장 데이터를 지우지 못했습니다. 다시 시도해 주세요.', 'error');
            return;
        }
        game.stop();
        practiceMemorization.stopSpeech();
        document.getElementById('background-music')?.pause();
        window.location.reload();
    },
};
window.settingsManager = settingsManager;
