# Jaser Platform — VMware Deployment

This directory holds everything needed to deploy Jaser onto a **VMware vSphere**
cluster (or a single ESXi host) using **VM-level isolation only**. There are
**no containers, no Docker, no Kubernetes** anywhere in this tree — workload
isolation, scaling, packaging and rollback all rely on VMware primitives:
linked-clone VM templates, portgroups/VLANs, snapshots, and Guest Customization.

## Topology

Three VM tiers, each on its own vDS portgroup so traffic flows are enforced at
the hypervisor level. Sizes are starting points — adjust via vSphere reservations.

```
                Internet
                   │
        ┌──────────▼──────────┐         VLAN 10  (DMZ)
        │   jaser-web-{01,02} │  nginx · TLS · WAF
        │   2 vCPU · 4 GB · 40 GB
        └──────────┬──────────┘
                   │ 443/80 → 3000
        ┌──────────▼──────────┐         VLAN 20  (App)
        │  jaser-app-{01,02..}│  Node.js 20 · PM2 (or systemd)
        │   4 vCPU · 8 GB · 80 GB
        └──────────┬──────────┘
                   │ 5432
        ┌──────────▼──────────┐         VLAN 30  (Data)
        │   jaser-db-01       │  PostgreSQL 16 · pg_dump · WAL-archive
        │   8 vCPU · 16 GB · 200 GB (thick-provisioned, eager-zeroed)
        └─────────────────────┘
```

A standby DB VM (`jaser-db-02`) is provisioned but powered off; promotion is a
manual `pg_ctl promote` + snapshot of the primary's last-good state. See
`network/routing-plan.md`.

## Why VMs, not containers

The original requirement excludes containerization. Within that constraint we
get isolation and reproducibility from:

| Concern | VMware mechanism |
| --- | --- |
| Image / "container" of a workload | A hardened VM template (`tmpl-jaser-app-v1`) cloned via `govc vm.clone` |
| Network segmentation | Distributed Virtual Switch portgroups (VLAN 10/20/30) + ESXi firewall + guest `nftables` |
| Horizontal scaling | `govc vm.clone --link` to spin a new `jaser-app-NN`; nginx upstream picks it up via `scripts/scale-out.sh` |
| Rolling release | Atomic symlink swap of `/opt/jaser/current` plus VM-level snapshots so a whole tier can be rewound |
| Rollback | `govc snapshot.revert` or the application-level `scripts/rollback.sh` |
| Configuration drift | Guest Customization Specifications + first-boot scripts in `guest-customization/` |
| Secrets | Per-tier `.env` files rendered by first-boot from a vault (`/etc/jaser/secrets.env`, mode 0600) |

## Runbook

1. **Build the artifact** on the build VM (or any Linux host with Node 20):
   ```
   ./infra/vmware/scripts/build.sh
   ```
   Produces `dist/jaser-<version>-<git-sha>.tar.gz`.

2. **Provision** the three tiers (idempotent — does nothing if VMs exist):
   ```
   GOVC_URL=... GOVC_USERNAME=... GOVC_PASSWORD=... \
     ./infra/vmware/govc/provision.sh
   ```

3. **Push the release** to the app VMs:
   ```
   ./infra/vmware/scripts/deploy.sh dist/jaser-1.4.0-abc1234.tar.gz
   ```
   The script: takes a pre-deploy snapshot, rsyncs the tarball, extracts to
   `/opt/jaser/releases/<ts>`, runs `prisma migrate deploy`, swaps the
   `current` symlink, restarts `jaser-app.service`, then health-checks.

4. **Scale out** when you need more app capacity:
   ```
   ./infra/vmware/scripts/scale-out.sh jaser-app-03
   ```

5. **Roll back** (application or whole VM):
   ```
   ./infra/vmware/scripts/rollback.sh             # symlink swap on app tier
   ./infra/vmware/govc/rollback.sh jaser-app-01   # revert to last snapshot
   ```

See `topology.md` for IP plan, `network/routing-plan.md` for firewall flows.
