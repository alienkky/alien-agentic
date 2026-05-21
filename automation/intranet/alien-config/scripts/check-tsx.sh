#!/usr/bin/env bash
# Multica 컴포넌트(.tsx/.ts)를 Multica 의 실제 strict tsconfig 로 사전 타입체크.
#
# 왜: esbuild 파싱(--loader=tsx)은 *타입을 무시* 하므로 다음을 못 잡는다 —
#   - React.ReactNode 같은 네임스페이스 사용 시 import 누락
#   - noUnusedLocals / noUnusedParameters (미사용 import·변수)
#   - noUncheckedIndexedAccess (배열/객체 인덱스가 T | undefined)
# 이것들은 next build(tsc) 단계에서야 터진다. 빌드 전에 여기서 차단한다.
#
# 한계: @multica/* 를 import 하는 파일은 path resolution 이 안 되므로
#   *자립(self-contained) 컴포넌트* 에만 쓴다. @multica 의존 파일은
#   esbuild 파싱 + 실제 docker 빌드로 검증.
#
# 사용:
#   check-tsx.sh <file.tsx> [more.tsx ...]
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "사용: check-tsx.sh <file.tsx> [more.tsx ...]" >&2
  exit 2
fi

WORK="${TMPDIR:-/tmp}/multica-tsc-check"
mkdir -p "$WORK"

# typescript + react 타입 1회 설치 (캐시)
if [ ! -d "$WORK/node_modules/typescript" ]; then
  echo "[setup] typescript + @types/react 설치 (최초 1회)…"
  ( cd "$WORK" && npm init -y >/dev/null 2>&1 && \
    npm i -D typescript@5.7.2 @types/react@19 @types/react-dom@19 >/dev/null 2>&1 )
fi

# Multica base.json + react-library.json 의 strict 플래그 재현
cat > "$WORK/tsconfig.json" <<'EOF'
{
  "compilerOptions": {
    "target": "ESNext", "module": "ESNext", "moduleResolution": "bundler",
    "strict": true, "esModuleInterop": true, "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true, "resolveJsonModule": true,
    "isolatedModules": true, "noUnusedLocals": true, "noUnusedParameters": true,
    "noImplicitReturns": true, "noUncheckedIndexedAccess": true,
    "jsx": "react-jsx", "lib": ["ESNext", "DOM", "DOM.Iterable"], "noEmit": true
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
EOF

rm -rf "$WORK/src"
mkdir -p "$WORK/src"
for f in "$@"; do
  if [ ! -f "$f" ]; then echo "파일 없음: $f" >&2; exit 2; fi
  cp "$f" "$WORK/src/"
done

echo "[tsc] multica strict 설정으로 타입체크: $*"
if ( cd "$WORK" && npx tsc --noEmit ); then
  echo "✓ tsc OK — 타입 에러 0"
else
  echo "✗ tsc 실패 — 위 에러를 빌드 전에 고치세요" >&2
  exit 1
fi
