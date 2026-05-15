# Obsidian Vault Symlink 가이드

> 목적: `shared-memory/` 를 Obsidian Vault로 사용해 *데스크탑·모바일 양쪽에서 같은 자료*를 본다.

## 두 가지 길

### (A) 가장 단순 — `shared-memory/` 자체를 Vault로 (추천)

추가 symlink 없음. Obsidian이 그냥 그 폴더를 연다.

**Windows**:
1. Obsidian 실행 → *"기존 폴더 열기 (Open folder as vault)"*
2. `E:/AlienAgentic/alien-agentic/shared-memory/` 선택
3. 끝.

장점: 가장 간단. 단점: Obsidian이 만드는 `.obsidian/` 설정 폴더가 `shared-memory/` 안에 생김 → 이건 `.gitignore` 처리.

### (B) 별도 Vault에 symlink — 다른 노트와 함께 둘 때

이미 다른 Obsidian Vault가 있고, 그 안에서 Alien Agentic 자료를 *링크로* 보고 싶을 때.

**Windows (관리자 권한 PowerShell)**:
```powershell
cd "D:/내Vault위치"
New-Item -ItemType SymbolicLink -Path "alien-agentic" -Target "E:/AlienAgentic/alien-agentic/shared-memory"
```

또는 cmd.exe (관리자):
```cmd
cd /d D:\내Vault위치
mklink /D alien-agentic "E:\AlienAgentic\alien-agentic\shared-memory"
```

**macOS/Linux**:
```bash
cd ~/내Vault위치
ln -s "/Users/.../Alien Agentic/shared-memory" alien-agentic
```

장점: 기존 Vault에 통합. 단점: Obsidian이 symlink를 *완벽히 따라가지 못하는* 경우가 가끔 있음 (특히 모바일 sync 시).

## .gitignore 보강 (옵션 A 선택 시)

`shared-memory/.obsidian/` 폴더가 git에 추적되지 않도록:

```
# .gitignore 끝에 추가
shared-memory/.obsidian/
shared-memory/.trash/
```

## 추천 Obsidian 플러그인 (5개 이내, 헌법 V `knowledge-architect` 룰)

| 플러그인 | 용도 |
|---|---|
| **Dataview** | `messages/` `tasks/` 자동 인덱싱 |
| **Templater** | 일지·메시지·업무 템플릿 |
| **Calendar** | `daily-logs/` 시각화 |
| **Excalidraw** | 4층 진단서 손그림 |
| **Tasks** | 업무 체크리스트 추적 |

이상은 헌법 룰에 따라 *추가 금지*. 학습 곡선이 가팔라집니다.

## 다음 단계 → 모바일 접근

`docs/guides/mobile-access.md` 참조.
