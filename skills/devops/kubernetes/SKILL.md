---
name: kubernetes
description: >
  Kubernetes best practices for deploying and managing containerized workloads
  in production. Covers pod design, deployment strategies, service networking,
  config management, autoscaling, security, and observability. Use this skill
  when designing or reviewing Kubernetes manifests and Helm charts.
license: MIT
metadata:
  author: skillbox
  version: "1.0"
  category: devops
  tags: kubernetes, k8s, containers, orchestration, helm
---

# Kubernetes Best Practices

## Pod Design

Always set resource requests and limits. Requests guarantee scheduling; limits prevent noisy-neighbor problems.

```yaml
resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 256Mi
```

Use `readinessProbe` for traffic routing and `livenessProbe` to restart stuck processes. Do not point both at the same heavy endpoint.

```yaml
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  initialDelaySeconds: 15
  periodSeconds: 10
readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
```

Handle SIGTERM in your application. Use `preStop` hooks so in-flight requests drain before the pod is removed from endpoints.

```yaml
lifecycle:
  preStop:
    exec:
      command: ["sh", "-c", "sleep 5"]
terminationGracePeriodSeconds: 30
```

## Deployments

Set `maxUnavailable: 0` in production so all existing pods stay healthy during rollout.

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxUnavailable: 0
    maxSurge: 1
```

Roll back with `kubectl rollout undo deployment/my-app --to-revision=3`. Keep `revisionHistoryLimit: 5`.

## Services and Networking

Use `ClusterIP` for internal traffic, `LoadBalancer` for external exposure on cloud providers. Prefer Ingress with an Ingress controller for HTTP routing:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: my-app
                port:
                  number: 80
```

## ConfigMaps and Secrets

Do not bake configuration into images. Use ConfigMaps for non-sensitive data and Secrets for credentials. Never commit base64-encoded secrets to Git -- use External Secrets Operator or Sealed Secrets instead.

```yaml
envFrom:
  - configMapRef:
      name: my-app-config
  - secretRef:
      name: my-app-secrets
```

## Horizontal Pod Autoscaler

Scale on CPU by default. Add custom metrics for more accurate scaling. Set `minReplicas: 2` in production.

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
```

## Namespace Organization

Separate workloads by team or environment. Apply ResourceQuotas per namespace to prevent resource exhaustion.

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: team-quota
  namespace: team-alpha
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    pods: "20"
```

## Helm Charts

Use `_helpers.tpl` for reusable snippets. Pin dependency versions. Run `helm diff` before every `helm upgrade`.

```
my-chart/
  Chart.yaml
  values.yaml
  values-production.yaml
  templates/
    deployment.yaml
    service.yaml
    _helpers.tpl
```

## RBAC and Security Contexts

Run containers as non-root. Drop all capabilities. Do not use the `default` ServiceAccount.

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

## Monitoring

Expose metrics at `/metrics` in Prometheus format. Use ServiceMonitor with the Prometheus Operator. Source Grafana dashboards from version control.

```yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
spec:
  selector:
    matchLabels:
      app: my-app
  endpoints:
    - port: http
      path: /metrics
      interval: 15s
```
