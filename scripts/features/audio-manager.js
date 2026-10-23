// IIFE 캡슐화: _playMusic은 내부 전용으로 숨기고
// 다른 모듈(ui-manager)/init이 참조하는 심볼만 window에 노출합니다.
(function () {
    /**
     * 사용 가능한 배경음악 트랙 수 (data/background_music_{1..N}.mp3).
     * APP_CONFIG.musicTrackCount와 실제 MP3 파일 수를 맞춘다.
     * 드롭다운과 무작위·다음 곡 선택이 같은 설정값을 사용한다.
     */
    const MUSIC_TRACK_COUNT = APP_CONFIG.musicTrackCount;

    const MUSIC_MODES = ['battle', 'practice', 'hangman', 'shell', 'puzzle'];
    const currentMusicIndices = {
        ...Object.fromEntries(MUSIC_MODES.map((mode) => [mode, null])),
        max: MUSIC_TRACK_COUNT,
    };

    function musicElementIds(mode) {
        const prefix = mode === 'battle' ? '' : `${mode}-`;
        return {
            overlay: `${prefix}music-info-overlay`,
            filename: `${prefix}music-filename`,
            select: `${prefix}music-select`,
        };
    }

    function resumeMusic(bgMusic) {
        bgMusic.play().then(
            () => updateMusicToggleButtons(!bgMusic.paused),
            (error) => {
                dlog('Music play failed:', error);
                updateMusicToggleButtons(!bgMusic.paused);
            }
        );
    }

    /**
     * 특정 배경 음악 트랙을 재생하고 종료 이벤트 리스너를 설정합니다.
     * 내부 헬퍼 함수입니다.
     * @param {number} musicNum 음악 트랙 번호 (1부터 시작)
     * @param {'battle'|'practice'|'hangman'|'shell'|'puzzle'} mode 음악 선택 상태를 보관할 모드
     * @param {boolean} [forcePlay=false] 자동 재생 설정과 관계없이 재생을 시도할지 여부
     */
    function _playMusic(musicNum, mode, forcePlay = false) {
        const bgMusic = document.getElementById('background-music');
        const {
            overlay: overlayId,
            filename: filenameId,
            select: selectId,
        } = musicElementIds(mode);
        const musicInfoOverlay = document.getElementById(overlayId);
        const musicFilenameEl = document.getElementById(filenameId);
        const musicSelectEl = document.getElementById(selectId);

        // 음악 OFF 상태에서도 곡 선택 UI를 준비한다.
        if (!bgMusic || !db.settings) {
            return;
        }
        // 원본 MP3는 그대로 두고 공통 재생 볼륨만 낮춘다.
        bgMusic.volume = APP_CONFIG.musicVolume;

        const filename = `background_music_${musicNum}.mp3`;
        bgMusic.src = `data/${filename}`;
        bgMusic.load();
        updateMusicToggleButtons(false);

        if (musicSelectEl) {
            musicSelectEl.value = String(musicNum);
        }

        // 노래가 재생되거나 변경될 때마다 음악 선택 옵션 렌더링
        ui.renderMusicSelectOptions(selectId, musicNum);

        if (musicInfoOverlay && musicFilenameEl) {
            musicFilenameEl.textContent = `배경음악 ${musicNum}`;
            musicInfoOverlay.style.display = 'block';
        }

        // 첫 진입은 설정을 따르고, 곡이 끝난 뒤 순환할 때는 재생을 이어 간다.
        if (forcePlay || (db.settings && db.settings.musicPlay)) {
            resumeMusic(bgMusic);
        } else {
            updateMusicToggleButtons(false);
        }
        // 다음 음악을 순서대로 재생하도록 onended 이벤트 리스너 설정
        bgMusic.onended = () => {
            playNextMusic(mode);
        };
    }

    /**
     * 모드에서 선택한 곡을 처음부터 준비하고 자동 재생 설정을 적용한다.
     * 첫 진입에는 무작위 곡을 선택한다.
     * @param {'battle'|'practice'|'hangman'|'shell'|'puzzle'} mode 음악 선택 상태를 보관할 모드
     */
    function playMusic(mode) {
        if (!currentMusicIndices[mode]) {
            currentMusicIndices[mode] = Math.floor(Math.random() * MUSIC_TRACK_COUNT) + 1;
        }

        // 범위를 벗어난 값(트랙 수가 줄어든 경우 등)은 1번으로 보정
        if (currentMusicIndices[mode] < 1 || currentMusicIndices[mode] > MUSIC_TRACK_COUNT) {
            currentMusicIndices[mode] = 1;
        }

        _playMusic(currentMusicIndices[mode], mode, false);
    }

    /**
     * 지정된 모드의 다음 배경 음악 트랙을 순서대로 재생합니다.
     * @param {'battle'|'practice'|'hangman'|'shell'|'puzzle'} mode 음악 선택 상태를 보관할 모드
     */
    function playNextMusic(mode) {
        // 1..MUSIC_TRACK_COUNT 를 순환
        const current = currentMusicIndices[mode] || 0;
        currentMusicIndices[mode] = (current % MUSIC_TRACK_COUNT) + 1;

        // 곡이 끝나서 다음 곡으로 넘어가는 경우이므로 forcePlay=true
        _playMusic(currentMusicIndices[mode], mode, true);
    }

    // 음악 직접 선택 이벤트 리스너
    function setupMusicSelectListeners() {
        const audio = document.getElementById('background-music');
        if (audio) {
            audio.onplay = () => updateMusicToggleButtons(true);
            audio.onpause = () => updateMusicToggleButtons(false);
            audio.onerror = () => updateMusicToggleButtons(false);
            updateMusicToggleButtons(!audio.paused);
        }
        const selects = MUSIC_MODES.map((mode) => musicElementIds(mode).select);
        selects.forEach((id) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', (e) => {
                    const musicNum = parseInt(e.target.value, 10);
                    const bgMusic = document.getElementById('background-music');

                    if (!(musicNum >= 1 && musicNum <= MUSIC_TRACK_COUNT)) return;

                    const filename = `background_music_${musicNum}.mp3`;

                    if (bgMusic) {
                        bgMusic.src = `data/${filename}`;
                        bgMusic.load();
                        updateMusicToggleButtons(false);

                        // 텍스트 업데이트
                        const mode =
                            id === 'music-select' ? 'battle' : id.replace('-music-select', '');
                        const { filename: filenameId, overlay: overlayId } = musicElementIds(mode);
                        const musicFilenameEl = document.getElementById(filenameId);
                        if (musicFilenameEl) {
                            musicFilenameEl.textContent = `배경음악 ${musicNum}`;
                        }
                        // 직접 고른 곡은 재생을 시도하고 성공 여부를 ON/OFF에 반영한다.
                        resumeMusic(bgMusic);

                        // 모드 감지 (ID에 따라)
                        currentMusicIndices[mode] = musicNum;

                        // 음악 정보 오버레이 보이기
                        const musicInfoOverlay = document.getElementById(overlayId);
                        if (musicInfoOverlay) musicInfoOverlay.style.display = 'block';

                        bgMusic.onended = () => {
                            playNextMusic(mode);
                        };
                    }
                });
            }
        });

        // 음악 일시정지/재생 버튼 리스너
        const toggleBtns = MUSIC_MODES.map((mode) => `${mode}-music-toggle-btn`);
        toggleBtns.forEach((id) => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', () => {
                    toggleMusic();
                });
            }
        });
    }
    /**
     * 배경 음악 일시정지/재생 토글
     */
    function toggleMusic() {
        const bgMusic = document.getElementById('background-music');
        if (!bgMusic) return;

        // 자동 재생 설정은 유지하고 현재 세션의 재생 상태만 바꾼다.
        if (bgMusic.paused) {
            resumeMusic(bgMusic);
        } else {
            bgMusic.pause();
            updateMusicToggleButtons(false);
        }
    }

    /**
     * 음악 토글 버튼 상태 업데이트 (UI)
     * @param {boolean} isPlaying
     */
    function updateMusicToggleButtons(isPlaying) {
        const toggleBtns = document.querySelectorAll('.music-toggle-btn');
        toggleBtns.forEach((btn) => {
            btn.textContent = isPlaying ? '⏸️' : '▶️';
            btn.dataset.musicState = isPlaying ? 'on' : 'off';
            btn.setAttribute('aria-pressed', String(isPlaying));
            const label = isPlaying ? '배경음악 ON, 끄기' : '배경음악 OFF, 켜기';
            btn.setAttribute('aria-label', label);
            btn.title = label;
        });
    }

    // 공개 API 노출 (_playMusic은 내부 전용)
    window.MUSIC_TRACK_COUNT = MUSIC_TRACK_COUNT;
    window.currentMusicIndices = currentMusicIndices;
    window.playMusic = playMusic;
    window.playNextMusic = playNextMusic;
    window.setupMusicSelectListeners = setupMusicSelectListeners;
    window.toggleMusic = toggleMusic;
    window.updateMusicToggleButtons = updateMusicToggleButtons;
})();
