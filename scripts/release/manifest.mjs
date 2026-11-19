const repository='learningharness/learningharness';
export function releaseManifest({version,commit,artifacts}){
 if(!/^1\.0\.0-beta\.\d+$/.test(version)||! /^[a-f0-9]{40}$/.test(commit)||artifacts?.length!==2)throw Error('Invalid release identity');
 const entries=['codex','claude'].map(host=>{
  const matches=artifacts.filter(a=>a.host===host),file=`learning-harness-${host}-${version}.zip`;
  if(matches.length!==1||matches[0].file!==file||! /^[a-f0-9]{64}$/.test(matches[0].sha256))throw Error('Invalid host artifact');
  return {host,version,packageRoot:file.slice(0,-4),installer:'install.mjs',guide:`https://learningharness.dev/docs/${host==='claude'?'claude-code':host}/`,channel:host==='codex'?'public-beta':'release-candidate',nativeAcceptance:'pending',requirements:['macOS','Node.js 22.19+',host==='claude'?'Claude Desktop Code tab and Claude Code CLI subscription sign-in':'Codex desktop and existing sign-in'],limitations:['Early access; automated checks do not establish full native acceptance or learning outcomes.'],url:`https://github.com/${repository}/releases/download/v${version}/${file}`,sha256:matches[0].sha256};
 });
 return {schemaVersion:1,channel:'public-beta',status:'available',instructions:`https://github.com/${repository}/releases/latest/download/install.md`,platform:'darwin',nodeMinimum:'22.19.0',source:{repository:`https://github.com/${repository}`,commit},artifacts:entries};
}
