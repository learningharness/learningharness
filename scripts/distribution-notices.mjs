import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
export async function writeDistributionNotices(directory){
 await writeFile(join(directory,'BETA_NOTICE.md'),await readFile('docs/PUBLIC_BETA_NOTICE.md'));
 const notices=[];
 for(const name of ['solid-js','parse5','entities','d3-hierarchy']){
  const pkg=JSON.parse(await readFile(join('node_modules',name,'package.json'),'utf8'));
  notices.push(`${name} ${pkg.version}\n${await readFile(join('node_modules',name,'LICENSE'),'utf8')}`);
 }
 await writeFile(join(directory,'THIRD_PARTY_NOTICES.txt'),notices.join('\n\n--------------------\n\n'));
}
