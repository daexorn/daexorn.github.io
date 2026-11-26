// Positions and sticker normals are integer vectors at the end of each legal turn.
const HALF_PI = Math.PI / 2;
const faces = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
// The original cube's four navy finishes under its cool key and hemisphere lights.
const shell = ['#03070c','#050b13','#07101b','#091525'];
export const homeView = Object.freeze({yaw:-Math.PI/4, pitch:Math.atan(1/Math.sqrt(2)), lift:0, tilt:0});
const add = (a,b) => a.map((v,i) => v+b[i]);
const scale = (v,n) => v.map(x => x*n);
const dot = (a,b) => a.reduce((sum,x,i) => sum+x*b[i],0);
const cross = ([a,b,c],[d,e,f]) => [b*f-c*e,c*d-a*f,a*e-b*d];

function rotate(vector,axis,angle) {
  const [x,y,z] = vector;
  const c = Math.cos(angle), s = Math.sin(angle);
  if (axis === 0) return [x,c*y-s*z,s*y+c*z];
  if (axis === 1) return [c*x+s*z,y,-s*x+c*z];
  return [c*x-s*y,s*x+c*y,z];
}

export function turn(pieces, axis, layer, direction) {
  const snap = vector => rotate(vector,axis,direction*HALF_PI).map(Math.round);
  for (const piece of pieces.filter(p => p.center[axis] === layer)) {
    piece.center = snap(piece.center);
    for (const face of piece.faces) {
      face.normal = snap(face.normal);
      face.tangent = snap(face.tangent);
    }
  }
}

export function makeCube() {
  const pieces = [];
  for (const x of [-1,0,1]) for (const y of [-1,0,1]) for (const z of [-1,0,1]) {
    if (!x && !y && !z) continue;
    const center = [x,y,z];
    pieces.push({center, faces:faces.map((normal, side) => {
      const [u,v] = side < 2 ? [y,z] : side < 4 ? [x,z] : [x,y];
      return {
        normal:[...normal], tangent:normal[0] ? [0,0,1] : [1,0,0],
        color:dot(center,normal) === 1 ? shell[Math.abs(side+u*2+v*3+8)%4] : null,
        finish:Math.abs(side*5+u*3+v*7+11)%7
      };
    })});
  }
  turn(pieces,0,1,1);
  turn(pieces,1,1,-1);
  turn(pieces,2,-1,1);
  return pieces;
}

function camera(v,viewpoint) {
  return rotate(rotate(rotate(v,1,viewpoint.yaw),0,viewpoint.pitch+viewpoint.tilt),2,-viewpoint.tilt);
}
function project(v) {
  const k = 94 * 31 / (31-v[2]);
  return [256+v[0]*k,256-v[1]*k];
}
function rounded(points, radius) {
  const towards = (from,to) => from.map((v,i) => v+(to[i]-v)*radius);
  const xy = p => p.map(n => n.toFixed(2)).join(' ');
  return points.map((pt,i) => {
    const before = towards(pt,points[(i+3)%4]);
    const after = towards(pt,points[(i+1)%4]);
    return (i ? 'L' : 'M')+xy(before)+'Q'+xy(pt)+' '+xy(after);
  }).join('')+'Z';
}
function tone(hex, gain, lift=0) {
  const n=parseInt(hex.slice(1),16);
  return '#'+[n>>16,(n>>8)&255,n&255].map(v=>Math.max(0,Math.min(255,Math.round(v*gain+lift))).toString(16).padStart(2,'0')).join('');
}

// Etch the original line, dot and grid finishes in the tile's own coordinates.
function etching(finish,point) {
  const paths=[];
  const pair = (a,b) => paths.push('M'+point(...a)+'L'+point(...b));
  for (let i=-.38; i<.41; i+=.073) {
    if (finish===2 || finish===5) pair([i,-.43],[i,.43]);
    if (finish===3 || finish===5) pair([-.43,i],[.43,i]);
    if (finish===4) pair([i-.45,-.45],[i+.45,.45]);
    if (finish===1 || finish===6) {
      for (let j=-.38;j<.41;j+=.085) pair([i,j],[i+.009,j+.009]);
    }
  }
  return paths.join('');
}

// The still image and the animated canvas share the same projection and materials.
export function geometry(pieces, move=null, viewpoint=homeView) {
  const visible=[];
  for (const piece of pieces) {
    const turning = move && piece.center[move.axis] === move.layer;
    const view = v => camera(turning ? rotate(v,move.axis,move.angle) : v,viewpoint);
    const center = view(piece.center);
    center[1]+=viewpoint.lift;
    for (const face of piece.faces) {
      const n=view(face.normal);
      const position=add(center,scale(n,.5));
      if (dot(n,[-position[0],-position[1],31-position[2]]) <= 0) continue;
      const across = face.tangent;
      const u=view(across), v=view(cross(face.normal,across));
      const square = (size, plane=position) => [[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b]) =>
        project(add(plane,add(scale(u,a*size),scale(v,b*size)))));
      const light=Math.max(.12,.42+.46*n[1]+.26*n[2]-.18*n[0]);
      const origin = project(position);
      const dx = project(add(position,u)), dy = project(add(position,v));
      const specular = face.finish===0 || face.finish===4 ? 1.25 : .83;
      visible.push({
        depth:position[2], body:rounded(square(.5),.12), plastic:tone('#101a28',.85+light*.42),
        sticker:face.color && rounded(square(.41,add(position,scale(n,.0246))),.15),
        finish:face.finish,
        textureMatrix:[dx[0]-origin[0],dx[1]-origin[1],dy[0]-origin[0],dy[1]-origin[1],...origin],
        edge:tone('#7895b7',light*.65),
        light:face.color && tone(face.color,1.65,light*34*specular),
        dark:face.color && tone(face.color,1.3,light*7)
      });
    }
  }
  return visible.sort((a,b)=>a.depth-b.depth);
}

export function mountCube(canvas) {
  const ctx=canvas.getContext('2d');
  if (!ctx) return;
  const pieces=makeCube(), reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const viewpoint={...homeView};
  const scene=canvas.parentElement;
  const etchings=Array.from({length:7},(_,finish)=>new Path2D(etching(finish,(x,y)=>x+' '+y)));
  let move=null, frame=0, lastTime=null, onScreen=false, sequence=0;
  let paused=reduced.matches, drag=null, dragged=false, untilTurn=850;
  const moves=[[2,1,1],[1,1,-1],[0,0,1],[2,-1,-1],[0,1,1],[1,0,-1],
    [2,0,1],[0,-1,-1],[1,-1,1],[2,1,-1],[1,1,1],[0,1,-1]];
  let studio = null;
  let ready = false;
  let dragTarget = null;
  let manualTurn = false;
  let renderWidth = scene.clientWidth;
  let pixelRatio = Math.min(devicePixelRatio || 1, 1.5);
  let samples = 0, lateFrames = 0;
  function sampleFrameTime(ms) {
    if (!studio || ms<=0 || ms>150 || pixelRatio<=.8) return;
    samples++;
    if (ms>22) lateFrames++;
    if (samples===40) {
      if (lateFrames>=10) pixelRatio=Math.max(.8,pixelRatio*.85);
      samples=lateFrames=0;
    }
  }
  function draw() {
    if (!ready) return;
    if (studio) {
      studio.draw(Math.max(1,Math.round(renderWidth*pixelRatio)),move,viewpoint);
      return;
    }
    const size=Math.max(1,Math.round(renderWidth*Math.min(devicePixelRatio||1,1.5)));
    if (canvas.width!==size || canvas.height!==size) canvas.width=canvas.height=size;
    ctx.setTransform(size/512,0,0,size/512,0,0);
    ctx.clearRect(0,0,512,512);
    for (const f of geometry(pieces,move,viewpoint)) {
      const body=new Path2D(f.body);
      ctx.fillStyle=f.plastic; ctx.fill(body);
      ctx.strokeStyle='#02050b';ctx.lineWidth=1.3;ctx.stroke(body);
      if (!f.sticker) continue;
      const tile=new Path2D(f.sticker);
      const [dx,dy,,,x,y]=f.textureMatrix;
      const glaze=ctx.createLinearGradient(x-dx*.6,y-dy*.6-20,x+dx*.6,y+dy*.6+20);
      glaze.addColorStop(0,f.light);
      const polished=f.finish===0 || f.finish===4;
      const shine=.48+.28*Math.sin(viewpoint.yaw+x/210);
      glaze.addColorStop(shine,tone(f.light,polished ? 2.3 : 1.25,polished ? 16 : 6));
      glaze.addColorStop(1,f.dark);
      ctx.fillStyle=glaze;ctx.fill(tile);
      if (f.finish!==0) {
        ctx.save();ctx.clip(tile);
        ctx.transform(...f.textureMatrix);
        ctx.strokeStyle='rgba(130,155,188,.22)';ctx.lineWidth=.009;
        ctx.stroke(etchings[f.finish]);ctx.restore();
      }
      ctx.strokeStyle=f.edge;ctx.lineWidth=1.15;ctx.stroke(tile);
    }
  }
  function startTurn(manual=false) {
    if (move) {
      if (manual) manualTurn=true;
      return;
    }
    manualTurn=manual;
    const [axis,layer,direction]=moves[sequence++%moves.length];
    if (reduced.matches && paused) {
      turn(pieces,axis,layer,direction);
      studio?.invalidate();
      manualTurn=false;
      draw();
    } else {
      move={axis,layer,direction,elapsed:0,angle:0};
    }
    untilTurn=1320;
  }

  // Group four layer moves between eased revolutions of the entire cube.
  const spinStart=5500, spinDuration=5200, turnDuration=600;
  const orbitPeriod=spinStart+spinDuration+300;
  let orbitTime=0;
  function orbitAngle(ms) {
    const progress=Math.max(0,Math.min(1,(ms%orbitPeriod-spinStart)/spinDuration));
    const eased=progress<.5 ? 4*progress**3 : 1-4*(1-progress)**3;
    return -2*Math.PI*(Math.floor(ms/orbitPeriod)+eased);
  }
  function schedule() {
    const moving = !paused && !drag || move && manualTurn || dragTarget;
    if (ready && !frame && onScreen && !document.hidden && moving) frame=requestAnimationFrame(tick);
  }
  function tick(now) {
    frame=0;
    if (!onScreen || document.hidden) return;
    const elapsed=lastTime===null ? 0 : now-lastTime;
    sampleFrameTime(elapsed);
    const dt=Math.min(elapsed,48);
    lastTime=now;
    if (dragTarget) {
      const blend=reduced.matches ? 1 : 1-Math.exp(-dt/35);
      viewpoint.yaw+=(dragTarget.yaw-viewpoint.yaw)*blend;
      viewpoint.pitch+=(dragTarget.pitch-viewpoint.pitch)*blend;
      if (Math.abs(dragTarget.yaw-viewpoint.yaw)+Math.abs(dragTarget.pitch-viewpoint.pitch)<.001) dragTarget=null;
    } else if (!paused && !drag) {
      const next=orbitTime+dt;
      viewpoint.yaw+=orbitAngle(next)-orbitAngle(orbitTime);
      orbitTime=next;
      const wave=Math.sin(orbitTime*Math.PI/1500);
      viewpoint.lift=.06*wave;
      viewpoint.tilt=.005*wave;
      untilTurn-=dt;
      if (untilTurn<=0 && orbitTime%orbitPeriod<=spinStart-turnDuration) startTurn();
    }
    if (move && (manualTurn || (!paused && !drag))) {
      move.elapsed+=dt;
      const t=Math.min(1,move.elapsed/turnDuration);
      const eased=(1-Math.cos(t*Math.PI))/2;
      move.angle=move.direction*HALF_PI*eased;
      if (t===1) {
        turn(pieces,move.axis,move.layer,move.direction);
        studio?.invalidate();
        move=null;
        manualTurn=false;
      }
    }
    draw();
    schedule();
  }
  function refresh() {
    cancelAnimationFrame(frame);frame=0;lastTime=null;
    schedule();
  }

  new ResizeObserver(()=>{
    renderWidth=scene.clientWidth;
    draw();
  }).observe(scene);
  const panel=scene.closest('.scene-panel');
  let intersects=false;
  function checkVisibility() {
    const visible=intersects && (!panel || getComputedStyle(panel).visibility!=='hidden');
    if (visible!==onScreen) { onScreen=visible;refresh(); }
  }
  new IntersectionObserver(([entry])=>{intersects=entry.isIntersecting;checkVisibility();}).observe(scene);
  if (panel) new MutationObserver(checkVisibility).observe(panel,{attributes:true,attributeFilter:['class']});
  scene.addEventListener('pointerdown',event=>{
    if (!event.isPrimary || event.button!==0) return;
    dragged=false;
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:viewpoint.yaw,pitch:viewpoint.pitch};
    scene.setPointerCapture(event.pointerId);
  });
  scene.addEventListener('pointermove',event=>{
    if (!drag || drag.id!==event.pointerId) return;
    const dx=event.clientX-drag.x, dy=event.clientY-drag.y;
    if (!dragged && Math.hypot(dx,dy)<5) return;
    dragged=true;
    dragTarget={yaw:drag.yaw+dx*.009,pitch:Math.max(-1.45,Math.min(1.45,drag.pitch+dy*.009))};
    schedule();
  });
  scene.addEventListener('lostpointercapture',()=>{drag=null;refresh();});
  scene.addEventListener('click',event=>{
    if (!dragged || event.detail===0) { startTurn(true);schedule(); }
    dragged=false;
  });
  reduced.addEventListener('change',()=>{
    paused=reduced.matches;
    if (paused && move) {
      turn(pieces,move.axis,move.layer,move.direction);
      studio?.invalidate();
      move=null;
      manualTurn=false;
      draw();
    }
    requestAnimationFrame(checkVisibility);
    refresh();
  });
  document.addEventListener('visibilitychange',refresh);
  draw();

  // A blocked or lost WebGL context leaves the animated 2D renderer available.
  const surface = document.createElement('canvas');
  surface.setAttribute('aria-hidden','true');
  function startRenderer() {
    ready=true;
    renderWidth=scene.clientWidth;
    draw();
    scene.classList.add('is-drawn');
    refresh();
  }
  if (!surface.getContext('webgl2',{alpha:true,antialias:true,powerPreference:'low-power'})) {
    startRenderer();
    return;
  }
  import('./cube-lighting.mjs?v=80fc047dc0').then(({createStudioCube})=>{
    studio=createStudioCube(surface,pieces);
    surface.addEventListener('webglcontextlost',()=>{
      studio?.dispose();
      studio=null;
      surface.remove();
      canvas.hidden=false;
      startRenderer();
    },{once:true});
    scene.append(surface);
    canvas.hidden=true;
    startRenderer();
  }).catch(()=>{
    studio?.dispose();
    studio=null;
    surface.remove();
    canvas.hidden=false;
    startRenderer();
  });
}
