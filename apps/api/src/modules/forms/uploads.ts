import { randomUUID } from "node:crypto";
import type { Collection, Db, ObjectId } from "mongodb";
import { FILE_TYPES, MAX_FILE_BYTES, type FormDefinition } from "@rbb/content-schema";
import { COLLECTIONS } from "../../db/collections.ts";
import { errors } from "../../errors.ts";
import type { Logger } from "../../logging/logger.ts";
import type { ThrottleStore } from "../auth/repository.ts";
import { pseudonym } from "../auth/tokens.ts";
import type { ObjectStorage } from "../media/storage.ts";

/* Files a visitor attaches to a career application (2026-10-13).

   The bytes go through the API (at most 4 MB — under the host's request
   limit) into the media bucket under a PRIVATE prefix,
   `private/forms/<org>/<random id>`: never given a public URL, read only
   through a short-lived signed link an owner asks for. What a file is is
   decided by its first bytes (PDF, Word .doc, Word .docx), never by its
   name or the browser's word. Each upload is for one form's file field
   and is claimed by at most one submission; unclaimed ones are removed
   by cleanup. Uploads are rate limited per client like submissions. */

export interface FormUpload {
  id: string;
  orgId: string;
  formId: string;
  fieldId: string;
  key: string;
  name: string;
  size: number;
  contentType: string;
  createdAt: string;
  /* The submission that claimed it, or null. */
  usedBy: string | null;
}

export interface FormUploadStore {
  insert(upload: FormUpload): Promise<void>;
  get(id: string): Promise<FormUpload | null>;
  /* Claims each unclaimed upload for a submission; false if any is gone or taken. */
  claim(ids: string[], submissionId: string): Promise<boolean>;
  listUnclaimedBefore(before: string, limit: number): Promise<FormUpload[]>;
  remove(id: string): Promise<void>;
}

const MAGIC: [string, number[]][] = [
  ["application/pdf", [0x25, 0x50, 0x44, 0x46, 0x2d]],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [0x50, 0x4b, 0x03, 0x04]],
  ["application/msword", [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]],
];
const EXTENSION: Record<string, string> = { "application/pdf": "pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx", "application/msword": "doc" };

/* What the file really is, from its first bytes — or null. */
export function sniffDocument(bytes: Uint8Array): string | null {
  for (const [type, magic] of MAGIC) if (magic.every((b, i) => bytes[i] === b)) return type;
  return null;
}

/* A safe display name: the base name, no control or path characters, with
   the real type's extension, at most 120 characters. */
export function safeFileName(raw: string | null, type: string): string {
  let name = (raw ?? "").replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "").trim();
  name = name.replace(/\.[A-Za-z0-9]{1,5}$/, "").slice(0, 100) || "document";
  return `${name}.${EXTENSION[type]}`;
}

export class FormUploadService {
  readonly #store: FormUploadStore;
  readonly #storage: ObjectStorage | null;
  readonly #throttle: ThrottleStore;
  readonly #options: { orgId: string; env: string; secret: string; log: Logger; now?: () => Date; rateLimit?: { max: number; windowMs: number } };

  constructor(store: FormUploadStore, storage: ObjectStorage | null, throttle: ThrottleStore, options: { orgId: string; env: string; secret: string; log: Logger; now?: () => Date; rateLimit?: { max: number; windowMs: number } }) {
    this.#store = store;
    this.#storage = storage;
    this.#throttle = throttle;
    this.#options = options;
  }

  #now() {
    return this.#options.now?.() ?? new Date();
  }

  async accept(definition: FormDefinition | null, fieldId: string, bytes: Uint8Array, fileName: string | null, clientIp: string | null): Promise<{ id: string; name: string; size: number }> {
    const field = definition?.fields.find((f) => f.id === fieldId && f.type === "file");
    if (!definition || !field) throw errors.notFound("upload field");
    if (!this.#storage?.putObject) throw errors.unavailable("Uploads are not available at the moment.");
    await this.#rateLimit(definition.id, clientIp);
    if (bytes.byteLength === 0) throw errors.validation([{ path: "body", message: "the file is empty" }]);
    if (bytes.byteLength > MAX_FILE_BYTES) throw errors.payloadTooLarge(MAX_FILE_BYTES);
    const type = sniffDocument(bytes);
    if (!type || !Object.hasOwn(FILE_TYPES, type)) throw errors.unsupportedMediaType("Only PDF and Word documents can be attached.");
    const id = randomUUID();
    const { env, orgId } = this.#options;
    const key = `${env === "production" ? "" : `_${env}/`}private/forms/${orgId}/${id}`;
    try {
      await this.#storage.putObject(key, bytes, type);
    } catch {
      this.#options.log.error("form upload could not be stored", { form: definition.id, field: fieldId });
      throw errors.unavailable("The file could not be uploaded. Please try again.");
    }
    const name = safeFileName(fileName, type);
    await this.#store.insert({ id, orgId, formId: definition.id, fieldId, key, name, size: bytes.byteLength, contentType: type, createdAt: this.#now().toISOString(), usedBy: null });
    return { id, name, size: bytes.byteLength };
  }

  async #rateLimit(formId: string, clientIp: string | null) {
    const { max, windowMs } = this.#options.rateLimit ?? { max: 10, windowMs: 600_000 };
    const now = this.#now().getTime();
    const index = Math.floor(now / windowMs);
    const client = pseudonym(this.#options.secret, `form-upload:${this.#options.orgId}:${clientIp ?? "unknown"}`);
    const count = await this.#throttle.hit(`upload:${client}:${formId}:${index}`, new Date((index + 2) * windowMs));
    if (count > max) throw errors.rateLimited(Math.max(1, Math.ceil(((index + 1) * windowMs - now) / 1000)));
  }

  /* The uploads a submission names: each for this form and its field, not
     yet claimed. Returns them in field order, or a field code per problem. */
  async resolve(formId: string, files: Record<string, string>): Promise<{ uploads: (FormUpload & { fieldId: string })[]; problems: Record<string, "invalid"> }> {
    const uploads: (FormUpload & { fieldId: string })[] = [];
    const problems: Record<string, "invalid"> = {};
    for (const [fieldId, id] of Object.entries(files)) {
      const upload = await this.#store.get(id);
      if (!upload || upload.formId !== formId || upload.fieldId !== fieldId || upload.usedBy) problems[fieldId] = "invalid";
      else uploads.push(upload);
    }
    return { uploads, problems };
  }

  claim(ids: string[], submissionId: string) {
    return this.#store.claim(ids, submissionId);
  }

  /* Unclaimed uploads older than a day: the object, then the record. */
  async cleanup(limit = 200): Promise<number> {
    const before = new Date(this.#now().getTime() - 86_400_000).toISOString();
    const stale = await this.#store.listUnclaimedBefore(before, limit);
    for (const u of stale) {
      await this.#storage?.delete(u.key);
      await this.#store.remove(u.id);
    }
    return stale.length;
  }
}

type UploadDocument = Omit<FormUpload, "createdAt"> & { _id?: ObjectId; createdAt: Date };

export class MongoFormUploadStore implements FormUploadStore {
  readonly #collection: Collection<UploadDocument>;
  readonly #orgId: string;

  constructor(db: Db, orgId: string) {
    this.#collection = db.collection<UploadDocument>(COLLECTIONS.formUploads);
    this.#orgId = orgId;
  }

  async insert(u: FormUpload) {
    await this.#collection.insertOne({ ...u, orgId: this.#orgId, createdAt: new Date(u.createdAt) });
  }

  async get(id: string) {
    const doc = await this.#collection.findOne({ orgId: this.#orgId, id });
    if (!doc) return null;
    const { _id, createdAt, ...rest } = doc;
    return { ...rest, createdAt: createdAt.toISOString() };
  }

  async claim(ids: string[], submissionId: string) {
    if (!ids.length) return true;
    const result = await this.#collection.updateMany({ orgId: this.#orgId, id: { $in: ids }, usedBy: null }, { $set: { usedBy: submissionId } });
    return result.modifiedCount === ids.length;
  }

  async listUnclaimedBefore(before: string, limit: number) {
    const docs = await this.#collection.find({ orgId: this.#orgId, usedBy: null, createdAt: { $lt: new Date(before) } }).limit(limit).toArray();
    return docs.map(({ _id, createdAt, ...rest }) => ({ ...rest, createdAt: createdAt.toISOString() }));
  }

  async remove(id: string) {
    await this.#collection.deleteOne({ orgId: this.#orgId, id });
  }
}
