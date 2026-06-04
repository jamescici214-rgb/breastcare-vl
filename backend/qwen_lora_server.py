"""
Local Qwen2.5-VL-7B + LoRA service for BreastCare-VL.

Default model paths:
  base model: E:\\zhz\\7B
  LoRA:       E:\\zhz\\epoch-5

Run smoke test:
  python backend/qwen_lora_server.py --smoke-test --image E:\\path\\to\\ultrasound.jpg

Run API server:
  python backend/qwen_lora_server.py --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Dict, List, Optional

import torch
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from transformers import AutoProcessor, Qwen2_5_VLForConditionalGeneration

try:
    from peft import PeftModel
except ImportError as exc:  # pragma: no cover
    raise RuntimeError("缺少 peft，请先安装：pip install peft") from exc

try:
    from qwen_vl_utils import process_vision_info
except ImportError as exc:  # pragma: no cover
    raise RuntimeError("缺少 qwen-vl-utils，请先安装：pip install qwen-vl-utils") from exc


DEFAULT_BASE_MODEL = r"E:\zhz\7B"
DEFAULT_LORA = r"E:\zhz\outputs_multiturn\7B-lora-recheck\2026-06-02_10-52-37\epoch-5"

SYSTEM_PROMPT = """你是乳腺超声辅助筛查系统的结构化诊断模块。
系统仅用于科研展示和乳腺超声辅助筛查，不替代医生最终诊断。
请基于乳腺超声图像、结构化字段、原始报告和标准标签判断 BI-RADS 分级与 Cancer 良恶性。
如果无法确认征象，不要编造。
最后必须输出两行：
BI-RADS: <2|3|4a|4b|4c|5>
Cancer: <良性|恶性>
"""


class DiagnoseRequest(BaseModel):
    imageDataUrl: Optional[str] = None
    imagePath: Optional[str] = None
    fields: Dict[str, Any] = Field(default_factory=dict)
    reportText: str = ""
    tags: List[Any] = Field(default_factory=list)
    maxNewTokens: int = 256


class LocalQwenVLService:
    def __init__(
        self,
        base_model_path: str,
        lora_path: str,
        processor_path: Optional[str] = None,
        device_map: str = "auto",
        dtype: str = "bfloat16",
        merge_lora: bool = False,
    ) -> None:
        self.base_model_path = str(Path(base_model_path))
        self.lora_path = str(Path(lora_path))
        self.processor_path = str(Path(processor_path)) if processor_path else self.base_model_path
        self.device_map = device_map
        self.dtype_name = dtype
        self.merge_lora = merge_lora
        self.model = None
        self.processor = None

    def _torch_dtype(self) -> torch.dtype:
        if self.dtype_name == "float16":
            return torch.float16
        if self.dtype_name == "float32":
            return torch.float32
        return torch.bfloat16

    def load(self) -> None:
        if self.model is not None and self.processor is not None:
            return

        self._validate_paths()
        print(f"[BreastCare-Qwen] Loading base model: {self.base_model_path}")
        print(f"[BreastCare-Qwen] Loading LoRA adapter: {self.lora_path}")
        print(f"[BreastCare-Qwen] Processor path: {self.processor_path}")

        base_model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
            self.base_model_path,
            torch_dtype=self._torch_dtype(),
            device_map=self.device_map,
            trust_remote_code=True,
        )
        model = PeftModel.from_pretrained(base_model, self.lora_path)

        if self.merge_lora:
            print("[BreastCare-Qwen] Merging LoRA into base model for inference...")
            model = model.merge_and_unload()

        self.model = model.eval()
        self.processor = AutoProcessor.from_pretrained(self.processor_path, trust_remote_code=True)
        print("[BreastCare-Qwen] Model and LoRA loaded successfully.")

    def _validate_paths(self) -> None:
        required_base = [
            Path(self.base_model_path) / "config.json",
            Path(self.base_model_path) / "preprocessor_config.json",
            Path(self.base_model_path) / "model.safetensors.index.json",
        ]
        required_lora = [
            Path(self.lora_path) / "adapter_config.json",
            Path(self.lora_path) / "adapter_model.safetensors",
        ]
        missing = [str(path) for path in required_base + required_lora if not path.exists()]
        if missing:
            raise FileNotFoundError("模型文件缺失：\n" + "\n".join(missing))

    def infer(self, request: DiagnoseRequest) -> Dict[str, Any]:
        self.load()
        image_path = self._resolve_image(request)
        try:
            prompt = build_prompt(request)
            raw_output = self._generate(image_path=image_path, prompt=prompt, max_new_tokens=request.maxNewTokens)
            diagnosis = normalize_output(raw_output, request)
            return {
                "ok": True,
                "model": "qwen2.5-vl-7b-lora-epoch-5",
                "provider": "local-fastapi",
                "diagnosis": diagnosis,
                "raw_output": raw_output,
            }
        finally:
            if image_path and image_path.startswith(tempfile.gettempdir()):
                Path(image_path).unlink(missing_ok=True)

    def _generate(self, image_path: Optional[str], prompt: str, max_new_tokens: int) -> str:
        assert self.model is not None
        assert self.processor is not None

        content: List[Dict[str, Any]] = []
        if image_path:
            content.append({"type": "image", "image": image_path})
        content.append({"type": "text", "text": prompt})
        messages = [{"role": "user", "content": content}]

        text = self.processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        image_inputs, video_inputs = process_vision_info(messages)
        inputs = self.processor(
            text=[text],
            images=image_inputs,
            videos=video_inputs,
            padding=True,
            return_tensors="pt",
        )

        first_device = next(self.model.parameters()).device
        inputs = {key: value.to(first_device) if hasattr(value, "to") else value for key, value in inputs.items()}

        with torch.no_grad():
            generated_ids = self.model.generate(
                **inputs,
                max_new_tokens=max(16, min(int(max_new_tokens), 512)),
                do_sample=False,
                repetition_penalty=1.05,
            )

        input_len = inputs["input_ids"].shape[1]
        response = self.processor.batch_decode(generated_ids[:, input_len:], skip_special_tokens=True)
        return response[0].strip() if response else ""

    def _resolve_image(self, request: DiagnoseRequest) -> Optional[str]:
        if request.imagePath:
            path = Path(request.imagePath)
            if not path.exists():
                raise FileNotFoundError(f"图像文件不存在：{path}")
            return str(path)

        if not request.imageDataUrl:
            return None

        match = re.match(r"^data:image/([a-zA-Z0-9.+-]+);base64,(.+)$", request.imageDataUrl)
        if not match:
            raise ValueError("imageDataUrl 必须是 data:image/...;base64,... 格式。")

        suffix = ".jpg" if match.group(1).lower() in {"jpeg", "jpg"} else f".{match.group(1).lower()}"
        image_bytes = base64.b64decode(match.group(2))
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as file:
            file.write(image_bytes)
            return file.name


def build_prompt(request: DiagnoseRequest) -> str:
    # 与训练数据 (final6.jsonl) 的 prompt 逐字段对齐：
    #   1) 只保留单一【患者超声报告】块，不追加训练时不存在的【医生原始描述】块
    #      （否则模型会收到两份格式不同的结构化信息，属于分布外输入，倾向退回中间档 4a）。
    #   2) 缺失值统一用 "-"，与训练数据中的占位符一致（训练里 "未填写" 从未出现）。
    fields = request.fields or {}

    def f(*keys: str) -> str:
        for key in keys:
            value = fields.get(key)
            if value not in (None, ""):
                return str(value)
        return "-"

    return f"""你是一位乳腺超声影像诊断AI。请结合【超声图像】和【患者超声报告】综合分析，判断病灶的 BI-RADS 分级以及良恶性结论。

【患者超声报告】
- 年龄: {f("age")}
- 位置: {f("location")}
- 回声特征: {f("echo")}
- 病灶大小: {f("size")}
- 纵横比大于1: {f("aspectRatio")}
- 边缘情况: {f("margin")}
- 后方回声: {f("posteriorEcho")}
- 钙化情况: {f("calcification")}
- 血流信号: {f("bloodFlow")}
- 导管改变: {f("ductChange")}
- 淋巴结状态: {f("lymphNode", "axillaryNode")}

【输出要求】
- 禁止输出解释、过程或多余文字
- 严格按照以下两行格式输出：

BI-RADS: <2|3|4a|4b|4c|5>
Cancer: <良性|恶性>"""


def normalize_output(raw_output: str, request: DiagnoseRequest) -> Dict[str, Any]:
    birads = parse_birads(raw_output)
    cancer = parse_cancer(raw_output)
    probability = birads_to_probability(birads, cancer)
    risk_level = "高风险" if probability >= 60 else "中风险" if probability >= 10 else "低风险"
    risk_key = "high" if risk_level == "高风险" else "mid" if risk_level == "中风险" else "low"
    group = birads_to_group(birads)
    evidence = build_evidence(request)

    return {
        "birads": f"BI-RADS {birads}" if birads else "待医生复核",
        "cancer": cancer or "待医生复核",
        "group": group,
        "riskLevel": risk_level,
        "riskKey": risk_key,
        "probability": probability,
        "suspiciousScore": len(evidence),
        "evidence": evidence or [{"label": "模型未返回可确认征象", "category": "其他", "source": "模型输出"}],
        "recommendation": "建议由专业医生结合影像、病理和临床资料综合判断。",
    }


def parse_birads(text: str) -> Optional[str]:
    match = re.search(r"BI[- ]?RADS\s*[:：]\s*(2|3|4a|4A|4b|4B|4c|4C|5)", text, re.I)
    return match.group(1).lower() if match else None


def parse_cancer(text: str) -> Optional[str]:
    match = re.search(r"Cancer\s*[:：]\s*(良性|恶性)", text, re.I)
    return match.group(1) if match else None


def birads_to_probability(birads: Optional[str], cancer: Optional[str]) -> int:
    if cancer == "恶性":
        table = {"2": 15, "3": 25, "4a": 45, "4b": 65, "4c": 82, "5": 92}
    elif cancer == "良性":
        table = {"2": 2, "3": 3, "4a": 12, "4b": 35, "4c": 70, "5": 90}
    else:
        table = {"2": 2, "3": 3, "4a": 12, "4b": 35, "4c": 70, "5": 90}
    if birads in table:
        return table[birads]
    return 60 if cancer == "恶性" else 5 if cancer == "良性" else 0


def birads_to_group(birads: Optional[str]) -> str:
    if birads in {"2", "3"}:
        return "BI-RADS 2/3"
    if birads == "4a":
        return "4A"
    if birads == "4b":
        return "4B"
    if birads in {"4c", "5"}:
        return "4C/5"
    return "待分层"


def build_evidence(request: DiagnoseRequest) -> List[Dict[str, str]]:
    evidence: List[Dict[str, str]] = []
    field_categories = {
        "形态": "形态",
        "边缘": "边缘",
        "回声": "回声",
        "纵横比": "纵横比",
        "纵横比>1": "纵横比",
        "钙化": "钙化",
        "血流": "血流",
        "淋巴结": "淋巴结",
        "腋窝淋巴结": "淋巴结",
        "后方回声": "后方回声",
    }
    suspicious_values = {
        "不规则",
        "分叶状",
        "欠清",
        "模糊",
        "不清晰",
        "毛刺",
        "毛刺状",
        "是",
        "点状强回声",
        "点状钙化",
        "微钙化",
        "点状",
        "条状",
        "丰富",
        "异常",
        "声影",
        "衰减",
    }

    for key, category in field_categories.items():
        value = request.fields.get(key)
        if value and str(value) in suspicious_values:
            evidence.append({"label": f"{key}: {value}", "category": category, "source": "结构化字段"})

    for tag in request.tags or []:
        label = tag.get("label") if isinstance(tag, dict) else str(tag)
        if label:
            evidence.append({"label": label, "category": "标准映射", "source": "BI-RADS 标签"})

    return evidence


def create_app(service: LocalQwenVLService) -> FastAPI:
    app = FastAPI(title="BreastCare-VL Local Qwen2.5-VL LoRA API")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> Dict[str, Any]:
        return {
            "ok": True,
            "loaded": service.model is not None,
            "baseModel": service.base_model_path,
            "lora": service.lora_path,
        }

    @app.post("/v1/breastcare/diagnose")
    def diagnose(request: DiagnoseRequest) -> Dict[str, Any]:
        try:
            return service.infer(request)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run local Qwen2.5-VL-7B + LoRA API for BreastCare-VL.")
    parser.add_argument("--base-model", default=os.getenv("QWEN_BASE_MODEL_PATH", DEFAULT_BASE_MODEL))
    parser.add_argument("--lora", default=os.getenv("QWEN_LORA_PATH", DEFAULT_LORA))
    parser.add_argument("--processor", default=os.getenv("QWEN_PROCESSOR_PATH"))
    parser.add_argument("--device-map", default=os.getenv("QWEN_DEVICE_MAP", "auto"))
    parser.add_argument("--dtype", choices=["bfloat16", "float16", "float32"], default=os.getenv("QWEN_DTYPE", "bfloat16"))
    parser.add_argument("--merge-lora", action="store_true")
    parser.add_argument("--host", default=os.getenv("QWEN_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("QWEN_PORT", "8000")))
    parser.add_argument("--smoke-test", action="store_true", help="Load model and run one short inference, then exit.")
    parser.add_argument("--image", default=None, help="Optional image path for smoke test.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    service = LocalQwenVLService(
        base_model_path=args.base_model,
        lora_path=args.lora,
        processor_path=args.processor,
        device_map=args.device_map,
        dtype=args.dtype,
        merge_lora=args.merge_lora,
    )

    if args.smoke_test:
        request = DiagnoseRequest(
            imagePath=args.image,
            fields={},
            reportText="本次为本地 LoRA 加载验证。",
            tags=[],
            maxNewTokens=64,
        )
        result = service.infer(request)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return

    app = create_app(service)
    print(f"[BreastCare-Qwen] Starting API server: http://{args.host}:{args.port}")
    print("[BreastCare-Qwen] Diagnose endpoint: /v1/breastcare/diagnose")
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
