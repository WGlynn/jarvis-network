# Crypto Primitive Selection Guide

A decision tool for picking the right cryptographic primitive for a given claim.

**Usage**: When designing a system that needs to prove something, run the decision tree first. Most primitive choices are forced by the shape of what's private / what's public / what's being proven. **Crypto engineering is mostly selection, not invention.**

---

## Decision tree

```
What are you trying to prove?
│
├── "This is the canonical code / artifact"
│   └── → Cryptographic hash (SHA-256, Blake3)
│       Cheap, universal, no privacy required.
│
├── "Aggregate property over private inputs"
│   └── → ZK proof (zkVM / SNARK / STARK)
│       Hides inputs, reveals only the aggregate claim.
│
├── "Deterministic function over public append-only state"
│   └── → Merkle tree + inclusion proof
│       Natural fit for logs; no hiding needed.
│
├── "Cross-operator binary integrity at runtime"
│   └── → TEE attestation (SGX / SEV-SNP / Nitro / TDX)
│       Hardware-rooted, once-per-boot, full-binary scope.
│
├── "Multi-party compute without a trusted third party"
│   └── → MPC (secret sharing + joint computation)
│       N parties, no single party sees all inputs.
│
├── "Compute on encrypted data, result also encrypted"
│   └── → FHE (homomorphic encryption)
│       Server computes without ever decrypting.
│
└── "Binding commitment now, reveal later"
    └── → Commit-reveal (hash commitment + later open)
        Prevents adaptive cheating; enforces pre-commitment.
```

---

## Hierarchy by what's hidden

```
NOTHING HIDDEN
├── Hash                  — identity of public artifact
├── Merkle                — inclusion in public append-only state
└── Commit-reveal         — binding the commitment is public, the value is temporarily hidden

PRIVATE INPUTS, PUBLIC OUTPUT
├── ZK proof              — prove a statement over private witness
└── MPC                   — N-party private inputs, joint public output

PRIVATE INPUTS + COMPUTATION, ENCRYPTED OUTPUT
└── FHE                   — compute on encrypted data without decrypting

HARDWARE-ISOLATED EXECUTION
└── TEE attestation       — prove a specific binary ran in secure hardware
```

---

## Primitive reference

### Hash (SHA-256, Blake3)

| Property | Value |
|---|---|
| What it hides | Nothing |
| What it proves | Identity of a known artifact |
| Cost | Microseconds |
| Universal verifier | Yes — every language / platform |

**Best for**: binary/file identity commitments, reproducible-build verification, the building block all other primitives reference.

**Not for**: hiding anything (no privacy property); proving computation (hash doesn't prove code *ran*, just that code *exists*).

### ZK Proof (zkVM, SNARK, STARK)

| Property | Value |
|---|---|
| What it hides | Private witness / inputs |
| What it proves | Arbitrary public statement, given hidden witness |
| Cost | Seconds to hours proving, milliseconds verifying |
| Universal verifier | Yes with standard proof systems |

**Best for**: aggregates over private data (cost-per-msg from confidential receipts), proving program execution without revealing inputs, scaling rollups (many txs → one proof).

**Not for**: public-input deterministic computation (use Merkle), real-time per-call proofs at LLM scale (proving cost dominates), fuzzy claims ("our prompt engineering is superior").

### Merkle Tree

| Property | Value |
|---|---|
| What it hides | Nothing by default |
| What it proves | Membership / inclusion / consistency in append-only structure |
| Cost | O(log n) proofs |
| Universal verifier | Yes — trivially implementable |

**Best for**: append-only logs (archive.jsonl, blockchain), proving "this state produced this output" when the function is public + deterministic, consistency across checkpoints.

**Not for**: hiding input data (add commit-reveal if privacy needed), non-append-only state (use a more general accumulator).

### TEE Attestation (SGX / SEV-SNP / Nitro / TDX)

| Property | Value |
|---|---|
| What it hides | Enclave memory from host operator |
| What it proves | A specific binary (measured hash) ran inside secure hardware |
| Cost | Once-per-boot (fast); per-call overhead minimal |
| Universal verifier | Requires chip vendor's signing key (Intel / AMD / AWS) |

**Best for**: cross-operator binary integrity at runtime, confidential cloud compute, proving "the full binary behaved as committed" at economic scale.

**Not for**: environments where hardware-vendor trust is unacceptable; workloads highly sensitive to side-channel attacks (Spectre, Foreshadow class); maximum-security claims where audit-everything ZK would be preferable if affordable.

### MPC (Multi-Party Computation)

| Property | Value |
|---|---|
| What it hides | Each party's inputs from the others |
| What it proves | Output correctly computed from joint (hidden) inputs |
| Cost | Network-heavy, N-way coordination |
| Universal verifier | Participating parties |

**Best for**: N-party joint computation where no party should see all inputs (private auctions, threshold signing), secret-sharing schemes (Shamir), privacy-preserving set intersection.

**Not for**: one-prover-many-verifier scenarios (use ZK), single-party workloads (unnecessary complexity).

### FHE (Fully Homomorphic Encryption)

| Property | Value |
|---|---|
| What it hides | Inputs AND intermediate computation from compute provider |
| What it proves | Server computed correct output from encrypted inputs |
| Cost | 1000×–10000× plaintext overhead (improving fast) |
| Universal verifier | Decryption by key holder |

**Best for**: outsourcing computation without trusting the provider with data, encrypted-ML inference (nascent), privacy-preserving queries over encrypted databases.

**Not for**: prove-properties-of-closed-code scenarios (use ZK + TEE instead); performance-critical workloads; anything where the server is already trusted to see the data.

### Commit-Reveal

| Property | Value |
|---|---|
| What it hides | Committed value until reveal |
| What it proves | Revealed value matches original commitment |
| Cost | Trivial (two hashes + reveal step) |
| Universal verifier | Yes |

**Best for**: preventing adaptive manipulation in multi-party interactions (auctions, randomness beacons), binding future behavior to prior commitment, architectural-commitment-now-audit-later patterns.

**Not for**: perpetual privacy (commit-reveal is privacy *until reveal*; for eternal hiding, use encryption); proving structure without revealing the value (use ZK).

---

## Anti-pattern table

| Claim shape | Right primitive | Wrong choice cost |
|---|---|---|
| Public code integrity | Hash | ZK adds 100× proving overhead for zero privacy gain |
| Private-input aggregate | ZK | Hash doesn't hide inputs; Merkle doesn't prove aggregation |
| Deterministic replay over public state | Merkle | ZK pays to hide what's already public |
| Cross-operator binary at runtime | TEE | ZK infeasible per-call; Merkle doesn't cover code |
| N-party private compute | MPC | ZK wrong topology (one→many); FHE heavier |
| Compute on encrypted data | FHE | ZK different shape (prove-over-private, not compute-on-encrypted) |
| Binding future behavior | Commit-reveal | Hash alone doesn't enforce timing; signature doesn't prevent recomputation |

---

## Selection heuristic

1. **What's private?** Sets the class (hash for public, ZK/MPC/FHE for private compute).
2. **Who's the prover/verifier?** One-to-many → ZK. N-party → MPC. Hardware-attested → TEE.
3. **What's the cost budget?** Per-call ZK is expensive; amortize via batching or use TEE.
4. **Is the computation public-deterministic?** Then Merkle + replay beats ZK.
5. **Is there temporal binding?** Commit-reveal for future-reveal; hash for static identity.

---

## JARVIS-specific mapping

| JARVIS layer | Primitive | Why |
|---|---|---|
| v0 binary identity | SHA-256 hash | Public artifact, universal verifier, cheapest primitive |
| v1 cost claims | ZK (zkVM over signed receipts) | Private inputs (receipts), public aggregate (cost ratio) |
| v2 grounding claims | Merkle + replay | Deterministic function over append-only archive, no privacy needed |
| v3 federated shard integrity | TEE attestation | Cross-operator binary at runtime, economic scale |

---

## VibeSwap parallel

| VibeSwap mechanism | Primitive | Why |
|---|---|---|
| Batch auction orders | Commit-reveal | Prevents MEV front-running; reveal at clearing |
| Shapley distribution | ZK + Merkle | Private contributions, public fair share proof |
| Circuit breaker attestation | Hash + signature | Public commitment, revocable via governance |
| Cross-chain settlement | Merkle + ZK | State inclusion proofs across chains |

Same selection discipline; different substrate.

---

## The meta-lesson

**Every primitive hides something specific and reveals something specific.** Map: what's private, what's public, what's verified, at what granularity. Pick the cheapest primitive that matches that map.

Crypto engineering is mostly primitive-selection, not invention — the primitives exist, the art is matching them to the claim shape. Mismatches either over-engineer (ZK for a hash problem) or under-prove (hash for an aggregate-private-input problem).
