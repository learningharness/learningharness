// Native helper policy. Claude bindings deliberately avoid its CmdShiftO/M actions.
export function desktopShortcutPolicy(host){
 if(host==='claude')return {scope:'global',combos:[
  {action:1,key:'l',modifiers:['control','option','command']},
  {action:2,key:'o',modifiers:['control','option','command']},
  {action:3,key:'m',modifiers:['control','option','command']}
 ]};
 if(host==='codex')return {scope:'foreground',combos:[
  {action:1,key:'l',modifiers:['command','shift']},
  {action:2,key:'o',modifiers:['control','command','shift']},
  {action:3,key:'l',modifiers:['control','command','shift']}
 ]};
 throw Error('Unsupported desktop learning host.');
}
