// Custom GLSL shaders for a realistic day/night blended Earth with in-shader
// cloud compositing and terrain bump shading.

export const earthVertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vNormalO;

  void main() {
    vUv = uv;
    vNormalO = normal;
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - worldPosition.xyz);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const earthFragmentShader = /* glsl */ `
  uniform sampler2D dayMap;
  uniform sampler2D nightMap;
  uniform sampler2D cloudsMap;
  uniform sampler2D surfaceMap;
  uniform vec3 sunDirection;

  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vNormalO;
  varying vec3 vViewDir;

  void main() {
    vec3 normal = normalize(vNormalW);
    vec3 normalO = normalize(vNormalO);
    vec3 sunDir = normalize(sunDirection);

    vec3 dayColor = texture2D(dayMap, vUv).rgb;
    vec3 nightColor = texture2D(nightMap, vUv).rgb;
    float surfaceSample = texture2D(surfaceMap, vUv).r;
    float cloudSample = texture2D(cloudsMap, vUv).r;

    // --- Terrain bump (fake normal-based shading from the surface map) ---
    // Sample surface height at neighboring texels and build a height gradient
    // in UV space, then convert it to object space and perturb the normal.
    vec2 texel = vec2(1.0 / 4096.0, 1.0 / 2048.0);
    float hR = texture2D(surfaceMap, vUv + vec2(texel.x, 0.0)).r;
    float hL = texture2D(surfaceMap, vUv - vec2(texel.x, 0.0)).r;
    float hU = texture2D(surfaceMap, vUv + vec2(0.0, texel.y)).r;
    float hD = texture2D(surfaceMap, vUv - vec2(0.0, texel.y)).r;
    vec2 grad = vec2(hR - hL, hU - hD);

    // Build an orthonormal basis around the object-space normal.
    vec3 tangentX = normalize(cross(normalO, vec3(0.0, 1.0, 0.0)));
    vec3 tangentY = normalize(cross(tangentX, normalO));
    vec3 bumpNormalO = normalize(normalO + 0.6 * (grad.x * tangentX + grad.y * tangentY));
    vec3 bumpNormalW = normalize(vNormalW + 0.6 * normalize(bumpNormalO - normalO));

    float sunAmount = dot(bumpNormalW, sunDir);
    // Soft terminator transition between night and day
    float dayMix = smoothstep(-0.2, 0.15, sunAmount);

    // Day color: gentle brightness lift + mild contrast for crisper detail.
    // Blue channel gets a touch more lift so oceans read vibrant and clear.
    vec3 dayComposited = dayColor * vec3(1.14, 1.15, 1.20);
    dayComposited = pow(dayComposited, vec3(0.98));

    // Lighter blue & green tones — selective, detail-preserving lift.
    // Oceans shift toward a lighter azure, vegetation toward a fresher light green.
    float blueness = clamp(dayComposited.b - max(dayComposited.r, dayComposited.g), 0.0, 1.0);
    float greenness = clamp(dayComposited.g - max(dayComposited.r, dayComposited.b * 0.9), 0.0, 1.0);
    float oceanWeight = smoothstep(0.02, 0.22, blueness);
    float landGreenWeight = smoothstep(0.02, 0.20, greenness);
    dayComposited += oceanWeight * vec3(0.06, 0.12, 0.18);
    dayComposited += landGreenWeight * vec3(0.06, 0.13, 0.06);

    // Boost the night lights slightly so they read clearly but stay natural,
    // and keep a faint ambient fill so the dark side retains visible shape.
    vec3 nightLit = nightColor * vec3(1.25, 1.1, 0.85) + dayColor * 0.045;

    vec3 surface = mix(nightLit, dayComposited, dayMix);

    // Subtle ocean specular highlight on the lit side, on the original
    // geometric normal (not the bumped normal), to avoid sparkle artifacts.
    vec3 reflectDir = reflect(-sunDir, normal);
    float spec = pow(max(dot(reflectDir, vViewDir), 0.0), 32.0);
    float oceanMask = 1.0 - smoothstep(0.30, 0.50, surfaceSample);
    surface += spec * oceanMask * dayMix * 0.22;

    // Clouds: sharpen the cloud mask to avoid smeared, washed-out patches.
    // A moderate contrast curve keeps clearly defined cloud shapes while
    // preserving some soft edges.
    float cloudAlpha = smoothstep(0.08, 0.85, cloudSample);
    float cloudVisibility = mix(0.14, 0.9, dayMix);
    vec3 cloudColor = vec3(1.0) * (0.6 + 0.4 * dayMix);
    surface = mix(surface, cloudColor, cloudAlpha * cloudVisibility);

    // Very subtle atmospheric rim scattering, baked directly into the
    // surface shading (no extra glowing shell) so the silhouette stays clean.
    float fresnel = pow(1.0 - clamp(dot(normal, vViewDir), 0.0, 1.0), 4.0);
    vec3 rimTint = vec3(0.45, 0.65, 1.0);
    surface += rimTint * fresnel * (0.10 + 0.08 * dayMix);

    // Gentle terminator warmth (dawn/dusk glow along the day/night line)
    float terminatorGlow = (1.0 - abs(sunAmount)) * smoothstep(-0.35, 0.35, sunAmount);
    surface += vec3(1.0, 0.55, 0.25) * terminatorGlow * 0.10;

    gl_FragColor = vec4(surface, 1.0);
  }
`;
