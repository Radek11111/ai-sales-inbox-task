import { Extraction } from "../server/ai";
import type { Lead, Message } from "./types";

type Extraxtion = {
  product?: string;
  quantity?: number | null;
  material?: string | null;
  budget?: number | null;
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<T>;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error ?? `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  listMessages: () => getJson<Message[]>("/api/messages"),
  getMessage: (messageId: string) =>
    getJson<Message>(`/api/messages/${encodeURIComponent(messageId)}`),
  listLeads: () => getJson<Lead[]>("/api/leads"),
  extract: (messageId: string) =>
    postJson<Extraction>("/api/ai/extract", { messageId }),
  saveLead: (input: {
    sourceMessageId: string;
    product: string;
    quantity: number;
    material: string | null;
    budget?: number | null;
  }) => postJson<Lead>("/api/leads", input),
  markContacted: (leadId: string) =>
    fetch(`/api/leads/${encodeURIComponent(leadId)}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CONTRACTED" }),
    }).then(async (response) => {
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.error ?? `Request failed (${response.status})`,
        );
      }
      return response.json() as Promise<Lead>;
    }),
};
