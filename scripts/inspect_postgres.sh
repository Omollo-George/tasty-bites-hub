#!/bin/sh
# Helper script to inspect Postgres pods and logs in a namespace.
# Usage: ./scripts/inspect_postgres.sh <namespace> [pod-name-prefix]

NS=${1:-default}
PREFIX=${2:-postgres}

echo "Listing pods in namespace: ${NS} (filter prefix: ${PREFIX})"
kubectl get pods -n "${NS}" | grep "${PREFIX}" || true

echo "Describe matching pods:" 
kubectl get pods -n "${NS}" -o name | grep "${PREFIX}" | xargs -r -n1 kubectl describe -n "${NS}" || true

echo "Recent logs (last 1h) for matching pods:" 
kubectl get pods -n "${NS}" -o name | grep "${PREFIX}" | xargs -r -n1 -I{} sh -c 'echo "--- {} ---"; kubectl logs {} -n "${NS}" --since=1h || true'

echo
echo "If a pod shows a CrashLoopBackOff or OOMKilled, consider restarting the deployment/statefulset:" 
echo "  kubectl rollout restart deployment/<deployment-name> -n ${NS}"
echo "Or for statefulsets:"
echo "  kubectl rollout restart statefulset/<statefulset-name> -n ${NS}"

echo "To fetch previous logs (before a crash):"
echo "  kubectl logs <pod-name> -n ${NS} --previous"

echo "Done."
