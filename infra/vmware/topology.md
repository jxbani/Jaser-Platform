# Topology, IP plan and VM inventory

> All addresses are placeholders — replace before provisioning. The variable
> names match those expected by `govc/provision.sh`.

## vSphere objects

| Object | Name |
| --- | --- |
| Datacenter | `DC-JASER` |
| Cluster | `CLUSTER-JASER` |
| Datastore (primary) | `DS-SSD-01` |
| Datastore (replica/backup) | `DS-NL-SAS-02` |
| Distributed switch | `vDS-JASER` |
| Resource pool | `RP-Jaser-Prod` |
| Folder | `Jaser/Prod` |

## Portgroups (VLANs)

| Portgroup | VLAN | CIDR | Purpose |
| --- | --- | --- | --- |
| `PG-Jaser-DMZ` | 10 | `10.10.10.0/24` | Web tier — internet-facing nginx |
| `PG-Jaser-App` | 20 | `10.10.20.0/24` | Node.js app tier |
| `PG-Jaser-Data` | 30 | `10.10.30.0/24` | PostgreSQL tier — no egress |
| `PG-Jaser-Mgmt` | 99 | `10.10.99.0/24` | SSH bastion / vCenter mgmt access only |

## VM inventory

| Hostname | Tier | Portgroup(s) | vCPU | RAM | Disk | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `jaser-web-01` | Web | DMZ, App | 2 | 4 GB | 40 GB | Active edge |
| `jaser-web-02` | Web | DMZ, App | 2 | 4 GB | 40 GB | Active edge (HA pair) |
| `jaser-app-01` | App | App | 4 | 8 GB | 80 GB | Next.js + Prisma |
| `jaser-app-02` | App | App | 4 | 8 GB | 80 GB | |
| `jaser-db-01` | DB | Data | 8 | 16 GB | 200 GB | PostgreSQL 16 primary |
| `jaser-db-02` | DB | Data | 8 | 16 GB | 200 GB | Standby (streaming repl, powered off until promotion) |
| `jaser-bastion-01` | Mgmt | Mgmt | 1 | 2 GB | 20 GB | Only path for ops to reach App/Data tiers |

## Templates

| Template | Base | Hardening applied |
| --- | --- | --- |
| `tmpl-base-rocky9` | Rocky Linux 9 minimal | CIS baseline, hardened sshd, chrony, firewalld |
| `tmpl-jaser-web-v1` | from `tmpl-base-rocky9` | nginx, certbot, fail2ban |
| `tmpl-jaser-app-v1` | from `tmpl-base-rocky9` | Node.js 20, /opt/jaser layout, systemd unit, jaser user |
| `tmpl-jaser-db-v1` | from `tmpl-base-rocky9` | PostgreSQL 16, WAL archive dir, role bootstrap |

Templates are versioned (`-v1`, `-v2`, …). New versions are produced by:

1. Cloning the previous version to a temp VM.
2. Applying patches/upgrades.
3. Snapshotting and converting back to a template (`govc vm.markastemplate`).
4. Updating the `TMPL_*` env vars in `env/.env.shared.template`.

## IP allocation

| Address | Host |
| --- | --- |
| `10.10.10.10/24` | `jaser-web-01` |
| `10.10.10.11/24` | `jaser-web-02` |
| `10.10.10.250` | Floating VIP for nginx (keepalived) |
| `10.10.20.10/24` | `jaser-app-01` |
| `10.10.20.11/24` | `jaser-app-02` |
| `10.10.30.10/24` | `jaser-db-01` |
| `10.10.30.11/24` | `jaser-db-02` |
| `10.10.99.10/24` | `jaser-bastion-01` |

DNS internal zone: `jaser.local`. The application's `DATABASE_URL` resolves to
`jaser-db-01.jaser.local` so promotion only requires repointing DNS (or
keepalived ARPing the VIP).
