import './stellar-duet.mjs?v=immersive8';

const dialog=document.querySelector('#install-dialog');
const origin=['127.0.0.1','localhost'].includes(location.hostname)?'https://learningharness.dev':location.origin;
const prompt=`Install LearningHarness for this coding app using ${origin}/install.md`;
for(const code of document.querySelectorAll('[data-install-prompt]'))code.textContent=prompt;
for(const link of document.querySelectorAll('[data-open-install]'))link.addEventListener('click',event=>{if(typeof dialog?.showModal==='function'){event.preventDefault();dialog.showModal();}});
for(const button of document.querySelectorAll('[data-copy-install]'))button.addEventListener('click',async()=>{
 const status=button.closest('dialog,section')?.querySelector('[data-copy-status]');
 try{await navigator.clipboard.writeText(prompt);if(status)status.textContent='Copied. Paste it into Codex or Claude Code.';}
 catch{if(status)status.textContent='Select and copy the prompt above.';}
});
// Play only while visible, and leave reduced-motion visitors on the poster.
const film=document.querySelector('#product-film');
if(film){
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let visible=false;
 const update=()=>{
  if(visible&&!document.hidden&&!reducedMotion.matches){
   film.play().catch(()=>{});
  }else film.pause();
 };
 new IntersectionObserver(entries=>{visible=entries[0].intersectionRatio>=.25;update();},{threshold:.25}).observe(film);
 update();
 document.addEventListener('visibilitychange',update);
 reducedMotion.addEventListener('change',update);
}

// Fallback stays still; the procedural field owns motion when supported.
document.querySelector('.duet-art')?.pauseAnimations();
