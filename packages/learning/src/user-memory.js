import {homedir} from 'node:os';import {join} from 'node:path';import {readFile} from 'node:fs/promises';
import {userDataRoot,migrateLocalDirectory} from '../../hosts/src/user-data.js';
import {learnerStore} from './learner-store.js';
export async function learnerDirectory({env=process.env,home=homedir()}={}){
 const explicit=env.LEARNING_HARNESS_LEARNER_DIR??env.DONTDUMB_LEARNER_DIR;if(explicit)return explicit;
 const target=join(userDataRoot(home),'learner'),legacy=join(home,'.local/share/dontdumb');
 try{await readFile(join(legacy,'learner.json'));}catch(e){if(e.code==='ENOENT')return target;throw e;}
 // Validate before writing. Canonical profile wins; evidence and review state merge.
 const snapshot=await learnerStore(legacy).read();
 await migrateLocalDirectory(legacy,target,{entries:['learner.json']});
 await learnerStore(target).mergeLocalState(snapshot);
 return target;
}
