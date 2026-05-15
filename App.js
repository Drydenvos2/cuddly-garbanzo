const canvas = document.createElement('canvas');
document.body.prepend(canvas);

const renderer = new THREE.WebGLRenderer({canvas, antialias: true});
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x09141f);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x09141f, 0.035);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.6, 5);
const clock = new THREE.Clock();

const ambientLight = new THREE.HemisphereLight(0xffffff, 0x212d46, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(6, 10, 4);
directionalLight.castShadow = true;
scene.add(directionalLight);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 60),
  new THREE.MeshStandardMaterial({color: 0x162135, roughness: 0.92, metalness: 0.08})
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const wallMaterial = new THREE.MeshStandardMaterial({color: 0x121c2f, roughness: 0.95});
const walls = [
  {pos: [0, 2.5, -30], size: [60, 5, 1]},
  {pos: [0, 2.5, 30], size: [60, 5, 1]},
  {pos: [-30, 2.5, 0], size: [1, 5, 60]},
  {pos: [30, 2.5, 0], size: [1, 5, 60]}
];
walls.forEach(({pos, size}) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), wallMaterial);
  mesh.position.set(...pos);
  scene.add(mesh);
});

const weapons = [
  {name: 'Pistol', rate: 0.25, damage: 1, bulletCount: 1, spread: 0.02, color: 0x5fd5ff, speed: 26},
  {name: 'Shotgun', rate: 0.8, damage: 0.6, bulletCount: 5, spread: 0.22, color: 0xff9635, speed: 20},
  {name: 'Rifle', rate: 0.14, damage: 1.8, bulletCount: 1, spread: 0.008, color: 0xff4b7e, speed: 40}
];
let weaponIndex = 0;
let score = 0;
let lastShot = 0;

const bullets = [];
const targets = [];

const hudWeapon = document.getElementById('weapon-name');
const hudStats = document.getElementById('weapon-stats');
const hudScore = document.getElementById('score');
const shootButton = document.getElementById('shoot-button');
const switchButton = document.getElementById('switch-button');
const resetButton = document.getElementById('reset-button');

function createTargets(count = 15) {
  targets.length = 0;
  scene.children.filter(child => child.userData.type === 'target').forEach(child => scene.remove(child));

  for (let i = 0; i < count; i++) {
    const size = THREE.MathUtils.randFloat(0.7, 1.1);
    const x = THREE.MathUtils.randFloatSpread(18);
    const z = -THREE.MathUtils.randFloat(8, 26);
    const height = 0.7 + Math.abs(Math.sin(i * 0.7)) * 0.3;
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({color: new THREE.Color().setHSL(Math.random() * 0.45, 0.8, 0.6)})
    );
    mesh.position.set(x, height, z);
    mesh.castShadow = true;
    mesh.userData = {type: 'target', health: 2.5 + Math.random() * 1.5};
    scene.add(mesh);
    targets.push(mesh);
  }
}

function updateHud() {
  const weapon = weapons[weaponIndex];
  hudWeapon.textContent = `Weapon: ${weapon.name}`;
  hudStats.textContent = `Rate: ${weapon.rate.toFixed(2)}s · Damage: ${weapon.damage.toFixed(1)} · Bullets: ${weapon.bulletCount}`;
  hudScore.textContent = `Score: ${score}`;
}

function resetGame() {
  score = 0;
  lastShot = 0;
  bullets.forEach(({mesh}) => scene.remove(mesh));
  bullets.length = 0;
  createTargets();
  updateHud();
}

function shoot() {
  const weapon = weapons[weaponIndex];
  const now = performance.now() / 1000;
  if (now - lastShot < weapon.rate) return;
  lastShot = now;

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  const origin = camera.position.clone().add(direction.clone().multiplyScalar(0.5));

  for (let i = 0; i < weapon.bulletCount; i++) {
    const spreadAngle = weapon.spread;
    const aim = direction.clone();
    aim.x += THREE.MathUtils.randFloatSpread(spreadAngle);
    aim.y += THREE.MathUtils.randFloatSpread(spreadAngle);
    aim.normalize();

    const sphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshStandardMaterial({color: weapon.color, emissive: weapon.color})
    );
    sphere.position.copy(origin);
    sphere.userData = {velocity: aim.multiplyScalar(weapon.speed), life: 2.0, damage: weapon.damage};
    scene.add(sphere);
    bullets.push({mesh: sphere, velocity: sphere.userData.velocity, life: sphere.userData.life, damage: weapon.damage});
  }
}

function switchWeapon() {
  weaponIndex = (weaponIndex + 1) % weapons.length;
  updateHud();
}

shootButton.addEventListener('click', shoot);
switchButton.addEventListener('click', switchWeapon);
resetButton.addEventListener('click', resetGame);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let isDragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let yaw = 0;
let pitch = 0;

function onPointerDown(event) {
  isDragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
}

function onPointerUp() {
  isDragging = false;
}

function onPointerMove(event) {
  if (!isDragging) return;
  const deltaX = event.clientX - lastPointerX;
  const deltaY = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;

  const sensitivity = 0.0025;
  yaw -= deltaX * sensitivity;
  pitch -= deltaY * sensitivity;
  pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
}

canvas.addEventListener('pointerdown', onPointerDown);
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointerout', onPointerUp);
canvas.addEventListener('pointermove', onPointerMove);
canvas.addEventListener('click', event => {
  if (event.pointerType === 'mouse') shoot();
});

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(0.04, clock.getDelta());

  bullets.forEach((bullet, index) => {
    bullet.mesh.position.addScaledVector(bullet.velocity, delta);
    bullet.life -= delta;

    if (bullet.life <= 0) {
      scene.remove(bullet.mesh);
      bullets.splice(index, 1);
      return;
    }

    const bulletBox = new THREE.Box3().setFromObject(bullet.mesh);
    targets.forEach((target, targetIndex) => {
      if (!target) return;
      const targetBox = new THREE.Box3().setFromObject(target);
      if (bulletBox.intersectsBox(targetBox)) {
        target.userData.health -= bullet.damage;
        scene.remove(bullet.mesh);
        bullets.splice(index, 1);
        if (target.userData.health <= 0) {
          scene.remove(target);
          targets.splice(targetIndex, 1);
          score += 1;
          updateHud();
        } else {
          const material = target.material;
          material.emissive = new THREE.Color(0xffffff);
          setTimeout(() => {
            material.emissive.set(0x000000);
          }, 80);
        }
      }
    });
  });

  renderer.render(scene, camera);
}

createTargets();
updateHud();
animate();
