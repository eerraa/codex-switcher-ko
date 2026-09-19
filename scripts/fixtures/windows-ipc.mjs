// Only resolved by windows-ui-smoke.mjs; no native operation or external request.
const params = new URLSearchParams(location.search);
const now = Math.floor(Date.now() / 1000);
const quota = { five_hour_left: 83, weekly_left: 56, plan_type: 'team',
  five_hour_reset_at: now + 4800, weekly_reset_at: now + 259200,
  five_hour_reset: '1小时20分钟后重置', weekly_reset: '3天后重置',
  five_hour_label: '5H 限额', weekly_label: '周限额',
  is_valid_for_cli: true, credits_balance: null, has_credits: false, updated_at: new Date().toISOString() };
export const account = { id: 'windows-fixture', name: params.has('long') ? 'long-name-'.repeat(40) : 'fixture@example.invalid',
  kind: 'chatgpt_oauth', auth_json: {}, cached_quota: params.has('unknown') ? null : quota,
  is_banned: false, is_token_invalid: false, is_logged_out: false,
  created_at: new Date().toISOString(), last_used: null,
  keepalive: { inactive_refresh_enabled: false, last_error: null } };
export const settings = { auto_reload_ide: true, primary_ide: 'Windsurf', use_pkill_restart: false,
  background_refresh: false, refresh_interval_minutes: 30, inactive_refresh_days: 7,
  theme_palette: 'midnight', allow_auto_switch_to_free: false, proxy_enabled: false, proxy_port: 18080,
  proxy_allow_lan: false, switch_mode: 'auto', remote_mode: 'off', remote_shared_secret: '',
  relay_auto_switch_in: false, relay_auto_switch_out: true };
const responses = {
  get_accounts: [account], get_current_account_id: account.id, get_settings: settings,
  get_codex_fast_mode: false, get_codex_features_goals: false, check_codex_login: false,
  get_proxy_status: { enabled: false, is_running: false, port: 18080, base_url: 'http://localhost:18080/v1', allow_lan: false, total_requests: 0, auto_switches: 0 },
  get_token_stats: { total_input_tokens: 0, total_output_tokens: 0, total_tokens: 0, total_cost_usd: 0, total_requests: 0 },
  get_quota_by_id: quota, get_desktop_referral_eligibility: { should_show: false },
};
const state = window.__compat = { calls: [], denied: [], clipboard: null, copyFailure: false, loginDelay: 0, backendFailure: false,
  url: 'https://example.invalid/authorize?response_type=code&state=unchanged&code_challenge=' + 'a'.repeat(1800) + '&extra=%25%26%22%3C' };
export async function invoke(command, args = {}) {
  state.calls.push({ command, args });
  if (command === 'start_oauth_login' || command === 'start_antigravity_oauth_login') {
    await new Promise(resolve => setTimeout(resolve, state.loginDelay));
    return state.url;
  }
  if (command === 'copy_to_clipboard') {
    if (state.copyFailure) throw '无法启动剪贴板工具: mock unavailable';
    state.clipboard = args.text;
    return null;
  }
  if (state.backendFailure && command === 'get_accounts') throw 'Mock backend unavailable';
  if (Object.hasOwn(responses, command)) return structuredClone(responses[command]);
  state.denied.push(command);
  throw new Error('MOCK_DENIED: ' + command);
}
const handlers = new Map();
export async function listen(name, callback) {
  const callbacks = handlers.get(name) ?? new Set();
  callbacks.add(callback); handlers.set(name, callbacks);
  return () => callbacks.delete(callback);
}
export async function emit(name, payload) { for (const callback of handlers.get(name) ?? []) callback({ payload }); }
state.emit = emit;
export const getVersion = async () => 'fixture';
export const getCurrentWebviewWindow = () => ({ label: params.get('view') === 'tray' ? 'tray-popup' : 'main' });
export const open = async () => null;
export const readFile = async () => { throw new Error('Fixture filesystem access denied'); };
export const openUrl = async () => { throw new Error('Fixture external navigation denied'); };
