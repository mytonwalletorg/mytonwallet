// Replaces diamondFragment's main. Distances are in points, y down, relative to the canvas center.
#define LENS_PI 3.14159265
#define LENS_MAX_EDGES 64
uniform vec4 lensRect;       // source rect
uniform vec4 lensViewport;   // pixel center, pixels per point, edge count
uniform vec4 lensParameters; // strength, yaw, radius
uniform vec4 lensCenter;     // lens center
uniform vec4 lensEdges[LENS_MAX_EDGES];
uniform sampler2D lensSource;

out vec4 fragColor;

void main(){
    Raster inputData;
    inputData.localPosition=v_localPosition;
    inputData.normal=v_normal;
    inputData.worldPosition=v_worldPosition;
    inputData.facetWeights=v_facetWeights;
    vec4 stone = diamondSurface(inputData, u);

    vec2 position = vec2(gl_FragCoord.x - lensViewport.x, lensViewport.y - gl_FragCoord.y) / lensViewport.z;
    float distanceToEdge = 1e9;
    int edgeCount = int(lensViewport.w);
    for (int i = 0; i < LENS_MAX_EDGES; ++i) {
        if (i >= edgeCount) break;
        distanceToEdge = min(distanceToEdge, dot(lensEdges[i].xy, position) + lensEdges[i].z);
    }
    if (distanceToEdge <= 0.0) { fragColor = stone; return; }

    float strength = lensParameters.x;
    float edge = smoothstep(0.0, 5.0, distanceToEdge) * strength;
    float radius = max(lensParameters.z, 1.0);
    vec2 local = position - lensCenter.xy;
    vec2 q = local / radius;
    float facet = (asin(clamp(q.x, -0.999, 0.999)) - lensParameters.y) / (LENS_PI / 4.0);
    float wave = sin(LENS_PI * facet);
    float prism = sign(wave) * pow(abs(wave), 0.6);
    float crown = 1.0 - smoothstep(-0.25, 0.05, q.y);
    vec2 bend = vec2(prism * 0.12, mix(-0.08 * q.y, 0.09, crown)) * radius;
    float zoom = mix(0.84, 0.72, crown * (1.0 - smoothstep(0.2, 0.6, abs(q.x))));
    vec2 samplePosition = lensCenter.xy + local * mix(1.0, zoom, edge) + bend * edge;
    vec2 sourcePosition = (samplePosition - lensRect.xy) / lensRect.zw;
    if (any(lessThan(sourcePosition, vec2(0.0))) || any(greaterThan(sourcePosition, vec2(1.0)))) {
        fragColor = stone;
        return;
    }

    vec2 halfTexel = 0.5 / vec2(textureSize(lensSource, 0));
    vec4 sampledColor = texture(lensSource, clamp(sourcePosition, halfTexel, 1.0 - halfTexel));
    // The model is pitch * yaw, so its up axis measures vertical tilt independently of yaw.
    float verticalTilt = asin(clamp(abs(u.model[1].z), 0.0, 1.0));
    float lensVisibility = 1.0 - smoothstep(20.0 * LENS_PI / 180.0, LENS_PI / 4.0, verticalTilt);
    float opacity = 0.7 * strength * smoothstep(0.0, 1.5, distanceToEdge) * lensVisibility;
    stone.rgb = stone.rgb * (1.0 - sampledColor.a * opacity) + sampledColor.rgb * stone.a * opacity;
    fragColor = stone;
}
