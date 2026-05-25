# 乳影智诊 BreastCare-VL

“乳影智诊 BreastCare-VL——面向基层乳腺超声筛查的多模态诊断 Copilot”是一个用于比赛展示的 AI 医疗辅助筛查网站。当前主版本使用 React + Tailwind + Recharts 实现，按五阶段临床工作流组织病例录入、超声特征补全、BI-RADS 标准映射、多模态智能诊断和标准化报告导出。

> 本系统仅用于科研展示和乳腺超声辅助筛查，不替代医生最终诊断。AI 输出结果需由专业医生结合影像、病理和临床资料综合判断。

## 功能模块

- 图像质量控制：计算灰度亮度、Laplacian 清晰度和对比度，输出图像质量评分与采集质量提醒。
- 报告完整性质控：检查年龄、位置、大小、形态、边缘、回声、纵横比、钙化、血流、腋窝淋巴结等关键字段。
- BI-RADS 规则推理：基于乳腺超声可疑恶性征象进行规则化风险分级。
- 多模态推理接口：当前使用规则引擎模拟多模态大模型，已预留 Qwen2.5-VL 接入接口。
- 标准化报告生成：自动生成中文 AI 辅助筛查报告，包含质控结果、风险评估、主要依据和辅助建议。
- 路演展示界面：Streamlit 蓝白医学风格界面，卡片式重点结果展示，风险等级颜色区分。

## 项目结构

```text
breast-ai-screening/
├── app.py
├── requirements.txt
├── README.md
├── modules/
│   ├── image_qc.py
│   ├── report_qc.py
│   ├── birads_rules.py
│   ├── inference_engine.py
│   ├── report_generator.py
│   └── utils.py
├── sample_data/
│   ├── case_001.json
│   ├── case_002.json
│   └── case_003.json
└── outputs/
    └── generated_reports/
```

## 运行方式

### React 网站版本

```bash
npm install
npm run build
npm run start
```

运行后打开：

```text
http://localhost:4173
```

开发模式：

```bash
npm run dev
```

### Streamlit 旧版 Demo

```bash
pip install -r requirements.txt
streamlit run app.py
```

运行后在浏览器中打开 Streamlit 给出的本地地址，通常为：

```text
http://localhost:8501
```

## 示例病例

`sample_data` 目录内置 3 个展示病例：

- `case_001`：偏良性，规则、边缘清楚、无钙化，对应低风险展示。
- `case_002`：中度可疑，边缘欠清并伴点状强回声，对应 BI-RADS 4b 展示。
- `case_003`：高度可疑，不规则、毛刺、纵横比大于1、微钙化、声影、血流丰富、腋窝淋巴结异常，对应 BI-RADS 5 展示。

## 后续扩展

`modules/inference_engine.py` 中已预留：

- `load_qwen_vl_model()`
- `run_qwen_vl_inference()`

后续可以将规则推理替换为真实 Qwen2.5-VL 或其他医学多模态模型推理，并保留现有质控与报告生成流程。

推荐接入位置：

1. 在 `load_qwen_vl_model()` 中加载 Qwen2.5-VL 的 `model` 和 `processor`，并使用缓存避免每次请求重复加载。
2. 在 `run_qwen_vl_inference()` 中将超声图像、结构化字段和医生报告文本组装为多模态 prompt。
3. 让模型输出 JSON，字段对齐 `birads`、`malignancy_probability`、`cancer_prediction`、`risk_level`、`evidence`、`recommendation`。
4. 在 `run_multimodal_inference()` 中把 `predict_birads(structured_fields)` 替换为 `run_qwen_vl_inference(...)`，必要时保留规则引擎作为兜底校验。
