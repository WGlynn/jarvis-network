# Federation Protocol (v3 Specification)

**Status**: placeholder. Full spec ships with v3 — target month 3 after first paying customer.

Federation allows third-party operators to run JARVIS shards, serve overflow traffic from the hosted tier, and earn credits for contributed compute/bandwidth. Turns JARVIS from a single hosted service into a distributed network.

---

## Architecture (planned)

```
            Hosted Router (first-party)
                      │
          ┌───────────┼────────────┐
          ▼           ▼            ▼
   First-party     Federated     Federated
   Shards          Shard A       Shard B
   (in-house)      (Operator 1)  (Operator 2)
```

Each federated shard runs the canonical JARVIS binary (hash matching the v0 commitment) inside a TEE (Intel SGX / AMD SEV-SNP / AWS Nitro). The hosted router verifies attestation before routing traffic.

---

## Registration flow

1. Operator boots a shard with the canonical JARVIS binary.
2. Shard generates TEE attestation proving binary integrity against the committed hash.
3. Shard registers with hosted router: `POST /federation/register` with attestation + shard metadata (capacity, preferred chat types, geographic region).
4. Router verifies attestation against canonical hash + TEE vendor root-of-trust.
5. Router adds shard to routing pool; begins dispatching overflow traffic.

---

## SLA + metering

- Shard reports uptime + message throughput every N minutes.
- Router cross-checks via probe messages (ping/echo).
- Credits earned proportional to (messages served × uptime) weighted by SLA compliance.

Metered metrics:

- **Uptime**: % of time shard responded to health checks within threshold
- **Throughput**: total messages handled
- **Latency**: median response time (penalty weight)
- **Error rate**: % of failed or malformed responses (penalty weight)

---

## Slashing conditions

- **Failed TEE attestation** → shard evicted, pending credits forfeited
- **SLA violation above threshold** → credits reduced proportionally; repeat violations blacklist the operator
- **Malicious behavior** (incorrect responses, modified binary caught by re-attestation, archive exfiltration) → shard blacklisted, commitment bond slashed, operator banned network-wide
- **Archive tampering** (detected via Merkle-root mismatch with hosted router expectations) → blacklist + bond slash

---

## Verifiability

Each federated shard's claims are verifiable:
- **Binary integrity** via TEE attestation against v0 committed hash
- **Archive correctness** via Merkle proofs consistent with router's expected state
- **Message counts** via cross-referenced logs (operator claim + router-observed count)

See `../README.md` Verifiable Claims Roadmap for the full stack.

---

## Commitment bond

Operators post a bond at registration (USDC, amount TBD in v3 design). Bond:
- Slashable for malicious behavior
- Refundable after N months of good behavior
- Sized to exceed expected credit earnings over that period (makes malicious behavior negative-EV)

---

## Open questions (resolve before v3 ships)

- TEE provider support matrix (SGX / SEV-SNP / Nitro — all three? or pick one first?)
- Commitment bond size (scale with operator's target throughput?)
- Slashing procedure for false-positive detection (arbitration mechanism?)
- Revenue share split between federated shards and first-party infrastructure
- Geographic routing rules (data-residency requirements for some communities)

---

## Related

- [`tier-structure.md`](./tier-structure.md) — four-tier overview
- [`credit-earning.md`](./credit-earning.md) — credit-earning mechanics
- [`crypto-primitive-selection.md`](./crypto-primitive-selection.md) — why TEE is the right primitive for this layer
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — JARVIS 2.0 architecture
- [`../README.md`](../README.md) — Verifiable Claims Roadmap v3 (TEE attestation)
