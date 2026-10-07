/**
 * 게임 데이터 로더
 * 여러 게임 데이터셋(단어장)을 관리하고 동적으로 전환하는 시스템
 */
(function () {
    'use strict';

    // 사용 가능한 게임 데이터셋 목록을 동적으로 생성
    function buildAvailableDataSets() {
        const dataSets = [];
        let id = 1;

        // gameDataName_N이 존재하는 동안 계속 추가 (최대 10개까지 확인)
        while (id <= 10) {
            const nameKey = `gameDataName_${id}`;
            const storiesKey = `storiesData_${id}`;
            const rawDataKey = `rawData_${id}`;

            // gameDataName이 있거나, storiesData와 rawData가 모두 있으면 추가
            if (
                typeof window[nameKey] !== 'undefined' ||
                (typeof window[storiesKey] !== 'undefined' &&
                    typeof window[rawDataKey] !== 'undefined')
            ) {
                const name = window[nameKey] || `game_data_${id}`;
                dataSets.push({ id: String(id), name: name });
            } else {
                // 연속된 ID가 없으면 중단 (예: 1, 2는 있지만 3이 없으면 중단)
                break;
            }

            id++;
        }

        return dataSets;
    }

    // 사용 가능한 게임 데이터셋 목록
    const availableDataSets = buildAvailableDataSets();

    // 현재 선택된 데이터셋 ID
    let currentDataSetId = null;

    // 데이터셋 로드 함수
    function loadDataSet(dataSetId) {
        const storiesKey = `storiesData_${dataSetId}`;
        const rawDataKey = `rawData_${dataSetId}`;
        const nameKey = `gameDataName_${dataSetId}`;

        if (
            typeof window[storiesKey] === 'undefined' ||
            typeof window[rawDataKey] === 'undefined'
        ) {
            console.error(`[data-loader] Data set ${dataSetId} not found`);
            return false;
        }

        // 전역 변수에 현재 데이터셋 설정
        window.storiesData = window[storiesKey];
        window.rawDataData = window[rawDataKey];
        window.currentGameDataName = window[nameKey] || `game_data_${dataSetId}`;
        window.currentGameDataSetId = dataSetId;

        dlog(`[data-loader] Loaded data set: ${window.currentGameDataName} (ID: ${dataSetId})`);
        return true;
    }

    // 데이터셋 변경 함수
    function changeDataSet(dataSetId) {
        if (!availableDataSets.some((ds) => ds.id === dataSetId)) return false;
        // 저장 실패 후 새로고침하면 이전 단어장으로 되돌아가므로 먼저 저장 성공을 확인한다.
        if (!gameStorage.set('selectedGameDataSet', dataSetId)) return false;
        if (loadDataSet(dataSetId)) {
            currentDataSetId = dataSetId;
            // localStorage에 저장

            // words.js의 dayCatalog 재생성 필요 시 호출
            if (typeof dayCatalog !== 'undefined' && typeof dayCatalog.rebuild === 'function') {
                dayCatalog.rebuild();
            }

            // UI 업데이트
            updateSelectorUI();

            return true;
        }
        return false;
    }

    // 드롭박스 UI 업데이트
    function updateSelectorUI() {
        const selector = document.getElementById('game-data-selector');
        if (selector && currentDataSetId) {
            selector.value = currentDataSetId;
        }
    }

    // 초기화: localStorage에서 저장된 데이터셋 로드 또는 기본값 사용
    function init() {
        let dataSetId = '1'; // 기본값

        // localStorage에서 저장된 값 확인
        if (typeof Storage !== 'undefined') {
            const saved = gameStorage.get('selectedGameDataSet');
            if (saved && availableDataSets.find((ds) => ds.id === saved)) {
                dataSetId = saved;
            }
        }

        // 데이터셋 로드 (UI 업데이트는 하지 않음 - DOM이 준비되지 않았을 수 있음)
        if (loadDataSet(dataSetId)) {
            currentDataSetId = dataSetId;
            // localStorage에 저장
            if (typeof Storage !== 'undefined') {
                gameStorage.set('selectedGameDataSet', dataSetId);
            }
            dlog(
                `[data-loader] Initialized with data set: ${window.currentGameDataName} (ID: ${dataSetId})`
            );
        } else {
            console.error(`[data-loader] Failed to load initial data set: ${dataSetId}`);
        }
    }

    // 드롭박스 변경 이벤트 리스너
    function setupSelector() {
        const selector = document.getElementById('game-data-selector');
        if (selector) {
            // 동적으로 옵션 생성
            selector.innerHTML = '';
            availableDataSets.forEach((dataSet) => {
                const option = document.createElement('option');
                option.value = dataSet.id;
                option.textContent = dataSet.name;
                selector.appendChild(option);
            });

            // 현재 선택된 값으로 설정
            updateSelectorUI();

            selector.addEventListener('change', async function (e) {
                const newDataSetId = e.target.value;

                // 선택한 데이터셋이 실제로 존재하는지만 먼저 확인한다.
                // 중요: 확인(confirm) 전에 changeDataSet()을 호출하면 안 된다.
                //   - 전역(window.rawDataData/storiesData)이 즉시 교체되는데
                //     words-loader.js의 rawData/dayCatalog는 로드 시점 값으로 고정되어 있어
                //     "취소"를 눌러도 Day 목록과 실제 문제 풀이 어긋난 상태가 남는다.
                //   - currentDataSetId도 이미 새 값이라 updateSelectorUI()가 복원에 실패한다.
                // 따라서 적용은 새로고침에 동의한 뒤에만 수행한다.
                if (!availableDataSets.find((ds) => ds.id === newDataSetId)) {
                    console.error(`[data-loader] Data set ${newDataSetId} not found`);
                    updateSelectorUI(); // 이전 선택으로 복원
                    return;
                }

                // 비차단 커스텀 확인 모달 사용 (없으면 기본 confirm으로 폴백)
                const confirmFn =
                    typeof showConfirm === 'function'
                        ? showConfirm
                        : (msg) => Promise.resolve(window.confirm(msg));
                const ok = await confirmFn(
                    '게임 데이터를 변경하려면 페이지를 새로고침해야 합니다. 새로고침할까요?',
                    { okText: '새로고침', cancelText: '취소' }
                );

                if (!ok) {
                    // 취소: 전역 데이터를 건드리지 않았으므로 드롭박스만 이전 값으로 되돌리면 됨
                    updateSelectorUI();
                    return;
                }

                if (changeDataSet(newDataSetId)) {
                    location.reload();
                } else {
                    // 로드 실패 시 이전 값으로 복원
                    updateSelectorUI();
                }
            });
        }
    }

    // 즉시 초기화 (words.js가 로드되기 전에 데이터를 설정해야 함)
    init();

    // DOMContentLoaded 시 UI 설정
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () {
            setupSelector();
        });
    } else {
        setupSelector();
    }

    // 전역으로 노출
    window.gameDataLoader = {
        changeDataSet: changeDataSet,
        getCurrentDataSetId: () => currentDataSetId,
        getAvailableDataSets: () => availableDataSets,
        reload: () => {
            if (currentDataSetId) {
                changeDataSet(currentDataSetId);
            }
        },
    };
})();
