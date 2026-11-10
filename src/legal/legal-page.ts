export function legalPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    body { margin: 0; font-family: Georgia, serif; color: #1c1917; background: #fafaf9; }
    main { max-width: 40rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
    h1 { font-size: 1.8rem; line-height: 1.2; margin-bottom: 0.5rem; }
    h2 { font-size: 1.2rem; margin-top: 1.75rem; }
    p, li { font-size: 1.05rem; line-height: 1.55; }
    a { color: #9a3412; }
  </style>
</head>
<body>
  <main>
    <h1>${title}</h1>
    ${body}
  </main>
</body>
</html>`;
}
