/** 짧은 합성 효과음. 재생 실패·브라우저 정책은 게임 진행에 영향을 주지 않는다. */
function createGameSound({
    getSettings,
    createContext,
    isVisible = () => true,
    config = PRESENTATION_CONFIG,
}) {
    let context = null;
    let master = null;
    const voices = new Map();
    const notesFor = (cue, profile) => {
        const heavy = profile.motion === 'axe';
        const pitch =
            { fire: 420, ice: 1250, lightning: 1600, void: 180, gold: 880 }[profile.element] || 680;
        if (cue === 'swing') return [[pitch, 90, Math.max(0.08, (profile.impactMs || 200) / 1000)]];
        if (cue === 'impact')
            return [
                [heavy ? 100 : 220, 45, 0.15],
                [pitch, pitch / 2, 0.09],
            ];
        if (cue === 'hurt') return [[150, 60, 0.18]];
        if (cue === 'block')
            return [
                [1200, 600, 0.16],
                [1800, 900, 0.2],
            ];
        const melodies = {
            encounter: [330, 440],
            boss: [150, 180, 220],
            combo: [660, 880, 1320],
            victory: [523, 659, 784, 1047],
            defeat: [330, 260, 196],
            reward: [784, 988, 1175],
            equip: [440, 660, 880],
            progress: [523, 784, 1047],
        };
        return (melodies[cue] || []).map((frequency, index) => [
            frequency,
            frequency,
            0.16,
            index * 0.09,
        ]);
    };
    function stop(channel = null) {
        for (const [source, voice] of voices) {
            if (channel !== null && voice.channel !== channel) continue;
            try {
                source.stop();
            } catch {
                /* 이미 끝난 음원도 안전하게 정리한다. */
            }
            try {
                source.disconnect();
                voice.gain.disconnect();
            } catch {
                /* 이미 종료된 음원의 정리 오류는 전파하지 않는다. */
            }
            voices.delete(source);
        }
    }
    return {
        unlock() {
            if (getSettings().soundEffects === false || !isVisible()) return;
            try {
                if (!context || context.state === 'closed') {
                    context = createContext();
                    if (!context) return;
                    master = context.createGain();
                    master.gain.value = config.soundVolume;
                    master.connect(context.destination);
                }
                if (context.state === 'suspended') context.resume().catch(() => {});
            } catch {
                context = null;
                master = null;
            }
        },
        play(cue, profile = {}, channel = 'ui') {
            if (
                getSettings().soundEffects === false ||
                !isVisible() ||
                context?.state !== 'running'
            )
                return false;
            const notes = notesFor(cue, profile);
            if (voices.size + notes.length > config.maxVoices) return false;
            try {
                for (const [frequency, end, duration, delay = 0] of notes) {
                    const start = context.currentTime + delay;
                    const source = context.createOscillator();
                    const gain = context.createGain();
                    voices.set(source, { gain, channel });
                    source.type = cue === 'swing' ? 'triangle' : 'sine';
                    source.frequency.setValueAtTime(frequency, start);
                    source.frequency.exponentialRampToValueAtTime(end, start + duration);
                    gain.gain.setValueAtTime(0.0001, start);
                    gain.gain.exponentialRampToValueAtTime(0.32, start + 0.008);
                    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
                    source.connect(gain);
                    gain.connect(master);
                    source.onended = () => {
                        source.disconnect();
                        gain.disconnect();
                        voices.delete(source);
                    };
                    source.start(start);
                    source.stop(start + duration + 0.01);
                }
                return notes.length > 0;
            } catch {
                stop(channel);
                return false;
            }
        },
        stop,
    };
}
