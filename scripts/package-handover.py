"""Create a deterministic, source-only preparation bundle. Never build/push/deploy."""
import hashlib
import json
from pathlib import Path
import zipfile

root = Path(__file__).resolve().parents[1]
out = root / "generated-artifacts" / "batch-12"
out.mkdir(parents=True, exist_ok=True)
trees = ["artifacts/airank", "artifacts/api-server", "lib", "scripts", "services/bunny-api", "docs"]
files = ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "tsconfig.json", "tsconfig.base.json"]
excluded = {"node_modules", "dist", ".git", ".local", ".cache", "coverage", "test-results", "playwright-report", "__pycache__"}
suffixes = {".mjs", ".cjs", ".js", ".ts", ".tsx", ".json", ".yaml", ".yml", ".css", ".html", ".md", ".sh", ".ps1", ".py", ".toml", ".txt", ".svg", ".png", ".jpg", ".jpeg", ".webp", ".woff", ".woff2"}
special = {"Dockerfile", "Dockerfile.worker", ".dockerignore"}
paths = [root / f for f in files]
for tree in trees:
    paths.extend(p for p in (root / tree).rglob("*") if p.is_file())
entries = {}
for p in sorted(set(paths)):
    rel = p.relative_to(root)
    if p.is_symlink() or excluded.intersection(rel.parts):
        continue
    if p.name.startswith(".env") or "oauth-clients" in p.name or p.name == "SOURCE_MANIFEST.json":
        continue
    if p.suffix not in suffixes and p.name not in special:
        continue
    content = p.read_bytes()
    # Fail closed for common credential forms. Environment-variable names are not secret values.
    if p.suffix in {".json", ".mjs", ".js", ".ts", ".md", ".yaml", ".yml"}:
        import re
        if re.search(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|sk-proj-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|ghp_[A-Za-z0-9]{30,}", content):
            raise SystemExit(f"Potential credential detected; bundle stopped: {rel}")
    entries[str(rel)] = content
manifest = {name: hashlib.sha256(data).hexdigest() for name, data in entries.items()}
encoded = (json.dumps(manifest, sort_keys=True, indent=2) + "\n").encode()
digest = hashlib.sha256(encoded).hexdigest()
notice = (
    "# Batch 12 preparation snapshot — NOT an approved deployment\n\n"
    "Includes the public checker, optional report email, global market/language support and dashboard fixes. Not deployed.\n"
    "This source ZIP contains no images. Use docs/WINDOWS-POWERSHELL-RELEASE.md to build the versioned API/worker images on Windows.\n"
    "Use docs/PUBLIC-CHECK-RELEASE.md for migrations/configuration and docs/FRAMER-INTEGRATION.md for the FI/EN embed and SEO copy.\n"
    "The legacy build-and-push scripts are retired. Build and package images locally with services/bunny-api/build-release-images.sh; it never pushes.\n"
    "No environment files, dependency directories or compiled output are included.\n"
    "Public source assets and source configuration only. Provision credentials separately.\n"
    "The source release metadata, backend lockfile and linux/amd64 Node base-image digest are pinned; external registry push, Bunny migration and activation have not happened.\n"
    f"Source manifest SHA-256: {digest}\n"
).encode()
entries["HANDOVER-READ-FIRST.md"] = notice
entries["HANDOVER-SHA256.json"] = encoded
archive = out / f"airank-batch12-preparation-{digest[:12]}.zip"
with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name, data in sorted(entries.items()):
        info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
        info.external_attr = 0o100644 << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        z.writestr(info, data)
print(json.dumps({"file": str(archive.relative_to(root)), "sha256": hashlib.sha256(archive.read_bytes()).hexdigest(), "files": len(entries)}))
