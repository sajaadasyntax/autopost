export function dataDeletionPage(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Delete your Auto Post AI data</title>
  <style>
    body { margin: 0; font-family: Georgia, serif; color: #1c1917; background: #fafaf9; }
    main { max-width: 40rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1 { font-size: 1.8rem; line-height: 1.2; margin-bottom: 0.5rem; }
    p, li { font-size: 1.05rem; line-height: 1.55; }
    code { font-family: ui-monospace, monospace; background: #e7e5e4; padding: 0.1rem 0.35rem; }
  </style>
</head>
<body>
  <main>
    <h1>Delete your Auto Post AI data</h1>
    <p>Auto Post AI keeps the data needed to turn a WhatsApp brief into a draft post.</p>
    <ul>
      <li>Your WhatsApp phone number and profile name</li>
      <li>The brief you send, and any edit you send after it</li>
      <li>The generated headline, caption, hashtags, and call to action</li>
      <li>The draft preview image</li>
      <li>Where you are in the conversation</li>
    </ul>
    <h2>How to delete it</h2>
    <p>From the same WhatsApp number, send this message to the Auto Post AI business number:</p>
    <p><code>delete my data</code></p>
    <p>The app deletes that number, the stored messages, the drafts, and the preview images. It then replies that the deletion is done.</p>
    <p>A post that was already published stays on Facebook or Instagram. Remove that copy in the Facebook Page or Instagram account.</p>
  </main>
</body>
</html>`;
}
