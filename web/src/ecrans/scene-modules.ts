/**
 * S02 : page des modules en scène 3D (DESIGN § 2.7 ter, demande du porteur du 13/11/2026).
 * Un seul programme WebGL 2, sans bibliothèque : la scène est calculée pixel par pixel (champs de distance).
 * Étoile du drapeau en or sur un podium à anneaux lumineux, sol miroir, faisceau de lumière, bokeh, huit socles en orbite
 * dans l'ordre de la capture p. 6 (Grh au fond, puis dans le sens des aiguilles d'une montre vu d'en haut).
 * Les liens restent des éléments HTML posés par-dessus (clavier, lecteur d'écran) : la scène donne leur position à chaque image.
 */

export type Ancre = { x: number; y: number; echelle: number };
export type Scene = {
  survoler(i: number | null): void;   // -1 : l'étoile ; 0 à 7 : un socle
  plonger(i: number): Promise<void>;
  detruire(): void;
};
type Options = {
  actifs: boolean[];                  // huit socles : ouvert ou non
  entree: boolean;                    // travelling d'entrée (première visite de la session)
  reduit: boolean;                    // mouvement réduit demandé par le système
  placer(etoile: Ancre, socles: Ancre[]): void;
};

const RAYON_ORBITE = 4.4;
const CIBLE: V = [0, .35, .7];
const FOCALE = 1.3;

// ---------- petite algèbre ----------
type V = [number, number, number];
const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V): V => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const mixV = (a: V, b: V, t: number): V => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const sortie = (t: number) => 1 - Math.pow(1 - t, 3);                       // ease-out cubique, entrée
const entreeSortie = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);   // plongée

export const positionSocle = (i: number): V => { const a = i * Math.PI / 4; return [Math.sin(a) * RAYON_ORBITE, 0, -Math.cos(a) * RAYON_ORBITE]; };

/** Couleur d'un jeton CSS (#RRGGBB) en linéaire */
function jeton(nom: string, secours: V): V {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(v);
  if (!m) return secours;
  const n = parseInt(m[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2)) as V;
}

const SOMMETS = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0., 1.); }`;

const FRAGMENTS = `#version 300 es
precision highp float;
out vec4 sortie;
uniform vec2 uRes; uniform float uTemps, uEntree, uPlonge;
uniform vec3 uOeil, uCible;
uniform float uActif[8]; uniform float uSurvol;
uniform vec3 cBleu, cOr, cNuit, cRouge;

const float PI = 3.14159265;
const float R_ORB = ${RAYON_ORBITE.toFixed(2)};

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// Étoile à cinq branches (Inigo Quilez), extrudée et arrondie
float etoile2(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292); const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x); p -= 2.0 * max(dot(k1, p), 0.0) * k1; p -= 2.0 * max(dot(k2, p), 0.0) * k2; p.x = abs(p.x); p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0, 1); float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}
float cylindre(vec3 p, float r, float h) { vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h); return min(max(d.x, d.y), 0.) + length(max(d, 0.)); }
float tore(vec3 p, float R, float r) { return length(vec2(length(p.xz) - R, p.y)) - r; }

float hauteurEtoile() { return mix(0.55, 1.75, smoothstep(0.05, 0.75, uEntree)) + 0.08 * sin(uTemps * 1.1); }
vec3 dansEtoile(vec3 p) {
  p.y -= hauteurEtoile();
  p.yz *= rot(0.62);
  p.xz *= rot(0.5 * sin(uTemps * 0.45) + (1. - uEntree) * 3.);
  p.xy *= rot(0.08 * sin(uTemps * 0.7));
  return p;
}
float distEtoile(vec3 p) {
  vec3 q = dansEtoile(p) / 1.0;
  float d2 = etoile2(q.xy, 0.86, 0.46) - 0.05;
  vec2 w = vec2(d2, abs(q.z) - 0.13);
  return (min(max(w.x, w.y), 0.) + length(max(w, 0.))) - 0.09;
}
int secteur(vec3 p) { float a = atan(p.x, -p.z); return int(mod(floor(a / (PI / 4.) + 0.5), 8.)); }
vec3 centreSocle(int i) { float a = float(i) * PI / 4.; return vec3(sin(a) * R_ORB, 0., -cos(a) * R_ORB); }
float allumage(int i) { return smoothstep(0.35 + 0.06 * float(i), 0.6 + 0.06 * float(i), uEntree); }
float hauteurOrbe(int i) { return 0.78 + 0.07 * sin(uTemps * 1.3 + float(i) * 0.9); }

// Scène : x = distance, y = matière (1 sol, 2 podium, 3 or, 4 socle, 5 orbe ouvert, 6 orbe fermé)
vec2 scene(vec3 p, out float gOr, out float gBleu) {
  vec2 r = vec2(p.y, 1.);
  float pod = min(cylindre(p - vec3(0, .13, 0), 1.85, .13), cylindre(p - vec3(0, .33, 0), 1.45, .08) - .02);
  if (pod < r.x) r = vec2(pod, 2.);
  float e = distEtoile(p);
  if (e < r.x) r = vec2(e, 3.);
  int i = secteur(p); vec3 c = centreSocle(i);
  float s = cylindre(p - c - vec3(0, .05, 0), .62, .05) - .01;
  if (s < r.x) r = vec2(s, 4.);
  float o = length(p - c - vec3(0, hauteurOrbe(i), 0)) - .3;
  if (o < r.x) r = vec2(o, uActif[i] > .5 ? 5. : 6.);
  // anneaux lumineux : or en haut du podium, bleu au pied et autour des socles
  gOr = tore(p - vec3(0, .42, 0), 1.45, .012);
  float survol = abs(uSurvol - float(i)) < .5 ? -.03 : 0.;
  gBleu = min(tore(p - vec3(0, .27, 0), 1.85, .012), tore(p - c - vec3(0, .11, 0), .64, .012) + (1. - allumage(i)) * 2. + (uActif[i] > .5 ? survol : .06));
  if (uActif[i] > .5) gBleu = min(gBleu, o + .1 + (1. - allumage(i)) * 2. + survol * 2.);
  return r;
}
vec2 carte(vec3 p) { float a, b; return scene(p, a, b); }
vec3 normale(vec3 p) {
  const vec2 k = vec2(1, -1) * .0015;
  return normalize(k.xyy * carte(p + k.xyy).x + k.yyx * carte(p + k.yyx).x + k.yxy * carte(p + k.yxy).x + k.xxx * carte(p + k.xxx).x);
}

// Ciel : nuit, horizon bleu, lumière principale chaude, traînée du drapeau (rouge bordé de jaune) en diagonale
vec3 ciel(vec3 rd) {
  float h = rd.y;
  vec3 col = mix(cBleu * .08 + cNuit, cNuit * .5, smoothstep(-.05, .5, h));
  col += cBleu * .18 * exp(-abs(h) * 14.);
  col += vec3(1., .85, .6) * pow(max(dot(rd, normalize(vec3(-.4, .6, -.7))), 0.), 40.) * .8;
  return col;
}

vec3 studio(vec3 r) {
  vec3 c = ciel(r) * .6;
  c += vec3(1.) * 2.2 * smoothstep(.75, .95, dot(r, normalize(vec3(-.3, 1., .35))));
  c += vec3(1., .9, .75) * 1.2 * smoothstep(.8, .97, dot(r, normalize(vec3(1., .25, .4))));
  c += cBleu * 1.4 * smoothstep(.6, .95, dot(r, normalize(vec3(-1., .1, -.3))));
  return c;
}
vec3 matiere(float id, vec3 p, vec3 rd, vec3 n) {
  vec3 l = normalize(vec3(-.5, .9, .4)), l2 = normalize(vec3(.7, .3, -.6));
  vec3 rf = reflect(rd, n); float fres = pow(1. - max(dot(n, -rd), 0.), 5.);
  float dif = max(dot(n, l), 0.), spec = pow(max(dot(rf, l), 0.), 60.), spec2 = pow(max(dot(rf, l2), 0.), 24.);
  if (id > 2.5 && id < 3.5) {          // or poli
    vec3 f0 = mix(cOr, vec3(1., .5, .12), .3);
    vec3 env = ciel(rf) * .4 + vec3(1., .95, .85) * 2.2 * smoothstep(.86, .99, dot(rf, normalize(vec3(-.35, 1., .45))))
             + vec3(1., .85, .6) * 1.6 * smoothstep(.82, .98, dot(rf, normalize(vec3(1., .2, .5))))
             + vec3(1., .8, .55) * .9 * smoothstep(.7, .95, dot(rf, normalize(vec3(-1., .35, .2)))) + vec3(.6, .42, .22) * .3 * max(rf.y, 0.);
    return f0 * (env * 1.6 + .03) + vec3(1., .9, .7) * fres * env * .6 + f0 * spec * 6. + cOr * .03;
  }
  if (id > 4.5 && id < 5.5) {          // orbe ouvert : verre bleu lumineux
    bool survol = abs(uSurvol - float(secteur(p))) < .5;
    return cBleu * (.35 + dif * .35) + studio(rf) * (.15 + fres) + vec3(1) * spec * 2. + cBleu * (survol ? 1.4 : .35);
  }
  if (id > 5.5) return cNuit * 2.5 + cBleu * .03 * dif + studio(rf) * (.06 + fres * .5) + vec3(1) * spec * .5;   // orbe fermé : verre fumé
  vec3 base = id < 2.5 ? cNuit * 1.4 + cBleu * .05 : cNuit * 1.8;               // podium et socles : pierre sombre polie
  return base * (.3 + dif) + ciel(rf) * (.15 + fres * .6) + vec3(1) * spec * .8 + cBleu * spec2 * .4;
}

void marcher(vec3 ro, vec3 rd, int pas, out float t, out float id, out vec3 lueur) {
  t = .02; id = 0.; lueur = vec3(0);
  for (int k = 0; k < 110; k++) {
    if (k >= pas) break;
    vec3 p = ro + rd * t; float gO, gB; vec2 h = scene(p, gO, gB);
    lueur += cOr * exp(-gO * 70.) * .09 + cBleu * exp(-gB * 55.) * .1;
    if (h.x < .001 * t) { id = h.y; return; }
    t += h.x * .9;
    if (t > 40.) break;
  }
  id = 0.;
}

// Faisceau : cône de lumière au-dessus de l'étoile
vec3 faisceau(vec3 ro, vec3 rd, float tMax) {
  vec3 s = vec3(0); float pas = min(tMax, 22.) / 20.;
  for (int k = 0; k < 20; k++) {
    float t = (float(k) + hash(gl_FragCoord.xy + float(k))) * pas; vec3 q = ro + rd * t;
    if (q.y < 0. || q.y > 8.) continue;
    float rayon = mix(1.9, .25, q.y / 8.);
    s += smoothstep(rayon, rayon * .2, length(q.xz)) * (1. - q.y / 8.);
  }
  return mix(cBleu * 2., vec3(1., .85, .55), .55) * s * pas * .022 * uEntree;
}

// Bokeh : disques flous à trois profondeurs, dérivent lentement
vec3 bokeh(vec2 uv) {
  vec3 s = vec3(0);
  for (int c = 0; c < 3; c++) {
    float f = float(c); vec2 q = uv * (3. + f * 2.5) + vec2(uTemps * (.02 + f * .015), -uTemps * .01) + uOeil.xz * (.05 + f * .05);
    vec2 cell = floor(q), loc = fract(q) - .5; float h = hash(cell + f * 17.);
    if (h > .22) continue;
    vec2 o = vec2(hash(cell + 3.1), hash(cell + 7.7)) - .5;
    float r = .08 + .14 * hash(cell + 1.3), d = length(loc - o * .5);
    float disque = smoothstep(r, r * (.55 - f * .1), d) * (.35 + .65 * smoothstep(r, r * .85, d));
    vec3 col = hash(cell + 9.2) > .7 ? cOr : cBleu * 1.6;
    s += col * disque * (.035 + .03 * f) * (.6 + .4 * sin(uTemps * (.5 + h * 2.) + h * 40.));
  }
  return s;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - .5 * uRes) / uRes.y;
  vec3 fw = normalize(uCible - uOeil), rt = normalize(cross(fw, vec3(0, 1, 0))), up = cross(rt, fw);
  vec3 rd = normalize(uv.x * rt + uv.y * up + ${FOCALE.toFixed(2)} * fw);
  float t, id; vec3 lueur; marcher(uOeil, rd, 100, t, id, lueur);
  vec3 col;
  if (id < .5) col = ciel(rd);
  else {
    vec3 p = uOeil + rd * t, n = normale(p);
    if (id < 1.5) {                    // sol miroir : reflet de la scène, atténué avec la distance
      vec3 rr = reflect(rd, n); float t2, id2; vec3 l2; marcher(p + n * .01, rr, 60, t2, id2, l2);
      vec3 refl = id2 < .5 ? ciel(rr) : matiere(id2, p + rr * t2, rr, normale(p + rr * t2));
      float f = .12 + .4 * pow(1. - max(dot(n, -rd), 0.), 4.);
      col = cNuit * .5 + (refl + l2) * f * exp(-t * .04);
      float r = length(p.xz), a = atan(p.x, -p.z);
      col += cBleu * .05 * exp(-r * .3);
      col += vec3(1., .8, .45) * .12 * exp(-r * r * .35) * uEntree;                                   // flaque chaude sous le podium
      float orbite = exp(-pow((r - R_ORB) * 28., 2.)) * (.45 + .55 * smoothstep(.2, .9, sin(a * 24. - uTemps * 1.6)));
      col += cBleu * 1.1 * orbite * smoothstep(.3, .8, uEntree);
      for (int k = 0; k < 3; k++) { float rk = 2.5 + float(k) * 3.4; col += cBleu * .35 * exp(-pow((r - rk) * 40., 2.)) * exp(-r * .12) * smoothstep(.1 * float(k), .6 + .1 * float(k), uEntree); }
      int j = secteur(p); vec3 cj = centreSocle(j);
      if (uActif[j] > .5) col += cBleu * .45 * exp(-dot(p.xz - cj.xz, p.xz - cj.xz) * 1.6) * allumage(j);
    } else col = matiere(id, p, rd, n);
    col = mix(col, ciel(rd) * .6, 1. - exp(-t * t * .0012));
  }
  col += lueur * (.4 + .6 * uEntree);
  col += faisceau(uOeil, rd, id < .5 ? 40. : t);
  col += bokeh(uv);
  // étalonnage : tons cinéma (ACES), vignette, grain
  col = (col * (2.51 * col + .03)) / (col * (2.43 * col + .59) + .14);
  col *= 1. - .35 * dot(uv * .9, uv * .9);
  col = pow(clamp(col, 0., 1.), vec3(1. / 2.2));
  col += (hash(gl_FragCoord.xy + fract(uTemps)) - .5) * .012;
  col = mix(col, vec3(0), uPlonge * uPlonge * .2);
  sortie = vec4(col * smoothstep(0., .25, uEntree + .05), 1.);
}`;

export function monterScene(toile: HTMLCanvasElement, o: Options): Scene | null {
  const gl = toile.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "high-performance" });
  if (!gl) return null;
  const shader = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
  const vs = shader(gl.VERTEX_SHADER, SOMMETS), fs = shader(gl.FRAGMENT_SHADER, FRAGMENTS);
  if (!vs || !fs) return null;
  const prog = gl.createProgram()!; gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  gl.useProgram(prog);
  const tampon = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, tampon);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = { res: u("uRes"), temps: u("uTemps"), entree: u("uEntree"), plonge: u("uPlonge"), oeil: u("uOeil"), cible: u("uCible"), actif: u("uActif"), survol: u("uSurvol"),
    bleu: u("cBleu"), or: u("cOr"), nuit: u("cNuit"), rouge: u("cRouge") };
  gl.uniform3fv(U.bleu, jeton("--tampon", [.008, .085, .63]));
  gl.uniform3fv(U.or, jeton("--etoile", [.93, .66, .008]));
  gl.uniform3fv(U.nuit, jeton("--nuit", [.0033, .0075, .019]));
  gl.uniform3fv(U.rouge, jeton("--alerte", [.55, .025, .012]));
  gl.uniform1fv(U.actif, o.actifs.map((a) => (a ? 1 : 0)));
  gl.uniform1f(U.survol, -9);

  let echelle = Math.min(devicePixelRatio || 1, 1.5) * 0.7, image = 0, arret = false, survol = -9;
  const debut = performance.now(), duree = o.entree && !o.reduit ? 2600 : 0;
  const souris = { x: 0, y: 0, cx: 0, cy: 0 };
  let plonge: { cible: V; t0: number; fin: () => void } | null = null;
  const temps: number[] = [];

  const dimensionner = () => {
    const w = toile.clientWidth, h = toile.clientHeight;
    toile.width = Math.max(1, Math.round(w * echelle)); toile.height = Math.max(1, Math.round(h * echelle));
    gl.viewport(0, 0, toile.width, toile.height);
  };
  dimensionner();
  const obs = new ResizeObserver(dimensionner); obs.observe(toile);

  /** Œil de la caméra : travelling d'entrée, parallaxe, recul sur écran étroit, plongée */
  const camera = (e: number, maintenant: number): { oeil: V; cible: V; p: number } => {
    const portrait = Math.max(1, 1.25 * toile.clientHeight / Math.max(1, toile.clientWidth));
    const dist = mix(19, 11.4, e) * Math.pow(portrait, .62), haut = mix(5, 9.6, e) * Math.pow(portrait, 1.05);
    const lacet = souris.cx * .16 + (1 - e) * -.6, tangage = souris.cy * .06;
    let oeil: V = [Math.sin(lacet) * dist, haut + tangage * dist, Math.cos(lacet) * dist];
    let cible: V = [...CIBLE] as V, p = 0;
    if (plonge) {
      p = Math.min(1, (maintenant - plonge.t0) / 750); const k = entreeSortie(p);
      oeil = mixV(oeil, [plonge.cible[0] * 1.02, plonge.cible[1] + .9, plonge.cible[2] * 1.02 + 1.1], k);
      cible = mixV(cible, plonge.cible, Math.min(1, k * 1.6));
    }
    return { oeil, cible, p };
  };
  const projeter = (P: V, oeil: V, cible: V): Ancre => {
    const fw = norm(sub(cible, oeil)), rt = norm(cross(fw, [0, 1, 0])), up = cross(rt, fw), v = sub(P, oeil), z = Math.max(.01, dot(v, fw));
    const H = toile.clientHeight, W = toile.clientWidth;
    return { x: W / 2 + dot(v, rt) / z * FOCALE * H, y: H / 2 - dot(v, up) / z * FOCALE * H, echelle: FOCALE * H / z / 100 };
  };

  const dessiner = (maintenant: number) => {
    image = 0;
    if (arret) return;
    const t0 = performance.now();
    const ecoule = maintenant - debut, e = duree ? sortie(Math.min(1, ecoule / duree)) : 1;
    souris.cx += (souris.x - souris.cx) * .06; souris.cy += (souris.y - souris.cy) * .06;
    const { oeil, cible, p } = camera(e, maintenant);
    gl.uniform2f(U.res, toile.width, toile.height);
    gl.uniform1f(U.temps, o.reduit ? 4 : ecoule / 1000);
    gl.uniform1f(U.entree, e); gl.uniform1f(U.plonge, p);
    gl.uniform3fv(U.oeil, oeil); gl.uniform3fv(U.cible, cible);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    const hauteur = mix(.55, 1.75, Math.min(1, Math.max(0, (e - .05) / .7))) + .08 * Math.sin((o.reduit ? 4 : ecoule / 1000) * 1.1);
    o.placer(projeter([0, hauteur, 0], oeil, cible), Array.from({ length: 8 }, (_, i) => { const c = positionSocle(i); return projeter([c[0], .78, c[2]], oeil, cible); }));
    if (plonge && p >= 1) { const f = plonge.fin; plonge = null; f(); return; }
    // Résolution adaptative : si l'image dépasse 24 ms en moyenne, on réduit la résolution de rendu
    temps.push(performance.now() - t0);
    if (temps.length === 20) { const m = temps.reduce((a, b) => a + b, 0) / 20; temps.length = 0; if (m > 24 && echelle > .35) { echelle *= .8; dimensionner(); } }
    if (!o.reduit || plonge || ecoule < 50) image = requestAnimationFrame(dessiner);
  };
  image = requestAnimationFrame(dessiner);
  const relancer = () => { if (!image && !arret) image = requestAnimationFrame(dessiner); };

  const viser = (x: number, y: number) => { souris.x = Math.max(-1, Math.min(1, x)); souris.y = Math.max(-1, Math.min(1, y)); if (o.reduit) { souris.cx = souris.x * 0; } };
  const pointeur = (ev: PointerEvent) => { if (ev.pointerType === "mouse" && !o.reduit) viser(ev.clientX / innerWidth * 2 - 1, ev.clientY / innerHeight * 2 - 1); };
  const inclinaison = (ev: DeviceOrientationEvent) => { if (!o.reduit && ev.gamma != null && ev.beta != null) viser(ev.gamma / 25, (ev.beta - 40) / 25); };
  const visible = () => { if (document.hidden) { cancelAnimationFrame(image); image = 0; } else relancer(); };
  addEventListener("pointermove", pointeur, { passive: true });
  addEventListener("deviceorientation", inclinaison);
  document.addEventListener("visibilitychange", visible);

  return {
    survoler(i) { survol = i ?? -9; gl.uniform1f(U.survol, survol); relancer(); },
    plonger(i) {
      return new Promise((fin) => {
        const c = i < 0 ? [0, 1.75, 0] as V : (() => { const s = positionSocle(i); return [s[0], .78, s[2]] as V; })();
        plonge = { cible: c, t0: performance.now(), fin: () => fin() }; relancer();
      });
    },
    detruire() {
      arret = true; cancelAnimationFrame(image); obs.disconnect();
      removeEventListener("pointermove", pointeur); removeEventListener("deviceorientation", inclinaison); document.removeEventListener("visibilitychange", visible);
      gl.deleteProgram(prog); gl.deleteBuffer(tampon);
    },
  };
}
