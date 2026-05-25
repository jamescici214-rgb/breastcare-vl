from __future__ import annotations

from modules.utils import is_missing, normalize_text


FIELD_CONFIG = {
    "age": ("年龄", ["年龄", "岁"]),
    "location": ("位置", ["位置", "左乳", "右乳", "象限", "乳腺"]),
    "size": ("大小", ["大小", "尺寸", "mm", "cm", "毫米", "厘米"]),
    "shape": ("形态", ["形态", "规则", "不规则", "分叶"]),
    "margin": ("边缘", ["边缘", "边界", "清楚", "欠清", "模糊", "毛刺"]),
    "echo": ("回声", ["回声", "无回声", "低回声", "等回声", "高回声", "混合回声"]),
    "aspect_ratio_gt_1": ("纵横比", ["纵横比", "纵横径", "前后径", "大于1", "大于 1"]),
    "calcification": ("钙化", ["钙化", "强回声", "微钙化"]),
    "blood_flow": ("血流", ["血流", "CDFI", "彩色多普勒"]),
    "axillary_lymph_node": ("腋窝淋巴结", ["腋窝", "淋巴结"]),
}


def check_report_completeness(report_text: str, structured_fields: dict) -> dict:
    text = normalize_text(report_text)
    missing_items: list[str] = []
    suggestions: list[str] = []

    for field_key, (label, keywords) in FIELD_CONFIG.items():
        field_value = structured_fields.get(field_key)
        has_structured_value = not is_missing(field_value)
        has_text_value = bool(text) and any(keyword in text for keyword in keywords)

        if not has_structured_value and not has_text_value:
            missing_items.append(label)
            suggestions.append(f"建议补充{label}信息，以提升报告结构化完整性。")

    total_fields = len(FIELD_CONFIG)
    completed_fields = total_fields - len(missing_items)
    completeness_score = round(completed_fields / total_fields * 100, 1)

    if not text:
        suggestions.append("原始超声报告文本为空，建议录入医生描述以便进行文本质控。")

    return {
        "completeness_score": completeness_score,
        "missing_items": missing_items,
        "suggestions": suggestions,
    }
