import {
  makeSTXTokenTransfer,
  broadcastTransaction,
  AnchorMode,
} from "@stacks/transactions";
import { StacksNetworkName, StacksTestnet } from "@stacks/network";
import {
  DevnetNetworkOrchestrator,
  StacksBlockMetadata,
  StacksChainUpdate,
  StacksTransactionMetadata,
  getIsolatedNetworkConfigUsingNetworkId,
} from "@hirosystems/stacks-devnet-js";
import { describe, expect, it, beforeAll, afterAll, assert } from "vitest";
import BigNum from "bn.js";

describe("Full end to end integration tests made simple", () => {
  let orchestrator: DevnetNetworkOrchestrator;

  beforeAll(async (ctx) => {
    orchestrator = buildDevnetNetworkOrchestrator(1);
    orchestrator.start();
  });

  afterAll(() => {
    orchestrator.terminate();
  });

  it("submitting stacks-stx through pox-1 contract during epoch 2.0 should succeed", async () => {
    // Let's wait for our Genesis block
    let block = await orchestrator.waitForNextStacksBlock();
    block = await orchestrator.waitForNextStacksBlock();
    block = await orchestrator.waitForNextStacksBlock();
    block = await orchestrator.waitForNextStacksBlock();
    block = await orchestrator.waitForNextStacksBlock();
    console.log("5 blocks mined");
    const network: StacksNetworkName = "devnet";
    // Build a transaction
    const txOptions = {
      recipient: "ST1SJ3DTE5DN7X54YDH5D64R3BCB6A2AG2ZQ8YPD5",
      amount: new BigNum(12345),
      senderKey:
        "753b7cc01a1a2e86221266a154af739463fce51219d97e4f856cd7200c3bd2a601",
      network,
      memo: "test memo",
      nonce: new BigNum(0), // set a nonce manually if you don't want builder to fetch from a Stacks node
      fee: new BigNum(200), // set a tx fee if you don't want the builder to estimate
      anchorMode: AnchorMode.OnChainOnly,
    };
    const transaction = await makeSTXTokenTransfer(txOptions);

    // Broadcast transaction to our Devnet stacks node
    const tx_result = await broadcastTransaction(transaction, network);
    console.log("tx result", tx_result);
    // Wait for the next block
    block = await orchestrator.waitForNextStacksBlock();
    const found = block.new_blocks.some((b) => {
      return b.block.transactions.some((t) => {
        console.log(t.transaction_identifier.hash);
        return t.transaction_identifier.hash === `0x${tx_result.txid}`;
      });
    });
    assert(found);
    // Ensure that the transaction was included in the block
    console.log(`Next Block: ${JSON.stringify(block)}`);
  });
}, 60000);

const DEVNET_DEFAULT_EPOCH_2_0 = 100;
const DEVNET_DEFAULT_EPOCH_2_05 = 102;
const DEVNET_DEFAULT_EPOCH_2_1 = 106;
const DEVNET_DEFAULT_POX_2_ACTIVATION = 110;
const DEVNET_DEFAULT_EPOCH_2_2 = 122;
const DEVNET_DEFAULT_EPOCH_2_3 = 128;
const DEVNET_DEFAULT_EPOCH_2_4 = 134;
const BITCOIN_BLOCK_TIME = 10_000;
const DEFAULT_EPOCH_TIMELINE = {
  epoch_2_0: DEVNET_DEFAULT_EPOCH_2_0,
  epoch_2_05: DEVNET_DEFAULT_EPOCH_2_05,
  epoch_2_1: DEVNET_DEFAULT_EPOCH_2_1,
  pox_2_activation: DEVNET_DEFAULT_POX_2_ACTIVATION,
  epoch_2_2: DEVNET_DEFAULT_EPOCH_2_2,
  epoch_2_3: DEVNET_DEFAULT_EPOCH_2_3,
  epoch_2_4: DEVNET_DEFAULT_EPOCH_2_4,
};
interface EpochTimeline {
  epoch_2_0?: number;
  epoch_2_05?: number;
  epoch_2_1?: number;
  pox_2_activation?: number;
  epoch_2_2?: number;
  epoch_2_3?: number;
  epoch_2_4?: number;
}
const FAST_FORWARD_TO_EPOCH_2_4 = {
  epoch_2_0: 100,
  epoch_2_05: 102,
  epoch_2_1: 104,
  pox_2_activation: 105,
  epoch_2_2: 106,
  epoch_2_3: 108,
  epoch_2_4: 112,
};
function buildDevnetNetworkOrchestrator(
  networkId: number,
  timeline: EpochTimeline = DEFAULT_EPOCH_TIMELINE,
  logs = true,
  stacks_node_image_url?: string
) {
  let uuid = Date.now();
  let working_dir = `/tmp/stacks-test-${uuid}-${networkId}`;
  // Set the stacks-node image URL to the default image for the version if it's
  // not explicitly set
  if (stacks_node_image_url === undefined) {
    stacks_node_image_url = process.env.CUSTOM_STACKS_NODE;
  }
  let config = {
    logs,
    devnet: {
      name: `ephemeral-devnet-${uuid}`,
      bitcoin_controller_automining_disabled: false,
      bitcoin_node_p2p_port: 18444,
      bitcoin_node_rpc_port: 18443,
      stacks_node_p2p_port: 20444,
      stacks_node_rpc_port: 20443,
      orchestrator_port: 20445,
      //orchestrator_control_port: 20446,
      stacks_api_port: 3999,
      stacks_api_events_port: 3700,
      postgres_port: 5432,
      stacks_explorer_port: 8000,
      bitcoin_explorer_port: 8001,
      working_dir,
      use_docker_gateway_routing: false,
      disable_stacks_api: false,
    },
  };
  let consolidatedConfig = getIsolatedNetworkConfigUsingNetworkId(
    networkId,
    config
  );
  console.log(consolidatedConfig);
  let orchestrator = new DevnetNetworkOrchestrator(consolidatedConfig, 2500);
  return orchestrator;
}
