#!/bin/sh
# One-time update for shared hosting without SSH (run once by a temporary cron job).
# Adds Grab payments, 1-letter usernames and the owner update banner.
# Downloads the 10 changed files pinned to commit b13bcb3, checks each SHA-256,
# backs up the current files, replaces them and runs database migrations. Runs only once.
set -eu
D=/home/u505258865/domains/green-hawk-688585.hostingersite.com/public_html
M="$D/storage/app/update-20261123-grab.done"
if [ -f "$M" ]; then echo ALREADY-DONE; exit 0; fi
cd "$D"
test -f artisan
test -f .env
T=$(mktemp -d)
B="$D/storage/app/update-backup-20261123"
R=https://raw.githubusercontent.com/jawadpro/resturant-app/b13bcb3583f302625fce26260500369dcd892f88
FILES="5cbf887c92c1b7d2d01d68b38c000f584274485cd156ff178f0820d5300bda66:app/Http/Controllers/AppController.php
214d90e47fc7920a2f4d83001028efd30b08be5f9381a25c1821ebd0cc697ada:app/Http/Controllers/InstallController.php
bba5a04244063b4e7103b9e62643f7bbd6ed973f08b535f5c89e876fe400e6d9:app/Http/Controllers/NightController.php
a2e733d14ac9e041c03b4eeb08b3a5c74460f351c7579ca7ad33624943016657:app/Http/Controllers/ReportController.php
fc30bcecf4f5a34d93797e8f5dfe7e53d47ac8731d994de348d456696f8b3771:app/Http/Controllers/UserController.php
ef6d1b2d8ecf8bbb687e191bf24ec3116af6626c70e8526104bd0446d1a4f2c1:app/Models/Night.php
19bd37fc05a87fbdbe5c80478bb939e09ccd09b62a0f2668b13458eb22344c45:app/Support/Books.php
745052e7663395f329e8f080a980021a8cd60e44a8cbf560756c52149ba620d6:public/assets/app.js
1d1f1dfee444391b67ec38279c61097678232f38b7463b0835664e2bba992480:routes/web.php
66947e94aa19c31ebad44ea360deaee6cb878f8c438fdca191edb1ad464d2e03:database/migrations/2026_11_23_000100_add_grab_to_nights.php"
for e in $FILES; do
  h=$(echo "$e" | cut -d: -f1); f=$(echo "$e" | cut -d: -f2-); n=$(echo "$f" | tr / _)
  curl -fsSL --max-time 60 "$R/$f" -o "$T/$n"
  echo "$h  $T/$n" | sha256sum -c --quiet
  echo "verified $f"
done
mkdir -p "$B"
for e in $FILES; do
  f=$(echo "$e" | cut -d: -f2-); n=$(echo "$f" | tr / _)
  if [ -f "$f" ]; then cp -p "$f" "$B/$n"; fi
  mkdir -p "$(dirname "$f")"
  cp "$T/$n" "$f"
  echo "replaced $f"
done
rm -rf "$T"
P=/opt/alt/php83/usr/bin/php
if [ ! -x "$P" ]; then P=php; fi
"$P" artisan migrate --force --no-interaction
touch "$M"
echo ALL-DONE
