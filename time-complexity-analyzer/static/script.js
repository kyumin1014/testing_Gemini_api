// 줄 번호 업데이트
function updateLineNumbers() {
    const textarea = document.getElementById("codeInput");
    const lineNumbers = document.getElementById("lineNumbers");
    const charCount = document.getElementById("charCount");

    const lines = textarea.value.split("\n").length;
    lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");

    charCount.textContent = textarea.value.length;

    // 스크롤 동기화
    lineNumbers.scrollTop = textarea.scrollTop;
}

// 초기 줄 번호
document.getElementById("codeInput").addEventListener("scroll", function () {
    document.getElementById("lineNumbers").scrollTop = this.scrollTop;
});

// 탭 키 지원
document.getElementById("codeInput").addEventListener("keydown", function (e) {
    if (e.key === "Tab") {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;
        this.value = this.value.substring(0, start) + "    " + this.value.substring(end);
        this.selectionStart = this.selectionEnd = start + 4;
        updateLineNumbers();
    }
});

// 코드 초기화
function clearCode() {
    document.getElementById("codeInput").value = "";
    updateLineNumbers();
    hideResult();
}

// 코드 복사
function copyCode() {
    const code = document.getElementById("codeInput").value;
    if (!code.trim()) return;
    navigator.clipboard.writeText(code).then(() => showToast("코드가 복사되었어요!"));
}

// 결과 복사
function copyResult() {
    const result = document.getElementById("resultBox").textContent;
    navigator.clipboard.writeText(result).then(() => showToast("결과가 복사되었어요!"));
}

// 다시 분석
function resetAll() {
    hideResult();
    document.getElementById("codeInput").focus();
}

// 결과 숨기기
function hideResult() {
    document.getElementById("resultContainer").style.display = "none";
    document.getElementById("loadingContainer").style.display = "none";
}

// 토스트 메시지
function showToast(message) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: #303030;
        color: #e8eaed;
        padding: 10px 20px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.1);
        z-index: 9999;
        opacity: 0;
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(-50%) translateY(0)";
    });

    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-50%) translateY(10px)";
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// Big-O 추출
function extractComplexity(text) {
    const patterns = [
        /O\(n²\)/i, /O\(n\^2\)/i, /O\(n2\)/i,
        /O\(n log n\)/i, /O\(log n\)/i,
        /O\(n!\)/i, /O\(2\^n\)/i,
        /O\(n³\)/i, /O\(n\^3\)/i,
        /O\(n\)/i, /O\(1\)/i, /O\(m\+n\)/i,
    ];
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[0];
    }
    return null;
}

// 분석 실행
async function analyzeCode() {
    const code = document.getElementById("codeInput").value;
    const btn = document.getElementById("analyzeBtn");
    const resultContainer = document.getElementById("resultContainer");
    const loadingContainer = document.getElementById("loadingContainer");
    const resultBox = document.getElementById("resultBox");
    const complexityBadge = document.getElementById("complexityBadge");

    if (!code.trim()) {
        showToast("코드를 먼저 입력해주세요!");
        return;
    }

    // 로딩 상태
    btn.disabled = true;
    resultContainer.style.display = "none";
    loadingContainer.style.display = "block";
    loadingContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });

    try {
        const response = await fetch("/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
        });

        const data = await response.json();

        loadingContainer.style.display = "none";

        if (data.error) {
            resultBox.textContent = "⚠️ " + data.error;
            complexityBadge.textContent = "";
            complexityBadge.style.display = "none";
        } else {
            resultBox.textContent = data.result;

            // Big-O 배지 추출
            const complexity = extractComplexity(data.result);
            if (complexity) {
                complexityBadge.textContent = complexity;
                complexityBadge.style.display = "block";
            } else {
                complexityBadge.style.display = "none";
            }
        }

        resultContainer.style.display = "block";
        resultContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });

    } catch (error) {
        loadingContainer.style.display = "none";
        resultBox.textContent = "⚠️ 서버 오류가 발생했어요. 다시 시도해주세요.";
        complexityBadge.style.display = "none";
        resultContainer.style.display = "block";
    } finally {
        btn.disabled = false;
    }
}