import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";

const client = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });

const VALIDATION_ABI = [
  {
    inputs: [{ name: "agentId", type: "uint256" }],
    name: "getAgentValidations",
    outputs: [{ type: "bytes32[]" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "requestHash", type: "bytes32" }],
    name: "getValidationStatus",
    outputs: [
      { name: "validatorAddress", type: "address" },
      { name: "agentId", type: "uint256" },
      { name: "response", type: "uint8" },
      { name: "responseHash", type: "bytes32" },
      { name: "tag", type: "string" },
      { name: "lastUpdate", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ADDR = "0x8004cc8439f36fd5f9f049d9ff86523df6daab58" as const;
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

async function main() {
  // Check which top agents have validations
  const agentIds = [1, 2, 132, 1853, 1859, 1862, 1863, 1869, 1870, 1873, 1874, 1875, 2335, 2807];

  for (const id of agentIds) {
    const hashes = await client.readContract({
      address: ADDR,
      abi: VALIDATION_ABI,
      functionName: "getAgentValidations",
      args: [BigInt(id)],
    });
    if (hashes.length > 0) {
      console.log(`\nAgent #${id}: ${hashes.length} validations`);
      // Read first few
      for (const hash of hashes.slice(0, 3)) {
        const [validator, , response, responseHash, tag, lastUpdate] = await client.readContract({
          address: ADDR,
          abi: VALIDATION_ABI,
          functionName: "getValidationStatus",
          args: [hash],
        });
        const hasResp = responseHash !== ZERO_HASH;
        const date = new Date(Number(lastUpdate) * 1000).toISOString().slice(0, 10);
        console.log(`  v=${validator.slice(0, 10)}... resp=${response}/100 tag="${tag}" responded=${hasResp} date=${date}`);
      }
      if (hashes.length > 3) console.log(`  ... and ${hashes.length - 3} more`);
    }
  }
}

main().catch(e => console.error(e.message));
