import {main} from './cli.mjs';
const result=await main(process.argv.slice(2));process.stdout.write(JSON.stringify(result)+'\n');if(result.error)process.exitCode=1;
