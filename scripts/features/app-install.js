/** Native installation when available, with a persistent Safari/menu fallback. */
const appInstall = (() => {
    let promptEvent = null;
    let installationAccepted = false;
    const installed = () =>
        installationAccepted ||
        window.matchMedia?.('(display-mode: standalone)').matches ||
        navigator.standalone === true;
    const refresh = () => {
        const button = document.getElementById('app-install-btn');
        button.disabled = installed();
        button.textContent = installed() ? '설치됨' : '앱 설치';
        if (installed())
            document.getElementById('app-install-help').textContent =
                '홈 화면에서 앱을 열 수 있어요.';
    };
    const instructions = () => {
        const ios =
            /iPad|iPhone|iPod/.test(navigator.userAgent) ||
            (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        document.getElementById('app-install-help').textContent = ios
            ? 'Safari의 공유 버튼에서 ‘홈 화면에 추가’를 선택하세요.'
            : '브라우저 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 선택하세요.';
    };
    return {
        init() {
            refresh();
            window.addEventListener('beforeinstallprompt', (event) => {
                event.preventDefault();
                promptEvent = event;
                refresh();
            });
            window.addEventListener('appinstalled', () => {
                promptEvent = null;
                installationAccepted = true;
                document.getElementById('app-install-btn').disabled = true;
                document.getElementById('app-install-btn').textContent = '설치됨';
                document.getElementById('app-install-help').textContent =
                    '홈 화면에서 앱을 열 수 있어요.';
            });
            if (window.isSecureContext && 'serviceWorker' in navigator)
                navigator.serviceWorker
                    .register('sw.js', { updateViaCache: 'none' })
                    .catch(() => {});
        },
        async install() {
            if (installed()) return;
            if (!promptEvent) {
                instructions();
                return;
            }
            const event = promptEvent;
            promptEvent = null;
            document.getElementById('app-install-btn').disabled = true;
            try {
                await event.prompt();
                const choice = await event.userChoice;
                installationAccepted = choice.outcome === 'accepted';
                document.getElementById('app-install-help').textContent =
                    choice.outcome === 'accepted'
                        ? '홈 화면에서 앱을 열 수 있어요.'
                        : '원할 때 다시 앱을 설치할 수 있어요.';
            } catch {
                instructions();
            } finally {
                refresh();
            }
        },
    };
})();
