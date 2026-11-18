import {createClaudeNativeHost,claudeNativePresentation} from '../../adapters/claude/src/native-host.js';
import {assertNativeHost,identityFrom,validSessionId,readinessOutput} from '../../packages/hosts/src/native-host.js';
export const hostID='claude',presentation=claudeNativePresentation;
export {identityFrom,validSessionId,readinessOutput};
export async function createNativeHost(options){return assertNativeHost(await createClaudeNativeHost({...options,modelTransport:'cli'}));}
