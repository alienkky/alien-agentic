# Multica 데몬 자동 시작 가이드 (Windows)

> 목적: PC 가 재부팅되거나 세션이 끊겨도 Multica 데몬이 *자동으로* 다시 살아나도록.
> 데몬이 죽으면 27명 외계 동료가 일제히 오프라인 되니까.

두 방법을 *겹쳐서* 쓰면 가장 안전합니다 — 어느 하나가 막혀도 다른 쪽이 잡아줍니다.

| 방법 | 언제 작동 | 주체 | 권장도 |
|---|---|---|---|
| ① `aa serve` 가 데몬 같이 띄움 | `aa serve` 실행 시 | `aa` CLI | ⭐⭐⭐⭐ (이미 빌드됨) |
| ② Windows 작업 스케줄러 | 로그온할 때마다 | OS | ⭐⭐⭐⭐⭐ (가장 확실) |

---

## ① `aa serve` 가 데몬 같이 띄움 (이미 빌드됨)

`aa serve` 가 docker compose 로 Multica 를 띄운 *뒤*, **multica 데몬 상태를 확인하고 죽어 있으면 자동으로 `multica daemon start` 를 실행**합니다.

```powershell
cd "E:/AlienAgentic/alien-agentic/automation/cli"
.\.venv\Scripts\aa.exe serve
```

출력 마지막에 다음 중 하나가 떠야 합니다:
- `✓ multica 데몬 이미 실행 중 — 27명 online` (살아 있던 경우)
- `✓ multica 데몬 가동 완료 — 27명 곧 online` (새로 띄운 경우)

> `aa serve` 가 *idempotent* 이므로 — 데몬·docker 가 이미 떠 있어도 안전하게 다시 실행 가능. PC 켜고 한 번 `aa serve` 만 돌리면 끝.

---

## ② Windows 작업 스케줄러 — 로그온 자동 실행 (가장 확실)

PC 부팅 후 *기영님 로그인 직후* multica 데몬이 자동으로 뜨도록 OS 레벨에서 설정. 한 번 박아두면 영구적.

### 사전 확인 — multica.exe 경로 찾기

PowerShell 에서:
```powershell
where.exe multica
```
출력 예: `C:\Users\kimto\.local\bin\multica.exe` (또는 다른 경로)

이 경로를 메모. 아래 4단계에서 씁니다.

### 1단계 — 작업 스케줄러 열기

`Win + R` → `taskschd.msc` 입력 → 엔터

또는 시작 메뉴에서 "작업 스케줄러" 검색.

### 2단계 — 새 작업 만들기

좌측 트리에서 **작업 스케줄러 라이브러리** 선택 → 우측 **작업 만들기...** (Create Task, *기본 작업이 아닌 일반 "작업" — 옵션이 더 풍부함*)

### 3단계 — "일반" 탭

- **이름**: `Multica Daemon Auto Start`
- **설명**: `로그온 시 multica daemon 자동 시작 (27명 에이전트 online 유지)`
- **보안 옵션**:
  - ☑ "사용자가 로그온할 때만 실행"
  - ☑ "가장 높은 수준의 권한으로 실행" *(필요시)*

### 4단계 — "트리거" 탭

**새로 만들기...** 클릭:
- **작업 시작**: `로그온할 때`
- **설정**: ◉ "기영님 계정만" (또는 본인 사용자명)
- ☑ "사용"
- 확인

### 5단계 — "동작" 탭

**새로 만들기...** 클릭:
- **작업**: `프로그램 시작`
- **프로그램/스크립트**: 위에서 `where.exe multica` 로 찾은 절대경로 (예: `C:\Users\kimto\.local\bin\multica.exe`)
- **인수 추가**: `daemon start`
- **시작 위치**: 비워두거나 `C:\Users\kimto\.codex\` 같이 multica 설정 폴더

### 6단계 — "조건" 탭

기본값 유지. (다음 옵션은 *꺼두는 게* 좋을 수 있음 — 노트북이면 켜둬도 OK)
- ☐ "컴퓨터의 AC 전원이 켜져 있는 경우에만 작업 시작"

### 7단계 — "설정" 탭

권장:
- ☑ "요청 시 작업이 실행되도록 허용"
- ☑ "예약된 시작 시간을 놓친 경우 가능한 한 빨리 작업 실행"
- ☐ "다음 시간 이후 작업 중지" (체크 해제 — 데몬이 *영구* 돌아야 함)
- 작업이 이미 실행 중이면 다음 규칙 적용: **새 인스턴스 시작 안 함**

### 8단계 — 저장 + 검증

확인 → 비밀번호 입력 (요청 시) → 저장.

곧바로 검증 (재부팅 안 해도 됨):
1. 작업 스케줄러 우측에서 방금 만든 작업 우클릭 → **실행**
2. PowerShell 에서 `multica daemon status` → `running` 이면 성공
3. DB 도 확인:
   ```powershell
   docker exec multica-postgres-1 psql -U multica -d multica -c "SELECT name, status FROM agent_runtime WHERE status='online';"
   ```

다음 재부팅·재로그인 후에는 자동으로 떠 있을 겁니다.

---

## 한 줄 PowerShell 으로 작업 스케줄러 등록 (선호 시)

GUI 클릭이 번거로우면 — 관리자 PowerShell 에서 한 번 실행:

```powershell
$mp = (Get-Command multica).Source
$action = New-ScheduledTaskAction -Execute $mp -Argument "daemon start"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERNAME"
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName "Multica Daemon Auto Start" `
  -Action $action -Trigger $trigger -Settings $settings `
  -Description "로그온 시 multica daemon 자동 시작 (27명 에이전트 online 유지)" `
  -Force
```

검증:
```powershell
Get-ScheduledTask -TaskName "Multica Daemon Auto Start"
Start-ScheduledTask -TaskName "Multica Daemon Auto Start"
Start-Sleep 3
multica daemon status
```

지우고 싶으면:
```powershell
Unregister-ScheduledTask -TaskName "Multica Daemon Auto Start" -Confirm:$false
```

---

## 트러블슈팅

| 증상 | 해결 |
|---|---|
| 작업 스케줄러에 등록은 됐는데 안 뜸 | 작업의 "기록" 탭 확인 — 에러 메시지 그대로 보여주세요 |
| `multica` 경로를 못 찾음 | `where.exe multica` 결과를 확인. 없으면 multica CLI 재설치 (npm/brew/scoop 등) |
| 로그온은 됐는데 데몬이 안 뜸 | 작업 스케줄러에서 그 작업 우클릭 → 실행 → 콘솔 창이 잠깐 뜨면 정상. 안 뜨면 "조건" 탭의 AC 전원 체크박스 해제 |
| `aa serve` 가 데몬 자동 시작을 건너뜀 | `multica` 가 PATH 에 있는지 (`where.exe multica`) 확인 |

---

## 다음 자리 (Phase 2 이후)

- Windows Service 로 등록 (NSSM 사용) — 작업 스케줄러보다 더 깊은 수준
- 데몬 헬스체크 cron — 매 5분마다 죽었는지 확인하고 부활시킴
- `aa status` 가 데몬 살아있는지 같이 보여주기
