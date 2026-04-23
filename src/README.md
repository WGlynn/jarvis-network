# src/

Codebase lives in `vibeswap/jarvis-bot/src/` in the private VibeSwap repo. It will be copied here before first customer onboarding.

Kept empty at scaffold stage to avoid duplicating an active codebase. The structure the repo WILL hold is documented in `ARCHITECTURE.md` (and `vibeswap/jarvis-bot/docs/JARVIS_2.0.md`).

## Copy procedure (when ready to cut bootstrap)

1. Verify `vibeswap/jarvis-bot/src/` is at the commit matching the intended v0 launch.
2. Copy contents: `cp -r ../vibeswap/jarvis-bot/src/* ./` (or equivalent on Windows).
3. Update import paths that reference VibeSwap-internal modules.
4. Run `npm install` against a fresh `package.json`.
5. Compute binary hash for the v0 Verifiability Commitment (see README Verifiable Claims Roadmap).
6. Remove this README; replace with actual codebase documentation.
