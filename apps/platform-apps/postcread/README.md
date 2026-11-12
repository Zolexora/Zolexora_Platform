# PostCread

Short-video (reels) app: people post, watch and like reels in an Instagram-style feed.

Status: placeholder. No code yet; this folder holds the decisions made so far.

## Decisions so far

- **Standalone product.** It will use the standard product layout (`apps/`, `services/`, `packages/`, `scripts/`, `docs/`); see [docs/architecture.md](../../../docs/architecture.md#product-layout).
- **Sign-in** is the Zolexora auth service, as in every product.
- **Earnings for watching reels** are kept by the Zolexora auth service (wallet), not here. PostCread reports views; the auth service credits them and shows the balance on the user's profile.
- **Shop sellers** will post reels from the Zolexora Shop seller portal, tagged with their products. Later the shop app will show reels, and tapping a reel opens the product.
- **Shop spending** of earnings goes through the auth-service wallet (hold at checkout, then confirm or release); the shop keeps no balance.
- **Coins or rupees:** not decided yet.

Reels, coins and subscriptions were removed from Zolexora Shop to make way for this.
