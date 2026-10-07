function resolveStoryData(day) {
    const catalog = typeof dayCatalog !== 'undefined' ? dayCatalog : null;

    // dayCatalog에 항목이 있으면 그대로 사용 ('boss'/'all'도 동일 경로로 처리됨)
    const entry = catalog && catalog[day];
    if (entry && entry.story) return entry.story;

    // 없으면 <option> 텍스트에서 제목 추출해 최소 형태를 합성
    const opt = Array.from(document.getElementById('day-select')?.options || []).find(
        (option) => option.value === String(day)
    );
    const allStory = (catalog && catalog['all'] && catalog['all'].story) || null;
    const optText = opt
        ? opt.textContent
        : day === 'all'
          ? catalog && catalog['all'] && catalog['all'].label
          : `Day ${day}`;

    return {
        title: optText,
        intro: `선택한 지역 — ${optText}`,
        win: (allStory && allStory.win) || '',
        lose: (allStory && allStory.lose) || '',
    };
}

/**
 * 스토리 관리 시스템
 * 게임 스토리 인트로 및 엔딩 화면 관리
 */

const story = {
    day: null,
    mode: null,

    /**
     * 보스 모드: 스토리 모달 없이 바로 게임 시작
     */
    startBossDirectly: () => {
        if (game.active || game.isProcessing) return;
        story.mode = 'boss';
        story.day = 'boss';
        db.lastSelectedDay = 'boss';
        db.save('lastDay');
        const startScreen = document.getElementById('title-screen');
        if (startScreen) {
            startScreen.style.display = 'flex';
        }
        game.init('boss', 'boss');
    },

    /**
     * 스토리 인트로를 시작합니다
     * @param {string} mode - 게임 모드 ('battle', 'boss', 'practice')
     * @param {string} dayArg - Day 값
     */
    startIntro: (mode, dayArg) => {
        if (mode === 'boss') {
            story.startBossDirectly();
            return;
        }
        const daySel = dayArg || document.getElementById('day-select').value;
        dlog('[story.startIntro] mode=', mode, 'dayArg=', dayArg, 'resolvedDay=', daySel);
        db.lastSelectedDay = daySel;
        db.save('lastDay');
        story.day = mode === 'boss' ? 'boss' : daySel;
        story.mode = mode;
        const data = resolveStoryData(story.day);

        // 배틀만 이야기 카드를 거친다.
        const storyScreenId = 'battle-mode-story-modal';
        const storyScreenPrefix = 'battle-mode';

        dlog('[story.startIntro] day=', story.day, 'title=', data.title);

        // 스토리 모달 제목은 짧게 표시한다 (dayCatalog의 "Day 5 (부제)" 형태가 아니라 "Day 5")
        let displayTitle;
        if (story.day === 'all') displayTitle = '전체';
        else if (story.day === 'boss') displayTitle = '보스 모드';
        else if (!isNaN(Number(story.day))) displayTitle = `Day ${story.day}`;
        else displayTitle = story.day;

        const startScreen = document.getElementById('title-screen');
        if (startScreen) {
            startScreen.style.display = 'flex';
        }

        // 이전 실행의 닫기 타이머와 표시 상태를 정리한다.
        resetScreenOverlay(storyScreenId);
        openScreenOverlay(storyScreenId, true);

        const storyStartBtn = document.getElementById('battle-mode-start-btn');

        // Day 정보 표시
        const dayInfoEl = document.getElementById(`${storyScreenPrefix}-day-info`);
        if (dayInfoEl) {
            dayInfoEl.innerText = displayTitle;
        }

        // 이야기 텍스트 표시
        const textEl = document.getElementById(`${storyScreenPrefix}-text`);
        if (textEl) {
            let introText = data.intro || '';
            textEl.innerText = introText;
        }

        // "모험시작" 버튼에 이벤트 연결 (버튼당 1회만)
        if (storyStartBtn) {
            story._bindStartButton(storyStartBtn);
        } else {
            console.warn(`${storyScreenPrefix}-start-btn not found`);
        }
    },

    /**
     * "모험시작" 버튼 클릭 핸들러.
     * story.mode/story.day를 읽으므로 클로저가 필요 없고, 따라서 버튼당 한 번만 바인딩하면 됩니다.
     */
    _onStartClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        dlog('Story start button clicked');

        if (game.isProcessing) {
            dlog('[startGame] 게임 오버 처리 중이므로 시작하지 않음');
            return;
        }

        // startIntro가 story.day를 이미 확정해 둠 (boss면 'boss')
        dlog('[story-btn] day=', story.day, 'mode=', story.mode);
        // 연습 모드는 스토리 모달을 거치지 않고 practiceMemorization.start()로
        // 직접 진입하므로 여기 도달하는 mode는 'battle' 또는 'boss'뿐이다.
        game.init(story.mode, story.day);
    },

    /**
     * 시작 버튼에 리스너를 1회만 붙입니다.
     *
     * 이전에는 리스너 중복을 막으려고 cloneNode로 노드를 통째 교체했지만,
     * 핸들러가 클로저를 쓰지 않게 바꾼 지금은 플래그 하나로 충분합니다.
     * (노드 교체는 다른 곳에서 잡아둔 참조를 무효화하는 부작용도 있었습니다.)
     * @param {HTMLElement} btn
     */
    _bindStartButton: (btn) => {
        if (btn.dataset.startBound) return;
        btn.addEventListener('click', story._onStartClick, { capture: true });
        btn.dataset.startBound = 'true';
    },

    /**
     * 엔딩 화면을 표시합니다
     * @param {boolean} win - 승리 여부
     */
    showEnding: (win) => {
        // 게임 타이머 정지
        if (game.timer) {
            clearInterval(game.timer);
            game.timer = null;
        }

        // 배경음악 정지
        const bgMusic = document.getElementById('background-music');
        if (bgMusic && !bgMusic.paused) {
            bgMusic.pause();
        }

        // 게임 오버 상태로 설정
        game.isProcessing = true;

        document.getElementById('battle-mode-game').style.display = 'none';

        // 결과 화면으로 이동 (스토리/모드 선택 오버레이 정리는 game.end가 담당)
        game.end(win);
    },
};
