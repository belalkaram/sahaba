#!/usr/bin/env bash
# Release gate entry point for CI and Unix. The implementation is scripts/release-gate.mjs.
#   ./scripts/release-gate.sh [--skip-e2e]
exec node "$(dirname "$0")/release-gate.mjs" "$@"
