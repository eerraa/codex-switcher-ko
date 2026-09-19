import baseline from './upstream.json' with { type: 'json' };
// Imported only by the isolated browser smoke server, never the app build.
const now = Math.floor(Date.now() / 1000);
const quota = {
  five_hour_left: 83, five_hour_reset: '1小时20分钟后重置', five_hour_reset_at: now + 4800,
  five_hour_label: '5H 限额', weekly_left: 56, weekly_reset: '3天后重置',
  weekly_reset_at: now + 259200, weekly_label: '周限额', plan_type: 'pro',
  has_credits: false, credits_balance: null, is_valid_for_cli: true, updated_at: new Date().toISOString(),
};
const account = {
  id: 'ko-smoke', name: 'smoke@example.invalid', auth_json: {}, kind: 'chatgpt_oauth',
  created_at: new Date().toISOString(), last_used: null, notes: null, cached_quota: quota,
  keepalive: { inactive_refresh_enabled: false, last_attempt_at: null, last_success_at: null, last_error: null },
  is_banned: false, is_token_invalid: false, is_logged_out: false,
};
const settings = {
  auto_reload_ide: false, primary_ide: 'Windsurf', use_pkill_restart: false,
  background_refresh: false, refresh_interval_minutes: 30, inactive_refresh_days: 7,
  theme_palette: 'midnight', allow_auto_switch_to_free: false, proxy_enabled: false,
  proxy_port: 18080, proxy_allow_lan: false, switch_mode: 'auto', remote_mode: 'off',
  remote_server_port: 18081, remote_server_bind: '0.0.0.0', remote_server_url: '',
  remote_server_url_fallback: '', remote_shared_secret: '', solo_auto_sync_current: true,
  proxy_bootstrap_byte_cap: 32768, proxy_bootstrap_time_cap_ms: 8000,
  relay_auto_switch_out: true, relay_auto_switch_in: false, client_direct_upstream: false,
  client_owns_current: false,
};
const responses = {
  get_accounts: [account], get_current_account_id: account.id, get_settings: settings,
  get_quota_by_id: quota, get_proxy_status: { is_running: false, port: 18080, allow_lan: false, total_requests: 0, active_connections: 0, current_account: account.name },
  get_sync_status: { is_synced: true, disk_email: account.name, matching_id: account.id, current_id: account.id },
  check_sync_conflict: null, check_codex_login: false,
  get_codex_fast_mode: false, get_codex_features_goals: false,
  get_token_stats: { total_input_tokens: 0, total_output_tokens: 0, total_tokens: 0, total_cost_usd: 0, total_requests: 0 },
  get_token_history: [], get_session_bindings: [], get_plan_capacity_estimates: [], get_account_token_history: [],
  get_switch_stats: { today_count: 1, week_count: 1, total_count: 1, by_reason: { '手动切号': 1 }, by_account: { 'ko-smoke': 1 } },
  get_switch_history: [{ timestamp: new Date().toISOString(), from_account: null, to_account: account.name, reason: '手动切号', from_quota_5h: null, to_quota_5h: 83 }],
  list_session_routes: [], list_codex_sessions: [], detect_active_codex_session: null,
  get_installed_skills: [], get_skill_repos: [], get_skill_app_status: {}, scan_and_import_skills: 0,
  get_desktop_referral_eligibility: { should_show: false },
};
export async function invoke(command) {
  (window.__mockCalls ??= []).push(command);
  if (!Object.hasOwn(responses, command)) {
    (window.__mockDenied ??= []).push(command);
    throw new Error(`MOCK_DENIED: ${command}`);
  }
  return structuredClone(responses[command]);
}
export const getVersion = async () => baseline.koreanVersion;
export const listen = async () => () => {};
export const emit = async () => {};
export const getCurrentWebviewWindow = () => ({
  label: new URLSearchParams(location.search).has('tray') ? 'tray-popup' : 'main',
  hide: async () => {}, onFocusChanged: async () => () => {},
});
export const open = async () => null;
export const save = async () => null;
export const readFile = async () => { throw new Error('Mock filesystem is read-disabled'); };
export const writeTextFile = async () => { throw new Error('Mock filesystem is write-disabled'); };
export const openUrl = async () => { throw new Error('Mock external navigation is disabled'); };
