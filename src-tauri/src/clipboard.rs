use std::process::Stdio;
use tokio::{
    io::AsyncWriteExt,
    process::Command,
    time::{timeout, Duration},
};

#[cfg(any(windows, test))]
fn windows_text(text: &str) -> Vec<u8> {
    // ASCII transport avoids console-codepage and BOM insertion/removal.
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .encode(text.as_bytes())
        .into_bytes()
}

pub async fn write_text(text: &str) -> Result<(), String> {
    #[cfg(windows)]
    let (mut command, input) = {
        let root = std::env::var_os("SystemRoot").ok_or("无法定位 Windows 系统目录")?;
        let mut command = Command::new(
            std::path::PathBuf::from(root).join("System32/WindowsPowerShell/v1.0/powershell.exe"),
        );
        command.args(["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-Command",
            "$ErrorActionPreference='Stop'; $text=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String([Console]::In.ReadToEnd())); Add-Type -AssemblyName System.Windows.Forms; if ($text.Length -eq 0) { [Windows.Forms.Clipboard]::Clear() } else { [Windows.Forms.Clipboard]::SetText($text, [Windows.Forms.TextDataFormat]::UnicodeText) }"]);
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        (command, windows_text(text))
    };
    #[cfg(target_os = "macos")]
    let (mut command, input) = (Command::new("/usr/bin/pbcopy"), text.as_bytes().to_vec());
    #[cfg(not(any(windows, target_os = "macos")))]
    let (mut command, input) = {
        let command = if std::env::var_os("WAYLAND_DISPLAY").is_some() {
            Command::new("wl-copy")
        } else {
            let mut command = Command::new("xclip");
            command.args(["-selection", "clipboard"]);
            command
        };
        (command, text.as_bytes().to_vec())
    };

    let mut child = command
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(if cfg!(test) {
            Stdio::inherit()
        } else {
            Stdio::null()
        })
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("无法启动剪贴板工具: {}", e))?;
    let seconds = if cfg!(windows) { 20 } else { 5 };
    let result = timeout(Duration::from_secs(seconds), async {
        let mut stdin = child.stdin.take().ok_or("剪贴板输入不可写")?;
        stdin
            .write_all(&input)
            .await
            .map_err(|e| format!("写入剪贴板失败: {}", e))?;
        drop(stdin);
        let status = child
            .wait()
            .await
            .map_err(|e| format!("等待剪贴板工具失败: {}", e))?;
        if !status.success() {
            return Err(format!("剪贴板工具退出失败: {}", status));
        }
        Ok(())
    })
    .await;
    match result {
        Ok(Ok(())) => Ok(()),
        Ok(Err(error)) => {
            let _ = child.kill().await;
            Err(error)
        }
        Err(_) => {
            let _ = child.kill().await;
            Err("剪贴板写入超时，请手动复制".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::windows_text;

    #[test]
    fn windows_clipboard_preserves_unicode_url_and_shell_metacharacters() {
        use base64::Engine;
        for text in [
            "한글 😀 https://example.invalid/?code=a&state=b%20c\r\n'$();<>|!",
            "\u{feff}preserve intentional BOM",
            "",
        ] {
            let bytes = windows_text(text);
            assert!(bytes.is_ascii());
            let decoded = base64::engine::general_purpose::STANDARD
                .decode(bytes)
                .unwrap();
            assert_eq!(String::from_utf8(decoded).unwrap(), text);
        }
    }

    #[test]
    fn empty_clipboard_payload_is_empty() {
        assert!(windows_text("").is_empty());
    }

    #[cfg(windows)]
    #[tokio::test]
    #[ignore = "Writes the OS clipboard; run only on an explicitly disposable CI runner"]
    async fn disposable_windows_clipboard_roundtrip() {
        assert_eq!(
            std::env::var("CODEX_SWITCHER_DISPOSABLE_TESTS").as_deref(),
            Ok("1")
        );
        assert_eq!(std::env::var("GITHUB_ACTIONS").as_deref(), Ok("true"));
        let long_url = format!(
            "https://example.invalid/authorize?state={}&extra=%25%26%22%3C",
            "a".repeat(1800)
        );
        for (index, text) in [
            "한글 😀 https://example.invalid/authorize?code=a&state=b%20c\r\n'$();<>|!",
            "\u{feff}preserve intentional BOM",
            long_url.as_str(),
            "",
        ]
        .into_iter()
        .enumerate()
        {
            println!("clipboard roundtrip case {}", index);
            super::write_text(text)
                .await
                .unwrap_or_else(|error| panic!("case {} write failed: {}", index, error));
            let root = std::env::var_os("SystemRoot").unwrap();
            let output = tokio::process::Command::new(std::path::PathBuf::from(root)
            .join("System32/WindowsPowerShell/v1.0/powershell.exe"))
            .args(["-NoProfile", "-NonInteractive", "-STA", "-Command",
                "[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false); [Console]::Write((Get-Clipboard -Raw))"])
            .output().await.unwrap();
            assert!(output.status.success());
            assert_eq!(String::from_utf8(output.stdout).unwrap(), text);
        }
    }
}
