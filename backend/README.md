# BreastCare-VL 本地 Qwen2.5-VL-7B LoRA 后端

这个目录用于把本地模型 `E:\zhz\7B` 和 LoRA 权重 `E:\zhz\epoch-5` 启动成 FastAPI 服务，供网站的 `/api/diagnose` 调用。

## 1. 安装依赖

建议在你跑 Qwen2.5-VL 的 Python / CUDA 环境里执行：

```powershell
pip install -r backend\requirements-qwen.txt
```

## 2. 验证 LoRA 是否能加载

如果有一张乳腺超声测试图像：

```powershell
python backend\qwen_lora_server.py --smoke-test --image "E:\path\to\test.jpg"
```

如果只是先验证权重路径和模型加载，可以不传图像：

```powershell
python backend\qwen_lora_server.py --smoke-test
```

默认路径：

```text
base model: E:\zhz\7B
LoRA:       E:\zhz\epoch-5
```

## 3. 启动本地 API

```powershell
python backend\qwen_lora_server.py --host 127.0.0.1 --port 8000
```

接口地址：

```text
POST http://127.0.0.1:8000/v1/breastcare/diagnose
GET  http://127.0.0.1:8000/health
```

## 4. 本地联调网站

在项目根目录创建 `.dev.vars`：

```text
QWEN_BACKEND_MODE=self-hosted
QWEN_SELF_HOSTED_URL=http://127.0.0.1:8000/v1/breastcare/diagnose
QWEN_SELF_HOSTED_MODEL=qwen2.5-vl-7b-lora-epoch-5
```

然后启动 Cloudflare Pages Function 本地联调：

```powershell
npm run cf:dev
```

## 5. 线上网站接入

线上 Cloudflare Pages 不能直接访问你电脑的 `127.0.0.1`。如果线上比赛展示需要评委直接访问网页并使用模型，需要把本地服务暴露为 HTTPS，例如 Cloudflare Tunnel：

```text
https://qwen-api.jamescici.qzz.io/v1/breastcare/diagnose
```

然后在 Cloudflare Pages 的 `Settings > Variables and Secrets` 中添加：

```text
QWEN_BACKEND_MODE=self-hosted
QWEN_SELF_HOSTED_URL=https://qwen-api.jamescici.qzz.io/v1/breastcare/diagnose
QWEN_SELF_HOSTED_MODEL=qwen2.5-vl-7b-lora-epoch-5
```

