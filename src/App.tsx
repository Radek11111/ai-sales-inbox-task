import React, { useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Lead, Message } from "./types";

type FormFields = {
  product: string;
  quantity: string;
  material: string;
  budget: string;
};

const emptyFields: FormFields = {
  product: "",
  quantity: "",
  material: "",
  budget: "",
};
const path = window.location.pathname.replace(/\/+$/, "") || "/inbox";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function Layout({ children }: { children: ReactNode }) {
  const isPipeline = path === "/pipeline";
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/inbox" aria-label="InboxIQ home">
          <span className="brand-mark">IQ</span>
          <span>InboxIQ</span>
        </a>
        <nav aria-label="Primary navigation">
          <a
            className={!isPipeline ? "nav-link active" : "nav-link"}
            href="/inbox"
            aria-current={!isPipeline ? "page" : undefined}
          >
            Inbox
          </a>
          <a
            className={isPipeline ? "nav-link active" : "nav-link"}
            href="/pipeline"
            aria-current={isPipeline ? "page" : undefined}
          >
            Pipeline
          </a>
        </nav>
        <span className="status-pill">
          <span className="status-dot" /> Local workspace
        </span>
      </header>
      {children}
    </div>
  );
}

function StateMessage({ children }: { children: ReactNode }) {
  return <p className="state-message">{children}</p>;
}

function InboxPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api
      .listMessages()
      .then((result) => {
        if (active) {
          setMessages(result);
          setState("ready");
        }
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="page-container">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Sales workspace</p>
          <h1>Inbox</h1>
          <p className="muted">
            Review inbound conversations and decide what deserves a follow-up.
          </p>
        </div>
        <div className="metric-card">
          <strong>{messages.length}</strong>
          <span>messages</span>
        </div>
      </section>
      <section className="panel" aria-labelledby="messages-heading">
        <div className="panel-heading">
          <h2 id="messages-heading">Latest messages</h2>
          <span className="muted">Deterministic demo data</span>
        </div>
        {state === "loading" && <StateMessage>Loading inbox…</StateMessage>}
        {state === "error" && (
          <StateMessage>
            Could not load the inbox. Check that the API is running.
          </StateMessage>
        )}
        {state === "ready" && (
          <ul className="message-list">
            {messages.map((message) => (
              <MessageRow key={message.id} message={message} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function MessageRow({ message }: { message: Message }) {
  return (
    <li>
      <a className="message-row" href={`/inbox/${message.id}`}>
        <span className="avatar">{message.senderName.slice(0, 1)}</span>
        <span className="message-copy">
          <span className="message-meta">
            <strong>{message.senderName}</strong>
            <span>{formatDate(message.createdAt)}</span>
          </span>
          <span className="message-subject">{message.subject}</span>
          <span className="message-preview">
            {message.company} · {message.body}
          </span>
        </span>
        <span className="row-arrow" aria-hidden="true">
          →
        </span>
      </a>
    </li>
  );
}

function DetailPage({ messageId }: { messageId: string }) {
  const [message, setMessage] = useState<Message | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;
    api
      .getMessage(messageId)
      .then((result) => {
        if (active) {
          setMessage(result);
          setState("ready");
        }
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, [messageId]);

  if (state === "loading")
    return (
      <main className="page-container">
        <StateMessage>Loading message…</StateMessage>
      </main>
    );
  if (state === "error" || !message)
    return (
      <main className="page-container">
        <StateMessage>Message not found.</StateMessage>
      </main>
    );

  return (
    <main className="page-container detail-layout">
      <a className="back-link" href="/inbox">
        ← Back to inbox
      </a>
      <section className="detail-grid">
        <article className="panel message-detail">
          <p className="eyebrow">Inbound message</p>
          <h1>{message.subject}</h1>
          <dl className="message-facts">
            <div>
              <dt>Sender</dt>
              <dd>
                {message.senderName} · {message.senderEmail}
              </dd>
            </div>
            <div>
              <dt>Company</dt>
              <dd>{message.company}</dd>
            </div>
          </dl>
          <div className="message-body">{message.body}</div>
        </article>

        <LeadForm messageId={messageId} />
      </section>
    </main>
  );
}

function PipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorByLeadId, setErrorByLeadId] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    let active = true;
    api
      .listLeads()
      .then((result) => {
        if (active) {
          setLeads(result);
          setState("ready");
        }
      })
      .catch(() => active && setState("error"));
    return () => {
      active = false;
    };
  }, []);

  async function handleMarkContacted(leadId: string) {
    setSavingId(leadId);
    setErrorByLeadId((prev) => {
      const next = { ...prev };
      delete next[leadId];
      return next;
    });
    try {
      const updated = await api.markContacted(leadId);
      setLeads((prev) =>
        prev.map((lead) => (lead.id === leadId ? updated : lead)),
      );
    } catch (error) {
      setErrorByLeadId((prev) => ({
        ...prev,
        [leadId]:
          error instanceof Error ? error.message : "Could not update the lead.",
      }));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <main className="page-container">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Revenue view</p>
          <h1>Pipeline</h1>
          <p className="muted">Saved leads will appear here.</p>
        </div>
        <div className="metric-card">
          <strong>{leads.length}</strong>
          <span>leads</span>
        </div>
      </section>
      <section className="panel" aria-labelledby="pipeline-heading">
        <div className="panel-heading">
          <h2 id="pipeline-heading">Leads</h2>
        </div>
        {state === "loading" && <StateMessage>Loading pipeline…</StateMessage>}
        {state === "error" && (
          <StateMessage>Could not load the pipeline.</StateMessage>
        )}
        {state === "ready" &&
          (leads.length === 0 ? (
            <p className="state-message">No leads yet.</p>
          ) : (
            <ul className="lead-list">
              {leads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  isSaving={savingId === lead.id}
                  error={errorByLeadId[lead.id]}
                  onMarkContacted={() => handleMarkContacted(lead.id)}
                />
              ))}
            </ul>
          ))}
      </section>
    </main>
  );
}

function LeadCard({
  lead,
  isSaving,
  error,
  onMarkContacted,
}: {
  lead: Lead;
  isSaving: boolean;
  error?: string;
  onMarkContacted?: () => void;
}) {
  return (
    <li className="lead-card">
      <div>
        <h3>{lead.product}</h3>
        <p>
          {lead.quantity} unit{lead.quantity === 1 ? "" : "s"}
          {lead.material ? ` · ${lead.material}` : ""}
        </p>
        <span className="muted">
          {lead.status} ·{" "}
          {lead.budget === null ? "Budget unknown" : `${lead.budget}`}
        </span>
        {error && (
          <p role="alert" className="form-message form-message-error">
            {" "}
            {error}
          </p>
        )}
      </div>
      {lead.status === "NEW" && (
        <button
          type="button"
          className="btn"
          onClick={onMarkContacted}
          disabled={isSaving}
        >
          {isSaving ? "Updating…" : "Mark as contacted"}
        </button>
      )}
    </li>
  );
}

export function App() {
  const content =
    path === "/pipeline" ? (
      <PipelinePage />
    ) : path.startsWith("/inbox/") ? (
      <DetailPage
        messageId={decodeURIComponent(path.slice("/inbox/".length))}
      />
    ) : (
      <InboxPage />
    );
  return <Layout>{content}</Layout>;
}

function LeadForm({ messageId }: { messageId: string }) {
  const [fields, setFields] = useState<FormFields>(emptyFields);
  const [extractStatus, setExtractStatus] = useState<"idle" | "loading">(
    "idle",
  );
  const [extractError, setExtractError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success">(
    "idle",
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  function updateField(name: keyof FormFields, value: string) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  async function handleExtract() {
    setExtractStatus("loading");
    setExtractError(null);
    try {
      const result = await api.extract(messageId);
      setFields((prev) => ({
        product:
          prev.product.trim() === "" && result.product
            ? result.product
            : prev.product,
        quantity:
          prev.quantity.trim() === "" && result.quantity != null
            ? String(result.quantity)
            : prev.quantity,
        material:
          prev.material.trim() === "" && result.material != null
            ? result.material
            : prev.material,
        budget:
          prev.budget.trim() === "" && result.budget != null
            ? String(result.budget)
            : prev.budget,
      }));
    } catch {
      setExtractError(
        "Extraction failed. You can still fill in the fields manually.",
      );
    } finally {
      setExtractStatus("idle");
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setSaveError(null);

    const quantity = Number(fields.quantity);
    if (
      fields.product.trim() === "" ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setSaveError(
        "Product is required and quantity must be a positive whole number.",
      );
      return;
    }

    const budget =
      fields.budget.trim() === "" ? undefined : Number(fields.budget);
    if (budget !== undefined && (!Number.isFinite(budget) || budget < 0)) {
      setSaveError("Budget must be a non-negative number.");
      return;
    }

    setSaveStatus("saving");
    try {
      await api.saveLead({
        sourceMessageId: messageId,
        product: fields.product.trim(),
        quantity,
        material: fields.material.trim() === "" ? null : fields.material.trim(),
        budget,
      });
      setSaveStatus("success");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Could not save the lead.",
      );
      setSaveStatus("idle");
    }
  }

  return (
    <form className="panel lead-form" onSubmit={handleSave}>
      <div className="panel-heading">
        <h2>Extract lead details</h2>
        <button
          type="button"
          onClick={handleExtract}
          disabled={extractStatus === "loading"}
          className="btn"
        >
          {extractStatus === "loading" ? "Extracting…" : "Extract with AI"}
        </button>
      </div>

      {extractError && (
        <p role="alert" className="form-message form-message-error">
          {extractError}
        </p>
      )}
      <div className="form-field">
        <label htmlFor="product">Product</label>
        <input
          id="product"
          value={fields.product}
          onChange={(e) => updateField("product", e.target.value)}
          disabled={saveStatus === "saving"}
        />
      </div>
      <div className="form-field">
        <label htmlFor="quantity">Quantity</label>
        <input
          id="quantity"
          type="number"
          min={1}
          step={1}
          value={fields.quantity}
          onChange={(e) => updateField("quantity", e.target.value)}
          disabled={saveStatus === "saving"}
        />
      </div>
      <div className="form-field">
        <label htmlFor="material">Material</label>
        <input
          id="material"
          value={fields.material}
          onChange={(e) => updateField("material", e.target.value)}
          disabled={saveStatus === "saving"}
        />
      </div>
      <div className="form-field">
        <label htmlFor="budget">Budget</label>
        <input
          id="budget"
          type="number"
          min={0}
          value={fields.budget}
          onChange={(e) => updateField("budget", e.target.value)}
          disabled={saveStatus === "saving"}
        />
      </div>

      {saveError && (
        <p role="alert" className="form-message form-message-error">
          {saveError}
        </p>
      )}
      {saveStatus === "success" && (
        <p role="status" className="form-message-success">
          Lead saved. Check the pipeline.
        </p>
      )}

      <button type="submit" disabled={saveStatus === "saving"} className="btn">
        {saveStatus === "saving" ? "Saving…" : "Save lead"}
      </button>
    </form>
  );
}
