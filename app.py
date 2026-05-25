from __future__ import annotations

import json
from html import escape
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import streamlit as st
from PIL import Image

from modules.inference_engine import run_multimodal_inference
from modules.utils import clamp, risk_color, save_text_report, score_color


BASE_DIR = Path(__file__).resolve().parent
SAMPLE_DIR = BASE_DIR / "sample_data"
OUTPUT_DIR = BASE_DIR / "outputs" / "generated_reports"

SHAPE_OPTIONS = ["规则", "不规则", "分叶状"]
MARGIN_OPTIONS = ["清楚", "欠清", "模糊", "毛刺"]
ECHO_OPTIONS = ["无回声", "低回声", "等回声", "高回声", "混合回声"]
YES_NO_OPTIONS = ["否", "是"]
CALCIFICATION_OPTIONS = ["无", "粗大钙化", "点状强回声", "微钙化"]
POSTERIOR_OPTIONS = ["无明显改变", "增强", "衰减", "声影"]
BLOOD_FLOW_OPTIONS = ["无", "少量", "丰富"]
LYMPH_NODE_OPTIONS = ["正常", "异常", "未描述"]

DEFAULT_FIELDS = {
    "age": 45,
    "location": "左乳外上象限",
    "size": "12 mm × 8 mm",
    "shape": "规则",
    "margin": "清楚",
    "echo": "低回声",
    "aspect_ratio_gt_1": "否",
    "calcification": "无",
    "posterior_echo": "无明显改变",
    "blood_flow": "少量",
    "axillary_lymph_node": "正常",
    "report_text": "",
}


st.set_page_config(
    page_title="乳影智诊",
    page_icon="乳",
    layout="wide",
    initial_sidebar_state="collapsed",
)


st.markdown(
    """
    <style>
    :root {
        --page: #F5F5F5;
        --page-2: #FFFFFF;
        --card: #FFFFFF;
        --primary: #1565C0;
        --primary-hover: #1976D2;
        --primary-deep: #0D47A1;
        --primary-soft: #E3F2FD;
        --primary-grad: linear-gradient(135deg, #1976D2 0%, #0D47A1 100%);
        --ai: #0EA5A4;          /* our signature AI teal */
        --ai-soft: #CCFBF1;
        --ai-grad: linear-gradient(135deg, #14B8A6 0%, #0EA5A4 60%, #1976D2 100%);
        --text: rgba(0, 0, 0, 0.85);
        --text-2: rgba(0, 0, 0, 0.75);
        --text-3: #475569;
        --muted: #546E7A;
        --line: #E5E7EB;
        --line-soft: rgba(0, 0, 0, 0.06);
        --success: #16A34A;
        --warning: #F59E0B;
        --danger: #DC2626;
        --info: #0284C7;
        --radius-card: 16px;
        --radius-panel: 12px;
        --radius-input: 8px;
        --shadow-card: 0 4px 20px rgba(0, 0, 0, 0.10);
        --shadow-card-hover: 0 8px 28px rgba(21, 101, 192, 0.16);
        --shadow-soft: 0 4px 20px rgba(0, 0, 0, 0.06);
        --easing: cubic-bezier(.25, .8, .25, 1);
    }
    html, body, [class*="css"] {
        font-family: "Microsoft YaHei", "PingFang SC", -apple-system, BlinkMacSystemFont,
                     "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        color: var(--text);
    }
    .stApp { background: var(--page); }
    .block-container {
        max-width: 1480px;
        padding-top: 1.2rem;
        padding-bottom: 2.4rem;
    }
    header[data-testid="stHeader"] {
        background: rgba(245, 245, 245, 0.78);
        backdrop-filter: blur(10px);
        border-bottom: 1px solid var(--line);
    }
    h1, h2, h3, h4, h5, h6, p, span, label { color: var(--text); }
    [data-testid="stMarkdownContainer"] p { color: var(--text-2); }
    h4 {
        color: var(--primary) !important;
        font-size: 1rem !important;
        font-weight: 700 !important;
        margin: .25rem 0 .65rem !important;
        letter-spacing: .01em;
    }

    /* ===== Hero banner (DeepRare-style hero with our AI ribbon) ===== */
    .platform-banner {
        position: relative;
        overflow: hidden;
        padding: 1.85rem 2rem 1.95rem;
        border-radius: var(--radius-card);
        background:
            radial-gradient(900px 360px at 92% -10%, rgba(14,165,164,.18), transparent 60%),
            radial-gradient(700px 320px at -8% 110%, rgba(13,71,161,.18), transparent 60%),
            var(--primary-grad);
        color: #FFFFFF;
        box-shadow: 0 12px 36px rgba(13, 71, 161, 0.22);
        margin-bottom: 1.15rem;
    }
    .platform-banner::before {
        /* subtle data-point texture — our AI signature */
        content: "";
        position: absolute; inset: 0;
        background-image:
            radial-gradient(rgba(255,255,255,0.18) 1px, transparent 1.4px),
            radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px);
        background-size: 28px 28px, 56px 56px;
        background-position: 0 0, 14px 14px;
        opacity: .35;
        pointer-events: none;
    }
    .platform-banner::after {
        /* soft scan-light sweep — our identity */
        content: "";
        position: absolute;
        top: -40%; right: -10%;
        width: 520px; height: 520px;
        background: radial-gradient(closest-side, rgba(204,251,241,.22), transparent 70%);
        filter: blur(8px);
        pointer-events: none;
    }
    .banner-kicker {
        display: inline-flex; align-items: center; gap: .55rem;
        padding: .35rem .85rem;
        color: #E6F3FF;
        background: rgba(255,255,255,0.14);
        border: 1px solid rgba(255,255,255,0.28);
        border-radius: 999px;
        font-size: .82rem; font-weight: 600;
        letter-spacing: .04em;
        margin-bottom: .8rem;
        backdrop-filter: blur(4px);
        position: relative; z-index: 1;
    }
    .banner-kicker::before {
        content: ""; width: 7px; height: 7px; border-radius: 50%;
        background: #5EEAD4;
        box-shadow: 0 0 10px #5EEAD4;
    }
    .banner-title {
        position: relative; z-index: 1;
        max-width: 1080px;
        color: #FFFFFF;
        font-size: clamp(1.7rem, 2.4vw, 2.4rem);
        line-height: 1.22;
        font-weight: 700;
        letter-spacing: .005em;
        margin-bottom: .55rem;
    }
    .banner-title b {
        color: #FFFFFF;
        position: relative;
        padding-right: .15em;
    }
    .banner-title b::after {
        /* underline accent in our AI teal */
        content: "";
        position: absolute; left: 0; right: .15em; bottom: -.1em;
        height: 4px;
        background: linear-gradient(90deg, #5EEAD4, rgba(94,234,212,0));
        border-radius: 2px;
    }
    .banner-subtitle {
        position: relative; z-index: 1;
        max-width: 1000px;
        color: rgba(255,255,255,0.88);
        font-size: 1rem;
        line-height: 1.78;
    }
    .capability-row {
        position: relative; z-index: 1;
        display: flex; flex-wrap: wrap; gap: .5rem;
        margin-top: 1.1rem;
    }
    .capability-pill {
        padding: .45rem .85rem;
        border-radius: 999px;
        color: #FFFFFF;
        background: rgba(255,255,255,0.12);
        border: 1px solid rgba(255,255,255,0.26);
        font-weight: 500;
        font-size: .86rem;
        backdrop-filter: blur(4px);
        transition: var(--easing) all;
    }
    .capability-pill:hover {
        background: rgba(255,255,255,0.22);
        border-color: rgba(255,255,255,0.55);
        transform: translateY(-1px);
    }

    /* ===== Section headers ===== */
    .section-head {
        display: flex; align-items: center; justify-content: space-between;
        gap: .75rem;
        margin: .25rem 0 .8rem;
    }
    .section-title {
        position: relative;
        color: var(--text);
        font-weight: 700;
        font-size: 1.15rem;
        letter-spacing: .005em;
        padding-left: .85rem;
    }
    .section-title::before {
        content: "";
        position: absolute; left: 0; top: 50%;
        transform: translateY(-50%);
        width: 4px; height: 18px;
        border-radius: 2px;
        background: linear-gradient(180deg, var(--primary) 0%, var(--ai) 100%);
    }
    .section-caption {
        color: var(--muted);
        font-size: .85rem;
        font-weight: 500;
    }

    /* ===== Cards / panels (DeepRare doctor-box DNA) ===== */
    .result-card {
        position: relative;
        min-height: 144px;
        border-radius: var(--radius-card);
        background: var(--card);
        border: 1px solid rgba(0,0,0,0.02);
        box-shadow: var(--shadow-card);
        padding: 1.1rem 1.15rem 1.2rem;
        transition: var(--easing) all;
        overflow: hidden;
    }
    .result-card::before {
        /* slim accent stripe at top */
        content: "";
        position: absolute; left: 0; right: 0; top: 0;
        height: 3px;
        background: var(--primary);
    }
    .result-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-card-hover);
    }
    .result-label {
        display: flex; align-items: center; gap: .55rem;
        color: var(--text-3);
        font-size: .88rem;
        font-weight: 600;
        margin-bottom: .65rem;
    }
    .result-icon {
        display: inline-grid; place-items: center;
        width: 28px; height: 28px;
        border-radius: 8px;
        color: #FFFFFF;
        background: var(--primary);
        font-weight: 700;
        font-size: .76rem;
        letter-spacing: .02em;
    }
    .result-value {
        color: var(--text);
        font-size: 1.85rem;
        line-height: 1.12;
        font-weight: 700;
        letter-spacing: .005em;
        word-break: break-word;
    }
    .result-note {
        color: var(--muted);
        font-size: .86rem;
        line-height: 1.55;
        margin-top: .6rem;
    }

    /* ===== QC cards ===== */
    .qc-card {
        position: relative;
        border-radius: var(--radius-card);
        background: var(--card);
        border: 1px solid rgba(0,0,0,0.02);
        box-shadow: var(--shadow-card);
        padding: 1.1rem 1.15rem;
        min-height: 134px;
        transition: var(--easing) all;
        overflow: hidden;
    }
    .qc-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card-hover); }
    .qc-card::before {
        content: ""; position: absolute;
        left: 0; top: 0; bottom: 0; width: 3px;
        background: linear-gradient(180deg, var(--primary), var(--ai));
    }
    .qc-score {
        font-size: 2.05rem; font-weight: 700;
        line-height: 1; margin: .42rem 0;
        letter-spacing: .005em;
    }
    .qc-score small {
        font-size: .85rem; color: #94A3B8; font-weight: 600;
        margin-left: .15rem;
    }
    .qc-name {
        color: var(--text-3);
        font-size: .9rem;
        font-weight: 600;
    }
    .qc-desc {
        color: var(--muted);
        font-size: .84rem;
        line-height: 1.55;
        margin-top: .25rem;
    }

    /* ===== Clinical evidence tags ===== */
    .clinical-tag-wrap {
        display: flex; flex-wrap: wrap; gap: .55rem;
        margin: .4rem 0 .15rem;
    }
    .clinical-tag {
        display: inline-flex; align-items: center; gap: .5rem;
        padding: .5rem .85rem;
        color: var(--primary);
        background: var(--primary-soft);
        border: 1px solid rgba(21,101,192,0.16);
        border-radius: 999px;
        font-size: .9rem;
        font-weight: 600;
        transition: var(--easing) all;
    }
    .clinical-tag:hover {
        background: #D8ECFD;
        border-color: rgba(21,101,192,0.32);
    }
    .tag-icon {
        display: inline-grid; place-items: center;
        width: 20px; height: 20px;
        border-radius: 50%;
        color: #FFFFFF;
        background: var(--ai);
        font-size: .82rem; font-weight: 700;
    }

    /* ===== Empty state ===== */
    .empty-state {
        min-height: 440px;
        display: grid; place-items: center;
        border-radius: var(--radius-card);
        border: 1px solid var(--line);
        background:
            radial-gradient(closest-side at 50% 30%, rgba(21,101,192,0.06), transparent 70%),
            var(--card);
        box-shadow: var(--shadow-soft);
        text-align: center;
        padding: 2.2rem;
        position: relative;
    }
    .empty-state .empty-bubble {
        width: 64px; height: 64px;
        border-radius: 50%;
        display: grid; place-items: center;
        background: var(--primary-soft);
        color: var(--primary);
        font-size: 1.6rem; font-weight: 700;
        margin: 0 auto 1.05rem;
        border: 1px solid rgba(21,101,192,0.16);
    }
    .empty-title {
        color: var(--text);
        font-size: 1.35rem; font-weight: 700;
        margin-bottom: .55rem;
    }
    .empty-copy {
        color: var(--muted);
        max-width: 540px;
        line-height: 1.78;
        font-size: .96rem;
    }

    /* ===== Notice ===== */
    .notice-box {
        border-radius: var(--radius-panel);
        background: #FFFFFF;
        border: 1px solid var(--line);
        box-shadow: var(--shadow-soft);
        padding: .95rem 1.05rem;
        position: relative;
    }
    .notice-box::before {
        content: ""; position: absolute;
        left: 0; top: 0; bottom: 0; width: 3px;
        background: var(--info);
        border-top-left-radius: var(--radius-panel);
        border-bottom-left-radius: var(--radius-panel);
    }
    .notice-title {
        color: var(--primary);
        font-weight: 700;
        font-size: .98rem;
        margin-bottom: .3rem;
    }
    .notice-body {
        color: var(--text-3);
        font-size: .92rem;
        line-height: 1.7;
    }

    /* ===== Disclaimer ===== */
    .disclaimer {
        margin-top: 1.15rem;
        padding: .95rem 1.05rem;
        border-radius: var(--radius-panel);
        border: 1px solid #FCA5A5;
        background: #FEF2F2;
        color: #B91C1C;
        font-weight: 600;
        text-align: center;
        letter-spacing: .005em;
    }

    /* ===== Streamlit container override ===== */
    div[data-testid="stVerticalBlockBorderWrapper"] {
        border-radius: var(--radius-card) !important;
        border: 1px solid rgba(0,0,0,0.02) !important;
        background: var(--card) !important;
        box-shadow: var(--shadow-card);
        transition: var(--easing) all;
    }

    /* ===== File uploader ===== */
    div[data-testid="stFileUploader"] section {
        background: #FAFCFF !important;
        border: 1.5px dashed #BFD9F1 !important;
        border-radius: var(--radius-panel) !important;
        color: var(--text) !important;
    }
    div[data-testid="stFileUploader"] * { color: var(--text-2) !important; }
    div[data-testid="stFileUploader"] button {
        background: var(--primary-soft) !important;
        color: var(--primary) !important;
        border: 1px solid rgba(21,101,192,0.22) !important;
        border-radius: 8px !important;
        font-weight: 600 !important;
    }

    /* ===== Inputs ===== */
    .stTextInput input,
    .stNumberInput input,
    textarea {
        background-color: #FFFFFF !important;
        color: var(--text) !important;
        border: 1px solid #D8DEE6 !important;
        border-radius: var(--radius-input) !important;
        box-shadow: none !important;
        transition: var(--easing) all;
    }
    .stTextInput input::placeholder,
    textarea::placeholder { color: #9AA7B5 !important; }
    .stTextInput input:focus,
    .stNumberInput input:focus,
    textarea:focus {
        border-color: var(--primary) !important;
        box-shadow: 0 0 0 3px rgba(21,101,192,0.14) !important;
    }
    .stNumberInput button {
        background: var(--primary-soft) !important;
        color: var(--primary) !important;
        border-color: rgba(21,101,192,0.22) !important;
    }
    div[data-baseweb="select"] > div {
        background-color: #FFFFFF !important;
        color: var(--text) !important;
        border-color: #D8DEE6 !important;
        border-radius: var(--radius-input) !important;
    }
    div[data-baseweb="select"]:hover > div {
        border-color: var(--primary) !important;
    }
    div[data-baseweb="select"] span,
    div[data-baseweb="select"] svg {
        color: var(--text) !important;
        fill: var(--text-3) !important;
    }
    div[data-baseweb="popover"] [role="listbox"] {
        background: #FFFFFF !important;
        border: 1px solid var(--line) !important;
        border-radius: var(--radius-input) !important;
        box-shadow: var(--shadow-card);
    }
    div[data-baseweb="popover"] [role="option"] { color: var(--text) !important; }
    div[data-baseweb="popover"] [role="option"]:hover {
        background: var(--primary-soft) !important;
        color: var(--primary) !important;
    }
    label[data-testid="stWidgetLabel"] p {
        color: var(--text-3) !important;
        font-weight: 600;
        font-size: .92rem !important;
    }

    /* ===== Buttons ===== */
    div.stButton > button:first-child {
        width: 100%;
        border-radius: var(--radius-input);
        border: 0;
        color: #FFFFFF;
        background: var(--ai-grad);
        font-weight: 700;
        font-size: 1rem;
        letter-spacing: .02em;
        padding: .9rem 1rem;
        box-shadow: 0 8px 20px rgba(21,101,192,0.22);
        transition: var(--easing) all;
    }
    div.stButton > button:first-child:hover {
        color: #FFFFFF;
        filter: brightness(1.04);
        transform: translateY(-2px);
        box-shadow: 0 12px 28px rgba(21,101,192,0.30);
    }
    div.stButton > button:first-child:disabled {
        background: #E5E7EB !important;
        color: #94A3B8 !important;
        box-shadow: none !important;
        transform: none !important;
    }
    div.stDownloadButton > button:first-child {
        width: 100%;
        border-radius: var(--radius-input);
        border: 1px solid var(--primary);
        color: var(--primary);
        background: #FFFFFF;
        font-weight: 600;
        transition: var(--easing) all;
    }
    div.stDownloadButton > button:first-child:hover {
        background: var(--primary-soft);
        color: var(--primary-deep);
        transform: translateY(-1px);
    }

    /* ===== Alerts ===== */
    .stAlert {
        border-radius: var(--radius-panel) !important;
        border: 1px solid var(--line) !important;
    }

    /* ===== DataFrame ===== */
    div[data-testid="stDataFrame"] {
        border-radius: var(--radius-panel);
        overflow: hidden;
        border: 1px solid var(--line);
        background: #FFFFFF;
    }

    /* ===== Captions ===== */
    [data-testid="stCaptionContainer"] { color: var(--muted) !important; }

    [data-testid="stImage"] figcaption,
    [data-testid="stImageCaption"] {
        color: var(--muted) !important;
        text-align: center;
        font-size: .86rem;
    }

    @media (max-width: 900px) {
        .banner-title { font-size: 1.55rem; }
        .result-value { font-size: 1.5rem; }
    }
    </style>
    """,
    unsafe_allow_html=True,
)


@st.cache_data
def load_sample_cases() -> dict:
    cases = {}
    if not SAMPLE_DIR.exists():
        return cases
    for path in sorted(SAMPLE_DIR.glob("case_*.json")):
        with path.open("r", encoding="utf-8") as file:
            cases[path.stem] = json.load(file)
    return cases


def initialize_state() -> None:
    for key, value in DEFAULT_FIELDS.items():
        st.session_state.setdefault(key, value)


def load_case_into_state(case: dict) -> None:
    fields = case.get("structured_fields", {})
    for key, value in fields.items():
        st.session_state[key] = value
    st.session_state["report_text"] = case.get("report_text", "")


def render_banner() -> None:
    tags = [
        "图像质控",
        "报告完整性检查",
        "BI-RADS 风险分级",
        "可疑征象解释",
        "AI 报告生成",
    ]
    tag_html = "".join(f'<span class="capability-pill">{escape(tag)}</span>' for tag in tags)
    st.markdown(
        f"""
        <div class="platform-banner">
            <div class="banner-kicker">乳腺超声 · 多模态 AI 辅助筛查平台</div>
            <div class="banner-title"><b>乳影智诊</b>　面向基层乳腺超声筛查的多模态智能诊断与质控系统</div>
            <div class="banner-subtitle">
                面向基层乳腺超声筛查场景，融合图像质量控制、结构化报告质控、BI-RADS 规则推理、
                良恶性风险预测和标准化辅助报告生成，帮助比赛路演更直观地展示 AI 医疗筛查闭环。
            </div>
            <div class="capability-row">{tag_html}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_section_head(title: str, caption: str = "") -> None:
    st.markdown(
        f"""
        <div class="section-head">
            <div class="section-title">{escape(title)}</div>
            <div class="section-caption">{escape(caption)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_result_card(title: str, value: str, note: str, color: str, icon: str) -> None:
    st.markdown(
        f"""
        <div class="result-card" style="border-top-color: {color};">
            <div class="result-label">
                <span class="result-icon" style="background: {color};">{escape(icon)}</span>
                <span>{escape(title)}</span>
            </div>
            <div class="result-value">{escape(value)}</div>
            <div class="result-note">{escape(note)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_qc_card(title: str, score: float, description: str, color: str) -> None:
    st.markdown(
        f"""
        <div class="qc-card">
            <div class="qc-name">{escape(title)}</div>
            <div class="qc-score" style="color: {color};">{score:.1f}<small> / 100</small></div>
            <div class="qc-desc">{escape(description)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_empty_state() -> None:
    st.markdown(
        """
        <div class="empty-state">
            <div>
                <div class="empty-bubble">AI</div>
                <div class="empty-title">等待病例输入</div>
                <div class="empty-copy">
                    请在左侧上传乳腺超声图像并填写结构化征象，点击“开始智能分析”后，
                    系统将在此生成 BI-RADS 分级、良恶性风险、质控评分和标准化 AI 报告。
                </div>
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


def render_probability_gauge(probability: float, color: str) -> None:
    fig = go.Figure(
        go.Indicator(
            mode="gauge+number",
            value=probability * 100,
            number={"suffix": "%", "font": {"size": 38, "color": "#0D47A1"}},
            title={"text": "恶性风险概率", "font": {"size": 16, "color": "#475569"}},
            gauge={
                "shape": "angular",
                "axis": {
                    "range": [0, 100],
                    "tickwidth": 1,
                    "tickcolor": "#CBD5E1",
                    "tickfont": {"color": "#64748B", "size": 11},
                },
                "bar": {"color": color, "thickness": 0.24},
                "bgcolor": "#F8FAFC",
                "borderwidth": 0,
                "steps": [
                    {"range": [0, 20], "color": "#DCFCE7"},
                    {"range": [20, 60], "color": "#FEF3C7"},
                    {"range": [60, 100], "color": "#FEE2E2"},
                ],
                "threshold": {
                    "line": {"color": color, "width": 4},
                    "thickness": 0.82,
                    "value": probability * 100,
                },
            },
        )
    )
    fig.update_layout(
        height=290,
        margin={"l": 18, "r": 18, "t": 54, "b": 8},
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        font={"family": "Microsoft YaHei, Arial", "color": "#0F172A"},
    )
    st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})


def compute_diagnostic_confidence(image_score: float, report_score: float, suspicious_score: int) -> float:
    rule_stability = 78 + min(suspicious_score, 5) * 3
    return round(clamp(0.34 * image_score + 0.36 * report_score + 0.30 * rule_stability), 1)


def evidence_labels(diagnosis: dict) -> list[str]:
    labels = []
    for item in diagnosis.get("evidence", []):
        if "未见" in item:
            labels.append("未见明确可疑征象")
        elif "形态不规则" in item:
            labels.append("形态不规则")
        elif "边缘" in item:
            labels.append("边界欠清/毛刺")
        elif "纵横比" in item:
            labels.append("纵横比>1")
        elif "微钙化" in item or "点状强回声" in item:
            labels.append("可疑钙化")
        elif "声影" in item:
            labels.append("后方声影")
        elif "血流" in item:
            labels.append("血流丰富")
        elif "淋巴结" in item:
            labels.append("腋窝淋巴结异常")
        else:
            labels.append(item.split("，")[0])
    return labels


def render_evidence_tags(labels: list[str]) -> None:
    tags = "".join(
        f'<span class="clinical-tag"><span class="tag-icon">+</span>{escape(label)}</span>'
        for label in labels
    )
    st.markdown(f'<div class="clinical-tag-wrap">{tags}</div>', unsafe_allow_html=True)


def render_notice(title: str, body: str) -> None:
    st.markdown(
        f"""
        <div class="notice-box">
            <div class="notice-title">{escape(title)}</div>
            <div class="notice-body">{escape(body)}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


initialize_state()
sample_cases = load_sample_cases()
render_banner()

input_col, result_col = st.columns([0.88, 1.24], gap="large")

with input_col:
    render_section_head("病例输入区", "结构化征象 + 原始报告")
    with st.container(border=True):
        if sample_cases:
            sample_choice = st.selectbox(
                "示例病例",
                ["手动输入"] + list(sample_cases.keys()),
                help="可一键载入示例结构化信息，图像仍可自行上传。",
            )
            if st.button("载入示例病例", use_container_width=True, disabled=sample_choice == "手动输入"):
                load_case_into_state(sample_cases[sample_choice])
                st.success(f"已载入 {sample_choice}")

        uploaded_file = st.file_uploader("上传乳腺超声图像", type=["jpg", "jpeg", "png"])
        image = None
        if uploaded_file is not None:
            image = Image.open(uploaded_file).convert("RGB")
            st.image(image, caption="乳腺超声图像", use_container_width=True)
        else:
            st.info("未上传图像时仍可运行结构化规则推理，图像质控会提示待补充。")

        p1, p2 = st.columns([0.42, 0.58])
        with p1:
            age = st.number_input("患者年龄", min_value=1, max_value=120, step=1, key="age")
        with p2:
            location = st.text_input("病灶位置", key="location")
        size = st.text_input("病灶大小", key="size")

        c1, c2 = st.columns(2)
        with c1:
            shape = st.selectbox("形态", SHAPE_OPTIONS, key="shape")
            echo = st.selectbox("回声", ECHO_OPTIONS, key="echo")
            calcification = st.selectbox("钙化情况", CALCIFICATION_OPTIONS, key="calcification")
            blood_flow = st.selectbox("血流信号", BLOOD_FLOW_OPTIONS, key="blood_flow")
        with c2:
            margin = st.selectbox("边缘", MARGIN_OPTIONS, key="margin")
            aspect_ratio_gt_1 = st.selectbox("纵横比是否大于1", YES_NO_OPTIONS, key="aspect_ratio_gt_1")
            posterior_echo = st.selectbox("后方回声", POSTERIOR_OPTIONS, key="posterior_echo")
            axillary_lymph_node = st.selectbox("腋窝淋巴结", LYMPH_NODE_OPTIONS, key="axillary_lymph_node")

        report_text = st.text_area(
            "医生原始超声报告文本",
            key="report_text",
            height=168,
            placeholder="示例：左乳外上象限见低回声结节，大小约12 mm × 8 mm，边界清楚，形态规则，未见明显钙化...",
        )

        structured_fields = {
            "age": age,
            "location": location,
            "size": size,
            "shape": shape,
            "margin": margin,
            "echo": echo,
            "aspect_ratio_gt_1": aspect_ratio_gt_1,
            "calcification": calcification,
            "posterior_echo": posterior_echo,
            "blood_flow": blood_flow,
            "axillary_lymph_node": axillary_lymph_node,
        }

        analyze_clicked = st.button("开始智能分析", use_container_width=True)
        if analyze_clicked:
            with st.spinner("正在进行图像质控、报告质控与多模态规则推理..."):
                result = run_multimodal_inference(image, report_text, structured_fields)
                report_path = save_text_report(result["ai_report"], OUTPUT_DIR)
                result["report_path"] = str(report_path)
                st.session_state["analysis_result"] = result
            st.success("智能分析完成")

with result_col:
    render_section_head("AI 诊断结果区", "BI-RADS + 风险分层 + 解释依据")
    result = st.session_state.get("analysis_result")

    if not result:
        render_empty_state()
    else:
        diagnosis = result["diagnosis"]
        image_qc = result["image_qc"]
        report_qc = result["report_qc"]
        probability = diagnosis["malignancy_probability"]
        risk = diagnosis["risk_level"]
        risk_hex = risk_color(risk)
        image_score = float(image_qc["quality_score"])
        report_score = float(report_qc["completeness_score"])
        confidence_score = compute_diagnostic_confidence(
            image_score,
            report_score,
            int(diagnosis["suspicious_score"]),
        )

        r1, r2, r3 = st.columns(3)
        with r1:
            render_result_card(
                "BI-RADS 分级",
                diagnosis["birads"],
                f"可疑征象计分：{diagnosis['suspicious_score']}",
                risk_hex,
                "B",
            )
        with r2:
            render_result_card(
                "良恶性预测",
                diagnosis["cancer_prediction"],
                "规则推理模拟多模态智能诊断",
                risk_hex,
                "AI",
            )
        with r3:
            render_result_card(
                "风险等级",
                risk,
                "用于辅助筛查分流，不替代医生诊断",
                risk_hex,
                "R",
            )

        gauge_col, explain_col = st.columns([0.9, 1.1], gap="large")
        with gauge_col:
            with st.container(border=True):
                render_probability_gauge(probability, risk_hex)
        with explain_col:
            with st.container(border=True):
                st.markdown("#### 可疑征象标签")
                render_evidence_tags(evidence_labels(diagnosis))
                st.markdown("#### AI 辅助诊断建议")
                st.info(diagnosis["recommendation"])

        q1, q2, q3 = st.columns(3)
        with q1:
            render_qc_card("图像质量评分", image_score, image_qc["conclusion"], score_color(image_score))
        with q2:
            render_qc_card("报告完整性评分", report_score, "关键结构化字段覆盖率", score_color(report_score))
        with q3:
            render_qc_card("诊断可信度评分", confidence_score, "融合图像质控、报告完整性和规则稳定性", score_color(confidence_score))

        d1, d2 = st.columns([0.82, 1.18], gap="large")
        with d1:
            st.markdown("#### 图像质控指标")
            qc_table = pd.DataFrame(
                [
                    {"指标": "亮度", "数值": image_qc.get("brightness", "未评估")},
                    {"指标": "清晰度", "数值": image_qc.get("sharpness", "未评估")},
                    {"指标": "对比度", "数值": image_qc.get("contrast", "未评估")},
                ]
            )
            st.dataframe(qc_table, hide_index=True, use_container_width=True)

            warnings = image_qc.get("warnings", [])
            if warnings:
                render_notice("图像质控提醒", "；".join(warnings))
            else:
                render_notice("图像质控提醒", "图像采集质量未触发明显异常提醒。")

        with d2:
            st.markdown("#### 报告完整性与标准化输出")
            missing_items = report_qc["missing_items"]
            if missing_items:
                st.warning("缺失信息：" + "、".join(missing_items))
                for suggestion in report_qc["suggestions"]:
                    st.caption(suggestion)
            else:
                st.success("报告关键字段完整，未发现明显缺失信息。")

            st.text_area("AI 报告", value=result["ai_report"], height=330, label_visibility="collapsed")
            st.download_button(
                "下载标准化报告",
                data=result["ai_report"].encode("utf-8"),
                file_name="乳影智诊_AI辅助筛查报告.txt",
                mime="text/plain",
                use_container_width=True,
            )
            st.caption(f"报告已保存至：{result.get('report_path')}")

st.markdown(
    '<div class="disclaimer">⚠ 本系统仅用于科研展示和辅助筛查，不替代医生最终诊断</div>',
    unsafe_allow_html=True,
)
