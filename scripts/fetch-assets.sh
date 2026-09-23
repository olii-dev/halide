#!/usr/bin/env bash
# Rebuilds public/assets from the original sources:
#  - Car Concept (Khronos glTF Sample Assets, CC BY 4.0)
#  - Poly Haven HDRIs (CC0): 2k HDR for lighting, 8k HDR converted to 8k/4k JPEG backdrops
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/assets/cars public/assets/hdri public/assets/backdrop /tmp/halide-hdr8
[ -f public/assets/cars/CarConcept.glb ] || curl -sL -o public/assets/cars/CarConcept.glb https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb
for k in $(node -e "import('./src/locations.js').then(m=>console.log(m.LOCATIONS.map(l=>l.id).join(' ')))"); do
  f=public/assets/hdri/${k}_2k.hdr; [ -f "$f" ] || curl -sL -o "$f" https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/${k}_2k.hdr
  if [ ! -f public/assets/backdrop/${k}_8k.jpg ]; then curl -sL -o /tmp/halide-hdr8/${k}_8k.hdr https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/8k/${k}_8k.hdr; fi
done
ls /tmp/halide-hdr8/*.hdr >/dev/null 2>&1 && node scripts/make-backdrops.mjs /tmp/halide-hdr8 public/assets/backdrop && rm -rf /tmp/halide-hdr8
echo done
