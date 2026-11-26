import { mountCube } from './cube.mjs?v=bdcd03778f';

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

// Native scrolling handles easing, anchor history and compositor timing.
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let destination = null;
window.addEventListener('scrollend',()=>{destination=null;});
window.addEventListener('hashchange',()=>{destination=null;});
window.addEventListener('pointerdown',()=>{destination=null;},{passive:true});
window.addEventListener('resize',()=>{destination=null;});

// Keep tall sections readable, including at large text sizes and in landscape.
function scrollStep(direction, distance) {
  const top = destination ?? scrollY;
  const current = sections.findLastIndex(section => section.offsetTop <= top + 2);
  const section = sections[Math.max(0,current)];
  const start = section.offsetTop;
  const end = Math.max(start,start + section.offsetHeight - innerHeight);
  let next;
  if (direction > 0) {
    next = top < end-2 ? Math.min(end,top+distance) : sections[current+1]?.offsetTop ?? document.documentElement.scrollHeight;
  } else if (top > end+2) {
    next = end;
  } else if (top > start+2) {
    next = Math.max(start,top-distance);
  } else {
    const previous = sections[current-1];
    next = previous ? Math.max(previous.offsetTop,start-innerHeight) : 0;
  }
  const reading = direction > 0 ? next > start && next < end-2 : next > start+2 && next < end;
  next = Math.max(0,Math.min(next,document.documentElement.scrollHeight-innerHeight));
  const animate = !reading && !motionPreference.matches;
  destination = animate && Math.abs(next-scrollY)>1 ? next : null;
  window.scrollTo({top:next,behavior:animate ? 'smooth' : 'instant'});
  return reading;
}

let wheelTime = -Infinity, wheelDirection = 0, stepped = false, accumulated = 0;
window.addEventListener('wheel',event=>{
  if (!event.cancelable || event.ctrlKey || event.shiftKey || Math.abs(event.deltaX)>Math.abs(event.deltaY) || !event.deltaY) return;
  const direction = Math.sign(event.deltaY);
  const now = performance.now();
  if (now-wheelTime>145 || direction!==wheelDirection) {
    stepped=false;
    accumulated=0;
  }
  wheelTime=now;
  wheelDirection=direction;
  event.preventDefault();
  if (stepped) return;
  const unit = event.deltaMode===1 ? 16 : event.deltaMode===2 ? innerHeight : 1;
  accumulated+=Math.abs(event.deltaY)*unit;
  if (accumulated<8) return;
  const reading = scrollStep(direction,accumulated);
  accumulated=0;
  stepped=!reading;
},{passive:false});

window.addEventListener('keydown',event=>{
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.target.closest('input,select,textarea,[contenteditable=true]')) return;
  const directions = {ArrowDown:1,PageDown:1,ArrowUp:-1,PageUp:-1,' ':event.shiftKey ? -1 : 1};
  if (!(event.key in directions) || event.key===' ' && event.target.closest('button,a,summary')) return;
  event.preventDefault();
  if (!event.repeat) scrollStep(directions[event.key],innerHeight*.8);
});

let swipe = null;
window.addEventListener('touchstart',event=>{
  const point=event.touches[0];
  swipe=event.touches.length===1 && (window.visualViewport?.scale ?? 1)===1
    ? {x:point.clientX,y:point.clientY,section:sections.find(s=>s.contains(event.target)),claimed:false} : null;
},{passive:true});
window.addEventListener('touchmove',event=>{
  if (!swipe?.section || !event.cancelable) return;
  const dx=event.touches[0].clientX-swipe.x, dy=event.touches[0].clientY-swipe.y;
  if (!swipe.claimed) {
    if (Math.abs(dx)>Math.abs(dy) || Math.abs(dy)<3) return;
    const rect=swipe.section.getBoundingClientRect();
    if (dy<0 && rect.bottom>innerHeight+2 || dy>0 && rect.top < -2) return;
    swipe.claimed=true;
  }
  event.preventDefault();
},{passive:false});
window.addEventListener('touchend',event=>{
  if (swipe?.claimed) {
    const dy=swipe.y-event.changedTouches[0].clientY;
    if (Math.abs(dy)>32) scrollStep(Math.sign(dy),innerHeight*.8);
  }
  swipe=null;
},{passive:true});
window.addEventListener('touchcancel',()=>{swipe=null;},{passive:true});

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
