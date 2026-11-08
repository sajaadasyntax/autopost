export type IncomingMessage = {
  messageId: string;
  from: string;
  name?: string;
  kind: 'text' | 'button' | 'unsupported';
  text?: string;
  buttonId?: string;
};

export function parseWebhook(payload: unknown): IncomingMessage[] {
  const messages: IncomingMessage[] = [];
  for (const entry of asArray(asRecord(payload).entry)) {
    for (const change of asArray(asRecord(entry).changes)) {
      const value = asRecord(asRecord(change).value);
      const names = new Map<string, string>();
      for (const contact of asArray(value.contacts)) {
        const record = asRecord(contact);
        const waId = stringValue(record.wa_id);
        const profile = asRecord(record.profile);
        const name = stringValue(profile.name);
        if (waId && name) {
          names.set(waId, name);
        }
      }
      for (const message of asArray(value.messages)) {
        const parsed = parseMessage(message, names);
        if (parsed) {
          messages.push(parsed);
        }
      }
    }
  }
  return messages;
}

export function parseButtonId(buttonId: string): { action: 'approve' | 'edit' | 'cancel'; postId: string } | null {
  const match = /^(approve|edit|cancel):([A-Za-z0-9_-]+)$/.exec(buttonId);
  if (!match) {
    return null;
  }
  return { action: match[1] as 'approve' | 'edit' | 'cancel', postId: match[2] };
}

export function readHubQuery(query: Record<string, unknown>): { mode: string; token: string; challenge: string } {
  const hub = query.hub;
  if (hub && typeof hub === 'object') {
    const record = hub as Record<string, unknown>;
    return {
      mode: stringValue(record.mode),
      token: stringValue(record.verify_token),
      challenge: stringValue(record.challenge),
    };
  }
  return {
    mode: stringValue(query['hub.mode']),
    token: stringValue(query['hub.verify_token']),
    challenge: stringValue(query['hub.challenge']),
  };
}

function parseMessage(message: unknown, names: Map<string, string>): IncomingMessage | null {
  const record = asRecord(message);
  const messageId = stringValue(record.id);
  const from = stringValue(record.from);
  if (!messageId || !from) {
    return null;
  }
  const base = { messageId, from, name: names.get(from) };
  const type = stringValue(record.type);
  if (type === 'text') {
    const text = stringValue(asRecord(record.text).body).trim();
    return text ? { ...base, kind: 'text', text } : { ...base, kind: 'unsupported' };
  }
  if (type === 'interactive') {
    const interactive = asRecord(record.interactive);
    const reply = asRecord(interactive.button_reply);
    const buttonId = stringValue(reply.id);
    if (stringValue(interactive.type) === 'button_reply' && buttonId) {
      return { ...base, kind: 'button', buttonId };
    }
  }
  return { ...base, kind: 'unsupported' };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
