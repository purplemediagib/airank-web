#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
PYTHON_BIN="${PYTHON_BIN:-python3}"
command -v "$PYTHON_BIN" >/dev/null 2>&1 || {
  echo "Python 3 not found; set PYTHON_BIN to the Python 3 executable name (python or python3)." >&2
  exit 1
}
python_exec() { "$PYTHON_BIN" "$@"; }

VERSION="$(node -p "require('./services/bunny-api/package.json').version")"
EXPECTED="$(sed -n '1s/.*release \([0-9][0-9.]*\).*/\1/p' services/bunny-api/VERSION.txt)"
if [[ -z "$VERSION" || "$VERSION" != "$EXPECTED" ]]; then
  echo "Release version mismatch: package=$VERSION manifest=$EXPECTED" >&2
  exit 1
fi
REGISTRY_IMAGE="${REGISTRY_IMAGE:-vtcarrie/bunny-mcp-connector}"
OUT="$ROOT/generated-artifacts/airank-release-$VERSION"
API="$REGISTRY_IMAGE:airank-api-$VERSION"
WORKER="$REGISTRY_IMAGE:airank-worker-$VERSION"
mkdir -p "$OUT"

echo "Building immutable, versioned images locally for linux/amd64. Nothing will be pushed."
docker buildx build --load --platform linux/amd64 --build-arg AIRANK_VERSION="$VERSION" \
  -f services/bunny-api/Dockerfile -t "$API" services/bunny-api
docker buildx build --load --platform linux/amd64 --build-arg AIRANK_VERSION="$VERSION" \
  -f services/bunny-api/Dockerfile.worker -t "$WORKER" services/bunny-api

docker image inspect "$API" "$WORKER" --format '{{.RepoTags}} {{.Id}} {{.Config.Labels}}' > "$OUT/IMAGE-MANIFEST.txt"
docker save "$API" "$WORKER" | gzip -1 -n > "$OUT/airank-docker-images-$VERSION.tar.gz"
cp docs/WINDOWS-POWERSHELL-0.21.md "$OUT/"
cp services/bunny-api/WORKSPACE-SUGGESTIONS-RELEASE.md "$OUT/"
cat > "$OUT/README-RELEASE.txt" <<EOF
AI Rank API/worker image build $VERSION

Images (built and saved for linux/amd64; NOT pushed):
  $API
  $WORKER

This archive was built locally. It has NOT been pushed, deployed or applied to Bunny.
Update BOTH existing Bunny API and worker images together.
Apply additive migration app-018-intelligent-suggestions after the existing migrations.
Read WORKSPACE-SUGGESTIONS-RELEASE.md for exact activation and smoke checks.
Suggestion generation requires the existing OPENAI_API_KEY on the API too.
Preserve existing ENABLED_PROVIDERS and collection configuration on both containers.
Republish the frontend for updated labels and filters. No Framer changes.
Preserve existing secrets, ports, origins, OAuth registry, monitoring and data.
See WINDOWS-POWERSHELL-0.21.md for the exact load/push/rollout sequence.
EOF
(
  cd "$OUT"
  sha256sum "airank-docker-images-$VERSION.tar.gz" README-RELEASE.txt IMAGE-MANIFEST.txt WINDOWS-POWERSHELL-0.21.md WORKSPACE-SUGGESTIONS-RELEASE.md > SHA256SUMS
)
python_exec - "$OUT" "$ROOT/generated-artifacts/airank-release-$VERSION.zip" "$VERSION" <<'PY'
from pathlib import Path
import sys, zipfile
folder, target, version = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3]
names = ["IMAGE-MANIFEST.txt", "README-RELEASE.txt", "WINDOWS-POWERSHELL-0.21.md", "WORKSPACE-SUGGESTIONS-RELEASE.md", "SHA256SUMS", f"airank-docker-images-{version}.tar.gz"]
with zipfile.ZipFile(target, "w", compression=zipfile.ZIP_STORED) as z:
    for name in names:
        p = folder / name
        if not p.is_file():
            raise SystemExit(f"Missing release package file: {name}")
        z.write(p, name)
print(f"Created {target} ({target.stat().st_size} bytes)")
PY
echo "Local image release prepared at generated-artifacts/airank-release-$VERSION.zip"
