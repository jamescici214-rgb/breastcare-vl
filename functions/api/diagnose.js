const DEFAULT_BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen2.5-vl-72b-instruct";

const SYSTEM_PROMPT = `你是乳腺超声辅助筛查系统的结构化诊断模块。
你必须只输出 JSON，不要输出 Markdown，不要输出长篇医学推理。
系统仅用于科研展示和乳腺超声辅助筛查，不替代医生最终诊断。

请基于乳腺超声图像、结构化字段、原始报告和标准标签，输出：
{
  "birads": "BI-RADS 3 或 BI-RADS 4A 或 BI-RADS 4B 或 BI-RADS 4C 或 BI-RADS 5",
  "cancer": "倾向良性/低度可疑/中度可疑/高度可疑/高度提示恶性",
  "group": "BI-RADS 2/3 或 4A 或 4B 或 4C/5",
  "riskLevel": "低风险/中风险/高风险",
  "probability": 0-100 的整数,
  "evidence": [{"label":"标准化征象","category":"形态/边缘/回声/钙化/血流/淋巴结/后方回声/其他","source":"图像/报告/结构化字段"}],
  "recommendation": "一句辅助筛查建议"
}

约束：
1. 不要编造图像中无法确认的征象。
2. 如果图像质量或报告信息不足，应在 evidence 中说明信息不足。
3. recommendation 必须提醒由专业医生结合影像、病理和临床资料综合判断。`;

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8"
    }
  });
}

function parseModelJson(text) {
  const cleaned = String(text || "")
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("模型未返回可解析 JSON。");
    return JSON.parse(match[0]);
  }
}

function normalizeDiagnosis(raw, source = "qwen-api") {
  const probability = Number(raw.probability);
  const riskLevel = raw.riskLevel || raw.risk_level || (probability >= 60 ? "高风险" : probability >= 10 ? "中风险" : "低风险");
  const riskKey = riskLevel.includes("高") ? "high" : riskLevel.includes("中") ? "mid" : "low";
  const evidence = Array.isArray(raw.evidence)
    ? raw.evidence.map((item) => ({
        label: String(item.label || item.finding || "信息不足"),
        category: String(item.category || "其他"),
        source: String(item.source || "模型输出")
      }))
    : [{ label: "模型未返回结构化证据", category: "其他", source: "模型输出" }];

  return {
    birads: String(raw.birads || raw["BI-RADS"] || "待医生复核"),
    cancer: String(raw.cancer || raw.cancer_prediction || "待医生复核"),
    group: String(raw.group || raw.management_group || "待分层"),
    riskLevel,
    riskKey,
    probability: Number.isFinite(probability) ? Math.max(0, Math.min(100, Math.round(probability))) : 0,
    suspiciousScore: evidence.filter((item) => !item.label.includes("信息不足")).length,
    evidence,
    recommendation: String(raw.recommendation || "建议由专业医生结合影像、病理和临床资料综合判断。"),
    source
  };
}

function extractDiagnosis(payload, source) {
  if (payload?.diagnosis) return normalizeDiagnosis(payload.diagnosis, source);
  if (payload?.choices?.[0]?.message?.content) {
    return normalizeDiagnosis(parseModelJson(payload.choices[0].message.content), source);
  }
  return normalizeDiagnosis(payload, source);
}

function buildPrompt(body) {
  return `请对以下乳腺超声筛查病例进行结构化辅助诊断。

结构化字段：
${JSON.stringify(body.fields || {}, null, 2)}

医生报告/原始描述：
${body.reportText || ""}

BI-RADS 标准映射标签：
${JSON.stringify(body.tags || [], null, 2)}

请只返回 JSON。`;
}

async function callOpenAICompatible(body, env) {
  const apiKey = env.QWEN_API_KEY;
  const baseUrl = env.QWEN_BASE_URL || DEFAULT_BASE_URL;
  const model = env.QWEN_MODEL || DEFAULT_MODEL;

  if (!apiKey) {
    throw new Error("缺少 QWEN_API_KEY。请在 Cloudflare Pages 的 Settings > Variables and Secrets 中添加加密密钥。");
  }

  const content = [{ type: "text", text: buildPrompt(body) }];
  if (body.imageDataUrl) {
    content.push({
      type: "image_url",
      image_url: { url: body.imageDataUrl }
    });
  }

  const upstream = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content }
      ]
    })
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`Qwen API 调用失败：${upstream.status} ${text.slice(0, 900)}`);
  }

  return {
    model,
    provider: baseUrl,
    diagnosis: extractDiagnosis(JSON.parse(text), "qwen-openai-compatible")
  };
}

async function callSelfHosted(body, env) {
  const endpoint = env.QWEN_SELF_HOSTED_URL;
  if (!endpoint) {
    throw new Error("缺少 QWEN_SELF_HOSTED_URL。请填写你自部署 Qwen2.5-VL 服务的公网 HTTPS 地址。");
  }

  const headers = { "content-type": "application/json" };
  if (env.QWEN_SELF_HOSTED_API_KEY) {
    headers.authorization = `Bearer ${env.QWEN_SELF_HOSTED_API_KEY}`;
  }

  const upstream = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      imageDataUrl: body.imageDataUrl || null,
      fields: body.fields || {},
      reportText: body.reportText || "",
      tags: body.tags || [],
      systemPrompt: SYSTEM_PROMPT,
      outputSchema: {
        birads: "string",
        cancer: "string",
        group: "string",
        riskLevel: "string",
        probability: "integer 0-100",
        evidence: [{ label: "string", category: "string", source: "string" }],
        recommendation: "string"
      }
    })
  });

  const text = await upstream.text();
  if (!upstream.ok) {
    throw new Error(`自部署 Qwen 服务调用失败：${upstream.status} ${text.slice(0, 900)}`);
  }

  return {
    model: env.QWEN_SELF_HOSTED_MODEL || "self-hosted-qwen2.5-vl",
    provider: endpoint,
    diagnosis: extractDiagnosis(JSON.parse(text), "self-hosted-qwen")
  };
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const mode = body.mode || context.env.QWEN_BACKEND_MODE || (context.env.QWEN_SELF_HOSTED_URL ? "self-hosted" : "openai-compatible");
    const result = mode === "self-hosted" ? await callSelfHosted(body, context.env) : await callOpenAICompatible(body, context.env);

    return jsonResponse({
      ok: true,
      mode,
      ...result
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : "未知后端错误。"
      },
      500
    );
  }
}

export function onRequest() {
  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
}
