# Release gate entry point for Windows. The implementation is scripts/release-gate.mjs.
#   .\scripts\release-gate.ps1 [--skip-e2e]
node (Join-Path $PSScriptRoot "release-gate.mjs") @args
exit $LASTEXITCODE
