/**
 * Desktop Pet — 2D Sprite Animation Engine
 * 
 * HOW TO USE YOUR OWN SPRITE SHEET:
 *   1. Place your sprite image as  c:\futen\Project\Pets\sprites.png
 *   2. Adjust the FRAME LAYOUT constants below to match your image's pixel positions.
 *
 * SPRITE SHEET LAYOUT expected (3 rows):
 *   Row 1 (5 frames): idle → yawn sequence
 *   Row 2 (4 frames): fall-asleep → sleeping → deep-sleep
 *   Row 3 (4 frames): eat-cake | eat-apple | content | happy-wiggle
 */

'use strict';
const { ipcRenderer } = require('electron');

// ═══════════════════════════════════════════════════════
// SECTION 1 — CANVAS SETUP
// ═══════════════════════════════════════════════════════
const canvas = document.getElementById('pet-canvas');
const ctx    = canvas.getContext('2d', { willReadFrequently: true });

let targetSize = 110; // Track the desired sizing state to prevent DPI and creep issues
let WIN_W = targetSize;
let WIN_H = targetSize;
canvas.width  = WIN_W;
canvas.height = WIN_H;

// ═══════════════════════════════════════════════════════
// SECTION 2 — WINDOW / POSITION STATE
// ═══════════════════════════════════════════════════════
const SCREEN_W      = window.screen.width;
const SCREEN_H      = window.screen.height;
const TASKBAR_H     = 48;
const FLOOR_Y       = () => SCREEN_H - TASKBAR_H - WIN_H;

let petX = (SCREEN_W - WIN_W) / 2;
let petY = SCREEN_H - TASKBAR_H - WIN_H;
function sendWindowPos(x, y) {
  if (typeof x === 'number' && typeof y === 'number' && !isNaN(x) && !isNaN(y)) {
    ipcRenderer.send('set-window-pos', { x, y });
  }
}
sendWindowPos(petX, petY);

// Physics
let velX = 0, velY = 0;
let isFalling   = false;
let isDragging  = false;
let dragOffX = 0, dragOffY = 0;
let lastMouseX = 0, lastMouseY = 0;

// Roaming Modes
let roamMode = 'walk'; // 'walk' | 'sports' | 'stand'
let sportsDirection = 1; // 1 = right, -1 = left
let forceFlip = false; // Stand Mode random flip
let roamTargetX = petX;
let currentRoamSpeed = 1.2;
let roamTimer   = 120;

// ═══════════════════════════════════════════════════════
// SECTION 3 — SPRITE SHEET CONFIGURATION
// ═══════════════════════════════════════════════════════
/**
 * Each frame is defined as [srcX, srcY, srcW, srcH].
 * srcW/srcH are the pixels cut from the sprite sheet.
 * The renderer will fit them into the canvas.
 *
 * ┌──────────────────────────────────────────────────┐
 * │  ROW 1  │ f0 │ f1 │ f2 │ f3 │ f4 │  (5 frames) │
 * │  ROW 2  │ f0 │ f1 │ f2 │ f3 │    (4 frames)    │
 * │  ROW 3  │ f0 │ f1 │ f2 │ f3 │    (4 frames)    │
 * └──────────────────────────────────────────────────┘
 *
 * Tune these numbers after inspecting the actual sprite image.
 */

// --- Precise Mathematically-Derived Sprite Coordinates (Zero-Bleed) ---
// Scanned and calculated using native canvas alpha bounding-box analysis with strict row-separation.
// Ensures absolute zero vertical or horizontal overlap with adjacent frames, removing all border and cutoff artifacts.
let ROW1 = [];
let ROW2 = [];
let ROW3 = [];
let ROW4 = [];
let ROW5 = [];
let ANIMS = {};

function rebuildAnimations(isCustom) {
  if (isCustom) {
    // Custom Coordinates Mode (Backward compatible, e.g. for Gulpin)
    ANIMS = {
      idle: {
        frames: [ROW1[0]],
        fps: 2,
        loop: true,
        next: null
      },
      walk: {
        frames: [ROW1[0], ROW2[3]],
        fps: 3.5,
        loop: true,
        next: null
      },
      roll: {
        frames: [ROW1[0], ROW2[3], ROW3[3], ROW2[3]],
        fps: 5.5,
        loop: true,
        next: null
      },
      yawn: {
        frames: [...ROW1],
        fps: 5,
        loop: false,
        next: 'idle'
      },
      fallAsleep: {
        frames: [ROW1[0], ROW2[0], ROW2[1]],
        fps: 3,
        loop: false,
        next: 'sleep'
      },
      sleep: {
        frames: [ROW2[1], ROW2[2], ROW2[1], ROW2[3]],
        fps: 1.5,
        loop: true,
        next: null
      },
      wakeUp: {
        frames: [ROW2[1], ROW2[0], ROW1[0]],
        fps: 4,
        loop: false,
        next: 'idle'
      },
      eatCake: {
        frames: [ROW3[0], ROW1[0]],
        fps: 4,
        loop: false,
        next: 'happy'
      },
      eatApple: {
        frames: [ROW3[1], ROW1[0]],
        fps: 4,
        loop: false,
        next: 'happy'
      },
      happy: {
        frames: [ROW3[2], ROW3[3], ROW3[2], ROW3[3], ROW1[0]],
        fps: 6,
        loop: false,
        next: 'idle'
      },
      wiggle: {
        frames: [ROW3[3], ROW3[2], ROW3[3], ROW3[2], ROW1[0]],
        fps: 7,
        loop: false,
        next: 'idle'
      },
      drag: {
        frames: [ROW2[0]],
        fps: 2,
        loop: true,
        next: null
      }
    };
  } else {
    // New Standardized Redefined Layout Mode (Zero-Config, e.g. for Ditto and future skins)
    ANIMS = {
      idle: {
        frames: [ROW1[0]], // front-facing resting pose
        fps: 2,
        loop: true,
        next: null
      },
      walk: {
        frames: [ROW3[3], ROW3[4]], // walk frame 1 (lean/step) -> walk frame 2 (in-between)
        fps: 3.5,
        loop: true,
        next: null
      },
      roll: {
        frames: [ROW4[0], ROW4[1]], // use high speed Run frames for fast roll/waddle!
        fps: 6.5,
        loop: true,
        next: null
      },
      yawn: {
        frames: [ROW1[0], ROW1[1], ROW1[1], ROW1[0]], // front face -> mouth open/small action -> front face
        fps: 3,
        loop: false,
        next: 'idle'
      },
      fallAsleep: {
        frames: [ROW1[0], ROW2[0], ROW2[1]], // front -> surprised/dragged -> sleep flat
        fps: 3.5,
        loop: false,
        next: 'sleep'
      },
      sleep: {
        frames: [ROW2[1], ROW2[2]], // sleep flat -> sleep snoring/deep
        fps: 1.5,
        loop: true,
        next: null
      },
      wakeUp: {
        frames: [ROW2[3], ROW1[0]], // suddenly startled awake -> front idle
        fps: 4,
        loop: false,
        next: 'idle'
      },
      eatCake: {
        frames: [ROW3[0], ROW3[1], ROW3[1], ROW3[2]], // mouth open -> eating -> chewing -> content
        fps: 4,
        loop: false,
        next: 'happy'
      },
      eatApple: {
        frames: [ROW3[0], ROW3[1], ROW3[1], ROW3[2]],
        fps: 4,
        loop: false,
        next: 'happy'
      },
      happy: {
        frames: [ROW3[2], ROW1[0]], // satisfied grin -> front idle
        fps: 4,
        loop: false,
        next: 'idle'
      },
      wiggle: {
        frames: [ROW3[2], ROW1[0], ROW3[2], ROW1[0]],
        fps: 6,
        loop: false,
        next: 'idle'
      },
      drag: {
        frames: [ROW2[0]], // grabbed/suspended
        fps: 2,
        loop: true,
        next: null
      },
      
      // New Standard Jump Animation
      jump: {
        frames: [ROW3[3], ROW4[3], ROW4[2], ROW4[3], ROW4[4], ROW3[3]],
        fps: 5,
        loop: false,
        next: 'idle'
      }
    };
  }
}

// ═══════════════════════════════════════════════════════
// SECTION 4 — SPRITE LOADER WITH WHITE-BG REMOVAL
// ═══════════════════════════════════════════════════════
let spriteCanvas = null;  // processed sprite sheet (transparent bg)
let spriteReady  = false;

function loadAndProcessSprites(src) {
  const img = new Image();
  img.onload = () => {
    // Create off-screen canvas matching sheet size
    const oc  = document.createElement('canvas');
    oc.width  = img.naturalWidth  || img.width;
    oc.height = img.naturalHeight || img.height;
    const oc_ctx = oc.getContext('2d');
    oc_ctx.drawImage(img, 0, 0);

    // Direct transparent PNG load:
    // No background white removal is needed since the new image has built-in alpha transparency.
    // Preserves pure white elements (like cake cream and sleep bubbles) from being hollowed out.

    spriteCanvas = oc;
    spriteReady  = true;
    console.log(`Sprite loaded: ${oc.width}×${oc.height}`);
  };
  img.onerror = () => {
    console.error('Failed to load sprites.png — place your sprite sheet at the project root.');
  };
  img.src = src;
}

// --- Modular Hot-Swapping Skin Engine ---
let activeSkin = 'gulpin';
let petName = 'Gulpin';
let customScale = 1.0;

function loadSkin(skinId) {
  const fs = require('fs');
  const path = require('path');
  
  const skinDir = path.join(__dirname, '..', 'pets', skinId);
  const configPath = path.join(skinDir, 'config.json');
  const spritePath = path.join(skinDir, 'sprites.png');

  if (!fs.existsSync(spritePath)) {
    console.error('Sprite sheet not found for skin:', skinId);
    return;
  }

  activeSkin = skinId;
  spriteReady = false;

  let coordinates = null;
  petName = skinId;
  customScale = 1.0;

  if (fs.existsSync(configPath)) {
    try {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      petName = config.name || skinId;
      if (config.behavior) {
        if (typeof config.behavior.scale === 'number') {
          customScale = config.behavior.scale;
        }
      }
      if (config.coordinates) {
        coordinates = config.coordinates;
      }
    } catch (e) {
      console.error('Error parsing config for skin:', skinId, e);
    }
  }

  let isCustom = false;
  if (coordinates && coordinates.row1 && coordinates.row2 && coordinates.row3) {
    // 1. Advanced Custom Coordinates Mode
    ROW1 = coordinates.row1;
    ROW2 = coordinates.row2;
    ROW3 = coordinates.row3;
    ROW4 = coordinates.row4 || [];
    ROW5 = coordinates.row5 || [];
    isCustom = true;
    console.log(`Loaded custom coordinates for ${petName}`);
  } else {
    // 2. Standard 250x200 Grid Layout fallback mode
    const CELL_W = 250;
    const CELL_H = 200;
    
    function makeGridFrames(row, cols) {
      const frames = [];
      const y = row * CELL_H;
      for (let i = 0; i < cols; i++) {
        frames.push([i * CELL_W, y, CELL_W, CELL_H]);
      }
      return frames;
    }
    
    ROW1 = makeGridFrames(0, 5);
    ROW2 = makeGridFrames(1, 5);
    ROW3 = makeGridFrames(2, 5);
    ROW4 = makeGridFrames(3, 5);
    ROW5 = makeGridFrames(4, 5);
    isCustom = false;
    console.log(`Loaded standard 250x200 grid coordinates for ${petName}`);
  }

  // Hot-rebuild animations using the new frame array references
  rebuildAnimations(isCustom);

  // Reload sprites off-screen
  loadAndProcessSprites(spritePath);
  
  // Save active skin selection
  try {
    fs.writeFileSync(path.join(__dirname, 'active_pet.json'), JSON.stringify({ activeSkin }));
  } catch (e) {}
}

// IPC listener to swap skins from right-click context menu
ipcRenderer.on('menu-set-skin', (event, skinId) => {
  loadSkin(skinId);
  playAnim('idle', true);
});

// Load the persisted skin selection (or default to gulpin) at startup
let startupSkin = 'gulpin';
try {
  const fs = require('fs');
  const path = require('path');
  const settingsPath = path.join(__dirname, 'active_pet.json');
  if (fs.existsSync(settingsPath)) {
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (settings.activeSkin) {
      startupSkin = settings.activeSkin;
    }
  }
} catch (e) {}

loadSkin(startupSkin);

// ═══════════════════════════════════════════════════════
// SECTION 5 — ANIMATION STATE MACHINE
// ═══════════════════════════════════════════════════════
let currentAnim  = 'idle';
let frameIndex   = 0;
let frameTick    = 0;   // counts up per game-tick (60/s)

// Target FPS for animation = anim.fps
// Ticks per frame = 60 / anim.fps
function ticksPerFrame(anim) {
  return Math.round(60 / anim.fps);
}

function playAnim(name, force) {
  if (!force && currentAnim === name) return;
  if (!ANIMS[name]) return;
  currentAnim = name;
  frameIndex  = 0;
  frameTick   = 0;
}

function updateAnim() {
  const anim = ANIMS[currentAnim];
  frameTick++;
  if (frameTick >= ticksPerFrame(anim)) {
    frameTick = 0;
    frameIndex++;
    if (frameIndex >= anim.frames.length) {
      if (anim.loop) {
        frameIndex = 0;
      } else {
        // Animation done — transition
        const next = anim.next || 'idle';
        playAnim(next, true);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// SECTION 6 — BREATHING EFFECT (idle only)
// ═══════════════════════════════════════════════════════
let breathTick = 0;

function getBreathScale() {
  // Subtle breathing: scale oscillates ±1.5% at ~0.5 Hz
  breathTick++;
  const phase = (breathTick / 60) * Math.PI; // full cycle every 2s
  return 1.0 + Math.sin(phase) * 0.015;
}

// ═══════════════════════════════════════════════════════
// SECTION 7 — RENDER
// ═══════════════════════════════════════════════════════
// Draw padding so the character doesn't clip at edges
const DRAW_PAD = 4;

function render() {
  ctx.clearRect(0, 0, WIN_W, WIN_H);

  if (!spriteReady) {
    // Loading placeholder
    ctx.fillStyle = 'rgba(108,192,68,0.25)';
    ctx.beginPath();
    ctx.ellipse(WIN_W/2, WIN_H*0.65, WIN_W*0.32, WIN_H*0.22, 0, 0, Math.PI*2);
    ctx.fill();
    return;
  }

  const anim  = ANIMS[currentAnim];
  const frame = anim.frames[frameIndex] || anim.frames[0];
  const [sx, sy, sw, sh] = frame;

  // Destination rect (fit inside canvas with padding)
  const dw = WIN_W - DRAW_PAD * 2;
  const dh = WIN_H - DRAW_PAD * 2;
  const dx = DRAW_PAD;
  const dy = DRAW_PAD;

  ctx.save();

  // --- Breathing scale transform (idle only) ---
  if (currentAnim === 'idle') {
    const bs = getBreathScale();
    ctx.translate(WIN_W / 2, WIN_H / 2);
    ctx.scale(bs, bs);
    ctx.translate(-WIN_W / 2, -WIN_H / 2);
  }

  // --- Flip horizontally when walking RIGHT (since original sprites naturally face left) ---
  if (shouldFlip()) {
    ctx.translate(WIN_W, 0);
    ctx.scale(-1, 1);
  }

  // Consistent scaling and floor-alignment to keep body proportions 100% stable
  const scale = dw / 250; // Scale all frames using the widest frame width (250) to prevent size jumping
  const drawW = sw * scale;
  const drawH = sh * scale;
  const drawX = dx + (dw - drawW) / 2;
  const drawY = dy + (dh - drawH); // Floor alignment!

  ctx.drawImage(spriteCanvas, sx, sy, sw, sh, drawX, drawY, drawW, drawH);

  ctx.restore();
}

function shouldFlip() {
  if (currentAnim === 'drag') {
    return velX > 0;
  }
  if (roamMode === 'walk') {
    return (currentAnim === 'walk' || currentAnim === 'roll' || currentAnim === 'idle') && (roamTargetX > petX + 2);
  }
  if (roamMode === 'sports') {
    return sportsDirection === 1;
  }
  if (roamMode === 'stand') {
    return forceFlip;
  }
  return false;
}

// ═══════════════════════════════════════════════════════
// SECTION 8 — HIT TESTING (pixel-perfect transparency)
// ═══════════════════════════════════════════════════════
function isPixelOpaque(clientX, clientY) {
  if (!spriteReady) return false;
  // Read from the main canvas (already rendered this frame)
  const pixel = ctx.getImageData(clientX, clientY, 1, 1).data;
  return pixel[3] > 30; // alpha > ~12% counts as "hit"
}

// ═══════════════════════════════════════════════════════
// SECTION 9 — MOUSE EVENTS
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// SECTION 9 — MOUSE EVENTS & NATIVE CONTEXT MENU IPC
// ═══════════════════════════════════════════════════════
window.addEventListener('mousemove', (e) => {
  if (isDragging) {
    const newX = e.screenX - dragOffX;
    const newY = e.screenY - dragOffY;
    petX = Math.max(-60, Math.min(SCREEN_W - WIN_W + 60, newX));
    petY = Math.max(0, Math.min(SCREEN_H - TASKBAR_H - WIN_H + 30, newY));
    sendWindowPos(petX, petY);

    velX = (e.screenX - lastMouseX) * 0.4;
    velY = (e.screenY - lastMouseY) * 0.4;
    lastMouseX = e.screenX;
    lastMouseY = e.screenY;
    return;
  }

  // Pixel-perfect click-through: ignore transparent areas
  const hit = isPixelOpaque(e.clientX, e.clientY);
  if (hit) {
    ipcRenderer.send('set-ignore-mouse-events', false);
    canvas.style.cursor = 'grab';
  } else {
    ipcRenderer.send('set-ignore-mouse-events', true, { forward: true });
    canvas.style.cursor = 'default';
  }
});

window.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (!isPixelOpaque(e.clientX, e.clientY)) return;

  isDragging   = true;
  dragOffX     = e.screenX - petX;
  dragOffY     = e.screenY - petY;
  lastMouseX   = e.screenX;
  lastMouseY   = e.screenY;
  velX = 0; velY = 0;
  isFalling    = false;

  playAnim('drag', true);
  canvas.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', (e) => {
  if (!isDragging) return;
  isDragging = false;
  isFalling  = true;

  velX = Math.max(-14, Math.min(14, velX));
  velY = Math.max(-12, Math.min(12, velY));

  // Snap if already near floor
  if (petY >= FLOOR_Y() - 2) {
    petY = FLOOR_Y();
    velX = velY = 0;
    isFalling = false;
  }

  canvas.style.cursor = 'grab';
  playAnim('idle', true);
});

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (isPixelOpaque(e.clientX, e.clientY)) {
    const sleeping = (currentAnim === 'sleep' || currentAnim === 'fallAsleep');
    ipcRenderer.send('show-context-menu', { roamMode, sleeping, activeSkin });
  }
});

// IPC listeners for native context menu actions
ipcRenderer.on('menu-feed', (event, type) => {
  if (type === 'cake') {
    playAnim('eatCake', true);
  } else {
    playAnim('eatApple', true);
  }
});

ipcRenderer.on('menu-pet', () => {
  playAnim('wiggle', true);
});

ipcRenderer.on('menu-set-mode', (event, mode) => {
  roamMode = mode;
  if (roamMode === 'walk') {
    roamTargetX = Math.random() * (SCREEN_W - WIN_W);
    roamTimer = 60;
    playAnim('idle');
  } else if (roamMode === 'sports') {
    sportsDirection = (petX < SCREEN_W / 2) ? 1 : -1;
    roamTimer = 0;
    playAnim('walk');
  } else if (roamMode === 'stand') {
    roamTimer = 60;
    playAnim('idle');
  }
});

ipcRenderer.on('menu-toggle-sleep', () => {
  const sleeping = (currentAnim === 'sleep' || currentAnim === 'fallAsleep');
  if (sleeping) {
    playAnim('wakeUp', true);
  } else {
    playAnim('fallAsleep', true);
  }
});

ipcRenderer.on('menu-resize', (event, size) => {
  const sizes = { sm: 80, md: 110, lg: 140 };
  const s = sizes[size] || 110;
  targetSize = s;
  ipcRenderer.send('resize-window', { width: s, height: s });
  // Clamp position to screen with relaxed boundary margins matching the drag constraints
  petX = Math.max(-60, Math.min(SCREEN_W - s + 60, petX));
  petY = Math.max(0, Math.min(SCREEN_H - TASKBAR_H - s + 30, petY));
  sendWindowPos(petX, petY);
});

// ═══════════════════════════════════════════════════════
// SECTION 11 — PHYSICS (throw + gravity)
// ═══════════════════════════════════════════════════════
function updatePhysics() {
  if (isDragging) return;
  if (!isFalling) return;

  velY += 0.6; // gravity
  petX += velX;
  petY += velY;
  velX *= 0.98; // air friction

  // Horizontal bounds (relaxed by 60px to let the pet's body touch the screen edge)
  if (petX <= -60) { petX = -60; velX = Math.abs(velX) * 0.4; }
  if (petX >= SCREEN_W - WIN_W + 60) { petX = SCREEN_W - WIN_W + 60; velX = -Math.abs(velX) * 0.4; }

  // Ceiling
  if (petY <= 0) { petY = 0; velY = 0; }

  // Floor
  const fy = FLOOR_Y();
  if (petY >= fy) {
    petY = fy;
    if (Math.abs(velY) > 3) {
      velY = -velY * 0.30; // bounce
      velX *= 0.5;
      playAnim('wiggle', true); // bounce reaction
    } else {
      velX = 0; velY = 0;
      isFalling = false;
      playAnim('idle', true);
    }
  }

  sendWindowPos(petX, petY);
}

// ═══════════════════════════════════════════════════════
// SECTION 12 — ROAMING (autonomous walking)
// ═══════════════════════════════════════════════════════
// (currentRoamSpeed is initialized in Section 2 state declarations)

function updateRoaming() {
  if (isDragging || isFalling) return;
  
  const fy = FLOOR_Y();
  if (petY !== fy) { petY = fy; sendWindowPos(petX, petY); }

  if (roamMode === 'stand') {
    // Stand Mode (罰站模式): Never move horizontally, just decrement timer in in-place states
    const isStationaryState = (currentAnim === 'idle' || currentAnim === 'happy' || currentAnim === 'yawn');
    if (isStationaryState) {
      roamTimer--;
      if (roamTimer <= 0) {
        pickNextBehavior();
      }
    }
    return;
  }

  if (roamMode === 'walk') {
    const canRoam = (currentAnim === 'idle' || currentAnim === 'walk' || currentAnim === 'roll');
    if (!canRoam) return;

    const dx = roamTargetX - petX;
    if (Math.abs(dx) > currentRoamSpeed) {
      if (currentAnim === 'idle') {
        if (Math.random() < 0.5) {
          currentRoamSpeed = 0.6 + Math.random() * 0.7; // Slow walk
          playAnim('walk');
        } else {
          currentRoamSpeed = 1.4 + Math.random() * 0.8; // Fast roll
          playAnim('roll');
        }
      }
      petX += Math.sign(dx) * currentRoamSpeed;
      petX = Math.max(-60, Math.min(SCREEN_W - WIN_W + 60, petX));
      sendWindowPos(petX, petY);
    } else {
      petX = roamTargetX;
      playAnim('idle');
      roamTimer--;
      if (roamTimer <= 0) {
        pickNextBehavior();
      }
    }
  } else if (roamMode === 'sports') {
    // Sports Mode (運動模式): waddle back and forth continuously
    const isSleepingState = (currentAnim === 'sleep' || currentAnim === 'fallAsleep' || currentAnim === 'wakeUp');
    if (isSleepingState) return;

    if (currentAnim === 'happy') {
      roamTimer--;
      if (roamTimer <= 0) {
        // Resume walking in the opposite direction
        if (Math.random() < 0.4) {
          currentRoamSpeed = 1.0;
          playAnim('walk', true);
        } else {
          currentRoamSpeed = 1.8;
          playAnim('roll', true);
        }
      }
      return;
    }

    const targetX = (sportsDirection === 1) ? (SCREEN_W - WIN_W + 60) : -60;
    const dx = targetX - petX;

    if (Math.abs(dx) > 2) {
      if (currentAnim !== 'walk' && currentAnim !== 'roll') {
        if (Math.random() < 0.4) {
          currentRoamSpeed = 1.0;
          playAnim('walk');
        } else {
          currentRoamSpeed = 1.8;
          playAnim('roll');
        }
      }
      petX += Math.sign(dx) * currentRoamSpeed;
      petX = Math.max(-60, Math.min(SCREEN_W - WIN_W + 60, petX));
      sendWindowPos(petX, petY);

      // 0.05% chance to slack off/take a nap per frame of walking (~3% chance per second)
      if (Math.random() < 0.0005) {
        playAnim('fallAsleep');
        sleepDuration = (6 + Math.random() * 8) * 60; // sleep for 6-14 seconds
        sleepTick = 0;
      }
    } else {
      // Arrived at screen edge! Turn around!
      sportsDirection = -sportsDirection;
      playAnim('happy', true);
      roamTimer = 60; // stand wiggling for 1 second before waddling back
    }
  }
}

// ═══════════════════════════════════════════════════════
// SECTION 13 — RANDOM BEHAVIOR
// ═══════════════════════════════════════════════════════
function pickNextBehavior() {
  if (roamMode === 'walk') {
    const r = Math.random();
    if (r < 0.70) {
      // 70% Roam state: randomize distance, direction, and target
      const minX = -60;
      const maxX = SCREEN_W - WIN_W + 60;
      roamTargetX = minX + Math.random() * (maxX - minX);
      
      // Randomize speed: walk [0.6, 1.3], roll [1.4, 2.2]
      if (Math.random() < 0.5) {
        currentRoamSpeed = 0.6 + Math.random() * 0.7;
        playAnim('walk');
      } else {
        currentRoamSpeed = 1.4 + Math.random() * 0.8;
        playAnim('roll');
      }
      roamTimer = 80 + Math.random() * 150;
    } else {
      // 30% Stationary actions (yawn, sleep, or idle)
      const rStationary = Math.random();
      if (rStationary < 0.35) {
        playAnim('yawn');
        roamTimer = 300;
      } else if (rStationary < 0.70) {
        playAnim('fallAsleep');
        sleepDuration = (10 + Math.random() * 15) * 60;
        sleepTick = 0;
        roamTimer = 9999;
      } else {
        playAnim('idle');
        roamTimer = 120 + Math.random() * 180;
      }
    }
  } else if (roamMode === 'stand') {
    // Stand Mode (罰站模式): play stationary animations in place
    forceFlip = Math.random() < 0.5; // Randomly flip/rotate to look around
    const rStationary = Math.random();
    if (rStationary < 0.35) {
      playAnim('yawn');
      roamTimer = 300;
    } else if (rStationary < 0.70) {
      playAnim('fallAsleep');
      sleepDuration = (10 + Math.random() * 15) * 60;
      sleepTick = 0;
      roamTimer = 9999;
    } else {
      if (Math.random() < 0.5) {
        playAnim('happy');
      } else {
        playAnim('idle');
      }
      roamTimer = 120 + Math.random() * 180;
    }
  }
}

// Sleep auto-wake timer
let sleepDuration = 0;
let sleepTick     = 0;

function updateSleepTimer() {
  if (currentAnim !== 'sleep') { sleepTick = 0; return; }
  sleepTick++;
  if (sleepDuration > 0 && sleepTick >= sleepDuration) {
    sleepDuration = 0;
    sleepTick     = 0;
    playAnim('wakeUp', true);
    
    if (roamMode === 'walk') {
      roamTargetX = Math.random() * (SCREEN_W - WIN_W);
      roamTimer   = 80;
    } else if (roamMode === 'stand') {
      roamTimer   = 80;
    }
  }
}

// ═══════════════════════════════════════════════════════
// SECTION 14 — MAIN GAME LOOP (60fps)
// ═══════════════════════════════════════════════════════
function syncCanvasSize() {
  if (canvas.width !== targetSize || canvas.height !== targetSize) {
    canvas.width  = targetSize;
    canvas.height = targetSize;
    WIN_W = targetSize;
    WIN_H = targetSize;
  }
}

function gameLoop() {
  syncCanvasSize();
  updateAnim();
  updatePhysics();
  updateRoaming();
  updateSleepTimer();
  render();
  requestAnimationFrame(gameLoop);
}

// Bootstrap after a short delay so the window is fully ready
setTimeout(() => {
  // Start at floor center
  petX = (SCREEN_W - WIN_W) / 2;
  petY = FLOOR_Y();
  sendWindowPos(petX, petY);
  roamTargetX = petX;
  roamTimer   = 180; // wait 3s before first random behavior

  playAnim('idle', true);
  requestAnimationFrame(gameLoop);
}, 150);
