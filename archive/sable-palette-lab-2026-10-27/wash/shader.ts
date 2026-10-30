/**
 * The Fluid wash shader (GLSL ES 1.00, so the same source runs on WebGL2 and
 * WebGL1). Written for Sable from textbook techniques — value-noise fbm and
 * Inigo Quilez's two-level domain warping over distance fields — not ported
 * from any library.
 *
 *   1. b      pixel → board units (cover-fit, like the SVG's `slice`), with a
 *             slow, centre-weighted swirl
 *   2. pw     b pushed by fbm(b + 2.2·fbm(b)), drifting — so every edge flows
 *   3. each stroke (a polyline of segments, its own slow orbit): distance d
 *      from pw to the curve → coverage = the profile of a Gaussian-blurred
 *      band of half-width h: ½·(erf((h−d)/σ√2) + erf((h+d)/σ√2))
 *   4. strokes composite in order, premultiplied "over" — exactly what the
 *      SVG renderer's stacked paths do — so both renderers share one picture
 *   5. ±1 LSB dither against banding
 */
export const MAX_SEGMENTS = 40;

export const VERTEX = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const FRAGMENT = `
precision highp float;
#define MAXS ${MAX_SEGMENTS}

uniform vec2 uRes;
uniform float uTime;
uniform vec4 uSegA[MAXS];  // x1, y1, x2, y2 (board / 1000)
uniform vec4 uSegB[MAXS];  // slot (+10 on a stroke's last segment), half-width, sigma, alpha
uniform vec4 uSegC[MAXS];  // drift radius, angular speed, phase, -
uniform int uCount;
uniform vec3 uCol0;
uniform vec3 uCol1;
uniform vec3 uCol2;
uniform float uWarp;
uniform float uGain;
uniform vec2 uSeed;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// Three octaves, rotated between octaves so the lattice never shows.
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 3; i++) {
    v += a * noise(p);
    p = m * p;
    a *= 0.5;
  }
  return v / 0.875;
}

float erfa(float x) {
  // tanh(1.2025x) ≈ erf(x) to ~0.02 — plenty for a soft edge.
  float e = exp(clamp(2.405 * x, -20.0, 20.0));
  return (e - 1.0) / (e + 1.0);
}

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
  return length(pa - ba * h);
}

void main() {
  // 1. Board space, cover-fit; y down like the SVG.
  float scale = max(uRes.x / 1.6, uRes.y);
  vec2 frag = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 b = (frag - 0.5 * uRes) / scale + vec2(0.8, 0.5);
  float t = uTime;

  vec2 c = vec2(0.8, 0.5);
  vec2 d = b - c;
  float ang = 0.09 * sin(t * 0.157 + uSeed.x) * exp(-dot(d, d) * 1.2);
  float s = sin(ang);
  float co = cos(ang);
  b = c + vec2(co * d.x - s * d.y, s * d.x + co * d.y);

  // 2. Two-level domain warp, drifting.
  vec2 sp = b * 1.6 + uSeed;
  vec2 q = vec2(
    fbm(sp + vec2(0.0, t * 0.021)),
    fbm(sp + vec2(5.2, 1.3) - vec2(t * 0.017, 0.0))
  );
  vec2 r = vec2(
    fbm(sp + 2.2 * q + vec2(1.7, 9.2) + t * 0.013),
    fbm(sp + 2.2 * q + vec2(8.3, 2.8) - t * 0.011)
  );
  vec2 pw = b + uWarp * (r - 0.5) * 2.0;

  // 3–4. Strokes, in order, composited "over".
  vec4 outc = vec4(0.0);
  float dmin = 1e6;
  for (int i = 0; i < MAXS; i++) {
    if (i >= uCount) break;
    vec4 sa = uSegA[i];
    vec4 sb = uSegB[i];
    vec4 sc = uSegC[i];
    vec2 drift = sc.x * vec2(sin(t * sc.y + sc.z), cos(t * sc.y * 0.8 + sc.z * 1.7));
    dmin = min(dmin, segDist(pw - drift, sa.xy, sa.zw));
    if (sb.x > 9.5) {
      float slot = sb.x - 10.0;
      float k = 0.70710678 / sb.z;
      float cov = 0.5 * (erfa((sb.y - dmin) * k) + erfa((sb.y + dmin) * k));
      float a = clamp(cov * sb.w * uGain, 0.0, 1.0);
      vec3 rgb = slot < 0.5 ? uCol0 : (slot < 1.5 ? uCol1 : uCol2);
      outc = vec4(rgb * a, a) + outc * (1.0 - a);
      dmin = 1e6;
    }
  }

  // 5. Dither.
  float n = (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 7.1) - 1.0) / 255.0;
  outc = clamp(outc + vec4(n, n, n, n) * step(0.002, outc.a), 0.0, 1.0);
  outc.rgb = min(outc.rgb, vec3(outc.a));
  gl_FragColor = outc;
}
`;
