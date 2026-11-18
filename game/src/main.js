import {makePlayer} from './player.js';
import {makeCar} from './vehicles.js';
import {createScene} from './render.js';

const root=document.querySelector('#view'),player=makePlayer(),car=makeCar(),keys=new Set(),params=new URLSearchParams(location.search);
player.heading=0;car.x=2;car.z=-6;
let driving=false,night=false,last=performance.now(),elapsed=0;
const hud={objective:document.querySelector('#objective'),status:document.querySelector('#status'),speed:document.querySelector('#speed'),speednum:document.querySelector('#speednum'),clock:document.querySelector('#clock')};
if(['drive','chase'].includes(params.get('shot'))){car.x=1;car.z=15;car.speed=7;player.z=19;driving=true;hud.objective.textContent='Drive the harbor service road';hud.status.textContent='DRIVING · MARINER';hud.speed.classList.remove('hide');hud.speednum.textContent='48';if(params.get('shot')==='chase'){car.x=-2;car.z=-18;car.speed=11;hud.speednum.textContent='77';}}
if(params.get('shot')==='night'){night=true;hud.clock.textContent='21:16 · BLUE HOUR';}
const world=createScene(root,player,car);
addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='KeyE')enterExit();if(e.code==='KeyN')toggleNight();if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();});addEventListener('keyup',e=>keys.delete(e.code));
function enterExit(){if(!driving&&Math.hypot(player.x-car.x,player.z-car.z)<5){driving=true;hud.objective.textContent='Drive the harbor service road';hud.status.textContent='DRIVING · MARINER';hud.speed.classList.remove('hide');}else if(driving){driving=false;player.x=car.x-2;player.z=car.z;car.speed=0;hud.status.textContent='ON FOOT';hud.speed.classList.add('hide');}}
function toggleNight(){night=!night;hud.clock.textContent=night?'21:16 · BLUE HOUR':'18:42 · GOLDEN HOUR';}
function mapDraw(){const c=document.querySelector('#mapcanvas'),x=c.getContext('2d');x.fillStyle='#52716d';x.fillRect(0,0,140,140);x.fillStyle='#364644';x.fillRect(55,0,32,140);x.fillStyle='#315f68';x.fillRect(0,0,140,23);x.fillStyle='#d3c5a2';x.fillRect(42,20,12,120);x.fillRect(87,20,12,120);x.fillStyle='#f4c477';x.beginPath();x.arc(70+(driving?car.x:player.x)*2,100-(driving?car.z:player.z)*.75,4,0,7);x.fill();}
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.04);last=now;elapsed+=dt;
  if(driving){car.speed+=(keys.has('KeyW')?12:0)-(keys.has('KeyS')?18:0);car.speed*=Math.pow(.98,dt*60);car.speed=Math.max(-7,Math.min(18,car.speed));if(Math.abs(car.speed)>.2)car.heading+=(keys.has('KeyA')?1:keys.has('KeyD')?-1:0)*dt*.85*Math.sign(car.speed);car.x+=Math.sin(car.heading)*car.speed*dt;car.z-=Math.cos(car.heading)*car.speed*dt;car.x=Math.max(-7,Math.min(7,car.x));car.z=Math.max(-48,Math.min(65,car.z));hud.speednum.textContent=String(Math.round(Math.abs(car.speed)*7)).padStart(2,'0');}
  else{const dx=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),dz=(keys.has('KeyS')?1:0)-(keys.has('KeyW')?1:0),s=keys.has('ShiftLeft')?8:5;player.x=Math.max(-8,Math.min(8,player.x+dx*s*dt));player.z=Math.max(-48,Math.min(65,player.z+dz*s*dt));if(dx||dz){player.heading=Math.atan2(dx,-dz);player.walking=keys.has('ShiftLeft')?1.5:1;}else player.walking=0;}
  world.render(dt,driving,night,elapsed,params.get('shot')==='chase');mapDraw();
}
requestAnimationFrame(frame);window.__shotReady=true;window.__renderer=world.renderer;window.__webglContext=world.renderer.getContext();window.__game={player,car,enterExit,toggleNight,isDriving:()=>driving};
