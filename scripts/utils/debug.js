/**
 * 디버그 로깅 유틸리티
 * dlog(...)는 window.DEBUG가 true일 때만 콘솔에 출력합니다.
 * 운영 중에는 콘솔을 깨끗하게 유지하고, 디버깅 시 콘솔에서 `DEBUG = true`로 켤 수 있습니다.
 * (console.error / console.warn은 실제 오류이므로 그대로 둡니다.)
 */
window.DEBUG = false;
window.dlog = function (...args) {
    if (window.DEBUG) console.log(...args);
};
