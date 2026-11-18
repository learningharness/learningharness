// Original, illustrative two-body lensing field. Local GPU drawing, no libraries,
// remote assets or model calls. The SVG remains the no-WebGL fallback.
const canvas=document.querySelector('.stellar-canvas');
const revealFallback=()=>document.documentElement.classList.remove('stellar-pending');
if(canvas){
 const gl=canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});
 if(gl){
  const vertex=`attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}`;
  const fragment=`precision highp float;
uniform vec2 resolution;uniform float time;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float plasma(vec2 p){return .53*noise(p)+.27*noise(p*2.03)+.13*noise(p*4.07)+.07*noise(p*8.11);}
vec3 disc(vec3 q,float radius,float t){
 float r=length(q.xz);float inner=radius*1.65,outer=radius*5.7;
 float edge=smoothstep(inner,inner+.14,r)*(1.-smoothstep(outer*.63,outer,r));
 float height=exp(-abs(q.y)*64.);
 if(edge*height<.001)return vec3(0.);
 float angle=atan(q.z,q.x);float shear=angle*4.+t*.216/(r+.3);
 float texture=plasma(vec2(r*52.,shear*2.7));
 float filaments=.35+.65*pow(.5+.5*sin(r*95.-angle*7.+texture*10.+shear),2.);
 float energy=edge*height*(.22+texture*1.7)*filaments;
 float heat=pow(clamp(inner/r,0.,1.),.75);
 vec3 hot=mix(vec3(1.,.22,.055),vec3(1.,.89,.67),heat);
 return hot*energy*6.0;
}
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*resolution)/resolution.y;
 vec3 ro=vec3(0.,3.5,-4.0),target=vec3(0.,.05,.4);
 vec3 f=normalize(target-ro),right=normalize(cross(f,vec3(0,1,0))),up=cross(right,f);
 // A slightly rolled camera gives the duet a diagonal, monumental composition.
 uv=mat2(.342,-.940,.940,.342)*uv;
 // Wider framing keeps both cores inside the narrow hero column.
 vec3 rd=normalize(f*.95+right*uv.x+up*uv.y),p=ro;
 vec3 a=vec3(-.92,0.,-.05),b=vec3(1.05,.12,1.);
 vec3 light=vec3(0.);float transmission=1.;
 for(int i=0;i<112;i++){
  vec3 qa=p-a,qb=p-b;float da=length(qa),db=length(qb);
  if(da<.37||db<.30)break;
  float stepSize=clamp(min(da,db)*.095,.025,.19);
  vec3 localB=vec3(qb.x,qb.y*.99+qb.z*.12,qb.z*.99-qb.y*.12);
  vec3 emission=disc(qa,.37,time)+disc(localB,.30,-time);
  light+=transmission*emission*stepSize*3.5;
  transmission*=exp(-length(emission)*stepSize*.5);
  // Weak-field illustrative bending, projected perpendicular to each ray.
  vec3 gravity=-.24*qa/pow(da,3.)-.18*qb/pow(db,3.);
  rd=normalize(rd+(gravity-rd*dot(gravity,rd))*stepSize);
  p+=rd*stepSize;
  if(length(p)>10.||transmission<.01)break;
 }
 vec3 color=1.-exp(-light*1.5);
 color=pow(color,vec3(.85));
 // Black page background; gradual edge fade avoids a rectangular picture frame.
 float edge=1.-smoothstep(.40,.76,length((gl_FragCoord.xy/resolution-.5)*vec2(1.,.8)));
 vec2 border=min(gl_FragCoord.xy/resolution,1.-gl_FragCoord.xy/resolution);
 edge*=smoothstep(0.,.08,border.x)*smoothstep(0.,.10,border.y);
 // Composite onto the actual page color here: mobile browsers differ in
 // how they composite an unpremultiplied transparent WebGL drawing buffer.
 gl_FragColor=vec4(vec3(8./255.)+(1.-vec3(8./255.))*color*edge,1.);
}`;
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Stellar shader unavailable');return s;}
  try{
   const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Stellar renderer unavailable');gl.useProgram(program);
   const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const pos=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
   const size=gl.getUniformLocation(program,'resolution'),clock=gl.getUniformLocation(program,'time');
   const reduced=matchMedia('(prefers-reduced-motion: reduce)');let visible=true,timer=null,last=0;
   function draw(t=0){gl.uniform2f(size,canvas.width,canvas.height);gl.uniform1f(clock,t);gl.drawArrays(gl.TRIANGLES,0,6);canvas.closest('.hero-duet').classList.add('stellar-ready');revealFallback();}
   function resize(){const rect=canvas.getBoundingClientRect();const scale=Math.min(devicePixelRatio||1,1.5,900/Math.max(rect.width,rect.height));canvas.width=Math.round(rect.width*scale);canvas.height=Math.round(rect.height*scale);gl.viewport(0,0,canvas.width,canvas.height);draw(last);}
   function sync(){clearInterval(timer);timer=null;if(!reduced.matches&&!document.hidden&&visible)timer=setInterval(()=>{last+=.066;draw(last);},1000/15);}
   new ResizeObserver(resize).observe(canvas);new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(canvas);
   reduced.addEventListener('change',()=>{if(reduced.matches)draw(0);sync();});document.addEventListener('visibilitychange',sync);
   canvas.addEventListener('webglcontextlost',()=>{clearInterval(timer);canvas.closest('.hero-duet').classList.remove('stellar-ready');});
   resize();sync();
  }catch{canvas.hidden=true;revealFallback();}
 }else{revealFallback();}
}else{revealFallback();}
