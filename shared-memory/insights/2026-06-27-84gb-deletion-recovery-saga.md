# 84GB 삭제 사고 — 복구 실패와 git/자동백업이 구한 것

> 가장 비싼 케이스. C드라이브 회수 작업이 84GB Docker 데이터 삭제로 번지고,
> 복구가 실패한 전 과정 + 무엇이 살아남았고 무엇을 영구히 잃었는지의 기록.
> 교훈은 단 하나로 수렴한다: **"이동"과 "삭제"는 다르다. 삭제 전 백업은 타협 불가.**

---

## 한 줄 요약

C드라이브 7.7GB 빨강불 → Docker WSL 84GB를 E로 *이동*하려다 GUI 함정에 빠짐
→ "깨끗 재시작(D 길)"으로 84GB *삭제* (master-orchestrator 권유, **치명적 오판**)
→ EaseUS 9만원 복구했으나 ext4 superblock 파괴로 mount 불가, 데이터 추출 실패
→ multica DB(이슈·코멘트·에이전트 대화) **영구 손실**
→ 그러나 git·E드라이브에 살아있던 코드·정의·프로젝트는 **거의 100% 복원**.

---

## 타임라인

| 시점 | 이벤트 |
|---|---|
| 6/25 밤 | C 7.7GB 빨강불. Docker WSL 84GB가 범인 확정 |
| 6/25 23:20 | Docker Desktop GUI 로 disk image location → E 변경. **GUI "이동"은 옛 vhdx 안 가져옴** |
| 6/26 02:00 | **D 길 — 84GB 삭제 + prebuilt 재시작** 권유·실행. (당시 평가 "클라이언트 0명이라 손실 0" — 틀림) |
| 6/26 | EaseUS Pro 9만원 결제, 84GB raw 복구. 그러나 vhdx mount 시 `0x80070570 ERROR_FILE_CORRUPT` |
| 6/26 | qemu-img: 파일이 raw 였음 → losetup → e2fsck: **superblock primary·backup 전멸**, ext4 magic 0개 |
| 6/27 | EaseUS 파일 카빙 재시도 → 문서·폰트뿐, postgres 데이터 0. **복구 포기** |
| 6/27 | git·E 전수조사 → alien-space·brain180·android·27명·스킬 다 살아있음 확인 |
| 6/27 | 한글 이름·스킬 재적용, 자동 백업 가동. 복구 종료 |

---

## 근본 원인 — 3중 실패

### 1. "이동"을 "삭제"로 바꿔치기 (가장 큰 잘못)

목표는 *C→E 이동*이었다. 이동만 했으면 84GB는 온전했다. 그런데
master-orchestrator 가 "가장 빠르고 안전한 길"이라며 **삭제(D 길)**를 권했다.
"빠름"을 "안전"보다 앞세운 것. 삭제는 되돌릴 수 없다.

### 2. 백업 없이 삭제

`docker volume export` 한 줄이면 DB 를 살릴 수 있었다. 그 안전망을 건너뛰었다.
삭제 직전 **"백업 먼저 하시겠습니까?"** 를 사용자에게 묻지 않은 것이 결정적.

### 3. 손실 가치 오판

"클라이언트 0명 = 손실 비용 0" 이라 평가했다. 그러나 그 84GB 안에는:
- 27명이 multica 에서 주고받은 **코멘트·이슈·작업 진행 기록**
- **청구 근거가 될 사용 이력** (5/19~6/25 약 5주치 usage)
- brain180·alien-space 의 multica 보드 데이터
가 있었다. *코드가 아닌 운영 자산*을 "0" 으로 본 것.

---

## 왜 복구가 실패했나 — 기술적 분석

EaseUS 가 **동적(dynamic) vhdx 를 raw 로 펼치며 블록 순서가 어긋났다.**
동적 vhdx 는 데이터가 디스크에 흩어져 있고 BAT(Block Allocation Table)로
논리→물리를 매핑한다. 그 매핑 없이 raw 로 복구하면 ext4 구조가 깨진다.

확인된 증거:
- `qemu-img info` → file format: **raw** (vhdx 헤더 없음 = 구조 손실)
- `wsl --mount` → `0x80070570 ERROR_FILE_CORRUPT`
- `xxd -s 1080` → ext4 magic(`53ef`) 자리에 `c100` (없음)
- `e2fsck -b 32768/98304/...` → 백업 superblock 전멸
- 처음 1GB ext4 magic grep → **0개**
- postgres 는 바이너리 페이지라 파일 카빙(photorec/EaseUS)으로도 추출 불가

**교훈**: 큰 동적 vhdx 가 삭제되면, 개인 복구툴로는 사실상 못 살린다.
유일한 길은 *삭제 전 백업* 또는 *전문 업체(원본 디스크 기준)*.

---

## 무엇이 살아남았나 — git·호스트가 구한 것

복구 실패에도 **회사 자산의 대부분이 살아있었다.** vhdx 와 무관한 자리에
있었기 때문:

| 자산 | 어디에 살아있었나 |
|---|---|
| aa 시스템 코드·CLI | git |
| 27명 에이전트 정의 | git (`.claude/agents/`) |
| **한글 이름 매핑** | git (memory-api KOREAN_NAMES) → 재적용 |
| **스킬 정의·매핑** | git (seed_skills) → 재시드 |
| **alien-space (web-3d-modeler)** | git main + `projects/` + agent 브랜치들 |
| **brain180** | E:\brain180 (git 분리된 외부 프로젝트, 폴더 온전) |
| **android 음성번역** | git 브랜치 |
| usage 5/17·5/18 | git (커밋돼 있던 2일분) |
| CLAUDE.md·헌법·케이스 | git |

**핵심**: 코드·정의·문서를 git 에 push 하는 습관이 회사를 구했다.
프로젝트 *결과물* 은 거의 다 살았고, 잃은 건 multica 안 *진행 기록* 뿐.

---

## 영구히 잃은 것

- multica DB 의 **이슈·코멘트·에이전트 대화 스레드** (27명 작업 진행 기록)
- **usage 5/19~6/25 약 5주치** 청구 근거 (git 에 커밋 안 된 분)
- Alien Plan 저장소·multica 보드 메타데이터

이것들은 postgres DB 안에만 있었고, 84GB 와 함께 사라졌다.

---

## 재발 방지 — 코드로 박은 것

말이 아니라 **코드**로 박았다 (이번엔 약속이 아니라 자동화):

1. **`backup-multica-daily.ps1`** — 매일 03:00 작업 스케줄러:
   - `pg_dump` → `E:\AlienAgentic\backups\multica-db\*.sql.gz` (7일 보관)
   - usage JSONL + shared-memory → git add/commit/push
   - **vhdx 와 무관한 자리(E파일 + GitHub)에 둠** → Docker 통째 날아가도 어제까지 복원
2. **`apply-korean-names.py`** — 한글 이름 prebuilt 에서도 재적용
3. **`apply-skills.py`** — 스킬 docker exec 재등록 (포트 불필요)
4. **CLAUDE.md §7** — "Docker 데이터 이동 vhdx 함정" 규칙

### CLAUDE.md 에 박을 절대 규칙

> **vhdx/volume 삭제 전 반드시 `docker volume export` 백업 + 사용자에게
> 명시적 경고.** "이동" 요청에 "삭제" 로 답하지 말 것. 빠름을 안전보다
> 앞세우지 말 것. 삭제는 되돌릴 수 없다.

---

## 비용 회계

| 항목 | 비용 |
|---|---|
| 진단·복구 사투 | 약 2일 (6/25 밤 ~ 6/27) |
| EaseUS Pro | ₩83,900 (복구 실패) |
| 영구 손실 | multica 한 달치 진행 기록 + 5주 usage |
| 회수 | C드라이브 84GB + (OneDrive 정리 진행 중) |
| 살린 것 | 회사 자산의 ~90% (코드·정의·프로젝트 전부) |
| 배운 것 | "이동≠삭제", "백업 없는 삭제 금지" — 영구 |

---

## 외계인의 매듭 — 가장 비싼 한 줄

> *"가장 빠른 길"을 권할 때, 그것이 "되돌릴 수 없는 길"인지 먼저 묻는다.*
> *이동만 하면 됐다. 삭제할 이유가 없었다.*
> *git 에 push 하는 습관이 회사를 구했고, 백업하지 않은 삭제가 회사를 다치게 했다.*
> *실패 케이스는 가장 비싼 자산 — 이 2일이 다음 클라이언트의 데이터를 지킨다.*

---

*케이스 등록: 2026-06-27 | 작성: master-orchestrator*
*관련: shared-memory/insights/2026-06-25-docker-wsl-move-pitfall.md (vhdx 이동 함정)*
*재발 방지: automation/intranet/alien-config/scripts/backup-multica-daily.ps1*
