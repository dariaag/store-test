import { Database } from "@subsquid/file-store";
import { Dest } from "@subsquid/file-store";

import {
  Column,
  Table,
  Compression,
  Types,
} from "@subsquid/file-store-parquet";
import { S3Dest } from "@subsquid/file-store-s3";

export const dbOptions = {
  tables: {
    PoolTable: new Table(
      "Factory.parquet",
      {
        id: Column(Types.String()),
        token0: Column(Types.String()),
        token1: Column(Types.String()),
      },

      {
        compression: "GZIP",
        rowGroupSize: 300000,
        pageSize: 1000,
      }
    ),
    SwapTable: new Table(
      "Swap.parquet",
      {
        id: Column(Types.String()),
        timestamp: Column(Types.Timestamp()),
        blocknumber: Column(Types.Int64()),
        txHash: Column(Types.String()),
        pool: Column(Types.String()),
        sender: Column(Types.String()),
        recipient: Column(Types.String()),
        amount0: Column(Types.Int64()),
        amount1: Column(Types.Int64()),
      },
      {
        compression: "GZIP",
        rowGroupSize: 300000,
        pageSize: 1000,
      }
    ),
  },
  dest: new S3Dest(
    "./",
    "parquet-test", //assertNotNull(process.env.S3_BUCKET_NAME),
    {
      region: "us-east-1",

      endpoint:
        "https://7a28e49ec5f4a60c66f216392792ac38.r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: "23bc17fc38195e53ca473c041cda2d57", //accessKeyId: assertNotNull(process.env.S3_ACCESS_KEY_ID),
        secretAccessKey:
          "aff576a8c30a23b0c1b4983c9e4c14e6a60560e876dc55a03098ce731bfd6bd3", // secretAccessKey: assertNotNull(process.env.S3_SECRET_ACCESS_KEY)
      },
    }
  ),
  chunkSizeMb: 10,
};
