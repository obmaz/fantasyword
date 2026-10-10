/** 독립 HTML 문제지 생성/다운로드. 출제는 worksheetRules가 소유한다. */
const worksheet = {
    createDocument: (model, dayLabel) => {
        const e = escapeHTML;
        const choices = ['①', '②', '③', '④'];
        const questions = model.questions.map(
            (question) => `
            <li class="question">
                <div class="question-heading"><strong class="question-number">${question.num}.</strong>
                    <div><small>${question.key === 'word' ? '영어 단어를' : '한국어 뜻을'} ${question.options ? '고르세요' : '쓰세요'}</small>
                    <p class="question-text">${e(question.prompt)}</p></div></div>
                ${
                    question.options
                        ? `<ol class="options${question.options.every((option) => Array.from(option).length <= 14) ? ' options-compact' : ''}">${question.options
                              .map(
                                  (option, index) =>
                                      `<li><span>${choices[index]}</span><span>${e(option)}</span></li>`
                              )
                              .join('')}</ol>`
                        : '<div class="answer-line"><span>답:</span></div>'
                }
            </li>`
        );
        const answers = model.questions
            .map(
                (question) => `
            <tr><th scope="row">${question.num}</th><td>${e(question.prompt)}</td>
                <td>${question.options ? choices[question.correctIndex] + ' ' : ''}${e(question.answer)}</td></tr>`
            )
            .join('');
        return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(dayLabel)} · 단어 문제지</title>
<style>
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; background: #e9ecef; font: 11pt/1.5 Arial, 'Malgun Gothic', sans-serif; }
    .toolbar { max-width: 210mm; margin: 16px auto; padding: 16px; background: white; border-radius: 8px; }
    .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
    select, button { padding: 10px 14px; font: inherit; }
    button { border: 0; border-radius: 4px; color: white; background: #234b3d; cursor: pointer; }
    .toolbar p { margin: 12px 0 0; font-size: 10pt; }
    .sheet { width: 210mm; max-width: 100%; margin: 20px auto; padding: 14mm; background: white; }
    h1 { margin: 0; font-size: 20pt; }
    .sheet-header { border-bottom: 2px solid #111; padding-bottom: 5mm; margin-bottom: 5mm; }
    .summary { margin: 2mm 0 4mm; }
    .student { display: flex; justify-content: space-between; gap: 4mm; flex-wrap: wrap; }
    .instructions { margin: 0 0 5mm; font-size: 10pt; }
    .question-list { list-style: none; margin: 0; padding: 0; }
    .question-row { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8mm;
        break-inside: avoid; page-break-inside: avoid; margin-bottom: 6mm; }
    .question { list-style: none; min-width: 0; break-inside: avoid; }
    .question-heading { display: flex; gap: 2mm; }
    .question-heading > div { min-width: 0; }
    .question-number { flex: 0 0 7mm; }
    small { font-size: 9pt; }
    .question-text { font-weight: bold; margin: 1mm 0 3mm; overflow-wrap: anywhere; }
    .options { list-style: none; padding: 0; margin: 0 0 0 9mm; display: grid; gap: 2mm; }
    .options-compact { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); column-gap: 3mm; }
    .options li { display: flex; gap: 2mm; align-items: baseline; overflow-wrap: anywhere; min-width: 0; }
    .options li span:last-child { min-width: 0; word-break: keep-all; }
    .answer-line { height: 13mm; border-bottom: 1px solid #555; margin-left: 9mm; padding-top: 4mm; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 3mm; border: 1px solid #777; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    th:first-child { width: 14mm; }
    .solutions table { font-size: 10pt; line-height: 1.35; }
    .solutions th, .solutions td { padding: 2mm; }
    @media screen and (max-width: 600px) {
        .sheet { padding: 20px; margin: 12px auto; }
        .toolbar { margin: 12px; }
        .question-row { grid-template-columns: minmax(0, 1fr); gap: 24px; }
    }
    @page { size: A4 portrait; margin: 14mm;
        @bottom-right { content: counter(page) ' / ' counter(pages); font: 9pt Arial, sans-serif; }
    }
    @media print {
        body { background: white; }
        .toolbar { display: none; }
        .sheet { width: auto; max-width: none; margin: 0; padding: 0; }
        body[data-print-target="questions"] .solutions,
        body[data-print-target="answers"] .quiz { display: none; }
        body[data-print-target="both"] .solutions { break-before: page; page-break-before: always; }
    }
</style>
</head>
<body data-print-target="questions">
<aside class="toolbar" aria-label="인쇄 도구">
    <div class="controls"><label for="print-target">인쇄 범위</label>
        <select id="print-target"><option value="questions">문제지만</option><option value="answers">정답지만</option><option value="both">문제지 + 정답지</option></select>
        <button id="print-button" type="button">A4 인쇄 / PDF 저장</button></div>
    <p>A4 · 세로 · 배율 100% 권장. 브라우저의 머리글/바닥글은 끄세요. 긴 문제는 다음 장으로 이어집니다. 정답지는 별도 인쇄할 수 있습니다.</p>
</aside>
<main>
    <section class="sheet quiz" aria-label="문제지">
        <header class="sheet-header"><h1>단어 문제지</h1>
            <p class="summary">${e(dayLabel)} · 총 ${model.questions.length}문항 (객관식 ${model.objectiveCount} · 주관식 ${model.subjectiveCount})</p>
            <div class="student"><span>이름: __________________</span><span>날짜: ______________</span><span>점수: ____ / ${model.questions.length}</span></div>
        </header>
        <p class="instructions">객관식은 정답 번호에 동그라미를, 주관식은 답란에 답을 쓰세요.</p>
        <ol class="question-list">${worksheet.pairQuestions(questions)}</ol>
    </section>
    <section class="sheet solutions" aria-label="정답지">
        <header class="sheet-header"><h1>교사용 정답지</h1><p class="summary">${e(dayLabel)} · 총 ${model.questions.length}문항</p></header>
        <table><thead><tr><th scope="col">번호</th><th scope="col">문제</th><th scope="col">정답</th></tr></thead><tbody>${answers}</tbody></table>
    </section>
</main>
<script>
    document.getElementById('print-target').addEventListener('change', function () {
        document.body.dataset.printTarget = this.value;
    });
    document.getElementById('print-button').addEventListener('click', function () {
        window.print();
    });
</script>
</body>
</html>`;
    },
    // 한 줄의 두 문제를 함께 넘겨 페이지 하단에서 보기/답란이 잘리지 않게 한다.
    pairQuestions: (questions) => {
        let result = '';
        for (let index = 0; index < questions.length; index += 2) {
            result += `<li class="question-row"><ol class="question-list">${questions[index]}</ol><ol class="question-list">${questions[index + 1] || ''}</ol></li>`;
        }
        return result;
    },
    generate: () => {
        const selectedDay = document.getElementById('print-day-select')?.value;
        if (!selectedDay) {
            showToast('Day를 선택해주세요.', 'warn');
            return;
        }
        const source = window.rawDataData || rawData;
        const type =
            document.querySelector('input[name="print-question-type"]:checked')?.value || 'mixed';
        const requestedLimit = Number(document.getElementById('print-question-count')?.value) || 20;
        const model = worksheetRules.build(
            source,
            {
                day: selectedDay,
                type,
                limit: Math.min(requestedLimit, APP_CONFIG.printMaxQuestions),
            },
            questionTools.shuffle
        );
        if (!model.questions.length) {
            showToast('선택한 Day에 단어가 없습니다.', 'warn');
            return;
        }
        const dayLabel = window.dayCatalog?.[selectedDay]?.label || `Day ${selectedDay}`;
        const html = worksheet.createDocument(model, dayLabel);
        const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `word_test_day_${selectedDay}.html`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.open(url, '_blank', 'noopener');
        // 차단된 새 창 대신 다운로드한 HTML을 열어도 같은 인쇄 도구를 사용할 수 있다.
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        secret.closePrintDaySelect();
    },
};
