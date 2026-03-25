// ─── 탭 전환 ──────────────────────────────────────────

function switchTab(tab) {
    const navIds = { analyzer: 'navAnalyzer', history: 'navHistory', help: 'navHelp' };
    Object.values(navIds).forEach(id => document.getElementById(id).classList.remove('active'));
    document.getElementById(navIds[tab]).classList.add('active');

    document.getElementById('mainContent').style.display = tab === 'analyzer' ? '' : 'none';
    document.getElementById('historySection').style.display = tab === 'history' ? '' : 'none';
    document.getElementById('helpSection').style.display = tab === 'help' ? '' : 'none';

    if (tab === 'history') loadHistory();
}

// ─── 히스토리 ─────────────────────────────────────────

const LANG_DISPLAY = {
    python: 'Python', java: 'Java', javascript: 'JavaScript', cpp: 'C++', c: 'C'
};

async function loadHistory() {
    const listEl = document.getElementById('historyList');
    listEl.innerHTML = '<div class="history-empty">불러오는 중...</div>';
    if (!window.db) {
        listEl.innerHTML = '<div class="history-empty">⚠️ Firebase가 아직 초기화되지 않았어요. 잠시 후 다시 시도해주세요.</div>';
        return;
    }
    try {
        const q = fsQuery(
            fsCollection(window.db, 'analyses'),
            fsOrderBy('timestamp', 'desc'),
            fsLimit(20)
        );
        const snapshot = await fsGetDocs(q);
        const items = snapshot.docs.map(doc => {
            const d = doc.data();
            return {
                id: doc.id,
                language: d.language || 'python',
                code: d.code || '',
                code_preview: (d.code || '').substring(0, 120),
                summary: d.summary || '',
                detail: d.detail || '',
                timestamp: d.timestamp ? d.timestamp.toDate().toISOString() : null
            };
        });
        renderHistory(items);
    } catch (e) {
        listEl.innerHTML = `<div class="history-empty">⚠️ 히스토리를 불러오지 못했어요.<br><small>${e.message}</small></div>`;
    }
}

function renderHistory(items) {
    const listEl = document.getElementById('historyList');
    if (!items || items.length === 0) {
        listEl.innerHTML = '<div class="history-empty">아직 분석 기록이 없어요.<br>코드를 분석하면 여기에 저장됩니다.</div>';
        return;
    }
    listEl.innerHTML = '';
    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'history-card';
        const ts = item.timestamp ? new Date(item.timestamp).toLocaleString('ko-KR') : '시간 미상';
        const langLabel = LANG_DISPLAY[item.language] || item.language;
        const preview = item.code_preview ? item.code_preview.replace(/</g, '&lt;') + (item.code.length > 120 ? '…' : '') : '';
        card.innerHTML = `
            <div class="history-card-meta">
                <span class="history-lang-badge">${langLabel}</span>
                <span class="history-ts">${ts}</span>
            </div>
            <pre class="history-code-preview">${preview}</pre>
            <div class="history-summary">${item.summary ? item.summary.substring(0, 200) : ''}</div>
        `;
        card.onclick = () => loadFromHistory(item);
        listEl.appendChild(card);
    });
}

function loadFromHistory(item) {
    switchTab('analyzer');
    document.getElementById('codeInput').value = item.code;
    document.getElementById('langSelect').value = item.language;
    updateLineNumbers();

    cachedSummaryHTML = marked.parse(item.summary || '');
    cachedDetailHTML = marked.parse(item.detail || '');

    const loadingContainer = document.getElementById('loadingContainer');
    const resultContainer = document.getElementById('resultContainer');
    const complexityBadge = document.getElementById('complexityBadge');

    loadingContainer.style.display = 'none';
    setSplitMode(true);
    renderContent(cachedSummaryHTML, false);

    const complexity = extractComplexity(item.summary || '');
    if (complexity) {
        complexityBadge.textContent = complexity;
        complexityBadge.style.display = 'block';
    } else {
        complexityBadge.style.display = 'none';
    }
    resultContainer.style.display = 'block';
    showToast('히스토리에서 불러왔어요!');
}

// 줄 번호 업데이트
function updateLineNumbers() {
    const textarea = document.getElementById("codeInput");
    const lineNumbers = document.getElementById("lineNumbers");
    const charCount = document.getElementById("charCount");

    const lines = textarea.value.split("\n").length;
    lineNumbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");

    charCount.textContent = textarea.value.length;

    lineNumbers.scrollTop = textarea.scrollTop;
}

// 스크롤 동기화
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

// ─── Split mode ───────────────────────────────────────

function setSplitMode(active) {
    const workspace = document.getElementById("workspace");
    const main = document.getElementById("mainContent");
    if (active) {
        workspace.classList.add("split");
        main.classList.add("split-mode");
    } else {
        workspace.classList.remove("split");
        main.classList.remove("split-mode");
    }
}

// ─── 유틸 ─────────────────────────────────────────────

function clearCode() {
    document.getElementById("codeInput").value = "";
    updateLineNumbers();
    hideResult();
    setSplitMode(false);
}

function copyCode() {
    const code = document.getElementById("codeInput").value;
    if (!code.trim()) return;
    navigator.clipboard.writeText(code).then(() => showToast("코드가 복사되었어요!"));
}

function copyResult() {
    const result = document.getElementById("resultBox").innerText;
    navigator.clipboard.writeText(result).then(() => showToast("결과가 복사되었어요!"));
}

function resetAll() {
    setSplitMode(false);
    hideResult();
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => document.getElementById("codeInput").focus(), 300);
}

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

// ─── 요약/상세 토글 ──────────────────────────────────

let cachedSummaryHTML = "";
let cachedDetailHTML = "";

function renderContent(html, isDetail) {
    const resultBox = document.getElementById("resultBox");
    resultBox.classList.remove("content-animate");
    void resultBox.offsetWidth;
    resultBox.classList.add("content-animate");

    resultBox.innerHTML = html;

    if (isDetail) {
        const topBtn = buildToggleBtn(false);
        resultBox.prepend(topBtn);
        const bottomBtn = buildToggleBtn(false);
        resultBox.appendChild(bottomBtn);
    } else {
        const btn = buildToggleBtn(true);
        resultBox.appendChild(btn);
    }
}

function buildToggleBtn(toDetail) {
    const btn = document.createElement("button");
    btn.className = toDetail ? "detail-toggle-btn" : "detail-toggle-btn secondary";
    btn.innerHTML = toDetail
        ? `자세히 보기 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>`
        : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="18 15 12 9 6 15"/></svg> 간단히 보기`;
    btn.onclick = () => {
        if (toDetail) {
            renderContent(cachedDetailHTML, true);
        } else {
            renderContent(cachedSummaryHTML, false);
            document.getElementById("resultBox").scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
    };
    return btn;
}

// ─── 분석 실행 (Gemini 직접 호출) ─────────────────────

async function analyzeCode() {
    const code = document.getElementById("codeInput").value;
    const lang = document.getElementById("langSelect").value;
    const btn = document.getElementById("analyzeBtn");
    const resultContainer = document.getElementById("resultContainer");
    const loadingContainer = document.getElementById("loadingContainer");
    const resultBox = document.getElementById("resultBox");
    const complexityBadge = document.getElementById("complexityBadge");

    if (!code.trim()) {
        showToast("코드를 먼저 입력해주세요!");
        return;
    }

    btn.disabled = true;
    resultContainer.style.display = "none";
    loadingContainer.style.display = "block";
    setSplitMode(true);

    try {
        if (!window.geminiModel) throw new Error("Gemini 모델이 초기화되지 않았습니다.");

        const langDisplay = {
            python: "Python", java: "Java",
            javascript: "JavaScript", cpp: "C++", c: "C"
        }[lang] || lang;

        const prompt = `당신은 10년 이상의 경력을 가진 알고리즘 및 자료구조 전문가입니다.
LeetCode, Codeforces, BOJ 등 다양한 PS 플랫폼의 문제를 풀어왔고,
기업 코딩 테스트와 실무 성능 최적화 경험이 풍부합니다.
복잡한 개념도 쉽고 친절하게 설명하는 것을 즐기며, 후배 개발자들이 성장할 수 있도록 구체적이고 실용적인 조언을 드립니다.

아래 ${langDisplay} 코드를 분석해주세요.

[분석 대상 코드]
\`\`\`${lang}
${code}
\`\`\`

**중요**: 반드시 아래 형식을 그대로 지켜 [SUMMARY]와 [DETAIL] 두 섹션으로 나눠 응답하세요.

[SUMMARY]
**시간 복잡도**: (Big-O 표기, 예: O(n²))
**공간 복잡도**: (Big-O 표기, 예: O(n))

**핵심 포인트** (최대 3개, 각 1줄):
-
-

**한줄 총평**: (코딩 테스트 관점에서 이 코드의 핵심 평가 한 줄)

[DETAIL]
## 📊 전체 복잡도 요약
- **시간 복잡도**: ...
- **공간 복잡도**: ...

## 🔍 구간별 상세 분석
각 함수 또는 주요 블록마다 복잡도와 근거를 설명해주세요.
루프 중첩, 재귀 호출, 내장 함수의 내부 복잡도 등을 명확히 짚어주세요.

## 💡 최적화 제안
개선 가능한 부분이 있다면 구체적인 방법(알고리즘 교체, 자료구조 변경 등)과 개선 후 복잡도를 제시해주세요.
최적화가 필요 없는 경우 "현재 코드가 이미 최적입니다!" 라고 명시해주세요.

## ✅ 코딩 테스트 관점 총평
- 코딩 테스트에서 이 코드의 통과 가능성 (입력 크기 기준)
- 주의해야 할 엣지 케이스나 함정
- 한 줄 격려 메시지로 마무리해주세요 😊

모든 분석은 한국어로, 친절하고 교육적인 톤으로 작성해주세요.`;

        const result = await window.geminiModel.generateContent(prompt);
        const resultText = result.response.text();

        let summary = "";
        let detail = "";

        if (resultText.includes("[DETAIL]")) {
            const parts = resultText.split("[DETAIL]");
            summary = parts[0].replace("[SUMMARY]", "").trim();
            detail = parts[1].trim();
        } else {
            summary = resultText.substring(0, 600).trim();
            detail = resultText.trim();
        }

        loadingContainer.style.display = "none";

        cachedSummaryHTML = marked.parse(summary);
        cachedDetailHTML = marked.parse(detail);

        // Firestore 저장
        if (window.db) {
            fsAddDoc(fsCollection(window.db, 'analyses'), {
                code,
                language: lang,
                summary,
                detail,
                timestamp: fsServerTimestamp()
            }).catch(e => console.warn('Firestore 저장 실패:', e));
        }

        renderContent(cachedSummaryHTML, false);

        const complexity = extractComplexity(summary);
        if (complexity) {
            complexityBadge.textContent = complexity;
            complexityBadge.style.display = "block";
        } else {
            complexityBadge.style.display = "none";
        }

        resultContainer.style.display = "block";

        if (window.innerWidth <= 900) {
            resultContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        }

    } catch (error) {
        loadingContainer.style.display = "none";
        resultBox.innerHTML = "<p>⚠️ " + error.message + "</p>";
        complexityBadge.style.display = "none";
        resultContainer.style.display = "block";
    } finally {
        btn.disabled = false;
    }
}
