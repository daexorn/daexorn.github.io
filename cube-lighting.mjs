import * as THREE from './assets/three/three.module.min.js';
import { RoundedBoxGeometry } from './assets/three/RoundedBoxGeometry.js';

// Reflect a small studio in the bevels. The cards stay fixed as the object turns.
function studioReflection(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color(0x28394e);
  const card = (position, width, height, color, intensity) => {
    const material = new THREE.MeshBasicMaterial({color, side:THREE.DoubleSide});
    material.color.multiplyScalar(intensity);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    panel.position.set(...position);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  };
  card([-4, 5, 3], 7, 3, 0xe3edff, 5);
  card([4, 2, 2], 1.4, 7, 0x94c8ff, 4);
  card([-2, 0, -4], 3, 8, 0x668ed5, 3);
  const generator = new THREE.PMREMGenerator(renderer);
  const target = generator.fromScene(studio, 0.025);
  generator.dispose();
  for (const panel of studio.children) {
    panel.geometry.dispose();
    panel.material.dispose();
  }
  return target;
}

function grain(finish) {
  const size = 128;
  const bytes = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let ridge = false;
    switch (finish) {
      case 1: ridge = x % 12 < 3 && y % 12 < 3; break;
      case 2: ridge = x % 8 < 2; break;
      case 3: ridge = y % 8 < 2; break;
      case 4: ridge = (x+y) % 12 < 2; break;
      case 5: ridge = x % 11 < 2 || y % 11 < 2; break;
      case 6: ridge = (x*37+y*251+x*y) % 17 < 4; break;
    }
    const i = (y*size+x)*4;
    bytes.fill(ridge ? 135 : 245, i, i+3);
    bytes[i+3] = 255;
  }
  const map = new THREE.DataTexture(bytes, size, size);
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

// Each square records the studio light on a sphere with one of the cube's finishes.
function bakedFinish(atlas,index) {
  const tile=document.createElement('canvas');
  const size=atlas.naturalWidth/4;
  tile.width=tile.height=size;
  tile.getContext('2d').drawImage(atlas,(index%4)*size,Math.floor(index/4)*size,size,size,0,0,size,size);
  const matcap=new THREE.CanvasTexture(tile);
  matcap.colorSpace=THREE.SRGBColorSpace;
  return new THREE.MeshMatcapMaterial({matcap,map:index>0 && index<7 ? grain(index) : null,toneMapped:false});
}

export function createStudioCube(canvas, pieces, atlas=null) {
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const stage = new THREE.Scene();
  const reflection = atlas ? null : studioReflection(renderer);
  if (reflection) stage.environment = reflection.texture;
  const camera = new THREE.PerspectiveCamera(10, 1, .1, 40);
  camera.position.z = 31;
  const rig = new THREE.Group();
  rig.rotation.order = 'ZXY';
  const spinner = new THREE.Group();
  rig.add(spinner);
  stage.add(rig);
  stage.add(new THREE.HemisphereLight(0xc4ddff, 0x102034, 1.4));
  const key = new THREE.DirectionalLight(0xd7e8ff, 2.1);
  key.position.set(-3, 5, 4);
  stage.add(key);
  const fill = new THREE.DirectionalLight(0xa4c6ed, 2.6);
  fill.position.set(3, 1, 6);
  stage.add(fill);
  const bodyShape = new RoundedBoxGeometry(1,1,1,atlas ? 2 : 3,.12);
  const tileWidth = .82, half = tileWidth/2, radius = tileWidth*.15;
  const outline = new THREE.Shape();
  outline.moveTo(-half+radius,-half);
  outline.lineTo(half-radius,-half);
  outline.quadraticCurveTo(half,-half,half,-half+radius);
  outline.lineTo(half,half-radius);
  outline.quadraticCurveTo(half,half,half-radius,half);
  outline.lineTo(-half+radius,half);
  outline.quadraticCurveTo(-half,half,-half,half-radius);
  outline.lineTo(-half,-half+radius);
  outline.quadraticCurveTo(-half,-half,-half+radius,-half);
  const faceShape = new THREE.ExtrudeGeometry(outline,{depth:.0246,bevelEnabled:false,curveSegments:4});
  faceShape.translate(0,0,.5);
  const uv = faceShape.attributes.uv;
  for (let i=0; i<uv.count; i++) uv.setXY(i,uv.getX(i)/tileWidth+.5,uv.getY(i)/tileWidth+.5);
  const innerMaterial = atlas ? bakedFinish(atlas,7) : new THREE.MeshStandardMaterial({color:0x060c15,metalness:.18,roughness:.46});
  const tones = [0x203149,0x233448,0x24394f,0x354b60,0x203248,0x2a3a50,0x263748];
  const roughness = [.12,.38,.82,.7,.18,.46,.88];
  const metals = [.72,.46,.10,.18,.66,.38,.06];
  const coats = [1,.38,0,.04,.88,.24,0];
  const tiles = tones.map((color, i) => {
    if (atlas) return bakedFinish(atlas,i);
    const map = i ? grain(i) : null;
    return new THREE.MeshPhysicalMaterial({color, metalness:metals[i],
      roughness:roughness[i], clearcoat:coats[i],
      clearcoatRoughness:roughness[i], map, bumpMap:map, bumpScale:.025});
  });
  function batch(geometry, material, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    spinner.add(mesh);
    return mesh;
  }
  const surfaces = tiles.map((material, finish) => {
    const faces = pieces.flatMap(piece => piece.faces
      .filter(face => face.color && face.finish === finish)
      .map(face => ({piece,face,rest:new THREE.Matrix4()})));
    return {mesh:batch(faceShape,material,faces.length),faces};
  });
  surfaces.push({
    mesh:batch(bodyShape,innerMaterial,pieces.length),
    faces:pieces.map(piece=>({piece,rest:new THREE.Matrix4()}))
  });
  const u = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3();
  const clockwise = new THREE.Matrix4(), counterclockwise = new THREE.Matrix4();
  const pieceMatrix = new THREE.Matrix4();
  const axes = [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)];
  let dirty = true, wasTurning = false;
  function syncLayer(move) {
    if (move) {
      clockwise.makeRotationAxis(axes[move.axis],move.angle);
      counterclockwise.makeRotationAxis(axes[move.axis],-move.angle);
    }
    for (const {mesh,faces} of surfaces) {
      let changed=false;
      faces.forEach(({piece,face,rest},i)=>{
        if (dirty && !face) rest.makeTranslation(...piece.center);
        else if (dirty) {
          u.fromArray(face.tangent);
          n.fromArray(face.normal);
          v.crossVectors(n,u);
          rest.makeBasis(u,v,n).setPosition(...piece.center);
        }
        const direction=move && move.directions[piece.center[move.axis]+1];
        if (direction) {
          const turnMatrix=direction>0 ? clockwise : counterclockwise;
          mesh.setMatrixAt(i,pieceMatrix.multiplyMatrices(turnMatrix,rest));
        } else if (dirty || wasTurning && !move) {
          mesh.setMatrixAt(i,rest);
        } else return;
        changed=true;
      });
      if (changed) mesh.instanceMatrix.needsUpdate=true;
    }
    dirty=false;
    wasTurning=Boolean(move);
  }
  return {
    invalidate() { dirty = true; },
    draw(size, move, view) {
      if (canvas.width !== size) renderer.setSize(size,size,false);
      rig.position.y=view.lift;
      rig.rotation.set(view.pitch+view.tilt,view.yaw,-view.tilt,'ZXY');
      spinner.rotation.set(view.spinX,view.spinY,view.spinZ,'ZYX');
      if (move || dirty || wasTurning) syncLayer(move);
      renderer.render(stage,camera);
    },
    dispose() {
      surfaces.forEach(({mesh}) => mesh.dispose());
      reflection?.dispose();
      bodyShape.dispose(); faceShape.dispose(); innerMaterial.matcap?.dispose(); innerMaterial.dispose();
      tiles.forEach(material => {material.map?.dispose(); material.matcap?.dispose(); material.dispose();});
      renderer.dispose();
    }
  };
}
