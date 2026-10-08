/** 출력 문제지 생성/다운로드. 관리자 비밀번호와 상태 전환은 admin-tools가 소유한다. */
const worksheet = {
    generate: () => {
        const daySelect = document.getElementById('print-day-select');
        const selectedDay = daySelect ? daySelect.value : '';

        if (!selectedDay) {
            showToast('Day를 선택해주세요.', 'warn');
            return;
        }

        // 라디오 버튼에서 선택된 문제 타입 확인
        const questionTypeRadio = document.querySelector(
            'input[name="print-question-type"]:checked'
        );
        const questionType = questionTypeRadio ? questionTypeRadio.value : 'mixed';

        // 현재 데이터셋의 rawData 사용
        const currentRawData =
            typeof window !== 'undefined' && window.rawDataData ? window.rawDataData : rawData;
        const dayNum = Number(selectedDay);
        // 먼저 사본을 섞고 중복을 제거한다. 한 묶음 안에서도 같은 문제가 반복되지 않는다.
        const seenWords = new Set();
        const seenMeanings = new Set();
        const dayWords = questionTools
            .shuffle(currentRawData.filter((i) => Number(i.day) === dayNum))
            .filter((item) => {
                const word = String(item.word).trim().toLowerCase();
                const meaning = String(item.meaning).trim();
                if (seenWords.has(word) || seenMeanings.has(meaning)) return false;
                seenWords.add(word);
                seenMeanings.add(meaning);
                return true;
            });

        if (dayWords.length === 0) {
            showToast('선택한 Day에 단어가 없습니다.', 'warn');
            return;
        }

        // 단어를 섞기 — game.shuffle(Fisher–Yates, 사본 반환)을 재사용한다.
        // sort(() => Math.random() - 0.5)는 균등 분포가 아니라 정답 보기 위치가 치우친다.
        const shuffle = (arr) => questionTools.shuffle(arr);

        // 문제 생성 로직 함수들 (admin-tools 내부 헬퍼)
        const createObjectiveQuestion = (item, isKoEn) => {
            const key = isKoEn ? 'word' : 'meaning';
            const correctValue = item[key];
            const distractors = questionTools.getDistractors(
                correctValue,
                key,
                item,
                currentRawData,
                window.getDecoyWordCandidates
            );
            if (distractors.length < 3) return createSubjectiveQuestion(item, isKoEn);
            const options = shuffle([correctValue, ...distractors]);
            const correctIndex = options.indexOf(correctValue);
            const type = isKoEn ? 'objective-ko-en' : 'objective-en-ko';

            if (correctIndex === -1) {
                options[0] = correctValue;
                return { type, item, options, correctIndex: 0 };
            }
            return { type, item, options, correctIndex };
        };

        const createSubjectiveQuestion = (item, isKoEn) => {
            return { type: isKoEn ? 'ko-en' : 'en-ko', item };
        };

        // 문제 타입에 따라 문제 생성
        const maxQuestions = Math.min(dayWords.length, APP_CONFIG.printMaxQuestions);
        const leftQuestions = [];
        const rightQuestions = [];

        // 사용된 단어 추적 (중복 방지용)
        const usedWords = new Set(); // word와 meaning을 모두 추적

        // 단어가 이미 사용되었는지 확인
        const isWordUsed = (item) => {
            return usedWords.has(item.word) || usedWords.has(item.meaning);
        };

        // 단어를 사용된 것으로 표시
        const markWordAsUsed = (item) => {
            usedWords.add(item.word);
            usedWords.add(item.meaning);
        };

        // 사용 가능한 단어 필터링
        const getAvailableWords = (words) => {
            return words.filter((item) => !isWordUsed(item));
        };

        if (questionType === 'mixed') {
            // 혼합형: 좌측 객관식, 우측 주관식 (50%씩)
            const objectiveCount = Math.floor(maxQuestions / 2);
            const subjectiveCount = maxQuestions - objectiveCount;

            // 좌측: 객관식 문제
            let availableWords = getAvailableWords(shuffle([...dayWords]));
            const objectiveWords = availableWords.slice(0, objectiveCount);
            objectiveWords.forEach((item) => markWordAsUsed(item));

            const objHalf = Math.ceil(objectiveWords.length / 2);
            objectiveWords.slice(0, objHalf).forEach((item, idx) => {
                leftQuestions.push({ ...createObjectiveQuestion(item, true), num: idx + 1 });
            });
            objectiveWords.slice(objHalf).forEach((item, idx) => {
                leftQuestions.push({
                    ...createObjectiveQuestion(item, false),
                    num: objHalf + idx + 1,
                });
            });

            // 우측: 주관식 문제 (이미 사용된 단어 제외)
            availableWords = getAvailableWords(shuffle([...dayWords]));
            const subjectiveWords = availableWords.slice(0, subjectiveCount);
            subjectiveWords.forEach((item) => markWordAsUsed(item));

            const subHalf = Math.ceil(subjectiveWords.length / 2);
            const rightStartNum = leftQuestions.length + 1;
            subjectiveWords.slice(0, subHalf).forEach((item, idx) => {
                rightQuestions.push({
                    ...createSubjectiveQuestion(item, true),
                    num: rightStartNum + idx,
                });
            });
            subjectiveWords.slice(subHalf).forEach((item, idx) => {
                rightQuestions.push({
                    ...createSubjectiveQuestion(item, false),
                    num: rightStartNum + subHalf + idx,
                });
            });
        } else if (questionType === 'objective') {
            // 객관식만: 좌우 모두 객관식
            let availableWords = getAvailableWords(shuffle([...dayWords]));
            const words = availableWords.slice(0, maxQuestions);
            words.forEach((item) => markWordAsUsed(item));

            const leftHalf = Math.floor(words.length / 2);

            // 좌측: words의 절반
            const leftWords = words.slice(0, leftHalf);
            const leftKoEnCount = Math.ceil(leftWords.length / 2);
            leftWords.slice(0, leftKoEnCount).forEach((item, idx) => {
                leftQuestions.push({ ...createObjectiveQuestion(item, true), num: idx + 1 });
            });
            leftWords.slice(leftKoEnCount).forEach((item, idx) => {
                leftQuestions.push({
                    ...createObjectiveQuestion(item, false),
                    num: leftKoEnCount + idx + 1,
                });
            });

            // 우측: words의 나머지 절반
            const rightWordsFromLeft = words.slice(leftHalf);
            const rightKoEnCount = Math.ceil(rightWordsFromLeft.length / 2);
            const rightStartNum = leftQuestions.length + 1;
            rightWordsFromLeft.slice(0, rightKoEnCount).forEach((item, idx) => {
                rightQuestions.push({
                    ...createObjectiveQuestion(item, true),
                    num: rightStartNum + idx,
                });
            });
            rightWordsFromLeft.slice(rightKoEnCount).forEach((item, idx) => {
                rightQuestions.push({
                    ...createObjectiveQuestion(item, false),
                    num: rightStartNum + rightKoEnCount + idx,
                });
            });
        } else if (questionType === 'subjective') {
            // 주관식만: 좌우 모두 주관식
            let availableWords = getAvailableWords(shuffle([...dayWords]));
            const words = availableWords.slice(0, maxQuestions);
            words.forEach((item) => markWordAsUsed(item));

            const leftHalf = Math.floor(words.length / 2);

            // 좌측: words의 절반
            const leftWords = words.slice(0, leftHalf);
            const leftKoEnCount = Math.ceil(leftWords.length / 2);
            leftWords.slice(0, leftKoEnCount).forEach((item, idx) => {
                leftQuestions.push({ ...createSubjectiveQuestion(item, true), num: idx + 1 });
            });
            leftWords.slice(leftKoEnCount).forEach((item, idx) => {
                leftQuestions.push({
                    ...createSubjectiveQuestion(item, false),
                    num: leftKoEnCount + idx + 1,
                });
            });

            // 우측: words의 나머지 절반
            const rightWordsFromLeft = words.slice(leftHalf);
            const rightKoEnCount = Math.ceil(rightWordsFromLeft.length / 2);
            const rightStartNum = leftQuestions.length + 1;
            rightWordsFromLeft.slice(0, rightKoEnCount).forEach((item, idx) => {
                rightQuestions.push({
                    ...createSubjectiveQuestion(item, true),
                    num: rightStartNum + idx,
                });
            });
            rightWordsFromLeft.slice(rightKoEnCount).forEach((item, idx) => {
                rightQuestions.push({
                    ...createSubjectiveQuestion(item, false),
                    num: rightStartNum + rightKoEnCount + idx,
                });
            });
        }

        // Day 정보 가져오기
        const dayLabel =
            typeof dayCatalog !== 'undefined' &&
            dayCatalog[selectedDay] &&
            dayCatalog[selectedDay].label
                ? dayCatalog[selectedDay].label
                : `Day ${selectedDay}`;

        // 총 문제 수 계산
        const totalQuestionCount = leftQuestions.length + rightQuestions.length;

        // 문제 페이지 HTML 생성 (좌우 2열)
        let questionsHTML = '<div class="print-columns">';
        let answersHTML = '<div class="print-columns">';

        for (const questions of [leftQuestions, rightQuestions]) {
            questionsHTML += '<div class="print-column">';
            answersHTML += '<div class="print-column">';
            questions.forEach((q) => {
                if (q.type.startsWith('objective')) {
                    // 객관식
                    const isKoEn = q.type === 'objective-ko-en';
                    const questionText = isKoEn ? q.item.meaning : q.item.word;
                    const optionLabels = ['①', '②', '③', '④'];

                    let qHTML = `
                    <div class="print-question">
                        <div class="question-number">${q.num}.</div>
                        <div class="question-content">
                            <div class="question-text">${escapeHTML(questionText)}</div>
                            <div class="objective-options">
                                <div class="option-row">
                                    <div class="option-item">${optionLabels[0]} ${escapeHTML(q.options[0])}</div>
                                    <div class="option-item">${optionLabels[1]} ${escapeHTML(q.options[1])}</div>
                                </div>
                                <div class="option-row">
                                    <div class="option-item">${optionLabels[2]} ${escapeHTML(q.options[2])}</div>
                                    <div class="option-item">${optionLabels[3]} ${escapeHTML(q.options[3])}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                    questionsHTML += qHTML;

                    let aHTML = `
                    <div class="print-question">
                        <div class="question-number">${q.num}.</div>
                        <div class="question-content">
                            <div class="question-text">${escapeHTML(questionText)}</div>
                            <div class="objective-options">
                                <div class="option-row">
                                    <div class="option-item ${q.correctIndex === 0 ? 'correct' : ''}">${optionLabels[0]} <span class="${q.correctIndex === 0 ? 'correct-underline' : ''}">${escapeHTML(q.options[0])}</span>${q.correctIndex === 0 ? ' ✓' : ''}</div>
                                    <div class="option-item ${q.correctIndex === 1 ? 'correct' : ''}">${optionLabels[1]} <span class="${q.correctIndex === 1 ? 'correct-underline' : ''}">${escapeHTML(q.options[1])}</span>${q.correctIndex === 1 ? ' ✓' : ''}</div>
                                </div>
                                <div class="option-row">
                                    <div class="option-item ${q.correctIndex === 2 ? 'correct' : ''}">${optionLabels[2]} <span class="${q.correctIndex === 2 ? 'correct-underline' : ''}">${escapeHTML(q.options[2])}</span>${q.correctIndex === 2 ? ' ✓' : ''}</div>
                                    <div class="option-item ${q.correctIndex === 3 ? 'correct' : ''}">${optionLabels[3]} <span class="${q.correctIndex === 3 ? 'correct-underline' : ''}">${escapeHTML(q.options[3])}</span>${q.correctIndex === 3 ? ' ✓' : ''}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                    answersHTML += aHTML;
                } else {
                    // 주관식
                    const isKoEn = q.type === 'ko-en';
                    const questionText = isKoEn ? q.item.meaning : q.item.word;
                    const answerText = isKoEn ? q.item.word : q.item.meaning;

                    // 주관식 (문제지: 객관식과 동일한 높이 확보를 위해 보이지 않는 옵션 영역 추가)
                    questionsHTML += `
                    <div class="print-question">
                        <div class="question-number">${q.num}.</div>
                        <div class="question-content">
                            <div class="question-text">${escapeHTML(questionText)}</div>
                            <!-- 높이 맞춤용 투명 블록 -->
                            <div class="objective-options" style="visibility: hidden;">
                                <div class="option-row">
                                    <div class="option-item">① -</div>
                                    <div class="option-item">② -</div>
                                </div>
                                <div class="option-row">
                                    <div class="option-item">③ -</div>
                                    <div class="option-item">④ -</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                    answersHTML += `
                    <div class="print-question">
                        <div class="question-number">${q.num}.</div>
                        <div class="question-content">
                            <div class="question-text">${escapeHTML(questionText)}</div>
                            <div class="subjective-answer">정답: <strong>${escapeHTML(answerText)}</strong></div>
                             <!-- 높이 맞춤용 투명 블록 (정답지에도 추가하여 줄맞춤 유지) -->
                            <div class="objective-options" style="visibility: hidden;">
                                <div class="option-row">
                                    <div class="option-item">① -</div>
                                    <div class="option-item">② -</div>
                                </div>
                                <div class="option-row">
                                    <div class="option-item">③ -</div>
                                    <div class="option-item">④ -</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                }
            });

            questionsHTML += '</div>'; // 좌측 컬럼 끝
            answersHTML += '</div>';
        }

        questionsHTML += '</div>'; // print-columns 끝
        answersHTML += '</div>';

        // HTML 생성
        const printHTML = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <title>단어 문제 - ${escapeHTML(dayLabel)}</title>
    <style>
        body {
            font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
            margin: 0;
            padding: 0;
            color: #333;
        }
        .print-page {
            width: 21cm;
            min-height: 29.7cm;
            padding: 1.5cm; /* Reduced padding from 2cm */
            margin: 0 auto;
            background: white;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            page-break-after: always;
        }
        .print-page:last-child {
            page-break-after: auto;
        }
        .print-header {
            text-align: center;
            margin-bottom: 5px; /* Reduced margin */
            border-bottom: 2px solid #333;
            padding-bottom: 5px; /* Reduced padding */
            flex-shrink: 0;
            position: relative;
        }
        .print-header h1 {
            margin: 0;
            font-size: 16pt; /* Reduced font size from 18pt */
            color: #333;
        }
        .print-header .day-info {
            margin-top: 2px;
            font-size: 10pt; /* Reduced font size */
            color: #666;
        }
        .print-header .score-box {
            position: absolute;
            top: 2em; /* Adjusted position */
            right: 0;
            font-size: 10pt; /* Reduced font size */
            display: flex;
            align-items: center;
            gap: 5px;
        }
        .print-header .score-input {
            border: none;
            padding: 2px 8px;
            min-width: 50px;
            text-align: center;
            font-size: 10pt; /* Reduced font size */
            background: transparent;
            display: inline-block;
            text-decoration: none;
        }
        .print-columns {
            display: flex;
            gap: 0.8cm; /* Reduced gap from 1.2cm */
            width: 100%;
            flex: 1;
            overflow: visible;
            min-height: 0;
            position: relative;
        }
        .print-column {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .print-question {
            page-break-inside: avoid;
            margin-bottom: 4px; /* Reduced margin from 8px */
            display: flex;
            align-items: flex-start;
            font-size: 9pt; /* Reduced font size from 10pt */
            line-height: 1.2; /* Reduced line height from 1.4 */
        }
        .question-number {
            font-weight: bold;
            width: 20px; /* Reduced width */
            flex-shrink: 0;
            color: #555;
        }
        .question-content {
            flex: 1;
            min-width: 0;
            overflow-wrap: anywhere;
        }
        .question-text {
            font-weight: 500;
            margin-bottom: 1px; /* Reduced margin */
        }
        .objective-options {
            font-size: 8pt; /* Reduced font size from 9pt */
            color: #555;
            margin-left: 4px;
        }
        .option-row {
            display: flex;
            gap: 8px; /* Reduced gap from 12px */
            margin-bottom: 1px;
        }
        .option-item {
            flex: 1;
            min-width: 0;
            white-space: normal;
            overflow-wrap: anywhere;
        }
        .option-item.correct {
            font-weight: bold;
            color: #d32f2f;
        }
        .correct-underline {
            text-decoration: underline;
        }
        .subjective-answer {
            margin-top: 1px;
            font-size: 8.5pt; /* Reduced font size from 9.5pt */
            color: #333;
            padding-left: 8px;
        }
        .subjective-answer strong {
            color: #d32f2f;
            font-weight: bold;
        }
        @media print {
            @page {
                size: A4;
                margin: 0; /* Remove default browser margins */
            }
            body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
            .print-page {
                margin: 0;
                padding: 1.5cm; /* Ensure padding matches non-print */
                width: 21cm;
                height: auto;
                box-sizing: border-box;
            }
        }
    </style>
</head>
<body>
    <!-- 문제만 페이지 -->
    <div class="print-page">
        <div class="print-header">
            <div class="score-box">
                <span class="score-input"></span>
                <span>/</span>
                <span>${totalQuestionCount}</span>
            </div>
            <h1>단어 문제</h1>
            <div class="day-info">${escapeHTML(dayLabel)}</div>
        </div>
        ${questionsHTML}
    </div>

    <!-- 문제 + 정답 페이지 -->
    <div class="print-page">
        <div class="print-header">
            <div class="score-box">
                <span class="score-input"></span>
                <span>/</span>
                <span>${totalQuestionCount}</span>
            </div>
            <h1>단어 문제 및 정답</h1>
            <div class="day-info">${escapeHTML(dayLabel)}</div>
        </div>
        ${answersHTML}
    </div>
</body>
</html>
        `;

        // HTML 파일로 다운로드
        const blob = new Blob([printHTML], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `word_test_day_${selectedDay}.html`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 60000);

        // 새 창에서도 열어서 바로 확인할 수 있게 지원
        window.open(url, '_blank', 'noopener');

        // 모달 닫기
        secret.closePrintDaySelect();
    },
};
