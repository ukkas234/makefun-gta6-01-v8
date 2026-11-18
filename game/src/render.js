import * as THREE from '../vendor/three.module.js';

const mat=(color,extra={})=>new THREE.MeshLambertMaterial({color,...extra});
const boxGeo=new THREE.BoxGeometry(1,1,1);
function cube(parent,material,x,y,z,sx,sy,sz){const o=new THREE.Mesh(boxGeo,material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=false;o.receiveShadow=false;parent.add(o);return o;}

export function createScene(root,player,car){
  const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.25));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;
  root.appendChild(renderer.domElement);renderer.domElement.id='world';
  const scene=new THREE.Scene();scene.background=new THREE.Color('#a7b8ad');scene.fog=new THREE.Fog('#a7b8ad',48,145);
  const camera=new THREE.PerspectiveCamera(64,innerWidth/innerHeight,.1,220);
  scene.add(new THREE.HemisphereLight('#d7dfd1','#52665f',2.05));const sun=new THREE.DirectionalLight('#ffe0a1',2.1);sun.position.set(-24,38,15);scene.add(sun);
  const ground=mat('#d6c49d'),road=mat('#4d5552'),curb=mat('#bdb59f'),water=mat('#315f68'),cream=mat('#cbb995'),teal=mat('#71918a'),terra=mat('#bc7655'),sand=mat('#d3c3a1'),dark=mat('#263432'),glass=mat('#31535a'),leaf=mat('#51705b'),trunk=mat('#80634b');
  cube(scene,ground,0,-.3,0,260,.5,260);cube(scene,road,0,-.02,0,18,.12,150);cube(scene,curb,-10,.02,0,2,.18,150);cube(scene,curb,10,.02,0,2,.18,150);cube(scene,water,-40,-.03,0,54,.1,160);cube(scene,curb,-14,.12,-30,.45,.5,105);
  const stripeMat=mat('#d4c49a'),stripeCount=12,stripes=new THREE.InstancedMesh(boxGeo,stripeMat,stripeCount),stripeMatrix=new THREE.Matrix4();
  for(let i=0;i<stripeCount;i++){stripeMatrix.makeScale(.2,.035,5);stripeMatrix.setPosition(0,.06,-66+i*12);stripes.setMatrixAt(i,stripeMatrix);}stripes.instanceMatrix.needsUpdate=true;scene.add(stripes);
  const buildings=[[-23,4,20,16,22,cream],[24,6,23,21,24,teal],[-20,39,18,13,20,terra],[23,42,22,18,20,sand]];
  const windowMat=mat('#f3c77b',{emissive:'#ad7941',emissiveIntensity:.4});
  const windowPositions=[];
  for(const [x,z,w,d,h,m] of buildings){cube(scene,m,x,h/2,z,w,h,d);cube(scene,dark,x,h+.18,z,w+.4,.35,d+.4);for(let yy=3;yy<h-2;yy+=4)for(let xx=-w/2+2;xx<w/2-1;xx+=4)windowPositions.push([x+xx,yy,z-d/2-.04]);}
  const windowInstances=new THREE.InstancedMesh(boxGeo,windowMat,windowPositions.length),windowMatrix=new THREE.Matrix4();
  windowPositions.forEach(([x,y,z],i)=>{windowMatrix.makeScale(1.4,1.6,.08);windowMatrix.setPosition(x,y,z);windowInstances.setMatrixAt(i,windowMatrix);});windowInstances.instanceMatrix.needsUpdate=true;scene.add(windowInstances);
  // Distant harbor skyline and pier shapes.
  const skylineA=[],skylineB=[];for(let i=0;i<11;i++){const x=-62+i*12,h=9+(i%4)*5;(i%2?skylineA:skylineB).push([x,h]);}
  for(const [items,material] of [[skylineA,teal],[skylineB,terra]]){const buildingsMesh=new THREE.InstancedMesh(boxGeo,material,items.length),m4=new THREE.Matrix4();items.forEach(([x,h],i)=>{m4.makeScale(9,h,8);m4.setPosition(x,h/2,-72);buildingsMesh.setMatrixAt(i,m4);});buildingsMesh.instanceMatrix.needsUpdate=true;scene.add(buildingsMesh);}
  cube(scene,mat('#766b57'),-27,.15,-17,17,.3,4);for(let i=0;i<8;i++)cube(scene,trunk,-34+i*2,.3,-17,.12,.6,.12);
  // Original storefront signs.
  for(const [x,z,label] of [[-23,4,'TIDE / GOODS'],[24,6,'MARINER / CLUB'],[-20,39,'SALTLINE / CAFE']]){
    const sign=cube(scene,mat('#213b3b'),x,3.2,z-8,7,1.1,.2);sign.material=mat('#274746');
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const c=canvas.getContext('2d');c.fillStyle='#274746';c.fillRect(0,0,512,96);c.fillStyle='#f2cb83';c.font='bold 48px sans-serif';c.textAlign='center';c.fillText(label,256,64);const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;const board=new THREE.Mesh(new THREE.PlaneGeometry(6.8,.95),new THREE.MeshBasicMaterial({map:tex}));board.position.set(x,3.2,z-8.12);scene.add(board);
  }
  // Palm trunks and chunky fronds.
  const palms=[[-14,-22],[-14,3],[-14,31],[-14,57],[14,-25],[14,22],[14,52]],trunkInstances=new THREE.InstancedMesh(boxGeo,trunk,palms.length),frondInstances=new THREE.InstancedMesh(boxGeo,leaf,palms.length*6),dummy=new THREE.Object3D();
  palms.forEach(([x,z],i)=>{dummy.position.set(x,4.3,z);dummy.rotation.set(0,0,0);dummy.scale.set(.45,8.6,.45);dummy.updateMatrix();trunkInstances.setMatrixAt(i,dummy.matrix);for(let a=0;a<6;a++){dummy.position.set(x+Math.sin(a*Math.PI/3)*2.2,8.7,z+Math.cos(a*Math.PI/3)*2.2);dummy.rotation.set(-.16,a*Math.PI/3,0);dummy.scale.set(1.1,.16,4.7);dummy.updateMatrix();frondInstances.setMatrixAt(i*6+a,dummy.matrix);}});trunkInstances.instanceMatrix.needsUpdate=true;frondInstances.instanceMatrix.needsUpdate=true;scene.add(trunkInstances,frondInstances);
  const lampMat=mat('#f2cd8a',{emissive:'#d18c4c',emissiveIntensity:.35}),lampZ=Array.from({length:5},(_,i)=>-54+i*24),poles=new THREE.InstancedMesh(boxGeo,trunk,lampZ.length),lamps=new THREE.InstancedMesh(boxGeo,lampMat,lampZ.length);
  lampZ.forEach((z,i)=>{dummy.position.set(-11,3.3,z);dummy.rotation.set(0,0,.02);dummy.scale.set(.16,6.6,.16);dummy.updateMatrix();poles.setMatrixAt(i,dummy.matrix);dummy.position.set(-10.6,6.4,z);dummy.rotation.set(0,0,0);dummy.scale.set(.9,.18,.25);dummy.updateMatrix();lamps.setMatrixAt(i,dummy.matrix);});poles.instanceMatrix.needsUpdate=true;lamps.instanceMatrix.needsUpdate=true;scene.add(poles,lamps);
  const kai=new THREE.Group();scene.add(kai);const skin=mat('#bd896b'),shirt=mat('#d06d43'),pants=mat('#253c3d'),shoe=mat('#414d4b');
  cube(kai,pants,0,1.1,0,.8,1.05,.45);cube(kai,shirt,0,2.05,0,1.05,1.1,.58);const head=new THREE.Mesh(new THREE.SphereGeometry(.38,7,5),skin);head.position.y=2.92;kai.add(head);cube(kai,mat('#31535a'),0,2.65,-.02,.65,.3,.64);
  const arms=[],legs=[];for(const x of [-.72,.72]){const a=cube(kai,shirt,x,1.98,0,.3,1,.34);arms.push(a);}for(const x of [-.25,.25]){const l=cube(kai,pants,x,.47,0,.34,.9,.4);legs.push(l);cube(kai,shoe,x,.08,-.12,.4,.18,.6);}
  const vehicle=new THREE.Group();scene.add(vehicle);cube(vehicle,terra,0,.72,0,2.15,.75,4.35);cube(vehicle,glass,0,1.35,-.25,1.62,.72,2.12);cube(vehicle,mat('#f0cb83',{emissive:'#986b36',emissiveIntensity:.3}),-.78,.75,-2.19,.35,.2,.08);cube(vehicle,mat('#f0cb83',{emissive:'#986b36',emissiveIntensity:.3}),.78,.75,-2.19,.35,.2,.08);
  const wheels=[];for(const x of [-1.05,1.05])for(const z of [-1.35,1.35]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,.28,8),mat('#262b2b'));w.rotation.z=Math.PI/2;w.position.set(x,.4,z);vehicle.add(w);wheels.push(w);}
  const target=new THREE.Vector3(),camPos=new THREE.Vector3();let started=false;
  function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);
  function render(dt,driving,night,time,chase=false){
    const actor=driving?car:player;const yaw=driving?car.heading:player.heading;
    const p=new THREE.Vector3(actor.x,driving?1.1:0,actor.z);const dist=chase?14:(driving?8.6:7.3),height=chase?18:(driving?4.5:4.1);camera.fov=chase?70:64;camera.updateProjectionMatrix();
    const desired=new THREE.Vector3(p.x-Math.sin(yaw)*dist,p.y+height,p.z+Math.cos(yaw)*dist);if(!started){camera.position.copy(desired);started=true;}
    camera.position.lerp(desired,1-Math.exp(-dt*3.4));target.set(p.x,p.y+1.1,p.z);camera.lookAt(target);
    kai.position.set(player.x,0,player.z);kai.rotation.y=player.heading;
    const stride=player.walking||0;for(let i=0;i<2;i++){legs[i].rotation.x=Math.sin(time*9+i*Math.PI)*stride*.48;arms[i].rotation.x=-Math.sin(time*9+i*Math.PI)*stride*.32;}
    vehicle.position.set(car.x,0,car.z);vehicle.rotation.y=car.heading;vehicle.updateMatrixWorld();for(const w of wheels)w.rotation.x+=car.speed*dt*1.8;
    if(driving){kai.scale.setScalar(.72);kai.position.set(car.x+Math.cos(car.heading)*-.48+Math.sin(car.heading)*-.3,.45,car.z-Math.sin(car.heading)*-.48+Math.cos(car.heading)*-.3);kai.rotation.y=car.heading;}else{kai.scale.setScalar(1);kai.position.set(player.x,0,player.z);kai.rotation.y=player.heading;}
    const sky=night?'#314452':'#a7b8ad';scene.background.set(sky);scene.fog.color.set(night?'#314452':'#a7b8ad');sun.intensity=night?.35:2.1;window.__webgl=true;renderer.render(scene,camera);
  }
  return {render,renderer,scene,camera};
}
