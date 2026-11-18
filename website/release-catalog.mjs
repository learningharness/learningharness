// Current downloads are selected once; old published ZIPs remain immutable.
export function releaseCatalog(gate){
 const codex=gate.artifact,claude=gate.candidateArtifacts?.find(a=>a.host==='claude');
 return [['codex',codex],['claude',claude]].map(([host,item])=>{
  const match=item?.file?.match(/^learning-harness-(codex|claude)-(\d+\.\d+\.\d+-beta\.\d+)\.zip$/);
  if(!match||match[1]!==host||!/^([a-f0-9]{64})$/.test(item.sha256??''))throw Error('Invalid release artifact for '+host);
  if(item.version&&item.version!==match[2])throw Error('Artifact version mismatch for '+host);
  const common={host,version:match[2],packageRoot:item.file.slice(0,-4),installer:'install.mjs',guide:'/docs/'+(host==='claude'?'claude-code':host)+'/',channel:host==='codex'?'public-beta':'release-candidate'};
  return host==='codex'?common:{...common,nativeAcceptance:item.nativeAcceptance??'pending',sharedFeatureBaseline:codex.file.match(/(\d+\.\d+\.\d+-beta\.\d+)\.zip$/)[1],requirements:['Claude Desktop Code tab on macOS','Node.js 22.19+','Claude Code CLI signed in with an active Claude subscription'],limitations:['Native automatic pairing and complete host integration still need acceptance testing','Use the bundled installer to register the Desktop connector; marketplace-only installation is insufficient']};
 });
}
export function renderReleaseLinks(html,catalog){
 return html.replace(/(href=")(\/?downloads\/)learning-harness-(codex|claude)-\d+\.\d+\.\d+-beta\.\d+\.zip"/g,(full,start,prefix,host)=>{const pkg=catalog.find(p=>p.host===host);if(!pkg)throw Error('Download host missing from catalog');return start+prefix+pkg.packageRoot+'.zip"';});
}
