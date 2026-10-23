/**
 * 설정 관리자
 * - 설정 모달 제어
 * - 오디오/TTS 설정 관리
 * - 게임 설정 초기화 및 검증
 */

const settingsManager = {
    adminSectionIds: ['settings-admin-gold', 'settings-admin-stats', 'settings-admin-games'],
    adminUnlocked: false,
    musicTogglePairs: 0,
    awaitingMusicOn: false,
    musicToggleTimer: null,
    hideAdmin: () => {
        clearTimeout(settingsManager.musicToggleTimer);
        settingsManager.musicTogglePairs = 0;
        settingsManager.awaitingMusicOn = false;
        settingsManager.adminUnlocked = false;
        for (const id of settingsManager.adminSectionIds) document.getElementById(id).hidden = true;
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
                for (const id of settingsManager.adminSectionIds)
                    document.getElementById(id).hidden = false;
                return;
            }
        } else settingsManager.musicTogglePairs = 0;
        settingsManager.musicToggleTimer = setTimeout(settingsManager.hideAdmin, 5000);
    },
    openAdminGame: (mode) => {
        if (!settingsManager.adminUnlocked) return;
        const starts = {
            hangman: () => hangman.start(),
            assault: openSkyfallModal,
            idiom: () => openScreenOverlay('idiom-test-modal', false),
            shell: () => shellGame.start(),
            proverb: () => storyPuzzle.start('proverb'),
            forge: () => storyPuzzle.start('forge'),
        };
        if (!Object.hasOwn(starts, mode)) return;
        settingsManager.close();
        resetScreenOverlay('setting-modal');
        cancelPendingGameStart();
        starts[mode]();
    },
    init: () => {
        // 저장 설정을 사용하며 배경음악은 모든 트랙을 선택할 수 있다.
        if (!db.settings) {
            db.settings = {
                musicPlay: true,
                wordRead: true,
                soundEffects: true,
                vibration: true,
                vibrationDuration: HAPTICS_CONFIG.defaultDuration,
            };
        }

        // 각 조작은 저장 성공 후의 설정 상태를 표시한다.
        const musicCheck = document.getElementById('setting-music-play');
        const wordCheck = document.getElementById('setting-word-read');
        const soundCheck = document.getElementById('setting-sound-effects');
        soundCheck.checked = db.settings.soundEffects !== false;
        soundCheck.addEventListener('change', () => {
            if (!settingsManager.adminUnlocked) settingsManager.hideAdmin();
            if (
                !db.commitChanges({
                    settings: { ...db.settings, soundEffects: soundCheck.checked },
                })
            ) {
                soundCheck.checked = db.settings.soundEffects !== false;
                showToast('효과음 설정을 저장하지 못했습니다.', 'error');
            }
            if (!db.settings.soundEffects) gameSound.stop();
            else gameSound.unlock();
        });
        const vibrationCheck = document.getElementById('setting-vibration');
        const vibrationDuration = document.getElementById('setting-vibration-duration');
        vibrationDuration.replaceChildren();
        HAPTICS_CONFIG.durations.forEach((duration, index) => {
            const option = document.createElement('option');
            option.value = String(duration);
            option.textContent = ['짧게', '보통', '길게'][index];
            vibrationDuration.appendChild(option);
        });
        const syncVibration = () => {
            vibrationCheck.checked = db.settings.vibration !== false;
            vibrationDuration.value = String(
                db.settings.vibrationDuration || HAPTICS_CONFIG.defaultDuration
            );
            vibrationDuration.disabled = !vibrationCheck.checked;
        };
        const saveVibration = () => {
            if (!settingsManager.adminUnlocked) settingsManager.hideAdmin();
            if (
                !db.commitChanges({
                    settings: {
                        ...db.settings,
                        vibration: vibrationCheck.checked,
                        vibrationDuration: Number(vibrationDuration.value),
                    },
                })
            )
                showToast('진동 설정을 저장하지 못했습니다.', 'error');
            syncVibration();
        };
        syncVibration();
        vibrationCheck.addEventListener('change', saveVibration);
        vibrationDuration.addEventListener('change', saveVibration);

        if (musicCheck) {
            musicCheck.checked = db.settings.musicPlay !== false;
            musicCheck.addEventListener('change', () => {
                if (
                    !db.commitChanges({
                        settings: { ...db.settings, musicPlay: musicCheck.checked },
                    })
                ) {
                    musicCheck.checked = db.settings.musicPlay;
                    showToast('음악 설정을 저장하지 못했습니다.', 'error');
                    return;
                }
                settingsManager.recordMusicToggle(musicCheck.checked);
                if (!db.settings.musicPlay) {
                    const bgMusic = document.getElementById('background-music');
                    if (bgMusic) bgMusic.pause();
                }
            });
        }

        if (wordCheck) {
            wordCheck.checked = db.settings.wordRead !== false;
            wordCheck.addEventListener('change', () => {
                if (!settingsManager.adminUnlocked) settingsManager.hideAdmin();
                if (
                    !db.commitChanges({ settings: { ...db.settings, wordRead: wordCheck.checked } })
                ) {
                    wordCheck.checked = db.settings.wordRead;
                    showToast('자동 발음 설정을 저장하지 못했습니다.', 'error');
                    return;
                }
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
        document.getElementById('setting-music-play').checked = db.settings.musicPlay;
        document.getElementById('setting-word-read').checked = db.settings.wordRead;
        document.getElementById('setting-sound-effects').checked =
            db.settings.soundEffects !== false;
        document.getElementById('setting-vibration').checked = db.settings.vibration !== false;
        document.getElementById('setting-vibration-duration').value = String(
            db.settings.vibrationDuration || HAPTICS_CONFIG.defaultDuration
        );
        document.getElementById('setting-vibration-duration').disabled =
            db.settings.vibration === false;
        openScreenOverlay('setting-modal');
        settingsManager.showPanel('gold-adjuster-modal');
        secret.editGold = db.gold;
        secret.updateGoldEdit(0);
        document.getElementById('settings-current-gold').textContent = formatMenuNumber(db.gold);
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
            { okText: '모두 삭제', cancelText: '돌아가기', tone: 'warning' }
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
