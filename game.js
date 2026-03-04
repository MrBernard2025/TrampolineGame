const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("best-score");
const comboEl = document.getElementById("combo");
const feedbackEl = document.getElementById("feedback");

// Tunable physics and difficulty constants.
const CONFIG = {
  gravity: 0.42,
  jumpVelocity: -14.2,
  springStrength: 0.22,
  springDamping: 0.83,
  contactBounceBoost: 1.09,
  airMoveAccel: 0.2,
  airMoveDrag: 0.985,
  maxHorizontalSpeed: 4.8,
  angularVelocityMultiplier: 0.012,
  holdAngularBoost: 0.0034,
  maxAngularSpeed: 0.58,
  safeLandingSpin: 0.26,
  faceCrashAngleDeg: 120,
  perfectAngleDeg: 10,
  goodAngleDeg: 25,
  perfectOffsetPx: 20,
  goodOffsetPx: 60,
  countdownFramesOnBed: 12,
  launchCompression: 18,
  trampolineWidth: 260,
  trampolineHeight: 18
};

const STATE = {
  START: "start",
  PLAYING: "playing",
  CRASHED: "crashed"
};

const world = {
  width: canvas.width,
  height: canvas.height,
  trampolineX: canvas.width / 2,
  trampolineY: 400,
  groundY: 470
};

const keys = {
  left: false,
  right: false,
  front: false,
  back: false
};

const player = {
  x: world.trampolineX,
  y: 0,
  vx: 0,
  vy: 0,
  angle: 0,
  angularVelocity: 0,
  bodyLength: 86,
  hipOffset: 16,
  onTrampoline: true,
  airborne: false,
  launchCharge: 0,
  completedRotations: 0,
  rotationAccumulator: 0,
  lastAngle: 0,
  crashTimer: 0
};

const game = {
  state: STATE.START,
  score: 0,
  combo: 0,
  bestScore: Number(localStorage.getItem("trampoline-best-score") || 0),
  landingText: "Press Space to start run",
  landingTimer: 0,
  bedCompression: 0,
  particles: []
};

bestScoreEl.textContent = String(game.bestScore);

function resetPlayer() {
  player.x = world.trampolineX;
  player.y = getTrampolineSurfaceY(player.x) - player.bodyLength / 2;
  player.vx = 0;
  player.vy = 0;
  player.angle = 0;
  player.angularVelocity = 0;
  player.onTrampoline = true;
  player.airborne = false;
  player.launchCharge = 0;
  player.completedRotations = 0;
  player.rotationAccumulator = 0;
  player.lastAngle = 0;
  player.crashTimer = 0;
}

function resetGame() {
  game.state = STATE.START;
  game.score = 0;
  game.combo = 0;
  game.landingText = "Press Space to start run";
  game.landingTimer = 0;
  game.bedCompression = 0;
  game.particles = [];
  resetPlayer();
  syncHud();
}

function syncHud() {
  scoreEl.textContent = String(game.score);
  comboEl.textContent = String(game.combo);
  bestScoreEl.textContent = String(game.bestScore);
  feedbackEl.textContent = game.landingText;
}

function degreesToRadians(deg) {
  return (deg * Math.PI) / 180;
}

function normalizeAngle(angle) {
  let normalized = angle % (Math.PI * 2);
  if (normalized > Math.PI) normalized -= Math.PI * 2;
  if (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function getTrampolineSurfaceY(x) {
  const distance = Math.abs(x - world.trampolineX);
  const edgeFactor = Math.min(distance / (CONFIG.trampolineWidth / 2), 1);
  return world.trampolineY + game.bedCompression * (1 - edgeFactor * 0.45);
}

function spawnLandingParticles(quality) {
  const color = quality === "perfect" ? "#ffb703" : "#f28482";
  const burst = quality === "perfect" ? 16 : 10;
  for (let i = 0; i < burst; i += 1) {
    game.particles.push({
      x: player.x,
      y: getTrampolineSurfaceY(player.x),
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 3 - 1,
      life: 26 + Math.random() * 12,
      color
    });
  }
}

function launchPlayer() {
  player.vy = CONFIG.jumpVelocity * (1 + player.launchCharge * 0.035);
  player.vx *= 0.5;
  player.onTrampoline = false;
  player.airborne = true;
  game.state = STATE.PLAYING;
  game.bedCompression = Math.max(game.bedCompression, CONFIG.launchCompression);
  player.launchCharge = 0;
  player.completedRotations = 0;
  player.rotationAccumulator = 0;
  player.lastAngle = player.angle;
}

function startLaunchCharge() {
  if (!player.onTrampoline || game.state === STATE.CRASHED) return;
  player.launchCharge = CONFIG.countdownFramesOnBed;
  game.landingText = "Jumping";
  syncHud();
}

function evaluateLanding() {
  const angleError = Math.abs(normalizeAngle(player.angle));
  const horizontalOffset = Math.abs(player.x - world.trampolineX);
  const spin = Math.abs(player.angularVelocity);
  const perfectAngle = degreesToRadians(CONFIG.perfectAngleDeg);
  const goodAngle = degreesToRadians(CONFIG.goodAngleDeg);
  const headCrashAngle = degreesToRadians(CONFIG.faceCrashAngleDeg);

  // Landing success depends on being upright, near center, and not spinning too fast.
  const angleGrade =
    angleError <= perfectAngle ? "perfect" :
    angleError <= goodAngle ? "good" :
    "fail";
  const positionGrade =
    horizontalOffset <= CONFIG.perfectOffsetPx ? "perfect" :
    horizontalOffset <= CONFIG.goodOffsetPx ? "good" :
    "fail";
  const spinGrade = spin <= CONFIG.safeLandingSpin ? "good" : "fail";
  const isFaceOrNeckImpact = angleError >= headCrashAngle;

  if (isFaceOrNeckImpact) {
    game.state = STATE.CRASHED;
    game.combo = 0;
    game.landingText = "Face/Neck Crash";
    player.airborne = false;
    player.onTrampoline = false;
    player.vx = 0;
    player.vy = 1.2;
    player.angularVelocity *= 0.4;
    spawnLandingParticles("fail");
    updateBestScore();
    syncHud();
    return;
  }

  const quality =
    angleGrade === "perfect" && positionGrade === "perfect" && spinGrade === "good" ? "perfect" :
    angleGrade !== "fail" && positionGrade !== "fail" ? "good" :
    "bad";

  if (quality === "bad") {
    game.combo = 0;
    game.landingText = "Off Balance";
  } else {
    const baseScore = quality === "perfect" ? 150 : 90;
    const rotationBonus = player.completedRotations * 120;
    const comboBonus = game.combo * (quality === "perfect" ? 30 : 18);
    game.combo += 1;
    game.score += baseScore + rotationBonus + comboBonus;
    game.landingText = quality === "perfect" ? "Perfect" : "Good";
  }

  game.landingTimer = 70;
  player.onTrampoline = true;
  player.airborne = false;
  player.angle = normalizeAngle(player.angle) * 0.18;
  player.angularVelocity *= 0.3;
  player.completedRotations = 0;
  player.rotationAccumulator = 0;
  player.launchCharge = CONFIG.countdownFramesOnBed;
  game.bedCompression = Math.max(game.bedCompression, 10);
  spawnLandingParticles(quality);
  updateBestScore();
  syncHud();
}

function updateBestScore() {
  if (game.score <= game.bestScore) return;
  game.bestScore = game.score;
  localStorage.setItem("trampoline-best-score", String(game.bestScore));
}

function updateAirControl() {
  if (keys.left) player.vx -= CONFIG.airMoveAccel;
  if (keys.right) player.vx += CONFIG.airMoveAccel;
  player.vx = Math.max(-CONFIG.maxHorizontalSpeed, Math.min(CONFIG.maxHorizontalSpeed, player.vx));

  if (keys.front && !keys.back) {
    player.angularVelocity -= CONFIG.angularVelocityMultiplier;
    player.angularVelocity -= CONFIG.holdAngularBoost;
  } else if (keys.back && !keys.front) {
    player.angularVelocity += CONFIG.angularVelocityMultiplier;
    player.angularVelocity += CONFIG.holdAngularBoost;
  } else {
    // Rotation is hold-driven; releasing Q/E cancels spin for precise timing.
    player.angularVelocity = 0;
  }

  player.angularVelocity = Math.max(
    -CONFIG.maxAngularSpeed,
    Math.min(CONFIG.maxAngularSpeed, player.angularVelocity)
  );
}

function updateRotationTracking() {
  const delta = normalizeAngle(player.angle - player.lastAngle);
  player.rotationAccumulator += delta;
  player.lastAngle = player.angle;
  player.completedRotations = Math.floor(Math.abs(player.rotationAccumulator) / (Math.PI * 2));
}

function updatePlayer() {
  if (game.state === STATE.CRASHED) {
    player.crashTimer += 1;
    player.vy += CONFIG.gravity * 0.75;
    player.y += player.vy;
    player.angle += player.angularVelocity;
    if (player.y > world.groundY - 40) {
      player.y = world.groundY - 40;
      player.vy = 0;
      player.angularVelocity *= 0.92;
    }
    return;
  }

  if (player.onTrampoline) {
    const surfaceY = getTrampolineSurfaceY(player.x);
    player.y = surfaceY - player.bodyLength / 2;
    player.vx *= 0.84;

    if (player.launchCharge > 0) {
      game.bedCompression += CONFIG.springStrength * (CONFIG.launchCompression - game.bedCompression);
      player.launchCharge -= 1;
      if (player.launchCharge <= 0) {
        launchPlayer();
      }
    } else {
      game.bedCompression *= CONFIG.springDamping;
    }
    return;
  }

  updateAirControl();

  player.vy += CONFIG.gravity;
  player.vx *= CONFIG.airMoveDrag;
  player.x += player.vx;
  player.y += player.vy;
  player.angle += player.angularVelocity;
  updateRotationTracking();

  const leftBound = world.trampolineX - 240;
  const rightBound = world.trampolineX + 240;
  player.x = Math.max(leftBound, Math.min(rightBound, player.x));

  const surfaceY = getTrampolineSurfaceY(player.x);
  const feetY = player.y + player.bodyLength / 2;

  // Contact with the trampoline triggers the landing check and starts the next spring cycle.
  if (feetY >= surfaceY && player.vy > 0) {
    player.y = surfaceY - player.bodyLength / 2;
    evaluateLanding();
  }
}

function updateParticles() {
  game.particles = game.particles.filter((particle) => particle.life > 0);
  for (const particle of game.particles) {
    particle.life -= 1;
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.08;
  }
}

function drawBackground() {
  ctx.fillStyle = "#dbf0ff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.arc(150, 90, 45, 0, Math.PI * 2);
  ctx.arc(210, 90, 35, 0, Math.PI * 2);
  ctx.arc(180, 70, 38, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(720, 110, 30, 0, Math.PI * 2);
  ctx.arc(760, 112, 26, 0, Math.PI * 2);
  ctx.arc(740, 94, 29, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#9cc56c";
  ctx.fillRect(0, world.groundY, canvas.width, canvas.height - world.groundY);
}

function drawTrampoline() {
  const frameY = world.trampolineY + 20;
  const bedY = getTrampolineSurfaceY(world.trampolineX);

  ctx.strokeStyle = "#465a73";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(world.trampolineX - 120, frameY);
  ctx.lineTo(world.trampolineX - 90, frameY + 55);
  ctx.moveTo(world.trampolineX + 120, frameY);
  ctx.lineTo(world.trampolineX + 90, frameY + 55);
  ctx.stroke();

  ctx.lineWidth = CONFIG.trampolineHeight;
  ctx.strokeStyle = "#2f3d52";
  ctx.beginPath();
  ctx.moveTo(world.trampolineX - CONFIG.trampolineWidth / 2, bedY);
  ctx.quadraticCurveTo(
    world.trampolineX,
    bedY + game.bedCompression * 0.85,
    world.trampolineX + CONFIG.trampolineWidth / 2,
    bedY
  );
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#8191a8";
  for (let i = -4; i <= 4; i += 1) {
    const x = world.trampolineX + i * 28;
    ctx.beginPath();
    ctx.moveTo(x, frameY + 2);
    ctx.lineTo(x, bedY + 3);
    ctx.stroke();
  }
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  const suitColor = game.state === STATE.CRASHED ? "#91312a" : "#18508a";
  const shadowColor = "rgba(12, 20, 32, 0.2)";
  const skinColor = "#f2c79d";

  ctx.fillStyle = shadowColor;
  ctx.beginPath();
  ctx.ellipse(0, player.bodyLength / 2 + 6, 24, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = suitColor;
  ctx.beginPath();
  ctx.moveTo(-14, -30);
  ctx.lineTo(14, -30);
  ctx.lineTo(18, 8);
  ctx.lineTo(0, 22);
  ctx.lineTo(-18, 8);
  ctx.closePath();
  ctx.fill();

  const bendBase = Math.abs(player.angularVelocity) * 90;
  const bendBoost = (keys.front || keys.back) && player.airborne ? 12 : 0;
  const kneeBend = Math.min(22, bendBase + bendBoost);
  const leftHip = { x: -7, y: 24 };
  const rightHip = { x: 7, y: 24 };
  const leftKnee = { x: -11, y: 43 + kneeBend * 0.38 };
  const rightKnee = { x: 11, y: 43 + kneeBend * 0.38 };
  const leftAnkle = { x: -18 - kneeBend * 0.55, y: 64 - kneeBend * 0.32 };
  const rightAnkle = { x: 18 + kneeBend * 0.55, y: 64 - kneeBend * 0.32 };

  ctx.fillStyle = skinColor;
  ctx.beginPath();
  ctx.arc(0, -45, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#503d2f";
  ctx.beginPath();
  ctx.arc(0, -49, 10, Math.PI, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = suitColor;
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-12, -22);
  ctx.lineTo(-28, -4);
  ctx.moveTo(12, -22);
  ctx.lineTo(28, -4);
  ctx.stroke();

  ctx.strokeStyle = "#17375f";
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(leftHip.x, leftHip.y);
  ctx.lineTo(leftKnee.x, leftKnee.y);
  ctx.lineTo(leftAnkle.x, leftAnkle.y);
  ctx.moveTo(rightHip.x, rightHip.y);
  ctx.lineTo(rightKnee.x, rightKnee.y);
  ctx.lineTo(rightAnkle.x, rightAnkle.y);
  ctx.stroke();

  // Shoes are highlighted to keep feet orientation readable for landing timing.
  ctx.strokeStyle = "#ff6b35";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(leftAnkle.x, leftAnkle.y);
  ctx.lineTo(leftAnkle.x - 13, leftAnkle.y);
  ctx.moveTo(rightAnkle.x, rightAnkle.y);
  ctx.lineTo(rightAnkle.x + 13, rightAnkle.y);
  ctx.stroke();

  ctx.restore();
}

function drawParticles() {
  for (const particle of game.particles) {
    ctx.globalAlpha = Math.max(0, particle.life / 38);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawOverlay() {
  ctx.textAlign = "center";

  if (game.state === STATE.START) {
    ctx.fillStyle = "rgba(16, 35, 62, 0.15)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#10233e";
    ctx.font = "bold 36px Trebuchet MS";
    ctx.fillText("Trampoline Trick Game", canvas.width / 2, 150);
    ctx.font = "20px Trebuchet MS";
    ctx.fillText("Build combos by landing upright and near the center.", canvas.width / 2, 190);
    ctx.fillText("Press Space to jump. Use Q and E to flip in the air.", canvas.width / 2, 220);
  }

  if (game.state === STATE.CRASHED) {
    ctx.fillStyle = "rgba(16, 35, 62, 0.22)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fffaf2";
    ctx.font = "bold 42px Trebuchet MS";
    ctx.fillText("Crash", canvas.width / 2, 165);
    ctx.font = "22px Trebuchet MS";
    ctx.fillText("Press R to restart", canvas.width / 2, 205);
    ctx.fillText(`Final score: ${game.score}`, canvas.width / 2, 238);
  }

  if (player.airborne && game.state !== STATE.CRASHED) {
    ctx.fillStyle = "rgba(16, 35, 62, 0.75)";
    ctx.font = "bold 20px Trebuchet MS";
    ctx.fillText(`Rotations: ${player.completedRotations}`, canvas.width - 130, 40);
  }
}

function render() {
  drawBackground();
  drawTrampoline();
  drawPlayer();
  drawParticles();
  drawOverlay();
}

function tick() {
  if (game.landingTimer > 0) {
    game.landingTimer -= 1;
  }
  if (game.landingTimer === 0 && game.state === STATE.PLAYING) {
    game.landingText = player.onTrampoline ? "Auto Bounce" : "In Air";
  }

  updatePlayer();
  game.bedCompression *= 0.96;
  updateParticles();
  syncHud();
  render();
  requestAnimationFrame(tick);
}

function setKeyState(code, isDown) {
  switch (code) {
    case "ArrowLeft":
    case "KeyA":
      keys.left = isDown;
      break;
    case "ArrowRight":
    case "KeyD":
      keys.right = isDown;
      break;
    case "KeyQ":
      keys.front = isDown;
      break;
    case "KeyE":
      keys.back = isDown;
      break;
    default:
      break;
  }
}

window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    startLaunchCharge();
    return;
  }

  if (event.code === "KeyR" && game.state === STATE.CRASHED) {
    resetGame();
    return;
  }

  setKeyState(event.code, true);
});

window.addEventListener("keyup", (event) => {
  setKeyState(event.code, false);
});

resetGame();
tick();
