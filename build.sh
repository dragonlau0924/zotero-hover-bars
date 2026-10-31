#!/bin/bash
# Build hover-bars.xpi (manifest.json must sit at the root of the archive)
set -euo pipefail
cd "$(dirname "$0")"
rm -rf build
mkdir build
(cd src && zip -r -X -D ../build/hover-bars.xpi manifest.json bootstrap.js hover-bars.js locale)
echo "Built build/hover-bars.xpi"
