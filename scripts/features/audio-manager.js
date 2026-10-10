// IIFE 캡슐화: _playMusic은 내부 전용으로 숨기고
// 다른 모듈(ui-manager)/init이 참조하는 심볼만 window에 노출합니다.
(function () {
    /**
     * 사용 가능한 배경음악 트랙 수 (data/background_music_{1..N}.mp3).
     * 파일을 추가/삭제하면 이 상수만 바꾸면 됩니다 — 드롭다운 렌더링(ui-manager)과
     * 랜덤/다음 곡 선택이 모두 이 값 하나를 참조합니다.
     */
    const MUSIC_TRACK_COUNT = APP_CONFIG.musicTrackCount;

    const MUSIC_MODES = ['battle', 'practice', 'hangman', 'shell'];
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
     * @param {string} mode 'battle' | 'practice' | 'hangman'
     * @param {boolean} forcePlay 강제 재생 여부 (기본 false)
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

        // [FIX] 설정이 꺼져있어도 UI는 나와야 하므로 여기서 리턴하지 않음
        if (!bgMusic || !db.settings) {
            return;
        }

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
            musicFilenameEl.innerText = `배경음악 ${musicNum}`;
            musicInfoOverlay.style.display = 'block';
        }

        // [FIX] 설정에 따라 자동 재생 여부 결정
        // forcePlay가 true이면(예: 이전 곡이 끝나서 넘어옴) 무조건 재생
        if (forcePlay || (db.settings && db.settings.musicPlay)) {
            resumeMusic(bgMusic);
        } else {
            updateMusicToggleButtons(false);
        }
        // else: 설정이 꺼져있으면 정지 상태로 시작 (UI는 표시됨)

        // 다음 음악을 순서대로 재생하도록 onended 이벤트 리스너 설정
        bgMusic.onended = () => {
            playNextMusic(mode);
        };
    }

    /**
     * 지정된 모드의 배경 음악 재생을 시작합니다 (현재 인덱스부터).
     * 이미 음악이 재생 중이면 계속 재생합니다.
     * @param {string} mode 'battle' | 'practice' | 'hangman'
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
     * @param {string} mode 'battle' | 'practice' | 'hangman'
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
                            musicFilenameEl.innerText = `배경음악 ${musicNum}`;
                        }
                        // 플레이 (자동 재생 방지 예외 처리)
                        // [FIX] 여기서도 db.settings.musicPlay를 쓰거나, 아니면 사용자가 직접 바꿨으니 무조건 재생?
                        // 보통 직접 곡을 바꾸면 재생을 의도한 것이므로 재생 시도 + 버튼 상태 업데이트
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

        // [FIX] 설정값(db.settings.musicPlay)을 덮어쓰지 않고,
        // 현재 세션의 재생 상태만 토글함.
        if (bgMusic.paused) {
            resumeMusic(bgMusic);
        } else {
            bgMusic.pause();
            updateMusicToggleButtons(false);
        }
        // db.save(); // 제거: 영구 저장 안 함
    }

    /**
     * 음악 토글 버튼 상태 업데이트 (UI)
     * @param {boolean} isPlaying
     */
    function updateMusicToggleButtons(isPlaying) {
        const toggleBtns = document.querySelectorAll('.music-toggle-btn');
        toggleBtns.forEach((btn) => {
            btn.innerText = isPlaying ? '⏸️' : '▶️';
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
