// Re-render saved evidence without calling any model or changing report.json.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {writeReportBundle,renderComparison,readRecentReports} from './report.mjs';
const args=process.argv.slice(2),compare=args.includes('--compare');
const paths=args.filter(arg=>!arg.startsWith('--')).map(resolvePath=>resolve(resolvePath));
if(!paths.length||!compare&&paths.length!==1)throw Error('Usage: render-report.mjs report.json OR --compare report1.json report2.json [--output=path.md]');
const entries=await Promise.all(paths.map(async path=>({path,report:JSON.parse(await readFile(path,'utf8'))})));
for(const {report}of entries)if(!Array.isArray(report.cases)||![1,2].includes(report.schema))throw Error('Unsupported eval report');
if(compare){
  const specified=args.find(arg=>arg.startsWith('--output='))?.slice(9);
  const output=specified?resolve(specified):resolve('artifacts/evals',`comparison-${new Date().toISOString().replace(/[:.]/g,'-')}.md`);
  await mkdir(dirname(output),{recursive:true});await writeFile(output,renderComparison(entries),{mode:0o600});console.log(output);
}else{
  const {path,report}=entries[0];await writeReportBundle(report,dirname(path));
  const previous=await readRecentReports(dirname(dirname(path)),report.mode,path);
  await writeFile(join(dirname(path),'comparison.md'),renderComparison([...previous,{path,report}]),{mode:0o600});
  console.log(join(dirname(path),'report.md'));
}
