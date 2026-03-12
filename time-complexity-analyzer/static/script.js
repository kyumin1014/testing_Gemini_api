async function analyzeCode() {
    const code = document.getElementById("codeInput").value;
    const btn = document.getElementById("analyzeBtn");
    const resultSection = document.getElementById("resultSection");
    const resultBox = document.getElementById("resultBox");

    if (!code.trim()) {
        alert("코드를 입력해주세요!");
        return;
    }

    // 로딩 상태
    btn.disabled = true;
    btn.textContent = "분석 중...";
    resultSection.style.display = "none";

    try {
        const response = await fetch("/analyze", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ code: code })
        });

        const data = await response.json();

        if (data.error) {
            resultBox.textContent = "오류: " + data.error;
        } else {
            resultBox.textContent = data.result;
        }

        resultSection.style.display = "block";

    } catch (error) {
        resultBox.textContent = "서버 오류가 발생했어요. 다시 시도해주세요.";
        resultSection.style.display = "block";
    } finally {
        btn.disabled = false;
        btn.textContent = "분석하기";
    }
}