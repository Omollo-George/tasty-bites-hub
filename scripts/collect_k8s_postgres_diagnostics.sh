#!/usr/bin/env bash
set -euo pipefail

# Collect Kubernetes/Postgres diagnostics to a timestamped directory.
# Usage: ./scripts/collect_k8s_postgres_diagnostics.sh <namespace> <postgres-service-or-pod-prefix>
# Example: ./scripts/collect_k8s_postgres_diagnostics.sh crude-indigo-peafowl-xx0k2 crude-indigo-peafowl-xx0k2-postgresql

if [ "$#" -lt 2 ]; then
  echo "Usage: $0 <namespace> <postgres-service-or-pod-prefix>"
  exit 2
fi

NAMESPACE="$1"
PREFIX="$2"
OUTDIR="k8s_postgres_diagnostics_${NAMESPACE}_${PREFIX}_$(date +%Y%m%dT%H%M%S)"
mkdir -p "$OUTDIR"

echo "Collecting diagnostics to $OUTDIR"

echo "--- kubectl version ---" > "$OUTDIR/kubectl_version.txt" 2>&1
kubectl version --client --short >> "$OUTDIR/kubectl_version.txt" 2>&1 || true

echo "--- get pods -o wide ---" > "$OUTDIR/pods.txt"
kubectl get pods -n "$NAMESPACE" -o wide >> "$OUTDIR/pods.txt" 2>&1 || true

echo "--- get statefulset,svc,endpoints,pvc ---" > "$OUTDIR/objects.txt"
kubectl get statefulset,svc,endpoints,pvc -n "$NAMESPACE" >> "$OUTDIR/objects.txt" 2>&1 || true

echo "--- service describe (if exists) ---" > "$OUTDIR/service_describe.txt" 2>&1 || true
kubectl get svc -n "$NAMESPACE" | grep "$PREFIX" || true
kubectl describe svc -n "$NAMESPACE" "$PREFIX" >> "$OUTDIR/service_describe.txt" 2>&1 || true

echo "--- endpoints ---" > "$OUTDIR/endpoints.txt"
kubectl get endpoints -n "$NAMESPACE" | grep "$PREFIX" || true
kubectl describe endpoints -n "$NAMESPACE" "$PREFIX" >> "$OUTDIR/endpoints.txt" 2>&1 || true

# Find matching pods (by prefix)
PODS=$(kubectl get pods -n "$NAMESPACE" --no-headers -o custom-columns=":metadata.name" | grep "^${PREFIX}" || true)

if [ -z "$PODS" ]; then
  echo "No pods found with prefix $PREFIX in namespace $NAMESPACE" | tee "$OUTDIR/no_pods.txt"
else
  echo "Found pods:" | tee -a "$OUTDIR/pods_found.txt"
  echo "$PODS" | tee -a "$OUTDIR/pods_found.txt"
  for pod in $PODS; do
    safe=$(echo "$pod" | tr / _)
    echo "--- describe pod $pod ---" > "$OUTDIR/describe_$safe.txt"
    kubectl describe pod -n "$NAMESPACE" "$pod" >> "$OUTDIR/describe_$safe.txt" 2>&1 || true

    echo "--- logs pod $pod (last 200) ---" > "$OUTDIR/logs_$safe.txt"
    kubectl logs -n "$NAMESPACE" "$pod" --tail=200 >> "$OUTDIR/logs_$safe.txt" 2>&1 || true

    echo "--- previous logs pod $pod ---" > "$OUTDIR/logs_${safe}_previous.txt"
    kubectl logs -n "$NAMESPACE" "$pod" --previous >> "$OUTDIR/logs_${safe}_previous.txt" 2>&1 || true
  done
fi

echo "--- events (last 200) ---" > "$OUTDIR/events.txt"
kubectl get events -n "$NAMESPACE" --sort-by='.metadata.creationTimestamp' | tail -n 200 >> "$OUTDIR/events.txt" 2>&1 || true

echo "Diagnostics collected in $OUTDIR"
echo "You can archive it: tar czf ${OUTDIR}.tar.gz $OUTDIR"

exit 0
