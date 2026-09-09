#!/bin/bash

npm install

git clone "https://github.com/wutzebaer/cardano-java-lib.git" ~/repos/cardano-java-lib
mvnd -f ~/repos/cardano-java-lib/pom.xml install -DskipTests

git clone "https://github.com/wutzebaer/cardano-db-sync-api.git" ~/repos/cardano-db-sync-api
mvnd -f ~/repos/cardano-db-sync-api/pom.xml compile

set -a && source .env && set +a
mvnd -f ~/repos/cardano-db-sync-api/pom.xml spring-boot:run



