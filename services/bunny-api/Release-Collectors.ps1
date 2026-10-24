param(
  [ValidateSet("Load","Inspect","Push","Build")]
  [string]$Action = "Inspect"
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$Version = "0.19.0"
$Images = @(
  "vtcarrie/bunny-mcp-connector:airank-api-$Version",
  "vtcarrie/bunny-mcp-connector:airank-worker-$Version"
)
function Invoke-Docker {
  param([string[]]$DockerArgs)
  & docker @DockerArgs
  if ($LASTEXITCODE -ne 0) { throw "Docker command failed. Stop here; do not update Bunny." }
}
Invoke-Docker -DockerArgs @("info","--format","{{.ServerVersion}}")
if ($Action -eq "Build") {
  Invoke-Docker -DockerArgs @("build","--platform","linux/amd64","--provenance=false","-f","Dockerfile","-t",$Images[0],".")
  Invoke-Docker -DockerArgs @("build","--platform","linux/amd64","--provenance=false","-f","Dockerfile.worker","-t",$Images[1],".")
}
if ($Action -eq "Load") {
   if (!(Test-Path ".\airank-docker-images-$Version.tar.gz")) { throw "Images archive not found. Use -Action Build for a source-only package." }
   if (!(Test-Path ".\CHECKSUMS.sha256")) { throw "Archive checksum file not found. Stop here." }
   $Checksum = (Get-Content ".\CHECKSUMS.sha256" -Raw).Trim() -split '\s+'
   if ($Checksum.Count -ne 2 -or $Checksum[0] -notmatch '^[a-fA-F0-9]{64}$' -or $Checksum[1] -ne "airank-docker-images-$Version.tar.gz") { throw "Invalid archive checksum record. Stop here." }
   $ActualHash = (Get-FileHash ".\airank-docker-images-$Version.tar.gz" -Algorithm SHA256).Hash
   if ($ActualHash -ne $Checksum[0]) { throw "Archive checksum mismatch. Do not load or push." }
   Invoke-Docker -DockerArgs @("load","--input",".\airank-docker-images-$Version.tar.gz")
}
foreach ($Image in $Images) {
  $LabelJson = Invoke-Docker -DockerArgs @("image","inspect","--format","{{json .Config.Labels}}",$Image)
  $Labels = ($LabelJson -join "`n") | ConvertFrom-Json
  if ($Labels.'org.opencontainers.image.version' -ne $Version) { throw "Unexpected image version. Stop here." }
  $Platform = Invoke-Docker -DockerArgs @("image","inspect","--format","{{.Os}}/{{.Architecture}}",$Image)
  if (($Platform -join "").Trim() -ne "linux/amd64") { throw "Expected Linux/amd64 image. Stop here." }
  Write-Host "Verified $Image"
}
if ($Action -eq "Push") {
  Invoke-Docker -DockerArgs @("login")
  foreach ($Image in $Images) { Invoke-Docker -DockerArgs @("push",$Image) }
   Write-Host "Both images pushed. Follow IMMEDIATE-COLLECTION-RELEASE.md before updating Bunny."
}
