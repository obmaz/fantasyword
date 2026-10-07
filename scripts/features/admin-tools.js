/**
 * 관리자 도구 및 비밀 기능
 * 비밀번호 보호된 관리 메뉴, 골드 수정, 통계 초기화, 문제 출력 기능 포함
 */

const secret = {
    password: '770458',
    entered: '',
    checkTimer: null,
    errorTimer: null,
    cancelTimers: () => {
        clearTimeout(secret.checkTimer);
        clearTimeout(secret.errorTimer);
        secret.checkTimer = null;
        secret.errorTimer = null;
    },
    previousModal: null, // 비밀번호 모달로 오기 전 모달 추적 (gold-adjuster-modal 또는 gold-edit-modal)

    init: () => {
        const passwordBox = document.getElementById('password-input-boxes');
        if (passwordBox) {
            passwordBox.innerHTML = '';
            for (let i = 0; i < secret.password.length; i++) {
                const box = document.createElement('div');
                box.className = 'password-box';
                box.id = `passbox-${i}`;
                passwordBox.appendChild(box);
            }
        }
    },

    close: () => {
        secret.cancelTimers();
        // 비밀번호 모달이 열려있으면 이전 모달로 돌아가기
        const passwordModal = document.getElementById('password-modal');
        if (passwordModal && passwordModal.style.display !== 'none') {
            settingsManager.showPanel(secret.previousModal || 'gold-adjuster-modal');
            secret.entered = '';
            secret.pendingAction = null;
            secret.previousModal = null;
            return;
        }
        settingsManager.close();
        secret.pendingAction = null;
        secret.previousModal = null;
    },

    enter: (num) => {
        if (secret.entered.length < secret.password.length) {
            secret.entered += num;
            secret.updatePasswordDisplay();

            if (secret.entered.length === secret.password.length) {
                secret.checkTimer = setTimeout(secret.check, 200);
            }
        }
    },

    del: () => {
        secret.entered = secret.entered.slice(0, -1);
        secret.updatePasswordDisplay();
    },

    updatePasswordDisplay: () => {
        for (let i = 0; i < secret.password.length; i++) {
            const box = document.getElementById(`passbox-${i}`);
            if (i < secret.entered.length) {
                box.textContent = '*';
            } else {
                box.textContent = '';
            }
        }
        document.getElementById('password-error').style.display = 'none';
    },

    check: () => {
        secret.checkTimer = null;
        if (document.getElementById('password-modal').style.display === 'none') return;
        if (secret.entered === secret.password) {
            settingsManager.showPanel(secret.previousModal || 'gold-adjuster-modal');

            // 현재 요청한 로컬 관리 작업만 실행한다.
            if (secret.pendingAction) {
                secret.pendingAction();
                // pendingAction 실행 후에는 null로 설정하지 않음 (함수 내에서 처리)
            } else {
                settingsManager.showPanel('gold-adjuster-modal');
            }
        } else {
            document.getElementById('password-error').style.display = 'block';
            secret.entered = '';
            secret.errorTimer = setTimeout(secret.updatePasswordDisplay, 500);
        }
    },

    resetStatistics: () => {
        secret.cancelTimers();
        // 비밀번호 확인
        secret.entered = '';
        secret.updatePasswordDisplay();
        secret.previousModal = 'gold-adjuster-modal'; // 이전 모달 저장
        settingsManager.showPanel('password-modal');

        // 비밀번호 확인 후 실행할 함수
        const resetAction = async () => {
            const ok = await showConfirm(
                '정말 통계를 초기화하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
                { okText: '초기화', cancelText: '취소' }
            );
            // 이전 확인창의 응답이 새로 열린 관리 작업을 덮어쓰지 않는다.
            if (secret.pendingAction !== resetAction) return;
            if (ok) {
                db.stats = { books: {} };
                db.save('stats');

                if (typeof statistics !== 'undefined' && typeof statistics.render === 'function') {
                    statistics.render();
                }

                showToast('통계가 초기화되었습니다.', 'success');
                secret.pendingAction = null;
                secret.previousModal = null;
                secret.close();
            } else {
                // 취소하면 다시 골드 조정 화면으로
                secret.pendingAction = null;
                secret.previousModal = null;
                document.getElementById('password-modal').style.display = 'none';
                settingsManager.showPanel('gold-adjuster-modal');
            }
        };
        secret.pendingAction = resetAction;
    },

    editGold: 0, // 골드 수정 값

    openGoldEditModal: () => {
        // 골드 수정 모달 열기
        settingsManager.showPanel('gold-edit-modal');
        secret.editGold = db.gold; // 현재 골드로 초기화
        document.getElementById('current-gold-edit-display').innerText = db.gold;
        secret.updateGoldEdit(0);

        document.getElementById('gold-edit-up').onclick = () => secret.updateGoldEdit(500);
        document.getElementById('gold-edit-down').onclick = () => secret.updateGoldEdit(-500);
    },

    closeGoldEditModal: () => {
        // 골드 수정 모달 닫고 골드 조정 화면으로 돌아가기
        settingsManager.showPanel('gold-adjuster-modal');
        secret.editGold = 0;
    },

    updateGoldEdit: (amount) => {
        secret.editGold = Math.max(0, secret.editGold + amount); // 음수 방지
        for (const id of ['edit-gold-display', 'settings-edit-gold']) {
            document.getElementById(id).innerText = formatMenuNumber(secret.editGold);
        }
    },

    applyGoldEdit: () => {
        secret.cancelTimers();
        // 비밀번호 확인
        secret.entered = '';
        secret.updatePasswordDisplay();
        secret.previousModal =
            document.getElementById('gold-adjuster-modal').style.display !== 'none'
                ? 'gold-adjuster-modal'
                : 'gold-edit-modal';
        settingsManager.showPanel('password-modal');

        // 비밀번호 확인 후 실행할 함수
        secret.pendingAction = () => {
            db.gold = secret.editGold;
            db.save();

            ui.updateGold();
            if (typeof shop !== 'undefined' && typeof shop.render === 'function') {
                shop.render();
            }
            if (typeof inventory !== 'undefined' && typeof inventory.render === 'function') {
                inventory.render();
            }
            if (typeof statistics !== 'undefined' && typeof statistics.render === 'function') {
                statistics.render();
            }

            showToast('골드가 수정되었습니다.', 'success');
            secret.pendingAction = null;
            secret.previousModal = null;
            secret.closeGoldEditModal();
            secret.close();
        };
    },

    openPrintDaySelect: () => {
        // Day 선택 모달 열기
        settingsManager.showPanel('print-day-select-modal');

        // Day 선택 옵션 채우기
        const printDaySelect = document.getElementById('print-day-select');
        if (printDaySelect) {
            printDaySelect.innerHTML = '<option value="">Day 선택...</option>';

            // 현재 데이터셋의 rawData 사용
            const currentRawData =
                typeof window !== 'undefined' && window.rawDataData ? window.rawDataData : rawData;
            const daysFromData = new Set();
            if (currentRawData && Array.isArray(currentRawData)) {
                currentRawData.forEach((r) => {
                    if (r && r.day && r.day !== 'all' && r.day !== 'boss') {
                        daysFromData.add(Number(r.day));
                    }
                });
            }

            const sortedDays = Array.from(daysFromData)
                .filter((d) => !Number.isNaN(d) && d > 0)
                .sort((a, b) => a - b);

            sortedDays.forEach((d) => {
                const label =
                    typeof dayCatalog !== 'undefined' && dayCatalog[d] && dayCatalog[d].label
                        ? dayCatalog[d].label
                        : `Day ${d}`;
                printDaySelect.innerHTML += `<option value="${d}">${escapeHTML(label)}</option>`;
            });
        }
    },

    closePrintDaySelect: () => {
        // Day 선택 모달 닫고 설정 화면으로 돌아가기
        settingsManager.showPanel('gold-adjuster-modal');
    },

    generatePrintHTML: () => worksheet.generate(),
};
