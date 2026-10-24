$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
docker version
if ($LASTEXITCODE -ne 0) { throw "Start Docker Desktop in Linux containers mode." }
docker build --platform linux/amd64 --provenance=false -f Dockerfile -t vtcarrie/bunny-mcp-connector:airank-api-0.12.0 .
if ($LASTEXITCODE -ne 0) { throw "API build/test failed. Do not push." }
docker build --platform linux/amd64 --provenance=false -f Dockerfile.worker -t vtcarrie/bunny-mcp-connector:airank-worker-0.12.0 .
if ($LASTEXITCODE -ne 0) { throw "Worker build/test failed. Do not push." }
docker image inspect vtcarrie/bunny-mcp-connector:airank-api-0.12.0
if ($LASTEXITCODE -ne 0) { throw "API image missing." }
docker image inspect vtcarrie/bunny-mcp-connector:airank-worker-0.12.0
if ($LASTEXITCODE -ne 0) { throw "Worker image missing." }
Write-Host "Both images built locally. Follow DAILY-RELEASE.md to push and activate."
