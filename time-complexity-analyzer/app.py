from flask import Flask, render_template, request, jsonify
from google import genai
from dotenv import load_dotenv
import os
import ast
import re

load_dotenv()

app = Flask(__name__)
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))


def analyze_python_ast(code):
    """Python 코드를 AST로 파싱하여 구조 정보 추출"""
    try:
        tree = ast.parse(code)
        info = {
            "functions": [],
            "classes": [],
            "has_recursion": False,
            "max_loop_depth": 0,
            "builtin_calls": [],
            "parse_success": True
        }

        func_names = set()
        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                func_names.add(node.name)
                info["functions"].append(node.name)
            elif isinstance(node, ast.ClassDef):
                info["classes"].append(node.name)

        NOTABLE_BUILTINS = {
            'sorted', 'sort', 'min', 'max', 'sum', 'len',
            'enumerate', 'zip', 'map', 'filter', 'range',
            'set', 'dict', 'list', 'heappush', 'heappop', 'bisect_left', 'bisect_right'
        }
        for node in ast.walk(tree):
            if isinstance(node, ast.Call):
                func = node.func
                name = None
                if isinstance(func, ast.Name):
                    name = func.id
                elif isinstance(func, ast.Attribute):
                    name = func.attr
                if name and name in func_names:
                    info["has_recursion"] = True
                if name and name in NOTABLE_BUILTINS:
                    info["builtin_calls"].append(name)

        def max_loop_depth(node, depth=0):
            current = depth
            for child in ast.iter_child_nodes(node):
                if isinstance(child, (ast.For, ast.While)):
                    current = max(current, max_loop_depth(child, depth + 1))
                else:
                    current = max(current, max_loop_depth(child, depth))
            return current

        info["max_loop_depth"] = max_loop_depth(tree)
        info["builtin_calls"] = list(set(info["builtin_calls"]))
        return info

    except SyntaxError as e:
        return {"parse_success": False, "error": str(e)}


def analyze_generic_code(code, lang):
    """Python 외 언어에 대한 패턴 기반 구조 분석"""
    info = {"language": lang, "parse_success": True, "parse_method": "pattern"}

    if lang in ("java", "cpp", "c"):
        funcs = re.findall(r'\b(?:[\w\<\>\[\]]+)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+\w+\s*)?\{', code)
        info["functions"] = list(set(funcs))
    elif lang == "javascript":
        funcs = re.findall(r'(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\()', code)
        info["functions"] = [f[0] or f[1] for f in funcs if f[0] or f[1]]
    else:
        info["functions"] = []

    for_count = len(re.findall(r'\bfor\b', code))
    while_count = len(re.findall(r'\bwhile\b', code))
    info["loop_count"] = for_count + while_count

    info["has_recursion"] = any(
        bool(re.search(rf'\b{re.escape(f)}\s*\(', code.split(f, 1)[-1]))
        for f in info.get("functions", []) if f
    )

    return info


def build_ast_summary(ast_info, lang):
    """AST 분석 결과를 프롬프트용 텍스트로 변환"""
    lines = []
    if not ast_info.get("parse_success"):
        lines.append(f"- 구문 파싱 오류: {ast_info.get('error', '알 수 없음')} (원본 코드 기반으로 분석 진행)")
        return "\n".join(lines)

    if lang == "python":
        if ast_info["functions"]:
            lines.append(f"- 정의된 함수: {', '.join(ast_info['functions'])}")
        if ast_info["classes"]:
            lines.append(f"- 정의된 클래스: {', '.join(ast_info['classes'])}")
        lines.append(f"- 최대 중첩 루프 깊이: {ast_info['max_loop_depth']}")
        lines.append(f"- 재귀 호출 감지: {'예' if ast_info['has_recursion'] else '아니오'}")
        if ast_info["builtin_calls"]:
            lines.append(f"- 주요 내장 함수/메서드 사용: {', '.join(ast_info['builtin_calls'])}")
    else:
        if ast_info.get("functions"):
            lines.append(f"- 감지된 함수: {', '.join(ast_info['functions'][:10])}")
        lines.append(f"- 루프 수 (for + while): {ast_info.get('loop_count', 0)}")
        lines.append(f"- 재귀 가능성 감지: {'예' if ast_info.get('has_recursion') else '아니오'}")

    return "\n".join(lines) if lines else "- 구조 정보 없음"


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    code = data.get("code", "")
    lang = data.get("lang", "python").lower()

    if not code.strip():
        return jsonify({"error": "코드를 입력해주세요."}), 400

    # AST 전처리
    if lang == "python":
        ast_info = analyze_python_ast(code)
    else:
        ast_info = analyze_generic_code(code, lang)

    ast_summary = build_ast_summary(ast_info, lang)

    lang_display = {
        "python": "Python", "java": "Java",
        "javascript": "JavaScript", "cpp": "C++", "c": "C"
    }.get(lang, lang)

    prompt = f"""당신은 10년 이상의 경력을 가진 알고리즘 및 자료구조 전문가입니다.
LeetCode, Codeforces, BOJ 등 다양한 PS 플랫폼의 문제를 풀어왔고,
기업 코딩 테스트와 실무 성능 최적화 경험이 풍부합니다.
복잡한 개념도 쉽고 친절하게 설명하는 것을 즐기며, 후배 개발자들이 성장할 수 있도록 구체적이고 실용적인 조언을 드립니다.

아래 {lang_display} 코드를 분석해주세요.

---
[정적 분석 결과 - AST/패턴 기반 전처리]
{ast_summary}
---

[분석 대상 코드]
```{lang}
{code}
```

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

모든 분석은 한국어로, 친절하고 교육적인 톤으로 작성해주세요.
"""

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt
    )

    result_text = response.text
    summary = ""
    detail = ""

    if "[DETAIL]" in result_text:
        parts = result_text.split("[DETAIL]", 1)
        summary = parts[0].replace("[SUMMARY]", "").strip()
        detail = parts[1].strip()
    else:
        # 폴백: 전체를 detail로, 앞 부분을 summary로
        summary = result_text[:600].strip()
        detail = result_text.strip()

    return jsonify({
        "summary": summary,
        "detail": detail,
        "ast_summary": ast_summary
    })


if __name__ == "__main__":
    import webbrowser
    webbrowser.open("http://127.0.0.1:5001")
    app.run(debug=True, host="127.0.0.1", port=5001, use_reloader=False)
