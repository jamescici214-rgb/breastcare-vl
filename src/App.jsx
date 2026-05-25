import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BrainCircuit,
  ClipboardCheck,
  Copy,
  Download,
  FileText,
  Gauge,
  HeartPulse,
  Home,
  ImagePlus,
  Layers3,
  Microscope,
  Pencil,
  Plus,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Trash2,
  Workflow
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

const SAMPLE_CASES = {
  case_001: {
    label: "case_001 偏良性",
    fields: {
      age: 36,
      location: "右乳外上象限",
      size: "9 mm × 6 mm",
      shape: "规则",
      margin: "清楚",
      echo: "低回声",
      aspectRatio: "否",
      calcification: "无",
      posteriorEcho: "无明显改变",
      bloodFlow: "少量",
      lymphNode: "正常",
      structuredReport: "右乳外上象限低回声结节，形态规则，边缘清楚，纵横比小于1。",
      rawDescription:
        "右乳外上象限可见低回声结节，大小约9 mm × 6 mm，形态规则，边缘清楚，未见明显钙化，CDFI示少量血流。"
    }
  },
  case_002: {
    label: "case_002 中度可疑",
    fields: {
      age: 49,
      location: "左乳内上象限",
      size: "18 mm × 12 mm",
      shape: "分叶状",
      margin: "欠清",
      echo: "低回声",
      aspectRatio: "否",
      calcification: "点状强回声",
      posteriorEcho: "无明显改变",
      bloodFlow: "少量",
      lymphNode: "正常",
      structuredReport: "左乳内上象限低回声结节，分叶状，边缘欠清，内部点状强回声。",
      rawDescription:
        "左乳内上象限见低回声结节，形态呈分叶状，边缘欠清，内部可见点状强回声，建议进一步专科评估。"
    }
  },
  case_003: {
    label: "case_003 高度可疑",
    fields: {
      age: 58,
      location: "左乳外上象限",
      size: "26 mm × 21 mm",
      shape: "不规则",
      margin: "毛刺",
      echo: "混合回声",
      aspectRatio: "是",
      calcification: "微钙化",
      posteriorEcho: "声影",
      bloodFlow: "丰富",
      lymphNode: "异常",
      structuredReport: "左乳外上象限混合回声肿块，形态不规则，边缘毛刺，纵横比大于1，微钙化，声影，血流丰富。",
      rawDescription:
        "左乳外上象限可见混合回声肿块，形态不规则，边缘毛刺，纵横比大于1，内部微钙化，后方伴声影，CDFI示丰富血流，左侧腋窝淋巴结异常。"
    }
  }
};

const DEFAULT_FIELDS = {
  age: 45,
  location: "左乳外上象限",
  size: "12 mm × 8 mm",
  shape: "",
  margin: "",
  echo: "",
  aspectRatio: "",
  calcification: "",
  posteriorEcho: "",
  bloodFlow: "",
  lymphNode: "",
  structuredReport: "",
  rawDescription: ""
};

const REQUIRED_FEATURES = [
  ["shape", "形态"],
  ["margin", "边缘"],
  ["echo", "回声"],
  ["aspectRatio", "纵横比"],
  ["calcification", "钙化"],
  ["bloodFlow", "血流"],
  ["lymphNode", "淋巴结"],
  ["posteriorEcho", "后方回声"]
];

const RISK_COLORS = {
  low: "#22C55E",
  mid: "#F59E0B",
  high: "#EF4444"
};

const FLOW_STEPS = [
  "病例数据录入",
  "系统化超声特征补全",
  "BI-RADS 标准词映射",
  "多模态智能诊断",
  "标准化报告导出"
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function getReportText(fields) {
  return `${fields.structuredReport || ""}\n${fields.rawDescription || ""}`.trim();
}

function analyzeReportCompleteness(fields) {
  const text = getReportText(fields);
  const keywordMap = {
    shape: ["形态", "规则", "不规则", "分叶"],
    margin: ["边缘", "边界", "欠清", "模糊", "毛刺", "清楚"],
    echo: ["回声", "低回声", "混合回声", "等回声", "高回声", "无回声"],
    aspectRatio: ["纵横比", "大于1", "小于1", "大于 1"],
    calcification: ["钙化", "强回声", "微钙化"],
    bloodFlow: ["血流", "CDFI", "彩色多普勒"],
    lymphNode: ["淋巴结", "腋窝"],
    posteriorEcho: ["后方", "增强", "衰减", "声影"]
  };

  const missing = REQUIRED_FEATURES.filter(([key]) => {
    const hasField = !isMissing(fields[key]);
    const hasText = keywordMap[key]?.some((keyword) => text.includes(keyword));
    return !hasField && !hasText;
  }).map(([, label]) => label);

  return {
    score: Math.round(((REQUIRED_FEATURES.length - missing.length) / REQUIRED_FEATURES.length) * 1000) / 10,
    missing,
    suggestions:
      missing.length === 0
        ? ["关键超声征象字段完整，可进入标准词映射。"]
        : missing.map((item) => `建议补充${item}信息，并优先使用 BI-RADS 标准描述。`)
  };
}

function detectStandardTags(fields) {
  const text = getReportText(fields);
  const tags = [];
  const add = (label, source = "结构化字段") => {
    if (!tags.some((tag) => tag.label === label)) {
      tags.push({ id: `${Date.now()}-${label}-${tags.length}`, label, confirmed: true, source });
    }
  };

  if (fields.echo) add(fields.echo);
  if (fields.margin && fields.margin !== "清楚") add(fields.margin === "欠清" ? "边界欠清" : `边缘${fields.margin}`);
  if (fields.aspectRatio === "是" || text.includes("纵横比大于1")) add("纵横比>1");
  if (["点状强回声", "微钙化"].includes(fields.calcification)) add(fields.calcification === "微钙化" ? "微钙化" : "点状强回声");
  if (fields.bloodFlow === "丰富" || text.includes("血流丰富")) add("血流丰富");
  if (fields.shape === "不规则" || text.includes("形态不规则")) add("形态不规则");
  if (fields.posteriorEcho === "声影" || text.includes("声影")) add("后方声影");
  if (fields.lymphNode === "异常" || text.includes("淋巴结异常")) add("腋窝淋巴结异常");

  if (tags.length === 0) add("未见明确可疑恶性征象", "规则兜底");
  return tags;
}

function predictDiagnosis(fields) {
  const evidence = [];
  const add = (condition, label, category, source) => {
    if (condition) evidence.push({ label, category, source });
  };

  add(fields.shape === "不规则", "形态不规则", "形态", "结构化征象");
  add(["欠清", "模糊", "毛刺"].includes(fields.margin), `边缘${fields.margin}`, "边缘", "结构化征象");
  add(fields.aspectRatio === "是", "纵横比>1", "生长方向", "结构化征象");
  add(["点状强回声", "微钙化"].includes(fields.calcification), fields.calcification, "钙化", "结构化征象");
  add(fields.posteriorEcho === "声影", "后方声影", "后方回声", "结构化征象");
  add(fields.bloodFlow === "丰富", "血流丰富", "血流", "结构化征象");
  add(fields.lymphNode === "异常", "腋窝淋巴结异常", "淋巴结", "结构化征象");

  const score = evidence.length;
  if (score === 0) {
    return {
      birads: "BI-RADS 3",
      cancer: "倾向良性",
      group: "BI-RADS 2/3",
      riskLevel: "低风险",
      riskKey: "low",
      probability: 3,
      suspiciousScore: score,
      evidence: [{ label: "未见规则库定义的明确可疑恶性征象", category: "兜底", source: "规则引擎" }],
      recommendation: "建议结合既往影像进行短期随访，由医生综合判断。"
    };
  }
  if (score === 1) {
    return {
      birads: "BI-RADS 4A",
      cancer: "低度可疑",
      group: "4A",
      riskLevel: "中风险",
      riskKey: "mid",
      probability: 10,
      suspiciousScore: score,
      evidence,
      recommendation: "建议乳腺专科复核，必要时进一步影像检查或随访。"
    };
  }
  if (score === 2) {
    return {
      birads: "BI-RADS 4B",
      cancer: "中度可疑",
      group: "4B",
      riskLevel: "中风险",
      riskKey: "mid",
      probability: 28,
      suspiciousScore: score,
      evidence,
      recommendation: "建议乳腺专科评估，结合临床考虑组织学取样。"
    };
  }
  if (score <= 4) {
    return {
      birads: "BI-RADS 4C",
      cancer: "高度可疑",
      group: "4C/5",
      riskLevel: "高风险",
      riskKey: "high",
      probability: score === 3 ? 58 : 76,
      suspiciousScore: score,
      evidence,
      recommendation: "建议尽快完善专科检查，优先考虑穿刺活检明确性质。"
    };
  }
  return {
    birads: "BI-RADS 5",
    cancer: "高度提示恶性",
    group: "4C/5",
    riskLevel: "高风险",
    riskKey: "high",
    probability: Math.min(95, 84 + (score - 5) * 2),
    suspiciousScore: score,
    evidence,
    recommendation: "建议尽快转诊乳腺专科，完善穿刺活检和规范化诊疗评估。"
  };
}

function generateReport(fields, imageQc, reportQc, tags, diagnosis, confidence) {
  return `乳影智诊 BreastCare-VL AI 辅助筛查报告

一、病例信息
年龄：${fields.age || "未填写"} 岁
病灶位置：${fields.location || "未填写"}
病灶大小：${fields.size || "未填写"}

二、图像质控
图像质量评分：${imageQc.score}/100
质控提示：${imageQc.message}

三、报告质控
报告完整性评分：${reportQc.score}/100
缺失字段：${reportQc.missing.length ? reportQc.missing.join("、") : "未发现关键字段缺失"}

四、BI-RADS 标准映射
${tags.map((tag, index) => `${index + 1}. ${tag.label}`).join("\n")}

五、模型预测
推理来源：${diagnosis.source || "规则推理兜底"}
BI-RADS 输出：${diagnosis.birads}
Cancer 良恶性预测：${diagnosis.cancer}
管理导向风险分层：${diagnosis.group}
恶性风险概率：${diagnosis.probability}%
诊断可信度评分：${confidence}/100

六、结构化证据
${diagnosis.evidence.map((item, index) => `${index + 1}. ${item.category}：${item.label}（来源：${item.source}）`).join("\n")}

七、辅助建议
${diagnosis.recommendation}

八、免责声明
本系统仅用于科研展示和乳腺超声辅助筛查，不替代医生最终诊断。AI 输出结果需由专业医生结合影像、病理和临床资料综合判断。`;
}

async function analyzeImageFile(file) {
  if (!file) {
    return {
      score: 0,
      brightness: "-",
      contrast: "-",
      sharpness: "-",
      message: "未上传图像，暂无法完成图像质量控制。"
    };
  }

  const imageUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 520 / Math.max(image.width, image.height));
    canvas.width = Math.max(1, Math.floor(image.width * scale));
    canvas.height = Math.max(1, Math.floor(image.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const gray = [];
    for (let index = 0; index < data.length; index += 4) {
      gray.push(0.299 * data[index] + 0.587 * data[index + 1] + 0.114 * data[index + 2]);
    }
    const mean = gray.reduce((sum, value) => sum + value, 0) / gray.length;
    const variance = gray.reduce((sum, value) => sum + (value - mean) ** 2, 0) / gray.length;
    let gradient = 0;
    for (let y = 1; y < canvas.height; y += 1) {
      for (let x = 1; x < canvas.width; x += 1) {
        const i = y * canvas.width + x;
        gradient += Math.abs(gray[i] - gray[i - 1]) + Math.abs(gray[i] - gray[i - canvas.width]);
      }
    }
    const contrast = Math.sqrt(variance);
    const sharpness = gradient / gray.length;
    const brightnessScore = clamp(100 - (Math.abs(mean - 128) / 128) * 100);
    const contrastScore = clamp((contrast / 55) * 100);
    const sharpnessScore = clamp((sharpness / 18) * 100);
    const score = Math.round((0.35 * brightnessScore + 0.3 * contrastScore + 0.35 * sharpnessScore) * 10) / 10;
    const warnings = [];
    if (mean < 45) warnings.push("图像偏暗");
    if (mean > 215) warnings.push("图像偏亮");
    if (contrast < 22) warnings.push("对比度偏低");
    if (sharpness < 5) warnings.push("清晰度偏低");
    return {
      score,
      brightness: mean.toFixed(1),
      contrast: contrast.toFixed(1),
      sharpness: sharpness.toFixed(1),
      message: warnings.length ? warnings.join("、") : "图像质量可用于辅助筛查展示。"
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      resolve("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 1200;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.onerror = reject;
      img.src = String(reader.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function Header({ page, setPage }) {
  const nav = [
    ["home", "首页", Home],
    ["workspace", "诊断工作台", Workflow],
    ["architecture", "技术架构", Layers3]
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-clinic-line bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between px-5 py-4">
        <button className="flex items-center gap-3 text-left" onClick={() => setPage("home")}>
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-clinic-blue to-clinic-teal text-white shadow-lg shadow-blue-200">
            <HeartPulse className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-lg font-black text-clinic-navy">乳影智诊 BreastCare-VL</span>
            <span className="block text-xs font-semibold text-clinic-muted">Multimodal Diagnosis Copilot</span>
          </span>
        </button>
        <nav className="flex items-center gap-2 rounded-2xl border border-clinic-line bg-clinic-bg2 p-1">
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setPage(key)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
                page === key ? "bg-white text-clinic-blue shadow-sm" : "text-slate-600 hover:text-clinic-blue"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}

function LandingPage({ setPage }) {
  const capabilityCards = [
    ["多模态诊断", "融合乳腺超声图像、结构化报告和原始描述，输出可解释筛查结果。", BrainCircuit],
    ["BI-RADS 标准化", "将基层报告描述映射为标准特征标签，减少非标准表达带来的偏差。", ClipboardCheck],
    ["质控闭环", "覆盖图像质量、报告完整性、标准词映射和诊断可信度评分。", ShieldCheck],
    ["报告生成", "生成面向医生复核的 AI 辅助筛查报告，支持复制和导出。", FileText]
  ];
  const route = ["乳腺超声图像", "BioMedCLIP 蒸馏", "Qwen2.5-VL", "LoRA", "Checklist Prompt", "Label-only Output"];
  return (
    <main>
      <section className="mx-auto max-w-[1500px] px-5 py-8">
        <div className="clinical-card overflow-hidden p-8 lg:p-10">
          <div className="grid gap-10 lg:grid-cols-[1.18fr_.82fr] lg:items-center">
            <div>
              <div className="pill mb-5 bg-[#EAF6FF]">
                <Sparkles className="h-4 w-4 text-clinic-blue" />
                面向基层乳腺超声筛查的多模态诊断 Copilot
              </div>
              <h1 className="max-w-4xl text-4xl font-black leading-tight text-clinic-navy lg:text-6xl">
                乳影智诊 BreastCare-VL
              </h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
                以五阶段临床工作流组织病例录入、超声特征补全、BI-RADS 标准映射、多模态智能诊断和报告导出，
                用结构化证据替代冗长自由推理，让比赛评委能清楚看到 AI 在基层筛查中的价值闭环。
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <button className="primary-button" onClick={() => setPage("workspace")}>
                  进入诊断工作台
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button className="secondary-button" onClick={() => setPage("architecture")}>
                  查看技术架构
                  <Layers3 className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div className="rounded-[28px] border border-clinic-line bg-gradient-to-br from-[#EDF8FF] to-white p-5 shadow-clinical">
              <div className="grid grid-cols-2 gap-4">
                <MetricBlock label="BI-RADS Macro-F1" value="0.6456" tone="blue" />
                <MetricBlock label="Cancer F1" value="0.9825" tone="teal" />
                <MetricBlock label="诊断流程" value="5 阶段" tone="teal" />
                <MetricBlock label="输出策略" value="Label-only" tone="blue" />
              </div>
              <div className="mt-5 rounded-2xl bg-white p-4">
                <p className="text-sm font-black text-clinic-navy">模型技术路线</p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {route.map((item, index) => (
                    <span key={item} className="flex items-center gap-2">
                      <span className="rounded-full border border-[#CDE8F7] bg-[#F8FBFF] px-3 py-1.5 text-xs font-bold text-slate-700">
                        {item}
                      </span>
                      {index < route.length - 1 && <ArrowRight className="h-4 w-4 text-clinic-blue" />}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {capabilityCards.map(([title, body, Icon]) => (
            <div key={title} className="clinical-card p-5">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#EAF6FF] text-clinic-blue">
                <Icon className="h-6 w-6" />
              </span>
              <h3 className="mt-4 text-lg font-black text-clinic-navy">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function MetricBlock({ label, value, tone }) {
  const color = tone === "teal" ? "text-clinic-teal" : "text-clinic-blue";
  return (
    <div className="rounded-2xl border border-clinic-line bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-black ${color}`}>{value}</p>
    </div>
  );
}

function Stepper({ activeStep, setActiveStep }) {
  return (
    <div className="clinical-card p-4">
      <div className="grid gap-3 md:grid-cols-5">
        {FLOW_STEPS.map((step, index) => {
          const active = activeStep === index;
          return (
            <button
              key={step}
              onClick={() => setActiveStep(index)}
              className={`rounded-2xl border px-4 py-3 text-left transition ${
                active ? "border-clinic-blue bg-[#EAF6FF] shadow-sm" : "border-clinic-line bg-white hover:border-clinic-blue"
              }`}
            >
              <span
                className={`grid h-8 w-8 place-items-center rounded-full text-sm font-black ${
                  active ? "bg-clinic-blue text-white" : "bg-[#F1F7FC] text-slate-600"
                }`}
              >
                {index + 1}
              </span>
              <span className="mt-2 block text-sm font-black text-clinic-navy">{step}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DiagnosisWorkspace() {
  const [activeStep, setActiveStep] = useState(0);
  const [fields, setFields] = useState(DEFAULT_FIELDS);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageQc, setImageQc] = useState({
    score: 0,
    brightness: "-",
    contrast: "-",
    sharpness: "-",
    message: "未上传图像，暂无法完成图像质量控制。"
  });
  const [tags, setTags] = useState(detectStandardTags(DEFAULT_FIELDS));
  const [newTag, setNewTag] = useState("");
  const [copyState, setCopyState] = useState("复制报告文本");
  const [backendMode, setBackendMode] = useState("auto");
  const [modelDiagnosis, setModelDiagnosis] = useState(null);
  const [modelStatus, setModelStatus] = useState("idle");
  const [modelError, setModelError] = useState("");

  const reportQc = useMemo(() => analyzeReportCompleteness(fields), [fields]);
  const ruleDiagnosis = useMemo(() => ({ ...predictDiagnosis(fields), source: "规则推理兜底" }), [fields]);
  const diagnosis = modelDiagnosis || ruleDiagnosis;
  const confidence = useMemo(() => {
    const ruleStability = 78 + Math.min(diagnosis.suspiciousScore, 5) * 3;
    return Math.round(clamp(0.34 * imageQc.score + 0.36 * reportQc.score + 0.3 * ruleStability) * 10) / 10;
  }, [diagnosis.suspiciousScore, imageQc.score, reportQc.score]);
  const reportText = useMemo(
    () => generateReport(fields, imageQc, reportQc, tags, diagnosis, confidence),
    [fields, imageQc, reportQc, tags, diagnosis, confidence]
  );

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    analyzeImageFile(imageFile).then(setImageQc);
    fileToDataUrl(imageFile).then(setImageDataUrl);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const updateField = (key, value) => {
    setModelDiagnosis(null);
    setFields((current) => ({ ...current, [key]: value }));
  };
  const loadSample = (key) => {
    const next = SAMPLE_CASES[key].fields;
    setModelDiagnosis(null);
    setFields(next);
    setTags(detectStandardTags(next));
    setActiveStep(1);
  };
  const remapTags = () => {
    setTags(detectStandardTags(fields));
    setActiveStep(2);
  };
  const addTag = () => {
    const label = newTag.trim();
    if (!label) return;
    setTags((current) => [...current, { id: `${Date.now()}-${label}`, label, confirmed: false, source: "医生新增" }]);
    setNewTag("");
  };
  const runRealQwenDiagnosis = async () => {
    setModelStatus("running");
    setModelError("");
    try {
      const response = await fetch("/api/diagnose", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mode: backendMode === "auto" ? undefined : backendMode,
          imageDataUrl,
          fields,
          reportText: getReportText(fields),
          tags: tags.map(({ label, source, confirmed }) => ({ label, source, confirmed }))
        })
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "真实模型接口调用失败。");
      }
      setModelDiagnosis({
        ...payload.diagnosis,
        source: payload.mode === "self-hosted" ? `自部署 Qwen2.5-VL：${payload.model}` : `Qwen API：${payload.model}`
      });
      setModelStatus("success");
    } catch (error) {
      setModelError(error instanceof Error ? error.message : "真实模型接口调用失败。");
      setModelStatus("error");
    }
  };
  const copyReport = async () => {
    await navigator.clipboard.writeText(reportText);
    setCopyState("已复制");
    window.setTimeout(() => setCopyState("复制报告文本"), 1300);
  };
  const exportWord = () => {
    const html = `<html><head><meta charset="utf-8"></head><body><pre style="font-family:Microsoft YaHei,Arial;white-space:pre-wrap;line-height:1.75">${reportText}</pre></body></html>`;
    const blob = new Blob([html], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "乳影智诊_BreastCare-VL_AI辅助筛查报告.doc";
    link.click();
    URL.revokeObjectURL(url);
  };
  const exportPdf = () => {
    const win = window.open("", "_blank", "width=900,height=1100");
    win.document.write(`<html><head><title>AI 辅助筛查报告</title><meta charset="utf-8"></head><body><pre style="font-family:Microsoft YaHei,Arial;white-space:pre-wrap;line-height:1.75;font-size:14px">${reportText}</pre></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  };

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-7">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="pill bg-white">
            <Stethoscope className="h-4 w-4 text-clinic-blue" />
            Clinical Workflow Diagnosis Workspace
          </div>
          <h1 className="mt-4 text-3xl font-black text-clinic-navy lg:text-5xl">五阶段乳腺超声诊断工作台</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            从病例录入到标准化报告导出，按临床路径展示模型如何完成质控、标准映射、多模态诊断和证据输出。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(SAMPLE_CASES).map(([key, sample]) => (
            <button key={key} className="secondary-button py-2" onClick={() => loadSample(key)}>
              {sample.label}
            </button>
          ))}
        </div>
      </div>

      <Stepper activeStep={activeStep} setActiveStep={setActiveStep} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[.92fr_1.08fr]">
        <section className="clinical-card p-5">
          {activeStep === 0 && (
            <StepOne
              fields={fields}
              updateField={updateField}
              imagePreview={imagePreview}
              setImageFile={setImageFile}
              onNext={() => setActiveStep(1)}
            />
          )}
          {activeStep === 1 && <StepTwo reportQc={reportQc} onNext={remapTags} />}
          {activeStep === 2 && (
            <StepThree
              tags={tags}
              setTags={setTags}
              newTag={newTag}
              setNewTag={setNewTag}
              addTag={addTag}
              onNext={() => setActiveStep(3)}
            />
          )}
          {activeStep === 3 && (
            <StepFour
              diagnosis={diagnosis}
              imageQc={imageQc}
              reportQc={reportQc}
              confidence={confidence}
              tags={tags}
              backendMode={backendMode}
              setBackendMode={setBackendMode}
              modelStatus={modelStatus}
              modelError={modelError}
              onRunModel={runRealQwenDiagnosis}
              onNext={() => setActiveStep(4)}
            />
          )}
          {activeStep === 4 && (
            <StepFive reportText={reportText} copyReport={copyReport} copyState={copyState} exportWord={exportWord} exportPdf={exportPdf} />
          )}
        </section>

        <aside className="space-y-6">
          <SummaryPanel diagnosis={diagnosis} imageQc={imageQc} reportQc={reportQc} confidence={confidence} />
          <EvidencePanel diagnosis={diagnosis} tags={tags} />
        </aside>
      </div>
    </main>
  );
}

function StepOne({ fields, updateField, imagePreview, setImageFile, onNext }) {
  return (
    <div>
      <SectionTitle icon={ImagePlus} title="Step 1 病例数据录入" subtitle="上传乳腺超声图像，录入结构化报告和原始描述。" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <label className="label">乳腺超声图像上传</label>
          <label className="flex min-h-64 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#BFD9EC] bg-[#F8FBFF] p-5 text-center transition hover:border-clinic-blue">
            {imagePreview ? (
              <img src={imagePreview} alt="乳腺超声预览" className="max-h-72 rounded-xl object-contain" />
            ) : (
              <>
                <ImagePlus className="h-12 w-12 text-clinic-blue" />
                <span className="mt-3 text-sm font-bold text-clinic-navy">点击上传 jpg / png 图像</span>
                <span className="mt-1 text-xs text-slate-500">用于图像质量控制与多模态诊断输入</span>
              </>
            )}
            <input className="hidden" type="file" accept="image/png,image/jpeg" onChange={(event) => setImageFile(event.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="grid content-start gap-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="年龄" value={fields.age} onChange={(value) => updateField("age", value)} type="number" />
            <TextField label="病灶大小" value={fields.size} onChange={(value) => updateField("size", value)} />
          </div>
          <TextField label="病灶位置" value={fields.location} onChange={(value) => updateField("location", value)} />
          <TextArea label="结构化报告" value={fields.structuredReport} onChange={(value) => updateField("structuredReport", value)} rows={4} />
          <TextArea label="原始描述" value={fields.rawDescription} onChange={(value) => updateField("rawDescription", value)} rows={4} />
        </div>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <SelectField label="形态" value={fields.shape} onChange={(value) => updateField("shape", value)} options={["", "规则", "不规则", "分叶状"]} />
        <SelectField label="边缘" value={fields.margin} onChange={(value) => updateField("margin", value)} options={["", "清楚", "欠清", "模糊", "毛刺"]} />
        <SelectField label="回声" value={fields.echo} onChange={(value) => updateField("echo", value)} options={["", "无回声", "低回声", "等回声", "高回声", "混合回声"]} />
        <SelectField label="纵横比>1" value={fields.aspectRatio} onChange={(value) => updateField("aspectRatio", value)} options={["", "否", "是"]} />
        <SelectField label="钙化" value={fields.calcification} onChange={(value) => updateField("calcification", value)} options={["", "无", "粗大钙化", "点状强回声", "微钙化"]} />
        <SelectField label="血流" value={fields.bloodFlow} onChange={(value) => updateField("bloodFlow", value)} options={["", "无", "少量", "丰富"]} />
        <SelectField label="淋巴结" value={fields.lymphNode} onChange={(value) => updateField("lymphNode", value)} options={["", "正常", "异常", "未描述"]} />
        <SelectField label="后方回声" value={fields.posteriorEcho} onChange={(value) => updateField("posteriorEcho", value)} options={["", "无明显改变", "增强", "衰减", "声影"]} />
      </div>
      <div className="mt-6 flex justify-end">
        <button className="primary-button" onClick={onNext}>
          进入特征补全
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StepTwo({ reportQc, onNext }) {
  return (
    <div>
      <SectionTitle icon={ClipboardCheck} title="Step 2 系统化超声特征补全" subtitle="自动检测缺失字段，给出报告完整性评分和补全建议。" />
      <div className="grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
        <ScoreCard label="报告完整性评分" value={reportQc.score} color={reportQc.score >= 85 ? RISK_COLORS.low : reportQc.score >= 60 ? RISK_COLORS.mid : RISK_COLORS.high} />
        <div className="rounded-2xl border border-clinic-line bg-[#F8FBFF] p-5">
          <h3 className="text-lg font-black text-clinic-navy">缺失字段检测</h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {(reportQc.missing.length ? reportQc.missing : ["无关键字段缺失"]).map((item) => (
              <span key={item} className="pill bg-white">
                <BadgeCheck className="h-4 w-4 text-clinic-teal" />
                {item}
              </span>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            {reportQc.suggestions.map((item) => (
              <div key={item} className="rounded-xl border border-clinic-line bg-white p-3 text-sm font-semibold text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="primary-button" onClick={onNext}>
          生成 BI-RADS 标准映射
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StepThree({ tags, setTags, newTag, setNewTag, addTag, onNext }) {
  const updateTag = (id, patch) => setTags((current) => current.map((tag) => (tag.id === id ? { ...tag, ...patch } : tag)));
  const removeTag = (id) => setTags((current) => current.filter((tag) => tag.id !== id));
  return (
    <div>
      <SectionTitle icon={BadgeCheck} title="Step 3 BI-RADS 标准词映射" subtitle="将原始报告映射为标准特征标签，标签可编辑、可删除、可确认。" />
      <div className="space-y-3">
        {tags.map((tag) => (
          <div key={tag.id} className="grid gap-3 rounded-2xl border border-clinic-line bg-[#F8FBFF] p-3 md:grid-cols-[1fr_auto_auto] md:items-center">
            <input className="field" value={tag.label} onChange={(event) => updateTag(tag.id, { label: event.target.value, confirmed: false })} />
            <button
              className={`secondary-button py-2 ${tag.confirmed ? "border-clinic-teal text-clinic-teal" : ""}`}
              onClick={() => updateTag(tag.id, { confirmed: !tag.confirmed })}
            >
              <Pencil className="h-4 w-4" />
              {tag.confirmed ? "已确认" : "确认"}
            </button>
            <button className="secondary-button py-2 text-red-500" onClick={() => removeTag(tag.id)}>
              <Trash2 className="h-4 w-4" />
              删除
            </button>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
        <input className="field" placeholder="新增标准标签，例如：皮肤受侵、导管扩张" value={newTag} onChange={(event) => setNewTag(event.target.value)} />
        <button className="secondary-button" onClick={addTag}>
          <Plus className="h-4 w-4" />
          添加标签
        </button>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="primary-button" onClick={onNext}>
          进入多模态诊断
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StepFour({
  diagnosis,
  imageQc,
  reportQc,
  confidence,
  tags,
  backendMode,
  setBackendMode,
  modelStatus,
  modelError,
  onRunModel,
  onNext
}) {
  const radarData = [
    { metric: "图像质量", value: imageQc.score },
    { metric: "报告完整性", value: reportQc.score },
    { metric: "诊断可信度", value: confidence },
    { metric: "标准映射", value: Math.min(100, tags.filter((tag) => tag.confirmed).length * 15 + 55) }
  ];
  return (
    <div>
      <SectionTitle icon={BrainCircuit} title="Step 4 多模态智能诊断" subtitle="采用结构化证据列表输出，避免长篇自由医学推理。" />
      <div className="mb-5 rounded-2xl border border-[#CDE8F7] bg-[#F8FBFF] p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <h3 className="text-lg font-black text-clinic-navy">真实 Qwen2.5-VL 后端调用</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              支持两种后端：第三方 OpenAI-compatible Qwen API，或你自己微调并部署的 Qwen2.5-VL GPU 服务。
              如果后端环境变量尚未配置，本页面仍会保留规则推理兜底结果。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[220px_auto]">
            <select className="field" value={backendMode} onChange={(event) => setBackendMode(event.target.value)}>
              <option value="auto">自动选择后端</option>
              <option value="openai-compatible">Qwen API</option>
              <option value="self-hosted">自部署 Qwen2.5-VL</option>
            </select>
            <button className="primary-button" onClick={onRunModel} disabled={modelStatus === "running"}>
              <BrainCircuit className="h-4 w-4" />
              {modelStatus === "running" ? "模型推理中..." : "调用真实模型"}
            </button>
          </div>
        </div>
        {modelStatus === "success" && (
          <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            真实模型结果已回填到当前诊断工作台，报告导出将使用该结果。
          </div>
        )}
        {modelStatus === "error" && (
          <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold leading-6 text-red-700">
            {modelError}
          </div>
        )}
      </div>
      <div className="grid gap-5 lg:grid-cols-[.9fr_1.1fr]">
        <RiskGauge diagnosis={diagnosis} />
        <div className="space-y-4">
          <RiskBand active={diagnosis.group} />
          <EvidenceTable evidence={diagnosis.evidence} />
        </div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <ScoreCard label="图像质控评分" value={imageQc.score} color={scoreColor(imageQc.score)} />
        <ScoreCard label="报告完整性评分" value={reportQc.score} color={scoreColor(reportQc.score)} />
        <ScoreCard label="诊断可信度评分" value={confidence} color={scoreColor(confidence)} />
      </div>
      <div className="mt-5 h-72 rounded-2xl border border-clinic-line bg-white p-4">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="#D8E7F3" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: "#334155", fontSize: 12 }} />
            <Radar dataKey="value" stroke="#1E88E5" fill="#1E88E5" fillOpacity={0.22} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-6 flex justify-end">
        <button className="primary-button" onClick={onNext}>
          生成标准化报告
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function StepFive({ reportText, copyReport, copyState, exportWord, exportPdf }) {
  return (
    <div>
      <SectionTitle icon={FileText} title="Step 5 标准化报告导出" subtitle="生成 AI 辅助筛查报告，支持复制、PDF 打印和 Word 导出。" />
      <div className="rounded-2xl border border-clinic-line bg-[#F8FBFF] p-5">
        <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded-2xl bg-white p-5 text-sm leading-7 text-slate-800 shadow-inner">
          {reportText}
        </pre>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button className="primary-button" onClick={copyReport}>
          <Copy className="h-4 w-4" />
          {copyState}
        </button>
        <button className="secondary-button" onClick={exportPdf}>
          <Download className="h-4 w-4" />
          导出 PDF
        </button>
        <button className="secondary-button" onClick={exportWord}>
          <Download className="h-4 w-4" />
          导出 Word
        </button>
      </div>
    </div>
  );
}

function SummaryPanel({ diagnosis, imageQc, reportQc, confidence }) {
  const color = RISK_COLORS[diagnosis.riskKey];
  const data = [
    { name: "risk", value: diagnosis.probability },
    { name: "rest", value: 100 - diagnosis.probability }
  ];
  return (
    <div className="clinical-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-slate-500">AI Diagnostic Summary</p>
          <h2 className="mt-1 text-2xl font-black text-clinic-navy">{diagnosis.birads}</h2>
          <p className="mt-1 text-xs font-bold text-slate-500">{diagnosis.source || "规则推理兜底"}</p>
        </div>
        <span className="rounded-full px-3 py-1.5 text-sm font-black text-white" style={{ background: color }}>
          {diagnosis.riskLevel}
        </span>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" startAngle={180} endAngle={0} innerRadius="70%" outerRadius="100%" paddingAngle={2}>
                <Cell fill={color} />
                <Cell fill="#E5EEF6" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="-mt-24 text-center">
            <p className="text-4xl font-black text-clinic-navy">{diagnosis.probability}%</p>
            <p className="text-xs font-bold text-slate-500">恶性风险概率</p>
          </div>
        </div>
        <div className="grid content-center gap-3">
          <MiniStat label="Cancer 预测" value={diagnosis.cancer} />
          <MiniStat label="管理分层" value={diagnosis.group} />
          <MiniStat label="诊断可信度" value={`${confidence}/100`} />
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <MiniScore label="图像" value={imageQc.score} />
        <MiniScore label="报告" value={reportQc.score} />
        <MiniScore label="证据" value={diagnosis.suspiciousScore} suffix="项" />
      </div>
    </div>
  );
}

function EvidencePanel({ diagnosis, tags }) {
  return (
    <div className="clinical-card p-5">
      <div className="flex items-center gap-2">
        <Microscope className="h-5 w-5 text-clinic-blue" />
        <h2 className="text-lg font-black text-clinic-navy">结构化证据展示</h2>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag.id} className={`pill ${tag.confirmed ? "border-[#B7F1E9] bg-[#F0FDFA]" : ""}`}>
            {tag.label}
          </span>
        ))}
      </div>
      <EvidenceTable evidence={diagnosis.evidence} compact />
    </div>
  );
}

function ArchitecturePage() {
  const flow = ["React 前端", "Cloudflare Pages Function", "Qwen API 或自部署 GPU 服务", "Qwen2.5-VL + LoRA", "Checklist Prompt", "Label-only Output"];
  const ablation = [
    { setting: "Qwen2.5-VL baseline", birads: 0.5812, cancer: 0.9534 },
    { setting: "+ LoRA", birads: 0.6128, cancer: 0.9716 },
    { setting: "+ BioMedCLIP 蒸馏", birads: 0.6339, cancer: 0.9788 },
    { setting: "+ Checklist Prompt", birads: 0.6456, cancer: 0.9825 }
  ];
  return (
    <main className="mx-auto max-w-[1500px] px-5 py-8">
      <div className="clinical-card p-8">
        <div className="pill bg-[#EAF6FF]">
          <Layers3 className="h-4 w-4 text-clinic-blue" />
          Technical Architecture
        </div>
        <h1 className="mt-4 text-4xl font-black text-clinic-navy lg:text-5xl">多模态诊断技术架构</h1>
        <p className="mt-4 max-w-4xl leading-8 text-slate-600">
          系统采用“前端工作流 + Cloudflare 安全代理 + 真实多模态模型服务”的部署路线。
          模型可以使用第三方 Qwen2.5-VL API，也可以调用你自己微调并部署在 GPU 服务器上的 Qwen2.5-VL + LoRA 服务。
          前端不保存 API Key，通过 Checklist Prompt 约束输出为标签级诊断结果，降低自由文本医学幻觉风险。
        </p>
      </div>

      <div className="mt-6 clinical-card p-6">
        <h2 className="text-xl font-black text-clinic-navy">模型流程</h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-6">
          {flow.map((item, index) => (
            <div key={item} className="relative rounded-2xl border border-clinic-line bg-[#F8FBFF] p-4">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-clinic-blue text-sm font-black text-white">{index + 1}</span>
              <p className="mt-4 min-h-12 text-sm font-black text-clinic-navy">{item}</p>
              {index < flow.length - 1 && <ArrowRight className="absolute -right-4 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-clinic-blue lg:block" />}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[.82fr_1.18fr]">
        <div className="clinical-card p-6">
          <h2 className="text-xl font-black text-clinic-navy">论文实验指标</h2>
          <div className="mt-5 grid gap-4">
            <MetricBlock label="BI-RADS Macro-F1" value="0.6456" tone="blue" />
            <MetricBlock label="Cancer F1" value="0.9825" tone="teal" />
          </div>
        </div>
        <div className="clinical-card p-6">
          <h2 className="text-xl font-black text-clinic-navy">消融结果</h2>
          <div className="mt-5 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ablation}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D8E7F3" />
                <XAxis dataKey="setting" tick={{ fontSize: 11, fill: "#334155" }} interval={0} />
                <YAxis domain={[0.5, 1]} tick={{ fontSize: 12, fill: "#334155" }} />
                <Tooltip />
                <Bar dataKey="birads" name="BI-RADS Macro-F1" fill="#1E88E5" radius={[8, 8, 0, 0]} />
                <Bar dataKey="cancer" name="Cancer F1" fill="#00AFA5" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[#EAF6FF] text-clinic-blue">
        <Icon className="h-6 w-6" />
      </span>
      <span>
        <h2 className="text-2xl font-black text-clinic-navy">{title}</h2>
        <p className="mt-1 text-sm font-medium text-slate-500">{subtitle}</p>
      </span>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text" }) {
  return (
    <label>
      <span className="label">{label}</span>
      <input className="field" type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function TextArea({ label, value, onChange, rows }) {
  return (
    <label>
      <span className="label">{label}</span>
      <textarea className="field resize-y" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <label>
      <span className="label">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option || "empty"} value={option}>
            {option || "请选择"}
          </option>
        ))}
      </select>
    </label>
  );
}

function ScoreCard({ label, value, color }) {
  return (
    <div className="rounded-2xl border border-clinic-line bg-white p-5 shadow-soft">
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-3 text-4xl font-black" style={{ color }}>
        {Number(value).toFixed(1)}
        <span className="text-base text-slate-400"> / 100</span>
      </p>
      <div className="mt-4 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full" style={{ width: `${clamp(value)}%`, background: color }} />
      </div>
    </div>
  );
}

function RiskGauge({ diagnosis }) {
  const color = RISK_COLORS[diagnosis.riskKey];
  const data = [
    { name: "risk", value: diagnosis.probability },
    { name: "rest", value: 100 - diagnosis.probability }
  ];
  return (
    <div className="rounded-2xl border border-clinic-line bg-white p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-lg font-black text-clinic-navy">风险仪表盘</p>
        <span className="rounded-full px-3 py-1 text-xs font-black text-white" style={{ background: color }}>
          {diagnosis.riskLevel}
        </span>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" startAngle={180} endAngle={0} innerRadius="68%" outerRadius="100%" paddingAngle={2}>
              <Cell fill={color} />
              <Cell fill="#E5EEF6" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="-mt-32 text-center">
          <p className="text-5xl font-black text-clinic-navy">{diagnosis.probability}%</p>
          <p className="text-sm font-bold text-slate-500">恶性风险概率</p>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <MiniStat label="BI-RADS" value={diagnosis.birads} />
        <MiniStat label="Cancer" value={diagnosis.cancer} />
        <MiniStat label="分层" value={diagnosis.group} />
      </div>
    </div>
  );
}

function RiskBand({ active }) {
  const bands = [
    ["BI-RADS 2/3", RISK_COLORS.low],
    ["4A", RISK_COLORS.mid],
    ["4B", RISK_COLORS.mid],
    ["4C/5", RISK_COLORS.high]
  ];
  return (
    <div className="rounded-2xl border border-clinic-line bg-white p-5 shadow-soft">
      <p className="text-lg font-black text-clinic-navy">管理导向风险分层</p>
      <div className="mt-4 grid grid-cols-4 gap-2">
        {bands.map(([label, color]) => (
          <div
            key={label}
            className={`rounded-xl border p-3 text-center text-sm font-black ${
              active === label ? "border-transparent text-white shadow-lg" : "border-clinic-line bg-[#F8FBFF] text-slate-600"
            }`}
            style={active === label ? { background: color } : {}}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function EvidenceTable({ evidence, compact = false }) {
  return (
    <div className={`rounded-2xl border border-clinic-line bg-white ${compact ? "mt-4" : "shadow-soft"} p-4`}>
      <p className="text-base font-black text-clinic-navy">结构化证据列表</p>
      <div className="mt-3 space-y-2">
        {evidence.map((item, index) => (
          <div key={`${item.label}-${index}`} className="grid gap-2 rounded-xl bg-[#F8FBFF] p-3 text-sm md:grid-cols-[.8fr_1fr_.8fr]">
            <span className="font-black text-clinic-blue">{item.category}</span>
            <span className="font-semibold text-slate-700">{item.label}</span>
            <span className="text-slate-500">{item.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl border border-clinic-line bg-[#F8FBFF] p-3">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-clinic-navy">{value}</p>
    </div>
  );
}

function MiniScore({ label, value, suffix = "/100" }) {
  return (
    <div className="rounded-xl bg-[#F8FBFF] p-3 text-center">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-black text-clinic-blue">
        {value}
        <span className="text-xs text-slate-400"> {suffix}</span>
      </p>
    </div>
  );
}

function scoreColor(score) {
  if (score >= 85) return RISK_COLORS.low;
  if (score >= 60) return RISK_COLORS.mid;
  return RISK_COLORS.high;
}

function App() {
  const [page, setPage] = useState("home");
  return (
    <div className="min-h-screen bg-clinic-bg text-clinic-text">
      <Header page={page} setPage={setPage} />
      {page === "home" && <LandingPage setPage={setPage} />}
      {page === "workspace" && <DiagnosisWorkspace />}
      {page === "architecture" && <ArchitecturePage />}
      <footer className="mx-auto max-w-[1500px] px-5 pb-8">
        <div className="rounded-2xl border border-red-100 bg-red-50 px-5 py-4 text-center text-sm font-bold leading-7 text-red-700">
          本系统仅用于科研展示和乳腺超声辅助筛查，不替代医生最终诊断。AI 输出结果需由专业医生结合影像、病理和临床资料综合判断。
        </div>
      </footer>
    </div>
  );
}

export default App;
