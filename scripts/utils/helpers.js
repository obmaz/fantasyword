/** 여러 기능이 공유하는 HTML 텍스트 이스케이프. 기능별 헬퍼는 소유 모듈에 둔다. */
(function () {
    function escapeHTML(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    window.escapeHTML = escapeHTML;
})();
