// GPU renderer for celestial bodies. One small offscreen WebGL canvas renders each
// sun / planet as a true rotating sphere, then the 2D scene composites the result.
//  - Suns: continuously boiling, domain-warped plasma with granulation + limb darkening.
//  - Planets: procedural surfaces spinning on their axis, lit by their star
//    (sun-facing hemisphere bright, soft terminator, night side in shadow).

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main(){ vUv = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime, uRot, uKind, uSeed, uBands, uPx;
uniform vec3 uC0, uC1, uC2, uC3, uLight, uLightCol;

// Simplex 3D noise — Ashima Arts / Stefan Gustavson (MIT)
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z); vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x; p1*=norm.y; p2*=norm.z; p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*snoise(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=0.5; } return v; }

void main(){
  vec2 p = vUv;
  float d = length(p);
  float edge = 1.0 - smoothstep(1.0 - 2.0*uPx, 1.0, d);
  if (d > 1.0) { gl_FragColor = vec4(0.0); return; }
  float z = sqrt(max(0.0, 1.0 - d*d));
  vec3 n = vec3(p, z);
  float c = cos(uRot), s = sin(uRot);
  vec3 q = vec3(c*n.x + s*n.z, n.y, -s*n.x + c*n.z); // spin about the vertical axis

  if (uKind < 0.5) {
    // ---- STAR: the original boiling lava surface, turning as one solid sphere (q = rigid spin from uRot)
    float t = 0.0;   // the sun keeps its colours: its surface pattern does not move
    vec3 w = q * 1.15 + vec3(uSeed);
    vec3 warp = vec3(fbm(w + vec3(0.0, 0.0, t)),
                     fbm(w + vec3(5.2, 1.3, -t)),
                     fbm(w + vec3(2.1, 7.7, t * 0.7)));
    float f = fbm(w * 1.2 + warp * 1.7 + vec3(0.0, 0.0, t * 1.6));
    float cells = snoise(q * 9.0 + warp * 0.8) * 0.5 + 0.5;  // granulation
    float flare = pow(max(0.0, snoise(q * 4.0 + warp * 1.5)), 3.0);
    float h = clamp(f * 0.95 + 0.55 + (cells - 0.5) * 0.12 + flare * 0.45, 0.0, 1.0);
    vec3 col = mix(uC0, uC1, smoothstep(0.05, 0.45, h));
    col = mix(col, uC2, smoothstep(0.42, 0.72, h));
    col = mix(col, uC3, smoothstep(0.7, 1.0, h));
    col *= mix(0.5, 1.18, pow(z, 0.5));          // limb darkening
    col += uC2 * pow(1.0 - z, 4.0) * 0.55;       // chromosphere rim
    gl_FragColor = vec4(col * edge, edge);
  } else {
    // ---- PLANET: rotating surface lit by its star ----
    vec3 w = q * 2.0 + vec3(uSeed);
    float f = fbm(w * 1.4);
    float h;
    if (uBands > 0.5) { // gas giant: turbulent latitude bands
      h = 0.5 + 0.5 * sin(q.y * uBands * 3.2 + fbm(w * 1.2 + vec3(0.0, 0.0, uTime * 0.02)) * 2.4);
      h = mix(h, f * 0.5 + 0.5, 0.25);
    } else {            // rocky: continents / craters
      h = smoothstep(-0.25, 0.45, f);
      h += 0.12 * snoise(w * 6.0);
    }
    vec3 albedo = mix(uC0, uC1, clamp(h, 0.0, 1.0));
    albedo = mix(albedo, uC2, smoothstep(0.78, 1.05, h));
    vec3 emissive = vec3(0.0);
    if (uKind > 1.5) {
      // MOLTEN world: cracked basalt crust over glowing lava rivers (self-lit, slowly flowing)
      float crack = 1.0 - abs(snoise(w * 2.6 + vec3(0.0, uTime * 0.05, 0.0)));
      float veins = pow(crack, 9.0) + 0.6 * pow(1.0 - abs(snoise(w * 5.5 - vec3(uTime * 0.04))), 14.0);
      float pools = smoothstep(0.35, 0.75, fbm(w * 0.9 + vec3(uTime * 0.02)));
      float heat = clamp(veins + pools * 0.55, 0.0, 1.0);
      vec3 lava = mix(vec3(0.75, 0.12, 0.02), vec3(1.0, 0.62, 0.15), heat);
      lava = mix(lava, vec3(1.0, 0.93, 0.7), smoothstep(0.85, 1.0, heat));
      albedo = mix(vec3(0.09, 0.07, 0.065), vec3(0.2, 0.16, 0.14), f * 0.5 + 0.5);
      emissive = lava * heat * 1.25;
    }

    vec3 L = normalize(uLight);
    float ndl = dot(n, L);
    float diff = smoothstep(-0.08, 0.55, ndl);            // soft terminator
    vec3 tint = mix(vec3(1.0), uLightCol, 0.8); // starlight colour physically tints the surface
    vec3 col = albedo * (0.14 + diff * 1.4) * tint;      // night side: faint ambient / starlight
    vec3 hv = normalize(L + vec3(0.0, 0.0, 1.0));
    col += uLightCol * pow(max(dot(n, hv), 0.0), 28.0) * 0.35 * diff;   // specular glint
    col += uLightCol * pow(1.0 - z, 2.2) * smoothstep(-0.2, 0.6, ndl) * 0.85; // lit atmosphere rim
    // backlit forward-scatter halo when the star is behind the planet
    col += uLightCol * pow(1.0 - z, 1.6) * max(-L.z, 0.0) * 1.1;
    col += emissive;
    gl_FragColor = vec4(col * edge, edge);
  }
}`;

// A keyed body's surface is re-rendered this often (seconds). At 12 a second the turn and the moving light still
// look continuous, and the shader runs a fraction as often as once per frame.
const REFRESH_S = 1 / 12;

export class BodyRenderer {
  constructor() {
    this.size = 512;
    this.cache = new Map();   // key -> {cv, at, px}: last rendered frame of a body
    const cv = document.createElement('canvas');
    cv.width = cv.height = this.size;
    const gl = cv.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) { this.ok = false; return; }
    this.canvas = cv;
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    try {
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
      gl.useProgram(prog);
      this.prog = prog;
    } catch (e) {
      console.warn('Orbit: WebGL body shader unavailable, using 2D fallback', e);
      this.ok = false; return;
    }
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    this.u = {};
    for (const n of ['uTime', 'uRot', 'uKind', 'uSeed', 'uBands', 'uPx', 'uC0', 'uC1', 'uC2', 'uC3', 'uLight', 'uLightCol'])
      this.u[n] = gl.getUniformLocation(this.prog, n);
    this.ok = true;
  }

  // Render one body and composite it onto ctx at (cx, cy, radius). A body with a key keeps its last frame and
  // re-renders it at most every REFRESH_S seconds, or at once when its size changes. Shading, spin and the
  // light direction are all recomputed at each re-render, so the planet still turns and its night side moves.
  draw(ctx, cx, cy, radius, dpr, o) {
    const px = Math.max(8, Math.min(this.size, Math.ceil(radius * 2 * dpr)));
    if (o.key == null) {
      this.renderInto(px, o);
      ctx.drawImage(this.canvas, 0, this.size - px, px, px, cx - radius, cy - radius, radius * 2, radius * 2);
      return;
    }
    let slot = this.cache.get(o.key);
    if (!slot) {
      slot = {cv: document.createElement('canvas'), at: -Infinity, px: 0};
      this.cache.set(o.key, slot);
    }
    if (o.time - slot.at >= REFRESH_S || slot.px !== px) {
      this.renderInto(px, o);
      if (slot.px !== px) { slot.cv.width = slot.cv.height = px; }
      slot.cv.getContext('2d').clearRect(0, 0, px, px);
      // GL origin is bottom-left: the rendered square sits at the bottom of the GL canvas
      slot.cv.getContext('2d').drawImage(this.canvas, 0, this.size - px, px, px, 0, 0, px, px);
      slot.at = o.time; slot.px = px;
    }
    ctx.drawImage(slot.cv, cx - radius, cy - radius, radius * 2, radius * 2);
  }

  // Draws the body with the shader into the GL canvas, in a px-by-px square at its bottom.
  renderInto(px, o) {
    const { gl, u } = this;
    gl.viewport(0, 0, px, px);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.uTime, o.time);
    gl.uniform1f(u.uRot, o.rot);
    gl.uniform1f(u.uKind, o.kind);
    gl.uniform1f(u.uSeed, o.seed);
    gl.uniform1f(u.uBands, o.bands || 0);
    gl.uniform1f(u.uPx, 1 / px);
    gl.uniform3fv(u.uC0, o.c0); gl.uniform3fv(u.uC1, o.c1);
    gl.uniform3fv(u.uC2, o.c2); gl.uniform3fv(u.uC3, o.c3 || o.c2);
    gl.uniform3fv(u.uLight, o.light || [0, 0, 1]);
    gl.uniform3fv(u.uLightCol, o.lightCol || [1, 1, 1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
