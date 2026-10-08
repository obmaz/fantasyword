export interface Word {
    day: number | string;
    word: string;
    meaning: string;
    englishExplanation?: string;
    koreanExplanation?: string;
}
export type PracticeFilter = 'all' | 'memorized' | 'not-memorized';
export interface PracticeView {
    filter(value: PracticeFilter): void;
    answer(hasWord: boolean): void;
    empty(): void;
    memorized(known: boolean): void;
    word(word: Word, index: number, count: number, korean: boolean): void;
    explanation(word: Word, korean: boolean): void;
    open(label: string): void;
    exit(): void;
}
export interface PracticeViewDependencies {
    document: Document;
    openScreen(id: string, animated: boolean): void;
    closeScreen(id: string, animated: boolean): void;
    syncLayout(): void;
    track(screen: string): void;
    schedule(callback: () => void, delay: number): unknown;
}
export interface SpeechPlayer {
    readonly audio: HTMLAudioElement | null;
    stop(): void;
    play(word: string, automatic?: boolean, callbacks?: SpeechCallbacks): void;
}
export interface SpeechCallbacks {
    onReady?(): void;
    onUnavailable?(): void;
}
export interface PracticeSession {
    words: Word[];
    fullPool: Word[];
    currentIndex: number;
    currentDay: string | number | null;
    currentFilter: PracticeFilter;
    showKoreanExplanation: boolean;
    readonly speechAudio: HTMLAudioElement | null;
    stopSpeech(): void;
    getMemorizedSet(): Set<string>;
    applyFilter(filter: PracticeFilter | null, preferredIndex?: number): void;
    toggleMemorized(): void;
    updateMemorizedButton(): void;
    showWord(index: number): void;
    start(day: string | number, reviewPool?: Word[] | null): void;
    reviewWrongWords(): void;
    toggleExplanationLang(): void;
    playTTS(automatic?: boolean): void;
    prev(): void;
    next(): void;
    exit(): void;
}
export interface PracticeDependencies {
    db: {
        settings: { wordRead: boolean };
        practiceMemorized?: Record<string, string[]>;
        getBookKey(): string;
        save(section: 'memorized'): void;
    };
    getSource(): Word[];
    getWrongWords(): Pick<Word, 'word' | 'meaning'>[];
    view: PracticeView;
    speech: SpeechPlayer;
    notify(message: string, type?: string): void;
    resetResult(): void;
    playMusic(mode: 'practice'): void;
}
export interface SpeechDependencies {
    getMusic?(): HTMLAudioElement | null;
    getSynth(): SpeechSynthesis | null | undefined;
    createUtterance(word: string): SpeechSynthesisUtterance | null;
    getVoice(): SpeechSynthesisVoice | null;
    playRemote(
        text: string,
        lang: string,
        isCurrent: () => boolean,
        onUnavailable: () => void,
        onReady?: () => void
    ): HTMLAudioElement | null;
    notify(message: string, type?: string): void;
}
declare global {
    interface Window {
        getPreferredTTSVoice(): SpeechSynthesisVoice | null;
        rawData_1?: Word[];
        rawData_2?: Word[];
        rawData_3?: Word[];
        playGoogleTTS: SpeechDependencies['playRemote'];
    }
}
