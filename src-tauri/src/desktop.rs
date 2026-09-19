#[cfg(windows)]
fn powershell() -> Result<std::process::Command, String> {
    use std::os::windows::process::CommandExt;
    let root = std::env::var_os("SystemRoot").ok_or("无法定位 Windows 系统目录")?;
    let path =
        std::path::PathBuf::from(root).join("System32/WindowsPowerShell/v1.0/powershell.exe");
    let mut command = std::process::Command::new(path);
    command.creation_flags(0x08000000);
    Ok(command)
}

#[cfg(windows)]
fn codex_terminal_command(home: &std::path::Path) -> Result<std::process::Command, String> {
    use std::os::windows::process::CommandExt;
    let mut command = powershell()?;
    command.creation_flags(0x00000010); // CREATE_NEW_CONSOLE
    command.args([
        "-NoLogo",
        "-NoProfile",
        "-NoExit",
        "-Command",
        "$ErrorActionPreference = 'Stop'; if (Get-Command codex.cmd -ErrorAction SilentlyContinue) { & codex.cmd } else { & codex }",
    ]);
    // Credentials and user-controlled paths are never interpolated into shell code.
    command.env("CODEX_HOME", home);
    command
        .env_remove("OPENAI_BASE_URL")
        .env_remove("OPENAI_API_KEY");
    Ok(command)
}

#[cfg(windows)]
pub fn open_codex_terminal(home: &std::path::Path) -> Result<(), String> {
    codex_terminal_command(home)?
        .spawn()
        .map_err(|e| format!("打开终端失败: {}", e))?;
    Ok(())
}

#[cfg(windows)]
pub async fn terminate_codex() -> Result<String, String> {
    let mut command = powershell()?;
    command.args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
        "$ErrorActionPreference='Stop'; $s=(Get-Process -Id $PID).SessionId; $p=@(Get-Process -Name codex -ErrorAction SilentlyContinue | Where-Object { $_.SessionId -eq $s }); foreach($item in $p){ Stop-Process -Id $item.Id -Force -ErrorAction Stop }; $p.Count"]);
    let mut command = tokio::process::Command::from(command);
    command.kill_on_drop(true);
    let output = tokio::time::timeout(std::time::Duration::from_secs(10), command.output())
        .await
        .map_err(|_| "终止 Codex 进程超时")?
        .map_err(|e| format!("执行失败: {}", e))?;
    if !output.status.success() {
        return Err(format!(
            "终止 Codex 进程失败: {}",
            String::from_utf8_lossy(&output.stderr).trim()
        ));
    }
    let count: u32 = String::from_utf8_lossy(&output.stdout)
        .trim()
        .parse()
        .map_err(|_| "无法确认终止的 Codex 进程数量")?;
    Ok(format!("已终止 {} 个 codex 进程", count))
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn terminal_path_is_environment_data_not_shell_code() {
        let home = std::path::Path::new("C:\\한글 이름\\' $(); & data");
        let command = codex_terminal_command(home).unwrap();
        assert_eq!(
            command
                .get_envs()
                .find(|(key, _)| *key == "CODEX_HOME")
                .unwrap()
                .1,
            Some(home.as_os_str())
        );
        let args: Vec<_> = command.get_args().collect();
        assert_eq!(
            args.last().unwrap().to_string_lossy(),
            "$ErrorActionPreference = 'Stop'; if (Get-Command codex.cmd -ErrorAction SilentlyContinue) { & codex.cmd } else { & codex }"
        );
        assert!(command
            .get_program()
            .to_string_lossy()
            .ends_with("powershell.exe"));
    }
}
