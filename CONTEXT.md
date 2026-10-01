# Context

This repo contains a small set of standalone Three.js / WebGPU visual experiences.

## Glossary

- `demo` - a single runnable experience in this repo.
- `Noise` - the noise/dithering demo in `noise/`.
- `TSL Sphere` - the WebGPU / TSL demo in `tsl/`.
- `Valley` - the SVG-driven landscape demo in `valley/`.
- `Bones` - the tree demo in `bones/`, where each branch is treated as a segment/bone.
- `segment` - a branch treated as a directed edge from its local origin toward its local positive Y endpoint.
- `wind direction` - a normalized world-space vector `w` constrained to the XY plane, shared by all segments.
- `full tilt` - the wind state where every segment's world-space direction equals the wind direction.
- `rest pose` - the original, undeformed arrangement and orientation of all segments before wind is applied.
- `no twist` - wind changes a segment's pointing direction without changing its rest-pose roll around its longitudinal axis.
- `spherical interpolation` - each segment follows the shortest great-circle rotation from its rest direction to the wind direction as `k` moves from 0 to 1.
- `antiparallel direction` - the special case where a segment's rest direction is exactly opposite the wind direction and the shortest spherical path requires a deterministic great-circle axis.
- `world-aligned tilt` - each segment is tilted independently toward the shared wind direction in world space, while its local rotation is solved relative to its parent's tilted orientation.
- `accumulated rest distance` - a segment's distance from the root measured along its parent-to-child path in the undeformed tree.
- `normalized rest distance` - accumulated rest distance divided by the greatest accumulated rest distance in the tree, producing a root-to-tip factor from 0 to 1.
- `distance response curve` - the function that maps normalized rest distance to bend susceptibility; the current candidate is (u^p), with (p=1.5) as the initial shape.
- `root response` - the nonzero minimum wind susceptibility of the root segment; bend susceptibility increases from this value toward 1 at the farthest branches.
- `rest path distance` - accumulated distance along the tree path, where each parent-to-child contribution is measured between their rest-pose world-space origins.
- `bend ratio` - a segment's effective spherical interpolation ratio, calculated as global wind strength multiplied by its distance-based susceptibility.
- `precomputed bend profile` - rest-path distances and their normalized distance factors are calculated during initialization and reused while the wind strength changes.
- `moving wind noise` - a spatial noise field sampled at segment coordinates translated over time along the wind direction.
- `reference point` - a virtual point in the world XZ plane whose accumulated movement translates the wind-noise sampling domain.
- `wind reference point` - the public Windvane-owned XY position, initialized at the origin and advanced by the current wind direction, speed, and elapsed time.
- `reference point coordinates` - a `Vector2` convention where `.x` represents world X and `.y` represents world Y.
- `sampling coordinates` - the XY displacement from the reference point to a segment's rest-pose world position.
- `noise bend ratio` - the signed local interpolation ratio produced by multiplying global wind strength, the sampled noise value, and the segment's distance-based susceptibility.
- `wind sampler bank` - an ordered collection of Perlin samplers where lower indices provide broad trunk-scale variation and higher indices provide finer twig-scale variation.
- `noise sampler index` - the integer authoring value on a bone that selects one sampler from the wind sampler bank; Blender exports it as `bone.userData.noiseScale`.
- `noise octave index` - the integer authoring value on a bone that selects the highest octave included in its normalized multi-scale noise mix; Blender exports it as `bone.userData.noiseScale`.
- `octave depth bands` - equal normalized-distance intervals that map segments to noise octave indices, with the final interval clamped to the highest available octave.
- `wind phase lead` - an octave-dependent spatial offset along the wind direction that makes finer branches respond earlier than coarser branches.
- `sanitized sampler index` - the validated integer sampler index stored during tree initialization, defaulting to 0 when the Blender property is absent or invalid.
- `sampler bank configuration` - the ordered sampler lattice sizes supplied to Windvane; when omitted, the default scales are broad-to-fine `[2, 4]`.
- `sampler bank contract` - caller-provided sampler sizes are trusted to be sorted positive integers greater than 1.
- `Blender authoring coordinates` - leaf instance positions exported from Blender use a Z-up basis where +X is unchanged, +Y maps toward Three.js -Z, and +Z is vertical.
- `Bones scene coordinates` - the Three.js tree scene uses a Y-up basis; Blender leaf positions are converted as `(x, y, z) -> (x, z, -y)` before rendering.
- `Blender-aligned camera view` - the Bones camera looks from Blender +X toward the origin, with Blender +Z as screen-up and Blender +Y as screen-right.
- `leaf sprite roll` - the exported `rot_z_deg` value is retained as the camera-facing sprite's screen-space roll; Blender X/Y rotation is not applied to sprites.
- `leaf world normal` - each exported leaf normal is an authoritative world-space direction used to determine that leaf's diffuse environment irradiance; it is not a plane-local normal.
- `leaf bone attachment` - a leaf is attached to the bone whose world-space base point (bone origin) is closest to the leaf's world-space position.
- `leaf material` - the leaf sprite material owns CSV instance-attribute parsing and GPU attribute nodes, while the Bones scene owns the instanced Sprite object and its scene attachment.
- `leaf particle volume` - the bounded spatial region in which procedural falling leaf particles are placed.
- `grid position` - a regularly spaced starting location within the leaf particle volume, before a particle's random spread offset is added.
- `spread offset` - a random displacement added to a grid position to vary the initial placement of a leaf particle.
- `particle layout seed` - a value selecting a reproducible arrangement of spread offsets; identical seeds and placement settings produce identical initial particle positions.
- `particle velocity` - a leaf particle's constant direction and speed of travel, producing displacement proportional to elapsed time; falling follows negative Z with sideways drift toward positive X and Y in the particle volume's coordinates.
