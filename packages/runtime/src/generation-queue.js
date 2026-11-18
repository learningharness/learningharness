// Reserve a learner lane so a slow prebuild in another chat cannot block a reply.
// At most one call per lane and one per owner; active calls are never discarded.
export class GenerationQueue {
 constructor(){this.waiting=[];this.running=new Set();this.owners=new Set();}
 run(work,background=false,owner=null){return new Promise((resolve,reject)=>{this.waiting.push({work,background,owner,resolve,reject});this.drain();});}
 drain(){
  for(const background of [false,true]){
   if(this.running.has(background))continue;
   const index=this.waiting.findIndex(item=>item.background===background&&(!item.owner||!this.owners.has(item.owner)));
   if(index<0)continue;
   const item=this.waiting.splice(index,1)[0];this.running.add(background);if(item.owner)this.owners.add(item.owner);
   Promise.resolve().then(item.work).then(item.resolve,item.reject).finally(()=>{this.running.delete(background);if(item.owner)this.owners.delete(item.owner);this.drain();});
  }
 }
}
