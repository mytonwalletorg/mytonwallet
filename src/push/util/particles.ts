// GPU-Accelerated Particle System Library

import generateUniqueId from '../../util/generateUniqueId';

import { getIsInBackground } from '../../hooks/useBackgroundMode';

export interface ParticleConfig {
  width?: number;
  height?: number;
  particleCount?: number;
  color?: readonly [number, number, number];
  speed?: number;
  baseSize?: number;
  minSpawnRadius?: number;
  maxSpawnRadius?: number;
  distanceLimit?: number;
  fadeInTime?: number;
  fadeOutTime?: number;
  minLifetime?: number;
  maxLifetime?: number;
  maxStartTimeDelay?: number;
  edgeFadeZone?: number;
  centerShift?: readonly [number, number];
  accelerationFactor?: number;
  selfDestroyTime?: number;
}

interface Locations {
  attributes: {
    startPosition: number;
    velocity: number;
    startTime: number;
    lifetime: number;
    size: number;
    baseOpacity: number;
  };
  uniforms: {
    resolution: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    color: WebGLUniformLocation | null;
    canvasWidth: WebGLUniformLocation | null;
    canvasHeight: WebGLUniformLocation | null;
    accelerationFactor: WebGLUniformLocation | null;
    fadeInTime: WebGLUniformLocation | null;
    fadeOutTime: WebGLUniformLocation | null;
    edgeFadeZone: WebGLUniformLocation | null;
    rotationMatrices: WebGLUniformLocation | null;
    spawnCenter: WebGLUniformLocation | null;
  };
}

interface Buffers {
  startPosition: WebGLBuffer | null;
  velocity: WebGLBuffer | null;
  startTime: WebGLBuffer | null;
  lifetime: WebGLBuffer | null;
  size: WebGLBuffer | null;
  baseOpacity: WebGLBuffer | null;
}

interface ParticleSystem {
  id: string;
  config: Required<ParticleConfig>;
  buffers: Buffers;
  startTime: number;
  seed: number;
  centerX: number;
  centerY: number;
  avgDistance: number;
  selfDestroyTimeout?: number;
}

interface ParticleSystemManager {
  addSystem: (options: Partial<ParticleConfig>) => NoneToVoidFunction;
}

class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  nextBetween(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

const DEFAULT_CONFIG: Required<ParticleConfig> = {
  width: 400,
  height: 250,
  particleCount: 19,
  color: [0, 152 / 255, 234 / 255], // #0098EA (TON)
  speed: 18,
  baseSize: 6,
  minSpawnRadius: 55,
  maxSpawnRadius: 70,
  distanceLimit: 1,
  fadeInTime: 0.25,
  fadeOutTime: 1,
  minLifetime: 3,
  maxLifetime: 5,
  maxStartTimeDelay: 1,
  edgeFadeZone: 50,
  centerShift: [0, 0],
  accelerationFactor: 3,
  selfDestroyTime: 0,
};

export const PARTICLE_COLORS = {
  TON: [0, 152 / 255, 234 / 255] as [number, number, number], // #0098EA
  USDT: [0, 147 / 255, 147 / 255] as [number, number, number], // #009393
  MY: [64 / 255, 122 / 255, 207 / 255] as [number, number, number], // #407ACF
};

const SIZE_SMALL = 0.67;
const SIZE_MEDIUM = 1.33;
const SIZE_LARGE = 2.0;

const canvasManagers = new Map<HTMLCanvasElement, ParticleSystemManager>();

export function setupParticles(
  canvas: HTMLCanvasElement,
  options: Partial<ParticleConfig>,
) {
  let manager = canvasManagers.get(canvas);
  if (!manager) {
    manager = createParticleSystemManager(canvas);
    canvasManagers.set(canvas, manager);
  }

  return manager.addSystem(options);
}

function createParticleSystemManager(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: false,
  })!;

  if (!gl) {
    throw new Error('WebGL not supported');
  }

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);

  if (!vertexShader || !fragmentShader) {
    throw new Error('Failed to create shaders');
  }

  const program = createProgram(gl, vertexShader, fragmentShader)!;
  if (!program) {
    throw new Error('Failed to create shader program');
  }

  const dpr = window.devicePixelRatio || 1;
  const systems = new Map<string, ParticleSystem>();

  const locations: Locations = {
    attributes: {
      startPosition: gl.getAttribLocation(program, 'a_startPosition'),
      velocity: gl.getAttribLocation(program, 'a_velocity'),
      startTime: gl.getAttribLocation(program, 'a_startTime'),
      lifetime: gl.getAttribLocation(program, 'a_lifetime'),
      size: gl.getAttribLocation(program, 'a_size'),
      baseOpacity: gl.getAttribLocation(program, 'a_baseOpacity'),
    },
    uniforms: {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      time: gl.getUniformLocation(program, 'u_time'),
      color: gl.getUniformLocation(program, 'u_color'),
      canvasWidth: gl.getUniformLocation(program, 'u_canvasWidth'),
      canvasHeight: gl.getUniformLocation(program, 'u_canvasHeight'),
      accelerationFactor: gl.getUniformLocation(program, 'u_accelerationFactor'),
      fadeInTime: gl.getUniformLocation(program, 'u_fadeInTime'),
      fadeOutTime: gl.getUniformLocation(program, 'u_fadeOutTime'),
      edgeFadeZone: gl.getUniformLocation(program, 'u_edgeFadeZone'),
      rotationMatrices: gl.getUniformLocation(program, 'u_rotationMatrices'),
      spawnCenter: gl.getUniformLocation(program, 'u_spawnCenter'),
    },
  };

  let animationId: number | undefined;
  let unsubscribeFromIsInBackground: NoneToVoidFunction | undefined = undefined;

  function initParticleData(system: ParticleSystem): void {
    const rng = new SeededRandom(system.seed);
    const { config } = system;

    const startPositions = new Float32Array(config.particleCount * 2);
    const velocities = new Float32Array(config.particleCount * 2);
    const startTimes = new Float32Array(config.particleCount);
    const lifetimes = new Float32Array(config.particleCount);
    const sizes = new Float32Array(config.particleCount);
    const baseOpacities = new Float32Array(config.particleCount);

    for (let i = 0; i < config.particleCount; i++) {
      const angle = rng.next() * Math.PI * 2;
      const spawnRadius = rng.nextBetween(config.minSpawnRadius, config.maxSpawnRadius);

      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const spawnX = system.centerX + cos * spawnRadius;
      const spawnY = system.centerY + sin * spawnRadius;

      startPositions[i * 2] = spawnX * dpr;
      startPositions[i * 2 + 1] = spawnY * dpr;

      lifetimes[i] = rng.nextBetween(config.minLifetime, config.maxLifetime);
      startTimes[i] = rng.next() * config.maxStartTimeDelay;

      const travelDist = rng.nextBetween(
        system.avgDistance * config.distanceLimit * 0.5,
        system.avgDistance * config.distanceLimit,
      );

      // Calculate speed based on travel distance and lifetime
      const speed = (travelDist / lifetimes[i]) * dpr;

      velocities[i * 2] = cos * speed;
      velocities[i * 2 + 1] = sin * speed;

      const sizeVariant = rng.next();
      if (sizeVariant < 0.3) {
        sizes[i] = config.baseSize * SIZE_SMALL * dpr;
      } else if (sizeVariant < 0.7) {
        sizes[i] = config.baseSize * SIZE_MEDIUM * dpr;
      } else {
        sizes[i] = config.baseSize * SIZE_LARGE * dpr;
      }

      baseOpacities[i] = rng.nextBetween(0.1, 0.7);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.startPosition);
    gl.bufferData(gl.ARRAY_BUFFER, startPositions, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.velocity);
    gl.bufferData(gl.ARRAY_BUFFER, velocities, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.startTime);
    gl.bufferData(gl.ARRAY_BUFFER, startTimes, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.lifetime);
    gl.bufferData(gl.ARRAY_BUFFER, lifetimes, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.size);
    gl.bufferData(gl.ARRAY_BUFFER, sizes, gl.STATIC_DRAW);

    gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.baseOpacity);
    gl.bufferData(gl.ARRAY_BUFFER, baseOpacities, gl.STATIC_DRAW);
  }

  function initCanvas(): void {
    // Find the max canvas size from all systems
    let maxWidth = 0;
    let maxHeight = 0;
    systems.forEach((system) => {
      maxWidth = Math.max(maxWidth, system.config.width);
      maxHeight = Math.max(maxHeight, system.config.height);
    });

    // Default to first system's size if no systems yet
    if (systems.size === 0) {
      maxWidth = DEFAULT_CONFIG.width;
      maxHeight = DEFAULT_CONFIG.height;
    }

    canvas.width = maxWidth * dpr;
    canvas.height = maxHeight * dpr;
    canvas.style.width = maxWidth + 'px';
    canvas.style.height = maxHeight + 'px';
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function initWebGLState(): void {
    gl.useProgram(program);

    // Set static uniforms that will be updated per system
    gl.uniform2f(locations.uniforms.resolution, canvas.width, canvas.height);

    gl.uniformMatrix2fv(locations.uniforms.rotationMatrices, false, getRotations());

    // Set blending state
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    // Set clear color
    gl.clearColor(0, 0, 0, 0);
  }

  function render(currentTime: number): void {
    if (!animationId) return;

    gl.clear(gl.COLOR_BUFFER_BIT);

    // Render all systems
    systems.forEach((system) => {
      const systemTime = (currentTime - system.startTime) / 1000;

      // Set uniforms for this system
      gl.uniform1f(locations.uniforms.time, systemTime);
      gl.uniform3fv(locations.uniforms.color, system.config.color);
      gl.uniform1f(locations.uniforms.canvasWidth, system.config.width * dpr);
      gl.uniform1f(locations.uniforms.canvasHeight, system.config.height * dpr);
      gl.uniform1f(locations.uniforms.accelerationFactor, system.config.accelerationFactor);
      gl.uniform1f(locations.uniforms.fadeInTime, system.config.fadeInTime);
      gl.uniform1f(locations.uniforms.fadeOutTime, system.config.fadeOutTime);
      gl.uniform1f(locations.uniforms.edgeFadeZone, system.config.edgeFadeZone * dpr);
      gl.uniform2f(locations.uniforms.spawnCenter, system.centerX * dpr, system.centerY * dpr);

      // Bind attributes for this system
      gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.startPosition);
      gl.enableVertexAttribArray(locations.attributes.startPosition);
      gl.vertexAttribPointer(locations.attributes.startPosition, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.velocity);
      gl.enableVertexAttribArray(locations.attributes.velocity);
      gl.vertexAttribPointer(locations.attributes.velocity, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.startTime);
      gl.enableVertexAttribArray(locations.attributes.startTime);
      gl.vertexAttribPointer(locations.attributes.startTime, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.lifetime);
      gl.enableVertexAttribArray(locations.attributes.lifetime);
      gl.vertexAttribPointer(locations.attributes.lifetime, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.size);
      gl.enableVertexAttribArray(locations.attributes.size);
      gl.vertexAttribPointer(locations.attributes.size, 1, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, system.buffers.baseOpacity);
      gl.enableVertexAttribArray(locations.attributes.baseOpacity);
      gl.vertexAttribPointer(locations.attributes.baseOpacity, 1, gl.FLOAT, false, 0, 0);

      // Draw particles for this system
      gl.drawArrays(gl.POINTS, 0, system.config.particleCount);
    });

    animationId = requestAnimationFrame(render);
  }

  function addSystem(options: Partial<ParticleConfig>) {
    const id = generateUniqueId();
    const config: Required<ParticleConfig> = { ...DEFAULT_CONFIG, ...options };

    const buffers: Buffers = {
      startPosition: gl.createBuffer(),
      velocity: gl.createBuffer(),
      startTime: gl.createBuffer(),
      lifetime: gl.createBuffer(),
      size: gl.createBuffer(),
      baseOpacity: gl.createBuffer(),
    };

    const system: ParticleSystem = {
      id,
      config,
      buffers,
      startTime: performance.now(),
      seed: Math.floor(Math.random() * 1000000),
      centerX: config.width / 2 + config.centerShift[0],
      centerY: config.height / 2 + config.centerShift[1],
      avgDistance: (config.width / 2 + config.height / 2) / 2,
    };

    systems.set(id, system);

    initParticleData(system);
    initCanvas();

    if (config.selfDestroyTime) {
      system.selfDestroyTimeout = window.setTimeout(() => {
        removeSystem(id);
      }, config.selfDestroyTime * 1000);
    }

    if (systems.size === 1) {
      initWebGLState();

      unsubscribeFromIsInBackground = getIsInBackground.subscribe(() => {
        const isActive = !getIsInBackground();
        if (isActive && !animationId) {
          animationId = requestAnimationFrame(render);
        } else if (!isActive && animationId) {
          cancelAnimationFrame(animationId);
          animationId = undefined;
        }
      });

      animationId = requestAnimationFrame(render);
    }

    return () => removeSystem(id);
  }

  function removeSystem(id: string): void {
    const system = systems.get(id);
    if (!system) return;

    if (system.selfDestroyTimeout) {
      clearTimeout(system.selfDestroyTimeout);
    }

    Object.values(system.buffers).forEach((buffer) => {
      if (buffer) gl.deleteBuffer(buffer);
    });

    systems.delete(id);

    if (systems.size === 0) {
      destroy();
    }
  }

  function destroy(): void {
    if (animationId !== undefined) {
      cancelAnimationFrame(animationId);
      animationId = undefined;
    }

    unsubscribeFromIsInBackground?.();

    systems.clear();

    gl.deleteProgram(program);
    gl.deleteShader(vertexShader!);
    gl.deleteShader(fragmentShader!);

    canvasManagers.delete(canvas);
  }

  return { addSystem };
}

const VERTEX_SHADER_SOURCE = `
    attribute vec2 a_startPosition;
    attribute vec2 a_velocity;
    attribute float a_startTime;
    attribute float a_lifetime;
    attribute float a_size;
    attribute float a_baseOpacity;

    uniform vec2 u_resolution;
    uniform float u_time;
    uniform float u_canvasWidth;
    uniform float u_canvasHeight;
    uniform float u_accelerationFactor;
    uniform float u_fadeInTime;
    uniform float u_fadeOutTime;
    uniform float u_edgeFadeZone;
    uniform mat2 u_rotationMatrices[18];
    uniform vec2 u_spawnCenter;

    varying float v_opacity;

    void main() {
        float totalAge = u_time - a_startTime;
        float age = mod(totalAge, a_lifetime);

        // For the initial animation, fade in all particles
        float globalFadeIn = min(u_time / u_fadeInTime, 1.0);

        float lifeRatio = age / a_lifetime;

        // Calculate rotation based on completed lifecycles
        float lifecycleCount = floor(totalAge / a_lifetime);
        int rotationIndex = int(mod(lifecycleCount, 18.0));

        // Get rotation matrix
        mat2 rotationMatrix = u_rotationMatrices[rotationIndex];

        // Rotate start position around spawn center
        vec2 startOffset = a_startPosition - u_spawnCenter;
        vec2 rotatedStartOffset = rotationMatrix * startOffset;
        vec2 rotatedStartPosition = u_spawnCenter + rotatedStartOffset;

        // Apply rotation matrix to velocity
        vec2 rotatedVelocity = rotationMatrix * a_velocity;

        // Apply shoot-out effect: fast initial speed that slows down
        float speedMultiplier = 1.0 + u_accelerationFactor * exp(-3.0 * lifeRatio);

        vec2 position = rotatedStartPosition + rotatedVelocity * age * speedMultiplier;

        float opacity = 1.0;
        if (lifeRatio < u_fadeInTime / a_lifetime) {
            opacity = (lifeRatio * a_lifetime) / u_fadeInTime;
        } else if (lifeRatio > 1.0 - u_fadeOutTime / a_lifetime) {
            opacity = (1.0 - lifeRatio) * a_lifetime / u_fadeOutTime;
        }
        opacity *= a_baseOpacity * globalFadeIn;

        float distToLeft = position.x;
        float distToRight = u_canvasWidth - position.x;
        float distToTop = position.y;
        float distToBottom = u_canvasHeight - position.y;
        float distToEdge = min(min(distToLeft, distToRight), min(distToTop, distToBottom));

        if (distToEdge < u_edgeFadeZone) {
            opacity *= distToEdge / u_edgeFadeZone;
        }

        vec2 clipSpace = ((position / u_resolution) * 2.0 - 1.0) * vec2(1, -1);
        gl_Position = vec4(clipSpace, 0, 1);
        gl_PointSize = a_size;
        v_opacity = opacity;
    }
`;

const FRAGMENT_SHADER_SOURCE = `
    precision mediump float;

    uniform vec3 u_color;
    varying float v_opacity;

    void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        vec2 absCoord = abs(coord);

        // Convert to square with rounded corners
        float radius = 0.25; // 25% of full edge (1.0)
        float squareSize = 0.5 - radius;

        // Distance to rounded corner
        vec2 cornerDist = max(absCoord - squareSize, 0.0);
        float dist = length(cornerDist);

        // Use smoothstep for anti-aliasing to reduce subpixel artifacts
        float alpha = 1.0 - smoothstep(radius - 0.05, radius + 0.05, dist);

        if (alpha <= 0.0) {
            discard;
        }

        gl_FragColor = vec4(u_color * v_opacity * alpha, v_opacity * alpha);
    }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | undefined {
  const shader = gl.createShader(type);
  if (!shader) return undefined;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return undefined;
  }

  return shader;
}

function createProgram(gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader): WebGLProgram | undefined {
  const program = gl.createProgram();
  if (!program) return undefined;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return undefined;
  }

  return program;
}

let rotationsCache: Float32Array | undefined;

function getRotations(): Float32Array {
  if (!rotationsCache) {
    const ROTATION_COUNT = 18; // n = [0..17]
    const ROTATION_ANGLE_DEGREES = 220;

    rotationsCache = new Float32Array(ROTATION_COUNT * 4); // mat2 = 4 floats

    for (let i = 0; i < ROTATION_COUNT; i++) {
      const angle = (ROTATION_ANGLE_DEGREES * Math.PI / 180) * i;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      // mat2 in column-major order: [cos, sin, -sin, cos]
      rotationsCache[i * 4] = cos;
      rotationsCache[i * 4 + 1] = sin;
      rotationsCache[i * 4 + 2] = -sin;
      rotationsCache[i * 4 + 3] = cos;
    }
  }

  return rotationsCache;
}
