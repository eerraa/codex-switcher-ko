# Kimi 编程套餐额度与中转模型当前号约束

Genre: contract
Canonical for: Kimi Coding 额度读取、per-model relay current 存储语义和相关 WS 边界

## 额度

- Kimi Coding 使用配置的 Base URL + `/usages`，官方 `/coding` 自动规范为 `/coding/v1/usages`；静态 Key 只发往配置的服务，不伪造 KimiCLI 的 User-Agent。
- `RelayUsageCache.windows` 为可选、向后兼容的新字段，分别存储 5H 与 7D 剩余百分比和 Unix 重置时间。
- 自动识别官方 Coding 地址；自定义中转需显式选择 `kimi_coding` 额度策略。显式选择“不拉取”不会自动探测。
- 启动后自动查询，随后每分钟更新；保留手动刷新。每台 Switcher 使用本机保存的该账号 Key 进行只读查询，不改变 RT/ST 所有权。
- 缺失值显示 `--`；超过三分钟未更新提示数据过期。重置时间到达不擅自填满 100%，等待上游新数据。
- 查询不发模型生成请求，不开启加油包，不自动购买/消费额外额度，不更改当前账号。

## 独立当前号

- `AppSettings.current_relay_accounts` 按实际 upstream model ID 存储当前 Relay account ID。不同模型互不覆盖，且不修改 `AccountStore.current`、Google 当前号或 Codex auth.json。
- 同一模型多个来源：只显示一个 `relay-current:<model>` 可选模型；请求按当前映射选择账号、地址与 Key。
- 旧 `relay-model:<account-id>:<model>` 保留为隐藏目录项，避免旧任务的模型被判定停用。旧标识同样跟随该模型的新当前号；不再永久钉死旧账号。
- 账号行显示 Kimi 当前 / DeepSeek 当前；不同模型分别选择时可显示“部分模型当前”，tooltip 列出模型 ID。
- 行内切号按钮将该账号配置的模型设为当前；底层独立命令也支持指定一个模型。其它模型的当前选择不变。
- 首个账号自动建立初始选择；删除当前账号后修复选择。手动指定的账号若失效，不擅自换到另一个可能收费的来源。
- 保存其它设置时保留最新模型选择，避免旧设置表单覆盖刚完成的切号。
- 此契约适用于原生 Responses 中转；旧 Chat Completions 中转流程保留。上游 alias 不同（如 `k3` 与 `kimi-k3`）视为不同配置模型。
- 每台设备的模型当前映射为本地路由状态，与既有 Google 当前号的本地语义一致。

## WS 路由边界

- 明确的 provider model routing hint 存在时，不应为了决定 relay 目标而先预检或连接无关的 ChatGPT upstream。没有 hint 的旧客户端仍需要首帧兜底。
- 握手/前帧已经给出的 model 可以作为后续省略 model 帧的默认值；后续显式 model 始终优先。
- 不支持的 `response.append` 必须明确失败，桥接错误必须产生可识别的 `response.failed` 并结束连接，不能静默等待。
- Kimi upstream 的首响应延迟会波动；现有验证只证明路由可工作，不定义或承诺固定首包 SLA。

## 验证与源码入口

- `src-tauri/src/kimi_quota.rs`: Coding usage URL、窗口解析、只读额度语义。
- `src-tauri/src/account.rs`, `src-tauri/src/relay_catalog.rs`, `src-tauri/src/lib.rs`: `AppSettings.current_relay_accounts` 的定义、选择/修复与设置保存规则。
- `src-tauri/src/proxy.rs`, `scripts/relay-ws-hint-smoke.mjs`: routing hint、WS/HTTP bridge 与错误终止。
- `scripts/relay-native-mock.mjs`, `scripts/fixtures/relay-accounts.json`, `scripts/relay-native-smoke.mjs`: 不含真实账号的隔离 relay fixture。
- 真实 Key、真实账号、运行中应用或用户目录探针不是普通回归的一部分；未明确执行时记为未验证。
