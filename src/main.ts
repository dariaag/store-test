import { In } from "typeorm";
import { assertNotNull } from "@subsquid/evm-processor";
import { Store, TypeormDatabase } from "@subsquid/typeorm-store";
import * as factoryAbi from "./abi/factory";
import * as poolAbi from "./abi/pool";
import { Pool, Swap } from "./model";
import { Store as Filestore } from "@subsquid/file-store";
import {
  Block,
  Context,
  FACTORY_ADDRESS,
  Log,
  Transaction,
  processor,
} from "./processor";
import { dbOptions } from "./tables";
import { DoubleDB, Tables } from "./doubleDB";
let factoryPools: Set<string>;
let dw = new DoubleDB(dbOptions);
processor.run(dw, async (ctx) => {
  if (!factoryPools) {
    factoryPools = await ctx.store.typeormstore
      .findBy(Pool, {})
      .then((q) => new Set(q.map((i) => i.id)));
  }

  let pools: PoolData[] = [];
  let swaps: SwapEvent[] = [];

  for (let block of ctx.blocks) {
    for (let log of block.logs) {
      if (log.address === FACTORY_ADDRESS) {
        pools.push(getPoolData(log));
      } else if (factoryPools.has(log.address)) {
        swaps.push(getSwap(log));
      }
    }
  }

  await createPools(ctx.store.typeormstore, pools);
  await processSwaps(ctx.store.typeormstore, swaps);
  await createTables(ctx.store.filestore, pools);
});

interface PoolData {
  id: string;
  token0: string;
  token1: string;
}

function getPoolData(log: Log): PoolData {
  let event = factoryAbi.events.PoolCreated.decode(log);

  let id = event.pool.toLowerCase();
  let token0 = event.token0.toLowerCase();
  let token1 = event.token1.toLowerCase();

  //   ctx.log.debug(
  //     { block: log.block },
  //     `Created pool ${id} (${token0}, ${token1})`
  //   );
  return {
    id,
    token0,
    token1,
  };
}
async function createTables(store: Filestore<Tables>, poolsData: PoolData[]) {
  let pools = [];
  for (let p of poolsData) {
    let id = p.id;
    let token0 = p.token0;
    let token1 = p.token1;
    pools.push({ id, token0, token1 });
  }
  store.PoolsTable.writeMany(pools);
}
async function createPools(store: Store, poolsData: PoolData[]) {
  let pools: Pool[] = [];

  for (let p of poolsData) {
    let pool = new Pool(p);
    pools.push(pool);
    factoryPools.add(pool.id);
  }

  await store.insert(pools);
}

interface SwapEvent {
  id: string;
  block: Block;
  transaction: Transaction;
  pool: string;
  amount0: bigint;
  amount1: bigint;
  recipient: string;
  sender: string;
}

function getSwap(log: Log): SwapEvent {
  let transaction = assertNotNull(log.transaction, `Missing transaction`);

  let event = poolAbi.events.Swap.decode(log);

  let pool = log.address;
  let recipient = event.recipient.toLowerCase();
  let sender = event.sender.toLowerCase();

  //   ctx.log.debug(
  //     { block: log.block, txHash: transaction.hash },
  //     `Swap in ${pool} by ${recipient} amounts (${event.amount0}, ${event.amount1})`
  //   );
  return {
    id: log.id,
    block: log.block,
    transaction,
    pool,
    amount0: event.amount0,
    amount1: event.amount1,
    recipient,
    sender,
  };
}

async function processSwaps(store: Store, swapsData: SwapEvent[]) {
  let poolIds = new Set<string>();
  for (let t of swapsData) {
    poolIds.add(t.pool);
  }

  let pools = await store
    .findBy(Pool, { id: In([...poolIds]) })
    .then(toEntityMap);

  let swaps: Swap[] = [];
  for (let s of swapsData) {
    let { id, block, transaction, amount0, amount1, recipient, sender } = s;

    let pool = assertNotNull(pools.get(s.pool));

    swaps.push(
      new Swap({
        id,
        blockNumber: block.height,
        timestamp: new Date(block.timestamp),
        txHash: transaction.hash,
        pool,
        amount0,
        amount1,
        recipient,
        sender,
      })
    );
  }

  await store.insert(swaps);
}

function toEntityMap<E extends { id: string }>(entities: E[]): Map<string, E> {
  return new Map(entities.map((e) => [e.id, e]));
}
