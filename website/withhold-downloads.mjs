export function withholdDownloads(html){
 return html.replace(/<a\b([^>]*?)href="\/?downloads\/([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g,(_,before,file,after,label)=>{
  const host=/^(?:dontdumb|learning-harness)-codex-/.test(file)?'codex':/^(?:dontdumb|learning-harness)-claude-/.test(file)?'claude-code':file.startsWith('dontdumb-opencode-')?'opencode':null;
  const href=host?`docs/${host}/`:file==='SHA256SUMS.txt'?'install.json':'docs/agent-install/';
  const content=host?label.replace(/Download[^<]*/g,'Setup guide →'):file==='SHA256SUMS.txt'?'Release status':'Installation guide →';
  return `<a${before}href="${href}"${after.replace(/\sdownload(?:="[^"]*")?/g,'')}>${content}</a>`;
 });
}
