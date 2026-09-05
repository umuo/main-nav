#!/bin/sh
set -eu

# Run Compose from the project root, regardless of the caller's directory.
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$project_dir"

exec docker compose up -d --build app
