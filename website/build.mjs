import {cp,mkdir} from 'node:fs/promises';
const root=new URL('./',import.meta.url);
await mkdir(new URL('dist/',root),{recursive:true});
await cp(new URL('assets/',root),new URL('dist/assets/',root),{recursive:true});
await cp(new URL('pages/',root),new URL('dist/',root),{recursive:true});
await import('./build-docs.mjs');
