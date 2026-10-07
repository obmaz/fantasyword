/**
 * 비차단 알림 컴포넌트
 * - showToast(message, type, duration): 화면을 막지 않는 토스트 알림 (alert 대체)
 * - showConfirm(message, options): Promise<boolean>을 반환하는 커스텀 확인 모달 (confirm 대체)
 *
 * 스타일은 styles/base/notifications.css에 정의합니다.
 */
(function () {
    let activeConfirm = null;
    // --- 토스트 ---
    let container = null;
    function ensureContainer() {
        if (!container) {
            container = document.createElement('div');
            container.className = 'app-toast-container';
            container.setAttribute('role', 'status');
            container.setAttribute('aria-live', 'polite');
        }
        const dialogs = document.querySelectorAll('dialog[open]:not(.closing)');
        (dialogs[dialogs.length - 1] || document.body).appendChild(container);
        return container;
    }

    /**
     * 비차단 토스트 알림을 표시합니다.
     * @param {string} message - 표시할 메시지
     * @param {'info'|'success'|'error'|'warn'} [type='info'] - 알림 종류(테두리 색)
     * @param {number} [duration=2500] - 표시 시간(ms)
     */
    function showToast(message, type = 'info', duration = 2500) {
        const c = ensureContainer();
        const toast = document.createElement('div');
        toast.className = `app-toast app-toast-${type}`;
        toast.textContent = message;
        c.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
        return toast;
    }

    /**
     * 화면을 막지 않는 커스텀 확인 모달.
     * @param {string} message - 확인 메시지
     * @param {{okText?: string, cancelText?: string}} [options]
     * @returns {Promise<boolean>} 확인=true, 취소/바깥클릭=false
     */
    function showConfirm(message, options = {}) {
        if (activeConfirm) activeConfirm(false);
        const { okText = '확인', cancelText = '취소' } = options;
        return new Promise((resolve) => {
            const overlay = document.createElement('dialog');
            overlay.className = 'app-confirm-overlay';

            const box = document.createElement('div');
            box.className = 'app-confirm-box';

            const msg = document.createElement('p');
            msg.className = 'app-confirm-msg';
            msg.textContent = message;

            const actions = document.createElement('div');
            actions.className = 'app-confirm-actions';

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'app-confirm-cancel';
            cancelBtn.textContent = cancelText;

            const okBtn = document.createElement('button');
            okBtn.className = 'app-confirm-ok';
            okBtn.textContent = okText;

            actions.append(cancelBtn, okBtn);
            box.append(msg, actions);
            overlay.appendChild(box);

            let settled = false;
            const close = (result) => {
                if (settled) return;
                settled = true;
                activeConfirm = null;
                overlay.close();
                window.syncFullscreenHost?.();
                overlay.classList.remove('show');
                setTimeout(() => overlay.remove(), 200);
                resolve(result);
            };
            activeConfirm = close;
            overlay.addEventListener('cancel', (event) => {
                event.preventDefault();
                close(false);
            });
            okBtn.addEventListener('click', () => close(true));
            cancelBtn.addEventListener('click', () => close(false));
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) close(false);
            });

            overlay.setAttribute('aria-label', message);
            document.body.appendChild(overlay);
            overlay.showModal();
            window.syncFullscreenHost?.();
            requestAnimationFrame(() => overlay.classList.add('show'));
            okBtn.focus();
        });
    }

    window.showToast = showToast;
    window.showConfirm = showConfirm;
    window.dismissConfirm = () => {
        if (!activeConfirm) return false;
        activeConfirm(false);
        return true;
    };
})();
