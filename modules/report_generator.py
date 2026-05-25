from __future__ import annotations


def _value(data: dict, key: str, default: str = "未填写") -> str:
    value = data.get(key)
    if value is None or str(value).strip() == "":
        return default
    return str(value)


def generate_ai_report(patient_info: dict, diagnosis_result: dict, qc_result: dict) -> str:
    image_qc = qc_result.get("image_qc", {})
    report_qc = qc_result.get("report_qc", {})
    evidence = diagnosis_result.get("evidence", [])
    evidence_text = "\n".join(f"{index}. {item}" for index, item in enumerate(evidence, start=1))
    missing_items = report_qc.get("missing_items", [])
    missing_text = "、".join(missing_items) if missing_items else "未发现关键字段缺失"

    return f"""乳影智诊 AI 辅助筛查报告

一、患者信息
年龄：{_value(patient_info, "age")} 岁
病灶位置：{_value(patient_info, "location")}
病灶大小：{_value(patient_info, "size")}

二、影像特征
形态：{_value(patient_info, "shape")}
边缘：{_value(patient_info, "margin")}
内部回声：{_value(patient_info, "echo")}
纵横比是否大于1：{_value(patient_info, "aspect_ratio_gt_1")}
钙化情况：{_value(patient_info, "calcification")}
后方回声：{_value(patient_info, "posterior_echo")}
血流信号：{_value(patient_info, "blood_flow")}
腋窝淋巴结：{_value(patient_info, "axillary_lymph_node")}

三、图像质控结果
图像质量评分：{image_qc.get("quality_score", "未评估")}/100
亮度：{image_qc.get("brightness", "未评估")}
清晰度 Laplacian 方差：{image_qc.get("sharpness", "未评估")}
对比度：{image_qc.get("contrast", "未评估")}
质控结论：{image_qc.get("conclusion", "未评估")}

四、报告完整性质控结果
报告完整性评分：{report_qc.get("completeness_score", "未评估")}/100
缺失信息：{missing_text}

五、AI 辅助风险评估
BI-RADS 分级：{diagnosis_result.get("birads")}
良恶性倾向：{diagnosis_result.get("cancer_prediction")}
恶性风险概率：{diagnosis_result.get("malignancy_probability", 0) * 100:.0f}%
风险等级：{diagnosis_result.get("risk_level")}

六、主要依据
{evidence_text}

七、辅助建议
{diagnosis_result.get("recommendation")}

八、免责声明
本系统仅用于科研展示和辅助筛查，不替代医生最终诊断。"""
