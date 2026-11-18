// Some content builders wrap their result in {spec}. Accept that one transport
// envelope only; the selected artifact validator still checks the entire payload.
import {exactObject} from '../../protocol/src/validation.js';
export function validateGeneratedArtifact(value,validate){
 if(value&&typeof value==='object'&&!Array.isArray(value)&&Object.hasOwn(value,'spec')){
  exactObject(value,['spec']);return validate(value.spec);
 }
 return validate(value);
}
