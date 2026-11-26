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

// The document owns scrolling. Every pose is derived from the same scroll position
// whether the visitor uses touch, a wheel, a keyboard or an anchor link.
const hero = document.querySelector('.hero');
const scene = hero.querySelector('.hero-layout');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const entrances = [...document.querySelectorAll('[data-reveal]')];
let sceneFrame = 0;
let observer;

function paintScene() {
  sceneFrame = 0;
  const travel = hero.offsetHeight - scene.offsetHeight;
  const progress = travel > 0 ? Math.max(0, Math.min(1, -hero.getBoundingClientRect().top / travel)) : 0;
  scene.style.setProperty('--travel', progress.toFixed(4));
}
function scheduleScene() {
  if (!sceneFrame && !motionPreference.matches) sceneFrame = requestAnimationFrame(paintScene);
}
function configureMotion() {
  observer?.disconnect();
  observer = null;
  cancelAnimationFrame(sceneFrame);
  sceneFrame = 0;
  hero.classList.toggle('scroll-scene', !motionPreference.matches);
  for (const item of entrances) item.classList.remove('awaiting-entry');
  if (motionPreference.matches) {
    scene.style.removeProperty('--travel');
    return;
  }
  paintScene();
  if (!('IntersectionObserver' in window)) return;
  observer = new IntersectionObserver(entries => {
    for (const {target,isIntersecting,boundingClientRect} of entries) {
      if (isIntersecting) target.classList.remove('awaiting-entry');
      else if (boundingClientRect.top >= innerHeight * .94) target.classList.add('awaiting-entry');
    }
  }, {rootMargin:'0px 0px -6% 0px'});
  for (const item of entrances) {
    if (item.getBoundingClientRect().top >= innerHeight) item.classList.add('awaiting-entry');
    observer.observe(item);
  }
}
window.addEventListener('scroll',scheduleScene,{passive:true});
window.addEventListener('resize',scheduleScene);
new ResizeObserver(scheduleScene).observe(scene);
motionPreference.addEventListener('change',configureMotion);
configureMotion();

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
