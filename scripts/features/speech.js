/** 브라우저 TTS를 우선 사용하고 지원되지 않을 때 원격 TTS로 폴백한다. */
(function () {
    function getPreferredTTSVoice() {
        const synth = window.speechSynthesis;
        if (!synth || typeof synth.getVoices !== 'function') return null;
        let voices = synth.getVoices();
        if (!voices.length) return null;
        const enVoices = voices.filter((v) => v.lang.startsWith('en'));
        if (!enVoices.length) return null;
        const localEnglish =
            enVoices.find((v) => v.localService && v.lang === 'en-US') ||
            enVoices.find((v) => v.localService);
        if (localEnglish) return localEnglish;
        const enUS = enVoices.find((v) => v.lang === 'en-US');
        if (enUS) return enUS;
        return enVoices[0];
    }

    /** @type {import('../../types/practice').SpeechDependencies['playRemote']} */
    const playGoogleTTS = (text, lang, isCurrent, onUnavailable, onReady) => {
        /** @type {HTMLAudioElement | undefined} */
        let audio;
        let failed = false;
        const fail = () => {
            if (failed || !isCurrent()) return;
            failed = true;
            audio?.pause();
            onUnavailable();
        };
        try {
            audio = new Audio();
            audio.volume = 1;
            audio.src = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${encodeURIComponent(lang)}&client=tw-ob`;
            audio.onerror = fail;
            audio.onended = () => {
                if (!failed && isCurrent()) onReady?.();
            };
            Promise.resolve(audio.play()).catch(fail);
            return audio;
        } catch {
            fail();
            return null;
        }
    };

    window.getPreferredTTSVoice = getPreferredTTSVoice;
    window.playGoogleTTS = playGoogleTTS;
})();

/**
 * 발음 요청 수명. 단어 전환·나가기 이후의 오류와 Promise는 무시한다.
 * @param {import('../../types/practice').SpeechDependencies} dependencies
 * @returns {import('../../types/practice').SpeechPlayer}
 */
function createPracticeSpeech({
    getSynth,
    createUtterance,
    getVoice,
    playRemote,
    notify,
    getMusic,
}) {
    let requestId = 0;
    /** @type {HTMLAudioElement | null} */
    let audio = null;
    /** @type {HTMLAudioElement | null} */
    let resumeMusic = null;
    const restoreMusic = () => {
        const music = resumeMusic;
        resumeMusic = null;
        if (music && music.paused) Promise.resolve(music.play()).catch(() => {});
    };
    /** @type {import('../../types/practice').SpeechPlayer} */
    const speech = {
        get audio() {
            return audio;
        },
        stop() {
            requestId++;
            getSynth()?.cancel();
            const previous = audio;
            audio = null;
            if (previous) {
                previous.pause();
                previous.removeAttribute?.('src');
                previous.load?.();
            }
            restoreMusic();
        },
        play(word, automatic = false, callbacks = {}) {
            speech.stop();
            const music = getMusic?.();
            if (music && !music.paused) {
                resumeMusic = music;
                music.pause();
            }
            const id = requestId;
            const isCurrent = () => id === requestId;
            let completed = false;
            const ready = () => {
                if (!isCurrent() || completed) return;
                completed = true;
                restoreMusic();
                callbacks.onReady?.();
            };
            const unavailable = () => {
                if (!isCurrent()) return;
                restoreMusic();
                callbacks.onUnavailable?.();
                if (!automatic)
                    notify(
                        '발음을 재생할 수 없습니다. 음성 지원과 네트워크를 확인해 주세요.',
                        'info'
                    );
            };
            let fallbackStarted = false;
            const fallback = () => {
                if (!isCurrent() || fallbackStarted) return;
                fallbackStarted = true;
                audio = playRemote(word, 'en', isCurrent, unavailable, ready);
            };
            const speakNative = () => {
                if (!isCurrent()) return;
                try {
                    const synth = getSynth();
                    const utterance = createUtterance(word);
                    if (!synth || !utterance) {
                        fallback();
                        return;
                    }
                    utterance.lang = 'en-US';
                    utterance.rate = 0.8;
                    utterance.volume = 1;
                    const voice = getVoice();
                    if (voice) utterance.voice = voice;
                    utterance.onerror = (event) => {
                        if (
                            !isCurrent() ||
                            event.error === 'canceled' ||
                            event.error === 'interrupted'
                        )
                            return;
                        fallback();
                    };
                    utterance.onend = () => {
                        if (!fallbackStarted) ready();
                    };
                    synth.speak(utterance);
                } catch {
                    fallback();
                }
            };
            speakNative();
        },
    };
    return speech;
}
