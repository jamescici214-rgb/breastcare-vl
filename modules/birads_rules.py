from __future__ import annotations

from modules.utils import yes_no_to_bool


def predict_birads(features: dict) -> dict:
    suspicious_score = 0
    evidence: list[str] = []

    def add_evidence(condition: bool, description: str) -> None:
        nonlocal suspicious_score
        if condition:
            suspicious_score += 1
            evidence.append(description)

    shape = features.get("shape")
    margin = features.get("margin")
    aspect_ratio_gt_1 = features.get("aspect_ratio_gt_1")
    calcification = features.get("calcification")
    posterior_echo = features.get("posterior_echo")
    blood_flow = features.get("blood_flow")
    axillary_lymph_node = features.get("axillary_lymph_node")

    add_evidence(shape == "不规则", "形态不规则，提示恶性风险升高。")
    add_evidence(margin in {"欠清", "模糊", "毛刺"}, f"边缘表现为{margin}，属于可疑征象。")
    add_evidence(yes_no_to_bool(aspect_ratio_gt_1), "纵横比大于1，提示垂直生长倾向。")
    add_evidence(calcification in {"微钙化", "点状强回声"}, f"存在{calcification}，需警惕恶性可能。")
    add_evidence(posterior_echo == "声影", "后方伴声影，属于可疑声像图表现。")
    add_evidence(blood_flow == "丰富", "血流信号丰富，提示病灶活跃度较高。")
    add_evidence(axillary_lymph_node == "异常", "腋窝淋巴结异常，需结合临床进一步评估。")

    if suspicious_score == 0:
        birads = "BI-RADS 3"
        malignancy_probability = 0.03
        cancer_prediction = "倾向良性"
        risk_level = "低风险"
        recommendation = "建议短期随访，结合既往影像和临床体征由医生综合判断。"
    elif suspicious_score == 1:
        birads = "BI-RADS 4a"
        malignancy_probability = 0.1
        cancer_prediction = "低度可疑"
        risk_level = "中低风险"
        recommendation = "建议专科复核，必要时进一步影像检查或随访。"
    elif suspicious_score == 2:
        birads = "BI-RADS 4b"
        malignancy_probability = 0.28
        cancer_prediction = "中度可疑"
        risk_level = "中风险"
        recommendation = "建议乳腺专科进一步评估，结合临床考虑穿刺活检。"
    elif suspicious_score <= 4:
        birads = "BI-RADS 4c"
        malignancy_probability = 0.58 if suspicious_score == 3 else 0.76
        cancer_prediction = "高度可疑"
        risk_level = "中高风险"
        recommendation = "建议尽快完善专科检查，优先考虑组织学取样明确性质。"
    else:
        birads = "BI-RADS 5"
        malignancy_probability = min(0.95, 0.84 + 0.02 * (suspicious_score - 5))
        cancer_prediction = "高度提示恶性"
        risk_level = "高风险"
        recommendation = "建议尽快转诊乳腺专科，完善穿刺活检和规范化诊疗评估。"

    if not evidence:
        evidence.append("未见规则库定义的明确可疑恶性征象。")

    return {
        "birads": birads,
        "suspicious_score": suspicious_score,
        "malignancy_probability": round(malignancy_probability, 2),
        "cancer_prediction": cancer_prediction,
        "risk_level": risk_level,
        "evidence": evidence,
        "recommendation": recommendation,
    }
