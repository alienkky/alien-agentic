# Docker Desktop Disk Image Move — WSL2 데이터 미연결 함정

> 실패 케이스 = 가장 비싼 자산. 가장 자세하게 기록한다.
> C드라이브 7.7GB 잔여 빨강불 → Docker WSL 가상디스크(84GB) E드라이브 이동 시도
> → GUI 가 옛 데이터 *자동 연결 안 함* 의 함정으로 4시간 진통.

---

## 한 줄 요약

Docker Desktop 의 **Settings → Resources → Advanced → Disk image location** 으로 위치를 옮기면, *옛 vhdx 는 옛 자리에 그대로 두고 새 자리에 빈 vhdx 를 만든다*. "이동" 이 아니라 *"앞으로 여기 쓸 거야"* 의 의미. 옛 데이터(84GB)는 살아있지만 Docker 에서 안 보임.

---

## 타임라인 — 자정 넘은 4시간

| 시각 | 이벤트 |
|---|---|
| 6/25 22시 | C드라이브 잔여 7.7 GB 빨강불 진단 시작 |
| 22시 30분 | `.claude` (175MB) 와 `brain180` 이동 시도. brain180 은 *이미 E드라이브에 있었음* — `C:\Users\kimto\.gemini\history\brain180`, `tmp\brain180` 가 오매치돼 잘못 이동 (무해) |
| 23시 | 큰 자리 진단 — C:\Users 가 344GB, 그 중 Docker WSL 가상디스크가 84.14 GB 로 1등 확정 |
| 23시 20분 | Docker Desktop GUI 에서 Disk image location → E:\Docker 변경. Apply & Restart. *옛 vhdx 가 E:\Docker\DockerDesktopWSL\disk 에 84GB 그대로 존재* |
| 0시 30분 | "C드라이브 용량 그대로" — 새 빈 vhdx (1.54GB) 가 C드라이브에 만들어졌고 옛 84GB 가 E드라이브에 그대로. 회수 0. |
| 1시 | docker info: Images 0, Containers 0 — **multica/caddy/memory-api 컨테이너 리스트가 사라진 것처럼 보임** (사용자 충격) |
| 1시 30분 | 진단 — 옛 vhdx 살아있음 확정 (E:\Docker\DockerDesktopWSL\disk\docker_data.vhdx 84.14 GB, 수정시각 11:22 그대로) |
| 1시 45분 | 두 가지 복구 길 — symlink 박기 또는 깨끗 재시작 (D 길). 클라이언트 0명이라 DB 손실 비용 = 0 → D 길 채택 |
| 2시 | D 길: 옛 84GB vhdx 삭제 + multica prebuilt pull 로 재가동. 종결 |

---

## 근본 원인 — Docker 의 "이동" 시맨틱

외계 함대 비유: 함대 본부를 옮긴다고 했는데, 옛 본부 짐은 그대로 두고 새 자리에 *빈 본부 건물* 만 짓는 것. Docker 는 옛 데이터를 *복사하지도, 가리키지도 않는다.*

### Docker Desktop 의 실제 동작

```
Settings → Disk image location: C:\Users\kimto\AppData\Local\Docker → E:\Docker
  ↓
[Apply & Restart]
  ↓
1. WSL distro (docker-desktop) 의 BasePath 를 새 자리로 변경
2. 새 자리에 *빈* docker_data.vhdx 생성 (loop mount 용)
3. 옛 자리의 vhdx 는 *그대로 둠* (삭제 안 함, 이동 안 함)
4. distro 부팅 → 빈 vhdx mount → docker images/containers 다 비어보임
```

**의도된 동작**: *"앞으로 만들 데이터는 여기에"* . *"옛 데이터를 옮긴다"* 가 아님.

### 진짜 구조

Docker Desktop WSL2 backend 는 *2개의 vhdx* 사용:

```
docker-desktop distro
  ├── main\ext4.vhdx (90 MB)         ← Linux OS 자체 (distro rootfs)
  └── disk\docker_data.vhdx (커짐)   ← Docker 데이터 (이미지·컨테이너·볼륨)
                                        loop mount 됨
```

Disk image location 변경은 `disk\docker_data.vhdx` 만 영향. `main\ext4.vhdx` 는 BasePath 따로.

---

## 함정 — 진단을 흐리는 신호 3개

### 신호 1: C드라이브 용량 안 줄어듬

- 옛 vhdx 가 옛 자리에 그대로 → 용량 그대로
- "이동했는데 왜 그대로지?" → *이동이 아니라 새 자리 가리키기* 였다는 사실 모르면 디버깅 헛도는 신호

### 신호 2: docker images / containers 0

- 새 vhdx 가 비어있으니 당연
- 그러나 사용자에게는 *"데이터가 사라진 것처럼"* 보임
- 진단 안 하면 *깨끗 재시작* 으로 직행 → 옛 84GB 가 디스크에 그대로 남음 (회수 실패)

### 신호 3: docker info 가 두 가지 응답 섞어 출력

```
Root: /var/lib/docker | Images: 0 | Containers: 0
failed to connect to the docker API at npipe://... daemon: open //./pipe/...
```

- 첫 줄은 *반쯤 시작된* daemon 의 stub 응답
- 두 번째 줄은 daemon 안 떠있음 에러
- "Docker 가 작동 중인가 아닌가" 모호 → 진단 마비

---

## 복구 옵션 4개 — 트레이드오프

| 옵션 | C드라이브 회수 | 데이터 복구 | 시간 | 복잡도 |
|---|---|---|---|---|
| A. Symlink (E vhdx 가리키게) | ✅ 84GB | ⚠️ WSL2 가 따라가면 OK | 3분 | 낮음 |
| B. E vhdx 를 C로 다시 이동 | ❌ 84GB 차지 | ✅ 100% | 10분 | 낮음 |
| C. GUI 정공법 재시도 | ✅ | ⚠️ "Use existing data" 옵션 있을 때만 | 15분 | 중간 |
| D. 깨끗 재시작 (84GB 삭제) | ✅ 84GB | ❌ DB 손실 | 5분 | 낮음 |

**채택: D**. 이유:

- 클라이언트 0명 → multica DB 손실의 *실질 비용 = 0*
- multica 본가가 한국어 정식 지원 (CLAUDE.md §7 업데이트 반영) → 한국어 패치·Alien Plan·Alien Memory 다 필요 없음
- prebuilt 이미지 pull 만으로 5분 안에 부활
- 외계인 메모리(`shared-memory/agents/`)·코드·CLAUDE.md 는 *호스트 E드라이브* 에 있어 vhdx 와 무관 — 100% 안전

---

## 미래 방지 — Docker WSL 이동 표준 절차

### 절차 (시간 여유 있을 때)

```powershell
# 1. 사전 백업 — docker volume 별로 명시적 export
docker volume ls --format '{{.Name}}' | ForEach-Object {
    docker run --rm -v "${_}:/data" -v "E:/Docker-backup:/backup" alpine `
        tar czf "/backup/${_}.tar.gz" -C /data .
}

# 2. Docker Desktop 종료 + WSL 종료
Get-Process "Docker Desktop" -ErrorAction SilentlyContinue | Stop-Process -Force
wsl --shutdown

# 3. 현재 vhdx 백업 (안전망)
Copy-Item "$env:USERPROFILE\AppData\Local\Docker\wsl\disk\docker_data.vhdx" `
          "E:\Docker-backup\docker_data-$(Get-Date -Format yyyyMMdd).vhdx"

# 4. GUI 에서 Disk image location 변경
# 5. Apply & Restart 후 검증 — docker images 비어있으면 *옛 vhdx 안 따라온 것*
# 6. 비어있으면: wsl --import-in-place 로 옛 vhdx 그 자리에서 distro 재등록
```

### 절차 (자정 넘은 시간엔 그냥)

**D 길 (깨끗 재시작)** — 클라이언트 데이터 없는 시점엔 *항상* D 가 최선. 회수도 깨끗, 복잡도도 낮음.

### 절대 하지 말 것

- ❌ Docker Desktop GUI 의 *Disk image location* 만 믿고 "이동" 이라 가정
- ❌ docker images 비어있는 걸 보고 *Reset to factory defaults* 클릭 — 옛 vhdx 도 같이 날아감
- ❌ 옛 vhdx 를 옛 자리에서 *수동 삭제* 하기 전 새 자리에 데이터 인식 확인 안 함

---

## CLAUDE.md 반영

§7 코딩 컨벤션에 박을 줄:

> **Docker 데이터 이동 (절대 — vhdx 함정 회피)**: Docker Desktop 의 *Disk image location* 변경은 *이동* 이 아니라 *새 자리 가리키기* 다. 옛 vhdx 는 옛 자리에 *그대로 남고*, 새 자리에 *빈* vhdx 가 만들어진다. 데이터 보존이 필요하면 변경 전 `docker volume export` 로 명시적 백업 + 변경 후 `docker images` 확인. 클라이언트 데이터 0명 시점이면 *깨끗 재시작 (옛 vhdx 삭제 + prebuilt pull)* 이 가장 빠르고 안전. (교훈: 2026-06-25 — 84GB 회수 시도가 새벽 2시까지 4시간 진통)

---

## 비용 회계

| 항목 | 시간/비용 |
|---|---|
| 잘못된 brain180 매치 2회 | 5분 (무해, gemini history/tmp 폴더에 박혀 작동에 영향 없음) |
| Docker 이동 진통 | 약 4시간 (22시 ~ 02시) |
| 회수 용량 | C드라이브 +84 GB |
| 데이터 손실 | multica DB (이슈·댓글, 클라이언트 0명이라 실질 비용 0) |
| 알게 된 함정 | 1개 — Docker Disk image location 시맨틱 (앞으로 영구 절약) |

---

## 외계인의 매듭 — 4시간이 가르친 한 가지

> *함대 본부를 옮기라 했더니, 옛 짐은 그대로 두고 새 자리에 빈 본부만 짓는다.*
> *"이동" 이라는 단어가 도구마다 의미가 다르다.*
> *클라이언트 데이터가 없는 시점은 가장 비싼 함정도 가장 싸게 배운다.*

다음 클라이언트가 들어왔을 땐 *복구 절차* 가 필요해진다. 그 전에 *이번에 배운 것* 을 절차로 박아둔다.

---

*케이스 등록: 2026-06-25 | 작성: master-orchestrator (case-curator 패턴 차용)*
*관련: shared-memory/insights/2026-05-19-docker-compose-override-drift.md (Docker compose override 함정)*
