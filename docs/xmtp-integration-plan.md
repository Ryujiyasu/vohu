# XMTP × World Chat integration plan (Pattern 4 — "Chat-scoped polls")

> **Target**: WB3 XMTP "Best Use of World Chat" $5k sponsor track.
> **Thesis**: vohu becomes a product that **can only exist because World Chat exists** — not a vote app that happens to post to chat.
> **Status**: 2026-04-23 design; implementation target 2026-04-24 to 2026-04-26.

---

## 0. Why Pattern 4 and not 1–3

| Pattern | Tagline | Why it loses to #4 |
|---|---|---|
| 1. Propose via Chat | "/vote" slash command in a chat | Chat is a connector, not a primitive |
| 2. Results back to Chat | Post tally to the source group | Chat is a notification bus |
| 3. Receipt share via DM | Forward proof-of-vote | Individual UX, not group-native |
| **4. Chat-scoped polls** | **Membership IS the voter roll** | **vohu is unbuildable without World Chat — the integration is structural, not cosmetic** |

The sponsor track is judged on "Best **Use** of World Chat". Pattern 4 is the only option where the app degrades to "broken" without World Chat, not to "inconvenient". That's the strongest possible definition of "use".

---

## 1. What we're building

**Concept**: A World Chat group's membership list is the authoritative voter roll for a proposal scoped to that group.

- Organizer opens vohu, picks a World Chat group they're a member of, creates a proposal.
- vohu stores `proposal.groupId = <XMTP conversationId>`.
- Organizer shares a URL in the group chat (deep link to vohu).
- Any group member who taps the URL:
  - Gets their World ID Orb-verified (Sybil layer).
  - Gets their XMTP identity verified as a member of the specific group (scope layer).
  - Encrypts their ballot with the proposal's Paillier public key.
  - Submits.
- A non-member cannot vote, even if they obtain the URL.
- The aggregate tally is visible to the public / group (configurable); individual votes are never decrypted.

### Key invariants

1. **Double Sybil**: World ID nullifier (unique human) × XMTP group membership (authorized human for this poll). Both must hold.
2. **No exfiltration via URL**: leaking the URL alone does NOT let a non-member vote.
3. **No XMTP identity cost**: the user's World Chat XMTP identity is reused — no new inbox, no second onboarding.

---

## 2. XMTP fundamentals relevant here

From upstream research (`docs.xmtp.org`, `github.com/xmtp/xmtp-js` browser-sdk source):

### 2.1 Inbox vs installation

- Each user has **one Inbox ID** tied to their Ethereum address.
- An Inbox can have multiple **installations** (one per app × device).
- Adding a new installation to an existing inbox requires a one-time signature from the user's wallet.
- **All installations see the same groups**. A Mini App that creates a new installation on the same inbox as the user's World Chat automatically sees the user's World Chat groups.

**Consequence for vohu**: when a user opens vohu, vohu creates a vohu-scoped installation on the user's existing XMTP inbox. vohu can now enumerate the user's groups and check membership — no new inbox, no new identity.

### 2.2 Groups

- `client.conversations.createGroup([inboxIds], { name, description })` — organizer creates.
- `conversation.id` — stable 32-byte hex identifier. Stable across installations of the same inbox.
- `conversation.topic` — `/xmtp/mls/1/g-${conversation.id}/proto`.
- `conversation.members()` — returns all members. This is the API we need.
- Max group size: 250 (plenty for governance use cases).

### 2.3 Signer

The browser SDK expects a signer with:

```ts
interface Signer {
  type: 'EOA' | 'SCW';
  getIdentifier: () => Promise<{ identifier: string; identifierKind: 'Ethereum' | 'Passkey' | ... }>;
  signMessage: (message: string) => Promise<Uint8Array>;
  getChainId?: () => bigint;
  getBlockNumber?: () => bigint;
}
```

**MiniKit walletAuth** gives us:
- `address` — the user's EOA address (via SIWE).
- A signed nonce proving control.

We wrap this into an XMTP signer by implementing `signMessage` via `MiniKit.commandsAsync.signMessage({ message })`. Since MiniKit signs on behalf of the user's wallet, the resulting XMTP inbox Id equals the user's wallet inbox — same as World Chat.

### 2.4 MiniKit launch context

`MiniKit.location` returns a `MiniAppLaunchLocation` enum:

```ts
enum MiniAppLaunchLocation {
  Chat = 'chat',
  Home = 'home',
  AppStore = 'app-store',
  DeepLink = 'deep-link',
  WalletTab = 'wallet-tab',
}
```

So vohu knows **that** it was launched from a chat but **not which specific conversation**. The group ID must therefore be passed in the URL as a query parameter.

### 2.5 MiniKit chat command

`MiniKit.commandsAsync.chat({ message, to? })` opens World Chat with a prefilled draft. The user has to confirm and send. This is good enough for the organizer → group bootstrapping step; no programmatic posting needed.

---

## 3. Architecture

```
───── ORGANIZER SIDE ─────

1. Organizer opens vohu (any launch location).
2. vohu starts XMTP client:
     const signer = miniKitSigner();                         // wraps MiniKit
     const client = await Client.create(signer, { env });
3. vohu lists the organizer's groups:
     const groups = await client.conversations.list();       // all their groups
4. Organizer picks a group → proposal.groupId = group.id
5. Server stores proposal:
     {
       id:        "proposal-xyz",
       groupId:   "a3f8...",          // XMTP conversation id
       title:     "Should we X?",
       options:   ["yes","no","mixed"],
       paillierPublicKey: { n, g },
       paillierPrivateKey: { ... }    // server-held; trustee trust assumption
     }
6. vohu calls:
     MiniKit.chat({
       message: "Vote: https://vohu.vercel.app/vote?p=proposal-xyz",
     });
   Organizer pastes into the target group manually (World Chat draft UI).

───── MEMBER SIDE ─────

7. Member taps URL in group → vohu opens at /vote?p=proposal-xyz.
8. vohu fetches GET /api/proposal?proposalId=proposal-xyz
     → { proposal, publicKey, groupId }
9. vohu starts XMTP client (creates a vohu-scoped installation on the
   member's existing inbox; one-time sig on first use).
10. vohu verifies group membership:
      const group = await client.conversations.getConversationById(groupId);
      const members = await group.members();
      if (!members.some(m => m.inboxId === client.inboxId)) {
        // reject: not a member of this group
      }
11. vohu runs MiniKit.verify() for World ID Orb proof.
12. Paillier-encrypt ballot; POST /api/vote { nullifier, ciphertextVec, xmtpProof }.

───── SERVER ─────

13. Server re-verifies group membership using its own XMTP bot identity:
      const group = await botClient.conversations.getConversationById(proposal.groupId);
      const members = await group.members();
      if (!members.some(m => m.inboxId === submittedInboxId)) {
        return 403;
      }
    (The xmtpProof in the POST body is a server-verifiable attestation —
     see §5 for the exact shape.)
14. Server dedup nullifier, append ciphertextVec.
15. Tally: homomorphic ∏ on ciphertextVec, decrypt aggregate only.
```

---

## 4. The bot identity

The server needs its own XMTP inbox so it can independently query group membership (not trusting the client's claim).

### 4.1 Bot bootstrapping

One-time:
1. Generate an Ethereum private key (server-held).
2. Create an XMTP client with that key as EOA signer.
3. Save inbox Id and keys in server env.

### 4.2 Bot gets added to groups

When the organizer creates a proposal scoped to group G:
1. Server receives `groupId = G`.
2. Server's bot is NOT a member of G yet → `getConversationById` fails.
3. Options:
   - (a) Organizer manually adds the bot to G in World Chat (friction, but simple).
   - (b) vohu auto-adds bot via the organizer's client: `group.addMembers([BOT_INBOX_ID])` at proposal creation time.

We go with **(b)**: vohu's client, acting as the organizer, adds the bot to the group as part of proposal creation. UX-invisible.

### 4.3 Privacy consideration

The bot sees all messages in the group by virtue of membership. This is a trust cost. Options to mitigate:

- **v1**: the bot never reads messages. It only queries `group.members()` at vote-verification time. Document this.
- **v2**: use the "observer" or "spectator" member role if XMTP exposes one. (Needs research.)

---

## 5. `xmtpProof` payload shape

When a member submits a vote, the POST body needs a server-verifiable token that says "this XMTP inbox, right now, is a member of this group".

Since XMTP group membership queries return the member list directly, we don't need cryptographic proof — the server can just re-query. What the server DOES need is a fresh **attribution** of the POST to a specific inbox.

Option A (simplest): the client signs a nonce via MiniKit; the server verifies the signature recovers to the claimed inbox's EOA; then the server checks that inbox Id is in the group's member list.

```jsonc
{
  "proposalId": "proposal-xyz",
  "nullifier":  "0x...",                 // World ID nullifier
  "ciphertextVec": ["...", "...", "..."],
  "attribution": {
    "inboxId": "3b9a...",                // claimed XMTP inbox
    "address": "0x5796...",              // EOA
    "nonce":   "vohu-proposal-xyz-1...", // server-provided nonce; prevents replay
    "signature": "0xabc..."              // sig over nonce
  }
}
```

Server verification:
1. Recover address from signature + nonce.
2. Match address against `attribution.address`.
3. Look up the inbox Id for this address via XMTP SDK; match `attribution.inboxId`.
4. Check `members()` of `proposal.groupId` contains `attribution.inboxId`.
5. Check nullifier not yet seen.
6. Store ciphertextVec, mark nullifier seen.

---

## 6. Implementation phases

Each phase ships a verifiable milestone. Targets assume ~60 hours of focused work remaining.

### X1 — XMTP bot bootstrap (~2h)

- [ ] Generate server-side Ethereum key (env var: `VOHU_BOT_PRIVATE_KEY`).
- [ ] Add `@xmtp/node-sdk` (or `@xmtp/browser-sdk` in a Node-compatible build) server-side.
- [ ] Lazy-init the bot's XMTP client; cache handle.
- [ ] `GET /api/debug/bot-inbox` → returns bot's inbox Id. Smoke test.

**Exit**: a server-only script logs the bot's inbox Id without errors.

### X2 — MiniKit signer for XMTP (~2h)

- [ ] `lib/xmtp-signer.ts`: function `createMiniKitSigner()` that implements `Signer`:
      - `type: 'EOA'`
      - `getIdentifier`: returns the wallet address from `MiniKit.user` or a prior `walletAuth`.
      - `signMessage`: calls `MiniKit.commandsAsync.signMessage({ message })`, returns the signature as `Uint8Array`.
- [ ] `lib/xmtp-client.ts`: lazy XMTP Client.create for the user.

**Exit**: calling `useXmtpClient()` from a client page returns a live Client and logs the user's inbox Id.

### X3 — Organizer flow: pick group (~2h)

- [ ] `app/propose/page.tsx`: lists `client.conversations.list()` filtered to `isGroup()`.
- [ ] User picks a group. Form captures title + options (reuse demo proposal for v1).
- [ ] `POST /api/propose`:
      - server adds bot to the group via organizer client OR via a follow-up step.
      - server stores proposal + groupId + Paillier keypair.
      - returns `{ proposalId, shareUrl }`.
- [ ] Final screen shows a "Share to <Group>" button that calls `MiniKit.chat({ message: shareUrl })`.

**Exit**: an organizer with two test phones can create a proposal scoped to a group that both phones are in, and share the URL.

### X4 — Member flow: verify membership (~2h)

- [ ] `/vote?p=proposalId` route:
      - Fetch `/api/proposal?proposalId=...` → includes `groupId`.
      - Instantiate XMTP client (MiniKit signer).
      - `const group = await client.conversations.getConversationById(groupId)`.
      - `const members = await group.members()`.
      - `if (!members.includes(client.inboxId))` show "not eligible" screen.
- [ ] UI: while XMTP is spinning up, show "Verifying group membership…".

**Exit**: two phones in the group both vote successfully. A third phone (not in the group) is rejected at client-side membership check.

### X5 — Server-side double check (~2h)

- [ ] Build the `attribution` payload on the client.
- [ ] `POST /api/vote` now:
      - Re-verifies signature + address + inbox Id.
      - Re-fetches `group.members()` via bot client.
      - Rejects if inbox Id not in group.

**Exit**: a crafted payload with a valid signature but a spoofed inbox Id is rejected.

### X6 — Polished UI + pitch framing (~2h)

- [ ] `/result` shows "Poll for <group name> · <N> of <M> members voted" — participation rate.
- [ ] Optional end-of-vote trigger: `MiniKit.chat` post of the aggregate to the group.
- [ ] README section "XMTP group scoping" with a diagram.
- [ ] Pitch line: "**vohu is not a vote app that sends chat messages. World Chat is the voter roll. Without the group, there is no poll.**"

**Exit**: demo video shows two-phone flow with member + non-member attempt.

**Total implementation budget**: ~12 hours, fits in the remaining window.

---

## 7. Risks and contingencies

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| XMTP browser SDK doesn't work inside World App's WebView | Medium | High | Fall back to server-side verification only (client doesn't check, server does; UX slightly worse but secure) |
| Installation signature prompt creates friction | High | Low | Show explanation "vohu is creating an XMTP installation — this is a one-time sign" |
| `getConversationById` requires pre-sync | Medium | Medium | Call `client.conversations.sync()` before `getConversationById` |
| Bot-added-by-organizer UX breaks (org didn't approve) | Medium | Medium | Document as "organizer must add bot"; provide a copy-able bot inbox Id in the propose UI |
| World Chat groups in prod aren't the same thing as XMTP groups | Low-Medium | Critical | Validate early: have the organizer join a group in World Chat, then confirm `client.conversations.list()` returns it |
| Mainnet XMTP rate limits | Low | Low | Bot only queries members on POST; cheap |
| MiniKit `signMessage` sig format != XMTP expected | Medium | Medium | May need to strip the `0x` prefix or transform; spike on day 1 |

---

## 8. What we explicitly DO NOT do in v1

- No bot posting into groups programmatically (user confirms every outbound message via MiniKit.chat).
- No threshold Paillier across group admins (single-trustee v1).
- No "one-click bot add" UI if it requires organizer-side friction beyond a single confirm.
- No FHE for the tally (additive HE is enough for 3-option ballot).

---

## 9. Submission story (3-min pitch polish)

### Opening (30s)

> "World Chat has 250-person MLS groups. That's already a natural voting constituency — DAOs, workplaces, communities, you name it. vohu takes that and makes it a secret ballot — you have to be in the group to vote, but nobody in the group, not the organizer, not even us running the app, can see who voted for what."

### Why it's hard without World Chat (15s)

> "Without XMTP, you'd need a separate sign-up flow to enroll voters. With XMTP, your group membership already IS your vote authorization. That's the structural use of World Chat."

### Demo (90s)

- Two phones, both in the same group. One is organizer, one is voter.
- Organizer creates poll, shares to group.
- Voter receives URL, verifies Orb, votes.
- Third phone (not in group): paste the same URL → rejected.
- Aggregate revealed.

### Close (15s)

> "Passkeys guard the front door. Paillier guards the ballot box. And XMTP groups decide who's in the room."

---

## 10. What to research if the plan breaks

- `@xmtp/browser-sdk` source: `sdks/browser-sdk/src/{Conversation,Group,Client}.ts`.
- `docs.xmtp.org/llms/llms-chat-apps.txt` for a compact reference.
- MiniKit types: `@worldcoin/minikit-js` `index.d.ts`.
- If the browser SDK misbehaves in WebView, consider `@xmtp/react-sdk` or a server-proxied membership check.
