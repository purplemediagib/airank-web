"""Stage reviewed source for a private repository. Does not push or deploy.

Uses a caller-supplied pinned public-backend archive, never credentials.
Only generated-artifacts/private-source-transfer is written.
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "generated-artifacts/private-source-transfer"
REVISION = "b34d7c39231dd1e85a37385627f72a47a8d3c09e"
EXCLUDED_DIRS = {
    "node_modules", "dist", "build", ".git", ".local", ".cache", ".config",
    ".agents", ".offline-generated", ".release-backend", "coverage",
    "test-results", "playwright-report", "__pycache__", "generated-artifacts",
    "attached_assets", ".auth",
}
EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".yaml", ".yml",
    ".css", ".html", ".md", ".sh", ".ps1", ".py", ".toml", ".txt", ".svg",
    ".png", ".jpg", ".jpeg", ".webp", ".ico", ".woff", ".woff2", ".ttf",
    ".example",
}
SPECIAL = {
    "Dockerfile", "Dockerfile.worker", ".dockerignore", ".gitignore",
    ".gitattributes", ".npmrc", ".replit", ".replitignore", ".gitkeep",
}
ROOT_FILES = [
    "README.md", "package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml",
    "tsconfig.json", "tsconfig.base.json", ".npmrc", ".gitignore",
    ".gitattributes", ".replit", ".replitignore", "replit.md",
]
DOCS = [
    "API-CONTRACT.md", "ARCHITECTURE-DECISIONS.md", "METHODOLOGY.md",
    "INTELLIGENT-SUGGESTIONS-CONTRACT.md", "FRAMER-INTEGRATION.md",
    "framer-embed-en.html", "framer-embed-fi.html", "GLOBAL-MARKET-LANGUAGE.md",
    "overview-collection-readiness.md",
]
SECRET_PATTERNS = {
    "private-key": rb"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----",
    "github-token": rb"(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})",
    "openai-key": rb"sk-(?:proj-|svcacct-)[A-Za-z0-9_-]{20,}",
    "anthropic-key": rb"sk-ant-[A-Za-z0-9_-]{20,}",
    "aws-access-key": rb"AKIA[A-Z0-9]{16}",
    "stripe-live-secret": rb"sk_live_[A-Za-z0-9]{20,}",
    "credential-url": rb"(?:https?|libsql|postgres(?:ql)?):\/\/[^/\s:@]+:[^/\s@]+@",
}


def eligible(rel):
    p = PurePosixPath(str(rel))
    if EXCLUDED_DIRS.intersection(p.parts):
        return False
    if p.name.startswith(".env") or "oauth-clients" in p.name.lower():
        return False
    if p.name in {"SOURCE_MANIFEST.json", "cookies.json", "storage-state.json"}:
        return False
    if p.name.endswith((".tsbuildinfo", ".map", ".db", ".sqlite", ".sqlite3", ".log")):
        return False
    return p.suffix in EXTENSIONS or p.name in SPECIAL or p.name.startswith("Dockerfile.")


def stage(backend_zip, restage=False):
    if OUT.exists():
        if not restage or (OUT / ".git").exists():
            raise SystemExit("Staging exists; inspect it, then use --restage only before Git initialization.")
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    paths = [ROOT / f for f in ROOT_FILES]
    paths += [ROOT / "docs" / f for f in DOCS]
    for tree in ["artifacts", "lib", "services", "scripts", "release", ".github", "docs/lovable-migration"]:
        paths.extend((ROOT / tree).rglob("*"))
    exclusions = []
    for p in sorted(set(paths)):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT)
        if p.is_symlink() or not eligible(rel):
            exclusions.append(str(rel))
            continue
        target = OUT / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(p, target)
    with zipfile.ZipFile(backend_zip) as archive:
        for member in archive.infolist():
            if member.is_dir():
                continue
            parts = PurePosixPath(member.filename).parts
            if not parts or REVISION not in parts[0] or ".." in parts:
                raise SystemExit("Backend archive revision/path mismatch")
            rel = PurePosixPath(*parts[1:])
            if not eligible(rel):
                exclusions.append("backend-reference/" + str(rel))
                continue
            target = OUT / "backend-reference" / str(rel)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(member))
    # Stop before staging any suspect token. Never display matching contents.
    flags = []
    reviewed_negative_fixtures = 0
    for p in OUT.rglob("*"):
        if not p.is_file():
            continue
        raw = p.read_bytes()
        for name, pattern in SECRET_PATTERNS.items():
            for match in re.finditer(pattern, raw):
                # Explicit invalid-URL fixtures exercise credential rejection.
                # Never exempt real token/private-key patterns, even in tests.
                if name == "credential-url" and "test" in p.relative_to(OUT).parts:
                    credentials = match.group().split(b"://", 1)[1][:-1].split(b":", 1)
                    host = re.split(rb"""[/\s'")]""", raw[match.end():], maxsplit=1)[0]
                    if (credentials[0] in {b"user", b"u"} and
                        credentials[1] in {b"pass", b"password", b"p", b"secret"} and
                        host in {b"example.test", b"example.fi", b"connector.example",
                                 b"bad.test", b"site.fi", b"mc-example.bunny.run"}):
                        reviewed_negative_fixtures += 1
                        continue
                flags.append({"file": str(p.relative_to(OUT)), "category": name})
    if flags:
        print(json.dumps({"blocked": True, "findings": flags}, indent=2))
        raise SystemExit("Source staging blocked by credential-pattern scan")
    inventory = OUT / "inventory"
    inventory.mkdir()
    names = {}
    for component in ["artifacts/api-server", "backend-reference/app", "backend-reference/google-connector", "services"]:
        found = set()
        for p in (OUT / component).rglob("*"):
            if p.suffix not in {".ts", ".mjs", ".js"} or "test" in p.parts:
                continue
            text = p.read_text(errors="replace")
            found.update(re.findall(r"(?:process\.)?env(?:\?\.)?\.([A-Z][A-Z0-9_]+)", text))
            found.update(re.findall(r"""(?:setting|flag)\(env,\s*['"]([A-Z][A-Z0-9_]+)['"]""", text))
        names[component] = sorted(found)
    revision = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    dirty = subprocess.check_output(["git", "status", "--porcelain"], cwd=ROOT, text=True)
    info = {
        "preparedAt": datetime.now(timezone.utc).isoformat(),
        "workspaceHead": revision,
        "includesCurrentWorkingTree": True,
        "changedSourcePaths": [line[3:] for line in dirty.splitlines()],
        "backendRepository": "https://github.com/purplemediagib/airank.me",
        "backendRevision": REVISION,
        "backendArchiveSha256": hashlib.sha256(Path(backend_zip).read_bytes()).hexdigest(),
        "backendVersion": "0.22.0",
        "deploymentPerformed": False,
        "destination": "https://github.com/purplemediagib/airank-web",
    }
    (inventory / "SOURCE-REVISION.json").write_text(json.dumps(info, indent=2) + "\n")
    (inventory / "ENVIRONMENT-NAMES.json").write_text(json.dumps(names, indent=2) + "\n")
    (inventory / "EXCLUSIONS.json").write_text(json.dumps({
        "excludedTrees": sorted(EXCLUDED_DIRS),
        "excludedFilesFromSelectedTrees": exclusions,
        "historicalAuditAndPilotDocuments": "Excluded; technical/migration documents selected explicitly.",
        "environmentFiles": "Real env files and registered OAuth client JSON excluded. Never copied from runtime.",
        "gitHistory": "Not included; destination gets a fresh reviewed source commit.",
    }, indent=2) + "\n")
    routes = re.findall(r'<Route path="([^"]+)"', (OUT / "artifacts/airank/src/App.tsx").read_text())
    (inventory / "ROUTES.json").write_text(json.dumps({
        "appRoutes": routes, "public": ["/:locale/sign-in", "/:locale/sign-up",
        "/:locale/free-check/embed", "/:locale/report/:token"],
        "note": "Locale restricted to EN/FI. Content Studio also has nested routes in its feature source.",
    }, indent=2) + "\n")
    report = {
        "credentialPatternMatches": 0,
        "reviewedSyntheticInvalidUrlFixtures": reviewed_negative_fixtures,
        "scannedPatternCategories": sorted(SECRET_PATTERNS),
        "scope": "All staged file bytes, including pinned backend reference",
        "limitations": "Pattern scan is not a guarantee against every possible secret. No runtime values were read/exported.",
        "sensitiveStateExcludedByPath": True,
        "sourceOnly": True,
    }
    (inventory / "TRANSFER-SAFETY.json").write_text(json.dumps(report, indent=2) + "\n")
    manifest = {
        str(p.relative_to(OUT)): hashlib.sha256(p.read_bytes()).hexdigest()
        for p in sorted(OUT.rglob("*")) if p.is_file()
    }
    (inventory / "SHA256.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps({"directory": str(OUT.relative_to(ROOT)), "files": len(manifest) + 1,
                      "bytes": sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file()),
                      "credentialPatternMatches": 0}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--backend-zip", required=True, type=Path)
    parser.add_argument("--restage", action="store_true")
    args = parser.parse_args()
    stage(args.backend_zip, args.restage)
