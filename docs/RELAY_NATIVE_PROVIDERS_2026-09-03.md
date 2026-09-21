# Kimi / DeepSeek 原生 Responses 中转约束

Genre: contract
Canonical for: native Responses relay 的模型目录、凭据隔离、协议边界和验证入口

## 用户可见与路由约束

- 添加中转卡片统一展示公司/服务名称，不再展示模型版本。版本仅出现在默认模型配置和 Codex 模型选择器。
- Kimi 默认 `https://api.moonshot.cn/v1`、`kimi-k3`，原生 Responses。
- DeepSeek 默认 `https://api.deepseek.com`，默认 Pro，同时配置 Flash / Flash Vision 可选项，原生 Responses。保留用户提供的路径前缀，仅追加 `/responses`，不强制添加 `/v1`。
- 两家 API 地址、默认模型 ID、协议均可编辑。免费/自有中转使用它自己的地址、凭据及实际模型 ID；不强制回官网。
- 原生 Responses 中转的兜底模型及映射表目标模型进入 Codex 目录，名称包含账号名，内部 slug 为 `relay-model:<account-id>:<upstream-model>`。同名模型在不同中转下不会串号。
- 按模型独立选路，不需要修改当前 ChatGPT/Google 账号。下游只收到该中转 Key；不发送客户端 ChatGPT 凭据、账号 ID、Cookie。
- 使用 HTTP 原生 Responses 透传，不走 Chat Completions 转译，不运行厂商的一键改配置脚本，不复制其系统提示词。

## 边界

- 此契约只覆盖原生 Responses 中转的独立模型目录。旧 Chat Completions 中转按原有方式使用，不自动升级或改写已保存账号。
- 中转必须提供所选协议及模型；“免费”不代表无鉴权或支持全部官方模型。不会替用户声称服务免费/可用。
- 目录来自配置的模型 ID，并非已通过 Key 从上游发现并验证的模型列表。新账号添加后 Codex 需要刷新模型目录才能显示。
- 已知 Kimi / DeepSeek V4 使用官方 1M 上下文和 low/high/max 档位；自定义模型名不猜测其能力，保守提供基础元数据。
- 原生中转元数据优先 HTTP。携带明确 routing hint 的 WS 直接分流到本机 HTTP 桥；无 hint 老客户端保留首帧兜底。未引入跨供应商服务端会话缓存。
- 没有明确执行真实 Kimi / DeepSeek Key 验证时，不得宣称真实上游对话或工具调用已经通过。

## 验证入口

- relay catalog / routing tests own company metadata、custom URL prefix、native tool history、invalid-model rejection、current-account independence and credential isolation.
- `scripts/relay-native-mock.mjs` + `scripts/fixtures/relay-accounts.json` + `scripts/relay-native-smoke.mjs` 使用隔离账号 fixture；不存在的模型必须拒绝，不能静默回落 GPT。
- UI fixture 可以验证 AddRelayModal 的展示与编辑边界，但不能证明真实 Kimi / DeepSeek Key、网络服务或 live account 可用。

## 官方依据

- [Kimi Codex 接入](https://platform.kimi.com/docs/guide/codex-kimi)
- [Kimi Responses API](https://platform.kimi.com/docs/api/responses)
- [DeepSeek 首次调用](https://api-docs.deepseek.com/zh-cn/)
- [DeepSeek Codex 接入与模型元数据](https://api-docs.deepseek.com/zh-cn/quick_start/agent_integrations/codex)
