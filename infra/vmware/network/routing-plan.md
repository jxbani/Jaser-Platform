# Network routing & firewall plan

All segmentation happens **inside vSphere** via Distributed Switch portgroups
plus per-VM `nftables`. There is no overlay/CNI/SDN. The three tiers can only
talk to the tiers they need to.

## vDS portgroups

| Portgroup | VLAN | CIDR | Promiscuous | MAC changes | Forged transmits |
| --- | --- | --- | --- | --- | --- |
| `PG-Jaser-DMZ` | 10 | 10.10.10.0/24 | reject | reject | reject |
| `PG-Jaser-App` | 20 | 10.10.20.0/24 | reject | reject | reject |
| `PG-Jaser-Data` | 30 | 10.10.30.0/24 | reject | reject | reject |
| `PG-Jaser-Mgmt` | 99 | 10.10.99.0/24 | reject | reject | reject |

Distributed Firewall (NSX) or upstream router rules implement the matrix
below. Guest `nftables` is the second line of defence — duplicate rules so
either layer alone is sufficient.

## Allowed flows

```
            ┌─────────────┐
INTERNET ─► │  Web (DMZ)  │ 443,80
            └──┬──────────┘
               │ 3000/tcp        (Web → App only)
               ▼
            ┌─────────────┐
            │ App (VLAN20)│
            └──┬──────────┘
               │ 5432/tcp        (App → DB only)
               ▼
            ┌─────────────┐
            │ DB  (VLAN30)│
            └──┬──────────┘
               │ replication only between DB nodes (same VLAN)
               ▼
            ┌─────────────┐
            │ DB Standby  │
            └─────────────┘

Bastion (VLAN 99) ── 22/tcp ──► Web, App, DB (mgmt only)
```

## Rule matrix

| Src → Dst | 22 | 80/443 | 3000 | 5432 | VRRP | other |
| --- | --- | --- | --- | --- | --- | --- |
| Internet → Web | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ |
| Web → App | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ |
| Web ↔ Web | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| App → DB | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| DB ↔ DB | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ |
| Bastion → * | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| Any → DB | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |

## DNS

Internal zone `jaser.local` is delegated to `10.10.99.2` / `.3` (Mgmt VLAN).
Records:

```
jaser-web-01.jaser.local.   A 10.10.10.10
jaser-web-02.jaser.local.   A 10.10.10.11
app.jaser.local.            A 10.10.10.250    ; keepalived VIP
jaser-app-01.jaser.local.   A 10.10.20.10
jaser-app-02.jaser.local.   A 10.10.20.11
jaser-db-01.jaser.local.    A 10.10.30.10
jaser-db-02.jaser.local.    A 10.10.30.11
```

If the primary DB fails, repoint `jaser-db-01.jaser.local` (or run a VIP
between db-01 and db-02 with keepalived on the Data VLAN). The app does not
need to be redeployed — Prisma reconnects when the DNS TTL expires.

## vMotion

App VMs are eligible for vMotion (`vmware.tools.upgradePolicy = manual`,
DRS = fully automated). DB VMs are pinned to specific hosts via a DRS
should-rule because their disks are thick-eager-zeroed for performance.
