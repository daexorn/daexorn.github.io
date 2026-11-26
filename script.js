import { mountCube } from './cube.mjs?v=667a54c1b2';

const canvas = document.querySelector('.cube canvas');
if (canvas) mountCube(canvas);

// The red and green channels encode the horizontal and vertical displacement
// of a rounded lens. The centre stays neutral so text behind it stays legible.
const dock=document.querySelector('.site-header');
if (CSS.supports('backdrop-filter','url(#nav-lens)') && /Chrome|Chromium|Edg\//.test(navigator.userAgent)) {
  const map=document.querySelector('#lens-map');
  const paintLens=()=>{
    const width=dock.clientWidth, height=dock.clientHeight, radius=17, rim=8;
    if (!width || !height) return;
    const stamp=document.createElement('canvas');
    stamp.width=width;stamp.height=height;
    const ctx=stamp.getContext('2d');
    if (!ctx) return;
    const pixels=ctx.createImageData(width,height);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const dx=x-Math.max(radius,Math.min(width-radius,x));
      const dy=y-Math.max(radius,Math.min(height-radius,y));
      const length=Math.hypot(dx,dy);
      const depth=radius-length;
      const bend=depth>=0 && depth<rim ? Math.sin(Math.PI*depth/rim) : 0;
      const i=4*(y*width+x);
      pixels.data[i]=128+112*bend*dx/(length||1);
      pixels.data[i+1]=128+112*bend*dy/(length||1);
      pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);
    map.setAttribute('href',stamp.toDataURL());
    dock.classList.add('has-lens');
  };
  new ResizeObserver(paintLens).observe(dock);
}

const sections = [...document.querySelectorAll('main > section')];
const indexLinks = [...document.querySelectorAll('.section-index a, .site-header nav a')];
function updateNav() {
  const current = sections.findLast(section => section.getBoundingClientRect().top <= innerHeight / 2) || sections[0];
  for (const section of sections) section.classList.toggle('is-current',section===current);
  for (const link of indexLinks) {
    link.toggleAttribute('data-past',sections.indexOf(document.getElementById(link.hash.slice(1)))<sections.indexOf(current));
    if (link.hash === '#' + current.id) link.setAttribute('aria-current','location');
    else link.removeAttribute('aria-current');
  }
}
window.addEventListener('scroll',updateNav,{passive:true});
window.addEventListener('resize',updateNav);
updateNav();
import('./assets/moments/moments.js').then(async ({ready})=>{
  await ready;
  document.querySelectorAll('#about .mo-w').forEach((word,index)=>word.style.setProperty('--word-order',index));
});

// A short drag exposes the next section. Crossing the detent commits one page.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let glideFrame = 0;
let pull = null;
let releaseTimer = 0;
let wheelCommitted = false;
let finger = null;

function clearGesture() {
  clearTimeout(releaseTimer);
  cancelAnimationFrame(glideFrame);
  glideFrame=0;
  pull=null;
  wheelCommitted=false;
}
window.addEventListener('resize',clearGesture);
window.addEventListener('hashchange',clearGesture);
document.addEventListener('click',event=>{
  if (event.target.closest('a[href^="#"]')) clearGesture();
});

function glide(target, duration, then) {
  cancelAnimationFrame(glideFrame);
  const from=scrollY, distance=target-from, start=performance.now();
  function finish() {
    window.scrollTo({top:target,behavior:'instant'});
    glideFrame=0;
    then?.();
  }
  function advance(now) {
    const t=Math.min(1,(now-start)/duration);
    if (t>=1) return finish();
    const ease=1-(1-t)**3;
    window.scrollTo({top:from+distance*ease,behavior:'instant'});
    glideFrame=requestAnimationFrame(advance);
  }
  if (motionPreference.matches || Math.abs(distance)<1) finish();
  else glideFrame=requestAnimationFrame(advance);
}

// Taller sections scroll normally until the reader arrives at their far edge.
function bounds(top,direction) {
  const index=Math.max(0,sections.findLastIndex(section=>section.offsetTop<=top+1));
  const section=sections[index], start=section.offsetTop;
  const end=Math.max(start,start+section.offsetHeight-innerHeight);
  if (direction>0 && top<end-1) return {limit:end,reading:true};
  if (direction<0 && top>start+1) return {limit:start,reading:true};
  if (direction<0) return {limit:Math.max(sections[index-1]?.offsetTop ?? 0,start-innerHeight),reading:false};
  return {limit:sections[index+1]?.offsetTop ?? end,reading:false};
}

function releasePull() {
  const pending=pull;
  pull=null;
  if (pending) glide(pending.origin,170);
}
function pullBy(delta) {
  if (!delta || glideFrame) return false;
  const origin=pull?.origin ?? scrollY;
  const amount=(pull?.amount ?? 0)+delta;
  const direction=Math.sign(amount);
  const {limit,reading}=bounds(origin,direction);
  if (reading || !direction || limit===origin) {
    pull=null;
    const offset=reading ? direction*Math.min(Math.abs(amount),Math.abs(limit-origin)) : 0;
    window.scrollTo({top:origin+offset,behavior:'instant'});
    return false;
  }
  const threshold=Math.min(98,Math.max(62,innerHeight*.105));
  const preview=origin+direction*Math.min(Math.abs(limit-origin)*.3,Math.min(threshold,Math.abs(amount))*.87);
  if (Math.abs(amount)<threshold) {
    pull={origin,amount};
    if (!motionPreference.matches) window.scrollTo({top:preview,behavior:'instant'});
    return false;
  }
  pull=null;
  // A notched mouse can send the whole threshold in one event. Give its initial
  // nudge a frame of its own before completing the same snap as a finger drag.
  const finish=()=>glide(limit,260);
  if (Math.abs(preview-scrollY)>20) glide(preview,90,finish);
  else finish();
  return true;
}

window.addEventListener('wheel',event=>{
  if (!event.cancelable || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX)>Math.abs(event.deltaY) || !event.deltaY) return;
  event.preventDefault();
  clearTimeout(releaseTimer);
  const unit=event.deltaMode===1 ? 16 : event.deltaMode===2 ? innerHeight : 1;
  if (!wheelCommitted) wheelCommitted=pullBy(event.deltaY*unit);
  releaseTimer=setTimeout(()=>{
    wheelCommitted=false;
    releasePull();
  },200);
},{passive:false});

window.addEventListener('touchstart',event=>{
  if (event.touches.length!==1 || (window.visualViewport?.scale ?? 1)!==1) {
    finger=null;
    releasePull();
    return;
  }
  if (!event.target.closest('main > section')) return;
  const {clientX:x,clientY:y}=event.touches[0];
  finger={x,y,lastY:y,vertical:false,committed:false};
},{passive:true});
window.addEventListener('touchmove',event=>{
  if (!finger || !event.cancelable) return;
  const {clientX:x,clientY:y}=event.touches[0];
  if (!finger.vertical) {
    if (Math.abs(x-finger.x)>Math.abs(y-finger.y)) {finger=null;return;}
    if (Math.abs(y-finger.y)<2) return;
    finger.vertical=true;
  }
  event.preventDefault();
  if (!finger.committed) finger.committed=pullBy(finger.lastY-y);
  finger.lastY=y;
},{passive:false});
function endTouch() {
  if (finger) releasePull();
  finger=null;
}
window.addEventListener('touchend',endTouch,{passive:true});
window.addEventListener('touchcancel',endTouch,{passive:true});

window.addEventListener('keydown',event=>{
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,select,textarea,[contenteditable=true]')) return;
  const directions={ArrowDown:1,PageDown:1,ArrowUp:-1,PageUp:-1,' ':event.shiftKey ? -1 : 1};
  const direction=directions[event.key];
  if (!direction || event.key===' ' && event.target.closest('button,a,summary')) return;
  event.preventDefault();
  if (event.repeat || glideFrame) return;
  const top=pull?.origin ?? scrollY;
  clearGesture();
  const {limit,reading}=bounds(top,direction);
  glide(reading ? top+direction*Math.min(innerHeight*.8,Math.abs(limit-top)) : limit,260);
});

// Everything stays readable without script and when a visitor follows an anchor.
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const arrival = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('section-arrives');
      arrival.unobserve(entry.target);
    }
  }, {threshold: 0.08});
  document.querySelectorAll('main > section:not(.hero) > .wrap').forEach(el => arrival.observe(el));
}

const sampleToggle = document.querySelector('#sample-toggle');
const slowReply = document.querySelector('.samples .slow');
sampleToggle.hidden = false;
sampleToggle.addEventListener('click', () => {
  const includeSlow = slowReply.hidden;
  slowReply.hidden = !includeSlow;
  sampleToggle.setAttribute('aria-pressed', String(includeSlow));
  const times = [...document.querySelectorAll('.samples li:not([hidden])')].map(item => Number(item.textContent));
  const middle = (times.length - 1) / 2;
  const mean = times.reduce((total, time) => total + time, 0) / times.length;
  const median = (times[Math.floor(middle)] + times[Math.ceil(middle)]) / 2;
  document.querySelector('#mean').textContent = mean + ' s';
  document.querySelector('#median').textContent = median + ' s';
});

const quarterTurn = document.querySelector('#quarter-turn');
const diagram = document.querySelector('.turn-diagram');
const corners = ['top left', 'top right', 'bottom right', 'bottom left'];
let turns = 0;
quarterTurn.hidden = false;
quarterTurn.addEventListener('click', () => {
  turns++;
  diagram.style.transform = 'rotate(' + (turns * 90) + 'deg)';
  diagram.setAttribute('aria-label', 'Marked tile in the ' + corners[turns % 4] + ' corner');
  document.querySelector('#degrees').textContent = (turns % 4 * 90) + '°';
});
