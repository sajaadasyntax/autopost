const base = process.env.PUBLIC_BASE_URL || 'http://127.0.0.1:3000';

async function request(pathname, body) {
  const response = await fetch(`${base}${pathname}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${pathname}: ${text}`);
  }
  return text ? JSON.parse(text) : null;
}

const health = await request('/health');
console.log('health', health);

const created = await request('/dev/messages', { text: '20% off whitening' });
console.log('sent', created.messageId);

const outbox = await request('/dev/outbox');
const preview = [...outbox].reverse().find((message) => message.kind === 'preview');
if (!preview) {
  throw new Error(`No preview in the outbox:\n${JSON.stringify(outbox, null, 2)}`);
}
console.log('\nPreview\n');
console.log(preview.body);
console.log(preview.imageUrl);

const approve = preview.buttons?.find((button) => button.title === 'Approve');
if (!approve) {
  throw new Error('Preview has no Approve button');
}
await request('/dev/messages', { buttonId: approve.id });

const posts = await request('/dev/posts');
const published = [...posts].reverse().find((post) => post.status === 'published');
if (!published) {
  throw new Error(`Post was not published:\n${JSON.stringify(posts, null, 2)}`);
}
console.log('\nPublished locally');
console.log(`Facebook id: ${published.fbPostId}`);
console.log(`Instagram id: ${published.igMediaId}`);
