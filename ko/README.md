# 한국어 패치 유지 계약

## 기준과 범위

정본 버전은 `upstream.json`의 `version`과 `commit`이다. `tag`는 해당 시점에 존재하는 최근 릴리스 태그이며 선택한 main commit과 다를 수 있다. 호환성 제출 목록은 같은 파일의 `compatibilityPRs`, 분리 기준은 `compatibilityPRBase`로 추적한다. `origin`은 `eerraa/codex-switcher-ko`, `upstream`은 `VallierDev/codex-switcher`. 버전명·릴리스 태그·실제 커밋을 함께 확인한다. 한국어판 태그는 `v<원본 버전>-ko.<패치 번호>`.

문서 체계 규약의 고정 revision은 `AGENTS.md` 한 곳이 소유한다. 일반 유지보수는 이 로컬 계약과 관련 소스·검사만으로 수행하며, 중앙 규약은 문서 체계를 바꿀 때만 조회한다.

한국어 표시·번역 검사·Windows 패키징과 upstream 제출용 플랫폼 호환성 패치만 유지한다. 호환성 변경은 한국어 커밋과 분리하고 upstream 수용 시 중복을 제거한다. 계정·인증·라우팅 알고리즘, 사용자 데이터 스키마, 별명 등 독자 기능은 변경하지 않는다. 추가 npm/Cargo 패키지는 없다. 번역 자체는 `src/`를 재작성하지 않는 빌드 레이어이며, 기능 소스 차이는 검토된 플랫폼 경계와 원래 트레이 번역에 한정한다.

`README.md`와 `docs/*.md`의 원본 제품 설명·프로토콜 자료는 구현과 배경을 확인하는 참고자료다. 거기에 남아 있는 macOS 앱 재시작, 사설 LAN/원격 호스트, scp 배포, 개인 `~/.claude` / `~/.codex` 전역 설정은 이 Windows 포크 작업의 실행 의무가 아니다. 설치·배포·실계정·전역 설정 변경은 현재 작업이 그 행위를 명시적으로 승인할 때만 수행한다.

분리 PR은 각각 upstream 기준의 단일 커밋이며 서로 선행 병합을 요구하지 않는다. `compatibilityDeferred`는 현재 한국어판 구현에 남아 있지만 upstream 제출에서는 보류한 범위다. 기존 통합 구현은 `compatibilityArchive`에 보존한다. PR 분리만으로 한국어판 실행 코드·버전·설치 파일을 변경하지 않는다. 동기화 시 수용된 PR과 실제 source를 대조하여 중복만 제거한다.

## 구조: 원본 보존형 빌드 레이어

| 정본 파일 | 역할 / 수정 시점 |
| --- | --- |
| `catalog.json` | 프런트엔드 원문 → 한국어. 원문이 키이자 fallback이다. 새 원문은 새 키이며 삭제된 키는 감사 실패다. |
| `backend.json` | 원본 Rust 파일별 사용자 표시 메시지. 키는 Rust 문자열 그대로, `{}`는 순서대로 `{0}`로 정규화한다. 원문 삭제·변경 시 감사 실패다. |
| `policy.json` | 번역하지 않는 내부 값과 검토된 표시 지점/예상 개수. 계정 이름·사용자 문서·모델 ID·IPC 객체는 번역하지 않는다. |
| `source.mjs`, `transform.mjs`, `vite-plugin.mjs` | TypeScript AST로 Vite 입력만 변환한다. JSX escape/문장 전체 보간을 사용하며 DOM 감시·HTML 치환·정규식 코드 치환은 하지 않는다. |
| `runtime.mjs`, `catalog.mjs` | 표시 문구만 매칭한다. 자리 값은 원문 그대로 유지하며 재귀 번역하지 않는다. 시간 파싱과 통계 필터 이후에 표시를 번역한다. |
| `audit.mjs`, `checks.mjs`, `review.mjs` | 누락·불필요한 키·자리표시자·한자 잔존·원문/표시 지점 변경·전체 source hash 변경을 검출한다. |
| `typecheck.mjs`, `*.test.mjs` | 변환된 코드의 타입 검사와 원본 대비 기능 보호 회귀 검사. 원본 `tsc` 통과만으로 완료 처리하지 않는다. |
| `smoke.mjs`, `browser-fixture.mjs` | 격리된 Chromium과 가짜 Tauri IPC로 UI를 확인한다. 테스트 산출물/프로필은 Git에서 제외한 `.smoke.local/`에 저장한다. |
| `tauri.windows.json`, `build-windows.mjs` | 한국어판 버전·한국어 NSIS 설치 프로그램·빌드 전 검사. 원본 Cargo/Tauri 버전 파일은 유지한다. |
| `../scripts/windows-ui-smoke.mjs`, `../scripts/windows-compat.test.mjs` | upstream 공용 경계 회귀 검사. 380×410 트레이, 긴 OAuth URL, 복사 실패·재시도·닫기, Windows 플랫폼 분기를 가짜 IPC로 검증한다. |


원안의 모든 JSX를 `t(key)`로 바꾸는 방식 대신 소스를 보존하여 병합 충돌을 줄였다. 대신 이 변환기는 범용 자동 번역기가 아니다. 새 중국어 문자열이 프로그램의 데이터/식별자인지 검토해야 한다. 비교식·정규식·타입·로그의 중국어는 정상이다. 버전 변경 때 소스 해시 검사는 보수적으로 변경 파일 전체를 표시하며, 문자열 분석만으로 새 데이터 흐름을 증명하지 않는다.

알 수 없는 문구는 원문으로 표시한다. 서버의 기술적 진단·제3자 응답·계정 이름·Skills 설명·코드·경로·Token은 번역하지 않는다. 매칭된 문장 안의 오류 상세도 값 그대로 보존하므로 한국어 문장에 원문 진단이 포함될 수 있다. 제품명·API·OAuth·Refresh Token·Skills·GLM·MiMo 등 식별 용어는 유지한다.

## 명령

아래 명령은 영향별 검증·빌드 진입점이며 한 작업에서 모두 실행하는 체크리스트가 아니다. Node 24와 lockfile의 의존성을 사용하고 Windows Rust 검증 기준은 1.94.0 MSVC이다. 패키지 설치, native build, 브라우저 smoke, 설치 파일 생성은 현재 작업의 영향과 권한에 맞을 때만 실행한다.

```text
npm ci
npm run i18n:check
npm run build
node ko/smoke.mjs
node --test scripts/windows-compat.test.mjs
node scripts/windows-ui-smoke.mjs --korean
rustup run 1.94.0-x86_64-pc-windows-msvc cargo check --locked --all-targets --manifest-path src-tauri/Cargo.toml
node ko/build-windows.mjs
```

`BROWSER_PATH`로 Chromium 호환 실행 파일을 지정할 수 있다. Windows에서는 Edge/Chrome을 자동 검색한다. `build-windows.mjs`는 자식 프로세스에만 Rust toolchain을 지정하며 전역 기본값을 변경하지 않는다. 검사 스크립트를 우회해 만든 패키지는 한국어 릴리스로 취급하지 않는다. 실제 클립보드 왕복 테스트는 기본 무시되며 일회용 GitHub Actions Windows runner에서만 명시적으로 실행한다. 로컬 테스트는 운영 클립보드·계정·프로세스를 변경하지 않는다.

## upstream 갱신: 중급 워커 실행 순서

이 절은 upstream sync/release 작업이 명시적으로 승인된 경우에만 적용한다. 문서를 읽는 것 자체가 fetch, branch 생성, merge, 패키지 설치, push, tag 권한을 부여하지 않는다.

1. dirty 변경을 보존하고 `git fetch upstream --tags`한다. 릴리스의 실제 commit/version을 확인한다. 원본 README의 최신 표기나 `main` 위치만 믿지 않는다.
2. `git switch -c sync/<선택한 버전>` 후 이전 `upstream.json.commit`부터 선택한 commit까지의 diff만 검토한다. 기능은 upstream 우선이다. 제출한 호환성 PR의 병합 여부와 동등한 수정의 존재를 확인해 중복 패치를 제거한다. 한국어 때문에 기능 충돌을 독자 해결하거나 코드를 정리하지 않는다.
3. 선택한 commit을 merge한다. `npm ci` 후 `npm run i18n:audit`에서 보고한 원문/표시 위치를 처리한다. 내부 값이면 보호 규칙과 표시 지점을 함께 등록하고 회귀 테스트를 추가한다. Rust 변경은 사용자 노출 경로만 사전에 추가한다.
4. 없어진 사전 항목·표시 규칙은 삭제한다. 원문 수정은 새 키로 번역한다. `{n}` 자리표시자의 번호와 개수는 유지하되 한국어 어순으로 재배치할 수 있다. 비어 있는 번역·추측성 ignore는 금지한다.
5. 변경 파일의 데이터 흐름을 확인한 뒤에만 `node ko/review.mjs --accept`한다. 이 파일은 현재 검토 상태 하나만 보관한다. CI나 업데이트 스크립트에서 무조건 재생성하지 않는다.
6. `upstream.json`의 tag/commit/koreanVersion과 `tauri.windows.json` 버전을 맞춘다. `npm run i18n:check`, `npm run build`, 모의 화면 검사를 실행한다. Rust/Tauri/설치 설정 변경 또는 배포 시 native check/build를 실행한다.
7. 기능 보존·검사 결과를 확인해 main에 병합한다. 관심사별 commit 후 origin에 push한다. 빌드 산출물 SHA-256을 확인하고 그 commit에 한국어 태그를 붙인다. 수정 이력을 문서에 누적하지 않는다.

## 용어 고정

Account=계정, Proxy=프록시, Relay/中转=릴레이, Route=라우팅, Quota=한도, Usage=사용량, Cache=캐시, Session=세션, 保活=로그인 유지, 周期保鲜=한도 주기 활성화, 手机锚=모바일 고정 계정, 主动重置=수동 초기화. UI에 원래 있던 경고의 조건·부작용·복구 불가 문구는 생략하지 않는다.

## 배포와 검증 경계

- Windows 설치 파일: `src-tauri/target/release/bundle/nsis/`. 빌드는 설치/실행과 다르다. 서명하지 않은 패키지는 Windows의 보안 경고가 나올 수 있다.
- 앱 식별자, 데이터 디렉터리, OAuth/deep-link 스킴, 프록시 포트는 원본과 같다. 실제 설치가 승인된 작업에서만 원본을 종료하고 데이터를 백업한 뒤 설치하며, 인증·프록시는 그 실제 사용 환경에서 별도로 확인한다.
- 자동 검사: 문자열 감사, 변환 타입 검사, 원본 대비 계산/분류 회귀, 가짜 계정/IPC 브라우저 검사, Rust 컴파일, Windows 패키징. 모의 UI 통과는 실제 OAuth·계정 전환·프록시 네트워크·native WebView2/트레이 실기기 검증을 의미하지 않는다.
- macOS/Linux 실기기 검증·서명·notarization·배포는 이 한국어 Windows 릴리스의 검증 범위가 아니다. 원본 의존성 취약점/경고를 번역 작업에서 임의 업그레이드로 해결하지 않는다.
- `korean.yml`은 검사만 수행한다. 원본 의존성 조합에서 `__TAURI_BUNDLE_TYPE` 경고가 발생할 수 있다. 현재 이 프로젝트는 updater plugin을 사용하지 않지만, 향후 자동 업데이트 도입 시 해당 경고를 별도로 검토한다. `korean-windows.yml`은 수동 실행으로 설치 파일 artifact만 만든다. 원본 `release.yml`은 이 포크에서 실행되지 않으며 자동 공개 릴리스/자동 upstream 병합은 없다.
