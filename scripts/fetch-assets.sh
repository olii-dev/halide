#!/usr/bin/env bash
# Downloads the CC0 HDRIs (Poly Haven) and the CC-BY 4.0 Car Concept (Khronos) into public/assets.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p public/assets/cars public/assets/hdri
[ -f public/assets/cars/CarConcept.glb ] || curl -sL -o public/assets/cars/CarConcept.glb https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb
for k in $(node -e "import('./src/locations.js').then(m=>console.log(m.LOCATIONS.map(l=>l.id).join(' ')))"); do
  for r in 2k 4k; do f=public/assets/hdri/${k}_$r.hdr; [ -f "$f" ] || curl -sL -o "$f" https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/$r/${k}_$r.hdr; done
done
