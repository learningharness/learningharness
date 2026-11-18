export function assertPublicationReady(gate){
 if(gate.approved!==true)throw new Error('Publication needs explicit owner approval.');
 const checks=gate.channel==='public-beta'?gate.betaChecks:gate.checks;
 if(!checks||!Object.keys(checks).length)throw new Error('Publication checks are missing.');
 const pending=Object.entries(checks).filter(([,check])=>check.passed!==true||!check.evidence?.trim()).map(([name])=>name);
 for(const candidate of gate.candidateArtifacts??[]){
  if(gate.channel!=='public-beta'||candidate.approved!==true||candidate.channel!=='release-candidate')throw Error('Candidate publication needs explicit candidate approval.');
  if(!/^[a-z0-9.-]+\.zip$/.test(candidate.file??'')||!/^[a-f0-9]{64}$/.test(candidate.sha256??''))throw Error('Candidate checksum or filename missing.');
  if(!candidate.checks||!Object.keys(candidate.checks).length||Object.values(candidate.checks).some(check=>check.passed!==true||!check.evidence?.trim()))throw Error('Candidate verification evidence missing.');
 }
 if(pending.length)throw new Error('Publication checks pending: '+pending.join(', '));
}
