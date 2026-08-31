#!/usr/bin/env bash
set -euo pipefail
mkdir -p .github/workflows
cp WORKFLOW_VISIBLE/deploy.yml .github/workflows/deploy.yml
echo "Installed GitHub Actions workflow at .github/workflows/deploy.yml"
