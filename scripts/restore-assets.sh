#!/usr/bin/env bash
# After a workspace wipe: pull public/assets back down from the live site (assets are gitignored).
set -uo pipefail
cd "$(dirname "$0")/.."
B=${B:-https://halide.mebbo.cloud/assets}
mkdir -p public/assets/{hdri,backdrop,thumbs,cars,carthumbs,plate}
curl -sf -o public/assets/backdrop/backdrops.json $B/backdrop/backdrops.json
for k in $(node -e "import('./src/locations.js').then(m=>console.log(m.LOCATIONS.map(l=>l.id).join(' ')))"); do
  for f in hdri/${k}_2k.hdr backdrop/${k}_8k.jpg backdrop/${k}_4k.jpg thumbs/${k}.jpg; do [ -s public/assets/$f ] || curl -sf -o public/assets/$f "$B/$f" || echo "MISS $f"; done
done
for k in $(node -e "import('./src/locations.js').then(m=>console.log(m.LOCATIONS.filter(l=>l.plate).map(l=>l.id).join(' ')))"); do
  f=plate/${k}.jpg; [ -s public/assets/$f ] || curl -sf -o public/assets/$f "$B/$f" || echo "MISS $f"
done
for m in $(node -e "import('./src/cars.js').then(m=>console.log(m.MODELS.map(x=>x.id+':'+x.file).join(' ')))" 2>/dev/null); do
  id=${m%%:*}; file=${m#*:}
  for f in cars/$file carthumbs/$id.jpg; do [ -s public/assets/$f ] || curl -sf -o public/assets/$f "$B/$f" || echo "MISS $f"; done
done
echo RESTORED
