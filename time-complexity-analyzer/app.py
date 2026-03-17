from flask import Flask, render_template, request, jsonify
from google import genai
from dotenv import load_dotenv
import os

load_dotenv()

app = Flask(__name__)

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/analyze", methods=["POST"])
def analyze():
    data = request.get_json()
    code = data.get("code", "")

    if not code.strip():
        return jsonify({"error": "코드를 입력해주세요."}), 400

    prompt = f"""
    아래 코드의 시간 복잡도를 분석해줘.
    
    1. 전체 시간 복잡도 (Big-O 표기법)
    2. 각 부분별 설명
    3. 개선 가능한 부분이 있다면 제안
    
    코드:
    {code}
    """

    response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=prompt
    )
    return jsonify({"result": response.text})

if __name__ == "__main__":
    import webbrowser
    webbrowser.open("http://127.0.0.1:5001")
    app.run(debug=True, host="127.0.0.1", port=5001, use_reloader=False)