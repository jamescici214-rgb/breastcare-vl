from __future__ import annotations

from modules.birads_rules import predict_birads
from modules.image_qc import analyze_image_quality
from modules.report_generator import generate_ai_report
from modules.report_qc import check_report_completeness


def load_qwen_vl_model(model_path: str | None = None):
    """Qwen2.5-VL model loading entry point.

    接入真实模型时，建议在这里加载 processor / tokenizer / model，并做缓存。
    示例方向：
    - from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration
    - model = Qwen2_5_VLForConditionalGeneration.from_pretrained(model_path, ...)
    - processor = AutoProcessor.from_pretrained(model_path)
    - return {"model": model, "processor": processor}
    """
    raise NotImplementedError("当前 Demo 使用规则推理模拟多模态大模型，尚未接入真实 Qwen2.5-VL。")


def run_qwen_vl_inference(image, report_text: str, structured_fields: dict, model_bundle=None) -> dict:
    """Qwen2.5-VL multimodal inference entry point.

    接入真实模型时，建议在这里把乳腺超声图像、结构化字段和原始报告文本
    组装成多模态 prompt，让模型输出 JSON，再映射到 diagnosis_result：
    birads、malignancy_probability、cancer_prediction、risk_level、evidence、recommendation。
    """
    raise NotImplementedError("当前 Demo 使用规则推理模拟多模态大模型，尚未接入真实 Qwen2.5-VL。")


def run_multimodal_inference(image, report_text: str, structured_fields: dict) -> dict:
    image_qc_result = analyze_image_quality(image)
    report_qc_result = check_report_completeness(report_text, structured_fields)

    # Qwen2.5-VL 接入位置：
    # 1. 先保留 image_qc_result 和 report_qc_result，作为模型输入前后的质量控制结果。
    # 2. 将下面的 predict_birads(structured_fields) 替换为 run_qwen_vl_inference(...)。
    # 3. 真实模型输出仍建议经过 birads_rules 做兜底校验，保证比赛 Demo 稳定可解释。
    diagnosis_result = predict_birads(structured_fields)

    qc_result = {
        "image_qc": image_qc_result,
        "report_qc": report_qc_result,
    }
    ai_report = generate_ai_report(structured_fields, diagnosis_result, qc_result)

    return {
        "model_mode": "规则推理模拟多模态智能诊断",
        "image_qc": image_qc_result,
        "report_qc": report_qc_result,
        "diagnosis": diagnosis_result,
        "ai_report": ai_report,
    }
