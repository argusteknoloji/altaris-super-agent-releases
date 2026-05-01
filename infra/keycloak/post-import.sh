#!/usr/bin/env bash
# Run after `docker compose up -d` once Keycloak is healthy.
# Grants the altaris-admin-svc service account the realm-management roles
# it needs (Keycloak realm import does not support inline service-account
# client role mappings).

set -euo pipefail

KC=${KC_URL:-http://localhost:8081}
ADMIN_USER=${KC_ADMIN_USER:-admin}
ADMIN_PASS=${KC_ADMIN_PASS:-admin_dev}
REALM=${KC_REALM:-altaris}
SVC_CLIENT=${KC_SVC_CLIENT:-altaris-admin-svc}

echo "▸ acquiring admin token from master realm"
admin_token=$(curl -sf -X POST "$KC/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=$ADMIN_USER&password=$ADMIN_PASS" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

echo "▸ resolving altaris-admin-svc client + service account user"
svc_id=$(curl -sf "$KC/admin/realms/$REALM/clients?clientId=$SVC_CLIENT" \
  -H "Authorization: Bearer $admin_token" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")
sa_user_id=$(curl -sf "$KC/admin/realms/$REALM/clients/$svc_id/service-account-user" \
  -H "Authorization: Bearer $admin_token" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "▸ resolving realm-management client"
rm_id=$(curl -sf "$KC/admin/realms/$REALM/clients?clientId=realm-management" \
  -H "Authorization: Bearer $admin_token" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

echo "▸ fetching role definitions"
roles_json=$(curl -sf "$KC/admin/realms/$REALM/clients/$rm_id/roles" \
  -H "Authorization: Bearer $admin_token")

selected=$(echo "$roles_json" | python3 -c "
import sys,json
needed = {'manage-users','view-users','query-users','manage-realm','view-realm'}
roles = [r for r in json.load(sys.stdin) if r['name'] in needed]
print(json.dumps(roles))
")

echo "▸ assigning roles to service account"
curl -sf -X POST "$KC/admin/realms/$REALM/users/$sa_user_id/role-mappings/clients/$rm_id" \
  -H "Authorization: Bearer $admin_token" \
  -H "Content-Type: application/json" \
  -d "$selected" \
  && echo "✓ done"
