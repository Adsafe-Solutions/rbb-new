import type { Collection, Db, ObjectId } from "mongodb";
import type { FormDefinition } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";

/* The website forms as saved in the admin — one document per form per
   organization (`form_definitions`). A form that was never saved has no
   document: the website and the API use their built-in form. */

export interface FormDefinitionStore {
  list(): Promise<FormDefinition[]>;
  get(id: string): Promise<FormDefinition | null>;
  save(definition: FormDefinition): Promise<void>;
  remove(id: string): Promise<boolean>;
}

type FormDefinitionDocument = { _id?: ObjectId; orgId: string; formId: string; definition: FormDefinition };

export class MongoFormDefinitionStore implements FormDefinitionStore {
  readonly #collection: Collection<FormDefinitionDocument>;
  readonly #orgId: string;

  constructor(db: Db, orgId: string) {
    this.#collection = db.collection<FormDefinitionDocument>(COLLECTIONS.formDefinitions);
    this.#orgId = orgId;
  }

  async list() {
    const docs = await this.#collection.find({ orgId: this.#orgId }).sort({ formId: 1 }).toArray();
    return docs.map((d) => d.definition);
  }

  async get(id: string) {
    return (await this.#collection.findOne({ orgId: this.#orgId, formId: id }))?.definition ?? null;
  }

  async save(definition: FormDefinition) {
    await this.#collection.updateOne({ orgId: this.#orgId, formId: definition.id }, { $set: { orgId: this.#orgId, formId: definition.id, definition } }, { upsert: true });
  }

  async remove(id: string) {
    return (await this.#collection.deleteOne({ orgId: this.#orgId, formId: id })).deletedCount === 1;
  }
}
