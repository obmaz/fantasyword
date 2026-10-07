/**
 * 통계 시스템
 * 게임 통계 UI 렌더링 및 관리
 *
 * 통계 데이터의 구조/저장은 database.js가 소유합니다.
 * 이 모듈은 db.getBookStats()가 준 값을 표시만 합니다.
 */

const statistics = {
    /**
     * 통계 모달을 엽니다
     */
    open: () => {
        // title-screen은 숨기지 않고 모달만 표시
        openScreenOverlay('statistics-modal', true);

        statistics.render();
    },

    /**
     * 통계 모달을 닫습니다
     */
    close: () => {
        navigation.track('title-screen');
        closeScreenOverlay('statistics-modal', true);
        // title-screen은 이미 표시되어 있으므로 다시 표시할 필요 없음
    },

    /**
     * "해결 / 정답률 / 정답 / 오답" 2줄 블록을 만듭니다
     * @param {number} solved - 푼 문제 수
     * @param {number} correct - 맞힌 문제 수
     * @returns {string} HTML 문자열
     */
    _statBlock: (solved, correct) => {
        const rate = solved > 0 ? Math.round((correct / solved) * 100) : 0;
        const wrong = solved - correct;
        return `<div class="statistics-item">
            <div class="statistics-stat-group">
                <div class="statistics-stat-row">
                    <span class="stat-metric"><b>푼 문제 </b><span class="statistics-value">${formatMenuNumber(solved)}개</span></span>
                    <span class="stat-metric"><b class="statistics-label">정답률: </b><span class="statistics-value">${rate}%</span></span>
                </div>
                <div class="statistics-stat-row">
                    <span class="stat-metric"><b>정답 </b><span class="statistics-value statistics-value-correct">${formatMenuNumber(correct)}개</span></span>
                    <span class="stat-metric"><b class="statistics-label">오답 </b><span class="statistics-value statistics-value-wrong">${formatMenuNumber(wrong)}개</span></span>
                </div>
                <div class="statistics-progress" role="progressbar" aria-label="정답률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${rate}"><span style="width: ${rate}%"></span></div>
            </div>
        </div>`;
    },

    /**
     * 현재 단어장 이름을 모달 헤더에 표시합니다
     * (통계의 저장 키는 데이터셋 ID지만, 표시는 사람이 읽는 이름으로 합니다)
     */
    _renderBookInfo: () => {
        const modalHeader = document.querySelector('#statistics-modal .modal-header');
        if (!modalHeader) return;

        const existing = modalHeader.querySelector('.statistics-book-info');
        if (existing) existing.remove();

        const bookInfo = document.createElement('div');
        bookInfo.className = 'statistics-book-info';
        bookInfo.textContent = window.currentGameDataName || '기본 단어장';
        modalHeader.appendChild(bookInfo);
    },

    /**
     * 통계 UI를 렌더링합니다
     */
    render: () => {
        const container = document.getElementById('statistics-container');
        container.innerHTML = '';

        statistics._renderBookInfo();

        // 현재 활성 데이터셋의 통계 (없으면 database.js가 만들어 반환)
        const bookStats = db.getBookStats();
        const objective = bookStats.objective;
        const subjective = bookStats.subjective;

        let html = '';

        // 게임 통계
        html += '<div class="statistics-section statistics-section-major">전체 기록</div>';
        html += statistics._statBlock(bookStats.solved || 0, bookStats.correct || 0);

        // 객관식 통계
        html += '<div class="statistics-section">객관식</div>';
        html += statistics._statBlock(objective.solved || 0, objective.correct || 0);

        // 주관식 통계
        html += '<div class="statistics-section">주관식</div>';
        html += statistics._statBlock(subjective.solved || 0, subjective.correct || 0);

        // 주관식을 전부 맞춘 날
        html += '<div class="statistics-section">주관식 전부 맞춘 날</div>';
        const perfectDays = [...(subjective.perfectDays || [])].sort((a, b) =>
            a.date.localeCompare(b.date)
        );
        if (perfectDays.length === 0) {
            html += `<div class="statistics-item">
                <div class="statistics-stat-group">
                    <div class="statistics-stat-row"><span class="statistics-value">없음</span></div>
                </div>
            </div>`;
        } else {
            perfectDays.forEach((perfect) => {
                const label = perfect.dayLabel || '';
                html += `<div class="statistics-item">
                    <div class="statistics-stat-group">
                        <div class="statistics-stat-row"><span class="statistics-value">${escapeHTML(perfect.displayDate || perfect.date)}</span></div>
                        ${label ? `<div class="statistics-stat-row"><b>${escapeHTML(label)}</b></div>` : ''}
                    </div>
                </div>`;
            });
        }

        // 보스 모드 최고 wave 기록
        const bossMode = bookStats.bossMode;
        const bestWaveDate = bossMode.bestWaveDate
            ? bossMode.bestWaveDate.displayDate
            : '기록 없음';
        html += '<div class="statistics-section statistics-section-major">최고 Wave</div>';
        html += `<div class="statistics-item">
            <div class="statistics-stat-group">
                <div class="statistics-stat-row">
                    <b>Wave: </b><span class="statistics-value statistics-value-wave">${bossMode.bestWave || 0}</span>
                    <b class="statistics-label">날짜: </b><span class="statistics-value">${escapeHTML(bestWaveDate)}</span>
                </div>
            </div>
        </div>`;

        container.innerHTML = html;
    },
};
