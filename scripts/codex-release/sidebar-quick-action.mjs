// Official SDK schema: global.quickAction invokes a same-app tool.
// https://github.com/openai/mcp-extensions/blob/main/typescript/src/shared/ui.ts
// This qualifies an auxiliary shortcut; it does not establish current-chat
// identity or promise that the host opens a sidecar rather than a global view.
export function sidebarQuickAction(icons){
 if(arguments.length!==1)throw Error('Sidebar quick action accepts icons only.');
 if(!Array.isArray(icons)||!icons.length||icons.some(icon=>typeof icon?.src!=='string'||!/^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/.test(icon.src)))throw Error('Sidebar quick action requires embedded navigation icons.');
 return {title:'Learn beside this chat',icons:structuredClone(icons),target:{type:'tool',name:'open_learn',arguments:{}}};
}

export function sidebarEntryMetadata(presentation,icons){
 const metadata=presentation.entryMetadata('global'),ui=metadata['openai/ui'];
 if(!ui||!Array.isArray(ui.entrypoints))return metadata;
 return {...metadata,'openai/ui':{...ui,entrypoints:ui.entrypoints.map(entry=>entry.type==='global'?{...entry,quickAction:sidebarQuickAction(icons)}:entry)}};
}
