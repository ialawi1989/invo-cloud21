export default `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>My Awesome Site</title>
  <base href="/">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!--
    Placeholder injected with Open Graph meta tags by the SSR
    Express layer (src/server.ts). Each per-route handler runs the
    Angular response through \`.replace('<meta name="meta-tags">', ...)\`
    to splice in og:title / og:image / etc. before sending to the
    browser. Keep this exact attribute spelling.
  -->
  <meta name="meta-tags">
  <!--
    Runtime-config injection slot. The SSR Express layer
    (src/server.ts) replaces this with an inline <script> that sets:
      window.__DASHBOARD_ORIGIN__   — origin the customizer iframe
                                      accepts postMessage from
      window.__CUSTOMIZER_ORIGINS__ — additional allowed origins
      window.__APP_CONFIG__         — { subdomain, dashboardOrigin }
    \`environment.ts\` and PreviewService read those values during
    bundle bootstrap so the postMessage allowlist is correct on
    first paint — no race with /assets/config.json.
  -->
  <meta name="runtime-config">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;family=Poppins:wght@300;400;500;600;700&amp;family=Playfair+Display:wght@400;500;600;700&amp;family=Montserrat:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="styles.css"><link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&amp;family=Poppins:wght@400;500;600;700&amp;family=Playfair+Display:wght@400;500;600;700&amp;display=swap" as="style"></head>
<body ngcm="">
  <app-root></app-root>
<link rel="modulepreload" href="chunk-WIK4ERCU.js"><script src="polyfills.js" type="module"></script><script src="main.js" type="module"></script></body>
</html>
`;