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

export function createStudioCube(canvas, pieces) {
  const renderer = new THREE.WebGLRenderer({canvas, alpha:true, antialias:true, powerPreference:'low-power'});
  renderer.setClearColor(0, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const stage = new THREE.Scene();
  const reflection = studioReflection(renderer);
  stage.environment = reflection.texture;
  const camera = new THREE.PerspectiveCamera(28, 1, .1, 40);
  camera.position.z = 11;
  const rig = new THREE.Group();
  rig.rotation.order = 'ZXY';
  stage.add(rig);
  stage.add(new THREE.HemisphereLight(0xc4ddff, 0x102034, 1.4));
  const key = new THREE.DirectionalLight(0xd7e8ff, 2.1);
  key.position.set(-3, 5, 4);
  stage.add(key);
  const fill = new THREE.DirectionalLight(0xa4c6ed, 2.6);
  fill.position.set(3, 1, 6);
  stage.add(fill);
  const bodyShape = new RoundedBoxGeometry(.976,.976,.976,2,.075);
  const tileShape = new RoundedBoxGeometry(.866,.866,.094,2,.046);
  const bodyMaterial = new THREE.MeshStandardMaterial({color:0x060c15,metalness:.18,roughness:.46});
  const tones = [0x203149,0x233448,0x24394f,0x354b60,0x203248,0x2a3a50,0x263748];
  const roughness = [.14,.76,.37,.50,.23,.62,.87];
  const tiles = tones.map((color, i) => {
    const map = i ? grain(i) : null;
    return new THREE.MeshPhysicalMaterial({color, metalness:i === 0 ? .68 : .32,
      roughness:roughness[i], clearcoat:i === 0 || i === 4 ? .9 : .08,
      clearcoatRoughness:.12, map, bumpMap:map, bumpScale:.008});
  });
  function batch(geometry, material, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    rig.add(mesh);
    return mesh;
  }
  const bodies = batch(bodyShape, bodyMaterial, pieces.length);
  const stickers = tiles.map((material, finish) => {
    const faces = pieces.flatMap(piece => piece.faces
      .filter(face => face.color && face.finish === finish)
      .map(face => ({piece,face})));
    return {mesh:batch(tileShape,material,faces.length), faces};
  });
  const basis = new THREE.Matrix4(), u = new THREE.Vector3(), v = new THREE.Vector3(), n = new THREE.Vector3();
  const turnMatrix = new THREE.Matrix4(), pieceMatrix = new THREE.Matrix4();
  const axes = [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)];
  let dirty = true;
  function placePiece(piece,move) {
    pieceMatrix.makeTranslation(...piece.center);
    if (move && piece.center[move.axis] === move.layer) pieceMatrix.premultiply(turnMatrix);
  }
  function syncLayer(move) {
    if (move) turnMatrix.makeRotationAxis(axes[move.axis],move.angle);
    pieces.forEach((piece,i)=>{
      placePiece(piece,move);
      bodies.setMatrixAt(i,pieceMatrix);
    });
    bodies.instanceMatrix.needsUpdate = true;
    for (const {mesh,faces} of stickers) {
      faces.forEach(({piece,face},i)=>{
        placePiece(piece,move);
        u.fromArray(face.tangent);
        n.fromArray(face.normal);
        v.crossVectors(n,u);
        basis.makeBasis(u,v,n).setPosition(n.multiplyScalar(.475)).premultiply(pieceMatrix);
        mesh.setMatrixAt(i,basis);
      });
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  return {
    invalidate() { dirty = true; },
    draw(size, move, view) {
      if (canvas.width !== size) renderer.setSize(size,size,false);
      rig.rotation.set(view.pitch,view.yaw,-.055,'ZXY');
      if (move || dirty) syncLayer(move);
      dirty = Boolean(move);
      renderer.render(stage,camera);
    },
    dispose() {
      bodies.dispose();
      stickers.forEach(({mesh}) => mesh.dispose());
      reflection.dispose();
      bodyShape.dispose(); tileShape.dispose(); bodyMaterial.dispose();
      tiles.forEach(material => {material.map?.dispose(); material.dispose();});
      renderer.dispose();
    }
  };
}
