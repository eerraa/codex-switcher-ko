const platform = typeof navigator === 'undefined' ? '' : navigator.platform;
export const isWindows = platform.startsWith('Win');
export const isMacOS = platform.startsWith('Mac');

export function codexLaunchCommand(baseUrl: string, windows = isWindows): string {
    if (windows) return `$env:OPENAI_BASE_URL='${baseUrl.replace(/'/g, "''")}'; codex`;
    return `OPENAI_BASE_URL='${baseUrl.replace(/'/g, "'\\''")}' codex`;
}
