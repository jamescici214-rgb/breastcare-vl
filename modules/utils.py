from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Any


def clamp(value: float, minimum: float = 0, maximum: float = 100) -> float:
    return max(minimum, min(maximum, value))


def is_missing(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() in {"", "未描述", "无记录", "未知", "请选择"}
    return False


def normalize_text(text: str | None) -> str:
    return (text or "").strip()


def yes_no_to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).strip() in {"是", "yes", "true", "True", "1"}


def risk_color(risk_level: str) -> str:
    palette = {
        "低风险": "#22C55E",
        "中低风险": "#F59E0B",
        "中风险": "#F59E0B",
        "中高风险": "#EF4444",
        "高风险": "#EF4444",
    }
    return palette.get(risk_level, "#334155")


def score_color(score: float) -> str:
    if score >= 85:
        return "#059669"
    if score >= 70:
        return "#2563EB"
    if score >= 50:
        return "#D97706"
    return "#DC2626"


def save_text_report(report_text: str, output_dir: str | Path) -> Path:
    target_dir = Path(output_dir)
    target_dir.mkdir(parents=True, exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = target_dir / f"ai_screening_report_{timestamp}.txt"
    output_path.write_text(report_text, encoding="utf-8")
    return output_path
