import type { Db } from "mongodb";
import type { Homepage } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import { MongoBlockPageStore, type BlockPageStore, type StoredBlockPage } from "../pages/repository.ts";

/* The organization's homepage — ONE document per organization in
   `homepages`; the block-page store (modules/pages) does the work. */

export type StoredHomepage = StoredBlockPage<Homepage>;
export type HomepageStore = BlockPageStore<Homepage>;

export class MongoHomepageStore extends MongoBlockPageStore<Homepage> {
  constructor(db: Db, orgId: string) {
    super(db, COLLECTIONS.homepages, orgId);
  }
}
