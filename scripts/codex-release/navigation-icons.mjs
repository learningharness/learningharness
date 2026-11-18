import {readFileSync} from 'node:fs';
// MCP navigation reads tool/server icons, independently of plugin listing logos.
// Bundle the owned SVGs so sidebar discovery works without a network request.
export function readNavigationIcons(directory){
 return [['light','logo.svg'],['dark','logo-dark.svg']].map(([theme,file])=>({src:'data:image/svg+xml;base64,'+readFileSync(new URL(file,directory)).toString('base64'),mimeType:'image/svg+xml',sizes:['any'],theme}));
}
