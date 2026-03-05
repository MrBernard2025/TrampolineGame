# Trampoline Trick Game

Small local browser game built with plain HTML, CSS, JavaScript, and HTML5 Canvas. The goal is to chain jumps, perform flips while airborne, and land upright near the center of the trampoline to keep the combo alive.

## Files

- `index.html`
- `style.css`
- `game.js`
- `README.md`

## How to Run

### Option 1: Open directly

Open `index.html` in a browser on macOS.

### Option 2: Run a simple local server

From the project folder:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

### iPhone

1. Run a local server from this folder:
   ```bash
   python3 -m http.server 8000
   ```
2. On iPhone, open Safari and visit `http://<your-mac-local-ip>:8000`.
3. Use the on-screen touch buttons to play.

## Controls

- `Space`: start a run from the trampoline
- `Left Arrow` / `Right Arrow`: move left or right in the air
- `A` / `D`: alternative horizontal movement keys
- `Q`: front flip
- `E`: backflip
- Hold `Q` or `E`: rotate while airborne (rotation stops when released)
- `R`: restart after a crash

After the run starts, successful landings auto-chain into the next bounce until you fail.

Touch controls:

- `Left` / `Right`: hold to move horizontally in the air
- `Front Flip` / `Back Flip`: hold to rotate
- `Start / Jump`: starts the run
- `Restart`: restarts after crash

## Scoring

- Successful landings continue the run and increase combo count.
- Perfect landings give a larger base score than good landings.
- Each full airborne rotation adds a trick bonus.
- Higher combo counts add extra landing bonus points.
- Failed landings end the run and reset the combo.
- Off-balance landings reset combo but bouncing continues.
- The run only ends on a face/neck impact.

Landing quality depends on:

- Rotation alignment at contact
  - Perfect: within `±10deg`
  - Good: within `±25deg`
  - Fail: outside `±25deg`
- Horizontal alignment from trampoline center
  - Perfect: within `20px`
  - Good: within `60px`
  - Fail: outside `60px`
- Angular velocity at landing
  - If spin is above the configured safe threshold, the landing fails

## Tunable Constants

The main gameplay constants are at the top of [`game.js`](./game.js). The most useful ones for difficulty tuning are:

- `gravity`: overall fall speed
- `jumpVelocity`: how high each bounce launches the player
- `springStrength`: how fast the trampoline compresses toward launch
- `springDamping`: how quickly trampoline compression settles
- `angularVelocityMultiplier`: flip acceleration from pressing `Q` or `E`
- `holdAngularBoost`: extra tuck-like spin while holding a flip key
- `maxAngularSpeed`: clamp for rotation speed
- `safeLandingSpin`: maximum safe angular velocity for landing
- `perfectAngleDeg` / `goodAngleDeg`: landing angle tolerances
- `perfectOffsetPx` / `goodOffsetPx`: landing position tolerances

## Notes

- Rendering uses only the HTML5 Canvas API.
- There are no frameworks, build tools, or audio implementations in this project.
