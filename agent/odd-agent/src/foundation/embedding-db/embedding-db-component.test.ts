import { afterEach, describe, expect, it, vi } from "vitest";
import { InMemoryLogger } from "../logger/logger-component.js";
import { FoundationEmbeddingDb } from "./embedding-db-component.js";
import { ChromaEmbeddingDbProvider } from "./embedding-db-provider-chroma.js";
import { MemoryEmbeddingDbProvider } from "./embedding-db-provider-memory.js";
import { MilvusEmbeddingDbProvider } from "./embedding-db-provider-milvus.js";
import { PineconeEmbeddingDbProvider } from "./embedding-db-provider-pinecone.js";
import { QdrantEmbeddingDbProvider } from "./embedding-db-provider-qdrant.js";

const initMemoryEmbeddingDb = async (): Promise<FoundationEmbeddingDb> => {
  const db = new FoundationEmbeddingDb();
  await db.init(
    {
      collectionName: "memory_vectors",
      dimension: 3,
      distance: "cosine",
      topKDefault: 3
    },
    { logger: new InMemoryLogger(), provider: new MemoryEmbeddingDbProvider() }
  );
  return db;
};

describe("FoundationEmbeddingDb", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });
  it("upserts, filters, ranks and deletes vectors", async () => {
    const db = await initMemoryEmbeddingDb();
    await db.upsert({
      userId: "u1",
      id: "a",
      vector: [1, 0, 0],
      content: "alpha",
      metadata: { conversationId: "c1" }
    });
    await db.upsert({
      userId: "u2",
      id: "b",
      vector: [0, 1, 0],
      content: "beta",
      metadata: { conversationId: "c1" }
    });
    const results = await db.search<
      { readonly conversationId: string },
      { readonly userId: string; readonly conversationId: string }
    >({
      vector: [0.9, 0.1, 0],
      userId: "u1",
      filter: { conversationId: "c1" },
      topK: 5
    });

    expect(results.map((item) => item.id)).toEqual(["a"]);
    expect(await db.deleteByFilter("u1", { conversationId: "c1" })).toBe(1);
    expect(
      await db.search({
        vector: [1, 0, 0],
        userId: "u1",
        filter: { conversationId: "c1" },
        topK: 5
      })
    ).toEqual([]);
  });

  it("gets records by id and lists records by metadata filter", async () => {
    const db = await initMemoryEmbeddingDb();
    await db.upsert({
      userId: "u1",
      id: "a",
      vector: [1, 0, 0],
      content: "alpha",
      metadata: { conversationId: "c1", kind: "memory" }
    });
    await db.upsert({
      userId: "u1",
      id: "b",
      vector: [0, 1, 0],
      content: "beta",
      metadata: { conversationId: "c2", kind: "memory" }
    });

    const found = await db.getById<{ readonly kind: string }>({ userId: "u1", id: "a" });
    expect(found?.content).toBe("alpha");
    expect(found?.metadata.kind).toBe("memory");
    await expect(db.getById({ userId: "u2", id: "a" })).resolves.toBeUndefined();

    const listed = await db.list<
      { readonly kind: string },
      { readonly userId: string; readonly kind: string }
    >({
      userId: "u1",
      filter: { kind: "memory" },
      page: 1,
      pageSize: 10
    });
    expect(listed.map((item) => item.id)).toEqual(["a", "b"]);
    expect(listed.every((item) => item.metadata.userId === "u1")).toBe(true);
  });

  it("rejects empty filters and wrong dimensions", async () => {
    const db = await initMemoryEmbeddingDb();
    await expect(
      db.upsert({ userId: "u1", id: "bad", vector: [1, 2], content: "bad", metadata: {} })
    ).rejects.toThrow(/expected dimension 3/);
    await expect(
      db.search({ userId: "u1", vector: [1, 0, 0], filter: {}, topK: 1 })
    ).rejects.toThrow(/requires a non-empty filter/);
  });

  it("fuzzes deterministic vectors without crossing metadata filters", async () => {
    const db = await initMemoryEmbeddingDb();
    for (let index = 0; index < 50; index += 1) {
      await db.upsert({
        userId: index % 2 === 0 ? "even" : "odd",
        id: `doc_${index}`,
        vector: [index + 1, 50 - index, index % 7],
        content: `doc ${index}`,
        metadata: { bucket: index % 5, nested: { kind: index % 3 } }
      });
    }
    const results = await db.search<
      { readonly nested: { readonly kind: number } },
      {
        readonly userId: string;
        readonly bucket: number;
        readonly nested: { readonly kind: number };
      }
    >({
      userId: "even",
      vector: [49, 2, 1],
      filter: { nested: { kind: 0 } },
      topK: 10
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((item) => item.metadata.userId === "even")).toBe(true);
    expect(results.every((item) => item.metadata.nested.kind === 0)).toBe(true);
  });

  it("requires logger for init", async () => {
    const db = new FoundationEmbeddingDb();
    await expect(
      db.init({
        collectionName: "memory_vectors",
        dimension: 3,
        distance: "cosine",
        topKDefault: 3
      })
    ).rejects.toThrow(/requires logger/);
  });

  it("requires an injected provider for init", async () => {
    const db = new FoundationEmbeddingDb();
    const depsWithoutProvider = {
      logger: new InMemoryLogger()
    } as unknown as Parameters<FoundationEmbeddingDb["init"]>[1];
    await expect(
      db.init(
        {
          collectionName: "memory_vectors",
          dimension: 3,
          distance: "cosine",
          topKDefault: 3
        },
        depsWithoutProvider
      )
    ).rejects.toThrow(/requires provider/);
  });

  it("keeps identical ids isolated per user and supports user deletion", async () => {
    const db = await initMemoryEmbeddingDb();
    await db.upsert({
      userId: "u1",
      id: "same",
      vector: [1, 0, 0],
      content: "user one",
      metadata: { kind: "note" }
    });
    await db.upsert({
      userId: "u2",
      id: "same",
      vector: [1, 0, 0],
      content: "user two",
      metadata: { kind: "note" }
    });

    const userOne = await db.search<{ readonly kind: string }, { readonly userId: string }>({
      userId: "u1",
      vector: [1, 0, 0],
      filter: { kind: "note" }
    });
    const userTwo = await db.search<{ readonly kind: string }, { readonly userId: string }>({
      userId: "u2",
      vector: [1, 0, 0],
      filter: { kind: "note" }
    });

    expect(userOne.map((item) => item.content)).toEqual(["user one"]);
    expect(userTwo.map((item) => item.content)).toEqual(["user two"]);
    expect(await db.deleteByUser("u1")).toBe(1);
    expect(await db.search({ userId: "u1", vector: [1, 0, 0], filter: { kind: "note" } })).toEqual(
      []
    );
    expect(
      await db.search({ userId: "u2", vector: [1, 0, 0], filter: { kind: "note" } })
    ).toHaveLength(1);
  });

  it("rejects undefined filter values and oversized payloads", async () => {
    const db = new FoundationEmbeddingDb();
    await db.init(
      {
        collectionName: "memory_vectors",
        dimension: 3,
        distance: "cosine",
        topKDefault: 3,
        maxContentBytes: 4,
        maxMetadataBytes: 16
      },
      { logger: new InMemoryLogger(), provider: new MemoryEmbeddingDbProvider() }
    );

    await expect(
      db.search({ userId: "u1", vector: [1, 0, 0], filter: { bad: undefined }, topK: 1 })
    ).rejects.toThrow(/undefined values/);
    await expect(
      db.upsert({
        userId: "u1",
        id: "large",
        vector: [1, 0, 0],
        content: "too large",
        metadata: {}
      })
    ).rejects.toThrow(/too large/);
  });

  it("uses qdrant provider without falling back to PostgreSQL", async () => {
    const calls: { readonly url: string; readonly init: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
      const url =
        input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url;
      calls.push({ url, init });
      if (url.endsWith("/collections/memory_vectors") && init.method === "GET") {
        return Promise.resolve(
          jsonResponse({
            result: { config: { params: { vectors: { size: 3, distance: "Cosine" } } } }
          })
        );
      }
      if (url.endsWith("/points?wait=true") && init.method === "PUT") {
        return Promise.resolve(jsonResponse({ result: { operation_id: 1, status: "completed" } }));
      }
      if (url.endsWith("/points/search") && init.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            result: [
              {
                id: "point",
                score: 0.98,
                payload: { id: "doc", content: "hello", metadata: { kind: "note", userId: "u1" } }
              }
            ]
          })
        );
      }
      if (url.endsWith("/points/scroll") && init.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            result: {
              points: [
                {
                  id: "point",
                  payload: { id: "doc", content: "hello", metadata: { kind: "note", userId: "u1" } }
                }
              ]
            }
          })
        );
      }
      if (url.endsWith("/points") && init.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            result: [
              {
                id: "point",
                payload: { id: "doc", content: "hello", metadata: { kind: "note", userId: "u1" } }
              }
            ]
          })
        );
      }
      if (url.endsWith("/points/delete?wait=true") && init.method === "POST") {
        return Promise.resolve(jsonResponse({ result: { operation_id: 2, status: "completed" } }));
      }
      return Promise.resolve(jsonResponse({ result: {} }));
    });

    const db = new FoundationEmbeddingDb();
    await db.init(
      {
        collectionName: "memory_vectors",
        dimension: 3,
        distance: "cosine",
        topKDefault: 3
      },
      {
        logger: new InMemoryLogger(),
        provider: new QdrantEmbeddingDbProvider({ endpoint: "http://127.0.0.1:6333" })
      }
    );
    await db.upsert({
      userId: "u1",
      id: "doc",
      vector: [1, 0, 0],
      content: "hello",
      metadata: { kind: "note" }
    });
    expect(
      await db.search<{ readonly kind: string }, { readonly kind: string }>({
        userId: "u1",
        vector: [1, 0, 0],
        filter: { kind: "note" }
      })
    ).toEqual([
      { id: "doc", content: "hello", metadata: { kind: "note", userId: "u1" }, score: 0.98 }
    ]);
    expect((await db.getById({ userId: "u1", id: "doc" }))?.content).toBe("hello");
    expect(
      await db.list({ userId: "u1", filter: { kind: "note" }, page: 1, pageSize: 10 })
    ).toHaveLength(1);
    expect(await db.deleteByFilter("u1", { kind: "note" })).toBe(1);

    expect(calls.some((call) => call.url.includes("/points/search"))).toBe(true);
    expect(calls.some((call) => call.url.includes("/points?wait=true"))).toBe(true);
  });

  it("ships separate provider classes for milvus, pinecone, and chroma", () => {
    expect(new MilvusEmbeddingDbProvider({ endpoint: "http://127.0.0.1:19530" }).name).toBe(
      "milvus"
    );
    expect(
      new PineconeEmbeddingDbProvider({
        endpoint: "https://example.svc.pinecone.io",
        apiKeySecretRef: "PINECONE_KEY"
      }).name
    ).toBe("pinecone");
    expect(new ChromaEmbeddingDbProvider({ endpoint: "http://127.0.0.1:8000" }).name).toBe(
      "chroma"
    );
  });

  it("uses milvus provider request flow", async () => {
    const calls: { readonly url: string; readonly init: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
      const url =
        input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url;
      calls.push({ url, init });
      if (url.endsWith("/collections/list")) {
        return Promise.resolve(jsonResponse({ code: 0, data: [] }));
      }
      if (url.endsWith("/entities/search")) {
        return Promise.resolve(
          jsonResponse({
            code: 0,
            data: [{ originalId: "doc", content: "hello", metadata: { kind: "note" }, score: 0.8 }]
          })
        );
      }
      if (url.endsWith("/entities/query")) {
        return Promise.resolve(
          jsonResponse({
            code: 0,
            data: [{ id: "provider-id", originalId: "doc", content: "hello", metadata: {} }]
          })
        );
      }
      return Promise.resolve(jsonResponse({ code: 0, data: [] }));
    });

    const db = new FoundationEmbeddingDb();
    await db.init(
      { collectionName: "memory_vectors", dimension: 3, distance: "cosine", topKDefault: 3 },
      {
        logger: new InMemoryLogger(),
        provider: new MilvusEmbeddingDbProvider({ endpoint: "http://milvus" })
      }
    );
    await db.upsert({
      userId: "u1",
      id: "doc",
      vector: [1, 0, 0],
      content: "hello",
      metadata: { kind: "note" }
    });
    await expect(
      db.search<{ readonly kind: string }, { readonly kind: string }>({
        userId: "u1",
        vector: [1, 0, 0],
        filter: { kind: "note" }
      })
    ).resolves.toHaveLength(1);
    await expect(db.getById({ userId: "u1", id: "doc" })).resolves.toMatchObject({ id: "doc" });
    await expect(db.deleteByUser("u1")).resolves.toBe(1);
    expect(calls.some((call) => call.url.includes("/entities/upsert"))).toBe(true);
    expect(calls.some((call) => call.url.includes("/entities/delete"))).toBe(true);
  });

  it("uses pinecone provider request flow", async () => {
    const calls: { readonly url: string; readonly init: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
      const url =
        input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url;
      calls.push({ url, init });
      if (url.endsWith("/query")) {
        return Promise.resolve(
          jsonResponse({
            matches: [
              {
                id: "provider-id",
                score: 0.9,
                metadata: {
                  originalId: "doc",
                  content: "hello",
                  metadataJson: JSON.stringify({ kind: "note" })
                }
              }
            ]
          })
        );
      }
      if (url.includes("/vectors/fetch?")) {
        return Promise.resolve(
          jsonResponse({
            vectors: {
              "provider-id": {
                id: "provider-id",
                metadata: {
                  originalId: "doc",
                  content: "hello",
                  metadataJson: JSON.stringify({ kind: "note" })
                }
              }
            }
          })
        );
      }
      if (url.endsWith("/vectors/fetch_by_metadata")) {
        return Promise.resolve(jsonResponse({ vectors: {} }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    const db = new FoundationEmbeddingDb();
    await db.init(
      { collectionName: "memory_vectors", dimension: 3, distance: "cosine", topKDefault: 3 },
      {
        logger: new InMemoryLogger(),
        provider: new PineconeEmbeddingDbProvider({
          endpoint: "https://pinecone",
          apiKeySecretRef: "PINECONE_KEY"
        }),
        secretProvider: { getSecret: () => Promise.resolve("pinecone-key") }
      }
    );
    await db.upsert({
      userId: "u1",
      id: "doc",
      vector: [1, 0, 0],
      content: "hello",
      metadata: { kind: "note" }
    });
    await expect(
      db.search({ userId: "u1", vector: [1, 0, 0], filter: { kind: "note" } })
    ).resolves.toHaveLength(1);
    await expect(db.list({ userId: "u1", filter: { kind: "note" } })).resolves.toHaveLength(0);
    await expect(db.deleteByFilter("u1", { kind: "note" })).resolves.toBe(0);
    expect(calls.some((call) => call.url.includes("/vectors/upsert"))).toBe(true);
    const pineconeBodies = calls.flatMap((call): readonly { readonly namespace?: unknown }[] => {
      if (typeof call.init.body !== "string") {
        return [];
      }
      const parsed = JSON.parse(call.init.body) as unknown;
      return typeof parsed === "object" && parsed !== null ? [parsed] : [];
    });
    expect(
      pineconeBodies.every(
        (body) => body.namespace === undefined || body.namespace === "memory_vectors"
      )
    ).toBe(true);
    expect(
      calls
        .filter((call) => call.url.includes("/vectors/fetch?"))
        .every((call) => new URL(call.url).searchParams.get("namespace") === "memory_vectors")
    ).toBe(true);
    expect(calls.some((call) => call.url.includes("/vectors/delete"))).toBe(false);
  });

  it("uses chroma provider request flow", async () => {
    const calls: { readonly url: string; readonly init: RequestInit }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((input, init = {}) => {
      const url =
        input instanceof URL ? input.toString() : typeof input === "string" ? input : input.url;
      calls.push({ url, init });
      if (url.endsWith("/query")) {
        return Promise.resolve(
          jsonResponse({
            ids: [["provider-id"]],
            documents: [["hello"]],
            metadatas: [[{ originalId: "doc", metadataJson: JSON.stringify({ kind: "note" }) }]],
            distances: [[0.1]]
          })
        );
      }
      if (url.endsWith("/get")) {
        return Promise.resolve(
          jsonResponse({
            ids: ["provider-id"],
            documents: ["hello"],
            metadatas: [{ originalId: "doc", metadataJson: JSON.stringify({ kind: "note" }) }]
          })
        );
      }
      if (url.endsWith("/api/v1/collections")) {
        return Promise.resolve(jsonResponse({ id: "collection-uuid", name: "memory_vectors" }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    const db = new FoundationEmbeddingDb();
    await db.init(
      { collectionName: "memory_vectors", dimension: 3, distance: "cosine", topKDefault: 3 },
      {
        logger: new InMemoryLogger(),
        provider: new ChromaEmbeddingDbProvider({ endpoint: "http://chroma" })
      }
    );
    await db.upsert({
      userId: "u1",
      id: "doc",
      vector: [1, 0, 0],
      content: "hello",
      metadata: { kind: "note" }
    });
    await expect(
      db.search({ userId: "u1", vector: [1, 0, 0], filter: { kind: "note" } })
    ).resolves.toHaveLength(1);
    await expect(db.getById({ userId: "u1", id: "doc" })).resolves.toMatchObject({ id: "doc" });
    await expect(db.deleteByUser("u1")).resolves.toBe(1);
    expect(calls.some((call) => call.url.includes("/add"))).toBe(true);
    expect(calls.some((call) => call.url.includes("/delete"))).toBe(true);
  });
});

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
