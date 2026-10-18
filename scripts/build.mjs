import { build } from 'esbuild';
await build({ entryPoints: ['src/backend.js'], outfile: 'dist/backend.js', bundle: true, format: 'esm', platform: 'neutral', target: 'es2022' });
await build({ entryPoints: ['src/frontend.js'], outfile: 'dist/frontend.js', bundle: true, format: 'esm', platform: 'browser', target: 'es2022', loader: { '.css': 'text', '.png': 'dataurl' } });
