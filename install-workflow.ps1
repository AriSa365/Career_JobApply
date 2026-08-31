$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path ".github/workflows" | Out-Null
Copy-Item "WORKFLOW_VISIBLE/deploy.yml" ".github/workflows/deploy.yml" -Force
Write-Host "Installed GitHub Actions workflow at .github/workflows/deploy.yml"
