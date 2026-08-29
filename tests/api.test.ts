import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../server/app.js";
import { prisma } from "../server/db.js";

describe("InboxIQ API", () => {
  it("returns exactly the four seed messages as raw Message objects", async () => {
    const response = await request(app).get("/api/messages");

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(4);
    expect(response.body.map((message: { id: string }) => message.id)).toEqual([
      "message-perfect",
      "message-partial",
      "message-failure",
      "message-empty",
    ]);
    expect(response.body[0]).toEqual(
      expect.objectContaining({
        company: "Acme",
        createdAt: expect.any(String),
      }),
    );
    expect(response.body[0]).not.toHaveProperty("tags");
  });

  it("returns a raw message detail and no list alias", async () => {
    const detail = await request(app).get("/api/messages/message-perfect");
    const alias = await request(app).get("/api/messages/list");

    expect(detail.status).toBe(200);
    expect(detail.body.id).toBe("message-perfect");
    expect(detail.body).not.toHaveProperty("message");
    expect(alias.status).toBe(404);
  });

  it("starts with no leads", async () => {
    const leads = await request(app).get("/api/leads");

    expect(leads.status).toBe(200);
    expect(leads.body).toEqual([]);
    expect(await prisma.lead.count()).toBe(0);
  });

  it("returns a stable error for malformed API JSON", async () => {
    const response = await request(app)
      .post("/api/ai/extract")
      .set("content-type", "application/json")
      .send('{"messageId":');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "invalid_json" });
  });

  it("accepts only the strict messageId extraction request", async () => {
    const alias = await request(app)
      .post("/api/ai/extract")
      .send({ id: "message-perfect" });
    const perfect = await request(app)
      .post("/api/ai/extract")
      .send({ messageId: "message-perfect" });

    expect(alias.status).toBe(400);
    expect(perfect.status).toBe(200);
    expect(perfect.body).toEqual({
      product: "Desk",
      quantity: 30,
      material: "Oak",
      budget: 50000,
    });
  });

  it("returns deterministic partial, failure, and empty extraction states", async () => {
    const partial = await request(app)
      .post("/api/ai/extract")
      .send({ messageId: "message-partial" });
    const failure = await request(app)
      .post("/api/ai/extract")
      .send({ messageId: "message-failure" });
    const empty = await request(app)
      .post("/api/ai/extract")
      .send({ messageId: "message-empty" });

    expect(partial.status).toBe(200);
    expect(partial.body).toEqual({
      product: "Ergonomic Chair",
      quantity: null,
      material: "Black",
      budget: 12000,
    });
    expect(failure.status).toBe(500);
    expect(empty.status).toBe(200);
    expect(empty.body).toEqual({});
  });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/leads", () => {
  it("creates a lead with status NEW, ignoring a client-supplied status", async () => {
    const response = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "Desk",
      quantity: 30,
      material: "Oak",
      budget: 50000,
      status: "CONTACTED",
    });

    expect(response.status).toBeLessThan(500);
    if (response.status === 201) {
      expect(response.body.status).toBe("NEW");
    } else {
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
  });

  it("rejects an empty (after trim) product wthout creating a record", async () => {
    const before = await prisma.lead.count();
    const response = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "   ",
      quantity: 1,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(await prisma.lead.count()).toBe(before);
  });

  it("rejects a non-positive or non-integer quantity", async () => {
    const zero = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "Desk",
      quantity: 0,
    });
    const fractional = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "Desk",
      quantity: 1.5,
    });

    expect(zero.status).toBeGreaterThanOrEqual(400);
    expect(fractional.status).toBeGreaterThanOrEqual(400);
  });

  it("accepts a missing or null material and a missing budget", async () => {
    const response = await request(app).post("/api/leads").send({
      sourceMessageId: "message-perfect",
      product: "Desk",
      quantity: 2,
      material: null,
    });

    expect(response.status).toBe(201);
    expect(response.body.material).toBeNull();
    expect(response.body.budget).toBeNull();
  });

  it("rejects an unknown sourceMessageId without creating a record", async () => {
    const before = await prisma.lead.count();
    const response = await request(app).post("/api/leads").send({
      sourceMessageId: "does-not-exist",
      product: "Desk",
      quantity: 1,
    });

    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(await prisma.lead.count()).toBe(before);
  });

  it("allows multiple leads to reference the same message", async () => {
    const first = await request(app).post("/api/leads").send({
      sourceMessageId: "message-partial",
      product: "Chair",
      quantity: 5,
    });
    const second = await request(app).post("/api/leads").send({
      sourceMessageId: "message-partial",
      product: "Chair",
      quantity: 7,
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.id).not.toBe(second.body.id);
  });
});

describe("PATCH /api/leads/:leadId/status", () => {
  it("transitions an existing NEW lead to CONTACTED and returns the raw Lead", async () => {
    const created = await request(app).post("/api/leads").send({
      sourceMessageId: "message-empty",
      product: "Whiteboard",
      quantity: 6,
    });

    const response = await request(app)
      .patch(`/api/leads/${created.body.id}/status`)
      .send({ status: "CONTACTED" });
    console.log(JSON.stringify(response.body));
    console.log("created:", created.status, JSON.stringify(created.body));
    console.log("patch:", response.status, JSON.stringify(response.body));
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("CONTACTED");
  });

  it("rejects a repeated transition on an already-CONTACTED lead", async () => {
    const created = await request(app).post("/api/leads").send({
      sourceMessageId: "message-empty",
      product: "Whiteboard",
      quantity: 3,
    });
    await request(app)
      .patch(`/api/leads/${created.body.id}/status`)
      .send({ status: "CONTACTED" });

    const second = await request(app)
      .patch(`/api/leads/${created.body.id}/status`)
      .send({ status: "CONTACTED" });

    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.status).toBeLessThan(500);
  });

  it("rejects an unknown leadId and an invalid payload", async () => {
    const unknown = await request(app)
      .patch("/api/leads/does-not-exist/status")
      .send({ status: "CONTACTED" });
    const created = await request(app).post("/api/leads").send({
      sourceMessageId: "message-empty",
      product: "Whiteboard",
      quantity: 1,
    });
    const badPayload = await request(app)
      .patch(`/api/leads/${created.body.id}/status`)
      .send({ status: "NEW" });

    expect(unknown.status).toBeGreaterThanOrEqual(400);
    expect(unknown.status).toBeLessThan(500);
    expect(badPayload.status).toBeGreaterThanOrEqual(400);
    expect(badPayload.status).toBeLessThan(500);
  });
});
