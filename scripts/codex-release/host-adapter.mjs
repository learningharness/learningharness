import {createCodexNativeHost, codexNativePresentation} from '../../adapters/codex/src/native-host.js';
import {assertNativeHost,identityFrom,validSessionId,readinessOutput} from '../../packages/hosts/src/native-host.js';
export const hostID='codex',presentation=codexNativePresentation;
export {identityFrom,validSessionId,readinessOutput};
export const captureHook=async()=>{};
export async function createNativeHost(options){return assertNativeHost(await createCodexNativeHost(options));}
