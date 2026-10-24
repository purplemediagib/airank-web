$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
docker version
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop with Linux containers, then retry.' }
docker buildx build --load --platform linux/amd64 --build-arg AIRANK_VERSION=0.11.2 -f Dockerfile -t vtcarrie/bunny-mcp-connector:airank-api-0.11.2 .
if ($LASTEXITCODE -ne 0) { throw 'API build failed. Stop here; do not push.' }
docker buildx build --load --platform linux/amd64 --build-arg AIRANK_VERSION=0.11.2 -f Dockerfile.worker -t vtcarrie/bunny-mcp-connector:airank-worker-0.11.2 .
if ($LASTEXITCODE -ne 0) { throw 'Worker build failed. Stop here; do not push.' }
docker image inspect vtcarrie/bunny-mcp-connector:airank-api-0.11.2 vtcarrie/bunny-mcp-connector:airank-worker-0.11.2
if ($LASTEXITCODE -ne 0) { throw 'Built image inspection failed.' }
Write-Host 'Both images built locally. Nothing has been pushed or deployed.'
Write-Host 'Next: follow RELEASE-TRACKED-FIRST-CHECK.md to log in, push and update Bunny.'
