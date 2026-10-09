/**
 * 연습 세션. 저장소·데이터·렌더러·발음은 생성 시 주입한다.
 * @param {import('../../types/practice').PracticeDependencies} dependencies
 * @returns {import('../../types/practice').PracticeSession}
 */
function createPracticeSession({
    db,
    getSource,
    getWrongWords,
    view,
    speech,
    notify,
    resetResult,
    playMusic,
}) {
    /** @type {import('../../types/practice').PracticeSession} */
    const session = {
        words: [],
        fullPool: [],
        currentIndex: 0,
        currentDay: null,
        currentFilter: 'all',
        showKoreanExplanation: false,
        get speechAudio() {
            return speech.audio;
        },
        stopSpeech: () => speech.stop(),
        getMemorizedSet() {
            return new Set(db.practiceMemorized?.[db.getBookKey()] || []);
        },
        applyFilter(filter, preferredIndex = 0) {
            session.currentFilter = filter || session.currentFilter;
            const memorized = session.getMemorizedSet();
            session.words = session.fullPool.filter((word) => {
                const known = memorized.has(`${word.word}|${word.meaning}`);
                return session.currentFilter === 'memorized'
                    ? known
                    : session.currentFilter === 'not-memorized'
                      ? !known
                      : true;
            });
            view.filter(session.currentFilter);
            session.currentIndex = 0;
            if (session.words.length)
                session.showWord(Math.min(preferredIndex, session.words.length - 1));
            else {
                session.stopSpeech();
                view.answer(false);
                view.empty();
            }
        },
        toggleMemorized() {
            const word = session.words[session.currentIndex];
            if (!word) return;
            const book = db.getBookKey();
            const key = `${word.word}|${word.meaning}`;
            db.practiceMemorized ||= {};
            db.practiceMemorized[book] ||= [];
            const keys = db.practiceMemorized[book];
            const index = keys.indexOf(key);
            if (index === -1) {
                keys.push(key);
            } else {
                keys.splice(index, 1);
            }
            db.save('memorized');
            if (session.currentFilter === 'all') session.updateMemorizedButton();
            else session.applyFilter(null, session.currentIndex);
        },
        updateMemorizedButton() {
            const word = session.words[session.currentIndex];
            if (word) view.memorized(session.getMemorizedSet().has(`${word.word}|${word.meaning}`));
        },
        showWord(index) {
            if (index < 0 || index >= session.words.length) return;
            session.stopSpeech();
            session.currentIndex = index;
            view.word(
                session.words[index],
                index,
                session.words.length,
                session.showKoreanExplanation
            );
            view.answer(true);
            session.updateMemorizedButton();
            if (db.settings.wordRead) session.playTTS(true);
        },
        start(day, reviewPool = null) {
            const source = getSource();
            const pool =
                reviewPool ||
                (day === 'all'
                    ? source
                    : source.filter((word) => Number(word.day) === Number(day)));
            if (!pool.length) {
                notify('단어 데이터가 없습니다.', 'error');
                session.exit();
                return;
            }
            session.currentDay = day;
            session.fullPool = pool;
            session.showKoreanExplanation = false;
            view.open(reviewPool ? '이번 판 오답 복습' : day === 'all' ? '전체' : `Day ${day}`);
            playMusic('practice');
            session.applyFilter('all');
        },
        reviewWrongWords() {
            const seen = new Set();
            const source = getSource();
            const pool = getWrongWords().flatMap((wrong) => {
                const key = `${wrong.word}|${wrong.meaning}`;
                if (seen.has(key)) return [];
                seen.add(key);
                return [
                    source.find(
                        (word) => word.word === wrong.word && word.meaning === wrong.meaning
                    ) || { day: 'review', ...wrong },
                ];
            });
            if (!pool.length) return;
            resetResult();
            session.start('review', pool);
        },
        toggleExplanationLang() {
            session.showKoreanExplanation = !session.showKoreanExplanation;
            const word = session.words[session.currentIndex];
            if (word) view.explanation(word, session.showKoreanExplanation);
        },
        playTTS(automatic = false) {
            const word = session.words[session.currentIndex];
            if (word?.word) speech.play(word.word, automatic);
        },
        prev() {
            if (session.currentIndex > 0) session.showWord(session.currentIndex - 1);
        },
        next() {
            if (session.currentIndex < session.words.length - 1)
                session.showWord(session.currentIndex + 1);
        },
        exit() {
            session.stopSpeech();
            view.exit();
        },
    };
    return session;
}
