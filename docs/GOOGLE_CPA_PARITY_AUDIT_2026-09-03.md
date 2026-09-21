# Google / Antigravity 与 CPA 兼容约束

Genre: contract
Canonical for: Google / Antigravity Responses 工具链的兼容边界、未实现项和固定外部参考

CPA 固定参考提交：`17a65ee5470fbaf0e22fc219381e6a4ae9e07624`。范围仅为 Codex → Switcher → Google Antigravity → 工具调用/结果 → 后续回答，不声明与 CPA 的所有供应商、管理接口或产品能力等价。实际实现由 `src-tauri/src/antigravity/` 与 `src-tauri/src/proxy.rs` 所有。

## 必须保持的协议边界

- Codex Responses 可能只在 `input[].type=additional_tools` 中声明工具；根 `tools` 与 additional tools 都必须被纳入工具来源。同名声明以 additional 定义覆盖根定义且不得重复声明；namespace、custom tool 身份不能在声明/调用/结果往返中漂移。
- Google Schema 清理不能把 opaque 参数值改写成翻译文本；Google 不接受的注解需要在上游边界清理，但复杂 Schema 的语义不能被宣称为无损。
- Claude thinking 与命名/强制工具选择的上游互斥必须显式失败；不得为了通过请求而静默改变 thinking 深度或工具选择语义。
- custom tool 与普通 function 的 call/input/output 事件类型必须保持区分。工具由 Codex 侧执行；代理不得把 custom tool 误报为普通 function，也不得声称在 Google 侧强制执行 Lark/regex grammar。
- thought signature / `encrypted_content` 之类的协议载荷属于 opaque wire data。往返时必须保持可关联性，不能因展示或日志处理而翻译、重写或吞掉。
- 正常 EOF 与错误终止必须区分。只有完整工具帧与 usage 已经证明响应完整时，缺少 finishReason 的 clean EOF 才能按既有兼容规则处理；error、blockReason、异常 finish、MAX_TOKENS、传输中断不得伪装成 success/completed。
- WS 桥当前不拥有 CPA 式服务端增量会话缓存。依赖第三方 preconnect id 或服务端 replay cache 的客户端不能据此被宣称兼容；当前路径以客户端重发完整 input 为基础。
- 401/400/403/429 等错误必须按实际语义处理，不能把所有失败都当作可换号的容量耗尽；尤其短限流与真实耗尽需要独立分类。

## 仍未完成或未充分证明

- 429 短限流、真实耗尽、`Retry-After` 与流开始前重试的细分。
- 大规模同名/超长工具身份稳定性、并行工具结果乱序/缺失/重复的系统配对与去重。
- `$ref/$defs/allOf` 等复杂 Schema、multi-signature / 多段 thought、跨模型或压缩历史重放。
- 图片、base64/data URL、文件 MIME 等多模态工具结果事件链路。
- OpenAI managed `web_search` / `tool_search`、MCP 动态发现、结构化输出、temperature/top_p、cached/thought token 细分。
- idle/read timeout、WS 中途取消、心跳与断线恢复。未执行的 live OAuth、真实账号或第三方客户端验证不得记为通过。

## 验证与源码入口

- `src-tauri/src/antigravity/tool_tests.rs`: additional tools、工具身份、custom/function 事件、签名、终止条件等回归。
- `src-tauri/src/antigravity/translate.rs`, `src-tauri/src/antigravity/tools.rs`, `src-tauri/src/proxy.rs`: 当前实现入口。
- `scripts/google-tool-roundtrip.mjs`, `scripts/google-codex-probe.mjs`: 隔离往返/CLI 探针。真实用户目录或账号模式只在任务明确授权时运行。

## 固定源码参考

- [CPA 工具来源与身份映射](https://github.com/router-for-me/CLIProxyAPI/blob/17a65ee5470fbaf0e22fc219381e6a4ae9e07624/internal/util/responses_tools.go)
- [CPA Responses → Gemini](https://github.com/router-for-me/CLIProxyAPI/blob/17a65ee5470fbaf0e22fc219381e6a4ae9e07624/internal/translator/gemini/openai/responses/gemini_openai-responses_request.go)
- [CPA Gemini → Responses](https://github.com/router-for-me/CLIProxyAPI/blob/17a65ee5470fbaf0e22fc219381e6a4ae9e07624/internal/translator/gemini/openai/responses/gemini_openai-responses_response.go)
- [CPA WS 历史处理](https://github.com/router-for-me/CLIProxyAPI/blob/17a65ee5470fbaf0e22fc219381e6a4ae9e07624/sdk/api/handlers/openai/openai_responses_websocket_requests.go)
- [CPA Antigravity 流执行器](https://github.com/router-for-me/CLIProxyAPI/blob/17a65ee5470fbaf0e22fc219381e6a4ae9e07624/internal/runtime/executor/antigravity_executor_stream.go)
- [CPA 上游无 finishReason 回归测试](https://github.com/router-for-me/CLIProxyAPI/blob/17a65ee5470fbaf0e22fc219381e6a4ae9e07624/internal/runtime/executor/antigravity_executor_finish_reason_test.go)
- [OpenAI 工具协议](https://developers.openai.com/api/docs/guides/function-calling)
