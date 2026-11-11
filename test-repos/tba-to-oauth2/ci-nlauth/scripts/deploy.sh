#!/usr/bin/env bash
# Uploads SuiteScript files to the File Cabinet through our deploy RESTlet.
# (SDF needs a browser login for the account, so CI uses the RESTlet instead.)
set -euo pipefail

: "${NS_ACCOUNT:?}" "${NS_EMAIL:?}" "${NS_PASSWORD:?}"
NS_ROLE="${NS_ROLE:-1031}"
HOST="$(echo "$NS_ACCOUNT" | tr '[:upper:]_' '[:lower:]-')"
URL="https://${HOST}.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script=customscript_acme_file_deploy&deploy=1"
AUTH="NLAuth nlauth_account=${NS_ACCOUNT}, nlauth_email=${NS_EMAIL}, nlauth_signature=${NS_PASSWORD}, nlauth_role=${NS_ROLE}"

find src/FileCabinet/SuiteScripts -name '*.js' | while read -r f; do
  rel="${f#src/FileCabinet}"
  echo "uploading ${rel}"
  jq -n --arg path "$rel" --rawfile content "$f" '{path: $path, content: $content}' |
    curl --fail -sS -X PUT "$URL" \
      -H "Authorization: ${AUTH}" \
      -H "Content-Type: application/json" \
      --data-binary @- > /dev/null
done
echo "deployed to ${NS_ACCOUNT}"
