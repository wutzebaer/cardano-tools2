#!/bin/sh
# Releases a new version: raises the version in package.json, tags the commit, builds the image and pushes it.
#
#   scripts/release.sh          1.2.3 -> 1.2.4, for fixes
#   scripts/release.sh minor    1.2.3 -> 1.3.0, for new features
#   scripts/release.sh major    1.2.3 -> 2.0.0
#   scripts/release.sh 3.0.0    exactly this version
#
# Needs only git and Docker. The image is tagged with the version: wutzebaer/cardano-tools2:1.2.4
set -eu
cd "$(dirname "$0")/.."

bump="${1:-patch}"
if [ -n "$(git status --porcelain)" ]; then
  echo "Commit or stash your changes first" >&2
  exit 1
fi

docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD":/w -w /w node:24-alpine \
  npm version "$bump" --no-git-tag-version >/dev/null
version=$(sed -n 's/^  "version": "\(.*\)",$/\1/p' package.json)

git add package.json package-lock.json
git commit -q -m "release: v$version"
git tag "v$version"

image="wutzebaer/cardano-tools2:$version"
docker build -q --build-arg NEXT_PUBLIC_CARDANO_NETWORK=mainnet -t "$image" .
docker push -q "$image"

echo "Released $image"
echo "Publish the commit and its tag with: git push --follow-tags"
