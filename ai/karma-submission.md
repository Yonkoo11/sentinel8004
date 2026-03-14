# Karma Gap Submission - Sentinel8004

## Name
Sentinel8004

## Description
Sentinel8004 scores every agent on Celo's ERC-8004 IdentityRegistry. It runs 5 checks per agent (metadata quality, endpoint liveness, wallet history, Sybil patterns, existing reputation), produces a 0-100 trust score, and writes it on-chain to the ReputationRegistry. 1,852 attestations live on mainnet right now. Other agents can query scores via MCP, humans can browse them on the dashboard.

## Problem
I started building this after looking at the IdentityRegistry and realizing there's no filter. Anyone can register an agent, and they do. One address registered 500+ copies of the same agent with identical metadata. Agents list endpoints that return 404. Some have "YOUR_USER/YOUR_REPO" as their metadata. There are 1,853 agents on the registry and most of them are junk. If you're an app or another agent trying to decide who to interact with, you're on your own.

## Solution
Sentinel8004 pulls every agent from the IdentityRegistry, parses their metadata (which comes in 5 different formats - gzip-base64, plain base64, IPFS CIDs, HTTP URLs, and raw JSON), and runs each one through 5 scoring layers:

- Registration: does the metadata actually have a name, description, services? Or is it a placeholder?
- Liveness: do the declared endpoints respond?
- On-chain: does the owner wallet have real transaction history, or was it created yesterday?
- Sybil: did this address register 50+ agents? Is the metadata identical to its siblings?
- Reputation: what do other ReputationRegistry participants say about this agent?

Circuit breakers cap the final score when hard red flags fire. A mass registrar can't score above 15 no matter how good their metadata looks. This matters because without it, spammers just copy a legitimate agent's metadata and score high.

Every score gets written to the ReputationRegistry via `giveFeedback()` with tag1="agentguard" and tag2="trust-v2" (the on-chain tag predates the rename to Sentinel8004; attestations are immutable once written). An MCP server exposes three tools so other AI agents can query trust data without parsing the chain themselves. A static dashboard lets humans search, filter, and inspect any agent.

Sentinel8004 is registered as agent #1853 on the IdentityRegistry. It can't score itself because the contract blocks self-feedback - which is the correct design.

---

## Social Accounts (tab 2)
- GitHub: https://github.com/Yonkoo11/sentinel8004
- Website: https://yonkoo11.github.io/sentinel8004/

## Project Stage (tab 3)
- Stage: Live / Mainnet
- 1,852 on-chain attestations written to ReputationRegistry
- Dashboard deployed on GitHub Pages
- MCP server functional

## Links to include anywhere relevant
- Dashboard: https://yonkoo11.github.io/sentinel8004/
- ReputationRegistry on CeloScan: https://celoscan.io/address/0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
- Agent #1853 registration TX: https://celoscan.io/tx/0x336764f2c9fd6d125ce57009b4fa04fa65d9794c36366b630b2a0108b0a0e47f
- Agent #1853 metadata update TX: https://celoscan.io/tx/0x947185526ae3f791babd118abb3a2b068d38548ca16c133fb16c5880dc3de8b7
- GitHub: https://github.com/Yonkoo11/sentinel8004

---

## X Post Draft

Built Sentinel8004 for the Build Agents V2 hackathon.

It scans all 1,853 agents on Celo's ERC-8004 IdentityRegistry, scores them across 5 layers, and writes trust attestations on-chain. Found that 97.7% of registered agents are spam or dead.

1,852 scores live on the ReputationRegistry now.

Dashboard: https://yonkoo11.github.io/sentinel8004/
Code: https://github.com/Yonkoo11/sentinel8004

@Celo @CeloDevs @CeloPublicGoods
