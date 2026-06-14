# Alien Agentic -- Memory API (alien-config sidecar)
#
# 호스트의 shared-memory/agents/ 를 Multica UI 에서 보고 편집할 수 있게 한다.
# 27명 외계 에이전트 각자의 메모리 4파일(work/learnings/decisions/mistakes.md)을
# RESTful 로 읽기·쓰기.
#
# 컨테이너 자체는 LAN-only (127.0.0.1:8765). Caddy 가 /api/alien-memory/* 를
# 여기로 라우팅해 Tailscale 경유 접근을 허용한다 (외부 노출 0).
#
# 보안:
#   - agent name path traversal 차단
#   - file name 화이트리스트 (4종만)
#   - 인증은 LAN 경계로만 (Caddy + Tailscale tailnet)

FROM python:3.13-slim

WORKDIR /app

# 최소 의존성만
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# /data/agents 가 호스트 shared-memory/agents 의 마운트 지점
ENV MEMORY_DATA_DIR=/data/agents

EXPOSE 8765

# uvicorn standard 는 watchfiles + httptools + websockets 까지 포함
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8765", "--no-access-log"]
