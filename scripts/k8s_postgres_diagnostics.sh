#!/bin/sh
# Diagnostics helper for PostgreSQL issues in Kubernetes.
# Usage: ./scripts/k8s_postgres_diagnostics.sh <namespace> [service-name] [pod-label]

NS=${1:-default}
SERVICE=${2:-crude-indigo-peafowl-xx0k2-postgresql}
LABEL=${3:-app=postgres}

echo "Namespace: ${NS}"
echo "Service: ${SERVICE}"
echo "Label selector: ${LABEL}"
echo

echo "1) Pod status"
kubectl get pods -n "${NS}" --selector="${LABEL}" -o wide

echo

echo "2) Service and endpoints"
kubectl get svc -n "${NS}" "${SERVICE}" || true
kubectl get endpoints -n "${NS}" "${SERVICE}" || true

echo

echo "3) Describe service"
kubectl describe svc -n "${NS}" "${SERVICE}" || true

echo

echo "4) Describe matching pods"
kubectl get pods -n "${NS}" --selector="${LABEL}" -o name | xargs -r -n1 kubectl describe pod -n "${NS}"

echo

echo "5) Recent logs for matching pods"
kubectl get pods -n "${NS}" --selector="${LABEL}" -o name | xargs -r -n1 -I{} sh -c 'echo "--- {} ---"; kubectl logs {} -n "${NS}" --since=1h --tail=100 || true'

echo

echo "6) Pod conditions (for matching pods)"
kubectl get pods -n "${NS}" --selector="${LABEL}" -o custom-columns=NAME:.metadata.name,STATUS:.status.phase,READY:.status.containerStatuses[*].ready,RESTARTS:.status.containerStatuses[*].restartCount

echo

echo "7) If pod is running, test readiness from a shell in one pod"
cat <<'EOF'
  kubectl exec -it -n ${NS} $(kubectl get pods -n ${NS} --selector="${LABEL}" -o jsonpath='{.items[0].metadata.name}') -- sh -c "pg_isready -h ${SERVICE}.${NS}.svc.cluster.local -p 5432 || true"
EOF

echo

echo "Done. Inspect the logs for stack traces or repeated restarts."