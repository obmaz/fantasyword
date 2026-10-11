/** 모델과 콜백만 사용하는 스토리 퍼즐 화면. 공통 이미지 헤더·버튼을 재사용한다. */
function createStoryPuzzleView({ document: doc, openScreen, resetScreen }) {
    const element = (id) => doc.getElementById(id);
    let version = 0;
    const actions = (...buttons) => {
        const root = element('puzzle-controls');
        root.replaceChildren();
        const generation = version;
        for (const [label, callback] of buttons) {
            const button = doc.createElement('button');
            button.type = 'button';
            button.className = 'image-action-button';
            button.textContent = label;
            button.onclick = () => {
                if (version === generation && !button.disabled) callback();
            };
            root.appendChild(button);
        }
    };
    const message = (text) => {
        element('puzzle-feedback').textContent = text;
    };
    const clearQuestion = () => {
        element('puzzle-choices').replaceChildren();
        element('puzzle-trail').textContent = '';
        element('puzzle-current').textContent = '';
    };
    return {
        init(onExit) {
            element('puzzle-header-host').replaceChildren(
                createGameplayHeader({
                    mode: 'puzzle',
                    title: '속담',
                    headingId: 'puzzle-title',
                    onExit,
                    document: doc,
                })
            );
        },
        open(kind) {
            version++;
            element('puzzle-title').textContent = kind === 'proverb' ? '속담' : '단어 대장간';
            element('story-puzzle-game').dataset.kind = kind;
            openScreen('story-puzzle-game', false);
        },
        question(model, choose) {
            version++;
            clearQuestion();
            actions();
            message('');
            delete element('puzzle-prompt').dataset.result;
            element('puzzle-progress').textContent =
                `${model.round} / ${model.total} · ${model.kind === 'proverb' ? `오답 ${model.mistakes} / 2` : `추가 변환 ${model.mistakes} / 2`}`;
            element('puzzle-prompt').textContent =
                model.kind === 'proverb' ? model.prompt : `목표 ${model.prompt}`;
            element('puzzle-current').textContent = model.current || '';
            element('puzzle-guide').textContent =
                model.kind === 'proverb'
                    ? '빈칸에 들어갈 말을 고르세요.'
                    : `한 글자씩 바꾸세요 · 남은 변환 ${model.remaining}회`;
            element('puzzle-trail').textContent = model.trail?.join(' → ') || '';
            const root = element('puzzle-choices');
            const generation = version;
            for (const choice of model.choices) {
                const button = doc.createElement('button');
                button.type = 'button';
                button.className = 'image-action-button';
                button.textContent = choice;
                button.onclick = () => {
                    if (generation === version && !button.disabled) choose(choice);
                };
                root.appendChild(button);
            }
        },
        review(model, next) {
            version++;
            clearQuestion();
            element('puzzle-prompt').textContent = model.answer;
            element('puzzle-prompt').dataset.result = model.correct ? 'correct' : 'wrong';
            element('puzzle-guide').textContent = '';
            element('puzzle-progress').textContent = element('puzzle-progress').textContent.replace(
                /(?:오답|추가 변환) \d+ \/ 2$/,
                `${element('story-puzzle-game').dataset.kind === 'proverb' ? '오답' : '추가 변환'} ${model.mistakes} / 2`
            );
            message(model.meaning);
            actions(['다음', next]);
        },
        saveFailed(retry) {
            message('결과를 저장하지 못했습니다. 같은 결과를 다시 저장할 수 있습니다.');
            actions(['저장 재시도', retry]);
        },
        done(result, story, again) {
            version++;
            clearQuestion();
            element('puzzle-prompt').textContent = result.won ? '완료!' : '다시 도전해 보세요';
            element('puzzle-prompt').dataset.result = result.won ? 'correct' : 'wrong';
            element('puzzle-guide').textContent = '';
            message(
                result.won
                    ? `${story ? '획득 골드' : '테스트 점수'} ${result.points} · ${['금', '은', '동'][result.mistakes]} 왕관`
                    : '다음 지점은 아직 열리지 않았습니다.'
            );
            if (!story && !result.won) message('다시 도전해 보세요.');
            actions([story ? '지도로 돌아가기' : '다시 하기', again]);
        },
        exit() {
            version++;
            resetScreen('story-puzzle-game');
            openScreen('title-screen', false);
        },
    };
}
