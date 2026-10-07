// 메인 애플리케이션 진입점
// 런타임 의존성 조립은 app.js가 소유한다.

let pendingGameStart = null;
function cancelPendingGameStart() {
    clearTimeout(pendingGameStart);
    pendingGameStart = null;
}
function scheduleGameStart(callback) {
    cancelPendingGameStart();
    pendingGameStart = setTimeout(() => {
        pendingGameStart = null;
        callback();
    }, APP_CONFIG.overlayCloseMs);
}

/**
 * data-action 속성 → 핸들러 매핑.
 *
 * index.html의 인라인 `onclick="secret.enter(1)"` 같은 문자열을 대체합니다.
 * 인라인 핸들러는 전역 이름에 하드코딩으로 묶이고, 값 보간 시 따옴표가 깨질 수 있으며,
 * 마크업과 동작이 분리되지 않습니다(spec §1.3).
 *
 * 각 핸들러는 클릭된 요소를 인자로 받으므로 data-* 속성으로 값을 전달할 수 있습니다.
 */
const ACTION_HANDLERS = {
    'route-exit': () => game.exit(),
    'revenge-open': () => revengeQuests.open(),
    'revenge-close': () => revengeQuests.close(),
    'revenge-start': () => revengeQuests.start(),
    'fullscreen-toggle': () => toggleFullscreen(),
    'boss-submit': () => game.checkBossAnswer(),
    'battle-listen': () => game.listen(),
    'battle-listen-fallback': () => game.fallbackListening(),
    'battle-spelling-remove': () => game.removeSpellingLetter(),
    'battle-spelling-clear': () => game.clearSpelling(),
    'story-back': () => navigation.back(),

    'shop-open': () => shop.open(),
    'shop-close': () => shop.close(),

    'inventory-open': () => inventory.open(),
    'inventory-close': () => inventory.close(),
    'inventory-hide-details': () => inventory.hideDetails(),
    'inventory-unequip': (el) => inventory.unequip(el.dataset.slot),

    'statistics-close': () => statistics.close(),
    'result-close': () => closeResultScreen(),
    'result-review': () => practiceMemorization.reviewWrongWords(),

    'secret-enter': (el) => secret.enter(Number(el.dataset.digit)),
    'secret-del': () => secret.del(),
    'secret-close': () => secret.close(),
    'secret-reset-statistics': () => secret.resetStatistics(),
    'secret-gold-edit-open': () => secret.openGoldEditModal(),
    'secret-gold-edit-close': () => secret.closeGoldEditModal(),
    'secret-gold-edit-apply': () => secret.applyGoldEdit(),
    'secret-print-open': () => secret.openPrintDaySelect(),
    'secret-print-close': () => secret.closePrintDaySelect(),
    'secret-print-generate': () => secret.generatePrintHTML(),
};

/**
 * data-action을 가진 요소의 클릭을 문서 레벨에서 한 번만 위임 처리합니다.
 * 동적으로 추가되는 요소도 별도 바인딩 없이 동작합니다.
 */
function setupActionDelegation() {
    document.addEventListener('click', (e) => {
        const el = e.target.closest('[data-action]');
        if (!el) return;

        const handler = ACTION_HANDLERS[el.dataset.action];
        if (!handler) {
            console.warn('[action] 알 수 없는 data-action:', el.dataset.action);
            return;
        }
        handler(el);
    });
}

/**
 * 윈도우 로드 이벤트 핸들러
 * 게임 환경, 이벤트 리스너 및 UI 컴포넌트를 초기화합니다.
 */
window.onload = () => {
    // 최초 로드 시 뷰포트 높이를 고정 (모바일 주소창 대응)
    initAppHeight();
    initFullscreenControls();
    navigation.init();
    document.documentElement.style.setProperty(
        '--overlay-close-duration',
        `${APP_CONFIG.overlayCloseMs}ms`
    );
    document.getElementById('background-music').volume = 0.5;

    // 모든 데이터 로드 후 dayCatalog 커버리지 검증
    if (typeof dayCatalog !== 'undefined' && typeof dayCatalog.validateCoverage === 'function') {
        dayCatalog.validateCoverage();
    }

    // data-action 위임 리스너 (인라인 onclick 대체)
    setupActionDelegation();

    // 핵심 시스템 초기화
    if (typeof secret !== 'undefined') secret.init();
    if (typeof settingsManager !== 'undefined') settingsManager.init();
    setupMusicSelectListeners();
    if (typeof inventory !== 'undefined') inventory.render();
    initSelections();
    ui.updateGold();
    revengeQuests.refresh();

    syncScreenLayout();

    rotateGameTitle();

    // 회전과 데스크톱 창 크기 변경에 대응하며 모바일 주소창/키보드는 높이를 유지한다.
    let lastWidth = window.innerWidth;
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            const newWidth = window.innerWidth;
            const desktopResize = window.matchMedia?.('(pointer: fine)').matches;
            const editing = document.activeElement?.matches('input, textarea, [contenteditable]');
            if (Math.abs(newWidth - lastWidth) > 1 || (desktopResize && !editing)) {
                lastWidth = newWidth;
                initAppHeight(true);
                syncScreenLayout();
            }
        }, 100);
    });

    // --- 이벤트 리스너 ---

    // 제목 메뉴는 같은 이벤트 정책을 사용한다.
    const titleActions = {
        'title-practice-btn': openPracticeModal,
        'title-battle-mode-btn': openBattleModeModal,
        'title-boss-mode-btn': () => story.startBossDirectly(),
        'title-shop-btn': () => shop.open(),
        'title-inventory-btn': () => inventory.open(),
        'title-statistics-btn': () => statistics.open(),
        'title-setting-btn': () => settingsManager.open(),
    };
    Object.entries(titleActions).forEach(([id, action]) => {
        document.getElementById(id)?.addEventListener('click', action);
    });

    // 연습 모드 모달 버튼
    const practiceStartBtn = document.getElementById('practice-mode-modal-start-btn');
    const practiceCancelBtn = document.getElementById('practice-mode-modal-cancel-btn');
    const practiceDaySelect = document.getElementById('practice-mode-modal-day-select');

    if (practiceStartBtn) {
        practiceStartBtn.addEventListener('click', () => {
            const selectedDay = practiceDaySelect ? practiceDaySelect.value : 'all';

            db.lastSelectedDay = selectedDay;
            db.save();

            const daySelect = document.getElementById('day-select');
            if (daySelect) daySelect.value = selectedDay;

            const startScreen = document.getElementById('title-screen');
            if (startScreen) startScreen.style.display = 'none';

            closePracticeModal(true);

            scheduleGameStart(() => {
                practiceMemorization.start(selectedDay);
            });
        });
    }

    if (practiceCancelBtn) {
        practiceCancelBtn.addEventListener('click', () => {
            closePracticeModal();
        });
    }

    // 연습 모드 인터페이스 버튼
    const practicePrevBtn = document.getElementById('practice-prev-btn');
    const practiceNextBtn = document.getElementById('practice-next-btn');
    const practiceExitBtn = document.getElementById('practice-exit-btn');
    const practiceMemorizedBtn = document.getElementById('practice-memorized-btn');
    const practiceSpeakBtn = document.getElementById('practice-speak-btn');
    const practiceFilterChips = document.getElementById('practice-filter-chips');
    const practiceExplanationSection = document.getElementById('practice-explanation-section');

    if (practicePrevBtn)
        practicePrevBtn.addEventListener('click', () => practiceMemorization.prev()); // Converted to .prev() from .prevWord()
    if (practiceNextBtn)
        practiceNextBtn.addEventListener('click', () => practiceMemorization.next()); // Converted to .next() from .nextWord()
    if (practiceExitBtn)
        practiceExitBtn.addEventListener('click', () => practiceMemorization.exit());

    // 참고: 기존 코드를 practice-mode.js의 메서드(`playTTS`, `toggleExplanationLang`) 호출로 변경함
    // 기존 호출과 일치하도록 업데이트됨.

    if (practiceSpeakBtn)
        practiceSpeakBtn.addEventListener('click', () => practiceMemorization.playTTS());

    if (practiceMemorizedBtn) {
        practiceMemorizedBtn.addEventListener('click', () => {
            practiceMemorization.toggleMemorized();
        });
    }

    if (practiceFilterChips) {
        practiceFilterChips.addEventListener('click', (e) => {
            const chip = e.target.closest('.practice-chip');
            if (!chip || practiceMemorization.fullPool.length === 0) return;
            const filter = chip.getAttribute('data-filter');
            if (filter) practiceMemorization.applyFilter(filter);
        });
    }

    if (practiceExplanationSection) {
        practiceExplanationSection.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                practiceMemorization.toggleExplanationLang();
            }
        });
        practiceExplanationSection.addEventListener('click', () => {
            practiceMemorization.toggleExplanationLang();
        });
    }

    document.addEventListener('keydown', (event) => {
        if (document.getElementById('practice-mode-game').style.display === 'none') return;
        if (event.target.closest('input, select, textarea, button, [role="button"]')) return;
        if (event.key === 'ArrowLeft') practiceMemorization.prev();
        else if (event.key === 'ArrowRight') practiceMemorization.next();
        else if (event.key === ' ') {
            event.preventDefault();
            practiceMemorization.toggleAnswer();
        }
    });

    // 배틀 모드 나가기 버튼
    const battleExitBtn = document.getElementById('battle-exit-btn');
    if (battleExitBtn) {
        battleExitBtn.addEventListener('click', () => {
            game.exit();
        });
    }

    // 배틀 모달 버튼
    const battleStartBtn = document.getElementById('battle-mode-modal-start-btn');
    const battleCancelBtn = document.getElementById('battle-mode-modal-cancel-btn');
    const battleDaySelect = document.getElementById('battle-mode-modal-day-select');
    const battleCountSelect = document.getElementById('battle-mode-modal-count-select');

    if (battleStartBtn) {
        battleStartBtn.addEventListener('click', () => {
            const selectedDay = battleDaySelect ? battleDaySelect.value : 'all';
            const countValue = battleCountSelect ? battleCountSelect.value : '10';
            const selectedCount = countValue === 'all' ? 'all' : parseInt(countValue) || 10;

            let selectedQuestionType = 'monsters';
            const questionTypeGroup = document.getElementById(
                'battle-mode-modal-question-type-group'
            );
            if (questionTypeGroup) {
                const checkedRadio = questionTypeGroup.querySelector(
                    'input[name="battle-question-type"]:checked'
                );
                if (checkedRadio) selectedQuestionType = checkedRadio.value;
            }
            gameStorage.set('v7_last_question_type', selectedQuestionType);
            db.lastSelectedDay = selectedDay;
            gameStorage.set('v7_last_count', selectedCount);
            db.save();

            game.battleQuestionType = selectedQuestionType;

            const daySelect = document.getElementById('day-select');
            const countSelect = document.getElementById('count-select');
            if (daySelect) daySelect.value = selectedDay;
            if (countSelect) countSelect.value = String(selectedCount);

            const startScreen = document.getElementById('title-screen');
            if (startScreen) startScreen.style.display = 'none';

            closePracticeModal(true); // Helper acts for both practice and battle modals

            scheduleGameStart(() => {
                story.startIntro('battle', selectedDay);
            });
        });
    }

    if (battleCancelBtn) {
        battleCancelBtn.addEventListener('click', () => {
            closePracticeModal();
        });
    }

    // 전역: 결과 화면 닫기 함수
    window.closeResultScreen = function () {
        closeScreenOverlay('result-modal', true);

        // 스토리/모드 선택 오버레이의 인라인 스타일을 CSS 기본값으로 되돌림
        resetScreenOverlays(GAME_ENTRY_OVERLAYS);

        const gameScreen = document.getElementById('battle-mode-game');
        if (gameScreen) gameScreen.style.display = 'none';

        openScreenOverlay('title-screen', false);
        syncScreenLayout();
    };

    document
        .getElementById('practice-reveal-btn')
        ?.addEventListener('click', () => practiceMemorization.toggleAnswer());
};
