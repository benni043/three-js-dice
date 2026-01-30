import * as CANNON from "https://cdn.skypack.dev/cannon-es";

const rollBtn = document.querySelector("#backend-btn");
rollBtn.addEventListener("click", () => console.log(simulateDiceRoll(3)));

function Mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulateDiceRoll(serverSeed = 3, diceSize = 2) {
  const physicsWorld = new CANNON.World({
    allowSleep: true,
    gravity: new CANNON.Vec3(0, -65, 0),
  });

  physicsWorld.defaultContactMaterial.restitution = 0.3;

  const floorBody = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Plane(),
  });

  floorBody.position.y = -7;
  floorBody.quaternion.setFromAxisAngle(
    new CANNON.Vec3(-1, 0, 0),
    Math.PI * 0.5,
  );

  physicsWorld.addBody(floorBody);

  const diceBodies = [];
  const rng = Mulberry32(serverSeed);

  for (let i = 0; i < 3; i++) {
    const body = new CANNON.Body({
      mass: 1,
      shape: new CANNON.Box(
        new CANNON.Vec3(diceSize / 2, diceSize / 2, diceSize / 2),
      ),
      sleepTimeLimit: 0.1,
    });

    body.velocity.setZero();
    body.angularVelocity.setZero();

    body.position = new CANNON.Vec3(6, i * (diceSize * 1.5), 0);
    const rx = 2 * Math.PI * rng();
    const rz = 2 * Math.PI * rng();

    const q = new CANNON.Quaternion();
    q.setFromEuler(rx, 0, rz, "XYZ");

    body.quaternion.copy(q);


    const force = 3 + 5 * rng();
    body.applyImpulse(
      new CANNON.Vec3(-force, force, 0),
      new CANNON.Vec3(0, 0, 0.2),
    );

    physicsWorld.addBody(body);
    diceBodies.push(body);
  }

  const FIXED_TIME_STEP = 1 / 60;
  const MAX_STEPS = 10000;

  let steps = 0;

  while (steps < MAX_STEPS) {
    physicsWorld.step(FIXED_TIME_STEP);
    steps++;

    let allStable = true;

    for (const body of diceBodies) {
      // Noch nicht schläft → weiter simulieren
      if (body.sleepState !== CANNON.Body.SLEEPING) {
        allStable = false;
        continue;
      }

      const result = getDiceResult(body);

      // Edge case → wieder aufwecken
      if (result === 0) {
        body.allowSleep = true;
        body.wakeUp();
        allStable = false;
      }
    }

    if (allStable) break;
  }

  return diceBodies.map((body) => getDiceResult(body));

}

function getDiceResult(body) {
  const euler = new CANNON.Vec3();
  body.quaternion.toEuler(euler);

  const eps = 0.1;
  const isZero = (angle) => Math.abs(angle) < eps;
  const isHalfPi = (angle) => Math.abs(angle - 0.5 * Math.PI) < eps;
  const isMinusHalfPi = (angle) => Math.abs(0.5 * Math.PI + angle) < eps;
  const isPiOrMinusPi = (angle) =>
    Math.abs(Math.PI - angle) < eps || Math.abs(Math.PI + angle) < eps;

  if (isZero(euler.z)) {
    if (isZero(euler.x)) return 1;
    if (isHalfPi(euler.x)) return 4;
    if (isMinusHalfPi(euler.x)) return 3;
    if (isPiOrMinusPi(euler.x)) return 6;
  } else if (isHalfPi(euler.z)) {
    return 2;
  } else if (isMinusHalfPi(euler.z)) {
    return 5;
  }

  return 0;
}
