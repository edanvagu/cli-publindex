import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, 'dist');

const watch = process.argv.includes('--watch');

// Three bundles — background (service worker), content script, popup — each with its own entrypoint. The manifest points at the dist filenames, not the source, so users can load `extension/dist` unpacked.
const entries = [
  { in: 'src/background.ts', out: 'background.js' },
  { in: 'src/content/index.ts', out: 'content.js' },
  { in: 'src/popup/popup.ts', out: 'popup.js' },
];

const common = {
  bundle: true,
  format: 'iife',
  target: ['chrome115'],
  sourcemap: true,
  minify: false,
  logLevel: 'info',
};

mkdirSync(dist, { recursive: true });

async function build() {
  if (watch) {
    for (const e of entries) {
      const ctx = await esbuild.context({
        ...common,
        entryPoints: [resolve(here, e.in)],
        outfile: resolve(dist, e.out),
      });
      await ctx.watch();
    }
    // Watch doesn't re-copy static assets automatically — that's fine for dev; reload the extension to pick up manifest/css/html changes.
    copyStatic();
    console.info('[build] watching...');
  } else {
    await Promise.all(
      entries.map((e) =>
        esbuild.build({
          ...common,
          entryPoints: [resolve(here, e.in)],
          outfile: resolve(dist, e.out),
        }),
      ),
    );
    copyStatic();
    console.info('[build] done');
  }
}

function copyStatic() {
  // Emit manifest with dist paths (not src paths — the manifest in the repo references src/ for readability, but Chrome loads the dist folder).
  const manifestSrc = JSON.parse(readFileSync(resolve(here, 'manifest.json'), 'utf8'));
  // Drop `type: "module"` from background — the service worker is emitted as IIFE, not an ES module. Keeping both fields causes Chrome to reject the load.
  const { type: _, ...backgroundRest } = manifestSrc.background ?? {};
  const manifestDist = {
    ...manifestSrc,
    action: { ...manifestSrc.action, default_popup: 'popup.html' },
    background: { ...backgroundRest, service_worker: 'background.js' },
    content_scripts: manifestSrc.content_scripts.map((cs) => ({
      ...cs,
      js: ['content.js'],
    })),
  };
  writeFileSync(resolve(dist, 'manifest.json'), JSON.stringify(manifestDist, null, 2));

  // Rewrite popup.html's <script src="./popup.ts"> → "./popup.js" and strip type="module" so it matches the IIFE bundle.
  const html = readFileSync(resolve(here, 'src/popup/popup.html'), 'utf8')
    .replace(/\.\/popup\.ts/g, './popup.js')
    .replace(/\s+type="module"/g, '');
  writeFileSync(resolve(dist, 'popup.html'), html);

  copyFileSync(resolve(here, 'src/popup/popup.css'), resolve(dist, 'popup.css'));
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});
