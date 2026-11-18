// A conceptual learning field in the visual language of the landing's stellar
// duet. No data/model requests, learner records, or simulated assessment scores.
const canvas = document.querySelector('#learning-field');
const container = canvas?.closest('.learning-model');
if (canvas && container) {
  const gl = canvas.getContext('webgl', {alpha: false, antialias: false, powerPreference: 'low-power', preserveDrawingBuffer: true});
  if (gl) {
    const vertex = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
    const fragment = `precision highp float;
uniform vec2 resolution;uniform float time;uniform float separation;uniform float support;uniform float progress;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float plasma(vec2 p){return .57*noise(p)+.27*noise(p*2.03)+.11*noise(p*4.07)+.05*noise(p*8.11);}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;
 float radius=length(uv),angle=atan(uv.y,uv.x);
 float growth=progress*progress*(3.-2.*progress);
 float core=.134+(1.-separation)*.045*growth+support*.065*growth;
 float reach=.28+separation*.105*growth;
 float swirl=angle*4.-time*.08;
 float texture=plasma(vec2(radius*49.+sin(swirl)*2.,cos(swirl)*3.));
 float filaments=pow(.5+.5*sin(radius*215.-angle*8.+texture*10.),2.);
 float bypass=separation*(1.-support)*growth;
 float zpdRadius=reach;
 float outerBlur=mix(.012,.035,bypass);
 float originalGuided=smoothstep(core,core+.018,radius)*(1.-smoothstep(zpdRadius-.025,zpdRadius+outerBlur,radius));
 // Delegation freezes the inner edge first; the front spreads outward,
 // leaving the independent core unchanged and displacing guided learning.
 float freezeFront=mix(core,.415,progress);
 float frozen=separation*(1.-support)*smoothstep(core,core+.012,radius)*(1.-smoothstep(freezeFront-.008,freezeFront+.014,radius));
 float guided=originalGuided*(1.-frozen*.88);
 float remote=exp(-pow((radius-reach)/.018,2.));
 float bridge=guided;
 float edge=exp(-abs(radius-core)*220.);
 float energy=(bridge*.34+remote*.45)*(.18+texture*1.6)*(.3+filaments*.7)+edge*.8;
 // Every task starts somewhere inside known ability. Guided tasks stay
 // inside it; delegated work mixes familiar tasks with beyond-ZPD flights.
 float jumps=0.;
 for(int i=0;i<6;i++){
   float rate=mix(1.4,2.8,separation);
   float tick=time*rate;
   float flight=floor(tick)-float(i);
   float age=(fract(tick)+float(i))/rate;
   float a=hash(vec2(flight,7.))*6.2831853;
   float distance=max(reach+.015,.36)+hash(vec2(flight,19.))*.055;
   float startRadius=core*sqrt(hash(vec2(flight,41.)))*.70;
   float localEnd=core*(.20+hash(vec2(flight,29.))*.58);
   float shootsBeyond=separation*step(.42,hash(vec2(flight,53.)));
   float endRadius=mix(localEnd,distance,shootsBeyond);
   float originAngle=a+(hash(vec2(flight,61.))-.5)*1.8;
   vec2 from=vec2(cos(originAngle),sin(originAngle))*startRadius;
   vec2 destination=vec2(cos(a),sin(a))*endRadius;
   float travel=clamp(age/mix(.5,.20,separation),0.,1.);
   vec2 head=mix(from,destination,travel);
   vec2 line=head-from;
   float along=clamp(dot(uv-from,line)/max(dot(line,line),.00001),0.,1.);
   float pathDistance=length(uv-from-line*along);
   float fade=pow(max(0.,1.-age/1.55),2.);
   float trail=exp(-pathDistance*680.)*.65;
   float point=exp(-length(uv-head)*220.)*1.7;
   jumps+=(trail+point)*fade*step(0.,flight);
 }
 energy*=smoothstep(core-.003,core+.006,radius);
 energy+=jumps;
 vec3 warm=mix(vec3(1.,.19,.04),vec3(1.,.83,.62),clamp(texture+edge*.7+jumps,0.,1.));
 vec3 color=1.-exp(-energy*warm*2.2);
 // An 80% soft red treatment filters the original receding curves.
 // Preserve their texture instead of replacing the band with a solid fill.
 float receded=frozen*(1.-smoothstep(reach,reach+.025,radius));
 vec2 texturePoint=vec2(radius*49.+sin(swirl)*2.,cos(swirl)*3.);
 float blurredTexture=(plasma(texturePoint)+plasma(texturePoint+vec2(.8,.5))+plasma(texturePoint-vec2(.8,.5)))/3.;
 float originalBand=smoothstep(core,core+.018,radius)*(1.-smoothstep(reach-.005,reach+.025,radius));
 float softenedCurves=originalBand*(.18+blurredTexture*1.6)*(.34+filaments*.16)*.36;
 float curveLight=max(dot(color,vec3(.299,.587,.114)),softenedCurves*.8);
 vec3 redFiltered=vec3(curveLight*1.25,curveLight*.10,curveLight*.065);
 color=mix(color,redFiltered,receded*.8);
 float vignette=1.-smoothstep(.43,.55,radius);
 gl_FragColor=vec4(mix(vec3(8./255.),color,vignette),1.);
}`;
    try {
      function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error('Field unavailable');
        return shader;
      }
      const program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error('Field unavailable');
      gl.useProgram(program);
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'p'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const size = gl.getUniformLocation(program, 'resolution'), clock = gl.getUniformLocation(program, 'time');
      const separation = gl.getUniformLocation(program, 'separation'), support = gl.getUniformLocation(program, 'support'), progress = gl.getUniformLocation(program, 'progress');
      const reduced = matchMedia('(prefers-reduced-motion: reduce)');
      let visible = true, timer = null, elapsed = 0, lost = false, previousView, viewStarted = performance.now();
      function draw() {
        if (lost) return;
        const view = container.querySelector('input:checked')?.value ?? 'guided';
        if (view !== previousView) {previousView = view; viewStarted = performance.now();}
        const duration = view === 'gap' ? 7400 : 5000;
        gl.uniform1f(progress, reduced.matches ? 1 : Math.min(1, (performance.now() - viewStarted) / duration));
        gl.uniform2f(size, canvas.width, canvas.height); gl.uniform1f(clock, reduced.matches ? 0 : elapsed);
        gl.uniform1f(separation, view === 'guided' ? 0 : 1); gl.uniform1f(support, view === 'alongside' ? 1 : 0);
        gl.drawArrays(gl.TRIANGLES, 0, 6); container.classList.add('has-stellar-field');
      }
      function resize() {
        const box = canvas.getBoundingClientRect();
        const scale = Math.min(devicePixelRatio || 1, 1.5, 1000 / Math.max(box.width, box.height));
        canvas.width = Math.max(1, Math.round(box.width * scale)); canvas.height = Math.max(1, Math.round(box.height * scale));
        gl.viewport(0, 0, canvas.width, canvas.height); draw();
      }
      function sync() {
        clearInterval(timer); timer = null;
        if (!lost && !reduced.matches && !document.hidden && visible) timer = setInterval(() => {elapsed += .08; draw();}, 80);
      }
      const resizeObserver = new ResizeObserver(resize), intersectionObserver = new IntersectionObserver(entries => {visible = entries[0].isIntersecting; sync();});
      resizeObserver.observe(canvas); intersectionObserver.observe(canvas);
      const changed = () => {draw(); sync();};
      container.addEventListener('change', changed); reduced.addEventListener('change', changed); document.addEventListener('visibilitychange', sync);
      canvas.addEventListener('webglcontextlost', () => {lost = true; clearInterval(timer); container.classList.remove('has-stellar-field');});
      // Suspend for navigation, retaining bindings when restored from bfcache.
      window.addEventListener('pagehide', () => {clearInterval(timer); timer = null;});
      window.addEventListener('pageshow', () => {resize(); sync();});
      resize(); sync();
    } catch { container.classList.remove('has-stellar-field'); }
  }
}

// Autoplay is independent of the renderer, including the CSS fallback.
if (container) {
  const choices = [...container.querySelectorAll('input[name="learning-view"]')];
  const pause = container.querySelector('.model-pause');
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = reducedMotion.matches, inView = false, hovering = false, focused = false, sequenceTimer;
  function syncSequence() {
    clearInterval(sequenceTimer);
    pause.textContent = paused ? 'Play' : 'Pause';
    pause.setAttribute('aria-label', paused ? 'Play automatic sequence' : 'Pause automatic sequence');
    if (paused || !inView || hovering || focused || document.hidden) return;
    sequenceTimer = setInterval(() => {
      const next = choices[(choices.findIndex(input => input.checked) + 1) % choices.length];
      next.checked = true;
      next.dispatchEvent(new Event('change', {bubbles: true}));
    }, 8000);
  }
  pause.addEventListener('click', () => {paused = !paused; syncSequence();});
  container.addEventListener('change', syncSequence);
  container.addEventListener('pointerenter', event => {if (event.pointerType === 'mouse') {hovering = true; syncSequence();}});
  container.addEventListener('pointerleave', () => {hovering = false; syncSequence();});
  container.addEventListener('focusin', () => {focused = true; syncSequence();});
  container.addEventListener('focusout', event => {focused = container.contains(event.relatedTarget); syncSequence();});
  new IntersectionObserver(entries => {inView = entries[0].isIntersecting; syncSequence();}, {threshold: .25}).observe(container.querySelector('.model-visual'));
  document.addEventListener('visibilitychange', syncSequence);
  reducedMotion.addEventListener('change', () => {paused = reducedMotion.matches; syncSequence();});
  window.addEventListener('pagehide', () => clearInterval(sequenceTimer));
  window.addEventListener('pageshow', syncSequence);
  syncSequence();
}

// Keep the text arc aligned with the field's circular geometry at every size.
if (container) {
  const field = container.querySelector('.cosmic-field');
  const arc = container.querySelector('.zpd-arc');
  const path = container.querySelector('#zpd-arc-path');
  const bottom = container.querySelector('#zpd-arc-bottom');
  function alignArc() {
    const {width, height} = field.getBoundingClientRect();
    const view = container.querySelector('input:checked')?.value;
    const radius = height * (view === 'gap' ? .215 : view === 'alongside' ? .29 : .255);
    const x = width / 2, y = height / 2;
    arc.setAttribute('viewBox', `0 0 ${width} ${height}`);
    path.setAttribute('d', `M ${x-radius} ${y} A ${radius} ${radius} 0 0 1 ${x+radius} ${y}`);
    const lowerRadius = radius + height * .035;
    bottom.setAttribute('d', `M ${x-lowerRadius} ${y} A ${lowerRadius} ${lowerRadius} 0 0 0 ${x+lowerRadius} ${y}`);
  }
  new ResizeObserver(alignArc).observe(field);
  container.addEventListener('change', alignArc);
  alignArc();
}

// Horizontal gestures select a state; vertical gestures remain page scrolling.
if (container) {
  const surface = container.querySelector('.model-visual');
  const choices = [...container.querySelectorAll('input[name="learning-view"]')];
  let gesture = null;
  surface.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.pointerType === 'mouse') return;
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY};
  });
  surface.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    gesture = null;
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    const current = choices.findIndex(choice => choice.checked);
    const next = choices[(current + (dx < 0 ? 1 : -1) + choices.length) % choices.length];
    next.checked = true;
    next.dispatchEvent(new Event('change', {bubbles: true}));
  });
  surface.addEventListener('pointercancel', () => {gesture = null;});
}
