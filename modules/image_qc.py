from __future__ import annotations

import cv2
import numpy as np
from PIL import Image

from modules.utils import clamp


def _to_gray_array(image) -> np.ndarray | None:
    if image is None:
        return None
    if not isinstance(image, Image.Image):
        image = Image.open(image)
    gray_image = image.convert("L")
    return np.asarray(gray_image, dtype=np.uint8)


def analyze_image_quality(image) -> dict:
    """Analyze basic ultrasound image quality metrics."""
    gray = _to_gray_array(image)
    if gray is None:
        return {
            "brightness": None,
            "sharpness": None,
            "contrast": None,
            "quality_score": 0,
            "conclusion": "未上传图像，暂无法完成图像质量控制。",
            "warnings": ["请上传乳腺超声图像，以便评估亮度、清晰度和对比度。"],
        }

    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    contrast = float(np.std(gray))

    brightness_score = clamp(100 - abs(brightness - 128) / 128 * 100)
    sharpness_score = clamp(sharpness / 120 * 100)
    contrast_score = clamp(contrast / 55 * 100)
    quality_score = round(
        0.35 * brightness_score + 0.4 * sharpness_score + 0.25 * contrast_score,
        1,
    )

    warnings: list[str] = []
    if brightness < 45:
        warnings.append("图像整体偏暗，建议提高采集增益或调整动态范围。")
    elif brightness > 215:
        warnings.append("图像整体偏亮，可能影响低回声病灶边界观察。")

    if sharpness < 45:
        warnings.append("图像清晰度偏低，疑似存在运动伪影或聚焦不足。")

    if contrast < 22:
        warnings.append("图像对比度偏低，建议优化增益、聚焦和灰阶参数。")

    if quality_score >= 85:
        conclusion = "图像质量良好，可用于辅助筛查分析。"
    elif quality_score >= 70:
        conclusion = "图像质量基本可用，建议结合原始动态扫查信息综合判断。"
    elif quality_score >= 50:
        conclusion = "图像质量一般，部分征象可能存在识别不充分风险。"
    else:
        conclusion = "图像质量较差，建议重新采集或由医生复核。"

    return {
        "brightness": round(brightness, 2),
        "sharpness": round(sharpness, 2),
        "contrast": round(contrast, 2),
        "quality_score": quality_score,
        "conclusion": conclusion,
        "warnings": warnings,
    }
