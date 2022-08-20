#!/usr/bin/env sh

# abort on errors
set -e

# build
npm run build

# navigate into the build output directory
cd dist

git init
git checkout -b master
git add -A
git commit -m 'deploy'

# if you are deploying to https://<USERNAME>.github.io/<REPO>
git config --global url."git@github.com:".insteadOf "https://github.com/"
git push -f https://github.com/adnanlah/rotsprite-webgl.git master:gh-pages

cd -