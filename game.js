(function () {
'use strict';

/* ---------- utilidades ---------- */
const $ = id => document.getElementById(id);
const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; else if (d < -Math.PI) d += TAU; return d; }
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const CFG_KEY = 'mf_cfg', CFG_DEF = { vol: 55, shake: reduceMotion ? 1 : 2, zoom: 1, vib: 1, fps: 1, stick: 0 };
let cfg = Object.assign({}, CFG_DEF);
try { const c = JSON.parse(localStorage.getItem(CFG_KEY)); if (c) for (const k in CFG_DEF) if (Number.isFinite(+c[k])) cfg[k] = +c[k]; } catch (e) {}
function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }
const fmt = n => Math.round(n).toLocaleString('pt-BR');

const cv = $('sea');
const ctx = cv.getContext('2d');
let W = innerWidth, H = innerHeight, DPR = 1, zoom = 1;
let touchMode = false;
try { touchMode = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window); } catch (e) {}
document.body.classList.toggle('touch', touchMode);

function setTouchMode(v) {
  if (touchMode === v) return;
  touchMode = v;
  document.body.classList.toggle('touch', v);
}

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  zoom = clamp(Math.min(W, H) / 720 * [1.25, 1, .8][cfg.zoom], 0.45, 1.4);
}

/* ---------- constantes de jogo ---------- */
const ENEMY_HP_MUL = 1;   // multiplicador da vida de todos os inimigos (1 = vida base)
const RANGE = 540;          // alcance do canhão, em metros
const BALL_V = 640;         // velocidade da bala do jogador
const PLAYER_DMG = 20;
const RELOAD = 0.6, RELOAD_RAPID = 0.28;
const STICK_R = 58;
const KEY_BEST = 'mar-de-ferro-recorde';

const SPEC = {
  player: { len: 72, wid: 22, hp: 100, speed: 190, turn: 2.1,
    hull: '#8ea6ad', deck: '#c9d8db', dark: '#41575f', stroke: '#e0a93c', accent: '#e0a93c',
    turrets: [{ x: .2, r: 7.5, bl: 26 }], cabin: { x: -.1, l: 15, w: 11 }, funnel: { x: -.26, r: 4.2 } },
  patrol: { len: 46, wid: 15, hp: 30, speed: 150, turn: 2.8, stand: 230, fire: 2.3, dmg: 7, ball: 350, spread: .1, volley: 1, score: 100,
    hull: '#6b2c26', deck: '#93473d', dark: '#3a1814', stroke: '#3a1814', accent: '#e2552f',
    turrets: [{ x: .18, r: 4.5, bl: 15 }], cabin: { x: -.12, l: 10, w: 8 } },
  frigate: { len: 78, wid: 22, hp: 70, speed: 105, turn: 1.7, stand: 340, fire: 2.6, dmg: 11, ball: 370, spread: .07, volley: 1, score: 250,
    hull: '#5e2a2b', deck: '#85403f', dark: '#331617', stroke: '#331617', accent: '#e2552f',
    turrets: [{ x: .26, r: 6, bl: 20 }, { x: -.3, r: 5.5, bl: 18 }], cabin: { x: -.02, l: 16, w: 12 }, funnel: { x: -.14, r: 3.6 } },
  battle: { len: 124, wid: 36, hp: 170, speed: 68, turn: .95, stand: 430, fire: 3.4, dmg: 12, ball: 390, spread: .12, volley: 3, score: 600,
    hull: '#4f2429', deck: '#73363a', dark: '#2b1215', stroke: '#2b1215', accent: '#e2552f',
    turrets: [{ x: .3, r: 9, bl: 30 }, { x: .12, r: 8.5, bl: 28 }, { x: -.32, r: 9, bl: 30 }], cabin: { x: -.08, l: 22, w: 16 }, funnel: { x: -.18, r: 5 } },
  lancha: { len: 30, wid: 11, hp: 14, speed: 235, turn: 3.6, stand: 170, fire: 1.9, dmg: 5, ball: 340, spread: .14, volley: 1, score: 80,
    hull: '#7a3a22', deck: '#b0653a', dark: '#3a1d10', stroke: '#3a1d10', accent: '#f08a3c',
    turrets: [{ x: .15, r: 3.5, bl: 11 }], cabin: { x: -.15, l: 7, w: 6 } },
  blindado: { len: 88, wid: 28, hp: 135, speed: 78, turn: 1.2, stand: 330, fire: 3.0, dmg: 10, ball: 360, spread: .08, volley: 1, score: 400,
    hull: '#3b4a52', deck: '#566a74', dark: '#1d272c', stroke: '#1d272c', accent: '#e2552f',
    turrets: [{ x: .22, r: 7, bl: 22 }], cabin: { x: -.12, l: 20, w: 14 }, funnel: { x: -.28, r: 4.5 } },
  boss: { len: 172, wid: 50, hp: 900, speed: 72, turn: 1.0, stand: 500, fire: 1.9, dmg: 15, ball: 430, spread: .07, volley: 5, score: 3500,
    hull: '#2d1417', deck: '#5a2429', dark: '#160709', stroke: '#e2552f', accent: '#e2552f',
    turrets: [{ x: .34, r: 10, bl: 32 }, { x: .14, r: 9.5, bl: 30 }, { x: -.1, r: 9.5, bl: 30 }, { x: -.34, r: 10, bl: 32 }], cabin: { x: -.02, l: 30, w: 20 }, funnel: { x: -.2, r: 6 } }
};

/* ---------- navios, melhorias e save ---------- */
const SHIPS = [
  { id: 'corveta', rar: 'Comum', name: 'Sakuron', cost: 0, hp: 100, dmg: 20, rel: .6, speed: 190, spec: SPEC.player },
  { id: 'cruzador', rar: 'Comum', name: 'Bismarkov', cost: 1800, auto: true, note: 'Torre automática que atira sozinha', hp: 170, dmg: 26, rel: .55, speed: 170,
    spec: Object.assign({}, SPEC.player, { len: 92, wid: 27, turn: 1.8, hull: '#7d9ba3',
      turrets: [{ x: .28, r: 8, bl: 28 }, { x: -.28, r: 8, bl: 28 }], cabin: { x: -.02, l: 18, w: 13 }, funnel: { x: -.15, r: 4.8 } }) },
  { id: 'submarino', rar: 'Incomum', name: 'Nautilon', cost: 6000, cloak: true, note: 'Submersão: invulnerável e invisível por 9 s, sem atirar (recarga 25 s)', hp: 240, dmg: 36, rel: .55, speed: 160,
    spec: Object.assign({}, SPEC.player, { len: 104, wid: 20, turn: 1.6, hull: '#2f4a57', deck: '#4a6a78', dark: '#16262e', stroke: '#8aa3ab', accent: '#4fd1a5',
      turrets: [{ x: .14, r: 5, bl: 18 }], cabin: { x: -.04, l: 18, w: 8 }, funnel: null }) },
  { id: 'carrier', rar: 'Raro', name: 'Enterprize', cost: 15000, air: true, note: 'Convoca 5 aviões que destroem todos os navios inimigos (recarga 45 s)', hp: 320, dmg: 22, rel: .6, speed: 115,
    spec: Object.assign({}, SPEC.player, { len: 150, wid: 42, turn: 1.1, hull: '#5c7480', deck: '#aebfc4', dark: '#2a3d46', stroke: '#e0a93c', accent: '#e0a93c', carrier: true,
      turrets: [{ x: .4, r: 5, bl: 16 }, { x: -.42, r: 5, bl: 16 }], cabin: { x: -.44, l: 6, w: 6 }, funnel: null }) },
  { id: 'tridente', rar: 'Épico', name: 'Dreadshot', cost: 27000, multi: 3, note: 'Dispara 3 tiros por salva (5 com o power-up de tiro triplo)', hp: 380, dmg: 24, rel: .6, speed: 135,
    spec: Object.assign({}, SPEC.player, { len: 118, wid: 34, turn: 1.3, hull: '#4a5d7a', deck: '#7f97b8', dark: '#222e42', stroke: '#e0a93c', accent: '#e0a93c',
      turrets: [{ x: .34, r: 7, bl: 26 }, { x: .1, r: 7.5, bl: 28 }, { x: -.16, r: 7, bl: 26 }], cabin: { x: -.36, l: 16, w: 12 }, funnel: { x: -.28, r: 4.6 } }) },
  { id: 'furia', rar: 'Raro', name: 'Tirphex', cost: 24000, surge: true, note: 'Sobrecarga: fogo rápido por 10 s e escudo por 5 s (recarga 30 s)', hp: 300, dmg: 28, rel: .5, speed: 175,
    spec: Object.assign({}, SPEC.player, { len: 100, wid: 26, turn: 1.7, hull: '#7a3b2e', deck: '#c2603f', dark: '#2e1612', stroke: '#e2552f', accent: '#e2552f',
      turrets: [{ x: .32, r: 7, bl: 26 }, { x: .02, r: 7.5, bl: 28 }, { x: -.26, r: 7, bl: 26 }], cabin: { x: -.4, l: 14, w: 11 }, funnel: { x: -.32, r: 4.4 } }) },
  { id: 'espelho', rar: 'Lendário', name: 'Mirage 3', cost: 67000, clone: true, note: 'Cria clones de si mesmo (até 3) que atacam e atraem o fogo inimigo e só somem se forem destruídos. Recarga de 40 s a cada clone; com 3 clones, trava até um morrer', hp: 280, dmg: 24, rel: .58, speed: 150,
    spec: Object.assign({}, SPEC.player, { len: 96, wid: 28, turn: 1.5, hull: '#5a7f8c', deck: '#b9dde3', dark: '#1f3640', stroke: '#7fe3ff', accent: '#7fe3ff',
      turrets: [{ x: .3, r: 7, bl: 24 }, { x: -.24, r: 7, bl: 24 }], cabin: { x: -.04, l: 18, w: 13 }, funnel: { x: -.2, r: 4.6 } }) },
  { id: 'misseis', rar: 'Lendário', name: 'Stormvolt', cost: 95000, msl: true, note: 'Atira mísseis teleguiados. Poder: lança 15 mísseis em todas as direções, 1 por navio inimigo, sempre nos mais próximos (recarga 30 s)', hp: 360, dmg: 45, rel: .65, speed: 150,
    spec: Object.assign({}, SPEC.player, { len: 112, wid: 30, turn: 1.4, hull: '#3e4f5c', deck: '#8fa5ad', dark: '#1a262d', stroke: '#ff7a3d', accent: '#ff7a3d',
      turrets: [{ x: .3, r: 6, bl: 18 }, { x: .04, r: 6.5, bl: 20 }, { x: -.22, r: 6, bl: 18 }], cabin: { x: -.38, l: 14, w: 11 }, funnel: { x: -.3, r: 4.4 } }) },
  { id: 'torpedeiro', rar: 'Incomum', name: 'Barracuda', cost: 14000, tpd: true, note: 'Torpedos atravessam vários inimigos. Poder: salva de 5 torpedos em leque (recarga 20 s)', hp: 210, dmg: 24, rel: .6, speed: 185,
    spec: Object.assign({}, SPEC.player, { len: 90, wid: 20, turn: 1.9, hull: '#2f5560', deck: '#5f95a3', dark: '#14282e', stroke: '#7fe3ff', accent: '#7fe3ff',
      turrets: [{ x: .3, r: 5, bl: 16 }, { x: -.2, r: 5, bl: 16 }], cabin: { x: -.1, l: 14, w: 9 }, funnel: { x: -.3, r: 3.6 } }) },
  { id: 'leviata', rar: 'Épico', name: 'Leviatã', cost: 52000, chg: true, note: 'Navio pesado e lento. Poder: investida de 8 s, invulnerável e em alta velocidade, causando dano a quem encostar (recarga 20 s)', hp: 640, dmg: 24, rel: .7, speed: 100,
    spec: Object.assign({}, SPEC.player, { len: 140, wid: 44, turn: 1.0, hull: '#5a4a40', deck: '#a08a76', dark: '#271d18', stroke: '#e0a93c', accent: '#c97b3a',
      turrets: [{ x: .34, r: 9, bl: 30 }, { x: .04, r: 9.5, bl: 32 }, { x: -.26, r: 9, bl: 30 }], cabin: { x: -.42, l: 18, w: 14 }, funnel: { x: -.34, r: 5.4 } }) },
  { id: 'nova', rar: 'Épico', name: 'Supernova', cost: 60000, nova: true, note: 'Poder: carrega um tiro gigante (até 3 s) e o lança; quanto mais carga, mais dano e área. Atravessa tudo (recarga 25 s)', hp: 300, dmg: 26, rel: .6, speed: 150,
    spec: Object.assign({}, SPEC.player, { len: 106, wid: 28, turn: 1.5, hull: '#2a3550', deck: '#5a78c8', dark: '#111828', stroke: '#7fe3ff', accent: '#bfa4ff',
      turrets: [{ x: .3, r: 7, bl: 24 }, { x: -.22, r: 7, bl: 24 }], cabin: { x: -.04, l: 18, w: 12 }, funnel: { x: -.2, r: 4.6 } }) },
  { id: 'vingador', rar: 'Épico', name: 'Vindicta', cost: 45000, vg: true, note: 'Quanto menos casco, mais dano (até 2,5×). Poder: explosão que gasta 25% do casco e causa grande dano em área (recarga 20 s)', hp: 330, dmg: 28, rel: .6, speed: 165,
    spec: Object.assign({}, SPEC.player, { len: 108, wid: 28, turn: 1.6, hull: '#4a1f24', deck: '#8c3b42', dark: '#1c0b0e', stroke: '#ff4a4a', accent: '#ff4a4a',
      turrets: [{ x: .32, r: 7, bl: 26 }, { x: .04, r: 7.5, bl: 28 }, { x: -.24, r: 7, bl: 26 }], cabin: { x: -.38, l: 15, w: 11 }, funnel: { x: -.3, r: 4.4 } }) },
  { id: 'fenix', rar: 'Lendário', name: 'Fênix', cost: 0, dailyOnly: true, phx: true, note: 'Recompensa do dia 7 da recompensa diária (não pode ser comprado). Ao ser destruído, renasce uma vez por partida com 50% do casco e uma explosão de fogo. Poder: explosão de fogo ao redor (recarga 25 s)', hp: 340, dmg: 26, rel: .6, speed: 160,
    spec: Object.assign({}, SPEC.player, { len: 112, wid: 30, turn: 1.5, hull: '#7a3a14', deck: '#e08a2c', dark: '#2e1608', stroke: '#ffd23c', accent: '#ffd23c',
      turrets: [{ x: .32, r: 7, bl: 26 }, { x: .04, r: 7.5, bl: 28 }, { x: -.24, r: 7, bl: 26 }], cabin: { x: -.38, l: 15, w: 11 }, funnel: { x: -.3, r: 4.6 } }) }
,
  { id: 'n77', rar: 'Admin', name: 'N-77', cost: 0, adminOnly: true, adm: true, multi: 3, note: 'Exclusivo de administradores. Menu de poderes: usa o poder de qualquer navio, sem recarga e sem limite. Poderes exclusivos: Buraco negro (puxa todos os inimigos para um ponto até você desligar) e Meteoro (afunda todos os inimigos). Dispara 3 tiros por salva', hp: 1500, dmg: 45, rel: .35, speed: 210,
    spec: Object.assign({}, SPEC.player, { len: 132, wid: 30, turn: 1.7, hull: '#1b1b2a', deck: '#34344d', dark: '#0c0c16', stroke: '#b44cff', accent: '#b44cff',
      turrets: [{ x: .34, r: 7.5, bl: 28 }, { x: .08, r: 8, bl: 30 }, { x: -.2, r: 7.5, bl: 28 }], cabin: { x: -.38, l: 16, w: 12 }, funnel: null }) },
  { id: 'reaper', rar: 'Limitado', name: 'Yamaton', cost: 0, eventOnly: true, reaper: true, note: 'Barco de Evento. Ceifador: +8% de casco ao afundar um navio · Execução: +25% de dano em inimigos abaixo de 30% · Colheita Sombria: +20% de casco ao derrotar um chefe', hp: 670, dmg: 34, rel: .5, speed: 155,
    spec: Object.assign({}, SPEC.player, { len: 128, wid: 34, turn: 1.3, hull: '#1c1c26', deck: '#33333f', dark: '#0a0a10', stroke: '#c1121f', accent: '#ff2b3a',
      turrets: [{ x: .34, r: 7, bl: 26 }, { x: .08, r: 8, bl: 30 }, { x: -.2, r: 7, bl: 26 }], cabin: { x: -.38, l: 16, w: 12 }, funnel: { x: -.3, r: 4.4 } }) }
];
const PUB_N = SHIPS.filter(x => !x.adminOnly && !x.eventOnly && !x.dailyOnly).length;
const isPub = id => { const x = SHIPS.find(z => z.id === id); return !!x && !x.adminOnly && !x.eventOnly && !x.dailyOnly; };
const ESC_LIFE = 30, ESC_CD = 40, CLONE_LIFE = 1e6, CLONE_CD = 40, CLONE_MAX = 3;
function cloneCount(pid) { return G ? G.escorts.filter(z => z.clone && (z.pid || 0) === pid).length : 0; }
function myCloneCount() { return cloneCount(MP.role === 'guest' ? MP.pid : 0); }
const ESC_SPEC = Object.assign({}, SPEC.player, { len: 58, wid: 18, turn: 2.4, hull: '#3f8f78', deck: '#7fd1b4', dark: '#16362d', stroke: '#4fd1a5', accent: '#4fd1a5',
  turrets: [{ x: .2, r: 6, bl: 20 }], cabin: { x: -.1, l: 12, w: 9 }, funnel: null });
const MP = { opts: { hp: 1, max: 4, buoy: 1 }, role: null, ch: null, sb: null, code: '', guests: [], pid: -1, acked: false, ev: [], nid: 0, acc: 0, lastIn: 0, mute: 0, peerGone: false };
function evp(a) { if (MP.ev.length < 400) MP.ev.push(a); }
const mw = () => Math.max(save.maxWave || 0, G ? G.wave : 0), ms = () => Math.max(best || 0, G ? G.score : 0);
const upsMax = () => Math.max(0, ...SHIPS.map(sh => UPS.filter(u => (save.up[sh.id] || {})[u.k] >= MAXLV).length));
const TOPNOW = {};
const ACH = [
  { id: 'first', c: 'Combate', n: 'Primeiro tiro', d: 'Afunde 1 navio', r: 50, f: () => save.kills >= 1, p: () => [save.kills, 1] },
  { id: 'k100', c: 'Combate', n: 'Lobo do mar', d: 'Afunde 100 navios', r: 150, f: () => save.kills >= 100, p: () => [save.kills, 100] },
  { id: 'k500', c: 'Combate', n: 'Terror dos mares', d: 'Afunde 500 navios', r: 500, f: () => save.kills >= 500, p: () => [save.kills, 500] },
  { id: 'k1000', c: 'Combate', n: 'Almirante', d: 'Afunde 1.000 navios', r: 1000, f: () => save.kills >= 1000, p: () => [save.kills, 1000] },
  { id: 'shark1', c: 'Combate', n: 'Isca viva', d: 'Afunde 1 tubarão', r: 100, f: () => (save.sharks || 0) >= 1, p: () => [save.sharks || 0, 1] },
  { id: 'shark25', c: 'Combate', n: 'Caçador de tubarões', d: 'Afunde 25 tubarões', r: 800, f: () => (save.sharks || 0) >= 25, p: () => [save.sharks || 0, 25] },
  { id: 'boss1', c: 'Combate', n: 'Quebra-casco', d: 'Derrote um chefe', r: 200, f: () => save.bosses >= 1, p: () => [save.bosses, 1] },
  { id: 'boss5', c: 'Combate', n: 'Caçador de chefes', d: 'Derrote 5 chefes', r: 600, f: () => save.bosses >= 5, p: () => [save.bosses, 5] },
  { id: 'boss15', c: 'Combate', n: 'Pesadelo dos chefes', d: 'Derrote 15 chefes', r: 1500, f: () => save.bosses >= 15, p: () => [save.bosses, 15] },
  { id: 'w5', c: 'Progresso', n: 'Maré alta', d: 'Chegue à onda 5', r: 100, f: () => mw() >= 5, p: () => [mw(), 5] },
  { id: 'w10', c: 'Progresso', n: 'Veterano', d: 'Chegue à onda 10', r: 300, f: () => mw() >= 10, p: () => [mw(), 10] },
  { id: 'w20', c: 'Progresso', n: 'Lenda', d: 'Chegue à onda 20', r: 1000, f: () => mw() >= 20, p: () => [mw(), 20] },
  { id: 'w30', c: 'Progresso', n: 'Imortal', d: 'Chegue à onda 30', r: 2500, f: () => mw() >= 30, p: () => [mw(), 30] },
  { id: 's5k', c: 'Progresso', n: 'Cinco mil', d: '5.000 pontos numa partida', r: 200, f: () => ms() >= 5000, p: () => [ms(), 5000] },
  { id: 's15k', c: 'Progresso', n: 'Quinze mil', d: '15.000 pontos numa partida', r: 500, f: () => ms() >= 15000, p: () => [ms(), 15000] },
  { id: 's40k', c: 'Progresso', n: 'Quarenta mil', d: '40.000 pontos numa partida', r: 1500, f: () => ms() >= 40000, p: () => [ms(), 40000] },
  { id: 'fleet', c: 'Frota', n: 'Frota própria', d: 'Compre um novo navio', r: 100, f: () => save.owned.length >= 2, p: () => [save.owned.length - 1, 1] },
  { id: 'fleet3', c: 'Frota', n: 'Esquadrão', d: 'Tenha 3 navios', r: 300, f: () => save.owned.length >= 3, p: () => [save.owned.length, 3] },
  { id: 'fleetAll', c: 'Frota', n: 'Armada completa', d: 'Tenha todos os navios', r: 2000, f: () => save.owned.filter(isPub).length >= PUB_N, p: () => [save.owned.filter(isPub).length, PUB_N] },
  { id: 'yard', c: 'Frota', n: 'Estaleiro', d: 'Melhoria no nível máximo em um navio', r: 400, f: () => upsMax() >= 1, p: () => [upsMax(), 1] },
  { id: 'yardAll', c: 'Frota', n: 'Estaleiro completo', d: 'Todas as melhorias no máximo em um navio', r: 3000, f: () => upsMax() >= UPS.length, p: () => [upsMax(), UPS.length] },
  { id: 'play10h', c: 'Progresso', n: 'Marujo de verdade', d: 'Jogue por 10 horas', r: 3000, f: () => (save.play || 0) >= 36000, p: () => [Math.floor((save.play || 0) / 3600), 10] },
  { id: 'evtYamaton', c: 'Evento', n: 'Ceifador de almas', d: 'Conquiste o Yamaton no evento Colheita Sombria', r: 5000, f: () => save.owned.includes('reaper'), p: () => [save.owned.includes('reaper') ? 1 : 0, 1] },
  { id: 'topSem1', c: 'Ranking', n: 'Campeão da semana', d: 'Fique em 1º no ranking semanal', r: 2000, f: () => TOPNOW.semana <= 1 },
  { id: 'topSem2', c: 'Ranking', n: 'Vice da semana', d: 'Fique entre os 2 primeiros no ranking semanal', r: 1200, f: () => TOPNOW.semana <= 2 },
  { id: 'topSem3', c: 'Ranking', n: 'Pódio semanal', d: 'Fique entre os 3 primeiros no ranking semanal', r: 800, f: () => TOPNOW.semana <= 3 },
  { id: 'topPts1', c: 'Ranking', n: 'Rei dos pontos', d: 'Fique em 1º no ranking de pontos', r: 2000, f: () => TOPNOW.pontos <= 1 },
  { id: 'topPts2', c: 'Ranking', n: 'Vice em pontos', d: 'Fique entre os 2 primeiros no ranking de pontos', r: 1200, f: () => TOPNOW.pontos <= 2 },
  { id: 'topPts3', c: 'Ranking', n: 'Pódio de pontos', d: 'Fique entre os 3 primeiros no ranking de pontos', r: 800, f: () => TOPNOW.pontos <= 3 },
  { id: 'topKills1', c: 'Ranking', n: 'Rei dos abates', d: 'Fique em 1º no ranking de abates', r: 2000, f: () => TOPNOW.kills <= 1 },
  { id: 'topKills2', c: 'Ranking', n: 'Vice em abates', d: 'Fique entre os 2 primeiros no ranking de abates', r: 1200, f: () => TOPNOW.kills <= 2 },
  { id: 'topKills3', c: 'Ranking', n: 'Pódio de abates', d: 'Fique entre os 3 primeiros no ranking de abates', r: 800, f: () => TOPNOW.kills <= 3 },
  { id: 'topHoras1', c: 'Ranking', n: 'Rei das horas', d: 'Fique em 1º no ranking de horas', r: 2000, f: () => TOPNOW.horas <= 1 },
  { id: 'topHoras2', c: 'Ranking', n: 'Vice em horas', d: 'Fique entre os 2 primeiros no ranking de horas', r: 1200, f: () => TOPNOW.horas <= 2 },
  { id: 'topHoras3', c: 'Ranking', n: 'Pódio de horas', d: 'Fique entre os 3 primeiros no ranking de horas', r: 800, f: () => TOPNOW.horas <= 3 }
];
function checkAch() {
  let ch = false;
  if (G && G.wave > (save.maxWave || 0)) { save.maxWave = G.wave; ch = true; }
  for (const a of ACH) {
    let ok = false;
    try { ok = a.f(); } catch (e) {}
    if (ok && !save.ach[a.id]) {
      save.ach[a.id] = 1; ch = true; save.coins += a.r || 0;
      try { MP.mute = 1; banner('Conquista: ' + a.n, a.d + ' · +' + (a.r || 0) + ' moedas'); MP.mute = 0; sfx.pick(); } catch (e) {}
    }
  }
  if (ch) persist();
}
const UPS = [
  { k: 'hull', n: 'Casco reforçado', d: '+15% de casco' },
  { k: 'gun', n: 'Canhões pesados', d: '+12% de dano' },
  { k: 'rel', n: 'Carregador rápido', d: '−7% de recarga' },
  { k: 'eng', n: 'Motores', d: '+6% de velocidade' }
];
let ADMIN = false; const ADMINS = new Set();
const adm = n => ADMINS.has(n) ? '<em class="rk-you" style="color:var(--rust);border-color:var(--rust)">admin</em>' : '';
const TEST_MODE = false; // true = dinheiro infinito para testes (nunca publique com true)
const MAXLV = 5, KEY_SAVE = 'mar-de-ferro-save';
const upCost = l => Math.round(150 * Math.pow(1.9, l) / 10) * 10;
/* ---------- evento: Colheita Sombria (recompensa: navio Reaper, permanente na conta) ---------- */
let apowOpen = false;
const EVENTO = { id: 'colheita-sombria', nome: 'Colheita Sombria', ini: '2026-10-05T00:00:00-03:00', ship: 'reaper', kills: 3000, bosses: 15, coins: 375000 };
const evtAtivo = () => { const n = Date.now(); return n >= Date.parse(EVENTO.ini); };
const ACC = [
  { id: 'lant', n: 'Lanternas', d: 'Luzes quentes na proa e na popa.', cost: 1500, rar: 'Comum', slot: 'luz' },
  { id: 'flag', n: 'Bandeira Pirata', d: 'Uma bandeira negra tremulando na popa.', cost: 3000, rar: 'Comum', slot: 'popa' },
  { id: 'radar', n: 'Radar', d: 'Antena giratória sobre a cabine.', cost: 4500, rar: 'Incomum', slot: 'cab' },
  { id: 'hat', n: 'Chapéu de Capitão', d: 'Tricórnio sobre a cabine.', cost: 6000, rar: 'Incomum', slot: 'cab' },
  { id: 'anchor', n: 'Âncora Dourada', d: 'Âncora de ouro na proa.', cost: 9000, rar: 'Raro', slot: 'proa' },
  { id: 'neon', n: 'Casco Neon', d: 'Contorno luminoso ao redor do casco.', cost: 14000, rar: 'Raro', slot: 'casco' },
  { id: 'horns', n: 'Chifres Infernais', d: 'Chifres rubros na proa.', cost: 20000, rar: 'Épico', slot: 'proa' },
  { id: 'crown', n: 'Coroa Dourada', d: 'Coroa real sobre a cabine.', cost: 35000, rar: 'Lendário', slot: 'cab' }
];
function accOn(id, on) {
  const a = ACC.find(z => z.id === id), A = save.acc;
  A.on = A.on.filter(o => o !== id && (!on || ACC.find(z => z.id === o).slot !== a.slot));
  if (on) A.on.push(id);
}
let save = { prof: { bio: '', photo: '' }, coins: 0, ship: 'corveta', owned: ['corveta'], up: {}, ach: {}, kills: 0, bosses: 0, sharks: 0, evt: { id: 'colheita-sombria', kills: 0, bosses: 0, notif: 0 }, daily: { streak: 0, last: '' }, wk: { paid: '' }, acc: { own: [], on: [] } };
function upOf(id) { return save.up[id] || (save.up[id] = { hull: 0, gun: 0, rel: 0, eng: 0 }); }
function normUp(sv, owned) {
  const src = (sv && sv.up) || {}, out = {}, legacy = UPS.some(u => typeof src[u.k] === 'number');
  const rd = o => { const r = {}; for (const u of UPS) r[u.k] = clamp(Math.floor(Number(o && o[u.k]) || 0), 0, MAXLV); return r; };
  if (legacy) { for (const id of owned) out[id] = rd(src); }
  else for (const sh of SHIPS) if (src[sh.id]) out[sh.id] = rd(src[sh.id]);
  return out;
}
function cleanProf(p) {
  p = p && typeof p === 'object' ? p : {};
  const bio = String(p.bio || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const ph = typeof p.photo === 'string' && p.photo.length <= 45000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.photo) ? p.photo : '';
  const th = typeof p.thumb === 'string' && p.thumb.length <= 8000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p.thumb) ? p.thumb : '';
  return { bio, photo: ph, thumb: ph ? th : '' };
}
function loadExtra(sv) {
  save.prof = cleanProf(sv && sv.prof);
  save.ts = Math.max(0, Number(sv && sv.ts) || 0);
  save.kills = Math.max(0, Math.floor(Number(sv && sv.kills) || 0));
  save.bosses = Math.max(0, Math.floor(Number(sv && sv.bosses) || 0));
  save.sharks = Math.max(0, Math.floor(Number(sv && sv.sharks) || 0));
  save.play = Math.max(0, Number(sv && sv.play) || 0);
  save.maxWave = Math.max(0, Math.floor(Number(sv && sv.maxWave) || 0));
  save.items = { shield: clamp(Math.floor(Number(sv && sv.items && sv.items.shield) || 0), 0, 5), triple: clamp(Math.floor(Number(sv && sv.items && sv.items.triple) || 0), 0, 5) };
  const ev = sv && sv.evt && sv.evt.id === EVENTO.id ? sv.evt : {};
  save.evt = { id: EVENTO.id, kills: clamp(Math.floor(Number(ev.kills) || 0), 0, EVENTO.kills), bosses: clamp(Math.floor(Number(ev.bosses) || 0), 0, EVENTO.bosses), notif: ev.notif ? 1 : 0 };
  const ac = (sv && sv.acc) || {}, aown = [...new Set((Array.isArray(ac.own) ? ac.own : []).filter(id => ACC.some(x => x.id === id)))], aon = [];
  for (const id of (Array.isArray(ac.on) ? ac.on : [])) { const x = ACC.find(z => z.id === id); if (x && aown.includes(id) && !aon.some(o => ACC.find(z => z.id === o).slot === x.slot)) aon.push(id); }
  save.acc = { own: aown, on: aon };
  { const dl = (sv && sv.daily) || {}; save.daily = { cyc: clamp(Math.floor(Number(dl.cyc) || 0), 0, 99), streak: clamp(Math.floor(Number(dl.streak) || 0), 0, 7), last: /^\d{4}-\d{2}-\d{2}$/.test(dl.last) ? dl.last : '' }; }
  { const d = (sv && sv.dm) || {}, a3 = (v, f) => [0, 1, 2].map(i => f(Array.isArray(v) ? v[i] : 0)); save.dm = { d: /^\d{4}-\d{2}-\d{2}$/.test(d.d) ? d.d : '', p: a3(d.p, x => clamp(Math.floor(Number(x) || 0), 0, 99999)), c: a3(d.c, x => x ? 1 : 0), b: d.b ? 1 : 0 }; }
  { const m = (sv && sv.ms) || {}; save.ms = { s: clamp(Math.floor(Number(m.s) || 0), 0, 999), l: /^\d{4}-\d{2}-\d{2}$/.test(m.l) ? m.l : '' }; }
  save.wk = { paid: sv && sv.wk && /^\d{4}-\d{2}-\d{2}$/.test(sv.wk.paid) ? sv.wk.paid : '' };
  save.ach = {};
  for (const a of ACH) if (sv && sv.ach && sv.ach[a.id]) save.ach[a.id] = 1;
}
try {
  const sv = JSON.parse(localStorage.getItem(KEY_SAVE));
  if (sv && typeof sv === 'object') {
    save.coins = Math.max(0, Number(sv.coins) || 0);
    if (Array.isArray(sv.owned) && sv.owned.includes('corveta')) save.owned = sv.owned.filter(id => SHIPS.some(s => s.id === id));
    if (SHIPS.some(s => s.id === sv.ship) && save.owned.includes(sv.ship)) save.ship = sv.ship;
    save.up = normUp(sv, save.owned);
    loadExtra(sv);
  }
} catch (e) {}
function persist() { if (TEST_MODE || ADMIN) save.coins = 99999999; save.ts = Date.now(); try { localStorage.setItem(KEY_SAVE, JSON.stringify(save)); } catch (e) {} try { cloudSoon(); } catch (e) {} try { checkAch(); } catch (e) {} }
if (TEST_MODE) save.coins = 99999999;
else if (save.coins >= 99999999) { save.coins = 0; persist(); } // limpa o saldo falso do modo de teste
const effShipId = () => { const sh = SHIPS.find(x => x.id === save.ship) || SHIPS[0]; return sh.adminOnly && !ADMIN ? SHIPS[0].id : sh.id; };
function playerStats() {
  let sh = SHIPS.find(s => s.id === save.ship) || SHIPS[0];
  if (sh.adminOnly && !ADMIN) sh = SHIPS[0];
  const u = upOf(sh.id);
  return {
    spec: Object.assign({}, sh.spec, { speed: sh.speed * (1 + .06 * u.eng) }),
    id: sh.id, admin: !!sh.adm, auto: !!sh.auto, cloak: !!sh.cloak, air: !!sh.air, multi: sh.multi || 1, esc: !!sh.esc, clone: !!sh.clone, surge: !!sh.surge, reaper: !!sh.reaper, msl: !!sh.msl, chg: !!sh.chg, tpd: !!sh.tpd, nova: !!sh.nova, vg: !!sh.vg, phx: !!sh.phx,
    hp: Math.round(sh.hp * (1 + .15 * u.hull)), dmg: Math.round(sh.dmg * (1 + .12 * u.gun)), rel: sh.rel * (1 - .07 * u.rel)
  };
}
function evtAdd(k, b) {
  if (!evtAtivo() || save.owned.includes(EVENTO.ship)) return;
  const e = save.evt || (save.evt = { id: EVENTO.id, kills: 0, bosses: 0, notif: 0 });
  e.kills = Math.min(EVENTO.kills, e.kills + k); e.bosses = Math.min(EVENTO.bosses, e.bosses + b);
  if (!e.notif && e.kills >= EVENTO.kills && e.bosses >= EVENTO.bosses) { e.notif = 1; try { banner('Evento: Yamaton', 'Requisitos cumpridos! Resgate na Oficina'); } catch (x) {} }
}
function claimEvento() {
  const e = save.evt;
  if (!evtAtivo() || save.owned.includes(EVENTO.ship) || !e || e.kills < EVENTO.kills || e.bosses < EVENTO.bosses || save.coins < EVENTO.coins) return false;
  save.coins -= EVENTO.coins; save.owned.push(EVENTO.ship); save.ship = EVENTO.ship; sfx.pick(); return true;
}
function addCoins(n) { if (typeof EVT !== "undefined" && EVT && EVT.mult > 1 && Date.parse(EVT.ate) > Date.now()) n = Math.round(n * EVT.mult); G.coins += n; save.coins += n; try { misAdd('coins', n); } catch (e) {} persist(); return n; }

/* ---------- perigos do mar: icebergs e redemoinhos (gerados por células, iguais em todos os clientes) ---------- */
const HZ_CELL = 900, HZ = new Map(), VW = [], VI = [], ICE_ST = new Map();
let HZ_SEED = 0x2a5f3c;
function setSeed(s) { HZ_SEED = s | 0; HZ.clear(); ICE_ST.clear(); }
function hsh(a, b, c) {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 1274126177) ^ HZ_SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; h = Math.imul(h, 2246822519); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function hzCell(cx, cy) {
  const key = cx * 100003 + cy;
  let c = HZ.get(key);
  if (c) return c;
  if (HZ.size > 700) HZ.clear();
  c = { ice: [], wh: [] };
  HZ.set(key, c);
  const ox = cx * HZ_CELL, oy = cy * HZ_CELL;
  const px = n => ox + HZ_CELL * (.13 + .74 * hsh(cx, cy, 10 + n * 2)), py = n => oy + HZ_CELL * (.13 + .74 * hsh(cx, cy, 11 + n * 2));
  if (hsh(cx, cy, 1) < .3) {
    const x = px(0), y = py(0);
    if (Math.hypot(x, y) > 520) c.wh.push({ x, y, r: 120 + 70 * hsh(cx, cy, 5), dir: hsh(cx, cy, 6) < .5 ? 1 : -1, ph: hsh(cx, cy, 7) * TAU });
  }
  if (hsh(cx, cy, 8) < .22) {
    const r = 110 + 110 * hsh(cx, cy, 9), mg = r * 1.15 + 20;
    const x = ox + mg + (HZ_CELL - 2 * mg) * hsh(cx, cy, 50), y = oy + mg + (HZ_CELL - 2 * mg) * hsh(cx, cy, 51);
    if (Math.hypot(x, y) > 520 + r && !c.wh.some(w => Math.hypot(w.x - x, w.y - y) < w.r + r + 40)) {
      const m = 16 + Math.floor(hsh(cx, cy, 52) * 5), ph = hsh(cx, cy, 53) * TAU, pts = [], trees = [], nt = 5 + Math.floor(r / 22);
      for (let i = 0; i < m; i++) {
        const a = i / m * TAU + (hsh(cx, cy, 400 + i) - .5) * .1, rad = r * (.88 + .12 * hsh(cx, cy, 450 + i)) * (1 + .07 * Math.sin(2 * a + ph));
        pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
      }
      for (let i = 0; i < nt; i++) {
        const a = hsh(cx, cy, 500 + i * 3) * TAU, d = r * (.12 + .5 * Math.sqrt(hsh(cx, cy, 501 + i * 3)));
        trees.push([Math.cos(a) * d, Math.sin(a) * d, 5 + 4 * hsh(cx, cy, 502 + i * 3)]);
      }
      c.ice.push({ x, y, r, pts, trees, isl: true, ph });
    }
  }
  for (let n = 0; n < 2; n++) {
    if (hsh(cx, cy, 2 + n) >= (n ? .3 : .62)) continue;
    const x = px(n + 1), y = py(n + 1), r = 38 + 72 * hsh(cx, cy, 20 + n);
    if (Math.hypot(x, y) < 560 + r) continue;
    if (c.wh.some(w => Math.hypot(w.x - x, w.y - y) < w.r + r + 40) || c.ice.some(o => Math.hypot(o.x - x, o.y - y) < o.r + r + 50)) continue;
    const m = 9 + Math.floor(hsh(cx, cy, 30 + n) * 4), pts = [], fc = [], hub = [-r * .12, -r * .14];
    for (let i = 0; i < m; i++) {
      const a = i / m * TAU + (hsh(cx, cy, 100 + n * 30 + i) - .5) * .3, rad = r * (.82 + .23 * hsh(cx, cy, 200 + n * 30 + i));
      pts.push([Math.cos(a) * rad, Math.sin(a) * rad]);
    }
    for (let i = 0; i < m; i++) {
      const a = pts[i], b = pts[(i + 1) % m], am = Math.atan2((a[1] + b[1]) / 2 - hub[1], (a[0] + b[0]) / 2 - hub[0]), l = Math.cos(am + 2.356);
      fc.push(l > 0 ? 'rgba(255,255,255,' + (l * .6).toFixed(2) + ')' : 'rgba(55,105,128,' + (-l * .38).toFixed(2) + ')');
    }
    c.ice.push({ x, y, r, pts, fc, hub });
  }
  iceInit(c, cx, cy);
  return c;
}
/* ---------- icebergs quebráveis: cada tiro do jogador/aliados dá um golpe; o gelo encolhe até quebrar ---------- */
function iceMaxHits(r) { return 10 + Math.round(r / 10); }
function iceInit(c, cx, cy) {
  c.ice.forEach((ic, i) => {
    if (ic.isl) return;
    ic.id = cx + ',' + cy + ',' + i; ic.cx = cx; ic.cy = cy; ic.max = iceMaxHits(ic.r); ic.h = 0; ic.fl = 0;
    ic.sd = Math.floor(hsh(cx, cy, 800 + i) * 1e9); ic.cr = [];
    const h = ICE_ST.get(ic.id);
    if (h) { if (h >= ic.max) ic.gone = true; else { ic.h = h; while (ic.cr.length < h) iceCrackAdd(ic, null, null, -1e9); } }
  });
  if (c.ice.some(ic => ic.gone)) c.ice = c.ice.filter(ic => !ic.gone);
}
/* rachaduras: cada golpe abre uma fissura a partir do ponto do impacto (ou de um ponto sorteado, se a posição for desconhecida).
   Tudo sai de um gerador com semente (ic.sd + índice do golpe), então todos os clientes veem o mesmo desenho. */
function rng32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function crackJag(a, b, rnd, amp, lv) { // linha irregular entre a e b (deslocamento do ponto médio)
  let pts = [a, b];
  for (let l = 0; l < lv; l++) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy) || 1, o = (rnd() - .5) * amp * d;
      out.push([(p[0] + q[0]) / 2 - dy / d * o, (p[1] + q[1]) / 2 + dx / d * o], q);
    }
    pts = out; amp *= .75;
  }
  return pts;
}
function iceCrackAdd(ic, wx, wy, born) {
  const k = ic.cr.length, rnd = rng32(ic.sd + k * 7919 + 17), r = ic.r;
  const ra = rnd() * TAU, rd = r * (.3 + .5 * rnd()); let ox = Math.cos(ra) * rd, oy = Math.sin(ra) * rd;
  if (wx != null) { ox = wx - ic.x; oy = wy - ic.y; const d = Math.hypot(ox, oy), m = r * .85; if (d > m) { ox *= m / d; oy *= m / d; } }
  const o = [ox, oy], link = k > 0 && rnd() < .65, outward = rnd() < .3, jit = (rnd() - .5) * 1.6, lf = .4 + .5 * rnd();
  let end;
  if (link) { // liga a uma fissura anterior: forma uma rede, não só riscos soltos
    const pc = ic.cr[Math.floor(rnd() * k)], tp = pc.p[1 + Math.floor(rnd() * (pc.p.length - 1))];
    end = [tp[0], tp[1]];
  } else {
    const a = Math.atan2(oy, ox) + (outward ? 0 : Math.PI) + jit, L = r * lf;
    end = [ox + Math.cos(a) * L, oy + Math.sin(a) * L];
    const d = Math.hypot(end[0], end[1]), m = r * .95; if (d > m) { end[0] *= m / d; end[1] *= m / d; }
  }
  const p = crackJag(o, end, rnd, .55, 3), b = [], nb = 1 + (rnd() < .6 ? 1 : 0) + (rnd() < .25 ? 1 : 0);
  for (let i = 0; i < nb; i++) {
    const idx = 1 + Math.floor(rnd() * (p.length - 2)), q = p[idx], pv = p[idx - 1], nx = p[idx + 1];
    const a = Math.atan2(nx[1] - pv[1], nx[0] - pv[0]) + (rnd() < .5 ? 1 : -1) * (.5 + .6 * rnd()), L = r * (.1 + .2 * rnd());
    const e = [q[0] + Math.cos(a) * L, q[1] + Math.sin(a) * L], d = Math.hypot(e[0], e[1]), m = r * .95;
    if (d > m) { e[0] *= m / d; e[1] *= m / d; }
    b.push({ p: crackJag(q, e, rnd, .5, 2), at: idx / (p.length - 1) });
  }
  ic.cr.push({ p, b, o, t0: born, g: 1 });
}
/* mini onda ao quebrar: anel que se expande e empurra para fora todo navio que ele alcança (host e convidados criam a mesma onda) */
function iceWave(ic) {
  const v = 300, R = ic.r * 3.2 + 180, life = R / v;
  (G.waves || (G.waves = [])).push({ x: ic.x, y: ic.y, t0: G.t, v, R, life, band: 90 + ic.r * .4, k: .55 + ic.r / 200 });
  addP({ t: 'cring', c: '235,252,255', x: ic.x, y: ic.y, life, size: 6, grow: v, w: 6 });
  addP({ t: 'cring', c: '170,220,240', x: ic.x, y: ic.y, life, size: 2, grow: v * .88, w: 3.5 });
  addP({ t: 'cring', c: '120,190,225', x: ic.x, y: ic.y, life: life * .9, size: 2, grow: v * .74, w: 2 });
  noise(.9, 700, 110, .3); tone(72, 38, .7, .26, 'sine');
}
function iceWavePush(s, dt, mass) {
  for (let i = G.waves.length - 1; i >= 0; i--) {
    const w = G.waves[i], age = Math.max(0, G.t - w.t0);
    if (age >= w.life) { G.waves.splice(i, 1); continue; }
    const R = w.v * age, dx = s.x - w.x, dy = s.y - w.y, d = Math.hypot(dx, dy) || .01, e = Math.abs(d - R);
    if (e > w.band) continue;
    const f = (1 - e / w.band) * (1 - R / w.R) * w.k * mass, nx = dx / d, ny = dy / d;
    s.x += nx * f * 480 * dt; s.y += ny * f * 480 * dt;
    s.heading += Math.sin(Math.atan2(ny, nx) - s.heading) * .6 * f * dt;
    if (s === G.player) G.shake = Math.max(G.shake, 1.4 * f);
  }
}
function iceFx(ic, x, y, broken, stage) {
  const base = Math.atan2(y - ic.y, x - ic.x), n = broken ? 26 : 4, cr = ic.cr || [];
  for (let i = 0; i < n; i++) {
    let px, py, a;
    if (broken && cr.length) { // o gelo se parte ao longo das fissuras
      const c = cr[Math.floor(Math.random() * cr.length)], pt = c.p[Math.floor(Math.random() * c.p.length)];
      px = ic.x + pt[0]; py = ic.y + pt[1]; a = Math.atan2(pt[1], pt[0]) + rand(-.7, .7);
    } else {
      a = broken ? rand(0, TAU) : base + rand(-1.1, 1.1);
      px = broken ? ic.x + Math.cos(a) * ic.r * rand(0, .8) : x; py = broken ? ic.y + Math.sin(a) * ic.r * rand(0, .8) : y;
    }
    const v = rand(.25, 1) * (broken ? 150 : 110);
    addP({ t: 'chunk', x: px, y: py, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: broken ? rand(1.2, 2.2) : rand(.5, .9), size: broken ? rand(4, 10) : rand(2, 4.5), rot: rand(0, TAU), vr: rand(-4, 4), drag: broken ? 1.6 : 2.2, c: Math.random() < .5 ? '240,252,255' : '175,218,234' });
  }
  if (stage && !broken) { // limiar de dano (33% / 66%): fissura grande, estalo e lascas ao longo dela
    const c = cr[cr.length - 1];
    if (c) for (let i = 0; i < 8; i++) {
      const pt = c.p[Math.floor(Math.random() * c.p.length)], a = Math.atan2(pt[1], pt[0]) + rand(-.8, .8), v = rand(.3, 1) * 90;
      addP({ t: 'chunk', x: ic.x + pt[0], y: ic.y + pt[1], vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.6, 1.1), size: rand(2, 5), rot: rand(0, TAU), vr: rand(-4, 4), drag: 2, c: Math.random() < .5 ? '240,252,255' : '175,218,234' });
    }
    addP({ t: 'cring', c: '200,235,248', x: ic.x, y: ic.y, life: .5, size: ic.r * .2, grow: ic.r * 1.1, w: 2.5 });
    G.shake = Math.max(G.shake, .9 + stage * .5);
    noise(.3, 2600, 300, .3, 'bandpass'); tone(95 - stage * 12, 48, .35, .2, 'sawtooth');
  }
  if (broken) {
    addP({ t: 'cring', c: '210,240,250', x: ic.x, y: ic.y, life: .55, size: ic.r * .3, grow: ic.r * 1.6, w: 4 });
    addP({ t: 'flash', x: ic.x, y: ic.y, life: .25, size: ic.r * .8 });
    G.shake = Math.max(G.shake, 2.2);
    noise(.5, 4200, 400, .45, 'bandpass'); tone(150, 45, .4, .3, 'sawtooth');
    iceWave(ic);
  } else {
    addP({ t: 'cring', c: '220,245,255', x, y, life: .3, size: 3, grow: 60, w: 2 });
    noise(.1, 6000, 3000, .16, 'highpass');
  }
}
function iceBreakAt(ic) { const c = hzCell(ic.cx, ic.cy), k = c.ice.indexOf(ic); if (k >= 0) c.ice.splice(k, 1); }
function iceStage(h0, h1, max) { const a = h0 / max, b = h1 / max; return a < .66 && b >= .66 ? 2 : a < .33 && b >= .33 ? 1 : 0; }
function iceChip(ic, x, y) {
  const h0 = ic.h; ic.h++; ic.fl = performance.now(); ICE_ST.set(ic.id, ic.h);
  const broken = ic.h >= ic.max;
  if (MP.role === 'host' && !MP.mute) evp(['ic', ic.id, ic.h, Math.round(x), Math.round(y)]);
  if (!broken) iceCrackAdd(ic, x, y, ic.fl);
  iceFx(ic, x, y, broken, iceStage(h0, ic.h, ic.max));
  if (broken) iceBreakAt(ic);
}
function iceNet(id, h, x, y) { // convidado: aplica o golpe que o anfitrião registrou
  const [cx, cy] = id.split(',').map(Number); ICE_ST.set(id, h);
  const ic = hzCell(cx, cy).ice.find(o => o.id === id); if (!ic || ic.h >= h) return;
  const h0 = ic.h; ic.h = h; ic.fl = performance.now(); const broken = h >= ic.max;
  if (!broken) while (ic.cr.length < h) { const last = ic.cr.length === h - 1; iceCrackAdd(ic, last ? x : null, last ? y : null, last ? ic.fl : -1e9); }
  iceFx(ic, x, y, broken, iceStage(h0, h, ic.max));
  if (broken) iceBreakAt(ic);
}
function iceHit(x, y) {
  const c = hzCell(Math.floor(x / HZ_CELL), Math.floor(y / HZ_CELL));
  for (let i = 0; i < c.ice.length; i++) {
    const ic = c.ice[i], dx = x - ic.x, dy = y - ic.y, rr = ic.r * .9;
    if (dx * dx + dy * dy < rr * rr) return ic;
  }
  return null;
}
function iceAt(x, y) {
  const c = hzCell(Math.floor(x / HZ_CELL), Math.floor(y / HZ_CELL));
  for (let i = 0; i < c.ice.length; i++) {
    const ic = c.ice[i], dx = x - ic.x, dy = y - ic.y, rr = ic.r * .9;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  return false;
}
function iceOut(x, y, m) {
  for (let i = Math.floor((x - 130) / HZ_CELL); i <= Math.floor((x + 130) / HZ_CELL); i++)
    for (let j = Math.floor((y - 130) / HZ_CELL); j <= Math.floor((y + 130) / HZ_CELL); j++)
      for (const ic of hzCell(i, j).ice) {
        const dx = x - ic.x, dy = y - ic.y, d = Math.hypot(dx, dy) || .01, min = ic.r * .9 + m;
        if (d < min) { x = ic.x + dx / d * min; y = ic.y + dy / d * min; }
      }
  return [x, y];
}
const HZ_OFF = [-.3, 0, .3];
function hazShip(s, dt) {
  const sp = s.spec, L = sp.len, rs = sp.wid * .5 + 2, mass = clamp(90 / L, .55, 1.3);
  if (G.waves && G.waves.length) iceWavePush(s, dt, mass);
  for (let i = Math.floor((s.x - 200) / HZ_CELL); i <= Math.floor((s.x + 200) / HZ_CELL); i++)
    for (let j = Math.floor((s.y - 200) / HZ_CELL); j <= Math.floor((s.y + 200) / HZ_CELL); j++) {
      const c = hzCell(i, j);
      for (let k = 0; k < c.wh.length; k++) {
        const w = c.wh[k], dx = w.x - s.x, dy = w.y - s.y, d = Math.hypot(dx, dy);
        if (d >= w.r || d < 1) continue;
        const f = 1 - d / w.r, nx = dx / d, ny = dy / d, pull = (95 * f * f + 18 * f) * mass, tg = 80 * f * w.dir * mass;
        s.x += (nx * pull - ny * tg) * dt; s.y += (ny * pull + nx * tg) * dt;
        s.heading += w.dir * .9 * f * mass * dt;
        s.speed *= 1 - .3 * f * dt;
      }
    }
  const m = L * .35 + rs;
  let hit = false;
  for (let i = Math.floor((s.x - m) / HZ_CELL); i <= Math.floor((s.x + m) / HZ_CELL); i++)
    for (let j = Math.floor((s.y - m) / HZ_CELL); j <= Math.floor((s.y + m) / HZ_CELL); j++) {
      const c = hzCell(i, j);
      for (let k = 0; k < c.ice.length; k++) {
        const ic = c.ice[k];
        for (let o = 0; o < 3; o++) {
          const px = s.x + Math.cos(s.heading) * L * HZ_OFF[o], py = s.y + Math.sin(s.heading) * L * HZ_OFF[o];
          const dx = px - ic.x, dy = py - ic.y, d = Math.hypot(dx, dy) || .01, min = ic.r * .88 + rs;
          if (d < min) { const push = min - d; s.x += dx / d * push; s.y += dy / d * push; hit = true; }
        }
      }
    }
  if (hit) s.speed *= 1 - Math.min(.9, 4 * dt);
}
function hzVisible(c) {
  VW.length = 0; VI.length = 0;
  const hx = W / 2 / zoom + 220, hy = H / 2 / zoom + 220;
  for (let i = Math.floor((c.x - hx) / HZ_CELL); i <= Math.floor((c.x + hx) / HZ_CELL); i++)
    for (let j = Math.floor((c.y - hy) / HZ_CELL); j <= Math.floor((c.y + hy) / HZ_CELL); j++) {
      const k = hzCell(i, j);
      for (const w of k.wh) VW.push(w);
      for (const ic of k.ice) VI.push(ic);
    }
}
function drawWhirl(w, t) {
  const R = w.r, d = w.dir, N = 5, pul = .5 + .5 * Math.sin(t * 2 + w.ph);
  ctx.save(); ctx.translate(w.x, w.y);
  // funil: água escurecendo até o centro + borda clara de espuma
  let gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
  gr.addColorStop(0, 'rgba(0,5,10,.8)'); gr.addColorStop(.3, 'rgba(2,14,24,.5)'); gr.addColorStop(.7, 'rgba(8,40,56,.2)');
  gr.addColorStop(.92, 'rgba(110,200,220,.1)'); gr.addColorStop(1, 'rgba(160,225,238,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.fill();
  // anéis concêntricos que giram em velocidades diferentes
  ctx.lineCap = 'round';
  for (let k = 1; k <= 3; k++) {
    const rr = R * (.28 + k * .2);
    ctx.setLineDash([rr * .5, rr * .3]); ctx.lineDashOffset = -t * (20 + k * 14) * d;
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(170,225,235,' + (.1 + .06 * k).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
  }
  ctx.setLineDash([]);
  // braços em espiral: finos e fracos na borda, grossos e claros perto do centro
  const SEG = 18;
  for (let a = 0; a < N; a++) {
    let px = 0, py = 0;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, rad = R * (.08 + .92 * u), ang = w.ph + a * TAU / N + d * (t * 1.5 + 3.6 * (1 - u));
      const x = Math.cos(ang) * rad, y = Math.sin(ang) * rad;
      if (i) {
        const f = 1 - u;
        ctx.lineWidth = 1.4 + 3.6 * f; ctx.strokeStyle = 'rgba(200,238,244,' + (.12 + .42 * f * f).toFixed(3) + ')';
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      }
      px = x; py = y;
    }
  }
  // espuma sendo sugada para o centro
  ctx.fillStyle = '#eefcff';
  for (let n = 0; n < 14; n++) {
    const u = 1 - ((t * .32 + n / 14) % 1), rad = R * (.08 + .9 * u), ang = w.ph + (n % N) * TAU / N + d * (t * 1.5 + 3.6 * (1 - u)) + (n * 1.7 % .3);
    ctx.globalAlpha = Math.min(1, u * 2.2) * .75 * (1 - u * .4);
    ctx.beginPath(); ctx.arc(Math.cos(ang) * rad, Math.sin(ang) * rad, 1.2 + 2 * (1 - u), 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // olho do redemoinho com pulso
  gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R * .16);
  gr.addColorStop(0, 'rgba(0,2,6,.95)'); gr.addColorStop(.7, 'rgba(1,8,14,.8)'); gr.addColorStop(1, 'rgba(1,8,14,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, R * .16, 0, TAU); ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(190,235,245,' + (.3 + .3 * pul).toFixed(2) + ')';
  ctx.beginPath(); ctx.arc(0, 0, R * (.1 + .02 * pul), 0, TAU); ctx.stroke();
  // limite da zona de atração (bem visível, pulsa de leve)
  ctx.setLineDash([8, 10]); ctx.lineDashOffset = -t * 22 * d; ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(190,235,245,' + (.32 + .12 * pul).toFixed(2) + ')';
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
  ctx.restore();
}
function blobPath(P, k) {
  const n = P.length;
  ctx.beginPath(); ctx.moveTo((P[n - 1][0] + P[0][0]) / 2 * k, (P[n - 1][1] + P[0][1]) / 2 * k);
  for (let i = 0; i < n; i++) { const a = P[i], b = P[(i + 1) % n]; ctx.quadraticCurveTo(a[0] * k, a[1] * k, (a[0] + b[0]) / 2 * k, (a[1] + b[1]) / 2 * k); }
  ctx.closePath();
}
function drawIsland(ic) {
  const t = G ? G.t : 0, r = ic.r, ph = ic.ph;
  ctx.save(); ctx.translate(ic.x, ic.y);
  // águas rasas em turquesa, degradê do fundo até a borda
  let gr = ctx.createRadialGradient(0, 0, r * .7, 0, 0, r * 1.45);
  gr.addColorStop(0, 'rgba(70,210,205,.42)'); gr.addColorStop(.6, 'rgba(60,180,200,.2)'); gr.addColorStop(1, 'rgba(60,170,200,0)');
  ctx.fillStyle = gr; blobPath(ic.pts, 1.45); ctx.fill();
  // ondas de marola se expandindo da costa
  for (let k = 0; k < 2; k++) {
    const f = ((t * .22 + k * .5 + ph) % 1 + 1) % 1;
    ctx.lineWidth = 2.4 * (1 - f) + .6; ctx.strokeStyle = 'rgba(235,252,252,' + (.5 * (1 - f)).toFixed(3) + ')';
    blobPath(ic.pts, 1.05 + f * .22); ctx.stroke();
  }
  // sombra no fundo do mar
  ctx.save(); ctx.translate(6, 10); blobPath(ic.pts, 1.02); ctx.fillStyle = 'rgba(2,14,22,.38)'; ctx.fill(); ctx.restore();
  // faixa de espuma pulsando na linha d'água
  blobPath(ic.pts, 1.07); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(240,252,252,' + (.35 + .2 * Math.sin(t * 1.6 + ph)).toFixed(2) + ')'; ctx.stroke();
  // areia molhada e areia seca
  blobPath(ic.pts, 1.03); ctx.fillStyle = '#c2ad6c'; ctx.fill();
  blobPath(ic.pts, .97); gr = ctx.createRadialGradient(-r * .3, -r * .3, r * .1, 0, 0, r * 1.05);
  gr.addColorStop(0, '#f0dfa4'); gr.addColorStop(1, '#d6bf80'); ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(150,120,60,.6)'; ctx.stroke();
  // mata: borda mais escura, colina clara no meio, luz vindo do alto-esquerda
  blobPath(ic.pts, .76); gr = ctx.createRadialGradient(-r * .25, -r * .25, r * .05, 0, 0, r * .8);
  gr.addColorStop(0, '#6fae5c'); gr.addColorStop(1, '#3f7d46'); ctx.fillStyle = gr; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(30,80,45,.55)'; ctx.stroke();
  ctx.save(); ctx.translate(-r * .05, -r * .06); blobPath(ic.pts, .46); gr = ctx.createRadialGradient(-r * .1, -r * .1, 0, 0, 0, r * .5);
  gr.addColorStop(0, '#8cc46a'); gr.addColorStop(1, '#4f8c4c'); ctx.fillStyle = gr; ctx.fill(); ctx.restore();
  // pedrinhas e tufos na areia (posições fixas, derivadas da própria ilha)
  for (let n = 0; n < 7; n++) {
    const a = ph * 3 + n * 2.4, d = r * (.8 + .12 * ((n * 37) % 10) / 10);
    ctx.beginPath(); ctx.ellipse(Math.cos(a) * d, Math.sin(a) * d, 3 + n % 3, 2 + n % 2, a, 0, TAU);
    ctx.fillStyle = n % 2 ? '#a89a82' : '#8f8672'; ctx.fill();
  }
  // árvores: sombra, copa escura e brilho
  for (const tr of ic.trees) {
    const x = tr[0], y = tr[1], q = tr[2], sw = Math.sin(t * 1.3 + x * .05 + ph) * .6;
    ctx.beginPath(); ctx.ellipse(x + q * .45, y + q * .55, q * 1.05, q * .8, 0, 0, TAU); ctx.fillStyle = 'rgba(8,40,22,.4)'; ctx.fill();
    ctx.beginPath(); ctx.arc(x + sw * .5, y, q, 0, TAU); ctx.fillStyle = '#255a35'; ctx.fill();
    ctx.beginPath(); ctx.arc(x - q * .22 + sw, y - q * .22, q * .68, 0, TAU); ctx.fillStyle = '#35803f'; ctx.fill();
    ctx.beginPath(); ctx.arc(x - q * .38 + sw, y - q * .4, q * .3, 0, TAU); ctx.fillStyle = 'rgba(190,235,140,.55)'; ctx.fill();
  }
  ctx.restore();
}
function crackPath(pts, g) { // traça a fração g (0..1) da polilinha, interpolando o último segmento
  const n = pts.length - 1, f = g * n, full = Math.floor(f);
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i <= Math.min(full, n); i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (full < n) { const a = pts[full], b = pts[full + 1], u = f - full; ctx.lineTo(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u); }
}
function drawIce(ic) {
  if (ic.isl) { drawIsland(ic); return; }
  const P = ic.pts, n = P.length, r = ic.r, t = G ? G.t : 0, ph = ic.x * .013 + ic.y * .007;
  const bob = Math.sin(t * .9 + ph) * 1.2;
  const path = k => { ctx.beginPath(); for (let i = 0; i < n; i++) ctx.lineTo(P[i][0] * k, P[i][1] * k); ctx.closePath(); };
  ctx.save(); ctx.translate(ic.x, ic.y);
  // brilho frio na água ao redor
  let gr = ctx.createRadialGradient(0, 0, r * .6, 0, 0, r * 1.7);
  gr.addColorStop(0, 'rgba(150,225,245,.3)'); gr.addColorStop(1, 'rgba(150,225,245,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, r * 1.7, 0, TAU); ctx.fill();
  // parte submersa: gelo azulado visível sob a água
  path(1.22); gr = ctx.createRadialGradient(0, 0, r * .3, 0, 0, r * 1.25);
  gr.addColorStop(0, 'rgba(120,200,225,.5)'); gr.addColorStop(1, 'rgba(80,160,200,.12)'); ctx.fillStyle = gr; ctx.fill();
  // marola pulsando na linha d'água
  const f = ((t * .3 + ph) % 1 + 1) % 1;
  path(1.1 + f * .18); ctx.lineWidth = 2 * (1 - f) + .5; ctx.strokeStyle = 'rgba(235,252,255,' + (.5 * (1 - f)).toFixed(3) + ')'; ctx.stroke();
  path(1.08); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(235,252,255,' + (.3 + .15 * Math.sin(t * 1.5 + ph)).toFixed(2) + ')'; ctx.stroke();
  // sombra
  ctx.save(); ctx.translate(5, 9); path(1); ctx.fillStyle = 'rgba(2,12,20,.35)'; ctx.fill(); ctx.restore();
  const hitAge = ic.fl ? performance.now() - ic.fl : 1e9, trem = (hitAge < 260 ? (1 - hitAge / 260) * 2.2 : 0) + (ic.max && ic.h / ic.max > .8 ? .35 : 0);
  ctx.translate(Math.sin(t * 70) * trem, bob + Math.cos(t * 83) * trem);
  // corpo com degradê de luz (alto-esquerda)
  path(1); gr = ctx.createLinearGradient(-r * .8, -r * .8, r * .8, r * .9);
  gr.addColorStop(0, '#f4fcff'); gr.addColorStop(.55, '#d3ecf4'); gr.addColorStop(1, '#a9d0de'); ctx.fillStyle = gr; ctx.fill();
  // faces facetadas, com aresta fina
  for (let i = 0; i < n; i++) {
    const b = P[(i + 1) % n];
    ctx.beginPath(); ctx.moveTo(ic.hub[0], ic.hub[1]); ctx.lineTo(P[i][0], P[i][1]); ctx.lineTo(b[0], b[1]); ctx.closePath();
    ctx.fillStyle = ic.fc[i]; ctx.fill();
    ctx.lineWidth = .8; ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.stroke();
  }
  // rachaduras: cada golpe abre uma fissura no ponto do impacto; ela cresce, ramifica e se liga às anteriores
  const now = performance.now(), dmg = ic.max ? ic.h / ic.max : 0;
  while (ic.cr.length < ic.h && ic.cr.length < ic.max) iceCrackAdd(ic, null, null, -1e9);
  for (const c of ic.cr) { const u = Math.min(1, Math.max(0, (now - c.t0) / 420)); c.g = 1 - (1 - u) * (1 - u) * (1 - u); }
  ctx.save(); path(1); ctx.clip(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (dmg > 0) { ctx.fillStyle = 'rgba(70,120,150,' + (dmg * .2).toFixed(3) + ')'; ctx.fillRect(-r * 1.3, -r * 1.3, r * 2.6, r * 2.6); }
  for (let pass = 0; pass < 2; pass++) { // 0 = brilho claro deslocado, 1 = fissura escura
    ctx.save(); if (!pass) ctx.translate(1.1, 1.1);
    for (let w = 0; w < 2; w++) { // 0 = fissuras principais, 1 = ramos finos
      ctx.strokeStyle = pass ? 'rgba(38,88,120,' + (.7 + .25 * dmg).toFixed(2) + ')' : 'rgba(255,255,255,.6)';
      ctx.lineWidth = (pass ? 1 + dmg * 1.2 : 2.2 + dmg * 1.2) * (w ? .6 : 1);
      ctx.beginPath();
      for (const c of ic.cr) {
        if (!w) crackPath(c.p, c.g);
        else for (const b of c.b) if (c.g > b.at) crackPath(b.p, (c.g - b.at) / (1 - b.at));
      }
      ctx.stroke();
    }
    ctx.restore();
  }
  // marca do impacto: lasca esbranquiçada com um furinho no centro
  const mr = r * .04 + 1;
  ctx.beginPath(); for (const c of ic.cr) { ctx.moveTo(c.o[0] + mr, c.o[1]); ctx.arc(c.o[0], c.o[1], mr, 0, TAU); }
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fill();
  ctx.beginPath(); for (const c of ic.cr) { ctx.moveTo(c.o[0] + 1.3, c.o[1]); ctx.arc(c.o[0], c.o[1], 1.3, 0, TAU); }
  ctx.fillStyle = 'rgba(40,90,120,.7)'; ctx.fill();
  ctx.restore();
  const fl = ic.fl ? Math.max(0, 1 - (performance.now() - ic.fl) / 180) : 0;
  if (fl > 0) { path(1); ctx.fillStyle = 'rgba(255,255,255,' + (fl * .6).toFixed(2) + ')'; ctx.fill(); }
  // contorno e pico claro
  path(1); ctx.lineWidth = 1.8; ctx.strokeStyle = 'rgba(110,165,185,.95)'; ctx.stroke();
  gr = ctx.createRadialGradient(ic.hub[0], ic.hub[1], 0, ic.hub[0], ic.hub[1], r * .28);
  gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(ic.hub[0], ic.hub[1], r * .28, 0, TAU); ctx.fill();
  // brilho cintilante
  const tw = Math.max(0, Math.sin(t * 2.2 + ph * 7)); if (tw > .05) {
    const sx = ic.hub[0] - r * .08, sy = ic.hub[1] - r * .1, q = r * .13 * tw;
    ctx.strokeStyle = 'rgba(255,255,255,' + tw.toFixed(2) + ')'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(sx - q, sy); ctx.lineTo(sx + q, sy); ctx.moveTo(sx, sy - q); ctx.lineTo(sx, sy + q); ctx.stroke();
  }
  ctx.restore();
}

/* ---------- áudio ---------- */
let actx = null, master = null, nbuf = null, muted = false;
function initAudio() {
  if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    master = actx.createGain(); master.gain.value = muted ? 0 : cfg.vol / 100; master.connect(actx.destination);
    nbuf = actx.createBuffer(1, Math.floor(actx.sampleRate * 1.5), actx.sampleRate);
    const d = nbuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch (e) { actx = null; }
}
function noise(dur, f0, f1, vol, type) {
  if (!actx || muted) return;
  const t = actx.currentTime;
  const src = actx.createBufferSource(); src.buffer = nbuf;
  const f = actx.createBiquadFilter(); f.type = type || 'lowpass';
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t, Math.random() * .4); src.stop(t + dur + .05);
}
function tone(f0, f1, dur, vol, type) {
  if (!actx || muted) return;
  const t = actx.currentTime;
  const o = actx.createOscillator(); o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = actx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
}
const sfx = {
  cannon() { noise(.4, 2200, 180, .7); tone(150, 38, .35, .9); },
  enemy() { noise(.3, 1200, 150, .28); tone(110, 36, .28, .4); },
  hit() { noise(.18, 3200, 500, .45, 'bandpass'); tone(220, 90, .12, .22, 'square'); },
  hurt() { noise(.3, 900, 120, .8); tone(80, 30, .3, .8); },
  boom() { noise(1, 1600, 50, 1); tone(95, 26, .9, 1); },
  pick() { tone(520, 880, .12, .25, 'triangle'); setTimeout(() => tone(780, 1170, .14, .25, 'triangle'), 90); },
  click() { tone(760, 520, .05, .12, 'square'); },
  splash() { const n = performance.now(); if (n - (sfx._sp || 0) < 120) return; sfx._sp = n; noise(.28, 2400, 500, .16, 'bandpass'); tone(300, 120, .1, .08); },
  wave() { tone(196, 196, .4, .22, 'sawtooth'); setTimeout(() => tone(262, 262, .5, .22, 'sawtooth'), 280); noise(.6, 500, 120, .15); },
  bossWarn() { for (let i = 0; i < 3; i++) setTimeout(() => { tone(110, 82, .5, .38, 'sawtooth'); noise(.5, 400, 80, .22); }, i * 520); },
  waveClear() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, f * 1.01, .22, .2, 'triangle'), i * 110)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => tone(f, f * .96, .5, .26, 'sawtooth'), i * 260)); },
  record() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => tone(f, f * 1.01, .3, .22, 'triangle'), i * 120)); },
  dive() { noise(.7, 1100, 160, .3); tone(320, 70, .7, .28); setTimeout(() => noise(.3, 700, 300, .12, 'bandpass'), 200); },
  surface() { noise(.5, 300, 1800, .25); tone(120, 340, .4, .22); },
  planes() { tone(180, 520, .9, .3, 'sawtooth'); setTimeout(() => tone(200, 600, .8, .22, 'sawtooth'), 220); noise(1.1, 500, 2600, .22, 'highpass'); },
  clone() { tone(500, 1100, .35, .2, 'triangle'); setTimeout(() => tone(750, 1650, .35, .2, 'triangle'), 110); setTimeout(() => noise(.3, 4000, 1500, .08, 'highpass'), 60); },
  cloneEnd() { tone(900, 180, .5, .22, 'triangle'); noise(.3, 3000, 600, .1, 'highpass'); },
  repair() { tone(440, 660, .15, .22, 'sine'); setTimeout(() => tone(554, 830, .2, .22, 'sine'), 110); },
  shieldUp() { tone(300, 1200, .4, .22, 'sawtooth'); setTimeout(() => tone(900, 1400, .25, .14, 'triangle'), 150); },
  powerup() { [600, 800, 1000].forEach((f, i) => setTimeout(() => tone(f, f * 1.2, .1, .22, 'square'), i * 70)); },
  coin() { tone(1320, 1760, .09, .13, 'triangle'); setTimeout(() => tone(1760, 2100, .14, .13, 'triangle'), 70); },
  alarm() { tone(880, 880, .09, .1, 'square'); setTimeout(() => tone(880, 880, .09, .1, 'square'), 150); }
};
function lowAlarm(dt) {
  const p = G && G.player;
  if (!p || p.dead || state !== 'playing' || !(p.hp < p.max * .3)) { if (G) G.lowT = 0; return; }
  G.lowT = (G.lowT || 0) - dt;
  if (G.lowT <= 0) G.lowT = 1.2; // sem som de alarme
}

/* ---------- água ---------- */
function makeTile(size, o) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  if (o.base) { g.fillStyle = o.base; g.fillRect(0, 0, size, size); }
  const wrap = fn => { for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) { g.save(); g.translate(ox, oy); fn(); g.restore(); } };
  for (let i = 0; i < o.blobs; i++) {
    const x = rand(0, size), y = rand(0, size), r = rand(size * .12, size * .3), light = Math.random() < .5;
    wrap(() => {
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, light ? 'rgba(120,190,200,.07)' : 'rgba(2,12,20,.12)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }
  g.lineCap = 'round'; g.lineWidth = o.lw; g.strokeStyle = o.stroke;
  for (let i = 0; i < o.strokes; i++) {
    const x = rand(0, size), y = rand(0, size), l = rand(10, 28), cy = rand(-5, 5);
    wrap(() => { g.beginPath(); g.moveTo(x - l / 2, y); g.quadraticCurveTo(x, y + cy, x + l / 2, y); g.stroke(); });
  }
  return c;
}
const tile1 = makeTile(256, { base: '#0f3043', blobs: 22, strokes: 46, stroke: 'rgba(190,230,236,.11)', lw: 1.4 });
const tile2 = makeTile(320, { base: null, blobs: 8, strokes: 30, stroke: 'rgba(190,230,236,.07)', lw: 1.2 });
const pat1 = ctx.createPattern(tile1, 'repeat');
const pat2 = ctx.createPattern(tile2, 'repeat');
function drawWater(x, y, w, h, t) {
  try {
    pat1.setTransform(new DOMMatrix().translate(t * 6, t * 2.5));
    pat2.setTransform(new DOMMatrix().translate(-t * 4, t * 5).scale(1.35));
  } catch (e) {}
  ctx.fillStyle = pat1; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = pat2; ctx.fillRect(x, y, w, h);
}

/* ---------- estado ---------- */
let state = 'menu';
let G = null;
let best = 0;
try { best = +localStorage.getItem(KEY_BEST) || 0; } catch (e) {}
const keys = new Set();
const mouse = { x: 0, y: 0, down: false, active: false };
const sticks = { move: null, aim: null };
const used = { move: false, aim: false };

function setState(s) { state = s; document.body.dataset.state = s; }

let hardMode = false, escMode = false, escBest = 0;
const KEY_ESC = 'mar-de-ferro-escolta';
try { escBest = +localStorage.getItem(KEY_ESC) || 0; } catch (e) {}
function newGame() {
  setSeed(Math.floor(Math.random() * 2147483647));
  const st = playerStats();
  G = {
    t: 0, pt: 0, vs: 0, esc: 0, conv: null, hc: hardMode && MP.role !== 'guest', wave: 0, score: 0, kills: 0, coins: 0, queue: [], spawnT: 0, waveClearing: true, interlude: 1.3,
    enemies: [], sharks: [], mines: [], escorts: [], planes: [], missiles: [], balls: [], parts: [], wrecks: [], crates: [], buoys: [], allies: [], texts: [],
    shake: 0, flash: 0, deadT: 0, hpMul: 1, fireScale: 1, aimActive: false,
    camera: { x: 0, y: 0 },
    player: {
      spec: st.spec, max: st.hp, dmg: st.dmg, rel: st.rel, auto: st.auto, cloakAb: st.cloak, airAb: st.air, autoT: 0, autoAim: -Math.PI / 2, cloak: 0, cloakCd: 0, x: 0, y: 0, heading: -Math.PI / 2, speed: 0, vx: 0, vy: 0, aim: -Math.PI / 2,
      admin: st.admin, apow: 'cloak', multi: st.multi, escAb: st.esc, cloneAb: st.clone, surgeAb: st.surge, reaperAb: st.reaper, mslAb: st.msl, chgAb: st.chg, tpdAb: st.tpd, novaAb: st.nova, vgAb: st.vg, phxAb: st.phx, shield: 0, triple: 0,
      hp: st.hp, reload: 0, rapid: 0, dead: false, wakeT: 0, smokeT: 0, hflash: 0, recoil: 0
    }
  };
}

/* ---------- modo Escolta: um navio de carga navega devagar e os inimigos o caçam; se ele afundar, a partida acaba ---------- */
const CONV_SPEC = { len: 108, wid: 34, hp: 0, speed: 42, turn: .55,
  hull: '#3f6f8c', deck: '#dbe7ec', dark: '#1b3445', stroke: '#8fd3e8', accent: '#8fd3e8',
  turrets: [], cabin: { x: -.3, l: 24, w: 22 }, funnel: { x: -.36, r: 5.5 } };
function convInit() {
  if (!G.esc) return;
  const hp = Math.round(650 * (1 + .4 * G.allies.length));
  G.conv = { x: 0, y: -240, heading: -Math.PI / 2, want: -Math.PI / 2, turnT: rand(14, 24), speed: CONV_SPEC.speed, vx: 0, vy: 0, spec: CONV_SPEC,
    hp, max: hp, flash: 0, recoil: 0, aim: -Math.PI / 2, cloak: 0, dead: false, wakeT: 0, smokeT: 0, orbit: 1 };
}
function convUpdate(dt) { // só o anfitrião (ou o solo) move o comboio
  const c = G.conv; if (!c) return;
  c.flash = Math.max(0, c.flash - dt);
  if (c.dead) return;
  c.turnT -= dt;
  if (c.turnT <= 0) { c.turnT = rand(16, 28); c.want += rand(-.9, .9); }
  let ux = Math.cos(c.want), uy = Math.sin(c.want);
  enemyAvoid(c); ux += AVX * 1.5; uy += AVY * 1.5;
  const desired = Math.atan2(uy, ux);
  c.heading += clamp(angDiff(c.heading, desired), -c.spec.turn * dt, c.spec.turn * dt);
  // desacelera quando há inimigos por perto ou quando a escolta ficou para trás
  let near = 1e9;
  for (const q of [G.player].concat(MP.role === 'host' ? G.allies : [])) if (!q.dead) near = Math.min(near, Math.hypot(q.x - c.x, q.y - c.y));
  const foe = G.enemies.some(e => !e.fake && Math.hypot(e.x - c.x, e.y - c.y) < 560);
  const target = c.spec.speed * (foe ? .5 : 1) * (near > 700 ? .35 : 1);
  c.speed += clamp(target - c.speed, -30 * dt, 30 * dt);
  c.vx = Math.cos(c.heading) * c.speed; c.vy = Math.sin(c.heading) * c.speed;
  c.x += c.vx * dt; c.y += c.vy * dt;
  hazShip(c, dt);
  wake(c, dt, c.spec.len, c.spec.wid); damageSmoke(c, dt, c.hp / c.max);
}
function convWreck(c) { G.wrecks.push({ x: c.x, y: c.y, heading: c.heading, spec: c.spec, aim: c.heading, t: 0, vx: c.vx * .3, vy: c.vy * .3 }); G.shake = Math.max(G.shake, 6); }
function convSink(c) { // explosões (o anfitrião as envia aos convidados) e destroços
  explosion(c.x, c.y, 3); setTimeout(() => explosion(c.x + 30, c.y - 20, 2), 220); setTimeout(() => explosion(c.x - 34, c.y + 18, 2), 420);
  convWreck(c); sfx.boom();
}
function hurtConv(dmg, x, y) {
  const c = G.conv; if (!c || c.dead) return;
  c.hp -= dmg; c.flash = .12; sparks(x, y, 7, 190); sfx.hit();
  if (c.hp <= 0) {
    c.hp = 0; c.dead = true; convSink(c);
    banner('Comboio afundado', 'Você escoltou até a onda ' + G.wave);
  }
}
function drawConv(c) {
  if (!c || c.dead) return;
  const L = c.spec.len, Wd = c.spec.wid;
  drawShip(c.x, c.y, c.heading, c.spec, c.heading, { flash: c.flash, recoil: 0 });
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.heading);
  const cols = ['#c8553d', '#d9a441', '#3f8f78', '#4d7fb0'];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
    ctx.fillStyle = cols[(i + j * 2) % 4]; ctx.fillRect(L * (.34 - i * .09) - 4.5, (j ? 1 : -1) * Wd * .18 - 5, 9, 10);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .8; ctx.strokeRect(L * (.34 - i * .09) - 4.5, (j ? 1 : -1) * Wd * .18 - 5, 9, 10);
  }
  ctx.restore();
  const bw = 70, by = c.y - L * .5 - 12, f = clamp(c.hp / c.max, 0, 1);
  ctx.fillStyle = 'rgba(10,31,44,.8)'; ctx.fillRect(c.x - bw / 2 - 1, by - 1, bw + 2, 7);
  ctx.fillStyle = f < .3 ? '#e2552f' : '#8fd3e8'; ctx.fillRect(c.x - bw / 2, by, bw * f, 5);
  ctx.font = '600 ' + (10 / zoom) + 'px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = '#8fd3e8'; ctx.fillText('COMBOIO', c.x, by - 3);
}
function drawConvArrow() { // seta na borda da tela quando o comboio está fora de vista
  const c = G && G.esc && G.conv; if (!c || c.dead || state === 'menu') return;
  const cam = G.camera, m = 30, x = W / 2 + (c.x - cam.x) * zoom, y = H / 2 + (c.y - cam.y) * zoom;
  if (x > -10 && x < W + 10 && y > -10 && y < H + 10) return;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const a = Math.atan2(y - H / 2, x - W / 2), k = Math.min((W / 2 - m) / (Math.abs(Math.cos(a)) || 1e-6), (H / 2 - m) / (Math.abs(Math.sin(a)) || 1e-6));
  const ax = W / 2 + Math.cos(a) * k, ay = H / 2 + Math.sin(a) * k;
  ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = '#8fd3e8'; ctx.globalAlpha = .95;
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-9, -9); ctx.lineTo(-4, 0); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#8fd3e8';
  ctx.fillText('COMBOIO ' + Math.round(Math.hypot(c.x - G.player.x, c.y - G.player.y) / 10) + 'm', ax - Math.cos(a) * 34, ay - Math.sin(a) * 34);
}

/* ---------- partículas e efeitos ---------- */
function addP(o) {
  if (G.parts.length > 700) G.parts.shift();
  o.age = 0; o.vx = o.vx || 0; o.vy = o.vy || 0; o.grow = o.grow || 0; o.drag = o.drag || 0;
  G.parts.push(o);
}
function smoke(x, y, s, vx, vy) {
  addP({ t: 'smoke', x, y, vx: (vx || 0) + rand(-9, 9), vy: (vy || 0) + rand(-9, 9), life: rand(.9, 1.7), size: rand(5, 9) * s, grow: rand(14, 24) * s });
}
function splash(x, y) {
  sfx.splash();
  if (MP.role === 'host' && !MP.mute) evp(['sp', Math.round(x), Math.round(y)]);
  addP({ t: 'ring', x, y, life: .55, size: 2, grow: 70 });
  addP({ t: 'cring', x, y, life: .4, size: 2, grow: 46, w: 1.5, c: '200,230,240' });
  for (let i = 0; i < 8; i++) {
    const a = rand(0, TAU), v = rand(20, 70);
    addP({ t: 'foam', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.4, .8), size: 2, grow: 3, drag: 3 });
  }
}
function sparks(x, y, n, spd) {
  if (MP.role === 'host' && !MP.mute) evp(['p', Math.round(x), Math.round(y), n, spd]);
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = rand(.3, 1) * spd;
    addP({ t: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.25, .6), size: 1.4, drag: 2 });
  }
}
function muzzle(x, y, a, k) {
  if (MP.role === 'host' && !MP.mute) evp(['m', Math.round(x), Math.round(y), +a.toFixed(2), k]);
  addP({ t: 'flash', x, y, life: .14, size: 20 * k });
  addP({ t: 'beam', x, y, a, life: .12, size: 34 * k });
  addP({ t: 'glow', x, y, life: .18, size: 30 * k, c: '255,200,110' });
  for (let i = 0; i < 5; i++) smoke(x + Math.cos(a) * 6, y + Math.sin(a) * 6, .8 * k, Math.cos(a) * 40, Math.sin(a) * 40);
  sparks(x, y, 4, 160);
}
function explosion(x, y, k) {
  if (MP.role === 'host') evp(['x', Math.round(x), Math.round(y), k]);
  for (let i = 0; i < 18 * k; i++) {
    const a = rand(0, TAU), v = rand(15, 120) * k;
    addP({ t: 'fire', x: x + rand(-6, 6), y: y + rand(-6, 6), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.35, .85), size: rand(8, 16) * Math.sqrt(k), drag: 2.5 });
  }
  for (let i = 0; i < 10 * k; i++) {
    const a = rand(0, TAU), v = rand(10, 60);
    addP({ t: 'smoke', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(1.2, 2.4), size: rand(10, 18) * Math.sqrt(k), grow: 22, drag: 1.2 });
  }
  sparks(x, y, 14 * k, 340);
  for (let i = 0; i < 6 * k; i++) {
    const a = rand(0, TAU), v = rand(40, 170);
    addP({ t: 'debris', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.8, 1.6), size: rand(2, 4.5), rot: rand(0, TAU), vr: rand(-8, 8), drag: 1.6 });
  }
  addP({ t: 'ring', x, y, life: .65, size: 6, grow: 170 * k });
  addP({ t: 'flash', x, y, life: .2, size: 46 * k });
  addP({ t: 'glow', x, y, life: .55, size: 80 * Math.sqrt(k), c: '255,150,50' });
  addP({ t: 'cring', x, y, life: .45, size: 4, grow: 240 * k, w: 3, c: '255,205,130' });
  for (let i = 0; i < 6 * k; i++) addP({ t: 'mote', x: x + rand(-12, 12), y: y + rand(-12, 12), vx: rand(-34, 34), vy: rand(-70, -20), life: rand(.9, 1.8), size: rand(1.4, 2.8), c: '255,170,80' });
  addP({ t: 'glow', c: '255,150,60', x, y, life: .55, size: 70 * Math.sqrt(k) });
  addP({ t: 'cring', c: '255,214,150', x, y, life: .45, size: 8, grow: 260 * k, w: 3 });
  G.shake = Math.min(16, G.shake + 5 * k);
}
function cloneFx(x, y, mode, len) {
  if (MP.role === 'host' && !MP.mute) evp(['cl', Math.round(x), Math.round(y), mode, Math.round(len || 96)]);
  const L = len || 96;
  if (mode === 0) {
    addP({ t: 'cring', x, y, life: .6, size: 4, grow: 230, w: 3 });
    addP({ t: 'cring', x, y, life: .42, size: 2, grow: 120, w: 2 });
    addP({ t: 'glow', x, y, life: .55, size: L * .7 });
    for (let i = 0; i < 18; i++) {
      const a = rand(0, TAU), R = rand(60, 110), lf = rand(.35, .55);
      addP({ t: 'mote', x: x + Math.cos(a) * R, y: y + Math.sin(a) * R, vx: -Math.cos(a) * R / lf, vy: -Math.sin(a) * R / lf, life: lf, size: rand(1.6, 3.2) });
    }
  } else {
    addP({ t: 'cring', x, y, life: .5, size: 6, grow: 200, w: 3 });
    addP({ t: 'glow', x, y, life: .45, size: L * .6 });
    for (let i = 0; i < 14; i++) {
      const a = rand(0, TAU), v = rand(40, 160);
      addP({ t: 'shard', x: x + rand(-L * .3, L * .3) * Math.cos(a), y: y + rand(-L * .3, L * .3) * Math.sin(a), vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(.5, .9), size: rand(2.5, 5), rot: rand(0, TAU), vr: rand(-9, 9), drag: 2.2 });
    }
    for (let i = 0; i < 10; i++) addP({ t: 'mote', x: x + rand(-L * .4, L * .4), y: y + rand(-L * .25, L * .25), vx: rand(-15, 15), vy: rand(-40, -10), life: rand(.6, 1.1), size: rand(1.4, 2.6) });
  }
}
function floatText(x, y, str, col) { if (MP.role === 'host' && !MP.mute) evp(['t', Math.round(x), Math.round(y), str, col]); G.texts.push({ x, y, str, col, age: 0, life: 1.1 }); }
function wake(s, dt, len, wid) {
  if (s.speed < 15) return;
  s.wakeT -= dt;
  if (s.wakeT > 0) return;
  s.wakeT = .04 + .06 * (1 - clamp(s.speed / 190, 0, 1));
  const c = Math.cos(s.heading), n = Math.sin(s.heading);
  addP({ t: 'foam', x: s.x - c * len * .46 + rand(-3, 3), y: s.y - n * len * .46 + rand(-3, 3), vx: -c * 8 + rand(-6, 6), vy: -n * 8 + rand(-6, 6), life: rand(1, 1.5), size: wid * .22, grow: wid * .55 });
  if (s.speed > 90 && (s.bowFlip = !s.bowFlip)) for (const sd of [-1, 1]) addP({ t: 'foam', x: s.x + c * len * .4 - n * sd * wid * .32, y: s.y + n * len * .4 + c * sd * wid * .32, vx: -c * 22 - n * sd * 16, vy: -n * 22 + c * sd * 16, life: rand(.45, .7), size: wid * .1, grow: wid * .22 });
}
function damageSmoke(s, dt, frac) {
  if (frac >= .5) return;
  s.smokeT -= dt;
  if (s.smokeT > 0) return;
  s.smokeT = .08 + frac * .3;
  smoke(s.x + rand(-6, 6), s.y + rand(-6, 6), .8 + (.5 - frac));
  if (frac < .25) addP({ t: 'fire', x: s.x + rand(-5, 5), y: s.y + rand(-5, 5), life: rand(.25, .5), size: rand(4, 8), drag: 2 });
}

/* ---------- ondas ---------- */
const bannerEl = $('banner');
function banner(big, small) {
  if (MP.role === 'host' && !MP.mute) evp(['b', big, small || '']);
  bannerEl.innerHTML = '<b></b><span></span>';
  bannerEl.firstChild.textContent = big;
  bannerEl.lastChild.textContent = small || '';
  bannerEl.classList.remove('show');
  void bannerEl.offsetWidth;
  bannerEl.classList.add('show');
}
function pickType(n) {
  const r = Math.random();
  const bs = n >= 3 ? Math.min(.06 + (n - 3) * .04, .22) : 0;
  const ar = n >= 4 ? Math.min(.05 + (n - 4) * .01, .12) : 0;
  const la = n >= 2 ? Math.min(.06 + (n - 2) * .01, .12) : 0;
  const fr = n >= 2 ? Math.min(.2 + n * .03, .4) : 0;
  let t = bs;
  if (r < t) return 'battle';
  if (r < (t += ar)) return 'blindado';
  if (r < (t += la)) return 'lancha';
  if (r < t + fr) return 'frigate';
  return 'patrol';
}
function startWave() {
  G.wave++;
  misAdd('waves', G.wave, 1);
  const n = G.wave, boss = n % 5 === 0, count = 2 + n * 2;
  G.queue = [];
  for (let i = 0; i < (boss ? Math.ceil(count / 2) : count); i++) G.queue.push(pickType(n));
  if (!boss && n >= 3 && !G.queue.includes('battle') && n % 3 === 0) G.queue.push('battle');
  if (boss) G.queue.unshift('boss');
  G.spawnT = .4;
  G.hpMul = (1 + (n - 1) * .07) * (1 + .3 * G.allies.length);
  G.fireScale = Math.max(.6, 1 - (n - 1) * .035);
  if (G.hc) G.fireScale = Math.max(.4, G.fireScale * .75);
  if (boss) { banner('Onda ' + n + ' · CHEFE' + (G.hc ? ' HARDCORE' : ''), G.hc ? 'Vida x3 e poderes de navio' : 'Um couraçado gigante se aproxima'); sfx.bossWarn(); }
  else { banner('Onda ' + n + (G.hc ? ' · HARDCORE' : G.esc ? ' · ESCOLTA' : ''), G.esc ? 'Proteja o comboio · ' + G.queue.length + ' inimigos' : G.queue.length + ' navios inimigos à vista'); sfx.wave(); }
  checkAch();
  syncSharks();
  if (!MP.role && !G.vs) { let n = 0; while (G.mines.length < mineTarget() && n < 4 && spawnMine()) n++; }
}
function spawnEnemy(type) {
  const p = G.esc && G.conv && !G.conv.dead ? G.conv : G.player;
  const r = Math.hypot(W, H) / zoom / 2 + 90;
  const a = rand(0, TAU);
  const x = p.x + Math.cos(a) * r, y = p.y + Math.sin(a) * r;
  const s = SPEC[type], toP = Math.atan2(p.y - y, p.x - x), hm = (G.hc ? (type === 'boss' ? 3 : 1.6) : 1) * (G.enemyMul || ENEMY_HP_MUL);
  G.enemies.push({
    id: ++MP.nid, type, spec: s, x, y, heading: toP, speed: s.speed * .6, vx: 0, vy: 0, aim: toP,
    hp: s.hp * G.hpMul * hm, max: s.hp * G.hpMul * hm, fireT: rand(1.2, 2.8), orbit: Math.random() < .5 ? 1 : -1,
    orbitT: rand(6, 12), phase: rand(0, TAU), flash: 0, wakeT: 0, smokeT: 0, recoil: 0
  });
  if (G.hc) hcGivePower(G.enemies[G.enemies.length - 1]);
}
/* ---------- modo hardcore: inimigos usam os poderes dos navios ---------- */
const HC_POWERS = ['cruzador', 'submarino', 'tridente', 'espelho', 'furia'];
const HC_NAMES = { cruzador: 'TORRE', submarino: 'SUBMERSO', tridente: 'TRIPLO', espelho: 'CLONE', furia: 'FÚRIA' };
function hcGivePower(e) {
  const ch = { boss: 1, battle: .8, blindado: .55, frigate: .5, patrol: .3, lancha: .12 }[e.type] || 0;
  e.cloak = 0; e.rapid = 0; e.shield = 0;
  if (Math.random() >= ch) return;
  e.pw = HC_POWERS[Math.floor(Math.random() * HC_POWERS.length)];
  e.pwT = rand(3, 8); e.autoT = 1;
}
function hcClone(e) {
  if (G.enemies.length > 24 || G.enemies.some(z => z.src === e)) return;
  const a = e.heading + Math.PI / 2, cx = e.x + Math.cos(a) * 110, cy = e.y + Math.sin(a) * 110, hp = Math.max(1, e.max * .4);
  G.enemies.push({ id: ++MP.nid, type: e.type, spec: e.spec, x: cx, y: cy, heading: e.heading, speed: e.speed, vx: 0, vy: 0, aim: e.aim, hp, max: hp,
    fireT: rand(1, 2), orbit: -e.orbit, orbitT: rand(6, 12), phase: rand(0, TAU), flash: 0, wakeT: 0, smokeT: 0, recoil: 0, fake: 1, src: e, life: 25, cloak: 0, rapid: 0, shield: 0 });
  cloneFx(cx, cy, 0, e.spec.len); floatText(e.x, e.y - 30, 'clone', '#ff9a7a'); sfx.clone();
}
function hcUpdate(e, dt) {
  if (e.cloak > 0) e.cloak -= dt;
  if (e.rapid > 0) e.rapid -= dt;
  if (e.shield > 0) e.shield -= dt;
  if (e.fake) { e.life -= dt; if (e.life <= 0 || !G.enemies.includes(e.src)) e.expire = 1; }
  if (!e.pw) return;
  const p = enemyTarget(e), d = Math.hypot(p.x - e.x, p.y - e.y), pw = e.pw;
  e.pwT -= dt;
  if (pw === 'cruzador') {
    e.autoT -= dt;
    if (e.autoT <= 0 && !p.dead && p.cloak <= 0 && !(e.cloak > 0) && d < 560 && (onScreen(e, 50) || (MP.role === 'host' && G.allies.some(q => Math.hypot(e.x - q.x, e.y - q.y) < 520)))) {
      const a = Math.atan2(p.y + (p.vy || 0) * d / 380 - e.y, p.x + (p.vx || 0) * d / 380 - e.x) + rand(-.08, .08);
      G.balls.push({ own: 'e', x: e.x + Math.cos(a) * 14, y: e.y + Math.sin(a) * 14, vx: Math.cos(a) * 380, vy: Math.sin(a) * 380, life: 1.6, dmg: Math.max(1, Math.round(e.spec.dmg * .6)), trail: 0 });
      e.autoT = 1.3; sfx.enemy();
    }
  } else if (e.pwT <= 0 && d < 650) {
    if (pw === 'submarino') { e.cloak = 6; e.pwT = rand(16, 22); floatText(e.x, e.y - 30, 'submerso', '#8aa3ab'); sfx.dive(); }
    else if (pw === 'furia') { e.rapid = 7; e.shield = 4; e.pwT = rand(15, 20); floatText(e.x, e.y - 30, 'sobrecarga', '#e2552f'); sfx.shieldUp(); }
    else if (pw === 'espelho') { hcClone(e); e.pwT = rand(20, 28); }
    else e.pwT = 99;
  }
}
function anyAlive() { return !G.player.dead || (MP.role === 'host' && G.allies.some(a => !a.dead)); }
function mpWaveClear() {
  if (MP.role !== 'host' || !G.allies.length) return;
  const p = G.player;
  for (const q of G.allies) {
    if (!q.dead) q.hp = Math.min(q.max, q.hp + q.max * .2);
    else if (!p.dead) { q.dead = false; q.hp = q.max * .4; q.x = p.x + 70; q.y = p.y; q.speed = 0; q.vx = q.vy = 0; q.cloak = 0; evp(['r', q.pid, Math.round(q.x), Math.round(q.y)]); }
  }
  const s = G.allies.find(a => !a.dead);
  if (p.dead && s) { p.dead = false; p.hp = p.max * .4; p.x = s.x + 70; p.y = s.y; p.speed = 0; p.vx = p.vy = 0; p.cloak = 0; G.deadT = 0; MP.mute = 1; banner('De volta ao mar', 'Seu aliado te resgatou'); MP.mute = 0; }
}
function runWaves(dt) {
  const p = G.player;
  if (G.waveClearing) {
    G.interlude -= dt;
    if (G.interlude <= 0 && anyAlive()) { G.waveClearing = false; startWave(); }
    return;
  }
  const cap = Math.min(4 + Math.floor(G.wave / 2), 9);
  if (G.queue.length && G.enemies.length < cap) {
    G.spawnT -= dt;
    if (G.spawnT <= 0) { spawnEnemy(G.queue.shift()); G.spawnT = rand(.8, 1.8); }
  } else if (!G.queue.length && !G.enemies.length && anyAlive()) {
    G.waveClearing = true; G.interlude = 3.2;
    if (!p.dead) p.hp = Math.min(p.max, p.hp + p.max * .2);
    if (G.esc && G.conv && !G.conv.dead) G.conv.hp = Math.min(G.conv.max, G.conv.hp + G.conv.max * .25);
    mpWaveClear();
    addCoins(15 * G.wave);
    banner('Onda superada', '+20% de casco · ' + (G.esc ? 'comboio +25% · ' : '') + '+' + 15 * G.wave + ' moedas'); sfx.waveClear();
  }
}

/* ---------- jogador ---------- */
function onScreen(e, m) {
  const c = G.camera;
  return Math.abs(e.x - c.x) * zoom < W / 2 + m && Math.abs(e.y - c.y) * zoom < H / 2 + m;
}
var assistD = 0;
function assistAim(a) {
  const p = G.player;
  let best = null, bd = 1e9; assistD = 0;
  const k = touchMode ? 1 : .7;
  for (const e of G.enemies) {
    const dx = e.x - p.x, dy = e.y - p.y, dist = Math.hypot(dx, dy);
    if (dist > RANGE * 1.05) continue;
    const lead = dist / BALL_V * .8;
    const ta = Math.atan2(e.y + e.vy * lead - p.y, e.x + e.vx * lead - p.x);
    const tol = (Math.atan2(e.spec.wid * 1.6 + 14, dist) + .05) * k;
    const dd = Math.abs(angDiff(a, ta));
    if (dd < tol && dd < bd) { bd = dd; best = ta; assistD = dist; }
  }
  return best == null ? a : best;
}
function gatherInput() {
  const p = G.player;
  let ix = 0, iy = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iy -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iy += 1;
  let mag = Math.hypot(ix, iy), ang = p.heading;
  if (mag > 0) { ang = Math.atan2(iy, ix); mag = 1; }
  const ms = sticks.move;
  if (ms && ms.mag > .16) { ang = Math.atan2(ms.vy, ms.vx); mag = ms.mag; }
  let aim = null, fire = false, fd = 0;
  const as = sticks.aim;
  if (as && as.mag > .14) { aim = Math.atan2(as.vy, as.vx); fire = as.mag > .35; fd = 60 + as.mag * (RANGE - 60); }
  else if (!touchMode && mouse.active) {
    const mx = G.camera.x + (mouse.x - W / 2) / zoom, my = G.camera.y + (mouse.y - H / 2) / zoom;
    aim = Math.atan2(my - p.y, mx - p.x);
    fire = mouse.down; fd = Math.hypot(mx - p.x, my - p.y);
  }
  if (keys.has('Space')) fire = true;
  if (aim != null) { aim = assistAim(aim); if (assistD > 0) fd = assistD; }
  return { mag, ang, aim, fire, fd };
}
function stepPlayer(dt, inp) {
  const p = G.player, s = p.spec;
  let target = 0;
  if (p.charge > 0) { p.charge -= dt; p.shield = Math.max(p.shield || 0, .25); if (!(inp.mag > 0)) inp = Object.assign({}, inp, { mag: 1, ang: p.heading }); }
  if (p.novaC > 0) { p.novaC = Math.min(3, p.novaC + dt); if (p.novaC >= 3) novaRelease(p); }
  if (inp.mag > 0) {
    const d = angDiff(p.heading, inp.ang);
    const tr = s.turn * dt * (.45 + .55 * clamp(p.speed / s.speed, 0, 1));
    p.heading += clamp(d, -tr, tr);
    target = s.speed * inp.mag * (Math.abs(d) > 1.8 ? .55 : 1) * (p.charge > 0 ? 2.1 : p.novaC > 0 ? .6 : 1);
  }
  p.speed += clamp(target - p.speed, -70 * dt, (p.charge > 0 ? 260 : 85) * dt);
  p.vx = Math.cos(p.heading) * p.speed; p.vy = Math.sin(p.heading) * p.speed;
  p.x += p.vx * dt; p.y += p.vy * dt;
  const want = inp.aim == null ? p.heading : inp.aim;
  if (inp.aim != null && inp.fd > 0) p.aimDist = inp.fd;
  p.aim += clamp(angDiff(p.aim, want), -6 * dt, 6 * dt);
  p.reload -= dt; p.recoil = Math.max(0, p.recoil - dt * 6); p.hflash = Math.max(0, p.hflash - dt);
  if (p.rapid > 0) p.rapid -= dt;
  if (p.shield > 0) p.shield -= dt;
  if (p.triple > 0) p.triple -= dt;
  if (p.cloak > 0) { p.cloak -= dt; if (p.cloak <= 0) sfx.surface(); }
  if (p.cloakCd > 0) p.cloakCd -= dt;
  if (p.auto) autoGun(dt);
  if (inp.fire && p.reload <= 0 && Math.abs(angDiff(p.aim, want)) < .16 && p.cloak <= 0 && !(p.novaC > 0)) playerFire();
  wake(p, dt, s.len, s.wid);
  damageSmoke(p, dt, p.hp / p.max);
}
function shotCount(multi, triple) { return multi >= 3 ? (triple > 0 ? 5 : 3) : (triple > 0 ? 3 : 1); }
function fan(n) { const o = []; for (let i = 0; i < n; i++) o.push((i - (n - 1) / 2) * .13); return o; }
/* cada torreta atira do próprio cano. n = tiros por salva (leque); se houver mais torretas que tiros, cada torreta atira e o dano é dividido */
function vsFoe(pid) { const f = (pid || 0) === 0 ? G.allies[0] : G.player; return f && !f.dead && !(f.cloak > 0) ? f : null; }
function vsMark(n0, pid) { if (G.vs && (pid || 0) !== 0) for (let i = n0; i < G.balls.length; i++) G.balls[i].vs = 1; }
function turretShots(o, a, n, dmg, vel, life, own, ang, fd) {
  const T = o.spec.turrets, L = o.spec.len, shots = Math.max(n, T.length), f = n > 1 ? fan(n) : [0];
  const d1 = n >= T.length ? dmg : Math.max(1, Math.round(dmg * n / T.length)), out = [];
  for (let k = 0; k < shots; k++) {
    const t = T[k % T.length], b0 = a + (n >= T.length ? f[k] : 0) + (ang ? rand(-ang, ang) : 0);
    const bx = o.x + Math.cos(o.heading) * t.x * L, by = o.y + Math.sin(o.heading) * t.x * L;
    const D = fd > 0 ? clamp(fd, 40, RANGE) : 0, b = D ? Math.atan2(o.y + Math.sin(b0) * D - by, o.x + Math.cos(b0) * D - bx) : b0;
    const mx = bx + Math.cos(b) * (t.bl + 2), my = by + Math.sin(b) * (t.bl + 2);
    G.balls.push({ own, x: mx, y: my, vx: Math.cos(b) * vel, vy: Math.sin(b) * vel, life, dmg: d1, trail: 0 });
    out.push([mx, my, b]);
  }
  return out;
}
function playerFire() {
  const p = G.player, a = p.aim + rand(-.012, .012), n = shotCount(p.multi || 1, p.triple);
  if (MP.role === 'guest') {
    const t0 = p.spec.turrets[0], mx = p.x + Math.cos(p.heading) * t0.x * p.spec.len + Math.cos(a) * t0.bl, my = p.y + Math.sin(p.heading) * t0.x * p.spec.len + Math.sin(a) * t0.bl;
    mpSend({ t: 'f', i: MP.pid, x: Math.round(mx), y: Math.round(my), a: +a.toFixed(3), n, d: Math.round(p.aimDist || 380) });
    for (const t of p.spec.turrets) muzzle(p.x + Math.cos(p.heading) * t.x * p.spec.len + Math.cos(a) * t.bl, p.y + Math.sin(p.heading) * t.x * p.spec.len + Math.sin(a) * t.bl, a, 1);
  } else {
    const n0 = G.balls.length;
    for (const m of turretShots(p, a, n, Math.round(p.dmg * vgMul(p)), BALL_V, RANGE / BALL_V, 'p', 0, p.aimDist || 380)) muzzle(m[0], m[1], m[2], 1);
    if (p.reaperAb) for (let i = n0; i < G.balls.length; i++) G.balls[i].rp = 1;
    if (p.mslAb) for (let i = n0; i < G.balls.length; i++) G.balls[i].hm = 1;
    if (p.tpdAb) for (let i = n0; i < G.balls.length; i++) G.balls[i].pr = new Set();
  }
  p.reload = p.rel * (p.rapid > 0 ? .47 : 1);
  p.speed = Math.max(0, p.speed - 6); p.recoil = 1;
  if (MP.role === 'host') evp(['k', 'c']);
  G.shake = Math.min(16, G.shake + 2);
  sfx.cannon();
}
function hurtPlayer(dmg, x, y) {
  const p = G.player;
  if (p.shield > 0) { sparks(x, y, 6, 160); sfx.hit(); return; }
  if (cfg.vib && navigator.vibrate) { try { navigator.vibrate(40); } catch (e) {} }
  p.hp -= dmg; p.hflash = .15; G.flash = Math.min(.6, G.flash + .35);
  { const L = G.hits || (G.hits = []); L.push({ a: Math.atan2(y - p.y, x - p.x), t0: performance.now() }); if (L.length > 8) L.shift(); }
  G.shake = Math.min(16, G.shake + 4);
  sparks(x, y, 8, 220);
  sfx.hurt();
  if (p.hp <= 0) { if (p.phxAb && !p.phxUsed) phoenix(p); else killPlayer(); }
}
var hitA = null;
const MAXP = 4, BUOY_R = 110, BUOY_LIFE = 25, BUOY_T = 3;
function allyBy(pid) { return G.allies.find(a => a.pid === pid); }
function playerBy(pid) { return pid === 0 ? G.player : allyBy(pid); }
function dropBuoy(who, x, y) { if (G.noBuoy) return; if (!G.buoys.some(b => b.who === who)) G.buoys.push({ who, x, y, life: BUOY_LIFE, prog: 0, t: 0, mine: who === 0 }); }
function stepBuoys(dt) {
  const all = [G.player].concat(G.allies);
  for (let i = G.buoys.length - 1; i >= 0; i--) {
    const b = G.buoys[i], vic = playerBy(b.who);
    b.t += dt; b.life -= dt;
    if (!vic || !vic.dead || b.life <= 0) { G.buoys.splice(i, 1); continue; }
    const inside = all.some(r => r !== vic && !r.dead && Math.hypot(r.x - b.x, r.y - b.y) < BUOY_R);
    b.prog = inside ? b.prog + dt : Math.max(0, b.prog - dt * 1.5);
    if (b.prog >= BUOY_T) {
      vic.dead = false; vic.hp = vic.max * .4; vic.x = b.x; vic.y = b.y; vic.speed = 0; vic.vx = vic.vy = 0; vic.cloak = 0;
      if (b.who !== 0) evp(['r', b.who, Math.round(b.x), Math.round(b.y)]); else G.deadT = 0;
      MP.mute = 1; banner(b.who === 0 ? 'De volta ao mar' : (vic.nome || 'Aliado') + ' voltou', b.who === 0 ? 'Seu aliado te resgatou' : 'Resgate concluído'); MP.mute = 0;
      sfx.pick(); explosion(b.x, b.y, .8);
      G.buoys.splice(i, 1);
    }
  }
}
function hurtAlly(q, dmg, x, y) {
  if (q.shield > 0) { sparks(x, y, 6, 160); return; }
  q.hp -= dmg; q.hflash = .15; sparks(x, y, 8, 220);
  if (q.hp <= 0) { if (q.shipId === 'fenix' && !q.phxUsed) phoenix(q); else killAlly(q); }
}
function dropAlly(q, why) {
  MP.guests = MP.guests.filter(g => g.pid !== q.pid);
  G.allies = G.allies.filter(a => a !== q);
  G.buoys = G.buoys.filter(b => b.who !== q.pid);
  if (!q.dead) { explosion(q.x, q.y, 2.6); sfx.boom(); }
  MP.mute = 1; banner((q.nome || 'Aliado') + ' ' + why, G.vs ? 'Vitória por abandono' : 'Você segue com o resto da esquadra'); MP.mute = 0;
}
function killAlly(q) {
  if (!G.vs) dropBuoy(q.pid, q.x, q.y);
  q.dead = true; q.hp = 0; q.speed = 0; q.vx = q.vy = 0; G.deadT = 0;
  explosion(q.x, q.y, 2.6);
  G.wrecks.push({ x: q.x, y: q.y, heading: q.heading, spec: q.spec, aim: q.aim, t: 0, vx: 0, vy: 0 });
  sfx.boom();
  if (G.player.dead || G.vs) return;
  MP.mute = 1; banner((q.nome || 'Seu amigo') + ' foi afundado', G.noBuoy ? 'Ele volta quando a onda acabar' : 'Vá até a boia e fique nela para resgatá-lo'); MP.mute = 0;
}
function stepAllies(dt) {
  for (let i = G.allies.length - 1; i >= 0; i--) {
    const q = G.allies[i];
    q.hflash = Math.max(0, q.hflash - dt); q.recoil = Math.max(0, q.recoil - dt * 6);
    if (q.rapid > 0) q.rapid -= dt;
    if (q.shield > 0) q.shield -= dt;
    if (q.triple > 0) q.triple -= dt;
    if (q.cloak > 0) q.cloak -= dt;
    if (q.cloakCd > 0) q.cloakCd -= dt;
    // Afundado, o convidado não envia posição ('g'); sem isto, lastIn ficava velho e ele era derrubado ao reviver.
    if (q.dead) q.lastIn = performance.now();
    if (!q.dead) {
      q.x += q.vx * dt; q.y += q.vy * dt;
      wake(q, dt, q.spec.len, q.spec.wid); damageSmoke(q, dt, q.hp / q.max);
      if (performance.now() - q.lastIn > 6000) dropAlly(q, 'desconectou');
    }
  }
}
function killPlayer() {
  const p = G.player;
  if (!G.vs && MP.role === 'host' && G.allies.some(a => !a.dead)) { MP.mute = 1; banner('Você foi afundado', G.noBuoy ? 'Aguarde o fim da onda para voltar' : 'Aguarde o resgate na boia (' + BUOY_LIFE + ' s)'); MP.mute = 0; dropBuoy(0, p.x, p.y); }
  if (!G.vs && MP.role === 'guest' && G.allies.some(a => !a.dead)) banner('Você foi afundado', G.noBuoy ? 'Aguarde o fim da onda para voltar' : 'Aguarde o resgate na boia');
  p.dead = true; p.hp = 0; p.speed = 0; p.vx = p.vy = 0; G.deadT = 0;
  explosion(p.x, p.y, 2.6);
  G.wrecks.push({ x: p.x, y: p.y, heading: p.heading, spec: p.spec, aim: p.aim, t: 0, vx: 0, vy: 0 });
  sfx.boom();
}

/* ---------- habilidades dos navios ---------- */
function autoGun(dt) {
  const p = G.player;
  p.autoT -= dt;
  let tgt = null, bd = RANGE * .9;
  const cand = G.vs ? (G.allies[0] && !G.allies[0].dead && !(G.allies[0].cloak > 0) ? [G.allies[0]] : []) : G.enemies;
  for (const e of cand) { const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; tgt = e; } }
  if (!tgt) { p.autoAim += clamp(angDiff(p.autoAim, p.heading), -4 * dt, 4 * dt); return; }
  const lead = bd / BALL_V * .8;
  const want = Math.atan2(tgt.y + tgt.vy * lead - p.y, tgt.x + tgt.vx * lead - p.x);
  p.autoAim += clamp(angDiff(p.autoAim, want), -7 * dt, 7 * dt);
  if (p.autoT <= 0 && Math.abs(angDiff(p.autoAim, want)) < .12) {
    const a = p.autoAim, ox = p.x + Math.cos(p.heading) * p.spec.len * .1, oy = p.y + Math.sin(p.heading) * p.spec.len * .1;
    const mx = ox + Math.cos(a) * 14, my = oy + Math.sin(a) * 14;
    if (MP.role === 'guest') mpSend({ t: 'f', i: MP.pid, u: 1, x: Math.round(mx), y: Math.round(my), a: +a.toFixed(3) });
    else G.balls.push({ own: 'p', x: mx, y: my, vx: Math.cos(a) * BALL_V, vy: Math.sin(a) * BALL_V, life: RANGE * .9 / BALL_V, dmg: Math.round(p.dmg * .5), trail: 0 });
    p.autoT = 1 * (p.rapid > 0 ? .47 : 1);
    muzzle(mx, my, a, .6); sfx.enemy();
  }
}
const PLANE = [[14, 0], [4, -2.5], [0, -15], [-5, -15], [-5, -3], [-11, -6], [-14, -6], [-14, 0]];
function planePath() {
  ctx.beginPath(); ctx.moveTo(PLANE[0][0], PLANE[0][1]);
  for (let i = 1; i < PLANE.length; i++) ctx.lineTo(PLANE[i][0], PLANE[i][1]);
  for (let i = PLANE.length - 2; i >= 1; i--) ctx.lineTo(PLANE[i][0], -PLANE[i][1]);
  ctx.closePath();
}
function summonPlanes(who) {
  const p = who || G.player, r = Math.hypot(W, H) / zoom / 2 + 80, base = rand(0, TAU);
  for (let i = 0; i < 5; i++) {
    const a = base + (i - 2) * .22;
    G.planes.push({ pid: p.pid || 0, x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, h: a + Math.PI, v: 480, tgt: null, retarget: 0, life: 10, trail: 0 });
  }
  banner('Ataque aéreo', '5 aviões a caminho');
  sfx.planes();
}
function summonEscort(o, multi) {
  const pid = o === G.player ? 0 : o.pid;
  if (!multi) G.escorts = G.escorts.filter(z => z.pid !== pid || z.clone);
  const a = o.heading + Math.PI / 2, x = o.x + Math.cos(a) * 90, y = o.y + Math.sin(a) * 90;
  G.escorts.push({ pid, sa: multi ? rand(0, TAU) : Math.PI / 2, so: multi ? rand(80, 150) : 100, x, y, heading: o.heading, aim: o.heading, hp: 120, max: 120, life: ESC_LIFE, reload: .6, flash: 0, recoil: 0, vx: 0, vy: 0, speed: 0, spec: ESC_SPEC, wakeT: 0, smokeT: 0 });
  splash(x, y); floatText(o.x, o.y - 30, 'escolta', '#4fd1a5'); tone(260, 420, .5, .3);
  if (MP.role === 'host') evp(['sp', Math.round(x), Math.round(y)]);
}
const CLONE_SLOTS = [Math.PI / 2, -Math.PI / 2, Math.PI];
const cloneAng = k => k < 3 ? CLONE_SLOTS[k] : k * 1.1, cloneOff = k => 130 + 38 * Math.floor(k / 3);
function summonClone(o, unl) {
  const pid = o === G.player ? 0 : o.pid;
  const mine = G.escorts.filter(z => z.clone && z.pid === pid);
  if (!unl && mine.length >= CLONE_MAX) return;
  let slot = 0; while (mine.some(z => z.slot === slot)) slot++;
  const a = o.heading + cloneAng(slot), x = o.x + Math.cos(a) * cloneOff(slot), y = o.y + Math.sin(a) * cloneOff(slot);
  const hp = Math.round(o.max * .7);
  G.escorts.push({ pid, slot, clone: true, shipId: o === G.player ? effShipId() : o.shipId, x, y, heading: o.heading, aim: o.aim, hp, max: hp, dmg: Math.max(1, Math.round((o.dmg || 20) * .8)), rel: Math.max(.4, (o.rel || .6) * 1.25),
    life: CLONE_LIFE, reload: .6, flash: 0, recoil: 0, vx: 0, vy: 0, speed: 0, cloak: 0, spec: o.spec, wakeT: 0, smokeT: 0 });
  splash(x, y); cloneFx(x, y, 0, o.spec.len); floatText(o.x, o.y - 30, 'clone', '#7fe3ff'); sfx.clone();
  if (MP.role === 'host') evp(['sp', Math.round(x), Math.round(y)]);
}
function updateEscorts(dt) {
  for (let i = G.escorts.length - 1; i >= 0; i--) {
    const z = G.escorts[i], o = z.pid === 0 ? G.player : allyBy(z.pid);
    z.life -= dt; z.flash = Math.max(0, z.flash - dt); z.recoil = Math.max(0, z.recoil - dt * 6); z.reload -= dt;
    if (!o || o.dead || z.life <= 0 || z.hp <= 0) {
      if (z.clone) cloneFx(z.x, z.y, 1, z.spec.len);
      if (z.clone && z.hp > 0) sfx.cloneEnd();
      else { explosion(z.x, z.y, 1.2); sfx.boom(); }
      G.escorts.splice(i, 1); continue;
    }
    if (z.clone) {
      z.fxT = (z.fxT || 0) - dt;
      if (z.fxT <= 0) {
        z.fxT = .06;
        if (z.speed > 30) addP({ t: 'ghost', x: z.x, y: z.y, h: z.heading, len: z.spec.len, wid: z.spec.wid, life: .4 });
        if (Math.random() < .5) { const a = rand(0, TAU), r = rand(0, z.spec.len * .4); addP({ t: 'mote', x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r * .6, vx: rand(-6, 6), vy: rand(-26, -10), life: rand(.5, .9), size: rand(1.2, 2.2) }); }
      }
    }
    const off = z.clone ? cloneOff(z.slot || 0) : (z.so || 100), side = o.heading + (z.clone ? cloneAng(z.slot || 0) : (z.sa === undefined ? Math.PI / 2 : z.sa)), tx = o.x + Math.cos(side) * off, ty = o.y + Math.sin(side) * off, d = Math.hypot(tx - z.x, ty - z.y);
    const want = d > 25 ? Math.atan2(ty - z.y, tx - z.x) : o.heading;
    z.heading += clamp(angDiff(z.heading, want), -(z.clone ? z.spec.turn : 2.4) * dt, (z.clone ? z.spec.turn : 2.4) * dt);
    z.speed = clamp(d * 2.2, 0, z.clone ? o.spec.speed * 1.1 : 210); z.vx = Math.cos(z.heading) * z.speed; z.vy = Math.sin(z.heading) * z.speed;
    z.x += z.vx * dt; z.y += z.vy * dt; hazShip(z, dt);
    let tgt = null, bd = 560;
    for (const e of (G.vs ? [vsFoe(z.pid)].filter(Boolean) : G.enemies)) { const dd = Math.hypot(e.x - z.x, e.y - z.y); if (dd < bd) { bd = dd; tgt = e; } }
    if (tgt) {
      const lead = bd / BALL_V * .7, w2 = Math.atan2(tgt.y + tgt.vy * lead - z.y, tgt.x + tgt.vx * lead - z.x);
      z.aim += clamp(angDiff(z.aim, w2), -5 * dt, 5 * dt);
      if (z.reload <= 0 && Math.abs(angDiff(z.aim, w2)) < .15) {
        const a = z.aim;
        const n0 = G.balls.length;
        for (const m of turretShots(z, a, 1, z.dmg || 16, BALL_V, RANGE * .9 / BALL_V, 'p', 0, bd)) muzzle(m[0], m[1], m[2], .6);
        vsMark(n0, z.pid);
        z.reload = z.rel || 1.1; z.recoil = 1; sfx.enemy();
      }
    } else z.aim += clamp(angDiff(z.aim, z.heading), -5 * dt, 5 * dt);
    wake(z, dt, z.spec.len, z.spec.wid);
  }
}
function updatePlanes(dt) {
  for (let i = G.planes.length - 1; i >= 0; i--) {
    const pl = G.planes[i], TG = G.vs ? [vsFoe(pl.pid)].filter(Boolean) : G.enemies;
    pl.life -= dt * (TG.length ? 1 : 2.5);
    if (pl.tgt && !TG.includes(pl.tgt)) pl.tgt = null;
    pl.retarget -= dt;
    if (!pl.tgt && pl.retarget <= 0) {
      let best = null, bd = 1e9;
      for (const e of TG) {
        const d = Math.hypot(e.x - pl.x, e.y - pl.y) + (G.planes.some(o => o !== pl && o.tgt === e) ? 600 : 0);
        if (d < bd) { bd = d; best = e; }
      }
      pl.tgt = best;
    }
    if (pl.tgt) {
      const e = pl.tgt, d = Math.hypot(e.x - pl.x, e.y - pl.y);
      pl.h += clamp(angDiff(pl.h, Math.atan2(e.y - pl.y, e.x - pl.x)), -(d < 150 ? 7.5 : 4.5) * dt, (d < 150 ? 7.5 : 4.5) * dt);
      if (G.vs && d < 40 + e.spec.len * .3) {
        const dm = Math.round(e.max * .14);
        explosion(pl.x, pl.y, .6); sfx.boom();
        if (e === G.player) hurtPlayer(dm, pl.x, pl.y); else hurtAlly(e, dm, pl.x, pl.y);
        G.planes.splice(i, 1); continue;
      }
      if (!G.vs && d < 40 + e.spec.len * .3) {
        const j = G.enemies.indexOf(e);
        if (j >= 0) { G.enemies.splice(j, 1); e.hp = 0; sinkEnemy(e); }
        pl.tgt = null; pl.retarget = .9;
      }
    }
    pl.x += Math.cos(pl.h) * pl.v * dt; pl.y += Math.sin(pl.h) * pl.v * dt;
    pl.trail -= dt;
    if (pl.trail <= 0) { pl.trail = .03; addP({ t: 'smoke', x: pl.x - Math.cos(pl.h) * 12, y: pl.y - Math.sin(pl.h) * 12, life: .5, size: 2, grow: 6 }); }
    if (pl.life <= 0) G.planes.splice(i, 1);
  }
}
function drawPlane(pl) {
  ctx.save(); ctx.translate(pl.x + 14, pl.y + 22); ctx.rotate(pl.h); ctx.scale(1.3, 1.3);
  ctx.fillStyle = 'rgba(2,10,16,.25)'; planePath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(pl.x, pl.y); ctx.rotate(pl.h); ctx.scale(1.3, 1.3);
  planePath(); ctx.fillStyle = '#c9d8db'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#41575f'; ctx.stroke();
  ctx.beginPath(); ctx.arc(-1, 0, 2.2, 0, TAU); ctx.fillStyle = '#e0a93c'; ctx.fill();
  ctx.restore();
}
function mslTargets(p) {
  return (G.vs ? [vsFoe(p.pid || 0)].filter(Boolean) : G.enemies.filter(e => !(e.cloak > 0))).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).slice(0, 15);
}
/* 15 mísseis saem em leque de 360°; cada um persegue um navio diferente (os mais próximos) */
function summonMissiles(who) {
  const p = who || G.player, T = mslTargets(p);
  if (!T.length) return 0;
  const base = (p.heading || 0) + Math.PI / 5;
  for (let i = 0; i < T.length; i++) {
    const a = base + i * TAU / T.length;
    G.missiles.push({ pid: p.pid || 0, x: p.x + Math.cos(a) * 30, y: p.y + Math.sin(a) * 30, h: a, v: 360, tgt: T[i], life: 12, trail: 0, dmg: Math.round((p.dmg || 20) * 12) });
  }
  floatText(p.x, p.y - 30, T.length + ' mísseis', '#ff7a3d'); sfx.planes();
  return T.length;
}
function updateMissiles(dt) {
  for (let i = G.missiles.length - 1; i >= 0; i--) {
    const m = G.missiles[i], TG = G.vs ? [vsFoe(m.pid)].filter(Boolean) : G.enemies;
    m.life -= dt;
    if (m.tgt && !TG.includes(m.tgt)) m.tgt = null;
    if (!m.tgt) {
      let best = null, bd = 1e9;
      for (const e of TG) {
        if (e.cloak > 0 || G.missiles.some(o => o !== m && o.tgt === e)) continue;
        const d = Math.hypot(e.x - m.x, e.y - m.y); if (d < bd) { bd = d; best = e; }
      }
      m.tgt = best; if (!best) m.life -= dt;
    }
    if (m.tgt) {
      const e = m.tgt, d = Math.hypot(e.x - m.x, e.y - m.y), tr = (d < 260 ? 16 : 9) * dt;
      m.h += clamp(angDiff(m.h, Math.atan2(e.y - m.y, e.x - m.x)), -tr, tr);
      if (d < 52 + e.spec.len * .35) {
        explosion(m.x, m.y, .8); sfx.boom();
        if (G.vs) { const dm = Math.round(e.max * .14); if (e === G.player) hurtPlayer(dm, m.x, m.y); else hurtAlly(e, dm, m.x, m.y); }
        else { if (!(e.shield > 0)) e.hp -= m.dmg; e.flash = .15; if (e.hp <= 0) { const j = G.enemies.indexOf(e); if (j >= 0) G.enemies.splice(j, 1); sinkEnemy(e); } }
        G.missiles.splice(i, 1); continue;
      }
    }
    m.v = Math.min(640, m.v + 340 * dt);
    m.x += Math.cos(m.h) * m.v * dt; m.y += Math.sin(m.h) * m.v * dt;
    m.trail -= dt;
    if (m.trail <= 0) { m.trail = .025; addP({ t: 'smoke', x: m.x - Math.cos(m.h) * 14, y: m.y - Math.sin(m.h) * 14, life: .55, size: 2.5, grow: 7 }); }
    if (m.life <= 0) { explosion(m.x, m.y, .4); G.missiles.splice(i, 1); }
  }
}
function drawMissile(x, y, h, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(h); ctx.scale(s, s);
  ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,150,60,.65)';
  ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(-21 - Math.random() * 4, -2.5); ctx.lineTo(-21 - Math.random() * 4, 2.5); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#8aa3ab'; ctx.fillRect(-10, -6, 5, 12);
  ctx.fillStyle = '#e4eef0'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(5, -3.2); ctx.lineTo(-9, -3.2); ctx.lineTo(-9, 3.2); ctx.lineTo(5, 3.2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e2552f'; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(5, -3.2); ctx.lineTo(5, 3.2); ctx.closePath(); ctx.fill();
  ctx.restore();
}
/* tiros teleguiados do Stormvolt */
function homeBall(b, dt) {
  let best = null, bd = 900;
  for (const e of G.enemies) { if (e.cloak > 0) continue; const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; best = e; } }
  if (best) {
    const v = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx), t = clamp(angDiff(a, Math.atan2(best.y - b.y, best.x - b.x)), -7 * dt, 7 * dt);
    b.vx = Math.cos(a + t) * v; b.vy = Math.sin(a + t) * v;
  }
  b.trail -= dt;
  if (b.trail <= 0) { b.trail = .04; addP({ t: 'smoke', x: b.x - b.vx * .02, y: b.y - b.vy * .02, life: .35, size: 1.8, grow: 5 }); }
}
/* Leviatã: investida com dano de abalroamento */
function updateRam(dt) {
  if (G.vs || MP.role === 'guest') return;
  const now = performance.now();
  for (const o of [G.player].concat(MP.role === 'host' ? G.allies : [])) {
    if (!(o.charge > 0) || o.dead) continue;
    if (o !== G.player) { o.charge -= dt; o.shield = Math.max(o.shield || 0, .25); }
    for (let j = G.enemies.length - 1; j >= 0; j--) {
      const e = G.enemies[j];
      if (e.rm > now || Math.hypot(e.x - o.x, e.y - o.y) > (e.spec.len + o.spec.len) * .38) continue;
      e.rm = now + 450; e.flash = .15; if (!(e.shield > 0)) e.hp -= Math.round((o.dmg || 20) * 8);
      explosion(e.x, e.y, .5); sfx.boom(); G.shake = Math.max(G.shake, 6);
      if (e.hp <= 0) { G.enemies.splice(j, 1); sinkEnemy(e); }
    }
  }
}
/* Barracuda: salva de 5 torpedos que atravessam */
function torpedoSalvo(p) {
  const n0 = G.balls.length;
  for (let i = -2; i <= 2; i++) {
    const a = (p.aim || 0) + i * .18;
    G.balls.push({ own: 'p', x: p.x + Math.cos(a) * 34, y: p.y + Math.sin(a) * 34, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560, life: 1.5, dmg: Math.round((p.dmg || 20) * 4), trail: 0, pr: new Set(), tp: 1 });
  }
  if (G.vs && p !== G.player) for (let i = n0; i < G.balls.length; i++) G.balls[i].vs = 1;
  floatText(p.x, p.y - 30, 'torpedos', '#7fe3ff'); sfx.planes();
}
/* Supernova: tiro gigante carregado */
function novaShot(o, a, f) {
  f = clamp(+f || 0, .2, 1);
  G.balls.push({ own: 'p', x: o.x + Math.cos(a) * 40, y: o.y + Math.sin(a) * 40, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, life: 1.8, dmg: Math.round((o.dmg || 20) * (4 + 16 * f)), trail: 0, pr: new Set(), nova: 1, r: 14 + 40 * f });
  if (G.vs && o !== G.player) G.balls[G.balls.length - 1].vs = 1;
  G.shake = Math.min(16, G.shake + 5); sfx.boom();
}
function novaRelease(p) {
  const f = clamp(p.novaC / 3, .2, 1); p.novaC = 0; p.cloakCd = 25;
  if (MP.role === 'guest') { mpSend({ t: 'nv', i: MP.pid, a: +p.aim.toFixed(3), f: +f.toFixed(2) }); G.shake = Math.min(16, G.shake + 5); sfx.boom(); }
  else novaShot(p, p.aim, f);
}
/* Vingador / Fênix */
const vgMul = o => (o.vgAb || o.shipId === 'vingador') ? 1 + clamp(1 - o.hp / o.max, 0, 1) * 1.5 : 1;
function blast(o, dmg, r, col) {
  explosion(o.x, o.y, 2.2); sfx.boom(); G.shake = Math.min(16, G.shake + 8);
  addP({ t: 'cring', c: col, x: o.x, y: o.y, life: .6, size: 10, grow: r * 1.6, w: 4 });
  if (G.vs) {
    const f = vsFoe(o.pid || 0);
    if (f && Math.hypot(f.x - o.x, f.y - o.y) < r + f.spec.len * .3) { const dm = Math.round(f.max * .2); if (f === G.player) hurtPlayer(dm, o.x, o.y); else hurtAlly(f, dm, o.x, o.y); }
    return;
  }
  for (let j = G.enemies.length - 1; j >= 0; j--) {
    const e = G.enemies[j];
    if (Math.hypot(e.x - o.x, e.y - o.y) > r + e.spec.len * .3) continue;
    if (!(e.shield > 0)) e.hp -= dmg; e.flash = .15;
    if (e.hp <= 0) { G.enemies.splice(j, 1); sinkEnemy(e); }
  }
}
function vgBlast(o) {
  o.hp -= Math.min(Math.round(o.max * .25), Math.max(0, o.hp - 1)); o.hflash = .15;
  blast(o, Math.round((o.dmg || 20) * 10 * vgMul({ vgAb: 1, hp: o.hp, max: o.max })), 380, '255,90,60');
}
function phoenix(o) {
  o.hp = Math.round(o.max * .5); o.phxUsed = 1; o.shield = Math.max(o.shield || 0, 3);
  blast(o, Math.round((o.dmg || 20) * 8), 340, '255,170,60'); floatText(o.x, o.y - 34, 'RENASCEU', '#ffa93c');
}
function surge(q) { q.rapid = 10; q.shield = Math.max(q.shield || 0, 5); floatText(q.x, q.y - 30, 'sobrecarga', '#e2552f'); sfx.shieldUp(); }
const APOW = [['cloak', 'Submersão'], ['air', 'Aviões'], ['surge', 'Sobrecarga'], ['msl', 'Mísseis'], ['clone', 'Clones'], ['esc', 'Escolta'], ['auto', 'Torre auto'], ['hole', 'Buraco negro'], ['meteor', 'Meteoro']];
function admLabel(p) {
  const k = p.apow || 'cloak';
  const t = k === 'cloak' ? (p.cloak > 0 ? 'EMERGIR' : 'SUBMERGIR') : k === 'air' ? 'AVIÕES' : k === 'surge' ? 'SOBRECARGA' : k === 'clone' ? 'CLONE (' + myCloneCount() + ')' : k === 'esc' ? 'ESCOLTA' : k === 'msl' ? 'MÍSSEIS' : k === 'hole' ? (G && G.hole ? 'DESLIGAR BURACO NEGRO' : 'BURACO NEGRO') : k === 'meteor' ? (G && G.meteor ? 'METEORO CAINDO...' : 'METEORO') : (p.auto ? 'TORRE: DESLIGAR' : 'TORRE: LIGAR');
  return touchMode ? t : t + ' · E';
}
function admCycle(dir) {
  const p = G.player; let i = APOW.findIndex(a => a[0] === p.apow); i = (i + (dir || 1) + APOW.length) % APOW.length;
  p.apow = APOW[i][0]; sfx.click();
}
function adminUse() {
  const p = G.player, k = p.apow || 'cloak', g = MP.role === 'guest';
  if (k === 'auto') { p.auto = !p.auto; if (g) mpSend({ t: 'au', i: MP.pid, v: p.auto ? 1 : 0 }); floatText(p.x, p.y - 30, p.auto ? 'torre ligada' : 'torre desligada', '#e0a93c'); sfx.pick(); }
  else if (k === 'cloak') {
    if (p.cloak > 0) { p.cloak = 0; if (g) mpSend({ t: 'c', i: MP.pid, off: 1 }); sfx.surface(); }
    else { p.cloak = 9; if (g) mpSend({ t: 'c', i: MP.pid }); floatText(p.x, p.y - 30, 'submerso', '#8aa3ab'); sfx.dive(); }
  }
  else if (k === 'air') { if (g) { mpSend({ t: 'a', i: MP.pid }); sfx.planes(); } else summonPlanes(); }
  else if (k === 'surge') { if (g) { mpSend({ t: 'u', i: MP.pid }); sfx.shieldUp(); } else surge(p); }
  else if (k === 'clone') { if (g) { mpSend({ t: 'q', i: MP.pid }); sfx.clone(); } else summonClone(p, true); }
  else if (k === 'esc') { if (g) { mpSend({ t: 'z', i: MP.pid }); tone(260, 420, .5, .3); } else summonEscort(p, true); }
  else if (k === 'msl') { if (g) mpSend({ t: 'ms', i: MP.pid }); else summonMissiles(p); }
  else if (k === 'hole') { if (g) mpSend({ t: 'bh', i: MP.pid }); else holeToggle(p); }
  else if (k === 'meteor') { if (g) mpSend({ t: 'mt', i: MP.pid }); else startMeteor(p); }
}
/* ---------- poderes exclusivos do N-77: buraco negro e meteoro ---------- */
const HOLE_PULL = 560, HOLE_FRONT = 380, MET_T = 1.6;
function holeToggle(o) {
  if (!G) return;
  if (G.hole) {
    G.hole = null; if (MP.role === 'host') evp(['bh', 0, 0, 0]);
    floatText(o.x, o.y - 30, 'buraco negro desfeito', '#b44cff'); sfx.surface(); return;
  }
  const x = o.x + Math.cos(o.heading) * HOLE_FRONT, y = o.y + Math.sin(o.heading) * HOLE_FRONT;
  G.hole = { x, y, t: 0, sp: 0 };
  if (MP.role === 'host') evp(['bh', Math.round(x), Math.round(y), 1]);
  floatText(o.x, o.y - 30, 'buraco negro', '#b44cff'); tone(150, 38, 1, .3, 'sawtooth'); tone(90, 30, 1.2, .22, 'sine');
}
function updateHole(dt, fxOnly) {
  const h = G.hole; if (!h) return;
  h.t += dt; h.sp -= dt;
  if (!fxOnly) {
    if (G.player.dead) { G.hole = null; return; }
    for (const e of G.enemies) {
      const dx = h.x - e.x, dy = h.y - e.y, d = Math.hypot(dx, dy);
      if (d < 4) continue;
      const v = Math.min(HOLE_PULL, d * 3 + 40), m = Math.min(v * dt, d);
      e.x += dx / d * m; e.y += dy / d * m;
    }
  }
  if (h.sp <= 0) {
    h.sp = .035;
    const a = rand(0, TAU), r = rand(150, 340), ca = Math.cos(a), sa = Math.sin(a);
    addP({ t: 'mote', x: h.x + ca * r, y: h.y + sa * r, vx: -ca * r * 1.2 - sa * 110, vy: -sa * r * 1.2 + ca * 110, life: rand(.5, .9), size: rand(1.6, 3), c: '190,110,255' });
  }
}
function drawHole(h) {
  const a = Math.min(1, h.t * 2.5), R = 64 * a, t = h.t;
  ctx.save(); ctx.translate(h.x, h.y);
  const g = ctx.createRadialGradient(0, 0, R * .2, 0, 0, R * 3);
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.3, 'rgba(8,0,20,.95)'); g.addColorStop(.55, 'rgba(110,40,190,.35)'); g.addColorStop(1, 'rgba(180,76,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, R * 3, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const rr = R * (1.05 + i * .34), s0 = t * (2.6 - i * .4) * (i % 2 ? -1 : 1);
    ctx.strokeStyle = 'rgba(190,110,255,' + (.6 - i * .1).toFixed(2) + ')'; ctx.lineWidth = 3.2 - i * .4;
    ctx.beginPath(); ctx.arc(0, 0, rr, s0, s0 + Math.PI * 1.2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, rr, s0 + Math.PI, s0 + Math.PI * 1.5); ctx.stroke();
  }
  ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
  ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, R * .66, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(225,170,255,.9)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
function startMeteor(o) {
  if (!G || G.meteor) return;
  const x = o.x + Math.cos(o.heading) * 260, y = o.y + Math.sin(o.heading) * 260;
  G.meteor = { t: 0, x, y, fx: 0 };
  if (MP.role === 'host') evp(['mt', Math.round(x), Math.round(y)]);
  floatText(o.x, o.y - 30, 'meteoro', '#ff9a4a'); tone(1100, 110, MET_T, .22, 'sawtooth');
}
function metPos(m) {
  const k = m.t / MET_T, r = 1 - k * k, D = Math.max(W, H) / zoom * 1.1;
  return [m.x - D * .55 * r, m.y - D * r];
}
function updateMeteor(dt) {
  const m = G.meteor; if (!m) return;
  m.t += dt;
  if (m.t >= MET_T) { G.meteor = null; meteorImpact(m); return; }
  const q = metPos(m);
  for (let i = 0; i < 2; i++) addP({ t: 'fire', x: q[0] + rand(-8, 8), y: q[1] + rand(-8, 8), vx: rand(-30, 30), vy: rand(-30, 30), life: rand(.35, .7), size: rand(10, 22), drag: 2.5 });
  addP({ t: 'smoke', x: q[0], y: q[1], vx: rand(-20, 20), vy: rand(-20, 20), life: rand(.8, 1.4), size: rand(10, 16), grow: 20, drag: 1.2 });
}
function meteorImpact(m) {
  explosion(m.x, m.y, 4.5);
  for (let i = 0; i < 3; i++) addP({ t: 'cring', x: m.x, y: m.y, life: .9 + i * .25, size: 10, grow: 1500 + i * 500, w: 6 - i * 1.5, c: i ? '255,170,80' : '255,230,170' });
  addP({ t: 'flash', x: m.x, y: m.y, life: .5, size: 320 });
  G.flash = 1; G.shake = 16; sfx.boom(); setTimeout(sfx.boom, 140);
  if (MP.role === 'guest') return;
  const list = G.enemies.splice(0);
  for (const e of list) { e.hp = 0; sinkEnemy(e); }
  G.balls = G.balls.filter(b => !(b.own === 'e' || b.vs === 1));
  if (list.length) banner('Meteoro', list.length + (list.length === 1 ? ' navio afundado' : ' navios afundados'));
}
function drawMeteor(m) {
  const k = m.t / MET_T, q = metPos(m);
  ctx.save();
  const sr = 40 + k * 110;
  ctx.globalAlpha = .25 + .35 * k; ctx.fillStyle = '#2a0a05';
  ctx.beginPath(); ctx.arc(m.x, m.y, sr, 0, TAU); ctx.fill();
  ctx.globalAlpha = .5 + .4 * Math.abs(Math.sin(m.t * 12)); ctx.strokeStyle = '#ff5a2a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(m.x, m.y, sr, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
  const R = 14 + k * 34, ang = Math.atan2(m.y - q[1], m.x - q[0]), tl = R * 9;
  ctx.globalCompositeOperation = 'lighter';
  const tg = ctx.createLinearGradient(q[0], q[1], q[0] - Math.cos(ang) * tl, q[1] - Math.sin(ang) * tl);
  tg.addColorStop(0, 'rgba(255,170,70,.85)'); tg.addColorStop(1, 'rgba(255,90,30,0)');
  ctx.strokeStyle = tg; ctx.lineWidth = R * 1.7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[0] - Math.cos(ang) * tl, q[1] - Math.sin(ang) * tl); ctx.stroke();
  const gl = ctx.createRadialGradient(q[0], q[1], R * .3, q[0], q[1], R * 2.4);
  gl.addColorStop(0, 'rgba(255,220,150,.9)'); gl.addColorStop(1, 'rgba(255,100,40,0)');
  ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(q[0], q[1], R * 2.4, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#3a1d12'; ctx.beginPath(); ctx.arc(q[0], q[1], R, 0, TAU); ctx.fill();
  ctx.fillStyle = '#ff9a4a'; ctx.beginPath(); ctx.arc(q[0] + R * .25, q[1] + R * .2, R * .55, 0, TAU); ctx.fill();
  ctx.restore();
}
function useCloak() {
  if (state !== 'playing' || !G) return;
  const p = G.player;
  if (p.admin) { if (!p.dead) adminUse(); return; }
  if (!(p.cloakAb || p.airAb || p.escAb || p.cloneAb || p.surgeAb || p.mslAb || p.novaAb || p.chgAb || p.tpdAb || p.vgAb || p.phxAb) || p.dead || p.cloak > 0 || p.cloakCd > 0) return;
  if (p.vgAb) { if (p.hp <= p.max * .1) return; p.cloakCd = 20; if (MP.role === 'guest') { mpSend({ t: 'vg', i: MP.pid }); sfx.boom(); } else vgBlast(p); return; }
  if (p.phxAb) { p.cloakCd = 25; if (MP.role === 'guest') { mpSend({ t: 'px', i: MP.pid }); sfx.boom(); } else blast(p, Math.round(p.dmg * 8), 340, '255,170,60'); return; }
  if (p.novaAb) { if (p.novaC > 0) novaRelease(p); else { p.novaC = .01; sfx.shieldUp(); } return; }
  if (p.chgAb) { p.cloakCd = 20; p.charge = 8; if (MP.role === 'guest') mpSend({ t: 'ch', i: MP.pid }); floatText(p.x, p.y - 30, 'investida', '#e2552f'); sfx.shieldUp(); return; }
  if (p.tpdAb) { p.cloakCd = 20; if (MP.role === 'guest') { mpSend({ t: 'tp', i: MP.pid, a: +p.aim.toFixed(3) }); sfx.planes(); } else torpedoSalvo(p); return; }
  if (p.mslAb) {
    if (MP.role === 'guest') { if (G.enemies.length || G.vs) { p.cloakCd = 30; mpSend({ t: 'ms', i: MP.pid }); sfx.planes(); } }
    else if (summonMissiles(p)) p.cloakCd = 30;
    return;
  }
  if (p.surgeAb) { p.cloakCd = 30; if (MP.role === 'guest') { mpSend({ t: 'u', i: MP.pid }); sfx.shieldUp(); } else surge(p); return; }
  if (p.cloneAb) { if (myCloneCount() >= CLONE_MAX) return; p.cloakCd = CLONE_CD; if (MP.role === 'guest') { mpSend({ t: 'q', i: MP.pid }); sfx.clone(); } else summonClone(p); return; }
  if (p.escAb) { p.cloakCd = ESC_CD; if (MP.role === 'guest') { mpSend({ t: 'z', i: MP.pid }); tone(260, 420, .5, .3); } else summonEscort(p); return; }
  if (p.airAb) { p.cloakCd = 45; if (MP.role === 'guest') { mpSend({ t: 'a', i: MP.pid }); sfx.planes(); } else summonPlanes(); return; }
  p.cloak = 9; p.cloakCd = 25;
  if (MP.role === 'guest') mpSend({ t: 'c', i: MP.pid });
  floatText(p.x, p.y - 30, 'submerso', '#8aa3ab');
  sfx.dive();
}

/* ---------- inimigos ---------- */
function enemyTarget(e) {
  const a = enemyTargetP(e), cv = G.esc && G.conv;
  if (!cv || cv.dead) return a;
  if (a.dead || a.cloak > 0) return cv;
  return Math.hypot(cv.x - e.x, cv.y - e.y) * .75 < Math.hypot(a.x - e.x, a.y - e.y) ? cv : a;
}
function enemyTargetP(e) {
  const a = G.player, cl = G.escorts.filter(z => z.clone && z.hp > 0);
  if (!cl.length && (MP.role !== 'host' || !G.allies.length)) return a;
  const c = ((MP.role === 'host' ? [a].concat(G.allies) : [a]).filter(x => !x.dead)).concat(cl);
  if (!c.length) return a;
  const vis = c.filter(x => x.cloak <= 0), list = vis.length ? vis : c;
  let best = list[0], bd = 1e18;
  for (const x of list) { const d = Math.hypot(x.x - e.x, x.y - e.y); if (d < bd) { bd = d; best = x; } }
  return best;
}
/* ---------- IA dos inimigos: mira com interceptação, desvio de tiros, evitar icebergs/redemoinhos, linha de visada ---------- */
function interceptAng(ex, ey, tx, ty, tvx, tvy, v) {
  const rx = tx - ex, ry = ty - ey, a = tvx * tvx + tvy * tvy - v * v, b = 2 * (rx * tvx + ry * tvy), c = rx * rx + ry * ry;
  let t = Math.sqrt(c) / v;
  if (Math.abs(a) > 1e-3) {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc), t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
      t = t1 > 0 && t2 > 0 ? Math.min(t1, t2) : t1 > 0 ? t1 : t2 > 0 ? t2 : t;
    }
  } else if (Math.abs(b) > 1e-6 && -c / b > 0) t = -c / b;
  t = clamp(t, 0, 2.5);
  return Math.atan2(ry + tvy * t, rx + tvx * t);
}
function losBlocked(x0, y0, x1, y1) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 30);
  for (let i = 1; i < n; i++) { const t = i / n; if (iceAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true; }
  return false;
}
let AVX = 0, AVY = 0, DGX = 0, DGY = 0;
function enemyAvoid(e) {
  AVX = AVY = 0;
  const s = e.spec, rs = s.wid * .5 + 4, LA = s.len * .9 + e.speed * .9 + 40, hx = Math.cos(e.heading), hy = Math.sin(e.heading), M = LA + 120;
  for (let i = Math.floor((e.x - M) / HZ_CELL); i <= Math.floor((e.x + M) / HZ_CELL); i++)
    for (let j = Math.floor((e.y - M) / HZ_CELL); j <= Math.floor((e.y + M) / HZ_CELL); j++) {
      const c = hzCell(i, j);
      for (const ic of c.ice) {
        const ix = ic.x - e.x, iy = ic.y - e.y, along = ix * hx + iy * hy;
        if (along < -ic.r || along > LA + ic.r) continue;
        const lat = hx * iy - hy * ix, need = ic.r * .9 + rs + 35;
        if (Math.abs(lat) >= need) continue;
        const w = (1 - Math.abs(lat) / need) * (1 - clamp(along / (LA + ic.r), 0, 1) * .6) * 2.4, dir = lat > 0 ? -1 : lat < 0 ? 1 : e.orbit;
        AVX += -hy * dir * w; AVY += hx * dir * w;
      }
      for (const wp of c.wh) {
        const dx = e.x - wp.x, dy = e.y - wp.y, d = Math.hypot(dx, dy), R = wp.r + 70;
        if (d < R && d > 1) { const k = (1 - d / R) * 1.6; AVX += dx / d * k; AVY += dy / d * k; }
      }
    }
}
/* tiros do jogador que vão passar perto do inimigo: devolve quantos e o vetor de desvio em DGX/DGY */
function dodgeCheck(e, sk) {
  DGX = DGY = 0;
  const R = e.spec.len * .3 + e.spec.wid * .5 + 18;
  let n = 0;
  for (const b of G.balls) {
    if (b.own !== 'p') continue;
    const rx = e.x - b.x, ry = e.y - b.y;
    if (rx * rx + ry * ry > 90000) continue;
    const v2 = b.vx * b.vx + b.vy * b.vy, t = (rx * b.vx + ry * b.vy) / v2;
    if (t <= 0 || t > .8 * sk) continue;
    const cx = rx - b.vx * t, cy = ry - b.vy * t;
    if (cx * cx + cy * cy > R * R) continue;
    const vl = Math.sqrt(v2), px = -b.vy / vl, py = b.vx / vl, side = (cx * px + cy * py) >= 0 ? 1 : -1;
    DGX += px * side; DGY += py * side; n++;
  }
  return n;
}
function updateEnemy(e, dt) {
  const p = enemyTarget(e), s = e.spec, hid = p.dead || p.cloak > 0;
  const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1, toP = Math.atan2(dy, dx);
  e.orbitT -= dt;
  if (e.orbitT <= 0) { e.orbit *= -1; e.orbitT = rand(6, 12); }
  let desired, sp = s.speed;
  if (e.type === 'boss') {
    if (!e.enr && e.hp < e.max * .5) { e.enr = 1; floatText(e.x, e.y - 40, 'ENFURECIDO', '#e2552f'); banner('Chefe enfurecido', 'Mais rápido e mais tiros'); sfx.bossWarn(); }
    if (e.enr) sp *= 1.25;
    if (e.summonT === undefined) e.summonT = rand(8, 11);
    e.summonT -= dt;
    if (e.summonT <= 0 && !hid && dist < 900) {
      e.summonT = e.enr ? rand(12, 16) : rand(18, 24);
      if (G.enemies.length < 14) { spawnEnemy('lancha'); spawnEnemy(Math.random() < .5 ? 'patrol' : 'lancha'); floatText(e.x, e.y - 40, 'REFORÇOS', '#ff9a7a'); sfx.alarm(); }
    }
  }
  if (e.slot === undefined) e.slot = rand(0, TAU);
  if (!hid) { e.lx = p.x; e.ly = p.y; e.hasLs = true; }
  const fleeing = !hid && e.type !== 'boss' && e.type !== 'battle' && e.hp < e.max * .28 && dist < s.stand * 1.1;
  if (hid) {
    if (e.hasLs && Math.hypot(e.lx - e.x, e.ly - e.y) < 140) e.hasLs = false;
    if (e.hasLs) { desired = Math.atan2(e.ly - e.y, e.lx - e.x); sp = s.speed * .8; }
    else { desired = e.heading + Math.sin(G.t * .5 + e.phase) * .15; sp = s.speed * .5; }
  }
  else if (fleeing) { desired = toP + Math.PI + e.orbit * .5; sp = s.speed; }
  else if (dist > s.stand * 1.2) {
    const sa = e.slot + G.t * .1 * e.orbit, tx = p.x + Math.cos(sa) * s.stand, ty = p.y + Math.sin(sa) * s.stand;
    desired = Math.atan2(ty - e.y, tx - e.x) + Math.sin(G.t * .6 + e.phase) * .12;
    if (dist > s.stand * 2.2) sp = s.speed * 1.2;
  }
  else if (dist < s.stand * .6) { desired = toP + Math.PI * .8 * e.orbit; sp = s.speed * .9; }
  else { desired = toP + e.orbit * 1.35; sp = s.speed * .7; }
  let ux = Math.cos(desired), uy = Math.sin(desired);
  enemyAvoid(e); ux += AVX; uy += AVY;
  for (const o of G.enemies) {
    if (o === e) continue;
    const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy) || 1, R = (s.len + o.spec.len) * .6 + 30;
    if (od < R) { const k = (1 - od / R) * 1.2; ux += ox / od * k; uy += oy / od * k; }
  }
  const sk = e.sk === undefined ? (e.sk = rand(.35, 1)) : e.sk;
  if (!hid && s.turn >= 1.2 && dodgeCheck(e, sk) > 0) {
    const dl = Math.hypot(DGX, DGY) || 1;
    ux += DGX / dl * 2.6; uy += DGY / dl * 2.6; sp = Math.max(sp, s.speed);
  }
  desired = Math.atan2(uy, ux);
  const tr = s.turn * dt * (.5 + .5 * e.speed / s.speed);
  e.heading += clamp(angDiff(e.heading, desired), -tr, tr);
  e.speed += clamp(sp - e.speed, -60 * dt, 60 * dt);
  e.vx = Math.cos(e.heading) * e.speed; e.vy = Math.sin(e.heading) * e.speed;
  e.x += e.vx * dt; e.y += e.vy * dt;
  e.flash = Math.max(0, e.flash - dt); e.recoil = Math.max(0, e.recoil - dt * 5);

  e.errT = (e.errT === undefined ? 0 : e.errT) - dt;
  if (e.errT <= 0) { e.errT = rand(1, 2); e.err = rand(-1, 1) * clamp(.2 - G.wave * .012, .025, .2) * (G.hc ? .5 : 1); }
  const want = interceptAng(e.x, e.y, p.x, p.y, p.vx || 0, p.vy || 0, s.ball) + (e.err || 0);
  e.aim += clamp(angDiff(e.aim, want), -3.2 * dt, 3.2 * dt);
  e.fireT -= dt;
  if (e.fireT <= 0 && !hid && !(e.cloak > 0) && dist < s.ball * 1.5 && (p === G.conv || onScreen(e, 50) || (MP.role === 'host' && G.allies.some(q => Math.hypot(e.x - q.x, e.y - q.y) < 520))) && Math.abs(angDiff(e.aim, want)) < .14) {
    if (losBlocked(e.x, e.y, p.x, p.y)) { e.orbit *= -1; e.orbitT = rand(5, 9); e.fireT = .35; }
    else { enemyFire(e); e.fireT = s.fire * G.fireScale * (e.rapid > 0 ? .45 : 1) * (e.enr ? .6 : 1) * rand(.85, 1.2); }
  }
  wake(e, dt, s.len, s.wid);
  damageSmoke(e, dt, e.hp / e.max);
  if (G.hc) hcUpdate(e, dt);
}
function enemyFire(e) {
  const s = e.spec, n = (e.pw === 'tridente' ? Math.max(s.volley, 3) : s.volley) + (e.enr ? 2 : 0), T = s.turrets, shots = Math.max(n, T.length), d1 = Math.round((n >= T.length ? s.dmg : Math.max(1, Math.round(s.dmg * n / T.length))) * (G.hc ? 1.3 : 1));
  for (let i = 0; i < shots; i++) {
    const t = T[i % T.length], a = e.aim + (n > 1 ? (i - (n - 1) / 2) * .17 : 0) + rand(-s.spread, s.spread) * .5;
    const mx = e.x + Math.cos(e.heading) * t.x * s.len + Math.cos(a) * (t.bl + 2), my = e.y + Math.sin(e.heading) * t.x * s.len + Math.sin(a) * (t.bl + 2);
    G.balls.push({ own: 'e', x: mx, y: my, vx: Math.cos(a) * s.ball, vy: Math.sin(a) * s.ball, life: 1.7, dmg: d1, trail: 0 });
    muzzle(mx, my, a, .8);
  }
  e.recoil = 1;
  if (MP.role === 'host') evp(['k', 'e', e.id]);
  sfx.enemy();
}
function sinkEnemy(e) {
  if (e.fake) { explosion(e.x, e.y, 1.4); sfx.boom(); return; }
  if (MP.role === 'host') evp(['w', Math.round(e.x), Math.round(e.y), +e.heading.toFixed(2), e.type, +e.aim.toFixed(2)]);
  explosion(e.x, e.y, e.type === 'boss' ? 3.2 : e.type === 'battle' ? 2 : e.type === 'frigate' || e.type === 'blindado' ? 1.4 : 1);
  G.wrecks.push({ x: e.x, y: e.y, heading: e.heading, spec: e.spec, aim: e.aim, t: 0, vx: e.vx * .3, vy: e.vy * .3 });
  G.score += e.spec.score; G.kills++; save.kills++; evtAdd(1, e.type === 'boss' ? 1 : 0); misAdd('kills', 1); misAdd('score', G.score, 1); if (e.type === 'boss') misAdd('boss', 1); if (e.type === 'boss') { save.bosses++; banner('Chefe derrotado', '+' + e.spec.score + ' pontos'); }
  const rp = G.player;
  if (rp && rp.reaperAb && !rp.dead && MP.role !== 'guest') { const hl = Math.round(rp.max * (e.type === 'boss' ? .2 : .08)); rp.hp = Math.min(rp.max, rp.hp + hl); floatText(rp.x, rp.y - 34, '+' + hl + ' casco', '#ff5a5a'); }
  const gain = addCoins(Math.round(e.spec.score / 10 * (G.hc ? 1.5 : 1)));
  floatText(e.x, e.y - 22, '+' + e.spec.score + ' · $' + gain, '#e0a93c'); setTimeout(sfx.coin, 160);
  if (Math.random() < (e.type === 'boss' || e.type === 'battle' ? 1 : e.type === 'blindado' ? .4 : e.type === 'frigate' ? .28 : e.type === 'lancha' ? .08 : .14)) dropCrate(e.x, e.y);
  sfx.boom();
  checkAch();
}
const CRATE_TYPES = ['repair', 'rapid', 'shield', 'triple'];
function dropCrate(x, y) {
  const types = ['repair', 'rapid', 'shield', 'triple'];
  const type = (G.player.hp < G.player.max * .6 && Math.random() < .5) ? 'repair' : types[Math.floor(Math.random() * types.length)];
  const q = iceOut(x, y, 26);
  G.crates.push({ x: q[0], y: q[1], type, life: 15, t: rand(0, TAU) });
}
function separate() {
  const list = G.enemies, p = G.player;
  for (let i = 0; i < list.length; i++) {
    const a = list[i], ra = a.spec.len * .28;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j], min = ra + b.spec.len * .28;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .01;
      if (d < min) { const push = (min - d) / 2, nx = dx / d, ny = dy / d; a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push; }
    }
    if (!p.dead) {
      const min = ra + p.spec.len * .28, dx = p.x - a.x, dy = p.y - a.y, d = Math.hypot(dx, dy) || .01;
      if (d < min) { const push = min - d, nx = dx / d, ny = dy / d; p.x += nx * push * .5; p.y += ny * push * .5; a.x -= nx * push * .5; a.y -= ny * push * .5; }
    }
  }
}

/* ---------- projéteis ---------- */
function hitShip(bx, by, s) {
  const r = s.spec.wid * .55 + 4, L = s.spec.len, c = Math.cos(s.heading), n = Math.sin(s.heading);
  for (const off of [-.3, 0, .3]) {
    const px = s.x + c * L * off, py = s.y + n * L * off;
    if (Math.hypot(bx - px, by - py) < r) return true;
  }
  return false;
}
let hitEs = null;
/* ---------- tubarões (só no modo solo): perseguem o navio e mordem o casco; podem ser afundados a tiros ---------- */
function spawnShark() {
  const p = G.player, a = Math.random() * TAU, r = Math.hypot(W, H) / zoom / 2 + 120, hp = 24 + G.wave * 2;
  G.sharks.push({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r, heading: a + Math.PI, speed: 60, vx: 0, vy: 0, hp, max: hp, len: 58, wid: 16, bite: 1, mode: 'hunt', fleeT: 0, t: 0, flash: 0, wakeT: 0, wig: rand(0, 6) });
}
function syncSharks() {
  if (MP.role || G.vs) return;
  const tgt = clamp(Math.floor((G.wave + 1) / 3), 0, 5) + (G.hc && G.wave >= 2 ? 1 : 0);
  let n = 0; while (G.sharks.length < tgt && n < 6) { spawnShark(); n++; }
  if (n && !G.sharkWarn) { G.sharkWarn = 1; floatText(G.player.x, G.player.y - 56, '🦈 Tubarões!', '#ff6b6b'); }
}
function sharkHit(bx, by, s) {
  const dx = bx - s.x, dy = by - s.y, c = Math.cos(s.heading), n = Math.sin(s.heading), lx = dx * c + dy * n, ly = -dx * n + dy * c;
  return Math.abs(lx) <= s.len / 2 + 4 && Math.abs(ly) <= s.wid / 2 + 6;
}
function sinkShark(s) {
  G.score += 150; save.sharks = (save.sharks || 0) + 1; misAdd('sharks', 1); misAdd('score', G.score, 1);
  explosion(s.x, s.y, .6);
  for (let i = 0; i < 6; i++) addP({ t: 'foam', x: s.x + rand(-10, 10), y: s.y + rand(-10, 10), vx: rand(-30, 30), vy: rand(-30, 30), life: rand(.8, 1.4), size: 5, grow: 12 });
  const gain = addCoins(20);
  floatText(s.x, s.y - 18, '+150 · $' + gain, '#e0a93c'); setTimeout(sfx.coin, 120);
  checkAch();
}
function updateSharks(dt) {
  const p = G.player, tgt = !p.dead && !(p.cloak > 0) ? p : null;
  for (let i = G.sharks.length - 1; i >= 0; i--) {
    const s = G.sharks[i];
    s.t += dt; s.flash = Math.max(0, s.flash - dt); s.bite -= dt;
    let want = s.heading + Math.sin(s.t * .8 + s.wig) * .6, spd = 60;
    if (tgt) {
      const dx = tgt.x - s.x, dy = tgt.y - s.y, d = Math.hypot(dx, dy);
      if (s.mode === 'flee') { want = Math.atan2(-dy, -dx) + Math.sin(s.t * 5) * .5; spd = 190; s.fleeT -= dt; if (s.fleeT <= 0) s.mode = 'hunt'; }
      else {
        want = Math.atan2(dy, dx); spd = d > 300 ? 170 : 215;
        const hx = s.x + Math.cos(s.heading) * s.len * .45, hy = s.y + Math.sin(s.heading) * s.len * .45;
        if (s.bite <= 0 && hitShip(hx, hy, tgt)) {
          s.bite = 1.8; s.mode = 'flee'; s.fleeT = .9;
          hurtPlayer(Math.round(5 + G.wave * .5), hx, hy);
          for (let k = 0; k < 5; k++) addP({ t: 'foam', x: hx + rand(-6, 6), y: hy + rand(-6, 6), vx: rand(-40, 40), vy: rand(-40, 40), life: rand(.5, 1), size: 4, grow: 14 });
        }
      }
      if (d > 1800) { const a = Math.random() * TAU, r = Math.hypot(W, H) / zoom / 2 + 120; s.x = p.x + Math.cos(a) * r; s.y = p.y + Math.sin(a) * r; }
    }
    s.heading += clamp(angDiff(s.heading, want), -3.2 * dt, 3.2 * dt);
    s.speed += (spd - s.speed) * Math.min(1, dt * 3);
    s.vx = Math.cos(s.heading) * s.speed; s.vy = Math.sin(s.heading) * s.speed;
    s.x += s.vx * dt; s.y += s.vy * dt;
    wake(s, dt, s.len, s.wid);
  }
}
function drawShark(s) {
  const L = s.len, Wd = s.wid, t = s.t * 6 + s.wig, spd = .5 + s.speed / 320, amp = Wd * .3 * spd, N = 28, hit = s.flash > 0;
  const sx = u => L * (.5 - u * .8), ow = u => Math.sin(t - u * 5) * amp * Math.pow(u, 1.5);
  /* focinho mais pontudo, tronco robusto até ~26% e afinando suave até o pedúnculo */
  const hw = u => Wd * .54 * (u < .26 ? Math.pow(Math.sin(u / .26 * Math.PI / 2), 1.3) : Math.max(.05, 1 - .95 * Math.pow((u - .26) / .74, 1.3)));
  const bodyPath = () => {
    ctx.beginPath();
    for (let i = 0; i <= N; i++) { const u = i / N; ctx[i ? 'lineTo' : 'moveTo'](sx(u), ow(u) - hw(u)); }
    for (let i = N; i >= 0; i--) { const u = i / N; ctx.lineTo(sx(u), ow(u) + hw(u)); }
    ctx.closePath();
  };
  /* sombra submersa + halo claro de superfície */
  ctx.save(); ctx.translate(s.x + 6, s.y + 9); ctx.rotate(s.heading); ctx.globalAlpha = .26; ctx.fillStyle = '#02101a'; bodyPath(); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.heading); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const dark = hit ? '#e8f6f8' : '#2b434e', mid = hit ? '#f2fbfc' : '#587684', lite = hit ? '#ffffff' : '#c4d8de',
        fin = hit ? '#e8f6f8' : '#37525e', finLite = hit ? '#ffffff' : '#6d8b98', edge = hit ? '#9fb7be' : '#1d2e35';
  /* marola na proa quando acelera */
  if (s.speed > 120) {
    ctx.strokeStyle = 'rgba(220,240,244,.35)'; ctx.lineWidth = 1.1;
    for (const sg of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sx(.0) + 2, ow(0)); ctx.quadraticCurveTo(sx(.1), ow(.1) + sg * Wd * .75, sx(.34), ow(.34) + sg * Wd * 1.05); ctx.stroke(); }
  }
  /* cauda heterocerca: lobo superior maior, entalhe e ponta clara */
  const tx = sx(1), ty = ow(1), ang = Math.cos(t - 5) * .36 * spd;
  ctx.save(); ctx.translate(tx, ty); ctx.rotate(ang);
  const tg = ctx.createLinearGradient(L * .05, 0, -L * .28, 0); tg.addColorStop(0, fin); tg.addColorStop(1, finLite);
  ctx.fillStyle = tg; ctx.strokeStyle = edge; ctx.lineWidth = .9;
  ctx.beginPath(); ctx.moveTo(L * .06, -1.6);
  ctx.quadraticCurveTo(-L * .08, -Wd * .35, -L * .3, -Wd * 1.12);
  ctx.quadraticCurveTo(-L * .2, -Wd * .3, -L * .15, 0);
  ctx.quadraticCurveTo(-L * .2, Wd * .28, -L * .21, Wd * .74);
  ctx.quadraticCurveTo(-L * .08, Wd * .22, L * .06, 1.6);
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = 'rgba(15,28,34,.35)'; ctx.lineWidth = .6; ctx.beginPath(); ctx.moveTo(L * .04, 0); ctx.lineTo(-L * .15, -Wd * .02); ctx.stroke();
  ctx.restore();
  /* peitorais longas em foice e pélvicas */
  const pu = .26, px = sx(pu), py = ow(pu), pw = hw(pu), fl = Math.sin(t * .5) * 1.6;
  for (const sg of [-1, 1]) {
    const fg = ctx.createLinearGradient(px, py, px - L * .26, py + sg * Wd * 1.3); fg.addColorStop(0, fin); fg.addColorStop(1, finLite);
    ctx.fillStyle = fg; ctx.strokeStyle = edge; ctx.lineWidth = .9;
    ctx.beginPath(); ctx.moveTo(px + L * .08, py + sg * pw * .7);
    ctx.quadraticCurveTo(px - L * .02, py + sg * Wd * 1.05, px - L * .3, py + sg * (Wd * 1.45 + fl));
    ctx.quadraticCurveTo(px - L * .14, py + sg * pw * 1.05, px - L * .08, py + sg * pw * .8); ctx.closePath(); ctx.fill(); ctx.stroke();
    const vu = .62; ctx.fillStyle = fin;
    ctx.beginPath(); ctx.moveTo(sx(vu - .03), ow(vu - .03) + sg * hw(vu) * .8);
    ctx.quadraticCurveTo(sx(vu + .03), ow(vu) + sg * Wd * .5, sx(vu + .13), ow(vu + .1) + sg * Wd * .6);
    ctx.lineTo(sx(vu + .06), ow(vu + .06) + sg * hw(vu) * .6); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  /* corpo: dorso escuro, flancos claros */
  const g = ctx.createLinearGradient(0, -Wd * .55, 0, Wd * .55);
  g.addColorStop(0, lite); g.addColorStop(.22, mid); g.addColorStop(.5, dark); g.addColorStop(.78, mid); g.addColorStop(1, lite);
  bodyPath(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = 1.1; ctx.stroke();
  /* brilho molhado ao longo do dorso e linha lateral */
  if (!hit) {
    ctx.save(); bodyPath(); ctx.clip();
    ctx.strokeStyle = 'rgba(190,225,235,.22)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let i = 3; i <= N - 3; i++) { const u = i / N; ctx[i > 3 ? 'lineTo' : 'moveTo'](sx(u), ow(u) - hw(u) * .5); } ctx.stroke();
    ctx.strokeStyle = 'rgba(10,22,28,.28)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 4; i <= N - 2; i++) { const u = i / N; ctx[i > 4 ? 'lineTo' : 'moveTo'](sx(u), ow(u) + hw(u) * .12); } ctx.stroke();
    ctx.restore();
  }
  /* segunda dorsal e anal */
  ctx.fillStyle = fin; ctx.strokeStyle = edge; ctx.lineWidth = .8;
  ctx.beginPath(); ctx.moveTo(sx(.7), ow(.7)); ctx.quadraticCurveTo(sx(.77), ow(.77) - Wd * .28, sx(.86), ow(.86) - Wd * .05); ctx.lineTo(sx(.78), ow(.78) + 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  /* dorsal principal: barbatana alta, inclinada com o balanço */
  const dg = ctx.createLinearGradient(sx(.3), 0, sx(.64), 0); dg.addColorStop(0, hit ? '#cfe3e8' : '#1c2d34'); dg.addColorStop(1, hit ? '#e8f6f8' : '#3d5865');
  ctx.beginPath(); ctx.moveTo(sx(.28), ow(.28) - 1.2);
  ctx.quadraticCurveTo(sx(.38), ow(.38) - Wd * .34, sx(.64), ow(.64) - Wd * .02);
  ctx.quadraticCurveTo(sx(.46), ow(.46) + Wd * .1, sx(.3), ow(.3) + 1.4); ctx.closePath();
  ctx.fillStyle = dg; ctx.fill(); ctx.strokeStyle = edge; ctx.lineWidth = .8; ctx.stroke();
  /* guelras: 5 fendas curvas */
  ctx.strokeStyle = 'rgba(12,24,30,.55)'; ctx.lineWidth = .9;
  for (const sg of [-1, 1]) for (let k = 0; k < 5; k++) { const u = .17 + k * .025, h = hw(u); ctx.beginPath(); ctx.moveTo(sx(u), ow(u) + sg * h * .42); ctx.quadraticCurveTo(sx(u + .012), ow(u) + sg * h * .7, sx(u), ow(u) + sg * h * .9); ctx.stroke(); }
  /* narinas */
  ctx.fillStyle = 'rgba(8,16,20,.7)';
  for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(sx(.045), ow(.045) + sg * hw(.045) * .45, .7, 0, TAU); ctx.fill(); }
  /* boca aberta logo após a mordida: mandíbulas, garganta e dentes */
  if (s.bite > 1.35) {
    const o = Math.min(1, (s.bite - 1.35) / .15);
    ctx.beginPath(); ctx.moveTo(sx(0) + 1, ow(0)); ctx.lineTo(sx(.13), ow(.13) - hw(.13) * .85 * o); ctx.quadraticCurveTo(sx(.16), ow(.16), sx(.13), ow(.13) + hw(.13) * .85 * o); ctx.closePath();
    ctx.fillStyle = '#6a0f1a'; ctx.fill(); ctx.strokeStyle = '#2a0508'; ctx.lineWidth = .8; ctx.stroke();
    ctx.fillStyle = '#f7fbfc';
    for (const sg of [-1, 1]) for (let k = 0; k < 4; k++) {
      const u = .015 + k * .028, yy = ow(u) + sg * hw(u + .02) * .82 * o;
      ctx.beginPath(); ctx.moveTo(sx(u) - 1.1, yy); ctx.lineTo(sx(u) + 1.1, yy); ctx.lineTo(sx(u), yy - sg * 2.4 * o); ctx.closePath(); ctx.fill();
    }
  }
  /* olhos com brilho; vermelhos e incandescentes ao caçar */
  const hunting = s.mode === 'hunt' && s.speed > 150;
  for (const sg of [-1, 1]) {
    const ex = sx(.135), ey = ow(.135) + sg * hw(.135) * .7;
    if (hunting) { ctx.beginPath(); ctx.arc(ex, ey, 3, 0, TAU); ctx.fillStyle = 'rgba(255,60,50,.25)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(ex, ey, 1.5, 0, TAU); ctx.fillStyle = hunting ? '#d32f2f' : '#050d12'; ctx.fill();
    ctx.beginPath(); ctx.arc(ex + .4, ey - sg * .45, .45, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
  }
  ctx.restore();
  if (s.hp < s.max) { const bw = 28; ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(s.x - bw / 2 - 1, s.y - 27, bw + 2, 5); ctx.fillStyle = '#e2552f'; ctx.fillRect(s.x - bw / 2, s.y - 26, bw * clamp(s.hp / s.max, 0, 1), 3); }
}
function updateBalls(dt) {
  const p = G.player;
  for (let i = G.balls.length - 1; i >= 0; i--) {
    const b = G.balls[i];
    b.life -= dt;
    if (b.hm && b.own === 'p' && !G.vs) homeBall(b, dt);
    const steps = Math.max(1, Math.ceil(Math.hypot(b.vx, b.vy) * dt / 10));
    let hit = false;
    for (let st = 0; st < steps && !hit; st++) {
      b.x += b.vx * dt / steps; b.y += b.vy * dt / steps;
      const ih = iceHit(b.x, b.y);
      if (ih) {
        hit = true; sparks(b.x, b.y, 5, 140); sfx.hit(); if (b.own === 'p' && !ih.isl) iceChip(ih, b.x, b.y);
        addP({ t: 'cring', c: '200,235,245', x: b.x, y: b.y, life: .25, size: 3, grow: 50, w: 1.5 });
        continue;
      }
      if (G.vs) {
        const g = b.vs === 1, vq = G.allies[0], tg = g ? p : vq;
        const es = G.escorts.find(z => ((z.pid || 0) === 0) === g && hitShip(b.x, b.y, z));
        if (es) { hit = true; es.hp -= b.dmg; es.flash = .12; sparks(b.x, b.y, 6, 160); }
        else if (tg && !tg.dead && !(tg.cloak > 0) && hitShip(b.x, b.y, tg)) { hit = true; if (g) hurtPlayer(b.dmg, b.x, b.y); else hurtAlly(vq, b.dmg, b.x, b.y); }
        continue;
      }
      if (b.own === 'p') {
        for (let j = G.enemies.length - 1; j >= 0; j--) {
          const e = G.enemies[j];
          if (!(e.cloak > 0) && !(b.pr && b.pr.has(e)) && (hitShip(b.x, b.y, e) || (b.r && Math.hypot(b.x - e.x, b.y - e.y) < b.r + e.spec.wid * .5))) {
            const exe = b.rp && e.hp < e.max * .3; if (!(e.shield > 0)) e.hp -= exe ? Math.round(b.dmg * 1.25) : b.dmg; e.flash = .12; hit = !b.pr; if (b.pr) b.pr.add(e); if (exe) sparks(b.x, b.y, 6, 200);
            sparks(b.x, b.y, 10, 240); G.shake = Math.max(G.shake, Math.min(G.shake + .6, 3)); addP({ t: 'flash', x: b.x, y: b.y, life: .16, size: 20 }); addP({ t: 'cring', c: '255,214,130', x: b.x, y: b.y, life: .22, size: 3, grow: 70, w: 1.5 });
            sfx.hit(); if (MP.role === 'host') evp(['k', 'h']);
            if (e.hp <= 0) { G.enemies.splice(j, 1); sinkEnemy(e); }
            break;
          }
        }
        if (!hit) for (let j = G.sharks.length - 1; j >= 0; j--) {
          const sk = G.sharks[j];
          if (sharkHit(b.x, b.y, sk)) {
            hit = true; sk.hp -= b.dmg; sk.flash = .12; sparks(b.x, b.y, 8, 200); sfx.hit();
            if (sk.hp <= 0) { G.sharks.splice(j, 1); sinkShark(sk); }
            break;
          }
        }
      } else if (!p.dead && p.cloak <= 0 && hitShip(b.x, b.y, p)) {
        hit = true; hurtPlayer(b.dmg, b.x, b.y);
      } else if (MP.role === 'host' && (hitA = G.allies.find(q => !q.dead && q.cloak <= 0 && hitShip(b.x, b.y, q)))) {
        hit = true; hurtAlly(hitA, b.dmg, b.x, b.y);
      } else if (G.esc && G.conv && !G.conv.dead && hitShip(b.x, b.y, G.conv)) {
        hit = true; hurtConv(b.dmg, b.x, b.y);
      } else if ((hitEs = G.escorts.find(z => hitShip(b.x, b.y, z)))) {
        hit = true; hitEs.hp -= b.dmg; hitEs.flash = .12; sparks(b.x, b.y, 6, 160);
      }
    }
    b.trail -= dt;
    if (b.trail <= 0) { b.trail = .03; addP({ t: 'smoke', x: b.x, y: b.y, life: .45, size: 2, grow: 7 }); }
    if (hit) G.balls.splice(i, 1);
    else if (b.life <= 0) { splash(b.x, b.y); G.balls.splice(i, 1); }
  }
}
/* ---------- minas aquáticas: só a sombra aparece na água; explodem quando você passa por cima (solo) ---------- */
const MINE_TRIG = 26, MINE_BLAST = 95;
function mineTarget() { return G.wave < 2 ? 0 : clamp(Math.floor(G.wave / 2) + 2, 0, 9) + (G.hc ? 2 : 0); }
function spawnMine() {
  const p = G.player, base = Math.hypot(W, H) / zoom / 2;
  for (let k = 0; k < 6; k++) {
    const a = Math.random() * TAU, r = base + rand(40, 380), q = iceOut(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 30);
    if (G.mines.some(m => Math.hypot(m.x - q[0], m.y - q[1]) < 90)) continue;
    G.mines.push({ x: q[0], y: q[1], t: rand(0, TAU), r: rand(.9, 1.15) });
    return true;
  }
  return false;
}
function mineBlow(m) {
  const p = G.player;
  explosion(m.x, m.y, 1.3); sfx.boom();
  for (let i = 0; i < 14; i++) addP({ t: 'foam', x: m.x + rand(-8, 8), y: m.y + rand(-8, 8), vx: rand(-60, 60), vy: rand(-60, 60), life: rand(.8, 1.5), size: 6, grow: 16 });
  floatText(m.x, m.y - 20, 'MINA!', '#ff6b6b');
  G.shake = Math.min(16, G.shake + 7);
  for (let i = G.enemies.length - 1; i >= 0; i--) {
    const e = G.enemies[i];
    if (Math.hypot(e.x - m.x, e.y - m.y) < MINE_BLAST) { if (!(e.shield > 0)) e.hp -= 30 + G.wave * 3; e.flash = .15; if (e.hp <= 0) { G.enemies.splice(i, 1); sinkEnemy(e); } }
  }
  hurtPlayer(Math.round(Math.max(18, p.max * .2) * (G.hc ? 1.3 : 1)), m.x, m.y);
}
function updateMines(dt) {
  if (MP.role || G.vs || state !== 'playing') return;
  const p = G.player;
  for (let i = G.mines.length - 1; i >= 0; i--) {
    const m = G.mines[i]; m.t += dt;
    const d = Math.hypot(p.x - m.x, p.y - m.y);
    if (d > 1500) { G.mines.splice(i, 1); continue; }
    if (!p.dead && d < MINE_TRIG) { G.mines.splice(i, 1); mineBlow(m); }
  }
  G.mineT = (G.mineT || 0) - dt;
  if (G.mineT <= 0) { G.mineT = 3; if (G.mines.length < mineTarget()) spawnMine(); }
}
function drawMine(m) {
  const pulse = .5 + .5 * Math.sin(m.t * 1.6), R = 20 * m.r;
  ctx.save(); ctx.translate(m.x, m.y);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, R * 1.35);
  g.addColorStop(0, 'rgba(4,14,22,' + (.24 + pulse * .06) + ')'); g.addColorStop(.7, 'rgba(4,14,22,.14)'); g.addColorStop(1, 'rgba(4,14,22,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 2, R * 1.35, R * 1.1, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(143,211,232,' + (.03 + pulse * .04) + ')'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.ellipse(0, 0, R * (1 + pulse * .25), R * .8 * (1 + pulse * .25), 0, 0, TAU); ctx.stroke();
  ctx.restore();
}
const CRATE_MAG = 62; // só quando você passa quase encostando (a coleta normal é 36)
function updateCrates(dt) {
  const p = G.player;
  for (let i = G.crates.length - 1; i >= 0; i--) {
    const c = G.crates[i];
    c.life -= dt; c.t += dt;
    if (c.life <= 0) { G.crates.splice(i, 1); continue; }
    { // ímã: caixa perto de um navio vem até ele
      let tg = null, td = CRATE_MAG;
      if (!p.dead) { const d = Math.hypot(p.x - c.x, p.y - c.y); if (d < td) { td = d; tg = p; } }
      if (MP.role === 'host') for (const q of G.allies) if (!q.dead) { const d = Math.hypot(q.x - c.x, q.y - c.y); if (d < td) { td = d; tg = q; } }
      if (tg && td > 6) { const sp = Math.min(td - 2, (90 + (1 - td / CRATE_MAG) * 330) * dt), an = Math.atan2(tg.y - c.y, tg.x - c.x); c.x += Math.cos(an) * sp; c.y += Math.sin(an) * sp; }
    }
    const who = (!p.dead && Math.hypot(p.x - c.x, p.y - c.y) < 36) ? p : ((MP.role === 'host' && G.allies.find(q => !q.dead && Math.hypot(q.x - c.x, q.y - c.y) < 36)) || null);
    if (who) {
      if (c.type === 'repair') { who.hp = Math.min(who.max, who.hp + who.max * .3); floatText(c.x, c.y - 16, '+30% casco', '#4fd1a5'); if (G.esc && G.conv && !G.conv.dead) G.conv.hp = Math.min(G.conv.max, G.conv.hp + G.conv.max * .2); }
      else if (c.type === 'shield') { who.shield = 8; floatText(c.x, c.y - 16, 'escudo', '#8fd3e8'); }
      else if (c.type === 'triple') { who.triple = 10; floatText(c.x, c.y - 16, 'tiro triplo', '#e2552f'); }
      else { who.rapid = 8; floatText(c.x, c.y - 16, 'fogo rápido', '#e0a93c'); }
      for (let k = 0; k < 10; k++) {
        const a = rand(0, TAU), v = rand(30, 110);
        addP({ t: 'spark', x: c.x, y: c.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .5, size: 1.6, drag: 2 });
      }
      sfx[c.type === 'repair' ? 'repair' : c.type === 'shield' ? 'shieldUp' : 'powerup'](); if (MP.role === 'host') evp(['k', 'p']);
      if (who === p) misAdd('crates', 1);
      G.crates.splice(i, 1);
    }
  }
}
function updateParts(dt) {
  for (let i = G.parts.length - 1; i >= 0; i--) {
    const q = G.parts[i];
    q.age += dt;
    if (q.age >= q.life) { G.parts.splice(i, 1); continue; }
    if (q.drag) { const f = Math.max(0, 1 - q.drag * dt); q.vx *= f; q.vy *= f; }
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (q.vr) q.rot += q.vr * dt;
  }
  for (let i = G.wrecks.length - 1; i >= 0; i--) {
    const w = G.wrecks[i];
    w.t += dt; w.x += w.vx * dt; w.y += w.vy * dt; w.vx *= .98; w.vy *= .98;
    if (Math.random() < dt * 8 && w.t < 1.6) smoke(w.x + rand(-8, 8), w.y + rand(-8, 8), 1);
    if (w.t > 2.4) G.wrecks.splice(i, 1);
  }
  for (let i = G.texts.length - 1; i >= 0; i--) {
    const f = G.texts[i];
    f.age += dt;
    if (f.age >= f.life) G.texts.splice(i, 1);
  }
}

/* ---------- passo do jogo ---------- */
let playAcc = 0;
function step(dt) {
  if (state === 'playing') { G.pt = (G.pt || 0) + dt; save.play = (save.play || 0) + dt; playAcc += dt; if (playAcc > 30) { playAcc = 0; persist(); checkAch(); } }
  if (MP.role === 'guest') { stepGuest(dt); return; }
  G.t += dt;
  const p = G.player;
  let inp;
  if (state === 'playing' && !p.dead) inp = gatherInput();
  else if (state === 'menu') inp = { mag: .35, ang: p.heading + Math.sin(G.t * .3) * .6, aim: null, fire: false };
  else inp = { mag: 0, ang: p.heading, aim: null, fire: false };
  G.aimActive = inp.aim != null;
  if (!p.dead) { stepPlayer(dt, inp); hazShip(p, dt); }
  if (state === 'playing' || state === 'over') {
    if (state === 'playing' && !G.vs) runWaves(dt);
    for (let i = G.enemies.length - 1; i >= 0; i--) { const en = G.enemies[i]; updateEnemy(en, dt); hazShip(en, dt); if (en.expire) { G.enemies.splice(i, 1); cloneFx(en.x, en.y, 1, en.spec.len); } }
    if (state === 'playing') { updateSharks(dt); updateMines(dt); }
    updateHole(dt);
    separate();
  }
  if (MP.role === 'host' && state === 'playing') { stepAllies(dt); stepBuoys(dt); }
  if (G.esc && state === 'playing') convUpdate(dt);
  updatePlanes(dt); updateMissiles(dt); updateRam(dt); updateEscorts(dt); updateBalls(dt); updateCrates(dt); updateMeteor(dt); updateParts(dt);
  if (MP.role === 'host' && G.vs) vsTick(dt);
  if (MP.role === 'host') mpHostTick(dt);
  if (p.dead && state === 'playing' && !G.vs && !(MP.role === 'host' && G.allies.some(a => !a.dead))) { G.deadT += dt; if (G.deadT > 1.6) gameOver(); }
  if (G.esc && G.conv && G.conv.dead && state === 'playing') { G.cvT = (G.cvT || 0) + dt; if (G.cvT > 2) gameOver(); }
  G.shake *= Math.exp(-dt * 7); if (G.shake < .1) G.shake = 0;
  G.flash = Math.max(0, G.flash - dt * 1.6);
  lowAlarm(dt);
  followCam(dt);
}
function followCam(dt) {
  const p = G.player, al = G.allies.find(a => !a.dead), ct = (p.dead && al) ? al : p;
  const k = 1 - Math.exp(-dt * 4.5), c = G.camera;
  c.x += (ct.x + Math.cos(ct.heading) * ct.speed * .35 - c.x) * k;
  c.y += (ct.y + Math.sin(ct.heading) * ct.speed * .35 - c.y) * k;
}

/* ---------- desenho ---------- */
function hullPath(L, Wd) {
  const h = Wd / 2;
  ctx.beginPath();
  ctx.moveTo(-L / 2, -h * .85);
  ctx.lineTo(L * .12, -h);
  ctx.quadraticCurveTo(L * .38, -h * .85, L / 2, 0);
  ctx.quadraticCurveTo(L * .38, h * .85, L * .12, h);
  ctx.lineTo(-L / 2, h * .85);
  ctx.closePath();
}
function drawAcc(list, L, Wd, spec) {
  const t = performance.now() / 1000, cx = spec.cabin.x * L;
  for (const id of list) {
    ctx.save();
    if (id === 'lant') {
      for (const q of [[L * .44, Wd * .26], [L * .44, -Wd * .26], [-L * .44, Wd * .22], [-L * .44, -Wd * .22]]) {
        ctx.beginPath(); ctx.arc(q[0], q[1], 5.5, 0, TAU); ctx.fillStyle = 'rgba(255,200,90,.22)'; ctx.fill();
        ctx.beginPath(); ctx.arc(q[0], q[1], 2.4, 0, TAU); ctx.fillStyle = '#ffd36b'; ctx.fill();
      }
    } else if (id === 'flag') {
      const fx = -L * .47, w = Math.sin(t * 5) * 1.6;
      ctx.beginPath(); ctx.moveTo(fx, -4); ctx.lineTo(fx - 15, -3 + w); ctx.lineTo(fx - 15, 4 + w); ctx.lineTo(fx, 4); ctx.closePath();
      ctx.fillStyle = '#15151c'; ctx.fill(); ctx.lineWidth = .8; ctx.strokeStyle = '#e9f2f3'; ctx.stroke();
      ctx.beginPath(); ctx.arc(fx - 8, .5 + w / 2, 1.8, 0, TAU); ctx.fillStyle = '#e9f2f3'; ctx.fill();
      ctx.beginPath(); ctx.arc(fx, 0, 2, 0, TAU); ctx.fillStyle = '#8a6414'; ctx.fill();
    } else if (id === 'radar') {
      ctx.translate(cx, 0); ctx.rotate(t * 2);
      ctx.beginPath(); ctx.ellipse(0, 0, 7.5, 2.6, 0, 0, TAU); ctx.fillStyle = '#aebfc4'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#2a3d46'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fillStyle = spec.accent; ctx.fill();
    } else if (id === 'hat') {
      ctx.translate(cx, 0);
      ctx.beginPath(); ctx.ellipse(0, 0, 10, 7.5, 0, 0, TAU); ctx.fillStyle = '#14141a'; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#e0a93c'; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 5, 4, 0, 0, TAU); ctx.fillStyle = '#26262f'; ctx.fill();
      ctx.beginPath(); ctx.arc(5.5, 0, 1.3, 0, TAU); ctx.fillStyle = '#e0a93c'; ctx.fill();
    } else if (id === 'crown') {
      ctx.translate(cx, 0); ctx.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 3.8 : 8.5, a = i * Math.PI / 5 - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fillStyle = '#f2c14e'; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = '#8a6414'; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 1.7, 0, TAU); ctx.fillStyle = '#e2552f'; ctx.fill();
    } else if (id === 'anchor') {
      ctx.translate(L * .45, 0); ctx.strokeStyle = '#f2c14e'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(3, 0); ctx.moveTo(1.5, -3.2); ctx.lineTo(1.5, 3.2); ctx.moveTo(-4, 0); ctx.lineTo(-7, -3.2); ctx.moveTo(-4, 0); ctx.lineTo(-7, 3.2); ctx.stroke();
      ctx.beginPath(); ctx.arc(4.6, 0, 1.6, 0, TAU); ctx.stroke();
    } else if (id === 'neon') {
      ctx.globalAlpha *= .75 + .25 * Math.sin(t * 3); ctx.shadowColor = '#5ffbf1'; ctx.shadowBlur = 8;
      hullPath(L * .97, Wd * .94); ctx.lineWidth = 1.6; ctx.strokeStyle = '#5ffbf1'; ctx.stroke();
    } else if (id === 'horns') {
      ctx.lineCap = 'round';
      for (const sg of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(L * .38, sg * Wd * .22); ctx.quadraticCurveTo(L * .5, sg * Wd * .36, L * .6, sg * Wd * .12);
        ctx.lineWidth = 3.2; ctx.strokeStyle = '#8f0f1a'; ctx.stroke(); ctx.lineWidth = 1.2; ctx.strokeStyle = '#ff6b6b'; ctx.stroke();
      }
    }
    ctx.restore();
  }
}
function drawShip(x, y, heading, spec, aim, o) {
  const L = spec.len, Wd = spec.wid;
  o = o || {};
  ctx.save();
  ctx.translate(x + 3.5, y + 6); ctx.rotate(heading);
  ctx.globalAlpha = (o.alpha == null ? 1 : o.alpha) * .9;
  ctx.fillStyle = 'rgba(2,10,16,.28)'; hullPath(L, Wd); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y); ctx.rotate(heading);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  hullPath(L, Wd);
  ctx.fillStyle = spec.hull; ctx.fill();
  ctx.lineWidth = 1.6; ctx.strokeStyle = spec.stroke; ctx.stroke();
  ctx.save(); ctx.translate(-L * .03, 0); hullPath(L * .86, Wd * .64); ctx.fillStyle = spec.deck; ctx.fill(); ctx.restore();
  if (spec.carrier) {
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.moveTo(-L * .38, -4); ctx.lineTo(L * .36, -4); ctx.stroke(); ctx.restore();
    ctx.fillStyle = spec.dark; ctx.fillRect(L * .08 - 11, Wd * .2, 22, Wd * .24);
    ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(L * .08 - 8, Wd * .2 + 2, 16, Wd * .24 - 4);
  }
  const cb = spec.cabin;
  ctx.fillStyle = spec.dark; ctx.fillRect(cb.x * L - cb.l / 2, -cb.w / 2, cb.l, cb.w);
  ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(cb.x * L - cb.l / 2 + 2, -cb.w / 2 + 2, cb.l - 4, cb.w - 4);
  if (spec.funnel) {
    ctx.beginPath(); ctx.arc(spec.funnel.x * L, 0, spec.funnel.r, 0, TAU);
    ctx.fillStyle = spec.accent; ctx.fill(); ctx.lineWidth = 1.2; ctx.strokeStyle = spec.dark; ctx.stroke();
  }
  const la = aim - heading, rc = (o.recoil || 0) * 5;
  for (const t of spec.turrets) {
    const tx = t.x * L;
    ctx.strokeStyle = '#26363d'; ctx.lineWidth = t.r > 8 ? 3.6 : t.r > 6 ? 3 : 2.4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx + Math.cos(la) * 2, Math.sin(la) * 2);
    ctx.lineTo(tx + Math.cos(la) * (t.bl - rc), Math.sin(la) * (t.bl - rc)); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, 0, t.r, 0, TAU); ctx.fillStyle = spec.dark; ctx.fill();
    ctx.beginPath(); ctx.arc(tx, 0, t.r * .62, 0, TAU); ctx.fillStyle = spec.hull; ctx.fill();
  }
  if (o.aux != null) {
    const ax = o.aux - heading, tx = L * .1;
    ctx.strokeStyle = '#26363d'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(tx, 0); ctx.lineTo(tx + Math.cos(ax) * 13, Math.sin(ax) * 13); ctx.stroke();
    ctx.beginPath(); ctx.arc(tx, 0, 4.5, 0, TAU); ctx.fillStyle = spec.accent; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = spec.dark; ctx.stroke();
  }
  if (o.acc && o.acc.length) drawAcc(o.acc, L, Wd, spec);
  if (o.flash > 0) { hullPath(L, Wd); ctx.fillStyle = 'rgba(255,255,255,' + Math.min(.6, o.flash * 4) + ')'; ctx.fill(); }
  if (o.dark > 0) { hullPath(L, Wd); ctx.fillStyle = 'rgba(0,0,0,' + o.dark + ')'; ctx.fill(); }
  ctx.restore();
}
function drawBuoy(b) {
  const mine = b.mine, t = b.t || 0, blink = b.life < 6 && Math.sin(t * 12) < 0, f = clamp(b.prog / BUOY_T, 0, 1);
  ctx.save(); ctx.translate(b.x, b.y); ctx.globalAlpha = blink ? .4 : 1;
  ctx.setLineDash([8, 8]); ctx.lineDashOffset = -t * 14; ctx.beginPath(); ctx.arc(0, 0, BUOY_R, 0, TAU);
  ctx.strokeStyle = 'rgba(224,169,60,.7)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  if (f > 0) { ctx.beginPath(); ctx.arc(0, 0, BUOY_R - 8, -Math.PI / 2, -Math.PI / 2 + TAU * f); ctx.strokeStyle = '#4fd1a5'; ctx.lineWidth = 6; ctx.stroke(); }
  const bob = Math.sin(t * 3) * 2;
  ctx.beginPath(); ctx.arc(0, bob, 11, 0, TAU); ctx.fillStyle = '#e2552f'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#e9f2f3'; ctx.stroke();
  ctx.fillStyle = '#e9f2f3'; ctx.font = '600 13px ' + getComputedStyle(document.body).fontFamily; ctx.textAlign = 'center';
  ctx.fillText((mine ? 'RESGATE ' : 'SALVAR ') + Math.max(0, Math.ceil(b.life)) + 's', 0, -BUOY_R - 8);
  ctx.restore();
}
function drawShield(x, y, spec, t) {
  const r = spec.len * .62 + Math.sin(performance.now() / 160) * 1.5;
  const blink = t < 2 && Math.sin(performance.now() / 70) > 0 ? .35 : 1;
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = blink;
  ctx.fillStyle = 'rgba(143,211,232,.14)'; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(143,211,232,.85)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}
function drawCrate(c) {
  const bob = Math.sin(c.t * 2.2) * 2, a = c.life < 4 ? (Math.sin(c.t * 10) > 0 ? 1 : .35) : 1;
  ctx.save();
  ctx.translate(c.x, c.y + bob); ctx.globalAlpha = a;
  ctx.beginPath(); ctx.arc(0, 0, 18 + Math.sin(c.t * 3) * 2, 0, TAU);
  ctx.strokeStyle = c.type === 'repair' ? 'rgba(79,209,165,.55)' : c.type === 'shield' ? 'rgba(143,211,232,.6)' : c.type === 'triple' ? 'rgba(226,85,47,.6)' : 'rgba(224,169,60,.55)'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.rotate(Math.sin(c.t * 1.3) * .25);
  ctx.fillStyle = c.type === 'repair' ? '#d4e8ea' : c.type === 'shield' ? '#8fd3e8' : c.type === 'triple' ? '#e2552f' : '#e0a93c'; ctx.fillRect(-9, -9, 18, 18);
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#10222c'; ctx.strokeRect(-9, -9, 18, 18);
  if (c.type === 'repair') { ctx.fillStyle = '#1f9d78'; ctx.fillRect(-2.5, -6.5, 5, 13); ctx.fillRect(-6.5, -2.5, 13, 5); }
  else if (c.type === 'shield') { ctx.fillStyle = '#10222c'; ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(6, -4.5); ctx.lineTo(5, 2); ctx.lineTo(0, 7); ctx.lineTo(-5, 2); ctx.lineTo(-6, -4.5); ctx.closePath(); ctx.fill(); }
  else if (c.type === 'triple') { ctx.fillStyle = '#10222c'; ctx.fillRect(-6.5, -1, 13, 2.2); ctx.save(); ctx.rotate(-.5); ctx.fillRect(-6.5, -1, 13, 2.2); ctx.rotate(1); ctx.fillRect(-6.5, -1, 13, 2.2); ctx.restore(); }
  else { ctx.fillStyle = '#10222c'; ctx.beginPath(); ctx.moveTo(2, -7); ctx.lineTo(-5, 1.5); ctx.lineTo(-.5, 1.5); ctx.lineTo(-2, 7); ctx.lineTo(5, -1.5); ctx.lineTo(.5, -1.5); ctx.closePath(); ctx.fill(); }
  ctx.restore();
}
function drawPart(q) {
  const k = q.age / q.life;
  switch (q.t) {
    case 'smoke':
      ctx.fillStyle = 'rgba(22,32,38,' + ((1 - k) * .5).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size + q.grow * q.age, 0, TAU); ctx.fill(); break;
    case 'fire':
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,' + ((190 - 130 * k) | 0) + ',' + ((70 - 60 * k) | 0) + ',' + (1 - k).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(.5, q.size * (1 - k * .6)), 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; break;
    case 'spark':
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,214,130,' + (1 - k).toFixed(3) + ')'; ctx.lineWidth = q.size;
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x - q.vx * .04, q.y - q.vy * .04); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; break;
    case 'flash':
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,230,170,' + ((1 - k) * .9).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size * (1 - k * .5), 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; break;
    case 'glow': {
      const c = q.c || '127,227,255', r = q.size * (.6 + k * .7), a = (1 - k) * (1 - k);
      ctx.globalCompositeOperation = 'lighter';
      const gr = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
      gr.addColorStop(0, 'rgba(' + c + ',' + (a * .55).toFixed(3) + ')'); gr.addColorStop(1, 'rgba(' + c + ',0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; break;
    }
    case 'cring':
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(' + (q.c || '127,227,255') + ',' + ((1 - k) * .85).toFixed(3) + ')'; ctx.lineWidth = Math.max(.4, (q.w || 2) * (1 - k));
      ctx.beginPath(); ctx.arc(q.x, q.y, q.size + q.grow * q.age, 0, TAU); ctx.stroke();
      ctx.globalCompositeOperation = 'source-over'; break;
    case 'mote':
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(' + (q.c || '170,240,255') + ',' + (1 - k).toFixed(3) + ')';
      ctx.beginPath(); ctx.arc(q.x, q.y, Math.max(.4, q.size * (1 - k * .5)), 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over'; break;
    case 'chunk':
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot + (q.vr || 0) * q.age);
      ctx.fillStyle = 'rgba(' + (q.c || '235,250,255') + ',' + Math.min(1, (1 - k) * 1.6).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(q.size, 0); ctx.lineTo(-q.size * .6, q.size * .8); ctx.lineTo(-q.size * .5, -q.size * .7); ctx.closePath(); ctx.fill();
      ctx.lineWidth = .8; ctx.strokeStyle = 'rgba(120,175,195,' + ((1 - k) * .8).toFixed(3) + ')'; ctx.stroke();
      ctx.restore(); break;
    case 'shard':
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(127,227,255,' + ((1 - k) * .9).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(q.size * 1.6, 0); ctx.lineTo(0, q.size * .6); ctx.lineTo(-q.size, 0); ctx.lineTo(0, -q.size * .6); ctx.closePath(); ctx.fill();
      ctx.restore(); break;
    case 'beam': {
      const L = q.size * (1 - k * .4);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(255,225,160,' + ((1 - k) * .8).toFixed(3) + ')'; ctx.lineWidth = 3.2 * (1 - k) + .6; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(q.x + Math.cos(q.a) * L, q.y + Math.sin(q.a) * L); ctx.stroke();
      ctx.lineCap = 'butt'; ctx.globalCompositeOperation = 'source-over'; break;
    }
    case 'debris':
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.globalAlpha = 1 - k;
      ctx.fillStyle = '#2a1a17'; ctx.fillRect(-q.size, -q.size / 2, q.size * 2, q.size); ctx.restore(); break;
  }
}
function drawUnder(q) {
  const k = q.age / q.life;
  if (q.t === 'foam') {
    ctx.fillStyle = 'rgba(212,232,234,' + ((1 - k) * .42).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(q.x, q.y, q.size + q.grow * q.age, 0, TAU); ctx.fill();
  } else if (q.t === 'ghost') {
    ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.h); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(127,227,255,' + ((1 - k) * .22).toFixed(3) + ')'; hullPath(q.len, q.wid); ctx.fill();
    ctx.restore();
  } else if (q.t === 'ring') {
    ctx.strokeStyle = 'rgba(212,232,234,' + ((1 - k) * .6).toFixed(3) + ')'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(q.x, q.y, q.size + q.grow * q.age, 0, TAU); ctx.stroke();
  }
}
function drawRing(p) {
  ctx.save();
  ctx.translate(p.x, p.y);
  const lw = 1.2 / zoom;
  ctx.lineWidth = lw; ctx.strokeStyle = 'rgba(212,232,234,.17)';
  ctx.setLineDash([4 / zoom, 9 / zoom]);
  ctx.beginPath(); ctx.arc(0, 0, RANGE, 0, TAU); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(212,232,234,.3)';
  for (let i = 0; i < 72; i++) {
    const a = i * TAU / 72, len = i % 6 === 0 ? 14 : i % 2 === 0 ? 7 : 3.5;
    ctx.beginPath(); ctx.moveTo(Math.cos(a) * (RANGE - len), Math.sin(a) * (RANGE - len)); ctx.lineTo(Math.cos(a) * RANGE, Math.sin(a) * RANGE); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(212,232,234,.5)';
  ctx.font = '500 ' + (10 / zoom) + 'px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lab = [['000', -Math.PI / 2], ['090', 0], ['180', Math.PI / 2], ['270', Math.PI]];
  for (const [t, a] of lab) ctx.fillText(t, Math.cos(a) * (RANGE - 26), Math.sin(a) * (RANGE - 26));
  ctx.textAlign = 'left';
  ctx.fillText('ALCANCE ' + RANGE + ' m', Math.cos(-.78) * (RANGE + 8), Math.sin(-.78) * (RANGE + 8));
  if (G.aimActive) {
    ctx.strokeStyle = 'rgba(224,169,60,.4)'; ctx.setLineDash([3 / zoom, 8 / zoom]);
    ctx.beginPath(); ctx.moveTo(Math.cos(p.aim) * 36, Math.sin(p.aim) * 36); ctx.lineTo(Math.cos(p.aim) * RANGE, Math.sin(p.aim) * RANGE); ctx.stroke();
    ctx.setLineDash([]);
    const ex = Math.cos(p.aim) * RANGE, ey = Math.sin(p.aim) * RANGE;
    ctx.strokeStyle = 'rgba(224,169,60,.8)'; ctx.lineWidth = 1.5 / zoom;
    ctx.beginPath(); ctx.arc(ex, ey, 7, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex - 12, ey); ctx.lineTo(ex - 4, ey); ctx.moveTo(ex + 4, ey); ctx.lineTo(ex + 12, ey);
    ctx.moveTo(ex, ey - 12); ctx.lineTo(ex, ey - 4); ctx.moveTo(ex, ey + 4); ctx.lineTo(ex, ey + 12); ctx.stroke();
  }
  ctx.restore();
}
function drawHitDirs() {
  const L = G.hits; if (!L || !L.length || G.player.dead) return;
  const p = G.player, c = G.camera, sx = W / 2 + (p.x - c.x) * zoom, sy = H / 2 + (p.y - c.y) * zoom, R = Math.min(W, H) * .17 + p.spec.len * .5 * zoom, now = performance.now();
  ctx.save(); ctx.lineCap = 'round';
  for (let i = L.length - 1; i >= 0; i--) {
    const k = (now - L[i].t0) / 900;
    if (k >= 1) { L.splice(i, 1); continue; }
    ctx.strokeStyle = 'rgba(226,85,47,' + ((1 - k) * .9).toFixed(3) + ')'; ctx.lineWidth = 8 * (1 - k * .5);
    ctx.beginPath(); ctx.arc(sx, sy, R + k * 16, L[i].a - .3, L[i].a + .3); ctx.stroke();
  }
  ctx.restore();
}
function arrowTop() { const b = $('boss'); return b && !b.hidden ? Math.max(150, Math.ceil(b.getBoundingClientRect().bottom) + 10) : 150; }
function drawArrows() {
  const c = G.camera, mt = arrowTop(), mb = 28, mx = 26;
  const cx = W / 2, cy = (mt + H - mb) / 2, hw = W / 2 - mx, hh = (H - mb - mt) / 2;
  for (const e of G.enemies) {
    const sx = W / 2 + (e.x - c.x) * zoom, sy = H / 2 + (e.y - c.y) * zoom;
    if (sx > -8 && sx < W + 8 && sy > -8 && sy < H + 8) continue;
    const dx = sx - cx, dy = sy - cy;
    const t = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
    const px = cx + dx * t, py = cy + dy * t, ang = Math.atan2(dy, dx);
    const sz = e.type === 'boss' ? 15 : e.type === 'battle' ? 12 : e.type === 'blindado' ? 10.5 : e.type === 'frigate' ? 9.5 : e.type === 'lancha' ? 6 : 7.5;
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * .7, -sz * .75); ctx.lineTo(-sz * .7, sz * .75); ctx.closePath();
    ctx.fillStyle = 'rgba(226,85,47,.92)'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(10,31,44,.9)'; ctx.stroke();
    ctx.restore();
  }
  for (const fr of G.allies) {
  if (!fr.dead && state === 'playing') {
    const sx = W / 2 + (fr.x - c.x) * zoom, sy = H / 2 + (fr.y - c.y) * zoom;
    if (!(sx > -8 && sx < W + 8 && sy > -8 && sy < H + 8)) {
      const dx = sx - cx, dy = sy - cy;
      const t = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
      const px = cx + dx * t, py = cy + dy * t, ang = Math.atan2(dy, dx), sz = 13;
      ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * .7, -sz * .8); ctx.lineTo(-sz * .7, sz * .8); ctx.closePath();
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(10,31,44,.9)'; ctx.stroke();
      ctx.restore();
      const dm = Math.round(Math.hypot(fr.x - G.camera.x, fr.y - G.camera.y) / 10);
      ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lx = clamp(px - Math.cos(ang) * 30, 40, W - 40), ly = clamp(py - Math.sin(ang) * 22, mt - 10, H - mb - 10);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,31,44,.9)'; ctx.fillStyle = '#ffffff';
      const tx = (fr.nome || 'amigo') + ' · ' + dm + ' m';
      ctx.strokeText(tx, lx, ly); ctx.fillText(tx, lx, ly);
    }
  }
  }
  for (const b of G.buoys) {
    if (b.mine || state !== 'playing') continue;
    const sx = W / 2 + (b.x - c.x) * zoom, sy = H / 2 + (b.y - c.y) * zoom;
    if (sx > -8 && sx < W + 8 && sy > -8 && sy < H + 8) continue;
    const dx = sx - cx, dy = sy - cy, t = Math.min(hw / (Math.abs(dx) || 1e-6), hh / (Math.abs(dy) || 1e-6));
    const px = cx + dx * t, py = cy + dy * t, ang = Math.atan2(dy, dx), sz = 13;
    ctx.save(); ctx.translate(px, py); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(sz, 0); ctx.lineTo(-sz * .7, -sz * .8); ctx.lineTo(-sz * .7, sz * .8); ctx.closePath();
    ctx.fillStyle = '#e0a93c'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(10,31,44,.9)'; ctx.stroke();
    ctx.restore();
    const dm = Math.round(Math.hypot(b.x - G.camera.x, b.y - G.camera.y) / 10);
    ctx.font = '600 11px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lx = clamp(px - Math.cos(ang) * 30, 40, W - 40), ly = clamp(py - Math.sin(ang) * 22, mt - 10, H - mb - 10), tx = 'RESGATAR · ' + dm + ' m · ' + Math.max(0, Math.ceil(b.life)) + 's';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,31,44,.9)'; ctx.fillStyle = '#e0a93c';
    ctx.strokeText(tx, lx, ly); ctx.fillText(tx, lx, ly);
  }
}
function drawSticks() {
  if (!touchMode || state !== 'playing') return;
  const defs = [['move', W * .2, H - 118, 'MOVER', '212,232,234'], ['aim', W * .8, H - 118, 'MIRAR', '224,169,60']];
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [k, hx, hy, label, rgb] of defs) {
    const s = sticks[k], on = !!s, bx = on ? s.ox : hx, by = on ? s.oy : hy, hot = k === 'aim' && on && s.mag > .35;
    ctx.beginPath(); ctx.arc(bx, by, STICK_R, 0, TAU);
    ctx.fillStyle = 'rgba(' + rgb + ',' + (on ? .1 : .05) + ')'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(' + rgb + ',' + (on ? .55 : .26) + ')'; ctx.stroke();
    ctx.beginPath(); ctx.arc(bx, by, STICK_R * .52, 0, TAU); ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(' + rgb + ',.16)'; ctx.stroke();
    ctx.strokeStyle = 'rgba(' + rgb + ',.4)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.beginPath(); ctx.moveTo(bx + Math.cos(a) * (STICK_R - 8), by + Math.sin(a) * (STICK_R - 8)); ctx.lineTo(bx + Math.cos(a) * (STICK_R - 2), by + Math.sin(a) * (STICK_R - 2)); ctx.stroke(); }
    ctx.lineCap = 'butt';
    if (on) {
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(s.x, s.y); ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(' + rgb + ',.35)'; ctx.stroke();
      if (hot) { ctx.beginPath(); ctx.arc(s.x, s.y, 32, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(' + rgb + ',.7)'; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(s.x, s.y, 24, 0, TAU); ctx.fillStyle = 'rgba(' + rgb + ',' + (hot ? .75 : .5) + ')'; ctx.fill();
      ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, TAU); ctx.fillStyle = 'rgba(10,31,44,.55)'; ctx.fill();
    } else if (!used[k]) {
      ctx.font = '500 11px "IBM Plex Mono", monospace'; ctx.fillStyle = 'rgba(' + rgb + ',.55)';
      ctx.fillText(label, bx, by);
    }
  }
}
const PCOL = ['#e0a93c', '#4fd1a5', '#8fd3e8', '#c792ea'];
const PINGS = ['Ajuda!', 'Vem aqui', 'Cuidado!', 'Valeu!'];
function sendPing(k) {
  if (!G || G.vs || !G.allies.length || !(k >= 0 && k < 4)) return;
  G.player.chat = { k, until: performance.now() + 3000 };
  if (MP.role === 'guest') mpSend({ t: 'e', i: MP.pid, k }); else evp(['e', 0, k]);
  sfx.pick();
}
function drawChat(o, y) {
  if (!o.chat || performance.now() > o.chat.until) return;
  const t = PINGS[o.chat.k], fs = 12 / zoom;
  ctx.save(); ctx.font = '700 ' + fs + 'px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  const w = ctx.measureText(t).width + 10 / zoom;
  ctx.fillStyle = 'rgba(10,31,44,.88)'; ctx.fillRect(o.x - w / 2, y - fs - 3 / zoom, w, fs + 6 / zoom);
  ctx.fillStyle = PCOL[(o.pid != null ? o.pid : Math.max(0, MP.pid)) % 4]; ctx.fillText(t, o.x, y);
  ctx.restore();
}
function drawMateArrows() {
  if (!G || state === 'menu' || !G.allies.length) return;
  const c = G.camera, m = 30;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  for (const q of G.allies) {
    if (q.dead) continue;
    const x = W / 2 + (q.x - c.x) * zoom, y = H / 2 + (q.y - c.y) * zoom;
    if (x > -10 && x < W + 10 && y > -10 && y < H + 10) continue;
    const a = Math.atan2(y - H / 2, x - W / 2), k = Math.min((W / 2 - m) / (Math.abs(Math.cos(a)) || 1e-6), (H / 2 - m) / (Math.abs(Math.sin(a)) || 1e-6));
    const ax = W / 2 + Math.cos(a) * k, ay = H / 2 + Math.sin(a) * k, col = PCOL[(q.pid || 0) % 4];
    ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = col; ctx.globalAlpha = .9;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.font = '600 10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = col;
    ctx.fillText((q.nome || '') + ' ' + Math.round(Math.hypot(q.x - G.player.x, q.y - G.player.y) / 10) + 'm', ax - Math.cos(a) * 26, ay - Math.sin(a) * 26);
  }
}
/* ---------- minimapa: radar com o navio no centro, norte para cima ---------- */
const MM_R = 1300; // metros do centro até a borda do radar
const miniCv = $('mini'); let miniCtx = null;
function drawMini() {
  if (!G || state === 'menu' || !miniCv) return;
  const s = Math.round(miniCv.clientWidth * DPR);
  if (!s) return;
  if (miniCv.width !== s) { miniCv.width = miniCv.height = s; miniCtx = null; }
  const g = miniCtx || (miniCtx = miniCv.getContext('2d')), u = s / 130, c = s / 2, k = c / MM_R, p = G.player;
  const ax = p.dead ? G.camera.x : p.x, ay = p.dead ? G.camera.y : p.y;
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, s, s);
  g.save(); g.beginPath(); g.arc(c, c, c - 1, 0, TAU); g.clip();
  g.lineWidth = u; g.strokeStyle = 'rgba(160,215,230,.32)';
  for (let i = 1; i <= 2; i++) { g.beginPath(); g.arc(c, c, c * i / 3, 0, TAU); g.stroke(); }
  g.beginPath(); g.moveTo(c, 0); g.lineTo(c, s); g.moveTo(0, c); g.lineTo(s, c); g.stroke();
  const X = x => c + (x - ax) * k, Y = y => c + (y - ay) * k, edge = (c - 3 * u) / k;
  // perigos do mar (ilhas, icebergs, redemoinhos)
  for (let i = Math.floor((ax - MM_R) / HZ_CELL); i <= Math.floor((ax + MM_R) / HZ_CELL); i++)
    for (let j = Math.floor((ay - MM_R) / HZ_CELL); j <= Math.floor((ay + MM_R) / HZ_CELL); j++) {
      const cell = hzCell(i, j);
      for (const ic of cell.ice) { g.beginPath(); g.arc(X(ic.x), Y(ic.y), Math.max(1.5 * u, ic.r * .9 * k), 0, TAU); g.fillStyle = ic.isl ? '#d9c27e' : 'rgba(225,245,250,.95)'; g.fill(); if (ic.isl) { g.beginPath(); g.arc(X(ic.x), Y(ic.y), Math.max(1 * u, ic.r * .62 * k), 0, TAU); g.fillStyle = '#5fbf5a'; g.fill(); } }
      for (const w of cell.wh) { const wx = X(w.x), wy = Y(w.y), wr = Math.max(3 * u, w.r * .6 * k); g.beginPath(); g.arc(wx, wy, wr, 0, TAU); g.fillStyle = 'rgba(40,110,140,.35)'; g.fill(); g.strokeStyle = 'rgba(130,220,245,.95)'; g.lineWidth = 1.3 * u; g.stroke(); g.beginPath(); g.arc(wx, wy, wr * .45, 0, TAU); g.lineWidth = u; g.stroke(); g.beginPath(); g.arc(wx, wy, wr * .15, 0, TAU); g.fillStyle = '#d8f6ff'; g.fill(); }
    }
  if (G.hole) { g.beginPath(); g.arc(X(G.hole.x), Y(G.hole.y), 3 * u, 0, TAU); g.fillStyle = '#b44cff'; g.fill(); }
  // alcance do canhão e área visível da tela
  g.setLineDash([3 * u, 4 * u]); g.lineWidth = u; g.strokeStyle = 'rgba(224,169,60,.75)';
  g.beginPath(); g.arc(c, c, RANGE * k, 0, TAU); g.stroke(); g.setLineDash([]);
  g.lineWidth = 1.2 * u; g.strokeStyle = 'rgba(235,245,246,.7)'; g.strokeRect(X(G.camera.x - W / 2 / zoom), Y(G.camera.y - H / 2 / zoom), W / zoom * k, H / zoom * k);
  const dot = (x, y, r, col, a) => {
    let dx = x - ax, dy = y - ay; const d = Math.hypot(dx, dy); let rr = r, al = a == null ? 1 : a;
    if (d > edge) { dx *= edge / d; dy *= edge / d; rr *= .75; al *= .6; }
    rr *= 1.35; g.globalAlpha = al; g.beginPath(); g.arc(c + dx * k, c + dy * k, rr, 0, TAU); g.fillStyle = col; g.fill(); g.lineWidth = 1.1 * u; g.strokeStyle = 'rgba(4,14,22,.95)'; g.stroke(); g.globalAlpha = 1;
  };
  const CC = { repair: '#4fd1a5', shield: '#8fd3e8', triple: '#e2552f', rapid: '#e0a93c' };
  for (const cr of G.crates) dot(cr.x, cr.y, 1.8 * u, CC[cr.type] || '#e0a93c');
  for (const b of G.buoys) dot(b.x, b.y, 2.6 * u, '#e0a93c');
  for (const sk of G.sharks) dot(sk.x, sk.y, 1.6 * u, '#ff8a8a');
  for (const e of G.enemies) {
    const big = e.type === 'boss', col = e.fake ? '#ff9a7a' : '#e2552f';
    dot(e.x, e.y, (big ? 4.2 : e.type === 'battle' ? 3.2 : e.type === 'lancha' ? 1.8 : 2.4) * u, col, e.cloak > 0 ? .4 : 1);
  }
  for (const z of G.escorts) dot(z.x, z.y, 1.8 * u, z.clone ? '#7fe3ff' : '#4fd1a5');
  if (G.esc && G.conv && !G.conv.dead) dot(G.conv.x, G.conv.y, 4.2 * u, '#8fd3e8');
  for (const q of G.allies) if (!q.dead) dot(q.x, q.y, 3 * u, G.vs ? '#e2552f' : PCOL[(q.pid || 0) % 4]);
  // navio do jogador
  if (!p.dead) {
    g.save(); g.translate(c, c); g.rotate(p.heading); g.globalAlpha = p.cloak > 0 ? .5 : 1;
    g.shadowColor = 'rgba(255,214,120,.9)'; g.shadowBlur = 6 * u;
    g.beginPath(); g.moveTo(8 * u, 0); g.lineTo(-5.5 * u, -5 * u); g.lineTo(-2.5 * u, 0); g.lineTo(-5.5 * u, 5 * u); g.closePath();
    g.fillStyle = '#ffd36a'; g.fill(); g.shadowBlur = 0; g.lineWidth = 1.3 * u; g.strokeStyle = '#0a1f2c'; g.stroke(); g.restore();
  }
  g.restore();
  g.font = '700 ' + (11 * u) + 'px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'top';
  g.lineWidth = 3 * u; g.strokeStyle = 'rgba(4,14,22,.95)'; g.strokeText('N', c, 4 * u);
  g.fillStyle = '#ffe3a0'; g.fillText('N', c, 4 * u);
}
function render() { render0(); drawMateArrows(); drawConvArrow(); drawMini(); }
function render0() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#0a1f2c'; ctx.fillRect(0, 0, W, H);
  if (!G) return;
  const c = G.camera, p = G.player;
  let sx = 0, sy = 0;
  if (G.shake > 0) { const m = G.shake * [0, .25, 1][cfg.shake]; sx = rand(-m, m); sy = rand(-m, m); }
  ctx.setTransform(DPR * zoom, 0, 0, DPR * zoom, DPR * (W / 2 - c.x * zoom + sx), DPR * (H / 2 - c.y * zoom + sy));
  drawWater(c.x - W / 2 / zoom - 20, c.y - H / 2 / zoom - 20, W / zoom + 40, H / zoom + 40, G.t);
  hzVisible(c);
  for (const w of VW) drawWhirl(w, G.t);
  if (G.hole) drawHole(G.hole);

  if (state !== 'menu' && !p.dead) drawRing(p);
  for (const q of G.parts) drawUnder(q);
  for (const ic of VI) drawIce(ic);
  for (const w of G.wrecks) {
    const k = w.t / 2.4;
    drawShip(w.x, w.y, w.heading + k * .12, w.spec, w.aim, { alpha: Math.max(0, 1 - k * k), dark: Math.min(.8, k * .9) });
  }
  for (const m of G.mines) if (onScreen(m, 50)) drawMine(m);
  for (const sk of G.sharks) drawShark(sk);
  for (const cr of G.crates) drawCrate(cr);
  for (const b of G.buoys) drawBuoy(b);
  for (const e of G.enemies) drawShip(e.x, e.y, e.heading, e.spec, e.aim, { flash: e.flash, recoil: e.recoil, alpha: e.cloak > 0 ? .25 : undefined });
  ctx.save(); ctx.font = '600 9px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.lineWidth = 3;
  for (const e of G.enemies) {
    if (e.shield > 0) { ctx.beginPath(); ctx.arc(e.x, e.y, e.spec.len * .6, 0, TAU); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(143,211,232,.7)'; ctx.stroke(); ctx.lineWidth = 3; }
    if (!e.pw && !e.fake) continue;
    const tx = e.fake ? 'CLONE' : HC_NAMES[e.pw], ty = e.y - e.spec.len * .42 - 10;
    ctx.strokeStyle = 'rgba(10,31,44,.9)'; ctx.fillStyle = '#ff9a7a'; ctx.strokeText(tx, e.x, ty); ctx.fillText(tx, e.x, ty);
  }
  ctx.restore();
  for (const e of G.enemies) {
    if (e.hp < e.max) {
      const w = e.spec.len * .5, y = e.y - e.spec.len * .42 - 6;
      ctx.fillStyle = 'rgba(10,31,44,.75)'; ctx.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 5);
      ctx.fillStyle = '#e2552f'; ctx.fillRect(e.x - w / 2, y, w * clamp(e.hp / e.max, 0, 1), 3);
    }
  }
  if (!p.dead) drawShip(p.x, p.y, p.heading, p.spec, p.aim, {
    flash: p.hflash, recoil: p.recoil, aux: p.auto ? p.autoAim : null, acc: [],
    alpha: p.cloak > 0 ? (p.cloak < .5 ? .2 + .8 * (1 - p.cloak / .5) : .2) : undefined
  });
  if (!p.dead && p.shield > 0) drawShield(p.x, p.y, p.spec, p.shield);
  if (!p.dead && G.allies.length) drawChat(p, p.y - p.spec.len * .5 - 14 / zoom);

  for (const z of G.escorts) {
    let calpha;
    if (z.clone) {
      const nowS = performance.now() / 1000, appear = clamp((CLONE_LIFE - z.life) / .6, 0, 1), L = z.spec.len;
      calpha = (z.life < 3 ? .35 + .3 * Math.abs(Math.sin(z.life * 6)) : .78 + Math.sin(nowS * 5) * .06) * appear;
      if (!p.dead && z.pid === 0) {
        ctx.save(); ctx.strokeStyle = 'rgba(127,227,255,' + (.22 * appear).toFixed(3) + ')'; ctx.lineWidth = 1.4; ctx.setLineDash([6, 10]); ctx.lineDashOffset = -nowS * 24;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(z.x, z.y); ctx.stroke(); ctx.restore();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const ag = ctx.createRadialGradient(z.x, z.y, L * .1, z.x, z.y, L * .9), pul = .75 + Math.sin(nowS * 4) * .25;
      ag.addColorStop(0, 'rgba(127,227,255,' + (.3 * pul * appear).toFixed(3) + ')'); ag.addColorStop(1, 'rgba(127,227,255,0)');
      ctx.fillStyle = ag; ctx.beginPath(); ctx.arc(z.x, z.y, L * .9, 0, TAU); ctx.fill();
      ctx.restore();
      ctx.save(); ctx.translate(z.x, z.y); ctx.rotate(nowS * .9); ctx.setLineDash([10, 14]);
      ctx.strokeStyle = 'rgba(127,227,255,' + (.55 * appear * (z.life < 3 ? .6 : 1)).toFixed(3) + ')'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(0, 0, L * .62, 0, TAU); ctx.stroke(); ctx.restore();
    }
    drawShip(z.x, z.y, z.heading, z.spec, z.aim, { flash: z.flash, recoil: z.recoil, alpha: z.clone ? calpha : undefined });
    const bw = z.clone ? 44 : 30, by = z.y - z.spec.len * .5 - 8;
    ctx.fillStyle = 'rgba(10,31,44,.75)'; ctx.fillRect(z.x - bw / 2 - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = z.clone ? '#7fe3ff' : '#4fd1a5'; ctx.fillRect(z.x - bw / 2, by, bw * clamp(z.hp / z.max, 0, 1), 3);
  }
  if (G.esc) drawConv(G.conv);
  for (const q2 of G.allies) {
  if (!q2.dead && !(G.vs && q2.cloak > 0)) {
    drawShip(q2.x, q2.y, q2.heading, q2.spec, q2.aim, { flash: q2.hflash, recoil: q2.recoil, aux: q2.auto ? q2.autoAim : null, alpha: q2.cloak > 0 ? .35 : undefined });
    if (q2.shield > 0) drawShield(q2.x, q2.y, q2.spec, q2.shield);
    const fs = 11 / zoom, bw = 44, by = q2.y - q2.spec.len * .5 - 10;
    ctx.fillStyle = 'rgba(10,31,44,.75)'; ctx.fillRect(q2.x - bw / 2 - 1, by - 1, bw + 2, 5);
    ctx.fillStyle = G.vs ? '#e2552f' : '#4fd1a5'; ctx.fillRect(q2.x - bw / 2, by, bw * clamp(q2.hp / q2.max, 0, 1), 3);
    ctx.font = '600 ' + fs + 'px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = G.vs ? '#e2552f' : PCOL[(q2.pid || 0) % 4]; ctx.fillText(q2.nome || 'amigo', q2.x, by - 3);
    drawChat(q2, by - 18 / zoom);
  }
  }
  for (const b of G.balls) {
    if (b.hm) { drawMissile(b.x, b.y, Math.atan2(b.vy, b.vx), .8); continue; }
    if (b.nova) {
      ctx.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 3; k++) { ctx.fillStyle = 'rgba(127,227,255,' + (.16 + k * .14).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * (1 - k * .3), 0, TAU); ctx.fill(); }
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * .28, 0, TAU); ctx.fill(); continue;
    }
    if (b.pr) {
      const L = b.tp ? 26 : 16; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(Math.atan2(b.vy, b.vx));
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(127,227,255,.35)'; ctx.fillRect(-L * 1.8, -3, L * 1.8, 6);
      ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#cfeef5'; ctx.beginPath(); ctx.ellipse(0, 0, L * .5, 3.4, 0, 0, TAU); ctx.fill(); ctx.restore(); continue;
    }
    const enemy = b.own === 'e' || b.vs === 1, c = enemy ? '255,110,70' : '255,205,120', L = Math.min(.075, 38 / Math.max(1, Math.hypot(b.vx, b.vy)));
    ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = 'rgba(' + c + ',' + (.7 - k * .22).toFixed(2) + ')'; ctx.lineWidth = 4.5 - k * 1.2;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * L * k / 3, b.y - b.vy * L * k / 3); ctx.lineTo(b.x - b.vx * L * (k + 1) / 3, b.y - b.vy * L * (k + 1) / 3); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(' + c + ',.14)'; ctx.beginPath(); ctx.arc(b.x, b.y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(' + c + ',.3)'; ctx.beginPath(); ctx.arc(b.x, b.y, 7.5, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'butt';
    ctx.fillStyle = enemy ? '#ffb090' : '#fff1cf'; ctx.beginPath(); ctx.arc(b.x, b.y, 3.8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.x, b.y, 1.9, 0, TAU); ctx.fill();
  }
  for (const pl of G.planes) drawPlane(pl);
  for (const m of G.missiles) drawMissile(m.x, m.y, m.h, 1.1);
  { const q = G.player; if (q && q.novaC > 0 && !q.dead) { const f = q.novaC / 3, r = 6 + 34 * f; ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(127,227,255,' + (.25 + f * .3).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(q.x + Math.cos(q.aim) * 44, q.y + Math.sin(q.aim) * 44, r, 0, TAU); ctx.fill(); ctx.globalCompositeOperation = 'source-over'; } }
  if (G.meteor) drawMeteor(G.meteor);
  for (const q of G.parts) drawPart(q);

  ctx.font = '600 ' + (13 / zoom) + 'px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of G.texts) {
    ctx.globalAlpha = 1 - f.age / f.life; ctx.fillStyle = f.col;
    ctx.fillText(f.str, f.x, f.y - f.age * 28);
  }
  ctx.globalAlpha = 1;

  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const r0 = Math.min(W, H) * .38, r1 = Math.hypot(W, H) * .6;
  let g = ctx.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, r1);
  g.addColorStop(0, 'rgba(3,12,18,0)'); g.addColorStop(1, 'rgba(3,12,18,.5)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const low = state === 'playing' && !p.dead && p.hp < p.max * .3 ? .14 + .08 * Math.sin(G.t * 6) : 0;
  const fa = G.flash * .8 + low;
  if (fa > .01) {
    g = ctx.createRadialGradient(W / 2, H / 2, r0, W / 2, H / 2, r1);
    g.addColorStop(0, 'rgba(226,85,47,0)'); g.addColorStop(1, 'rgba(226,85,47,' + Math.min(.7, fa).toFixed(3) + ')');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  if (state === 'playing') drawArrows();
  drawSticks();
}

/* ---------- HUD ---------- */
const el = {
  hpFill: $('hpFill'), hpBar: $('hpBar'), hpNum: $('hpNum'), rlFill: $('rlFill'), rumo: $('rumo'), knots: $('knots'),
  wave: $('wave'), score: $('score'), coins: $('coins'), remain: $('remain'), killsHud: $('killsHud'), ptime: $('ptime'), buff: $('buff'), cloak: $('btnCloak')
};
const cache = {};
function setText(k, v) { if (cache[k] !== v) { cache[k] = v; el[k].textContent = v; } }
/* ---------- barra do chefe (HTML) ---------- */
const bossEl = $('boss'), bsFill = $('bsFill'), bsLag = $('bsLag'), bsPct = $('bsPct'), bsName = $('bsName'), bsSt = $('bsSt'), hpLag = $('hpLag');
const BOSS_NAMES = ['Leviatã de Ferro', 'Corsário Negro', 'Tempestade Rubra', 'Senhor das Marés', 'Kraken de Aço', 'Abismo Rubro'];
const bossWide = matchMedia('(min-width: 880px) and (min-height: 480px)');
const cvGauge = $('cvGauge'), cvFill = $('cvFill'), cvNum = $('cvNum');
const gaugesEl = document.querySelector('.gauges'), wpFill = $('wpFill'), rstatsEl = $('rstats');
let hudWave = -1, hudTot = 0, hudScore = 0, hudCoins = 0;
const bump = e => { e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); };
let uiT = 0, uiDt = 0, bsLagV = 1, bsEnd = 0, bsWave = 0, bsWas = false, bsPosT = 0, hpLagV = 1;
const setT = (e, t) => { if (e.textContent !== t) e.textContent = t; };
function bossHud() {
  const now = performance.now(), bo = G && state === 'playing' ? G.enemies.find(e => e.type === 'boss' && !e.fake) : null;
  let show = false, dead = false, frac = 0;
  if (bo) { show = true; frac = clamp(bo.hp / bo.max, 0, 1); bsEnd = 0; bsWave = G.wave; }
  else if (bsWas && G && state === 'playing' && G.wave === bsWave) bsEnd = now + 1800;
  if (!show && bsEnd > now) { show = true; dead = true; }
  if (bossEl.hidden === show) { bossEl.hidden = !show; if (show) { bsLagV = frac; bossEl.style.animation = 'none'; void bossEl.offsetWidth; bossEl.style.animation = ''; } }
  document.body.classList.toggle('bossup', show && !bossWide.matches);
  if (!show) { bsWas = false; return; }
  bsWas = !dead;
  bsLagV = frac >= bsLagV ? frac : Math.max(frac, bsLagV - uiDt * .4);
  bsFill.style.transform = 'scaleX(' + frac.toFixed(3) + ')';
  bsLag.style.transform = 'scaleX(' + bsLagV.toFixed(3) + ')';
  const enr = !dead && frac < .5;
  bossEl.classList.toggle('enr', enr); bossEl.classList.toggle('dead', dead);
  setT(bsPct, Math.ceil(frac * 100) + '%');
  setT(bsName, BOSS_NAMES[(Math.max(1, Math.round(bsWave / 5)) - 1) % BOSS_NAMES.length]);
  setT(bsSt, dead ? 'Derrotado' : enr ? 'Enfurecido' : G && G.hc ? 'Hardcore' : 'Onda ' + bsWave);
  if (bossWide.matches) {
    bossEl.style.top = '';
    const mt = $('mate'); bossEl.classList.toggle('shift', !!mt && !mt.hidden);
  } else { bossEl.classList.remove('shift'); bossEl.style.top = ''; }
}
function hud() {
  uiDt = Math.min(.1, (performance.now() - uiT) / 1000 || 0); uiT = performance.now();
  bossHud();
  const mt = $('mate'), al = (G && G.allies) || [], showM = al.length > 0 && state !== 'menu';
  if (mt.hidden === showM) mt.hidden = !showM;
  const pg = $('pings'), showP = showM && state === 'playing' && !G.vs;
  if (pg.hidden === showP) pg.hidden = !showP;
  if (showM) {
    if (mt.children.length !== al.length) mt.innerHTML = al.map(() => '<div><span></span><div class="bar" style="margin-top:2px"><i style="background:var(--good)"></i></div></div>').join('');
    al.forEach((q, i) => { const r = mt.children[i], t = (q.nome || 'Aliado') + (q.shield > 0 ? ' ◈' : '') + (q.dead ? ' · afundado' : ''); if (r.firstChild.textContent !== t) r.firstChild.textContent = t; r.firstChild.style.color = G.vs ? '#e2552f' : PCOL[(q.pid || 0) % 4]; r.lastChild.firstChild.style.background = G.vs ? 'var(--rust)' : 'var(--good)'; r.lastChild.firstChild.style.transform = 'scaleX(' + clamp(q.hp / q.max, 0, 1).toFixed(3) + ')'; });
  }
  if (!G || state === 'menu') return;
  const p = G.player;
  const am = $('admMenu'), showA = !!p.admin && state === 'playing' && !p.dead;
  if (am.hidden === showA) am.hidden = !showA;
  if (showA && (cache.apow !== p.apow || cache.aopen !== apowOpen)) { cache.apow = p.apow; cache.aopen = apowOpen; am.innerHTML = '<button type="button" data-tg="1"' + (apowOpen ? ' class="on"' : '') + '>⚡ Poderes ' + (apowOpen ? '▾' : '▸') + '</button>' + (!apowOpen ? '' : APOW.map(a => '<button type="button" data-k="' + a[0] + '"' + (a[0] === p.apow ? ' class="on"' : '') + '>' + a[1] + '</button>').join('')); }
  const hp = Math.max(0, Math.ceil(p.hp));
  el.hpFill.style.transform = 'scaleX(' + clamp(p.hp / p.max, 0, 1).toFixed(3) + ')';
  el.hpBar.classList.toggle('low', p.hp < p.max * .3);
  el.hpBar.classList.toggle('ok', p.hp >= p.max * .6);
  el.hpBar.classList.toggle('sh', p.shield > 0);
  gaugesEl.classList.toggle('crit', p.hp < p.max * .3);
  { const hf = clamp(p.hp / p.max, 0, 1); hpLagV = hf >= hpLagV ? hf : Math.max(hf, hpLagV - uiDt * .5); hpLag.style.transform = 'scaleX(' + hpLagV.toFixed(3) + ')'; }
  setText('hpNum', String(hp));
  const iv = p.rel * (p.rapid > 0 ? .47 : 1);
  el.rlFill.style.transform = 'scaleX(' + (1 - clamp(p.reload / iv, 0, 1)).toFixed(3) + ')';
  el.rlFill.parentNode.classList.toggle('ok', p.reload <= 0);
  const brg = ((Math.round(p.heading * 180 / Math.PI + 90) % 360) + 360) % 360;
  setText('rumo', String(brg).padStart(3, '0') + '°');
  setText('knots', String(Math.round(p.speed / 7)));
  setText('wave', String(Math.max(1, G.wave)));
  { const on = !!(G.esc && G.conv); if (cvGauge.hidden === on) cvGauge.hidden = !on;
    if (on) { cvFill.style.transform = 'scaleX(' + clamp(G.conv.hp / G.conv.max, 0, 1).toFixed(3) + ')'; const t = String(Math.ceil(G.conv.hp)); if (cvNum.textContent !== t) cvNum.textContent = t; } }
  for (const k of ['wave', 'score', 'coins', 'remain', 'killsHud']) { const pn = el[k].parentNode; if (pn.hidden !== !!G.vs) pn.hidden = !!G.vs; }
  setText('score', fmt(G.score));
  setText('coins', fmt(G.coins));
  if (rstatsEl.hidden !== !!G.vs) rstatsEl.hidden = !!G.vs;
  if (G.score !== hudScore) { if (G.score > hudScore && hudScore > 0) bump(el.score); hudScore = G.score; }
  if (G.coins !== hudCoins) { if (G.coins > hudCoins && hudCoins > 0) bump(el.coins); hudCoins = G.coins; }
  const qLeft = MP.role === 'guest' ? (G.qn || 0) : G.queue.length;
  const rem = G.waveClearing ? 0 : qLeft + G.enemies.filter(e => !e.fake).length;
  setText('remain', String(rem));
  if (hudWave !== G.wave) { hudWave = G.wave; hudTot = 0; }
  hudTot = Math.max(hudTot, rem);
  wpFill.style.transform = 'scaleX(' + (G.waveClearing ? (G.wave > 0 ? 1 : 0) : hudTot ? 1 - rem / hudTot : 0).toFixed(3) + ')';
  setText('killsHud', fmt(G.kills));
  const tt = Math.floor(G.pt || 0), th = Math.floor(tt / 3600), tm = Math.floor(tt % 3600 / 60), ts = tt % 60;
  setText('ptime', (th ? th + ':' + String(tm).padStart(2, '0') : tm) + ':' + String(ts).padStart(2, '0'));
  const showC = (p.cloakAb || p.airAb || p.escAb || p.cloneAb || p.surgeAb || p.mslAb || p.novaAb || p.chgAb || p.tpdAb || p.vgAb || p.phxAb || p.admin) && state === 'playing' && !p.dead;
  if (el.cloak.hidden === showC) el.cloak.hidden = !showC;
  if (showC) {
    const ncl = p.cloneAb ? myCloneCount() : 0;
    { const cm = p.surgeAb || p.mslAb ? 30 : p.novaAb || p.phxAb ? 25 : p.chgAb || p.tpdAb || p.vgAb ? 20 : p.cloneAb ? CLONE_CD : p.escAb ? ESC_CD : p.airAb ? 45 : 25, pc = p.admin ? 100 : p.cloak > 0 ? Math.round(clamp(p.cloak / 9, 0, 1) * 100) : p.cloakCd > 0 ? Math.round((1 - p.cloakCd / cm) * 100) : 100;
      if (cache.cd !== pc) { cache.cd = pc; el.cloak.style.setProperty('--cd', pc + '%'); } }
    el.cloak.disabled = !p.admin && (p.cloak > 0 || p.cloakCd > 0 || ncl >= CLONE_MAX);
    el.cloak.classList.toggle('rdy', !p.admin && !el.cloak.disabled);
    el.cloak.classList.toggle('on', p.cloak > 0 || (p.surgeAb && p.rapid > 0) || (p.airAb && G.planes.length > 0) || (p.mslAb && G.missiles.length > 0) || p.novaC > 0 || p.charge > 0 || (p.escAb && G.escorts.length > 0) || (p.cloneAb && ncl >= CLONE_MAX));
    setText('cloak', p.admin ? admLabel(p) : p.vgAb ? (p.cloakCd > 0 ? 'RECARGA ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'EXPLOSÃO' : 'EXPLOSÃO · E')) : p.phxAb ? (p.cloakCd > 0 ? 'RECARGA ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'CHAMAS' : 'CHAMAS · E')) : p.novaAb ? (p.novaC > 0 ? 'LANÇAR ' + Math.round(p.novaC / 3 * 100) + '%' : p.cloakCd > 0 ? 'RECARGA ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'CARREGAR NOVA' : 'NOVA · E')) : p.chgAb ? (p.charge > 0 ? 'INVESTIDA ' + Math.ceil(p.charge) + 's' : p.cloakCd > 0 ? 'RECARGA ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'INVESTIDA' : 'INVESTIDA · E')) : p.tpdAb ? (p.cloakCd > 0 ? 'RECARGA ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'TORPEDOS' : 'TORPEDOS · E')) : p.mslAb ? (G.missiles.length ? 'MÍSSEIS ATIVOS' : p.cloakCd > 0 ? 'RECARGA ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'LANÇAR MÍSSEIS' : 'MÍSSEIS · E')) : p.surgeAb ? (p.rapid > 0 ? 'SOBRECARGA ' + Math.ceil(p.rapid) + 's' : p.cloakCd > 0 ? 'RECARGA ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'SOBRECARGA' : 'SOBRECARGA · E')) : p.cloneAb ? (ncl >= CLONE_MAX ? 'CLONES ' + ncl + '/' + CLONE_MAX : p.cloakCd > 0 ? 'CLONE ' + ncl + '/' + CLONE_MAX + ' · ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'CRIAR CLONE ' : 'CLONE · E ') + ncl + '/' + CLONE_MAX) : p.escAb ? (G.escorts.length ? 'ESCOLTA ATIVA' : p.cloakCd > 0 ? 'RECARGA ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'CHAMAR ESCOLTA' : 'ESCOLTA · E')) : (p.airAb && G.planes.length) ? 'ATACANDO' : (p.airAb && p.cloakCd <= 0) ? (touchMode ? 'CHAMAR AVIÕES' : 'AVIÕES · E') : p.cloak > 0 ? 'SUBMERSO ' + Math.ceil(p.cloak) + 's' : p.cloakCd > 0 ? 'RECARGA ' + Math.ceil(p.cloakCd) + 's' : (touchMode ? 'SUBMERGIR' : 'SUBMERGIR · E'));
  }
  const bl = [];
  if (p.rapid > 0) bl.push(['r', 'FOGO RÁPIDO', p.rapid]);
  if (p.shield > 0) bl.push(['s', 'ESCUDO', p.shield]);
  if (p.triple > 0) bl.push(['t', 'TIRO TRIPLO', p.triple]);
  const rb = bl.length > 0;
  if (el.buff.hidden === rb) el.buff.hidden = !rb;
  if (rb) { const html = bl.map(b => '<span class="bf bf-' + b[0] + (b[2] <= 2 ? ' low' : '') + '">' + b[1] + ' <b>' + Math.ceil(b[2]) + 's</b></span>').join(''); if (cache.buffH !== html) { cache.buffH = html; el.buff.innerHTML = html; } }
}

/* ---------- telas ---------- */
const ov = $('ov'), btnMain = $('btnMain'), btnAlt = $('btnAlt');
function pauseDisarm(b) { if (!b.dataset.arm) return; delete b.dataset.arm; b.textContent = b.dataset.lbl; b.classList.remove('arm'); clearTimeout(b._t); }
function pauseArm(b) { // segundo toque confirma: evita perder a partida sem querer
  if (b.dataset.arm) { pauseDisarm(b); return true; }
  b.dataset.lbl = b.textContent; b.dataset.arm = '1'; b.textContent = 'Confirmar?'; b.classList.add('arm');
  clearTimeout(b._t); b._t = setTimeout(() => pauseDisarm(b), 3000); return false;
}
function pSoundUi() { const t = $('pSoundT'); if (t) t.textContent = muted ? 'Som: desligado' : 'Som: ligado'; }
function pauseFill() {
  const p = G.player, sh = SHIPS.find(x => x.id === effShipId()) || SHIPS[0];
  try { shipThumb($('pShipCv'), sh, []); } catch (e) {}
  $('pShipName').textContent = sh.name;
  const tag = $('pModeTag'); tag.textContent = G.esc ? 'Escolta' : G.hc ? 'Hardcore' : 'Normal'; tag.className = G.esc ? 'es' : G.hc ? 'hc' : '';
  const hf = clamp(p.hp / p.max, 0, 1);
  $('pHp').style.transform = 'scaleX(' + hf.toFixed(3) + ')'; $('pHp').style.background = hf < .3 ? 'var(--rust)' : '';
  $('pHpN').textContent = Math.ceil(p.hp) + '/' + Math.round(p.max);
  const cv = G.esc && G.conv; $('pCvRow').hidden = !cv;
  if (cv) { $('pCv').style.transform = 'scaleX(' + clamp(cv.hp / cv.max, 0, 1).toFixed(3) + ')'; $('pCvN').textContent = Math.ceil(cv.hp) + '/' + Math.round(cv.max); }
  $('pWave').textContent = String(Math.max(1, G.wave)); $('pKills').textContent = String(G.kills); $('pScore').textContent = fmt(G.score);
  const t = Math.floor(G.pt || 0); $('pTime').textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0');
  pSoundUi();
}
function showOverlay(mode) {
  pauseDisarm(btnAlt); pauseDisarm($('btnMenu'));
  $('pauseInfo').hidden = mode !== 'paused'; $('pauseSet').hidden = mode !== 'paused';
  $('btnHow').hidden = mode !== 'menu'; ov.dataset.m = mode;
  $('ovStats').hidden = mode !== 'over';
  btnAlt.hidden = mode !== 'paused';
  $('btnShop').hidden = mode === 'paused';
  $('btnMenu').hidden = mode === 'menu';
  $('btnRank').hidden = !RANK_ON || mode === 'paused';
  $('btnEvt').hidden = !evtAtivo() || mode === 'paused';
  $('btnDaily').hidden = mode === 'paused'; try { dailyDot(); ensureSrv(); } catch (e) {}
  $('btnMis').hidden = mode === 'paused'; try { misDot(); } catch (e) {}
  $('btnFr').hidden = !RANK_ON || mode === 'paused'; try { frPoll(); } catch (e) {}
  $('btnAcct').hidden = mode === 'paused';
  $('btnAch').hidden = mode === 'paused';
  $('btnAdm').hidden = !ADMIN || mode === 'paused';
  $('btnMp').hidden = mode === 'paused';
  $('btnVs').hidden = true;
  refreshAcct();
  $('sendMsg').textContent = '';
  $('bal').textContent = '$ ' + fmt(save.coins);
  if (mode === 'menu') {
    $('ovKicker').textContent = 'Frota inimiga avistada';
    $('ovTitle').textContent = 'Naval Warfare';
    $('ovLead').textContent = '';
    btnMain.textContent = 'Zarpar';
  } else if (mode === 'paused') {
    $('ovKicker').textContent = 'Pausado';
    $('ovTitle').textContent = 'Em espera';
    $('ovLead').textContent = touchMode ? 'Toque em Continuar para voltar ao mar.' : 'Pressione P ou Esc para continuar.';
    btnMain.textContent = 'Continuar';
    pauseFill();
  } else {
    $('ovKicker').textContent = G.hc ? 'Hardcore · navio afundado' : 'Navio afundado';
    $('ovTitle').textContent = 'Afundado';
    $('ovLead').textContent = G.newRecord ? 'Novo recorde de pontos.' : 'Seu navio foi afundado na onda ' + G.wave + '.';
    $('sWave').textContent = String(G.wave);
    $('sKills').textContent = String(G.kills);
    $('sScore').textContent = fmt(G.score);
    $('sBest').textContent = fmt(best);
    $('sCoins').textContent = fmt(G.coins);
    btnMain.textContent = MP.role === 'host' && MP.guests.length ? 'Revanche' : MP.role === 'guest' ? 'Aguardando anfitrião…' : 'Zarpar de novo';
    if (MP.role === 'guest') $('ovLead').textContent += ' Aguarde o anfitrião iniciar a revanche.';
    else if (MP.role === 'host' && MP.guests.length) $('ovLead').textContent += ' A esquadra continua na sala: toque em Revanche.';
  }
  if (mode === 'over' && G.hc && !MP.role) btnMain.textContent = 'Hardcore de novo';
  if (mode === 'over' && G.esc) {
    const lost = G.conv && G.conv.dead;
    $('ovKicker').textContent = 'Escolta · ' + (lost ? 'comboio afundado' : 'navio afundado');
    $('ovTitle').textContent = lost ? 'Comboio perdido' : 'Afundado';
    $('ovLead').textContent = (G.newRecord ? 'Novo recorde de escolta: onda ' + G.wave + '.' : 'Você escoltou o comboio até a onda ' + G.wave + '.') +
      (MP.role === 'guest' ? ' Aguarde o anfitrião iniciar a revanche.' : MP.role === 'host' && MP.guests.length ? ' A esquadra continua na sala: toque em Revanche.' : '');
    $('sBest').textContent = 'Onda ' + escBest;
    if (!MP.role) btnMain.textContent = 'Escolta de novo';
  }
  if (mode === 'over' && G.vs) {
    const r = G.vsRes;
    $('ovKicker').textContent = 'Duelo 1×1';
    $('ovTitle').textContent = r === 'win' ? 'Vitória' : r === 'lose' ? 'Derrota' : r === 'draw' ? 'Empate' : 'Fim do duelo';
    $('ovLead').textContent = (r === 'win' ? 'Você afundou o oponente.' : r === 'lose' ? 'Seu navio foi afundado.' : r === 'draw' ? 'Os dois navios afundaram juntos.' : 'O oponente saiu da partida.') +
      (MP.role === 'guest' ? ' Aguarde o anfitrião iniciar a revanche.' : MP.role === 'host' && MP.guests.length ? ' Toque em Revanche para jogar de novo.' : '');
    $('ovStats').hidden = true;
  }
  ov.hidden = false;
  try { btnMain.focus({ preventScroll: true }); } catch (e) {}
}
function startGame(hard, esc) {
  if (MP.role === 'guest') { $('ovLead').textContent = 'Aguardando o anfitrião iniciar a revanche…'; return; }
  if (MP.role === 'host' && MP.guests.length && state === 'over') { mpStartHost(); return; }
  if (MP.role) mpLeave();
  escMode = !!esc; hardMode = !!hard && !escMode;
  initAudio();
  newGame(); applyItems();
  if (escMode) { G.esc = 1; convInit(); }
  for (const k of ['move', 'aim']) sticks[k] = null;
  setState('playing');
  ov.hidden = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}
let resumeCd = 0;
const cdEl = $('resumeCd');
function pauseGame() {
  if (state !== 'playing' || G.player.dead || MP.role) return;
  resumeCd = 0; cdEl.hidden = true;
  setState('paused'); showOverlay('paused');
}
function resumeGame() { // volta ao jogo com contagem 3-2-1 para dar tempo de pegar nos controles
  if (state !== 'paused') return;
  setState('playing'); ov.hidden = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  last = performance.now();
  resumeCd = 2.4; cdEl.textContent = '3'; cdEl.style.animation = 'none'; void cdEl.offsetWidth; cdEl.style.animation = ''; cdEl.hidden = false;
}
function tickResume(dt) {
  if (!(resumeCd > 0)) return;
  resumeCd -= dt;
  const n = Math.ceil(resumeCd / .8);
  if (n <= 0) { resumeCd = 0; cdEl.hidden = true; return; }
  if (cdEl.textContent !== String(n)) { cdEl.textContent = String(n); cdEl.style.animation = 'none'; void cdEl.offsetWidth; cdEl.style.animation = ''; }
}
function togglePause() { if (state === 'playing') pauseGame(); else if (state === 'paused') resumeGame(); }
function gameOver() {
  G.newRecord = false;
  misAdd('games', 1); misAdd('score', G.score, 1);
  if (G.esc) {
    if (G.wave > escBest) { escBest = G.wave; G.newRecord = G.wave > 1; try { localStorage.setItem(KEY_ESC, String(escBest)); } catch (e) {} }
  } else if (G.score > best && !G.hc) {
    best = G.score; G.newRecord = G.score > 0;
    try { localStorage.setItem(KEY_BEST, String(best)); } catch (e) {}
  }
  setState('over'); showOverlay('over');
  if (G.newRecord) sfx.record(); else sfx.lose();
  if (RANK_ON && !G.hc && !G.esc) submitScore();
  if (MP.role === 'host') mpSend({ t: 'end', w: G.wave, sc: Math.floor(G.score), k: G.kills, c: G.coins });
}
const modeEl = $('modeEl');
let lHard = false, lEsc = false, fromLaunch = false;
const lFleet = $('lFleet'), lShipEl = $('lShip');
const lMaxima = () => { const l = SHIPS.filter(x => !x.adminOnly); return { hp: Math.max(...l.map(x => x.hp)), dps: Math.max(...l.map(x => x.dmg * (x.multi || 1) / x.rel)), spd: Math.max(...l.map(x => x.speed)) }; };
function launchDetail() {
  const sh = SHIPS.find(x => x.id === save.ship) || SHIPS[0], mx = lMaxima(), dps = sh.dmg * (sh.multi || 1) / sh.rel;
  const row = (l, v, m, txt) => '<div class="lstat"><span>' + l + '</span><div class="bar"><i style="transform:scaleX(' + clamp(v / m, .04, 1).toFixed(3) + ')"></i></div><span>' + txt + '</span></div>';
  lShipEl.innerHTML = '<div class="ln"><b>' + sh.name + '</b>' + rarTag(sh) + '</div>'
    + row('Casco', sh.hp, mx.hp, sh.hp) + row('Poder de fogo', dps, mx.dps, Math.round(dps)) + row('Velocidade', sh.speed, mx.spd, sh.speed)
    + (sh.note ? '<p class="lpow"><b>Poder</b>' + sh.note + '</p>' : '');
}
function launchSelect(id, quiet) {
  if (!save.owned.includes(id)) return;
  if (save.ship !== id) { save.ship = id; persist(); if (!quiet) sfx.click(); }
  for (const c of lFleet.children) { const on = c.dataset.id === id; c.classList.toggle('on', on); c.setAttribute('aria-selected', on); c.tabIndex = on ? 0 : -1; }
  launchDetail();
}
function launchModeSet(hard, esc) {
  lEsc = !!esc; lHard = !!hard && !lEsc;
  $('modeNormal').setAttribute('aria-pressed', String(!lHard && !lEsc));
  $('modeHard').setAttribute('aria-pressed', String(lHard));
  $('modeEsc').setAttribute('aria-pressed', String(lEsc));
  $('modeGo').textContent = lEsc ? 'Zarpar · Escolta' : lHard ? 'Zarpar · Hardcore' : 'Zarpar';
}
function openLaunch() {
  const list = shopShips().filter(x => save.owned.includes(x.id));
  if (!list.some(x => x.id === save.ship)) { save.ship = 'corveta'; persist(); }
  $('lBal').textContent = '$ ' + fmt(save.coins);
  lFleet.innerHTML = list.map(x => '<button type="button" class="lcard" role="option" data-id="' + x.id + '"><canvas width="192" height="96"></canvas><b>' + x.name + '</b>' + rarTag(x) + '</button>').join('');
  modeEl.hidden = false;
  for (const c of lFleet.children) { const sh = SHIPS.find(x => x.id === c.dataset.id); try { shipThumb(c.querySelector('canvas'), sh, []); } catch (e) {} }
  launchSelect(save.ship, true);
  launchModeSet(hardMode, escMode);
  const cur = lFleet.querySelector('.lcard.on');
  if (cur) lFleet.scrollLeft = Math.max(0, cur.offsetLeft - (lFleet.clientWidth - cur.offsetWidth) / 2 - lFleet.offsetLeft);
  try { $('modeGo').focus({ preventScroll: true }); } catch (e) {}
}
btnMain.addEventListener('click', () => {
  if (state === 'paused') resumeGame();
  else if (state === 'menu' && !MP.role) openLaunch();
  else startGame(state === 'over' && hardMode, state === 'over' && escMode);
});
lFleet.addEventListener('click', e => { const c = e.target.closest('.lcard'); if (c) launchSelect(c.dataset.id); });
lFleet.addEventListener('keydown', e => {
  if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
  const cs = [...lFleet.children], i = cs.findIndex(c => c.classList.contains('on')), n = cs[clamp(i + (e.code === 'ArrowRight' ? 1 : -1), 0, cs.length - 1)];
  if (n) { launchSelect(n.dataset.id); n.focus(); n.scrollIntoView({ inline: 'nearest', block: 'nearest' }); e.stopPropagation(); }
});
$('modeNormal').addEventListener('click', () => { sfx.click(); launchModeSet(false, false); });
$('modeHard').addEventListener('click', () => { sfx.click(); launchModeSet(true, false); });
$('modeEsc').addEventListener('click', () => { sfx.click(); launchModeSet(false, true); });
$('modeGo').addEventListener('click', () => { modeEl.hidden = true; startGame(lHard, lEsc); });
$('modeShop').addEventListener('click', () => { fromLaunch = true; modeEl.hidden = true; $('btnShop').click(); });
$('modeBack').addEventListener('click', () => { modeEl.hidden = true; try { btnMain.focus({ preventScroll: true }); } catch (e) {} });
btnAlt.addEventListener('click', () => { if (state === 'paused' && !pauseArm(btnAlt)) return; startGame(hardMode, escMode); });
$('btnMenu').addEventListener('click', () => {
  if (state === 'paused' && !pauseArm($('btnMenu'))) return;
  if (MP.role) mpLeave();
  newGame();
  for (const k of ['move', 'aim']) sticks[k] = null;
  setState('menu'); showOverlay('menu');
});
$('btnPause').addEventListener('click', e => { togglePause(); e.currentTarget.blur(); });
$('btnSound').addEventListener('click', e => {
  muted = !muted;
  initAudio();
  if (master) master.gain.value = muted ? 0 : cfg.vol / 100;
  const b = e.currentTarget;
  b.classList.toggle('off', muted);
  b.setAttribute('aria-pressed', String(!muted));
  b.setAttribute('aria-label', muted ? 'Som desligado' : 'Som ligado');
  b.blur();
});


/* ---------- ranking (Supabase) ---------- */
const SUPABASE_URL = 'https://oijifukwijrmhobapkae.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pamlmdWt3aWpybWhvYmFwa2FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA5NzY2MTMsImV4cCI6MjEwNjU1MjYxM30.Lq9QO8IWZ--hOE_qmZeJzGxz5DTqfT1aK7dH3egIKgg';
const RANK_ON = SUPABASE_URL.startsWith('https://') && SUPABASE_KEY.length > 20;
const rankEl = $('rank');
const esc = t => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SESS_KEY = 'mf_sessao';
let sess = null;
try { sess = JSON.parse(localStorage.getItem(SESS_KEY)); } catch (e) {}
async function authCall(path, body) {
  const r = await fetch(SUPABASE_URL + '/auth/v1/' + path, { method: 'POST', headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { ok: r.ok, d: await r.json().catch(() => ({})) };
}
function setSess(d, nome) {
  sess = { at: d.access_token, rt: d.refresh_token, exp: Date.now() + (d.expires_in || 3600) * 1000 - 60000, id: d.user.id, nome };
  try { localStorage.setItem(SESS_KEY, JSON.stringify(sess)); } catch (e) {}
}
async function token() {
  if (!sess) return null;
  if (Date.now() > sess.exp) {
    const r = await authCall('token?grant_type=refresh_token', { refresh_token: sess.rt });
    if (!r.ok) { logout(); return null; }
    setSess(r.d, sess.nome);
  }
  return sess.at;
}
async function api(path, opts) {
  const t = await token();
  return fetch(SUPABASE_URL + '/rest/v1/' + path, Object.assign({
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + (t || SUPABASE_KEY), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates' }
  }, opts));
}
function applyCloud(d) {
  const sv = d && d.save;
  if (sv && typeof sv === 'object') {
    save.coins = Math.max(0, Number(sv.coins) || 0);
    save.owned = (Array.isArray(sv.owned) ? sv.owned : ['corveta']).filter(id => SHIPS.some(x => x.id === id));
    if (!save.owned.includes('corveta')) save.owned.unshift('corveta');
    save.ship = SHIPS.some(x => x.id === sv.ship) && save.owned.includes(sv.ship) ? sv.ship : 'corveta';
    save.up = normUp(sv, save.owned);
    loadExtra(sv);
  }
  best = Math.max(0, Number(d && d.best) || 0);
  try { localStorage.setItem(KEY_SAVE, JSON.stringify(save)); localStorage.setItem(KEY_BEST, String(best)); } catch (e) {}
}
let cloudT = 0, lastSync = 0;
function cloudSoon() { if (!sess) return; clearTimeout(cloudT); cloudT = setTimeout(pushCloud, 2500); }
async function pushCloud() {
  if (!sess) return;
  clearTimeout(cloudT);
  try { const r = await api('perfis?on_conflict=user_id', { method: 'POST', keepalive: true, body: JSON.stringify({ user_id: sess.id, dados: { save, best }, atualizado: new Date().toISOString() }) }); if (r.ok) lastSync = Date.now(); return r.ok; } catch (e) { return false; }
}
async function pullCloud() {
  try {
    const r = await api('perfis?user_id=eq.' + sess.id + '&select=dados');
    const d = await r.json();
    if (!Array.isArray(d)) return;
    const dono = localStorage.getItem('mf_dono');
    if (d.length) {
      const cts = Number(d[0].dados && d[0].dados.save && d[0].dados.save.ts) || 0;
      if (dono === sess.id && save.ts > cts) await pushCloud();
      else applyCloud(d[0].dados);
    } else await pushCloud();
    localStorage.setItem('mf_dono', sess.id);
  } catch (e) {}
}
document.addEventListener('visibilitychange', () => { if (document.hidden) pushCloud(); });
window.addEventListener('pagehide', () => { pushCloud(); });
function logout() {
  sess = null; ADMIN = false; $('btnAdm').hidden = true;
  try { localStorage.removeItem(SESS_KEY); localStorage.removeItem(KEY_SAVE); localStorage.removeItem(KEY_BEST); localStorage.removeItem('mf_dono'); } catch (e) {}
  Object.assign(save, { prof: { bio: '', photo: '' }, coins: 0, ship: 'corveta', owned: ['corveta'], up: {}, ach: {}, kills: 0, bosses: 0, sharks: 0, ts: 0, play: 0, maxWave: 0, items: { shield: 0, triple: 0 }, acc: { own: [], on: [] }, evt: { id: 'colheita-sombria', kills: 0, bosses: 0, notif: 0 }, daily: { streak: 0, last: '' }, wk: { paid: '' } });
  best = 0; refreshAcct();
}
function refreshAcct() {
  $('btnAcct').textContent = sess ? 'Conta: ' + sess.nome : 'Entrar / Criar conta';
  $('bal').textContent = '$ ' + fmt(save.coins);
}
async function doAuth(signup) {
  const go = $('aGo'); go.disabled = true;
  try { await doAuth0(signup); } finally { go.disabled = false; }
}
async function doAuth0(signup) {
  const nome = $('aUser').value.trim().toLowerCase(), pw = $('aPass').value, m = $('aMsg');
  if (!/^[a-z0-9_]{3,16}$/.test(nome)) { m.textContent = 'Nome inválido: use 3 a 16 letras minúsculas, números ou _.'; return; }
  if (pw.length < 6) { m.textContent = 'A senha precisa ter pelo menos 6 caracteres.'; return; }
  if (signup && pw !== $('aPass2').value) { m.textContent = 'As senhas não são iguais.'; return; }
  m.textContent = 'Aguarde…';
  try {
    const body = { email: nome + '@marferro.app', password: pw };
    let r = await authCall(signup ? 'signup' : 'token?grant_type=password', body);
    if (signup && r.ok && !r.d.access_token) { m.textContent = 'Conta criada, mas o Supabase exige confirmação por e-mail. Desligue "Confirm email" nas configurações.'; return; }
    if (!r.ok) {
      const t = String(r.d.msg || r.d.error_description || r.d.message || '');
      m.textContent = /already|registered/i.test(t) ? 'Esse nome já existe.' : /invalid login/i.test(t) ? 'Nome ou senha incorretos.' : 'Erro: ' + (t || 'tente de novo.');
      return;
    }
    setSess(r.d, nome);
    await pullCloud(); checkAdmin().then(() => weeklyPrize());
    $('aPass').value = ''; $('aPass2').value = ''; m.textContent = '';
    $('auth').hidden = true; refreshAcct();
  } catch (e) { m.textContent = 'Sem conexão. Tente de novo.'; }
}
let aMode = 'login';
function setAMode(m) {
  aMode = m;
  for (const t of $('aTabs').children) t.classList.toggle('on', t.dataset.m === m);
  $('aPass2').hidden = m !== 'signup'; $('aGo').textContent = m === 'signup' ? 'Criar conta' : 'Entrar';
  $('aPass').autocomplete = m === 'signup' ? 'new-password' : 'current-password';
  $('aNote').textContent = m === 'signup' ? 'Nome: 3 a 16 letras minúsculas, números ou _. Senha: mínimo 6. Não há e-mail: se esquecer a senha, não dá para recuperar a conta.' : 'Entre para carregar seu progresso salvo (moedas, navios, melhorias e recorde).';
  $('aMsg').textContent = '';
}
function fillAcct() {
  $('pName').textContent = sess.nome + (ADMIN ? ' ★ ADMIN' : ''); $('pAdm').hidden = !ADMIN;
  const kv = (k, v) => '<div><dt>' + k + '</dt><dd>' + v + '</dd></div>';
  $('pStats').innerHTML = kv('Recorde', fmt(best)) + kv('Navios afundados', fmt(save.kills)) + kv('Chefes', fmt(save.bosses)) + kv('Frota', save.owned.filter(id => ADMIN || isPub(id)).length + '/' + (ADMIN ? SHIPS.length : PUB_N)) + kv('Conquistas', ACH.filter(x => save.ach[x.id]).length + '/' + ACH.length) + kv('Moedas', fmt(save.coins));
  $('pSync').textContent = lastSync ? 'Última sincronização: ' + new Date(lastSync).toLocaleTimeString() : 'Progresso salvo na nuvem automaticamente.';
  $('pMsg').textContent = ''; $('pNew').value = '';
}
$('btnAcct').addEventListener('click', () => {
  if (sess) { fillAcct(); $('acctEl').hidden = false; }
  else { setAMode('login'); $('auth').hidden = false; }
});
$('aTabs').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) setAMode(b.dataset.m); });
$('aGo').addEventListener('click', () => doAuth(aMode === 'signup'));
$('aShow').addEventListener('click', () => { const h = $('aPass').type === 'password'; $('aPass').type = h ? 'text' : 'password'; $('aPass2').type = $('aPass').type; $('aShow').textContent = h ? 'ocultar' : 'ver'; });
for (const id of ['aUser', 'aPass', 'aPass2', 'pNew']) {
  $(id).addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { if (id === 'pNew') $('pPass').click(); else $('aGo').click(); } });
  $(id).addEventListener('keyup', e => e.stopPropagation());
}
$('aUser').addEventListener('input', e => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
$('pBack').addEventListener('click', () => { $('acctEl').hidden = true; });
$('pOut').addEventListener('click', () => { if (confirm('Sair da conta ' + sess.nome + '?')) { logout(); $('acctEl').hidden = true; } });
$('pSyncBtn').addEventListener('click', async () => { $('pMsg').textContent = 'Sincronizando…'; const ok = await pushCloud(); fillAcct(); $('pMsg').textContent = ok ? 'Progresso sincronizado.' : 'Falha ao sincronizar. Verifique a internet.'; });
$('pPass').addEventListener('click', async () => {
  const pw = $('pNew').value, m = $('pMsg');
  if (pw.length < 6) { m.textContent = 'A nova senha precisa ter pelo menos 6 caracteres.'; return; }
  m.textContent = 'Alterando…';
  try {
    const t = await token();
    const r = await fetch(SUPABASE_URL + '/auth/v1/user', { method: 'PUT', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    $('pNew').value = ''; m.textContent = r.ok ? 'Senha alterada.' : 'Não foi possível alterar. Saia e entre de novo, depois tente outra vez.';
  } catch (e) { m.textContent = 'Sem conexão. Tente de novo.'; }
});
$('aBack').addEventListener('click', () => { $('auth').hidden = true; });
const REN_TXT = {
  nome_invalido: 'Nome inválido: use 3 a 16 letras minúsculas, números ou _.', mesmo_nome: 'Esse já é o seu nome.',
  espere: 'Você trocou de nome há pouco. Espere 7 dias entre as trocas.', nome_em_uso: 'Esse nome já está em uso.',
  banido: 'Contas banidas não podem trocar de nome.', sem_login: 'Entre numa conta primeiro.'
};
$('pRename').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('pRenBtn').click(); });
$('pRename').addEventListener('keyup', e => e.stopPropagation());
$('pRename').addEventListener('input', e => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
$('pRenBtn').addEventListener('click', async () => {
  const n = $('pRename').value.trim().toLowerCase(), m = $('pMsg'), b = $('pRenBtn');
  if (!sess) return;
  if (!/^[a-z0-9_]{3,16}$/.test(n)) { m.textContent = 'Nome inválido: use 3 a 16 letras minúsculas, números ou _.'; return; }
  if (n === sess.nome) { m.textContent = 'Esse já é o seu nome.'; return; }
  if (!confirm('Trocar seu nome para "' + n + '"?\n\nVocê entrará com o nome novo e só poderá trocar de novo daqui a 7 dias.')) return;
  m.textContent = 'Trocando…'; b.disabled = true;
  try {
    const r = await rpc('mf_trocar_nome', { p_novo: n });
    if (r === 'ok') {
      const old = sess.nome; sess.nome = n;
      try { localStorage.setItem(SESS_KEY, JSON.stringify(sess)); } catch (e) {}
      if (ADMINS.has(old)) { ADMINS.delete(old); ADMINS.add(n); }
      $('pRename').value = ''; refreshAcct(); $('pName').textContent = n + (ADMIN ? ' ★ ADMIN' : '');
      m.textContent = 'Nome alterado! Use "' + n + '" para entrar da próxima vez.';
      try { pushCloud(); } catch (e) {}
    } else if (r && typeof r === 'object' && r.code === 'PGRST202') m.textContent = 'Falta instalar o trocar_nome.sql no servidor.';
    else m.textContent = (typeof r === 'string' && REN_TXT[r]) || 'Não foi possível trocar o nome. Tente de novo.';
  } catch (e) { m.textContent = 'Sem conexão. Tente de novo.'; } finally { b.disabled = false; }
});
async function submitScore() {
  const msg = $('sendMsg');
  if (G.score <= 0) return;
  if (!sess) { msg.textContent = 'Entre numa conta para salvar o progresso e aparecer no ranking.'; return; }
  const pontos = Math.floor(G.score);
  msg.textContent = 'Salvando…';
  if (ADMIN) { try { pushCloud(); msg.textContent = 'Progresso salvo. Contas de admin não entram no ranking.'; } catch (e) { msg.textContent = 'Sem conexão: não foi possível salvar.'; } return; }
  try {
    pushCloud();
    rpc('enviar_pontos_semana', { p_pontos: pontos, p_onda: G.wave }).catch(() => {});
    const cur = await (await api('ranking?user_id=eq.' + sess.id + '&select=pontos')).json();
    if (Array.isArray(cur) && cur.length && cur[0].pontos >= pontos) { msg.textContent = 'Progresso salvo.'; return; }
    const r = await api('ranking?on_conflict=user_id', { method: 'POST', body: JSON.stringify({ user_id: sess.id, nome: sess.nome, pontos, onda: G.wave }) });
    msg.textContent = r.ok ? 'Progresso salvo e pontuação enviada ao ranking.' : 'Não foi possível enviar ao ranking.';
  } catch (e) { msg.textContent = 'Sem conexão: não foi possível salvar.'; }
}
let rankTab = 'semana', rkFim = 0;
const hh = v => { v = Math.floor(Number(v) || 0); return Math.floor(v / 3600) + ' h ' + Math.floor(v % 3600 / 60) + ' min'; };
const MEDAL = ['#e0a93c', '#c9d8db', '#b9733a'];
function rkMsg(t, retry) { rkTok++;
  $('rankBody').innerHTML = '<p class="note" style="text-align:center;padding:18px 0">' + esc(t) + '</p>' +
    (retry ? '<div style="text-align:center"><button class="btn ghost" data-retry="1" type="button" style="font-size:15px;padding:6px 16px">Tentar de novo</button></div>' : '');
}
function rkSkel() { rkTok++; $('rankBody').innerHTML = '<div class="rk-list">' + '<div class="rk-sk"></div>'.repeat(7) + '</div>'; }
const rkIc = (d, z) => '<svg viewBox="0 0 24 24" width="' + z + '" height="' + z + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const IC_CROWN = '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>', IC_CLOCK = '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>';
const avH = n => ([...String(n)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7) >>> 0) % 360;
const THUMBS = new Map(), okThumb = t => typeof t === 'string' && t.length <= 45000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(t);
async function loadThumbs(names) { // busca de uma vez as fotos de quem aparece na lista (cache de 5 min)
  const now = Date.now(), need = [...new Set(names)].filter(n => { const c = THUMBS.get(n); return !c || now - c[1] > 300000; }).slice(0, 60);
  if (!need.length) return;
  try {
    const d = await rpc('fotos_mini', { p_nomes: need });
    if (!Array.isArray(d)) return;
    for (const n of need) THUMBS.set(n, ['', now]);
    for (const x of d) if (x && okThumb(x.foto)) THUMBS.set(String(x.nome), [x.foto, now]);
  } catch (e) {}
}
const avEl = (n, extra) => { const own = sess && n === sess.nome, c = THUMBS.get(n), ph = own ? (save.prof && (save.prof.thumb || save.prof.photo)) : (c && c[0]); return '<span class="rk-av' + (extra ? ' ' + extra : '') + '" style="--h:' + avH(n) + '" aria-hidden="true">' + (ph ? '<img alt="" src="' + esc(ph) + '">' : esc(String(n).charAt(0).toUpperCase())) + '</span>'; };
let rkTok = 0;
async function rkRender(items, o) { const tok = rkTok; await loadThumbs(items.map(x => x.nome)); if (tok === rkTok) rkRender0(items, o); }
function rkRender0(items, o) {
  const me = sess && sess.nome, top = Math.max(1, items[0].val), pod = o.rank && items.length >= 3;
  const mine = it => it.nome === me;
  const row = (it, i) => '<div class="rk-row' + (mine(it) ? ' me' : '') + '" data-n="' + esc(it.nome) + '" tabindex="0" role="button" style="--w:' + Math.round(clamp(it.val / top, 0, 1) * 100) + '%">' +
    '<span class="rk-pos">' + (o.rank ? i + 1 : '·') + '</span>' + avEl(it.nome) + '<div style="min-width:0"><div class="rk-name">' + esc(it.nome) + adm(it.nome) + (mine(it) ? '<em class="rk-you">você</em>' : '') + '</div>' +
    (it.sub ? '<div class="rk-sub">' + esc(it.sub) + '</div>' : '') + '</div><span class="rk-val">' + esc(it.txt) + '</span></div>';
  const card = (it, i) => '<div class="rk-card p' + (i + 1) + (mine(it) ? ' me' : '') + '" data-n="' + esc(it.nome) + '" tabindex="0" role="button" style="--c:' + MEDAL[i] + '">' + (i === 0 ? '<div class="rk-crown">' + rkIc(IC_CROWN, 18) + '</div>' : '') +
    '<div class="rk-avw">' + avEl(it.nome) + '<b class="rk-medal">' + (i + 1) + '</b></div>' +
    '<div class="rk-name">' + esc(it.nome) + adm(it.nome) + (mine(it) ? '<em class="rk-you">você</em>' : '') + '</div><div class="rk-val">' + esc(it.txt) + '</div><div class="rk-sub">' + esc(it.sub || '') + '</div></div>';
  let h = '';
  if (pod) h += '<div class="rk-pod">' + card(items[1], 1) + card(items[0], 0) + card(items[2], 2) + '</div>';
  const from = pod ? 3 : 0;
  h += '<div class="rk-list">' + items.slice(from).map((it, k) => row(it, from + k)).join('') + '</div>';
  $('rankBody').innerHTML = h;
}
async function rkMe(items, tab, eu) {
  const el = $('rankMe');
  const msg = t => { el.hidden = false; el.className = 'rk-meb'; el.textContent = t; };
  const box = (pos, txt) => { el.hidden = false; el.className = 'rk-meb pos'; el.innerHTML = '<b class="mp-n">#' + pos + '</b><span><small>Sua posição</small>' + txt + '</span>'; };
  if (!sess) { msg('Entre numa conta para aparecer no ranking.'); return; }
  if (ADMIN) { msg('Contas de admin não aparecem no ranking.'); return; }
  const i = items.findIndex(x => x.nome === sess.nome);
  if (i >= 0) { box(i + 1, esc(items[i].txt) + (items[i].sub ? ' · ' + esc(items[i].sub) : '')); return; }
  if (tab === 'semana') { if (eu) box(num(eu.pos), fmt(+eu.pontos || 0) + ' · onda ' + num(eu.onda)); else msg('Você ainda não pontuou nesta semana. Jogue uma partida logado!'); return; }
  if (tab === 'pontos') {
    try {
      const d = await rpc('perfil_publico', { p_nome: sess.nome });
      if (tab !== rankTab) return;
      if (d && d.ranking) { box(num(d.ranking.pos), 'melhor onda ' + num(d.ranking.onda)); return; }
    } catch (e) {}
  }
  if (tab === rankTab) msg(tab === 'pontos' ? 'Você ainda não enviou pontuação. Jogue uma partida logado!' : 'Você ainda não está entre os primeiros desta lista.');
}
function rkTick() {
  const c = $('rkCount'); if (!c || !rkFim) return;
  let ms = rkFim - Date.now();
  if (ms <= 0) { weeklyPrize(); if (rankTab === 'semana' && !rankEl.hidden) openRank(); return; }
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60), mi = m % 60;
  c.innerHTML = rkIc(IC_CLOCK, 14) + '<span>A semana zera em <b>' + (d ? d + ' d ' : '') + h + ' h ' + String(mi).padStart(2, '0') + ' min</b> (domingo 00:00, Brasília)</span>';
}
setInterval(() => { if (!rankEl.hidden && rankTab === 'semana') rkTick(); }, 30000);
function topCheck(tab, items) { if (!sess || ADMIN) return; const i = items.slice(0, 3).findIndex(x => x.nome === sess.nome); if (i >= 0 && !(TOPNOW[tab] <= i + 1)) { TOPNOW[tab] = i + 1; checkAch(); } }
const rkNoAdm = l => l.filter(x => !ADMINS.has(x.nome)).slice(0, 25);
async function openRank() {
  ensureThumb();
  rankEl.hidden = false; $('pMine').hidden = !sess;
  const tab = rankTab;
  for (const t of $('rTabs').children) t.classList.toggle('on', t.dataset.tab === tab);
  $('rankMe').hidden = true; $('rankInfo').hidden = true; rkSkel();
  try {
    let items;
    await ADMINS_READY;
    if (tab === 'semana') {
      const d = await rpc('ranking_semana', { p_limit: 60 });
      if (!d || !Array.isArray(d.lista)) throw 0;
      if (tab !== rankTab) return;
      rkFim = Date.parse(d.fim) || 0;
      const inf = $('rankInfo'); inf.hidden = false;
      inf.innerHTML = '<span id="rkCount"></span><span>🏆 Prêmios: 🥇 ' + fmt(WK_PRIZE[0]) + ' · 🥈 ' + fmt(WK_PRIZE[1]) + ' · 🥉 ' + fmt(WK_PRIZE[2]) + ' moedas</span>' + (d.anterior ? '<span>' + rkIc(IC_CROWN, 14) + '<span>Campeão da semana passada: <b>' + esc(d.anterior.nome) + '</b> · ' + fmt(+d.anterior.pontos || 0) + '</span></span>' : '');
      rkTick();
      items = rkNoAdm(d.lista.map(x => ({ nome: String(x.nome), val: +x.pontos || 0, txt: fmt(+x.pontos || 0), sub: 'onda ' + (x.onda || 0) })));
      topCheck(tab, items);
      if (!items.length) { rkMsg('Ninguém pontuou nesta semana ainda. Seja o primeiro!'); rkMe(items, tab, d.eu); return; }
      rkRender(items, { rank: true }); rkMe(items, tab, d.eu); return;
    }
    if (tab === 'pontos') {
      const d = await (await api('ranking?select=nome,pontos,onda&order=pontos.desc&limit=60')).json();
      if (!Array.isArray(d)) throw 0;
      items = rkNoAdm(d.map(x => ({ nome: String(x.nome), val: +x.pontos || 0, txt: fmt(+x.pontos || 0), sub: 'onda ' + (x.onda || 0) })));
    } else {
      const d = await rpc('ranking_tipo', { p_tipo: tab });
      if (!Array.isArray(d)) throw 0;
      items = rkNoAdm(d.map(x => ({ nome: String(x.nome), val: +x.valor || 0, txt: tab === 'horas' ? hh(x.valor) : fmt(+x.valor || 0), sub: tab === 'horas' ? '' : 'abates' })));
    }
    topCheck(tab, items);
    if (tab !== rankTab) return;
    if (!items.length) { rkMsg('Ainda não há dados. Seja o primeiro a aparecer!'); return; }
    rkRender(items, { rank: true }); rkMe(items, tab);
  } catch (e) { if (tab === rankTab) rkMsg('Não foi possível carregar o ranking.', true); }
}
$('btnRank').addEventListener('click', openRank);
$('rankBack').addEventListener('click', () => { rankEl.hidden = true; });
$('rTabs').addEventListener('click', e => { const t = e.target.closest('[data-tab]'); if (t) { rankTab = t.dataset.tab; openRank(); } });

/* ---------- perfis ---------- */
const profEl = $('prof'); let curProf = '';
const kv = (k, v) => '<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-top:1px solid var(--line)"><span style="color:var(--steel)">' + k + '</span><b style="text-align:right">' + v + '</b></div>';
const num = v => fmt(Math.max(0, Math.floor(Number(v) || 0)));
const dia = v => { const t = Date.parse(v); return t ? new Date(t).toLocaleDateString('pt-BR') : '—'; };
async function openProfile(nome) {
  rankEl.hidden = true; profEl.hidden = false;
  $('profName').textContent = nome;
  const b = $('profBody'); b.textContent = 'Carregando…'; $('profEdit').hidden = true; $('profFriend').hidden = true; $('profMsg').textContent = '';
  try {
    const r = await api('rpc/perfil_publico', { method: 'POST', body: JSON.stringify({ p_nome: nome }) });
    const d = await r.json();
    if (!d || !d.nome) { b.textContent = 'Jogador não encontrado.'; return; }
    const adm = ADMINS.has(d.nome);
    $('profName').textContent = d.nome; curProf = d.nome;
    const sv = d.save || {}, rk = d.ranking;
    const owned = (Array.isArray(sv.owned) ? sv.owned : ['corveta']).map(id => SHIPS.find(s => s.id === id)).filter(s => s && (adm || isPub(s.id)));
    const ship = SHIPS.find(s => s.id === sv.ship) || SHIPS[0];
    const upS = (sv.up && sv.up[ship.id]) || {}; // as melhorias são guardadas por navio
    const ach = ACH.filter(a => sv.ach && sv.ach[a.id]);
    const own = !!(sess && d.nome === sess.nome), pr = own ? save.prof : cleanProf(d.prof || sv.prof);
    $('profEdit').hidden = !own; $('profFriend').hidden = own || !sess;
    const pos = rk ? Math.floor(Number(rk.pos) || 0) : 0, medal = pos >= 1 && pos <= 3 ? MEDAL[pos - 1] : '';
    const card = (k, v) => '<div class="pf-card"><span>' + k + '</span><b>' + v + '</b></div>';
    const pips = lv => Array.from({ length: MAXLV }, (_, i) => '<s' + (i < lv ? ' class="on"' : '') + '></s>').join('');
    const pct = ACH.length ? Math.round(ach.length / ACH.length * 100) : 0;
    b.innerHTML = '<div class="pf-hero"><div class="pf-avw"><div class="pf-av" style="--h:' + avH(d.nome) + '">' + (pr.photo ? '<img alt="Foto de ' + esc(d.nome) + '" src="' + esc(pr.photo) + '">' : esc(d.nome.charAt(0).toUpperCase())) + '</div>' + (medal ? '<i class="pf-medal" style="--c:' + medal + '">' + pos + '</i>' : '') + '</div>' +
      '<div class="pf-id"><div class="pf-tags">' + (adm ? '<em class="pf-tag adm">admin</em>' : '') + (pos ? '<em class="pf-tag">#' + num(pos) + ' no ranking</em>' : '<em class="pf-tag mute">sem ranking</em>') + '</div>' +
      '<div class="pf-bio' + (pr.bio ? '' : ' empty') + '">' + (pr.bio ? esc(pr.bio) : (own ? 'Você ainda não escreveu uma bio.' : 'Sem bio ainda.')) + '</div></div></div>' +
      '<div class="pf-grid">' + card('Recorde', num(d.best)) + card('Melhor onda', num((rk && rk.onda) || sv.maxWave)) + card('Navios afundados', num(sv.kills)) + card('Chefes', num(sv.bosses)) + card('Tempo de jogo', hh(sv.play)) + (own ? card('Moedas', num(save.coins)) : card('Conquistas', ach.length + '/' + ACH.length)) + '</div>' +
      '<div class="pf-sec">Navio atual</div><div class="pf-ship"><b>' + esc(ship.name) + '</b>' + UPS.map(u => '<div class="pf-up"><span>' + esc(u.n) + '</span><i>' + pips(clamp(Math.floor(Number(upS[u.k]) || 0), 0, MAXLV)) + '</i></div>').join('') + '</div>' +
      '<div class="pf-sec">Frota <small>' + owned.length + ' de ' + (adm ? SHIPS.length : PUB_N) + '</small></div><div class="pf-chips">' + owned.map(s => '<span class="pf-chip' + (s.id === ship.id ? ' on' : '') + '">' + esc(s.name) + '</span>').join('') + '</div>' +
      '<div class="pf-sec">Conquistas <small>' + ach.length + ' de ' + ACH.length + ' · ' + pct + '%</small></div><div class="pf-bar"><i style="width:' + pct + '%"></i></div>' +
      (ach.length ? '<div class="pf-chips">' + ach.map(a => '<span class="pf-chip star">★ ' + esc(a.n) + '</span>').join('') + '</div>' : '') +
      '<div class="pf-foot">Membro desde ' + dia(d.desde) + ' · último salvamento ' + dia(d.atualizado) + '</div>';
  } catch (e) { b.textContent = 'Não foi possível carregar o perfil.'; }
}
$('profFriend').addEventListener('click', async () => {
  if (!sess || !curProf) return;
  const bt = $('profFriend'), m = $('profMsg'); bt.disabled = true; m.textContent = 'Enviando…';
  try { const r = await frCall('mf_amigo_pedir', { p_nome: curProf }); m.textContent = FR_TXT[r] || 'Não foi possível enviar o pedido.'; }
  catch (e) { m.textContent = frErr(e); } finally { bt.disabled = false; }
});
async function searchProf() {
  const q = $('pSearch').value.trim().toLowerCase();
  if (q.length < 2) { openRank(); return; }
  $('rankMe').hidden = true; rkSkel();
  try {
    const d = await (await api('rpc/buscar_perfis', { method: 'POST', body: JSON.stringify({ q }) })).json();
    if (!Array.isArray(d)) throw 0;
    if (!d.length) { rkMsg('Nenhum jogador encontrado.'); return; }
    rkRender(d.map(x => ({ nome: String(x.nome), val: +x.best || 0, txt: fmt(+x.best || 0), sub: 'recorde' })), { rank: false });
  } catch (e) { rkMsg('Não foi possível buscar.', true); }
}
rankEl.addEventListener('click', e => { if (e.target.closest('[data-retry]')) openRank(); });
rankEl.addEventListener('click', e => { const a = e.target.closest('[data-n]'); if (a) openProfile(a.dataset.n); });
rankEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-n]')) { e.preventDefault(); openProfile(e.target.dataset.n); } });
$('pGo').addEventListener('click', searchProf);
$('pSearch').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') searchProf(); });
$('pSearch').addEventListener('keyup', e => e.stopPropagation());
$('pMine').addEventListener('click', () => { if (sess) openProfile(sess.nome); });
$('profBack').addEventListener('click', () => { profEl.hidden = true; rankEl.hidden = false; });
/* ---------- personalizar perfil: foto e bio ---------- */
const peEl = $('peEl'); let peDraft = { bio: '', photo: '' };
function peUi() {
  const nm = sess ? sess.nome : '?', av = $('peAv');
  av.style.setProperty('--h', avH(nm));
  av.innerHTML = peDraft.photo ? '<img alt="Prévia da foto" src="' + peDraft.photo + '">' : esc(nm.charAt(0).toUpperCase());
  $('peDel').disabled = !peDraft.photo;
  const n = peDraft.bio.length; $('peCount').textContent = n + '/140'; $('peCount').classList.toggle('warn', n >= 120);
}
function peOpen() {
  if (!sess) return;
  peDraft = { bio: save.prof.bio, photo: save.prof.photo, thumb: save.prof.thumb || '' }; peCrop = null; peStage.hidden = true;
  $('peBio').value = peDraft.bio; $('peMsg').textContent = 'Foto e bio aparecem no seu perfil. A foto é recortada em quadrado e reduzida automaticamente.';
  $('peSave').disabled = false; peUi();
  $('acctEl').hidden = true; profEl.hidden = true; rankEl.hidden = true; peEl.hidden = false;
}
function thumbOf(src) { // miniatura 48x48 (vai para listas e ranking)
  const t = document.createElement('canvas'); t.width = t.height = 48;
  const g = t.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, 48, 48);
  let o = ''; for (const q of [.7, .5, .35]) { o = t.toDataURL('image/jpeg', q); if (o.length <= 8000) break; }
  return o.length <= 8000 ? o : '';
}
function mkThumb(url) { return new Promise(res => { const im = new Image(); im.onload = () => { try { res(thumbOf(im)); } catch (e) { res(''); } }; im.onerror = () => res(''); im.src = url; }); }
async function ensureThumb() { // quem já tinha foto antes ganha a miniatura sozinho
  const p = save.prof; if (!sess || !p || !p.photo || p.thumb) return;
  const t = await mkThumb(p.photo);
  if (t && save.prof.photo === p.photo) { save.prof.thumb = t; persist(); }
}
let peCrop = null;
const peCv = $('peCv'), peStage = $('peStage'), peZoom = $('peZoom');
function peWin() {
  const c = peCrop, W0 = c.img.naturalWidth, H0 = c.img.naturalHeight, m = Math.min(W0, H0) / c.z;
  c.cx = clamp(c.cx, m / 2, W0 - m / 2); c.cy = clamp(c.cy, m / 2, H0 - m / 2);
  return { m, sx: c.cx - m / 2, sy: c.cy - m / 2 };
}
function peDraw(cv) {
  const S = cv.width, g = cv.getContext('2d'), w = peWin();
  g.fillStyle = '#0c2433'; g.fillRect(0, 0, S, S); g.imageSmoothingQuality = 'high';
  g.drawImage(peCrop.img, w.sx, w.sy, w.m, w.m, 0, 0, S, S);
}
function peCommit() {
  if (!peCrop) return false;
  const c = document.createElement('canvas'); c.width = c.height = 160; peDraw(c);
  let out = '';
  for (const q of [.85, .7, .55, .4]) { out = c.toDataURL('image/jpeg', q); if (out.length <= 45000) break; }
  if (out.length > 45000 || !out.startsWith('data:image/jpeg;base64,')) return false;
  peDraft.photo = out; peDraft.thumb = thumbOf(c); peUi(); return true;
}
function peLoad(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      if (!img.naturalWidth || !img.naturalHeight) { rej(new Error('img')); return; }
      peCrop = { img, cx: img.naturalWidth / 2, cy: img.naturalHeight / 2, z: 1 };
      peZoom.value = 100; peStage.hidden = false; peDraw(peCv);
      peCommit() ? res() : rej(new Error('big'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    img.src = url;
  });
}
let peDrag = null;
peCv.addEventListener('pointerdown', e => { if (!peCrop) return; peDrag = { x: e.clientX, y: e.clientY }; try { peCv.setPointerCapture(e.pointerId); } catch (er) {} });
peCv.addEventListener('pointermove', e => {
  if (!peDrag || !peCrop) return;
  const k = peWin().m / peCv.getBoundingClientRect().width;
  peCrop.cx -= (e.clientX - peDrag.x) * k; peCrop.cy -= (e.clientY - peDrag.y) * k;
  peDrag.x = e.clientX; peDrag.y = e.clientY; peDraw(peCv);
});
const peDrop = () => { if (peDrag) { peDrag = null; peCommit(); } };
peCv.addEventListener('pointerup', peDrop); peCv.addEventListener('pointercancel', peDrop);
peZoom.addEventListener('input', () => { if (!peCrop) return; peCrop.z = peZoom.value / 100; peDraw(peCv); });
peZoom.addEventListener('change', () => { if (peCrop) peCommit(); });
$('pePick').addEventListener('click', () => $('peFile').click());
$('peFile').addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0]; e.target.value = '';
  if (!f) return;
  if (!/^image\//.test(f.type)) { $('peMsg').textContent = 'Escolha um arquivo de imagem.'; return; }
  if (f.size > 15 * 1024 * 1024) { $('peMsg').textContent = 'Imagem muito grande (máximo 15 MB).'; return; }
  $('peMsg').textContent = 'Processando foto…';
  try { await peLoad(f); $('peMsg').textContent = 'Arraste para enquadrar e use o zoom. Toque em Salvar para aplicar.'; }
  catch (er) { $('peMsg').textContent = 'Não foi possível usar essa imagem. Tente outra (JPG ou PNG).'; }
});
$('peDel').addEventListener('click', () => { peDraft.photo = ''; peDraft.thumb = ''; peCrop = null; peStage.hidden = true; peUi(); $('peMsg').textContent = 'Foto removida. Toque em Salvar para aplicar.'; });
$('peBio').addEventListener('input', e => { peDraft.bio = e.target.value.slice(0, 140); peUi(); });
for (const ev of ['keydown', 'keyup']) $('peBio').addEventListener(ev, e => e.stopPropagation());
$('peSave').addEventListener('click', async () => {
  if (!sess) return;
  const b = $('peSave'); b.disabled = true; $('peMsg').textContent = 'Salvando…';
  save.prof = cleanProf(peDraft); persist();
  const ok = await pushCloud();
  b.disabled = false;
  if (ok === false) { $('peMsg').textContent = 'Salvo neste aparelho, mas não foi possível sincronizar agora. Tente de novo mais tarde.'; return; }
  peEl.hidden = true; openProfile(sess.nome);
});
$('peCancel').addEventListener('click', () => { peEl.hidden = true; if (sess) openProfile(sess.nome); });
$('profEdit').addEventListener('click', peOpen);
$('pEditBtn').addEventListener('click', peOpen);

const CLOUD_READY = sess ? (refreshAcct(), pullCloud().then(() => { refreshAcct(); checkAdmin().then(() => weeklyPrize()); ensureThumb(); })) : Promise.resolve();


/* ---------- multiplayer (Supabase Realtime) ---------- */
const mpEl = $('mpEl');
let vsMode = false;
const r1 = v => Math.round(v * 10) / 10, r3 = v => Math.round(v * 1000) / 1000;
let giftAmt = 1000; const GIFT_AMTS = [500, 1000, 5000, 10000], giftPend = new Map(), giftSeen = new Set();
function giftUi() { $('mpAmts').innerHTML = GIFT_AMTS.map(v => '<button type="button" class="gchip' + (v === giftAmt ? ' on' : '') + '" data-v="' + v + '">$ ' + fmt(v) + '</button>').join(''); }
$('mpAmts').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { giftAmt = +b.dataset.v; giftUi(); } });
function giftSend(to) {
  if (state === 'playing' || !MP.ch) return;
  const pend = [...giftPend.values()].reduce((n, g) => n + g.v, 0);
  if (save.coins - pend < giftAmt) { mpSay('Moedas insuficientes para presentear $ ' + fmt(giftAmt) + '.'); return; }
  const id = Math.random().toString(36).slice(2, 10);
  giftPend.set(id, { v: giftAmt, to }); setTimeout(() => giftPend.delete(id), 6000);
  mpSend({ t: 'gift', id, from: MP.pid, to, v: giftAmt, n: sess ? sess.nome : (MP.role === 'host' ? 'anfitrião' : 'amigo') });
  mpSay('Enviando presente…');
}
function giftOnMsg(m) {
  if (m.t === 'gift') {
    const v = Math.floor(+m.v);
    if (+m.to !== MP.pid || state === 'playing' || giftSeen.has(String(m.id)) || !(v >= 1 && v <= 100000)) return;
    giftSeen.add(String(m.id)); save.coins += v; persist(); try { pushCloud(); } catch (e) {}
    mpSay(String(m.n || 'Um amigo').slice(0, 16) + ' te presenteou com $ ' + fmt(v) + '!'); sfx.pick();
    mpSend({ t: 'giftok', id: String(m.id), to: +m.from });
  } else if (m.t === 'giftok') {
    const g = giftPend.get(String(m.id));
    if (!g || +m.to !== MP.pid) return;
    giftPend.delete(String(m.id)); save.coins = Math.max(0, save.coins - g.v); persist(); try { pushCloud(); } catch (e) {}
    mpSay('Presente de $ ' + fmt(g.v) + ' enviado!');
  }
}
function mpSay(t) { $('mpMsg').textContent = t; }
function mpSend(payload) { try { if (MP.ch) MP.ch.send({ type: 'broadcast', event: 'm', payload }); } catch (e) {} }
function loadSb() {
  return new Promise((res, rej) => {
    if (window.supabase && window.supabase.createClient) return res();
    const sc = document.createElement('script');
    sc.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    sc.onload = () => (window.supabase && window.supabase.createClient) ? res() : rej(new Error('sb'));
    sc.onerror = () => rej(new Error('sb'));
    document.head.appendChild(sc);
  });
}
function mpLeave() {
  try { if (MP.ch && MP.role) mpSend({ t: 'bye', i: MP.pid }); } catch (e) {}
  try { if (MP.ch && MP.sb) MP.sb.removeChannel(MP.ch); } catch (e) {}
  clearInterval(MP.joinI); clearTimeout(MP.joinT);
  MP.ch = null; MP.role = null; MP.guests = []; MP.pid = -1; MP.acked = false; MP.ev = []; MP.peerGone = false;
  if (G) { G.allies = []; G.buoys = []; }
}
async function mpConnect(code, role) {
  await loadSb();
  mpLeave();
  if (!MP.sb) MP.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { params: { eventsPerSecond: 40 } } });
  MP.role = role; MP.code = code; MP.pid = role === 'host' ? 0 : -1;
  await new Promise((res, rej) => {
    const ch = MP.sb.channel('mf-' + code, { config: { broadcast: { self: false, ack: false } } });
    ch.on('broadcast', { event: 'm' }, ({ payload }) => { try { mpOnMsg(payload); } catch (e) {} });
    MP.ch = ch;
    const to = setTimeout(() => rej(new Error('timeout')), 8000);
    ch.subscribe(st => {
      if (st === 'SUBSCRIBED') { clearTimeout(to); res(); }
      else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') { clearTimeout(to); rej(new Error(st)); }
    });
  });
}
function mpBusy(b) { for (const id of ['mpCreate', 'mpJoin']) $(id).disabled = b; }
function mpModeUi() { const b = $('mpMode'); b.textContent = 'Modo: ' + (escMode ? 'Escolta' : hardMode ? 'Hardcore' : 'Normal'); b.style.borderColor = escMode ? '#8fd3e8' : hardMode ? 'var(--rust)' : ''; b.style.color = escMode ? '#8fd3e8' : hardMode ? 'var(--rust)' : ''; }
$('mpMode').addEventListener('click', () => { if (MP.role === 'guest') return; if (!hardMode && !escMode) hardMode = true; else if (hardMode) { hardMode = false; escMode = true; } else escMode = false; mpModeUi(); });
const MPO = { hp: [.5, 1, 1.5], max: [2, 3, 4], buoy: [1, 0] };
function mpOptsUi() {
  const o = MP.opts;
  $('mpOptHp').textContent = 'Vida inimiga: ' + o.hp + 'x';
  $('mpOptMax').textContent = 'Jogadores: até ' + o.max;
  $('mpOptBuoy').textContent = 'Boia de resgate: ' + (o.buoy ? 'Ligada' : 'Desligada');
}
for (const [id, k] of [['mpOptHp', 'hp'], ['mpOptMax', 'max'], ['mpOptBuoy', 'buoy']]) $(id).addEventListener('click', () => { if (MP.role === 'guest') return; const l = MPO[k]; MP.opts[k] = l[(l.indexOf(MP.opts[k]) + 1) % l.length]; mpOptsUi(); });
function openMp(vs) {
  vsMode = !!vs;
  mpLeave(); hardMode = false; escMode = false; mpModeUi(); mpOptsUi(); $('mpTitle').textContent = 'Multijogador'; for (const t of $('mpTabs').children) { const on = (t.dataset.vs === '1') === !!vs; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); } $('mpKicker').textContent = vs ? 'Duelo · 1 contra 1' : 'Cooperativo · até 4 jogadores'; $('mpCount').textContent = '';
  $('mpInvBox').hidden = true; $('mpList').innerHTML = ''; $('mpGift').hidden = true; $('mpOpts').hidden = true; $('mpBig').textContent = ''; $('mpShare').hidden = true; $('mpGo').hidden = true; $('mpCode').hidden = false; mpBusy(false);
  mpSay(vs ? 'Duelo sem robôs: cada um joga com o navio equipado e seus poderes (stats base, sem melhorias).' : 'Todos enfrentam as mesmas ondas. Crie uma sala ou entre com o código de um amigo.');
  mpEl.hidden = false;
}
$('btnHow').addEventListener('click', () => { $('helpEl').hidden = false; });
$('helpBack').addEventListener('click', () => { $('helpEl').hidden = true; });
$('btnMp').addEventListener('click', () => openMp(vsMode));
$('mpTabs').addEventListener('click', e => {
  const b = e.target.closest('[data-vs]'); if (!b || (b.dataset.vs === '1') === vsMode) return;
  if (MP.role) { mpSay('Saia da sala (Voltar) para trocar de tipo de partida.'); return; }
  openMp(b.dataset.vs === '1');
});
$('btnVs').addEventListener('click', () => openMp(true));
$('mpBack').addEventListener('click', () => { mpLeave(); mpEl.hidden = true; });
$('mpCreate').addEventListener('click', async () => {
  const L = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let code = '';
  for (let i = 0; i < 4; i++) code += L[Math.floor(Math.random() * L.length)];
  mpBusy(true); mpSay('Criando sala…');
  try {
    await mpConnect(code, 'host');
    $('mpBig').textContent = code; $('mpCode').hidden = true; $('mpShare').hidden = false;
    mpRoster(); mpInvLoad();
  } catch (e) { mpLeave(); mpSay('Não foi possível conectar. Verifique a internet e tente de novo.'); }
  mpBusy(false);
});
$('mpJoin').addEventListener('click', async () => {
  const code = $('mpCode').value.trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) { mpSay('Digite o código de 4 letras.'); return; }
  mpBusy(true); mpSay('Entrando…');
  try {
    await mpConnect(code, 'guest');
    const st = playerStats();
    MP.uid = Math.random().toString(36).slice(2, 8);
    const info = { t: 'join', u: MP.uid, n: sess ? sess.nome : 'amigo', id: effShipId(), hp: st.hp, dmg: st.dmg, rel: st.rel, speed: st.spec.speed, au: st.auto ? 1 : 0 };
    MP.acked = false;
    const send = () => mpSend(info);
    send(); MP.joinI = setInterval(send, 1200);
    MP.joinT = setTimeout(() => { if (!MP.acked) { mpLeave(); mpBusy(false); mpSay('Sala não encontrada. Confira o código.'); } }, 7000);
  } catch (e) { mpLeave(); mpBusy(false); mpSay('Não foi possível conectar. Verifique a internet e tente de novo.'); }
});
$('mpShare').addEventListener('click', async () => {
  const c = MP.code, link = location.origin + location.pathname + '?sala=' + c + (vsMode ? '&vs=1' : ''), txt = (vsMode ? 'Duelo 1×1 no Naval Warfare! Código: ' : 'Entre na minha esquadra no Naval Warfare! Código: ') + c + ' · ' + link;
  try { if (navigator.share) { await navigator.share({ text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(txt); mpSay('Código copiado! Cole numa conversa com o aliado.'); } catch (e) { mpSay('Copie manualmente: ' + c); }
});
$('mpCode').addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') $('mpJoin').click(); });
$('mpCode').addEventListener('keyup', e => e.stopPropagation());
$('mpCode').addEventListener('input', e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); });
$('mpGo').addEventListener('click', () => { if (MP.role === 'host' && MP.guests.length) mpStartHost(); });
/* ---------- modo versus 1×1: cada um com o navio equipado e seus poderes (stats base, sem melhorias), sem robôs, caixas no centro ---------- */
function vsStd(o, x, id) {
  let sh = SHIPS.find(s => s.id === id) || SHIPS[0];
  if (sh.adminOnly || sh.adm) sh = SHIPS[0];
  o.spec = Object.assign({}, sh.spec, { speed: sh.speed });
  o.max = o.hp = sh.hp; o.dmg = sh.dmg; o.rel = sh.rel;
  o.auto = !!sh.auto; o.cloakAb = !!sh.cloak; o.airAb = !!sh.air; o.escAb = !!sh.esc; o.cloneAb = !!sh.clone; o.surgeAb = !!sh.surge; o.reaperAb = !!sh.reaper; o.mslAb = !!sh.msl; o.chgAb = !!sh.chg; o.tpdAb = !!sh.tpd; o.novaAb = !!sh.nova; o.vgAb = !!sh.vg; o.phxAb = !!sh.phx; o.phxUsed = 0; o.admin = false; o.cloak = o.cloakCd = o.rapid = 0; o.multi = sh.multi || 1; o.shipId = sh.id;
  o.x = x; o.y = 0; o.heading = x < 0 ? 0 : Math.PI; o.aim = o.heading; o.speed = 0; o.vx = o.vy = 0;
  o.shield = 0; o.triple = 0; o.rapid = 0; o.dead = false;
  if (G && o === G.player) { G.camera.x = x; G.camera.y = 0; }
}
function vsTick(dt) {
  if (state !== 'playing') return;
  if (G.vsT === undefined) {
    G.vsCT = (G.vsCT === undefined ? 6 : G.vsCT) - dt;
    if (G.vsCT <= 0) {
      G.vsCT = rand(9, 14);
      if (G.crates.length < 3) {
        const a = rand(0, TAU), d = rand(0, 260), q = iceOut(Math.cos(a) * d, Math.sin(a) * d, 30);
        G.crates.push({ x: q[0], y: q[1], type: CRATE_TYPES[Math.floor(Math.random() * 4)], life: 20, t: rand(0, TAU) });
      }
    }
    const q = G.allies[0], hd = G.player.dead, gd = !q || q.dead;
    if (hd || gd) { G.vsT = 1.8; G.vsWin = hd && gd ? -1 : gd ? 0 : 1; }
  } else {
    G.vsT -= dt;
    if (G.vsT <= 0) {
      const w = G.vsWin;
      for (const d of [0, 200, 500]) setTimeout(() => mpSend({ t: 'vend', win: w }), d);
      vsOver(w);
    }
  }
}
function vsOver(win) {
  if (!G || state !== 'playing') return;
  const me = MP.role === 'host' ? win === 0 : win === 1;
  G.vsRes = win < 0 ? 'draw' : me ? 'win' : 'lose';
  G.newRecord = false;
  setState('over'); showOverlay('over');
  if (G.vsRes === 'win') sfx.record(); else sfx.lose();
}
function mkOther(id, speed, pid) {
  const sh = SHIPS.find(s => s.id === id) || SHIPS[0];
  return { spec: Object.assign({}, sh.spec, { speed }), max: 100, hp: 100, dmg: 20, rel: .6, auto: false, cloakAb: false, airAb: false, autoT: 0, autoAim: -Math.PI / 2,
    pid, lastIn: performance.now(), cloak: 0, cloakCd: 0, x: pid > 0 ? 90 + (pid - 1) * 80 : 0, y: 0, heading: -Math.PI / 2, speed: 0, vx: 0, vy: 0, aim: -Math.PI / 2, reload: 0, rapid: 0, shield: 0, triple: 0, multi: sh.multi || 1, dead: false, wakeT: 0, smokeT: 0, hflash: 0, recoil: 0, shipId: sh.id };
}
function mpBegin() {
  for (const k of ['move', 'aim']) sticks[k] = null;
  MP.acc = 0; MP.lastIn = performance.now(); MP.ev = []; MP.peerGone = false;
  setState('playing'); ov.hidden = true; mpEl.hidden = true;
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  last = performance.now();
}
function mpList(r, cp) {
  r = r || [];
  const cap = vsMode ? 2 : (cp >= 2 && cp <= MAXP ? cp : MAXP), n = r.length;
  $('mpGift').hidden = n < 2; giftUi();
  $('mpCount').textContent = n + '/' + cap;
  const rows = r.map(a => {
    const sh = SHIPS.find(z => z.id === a[2]), me = a[0] === MP.pid, nm = String(a[1] || '?'), c = PCOL[a[0] % 4];
    return '<div class="mps" style="--pc:' + c + '"><span class="mpav">' + esc(nm.charAt(0).toUpperCase()) + '</span><span class="mpn"><b>' + esc(nm) + '</b><small>' + esc(sh ? sh.name : '') + '</small></span>' +
      (a[0] === 0 ? '<span class="mptag">anfitrião</span>' : '') + (me ? '<span class="mptag">você</span>' : '') +
      (!me ? '<button class="ibtn" data-gift="' + a[0] + '" type="button" aria-label="Presentear">🎁</button>' : '') +
      (MP.role === 'host' && a[0] > 0 ? '<button class="ibtn" data-k="' + a[0] + '" type="button" aria-label="Expulsar">✕</button>' : '') + '</div>';
  });
  for (let i = n; i < cap && n; i++) rows.push('<div class="mps empty"><span class="mpav">+</span><span class="mpn"><b>Aguardando jogador</b></span></div>');
  $('mpList').innerHTML = rows.join('');
}
function mpRoster() {
  $('mpOpts').hidden = !(MP.role === 'host' && !vsMode); mpModeUi(); mpOptsUi();
  const r = [[0, sess ? sess.nome : 'anfitrião', effShipId()]].concat(MP.guests.map(g => [g.pid, g.n, g.id]));
  mpList(r, MP.opts.max); mpSend({ t: 'ro', r, cap: MP.opts.max });
  mpSay(vsMode ? (MP.guests.length ? 'Oponente na sala! Toque em Zarpar para o duelo.' : 'Mande o código ao amigo e espere ele entrar.')
    : MP.guests.length ? (MP.guests.length + 1) + '/' + MP.opts.max + ' na esquadra. Toque em Zarpar quando todos entrarem.' : 'Mande o código ao amigo e espere ele entrar.');
}
$('mpList').addEventListener('click', e => {
  const gb = e.target.closest('[data-gift]'); if (gb) { giftSend(+gb.dataset.gift); return; }
  const b = e.target.closest('[data-k]'); if (!b || MP.role !== 'host') return;
  const g = MP.guests.find(x => x.pid === +b.dataset.k); if (!g) return;
  mpSend({ t: 'kick', u: g.u }); MP.guests = MP.guests.filter(x => x !== g);
  if (!MP.guests.length) $('mpGo').hidden = true;
  mpRoster();
});
function mpStartHost() {
  initAudio(); newGame(); MP.nid = 0;
  const vs = vsMode && MP.guests.length === 1;
  G.vs = vs ? 1 : 0;
  G.enemyMul = MP.opts.hp; G.noBuoy = !MP.opts.buoy;
  if (vs) G.hc = false; else applyItems();
  const hn = sess ? sess.nome : 'anfitrião';
  G.allies = MP.guests.map(g => { const q = mkOther(g.id, g.speed, g.pid); Object.assign(q, { nome: g.n, auto: !!g.au, max: g.hp, hp: g.hp, dmg: g.dmg, rel: g.rel }); return q; });
  if (vs) { vsStd(G.player, -300, effShipId()); vsStd(G.allies[0], 300, G.allies[0].shipId); }
  if (escMode && !vs) { G.esc = 1; G.hc = false; convInit(); }
  mpSend({ t: 'go', es: G.esc ? 1 : 0, hc: G.hc ? 1 : 0, vs: G.vs, nb: MP.opts.buoy ? 0 : 1, sd: HZ_SEED, r: [[0, hn, effShipId(), playerStats().spec.speed]].concat(MP.guests.map(g => [g.pid, g.n, g.id, g.speed])) });
  mpBegin();
  if (vs) banner('Duelo 1×1', 'Afunde o oponente');
}
function mpStartGuest(m) {
  initAudio(); newGame(); G.vs = m.vs ? 1 : 0; G.noBuoy = !!m.nb; if (!G.vs) applyItems(); G.hc = !!m.hc && !G.vs;
  if (Number.isFinite(+m.sd)) setSeed(+m.sd);
  G.esc = m.es && !G.vs ? 1 : 0; if (G.esc) G.hc = false;
  G.player.x = 90 + (MP.pid - 1) * 80;
  G.allies = (m.r || []).filter(r => r[0] !== MP.pid).map(r => { const q = mkOther(r[2], +r[3] || 190, r[0]); q.nome = String(r[1] || 'amigo').slice(0, 16); return q; });
  if (G.vs) { vsStd(G.player, 300, effShipId()); G.allies.forEach(q => vsStd(q, q.pid === 0 ? -300 : 300, q.shipId)); }
  if (G.esc) convInit();
  mpBegin();
}
function mpOnMsg(m) {
  if (!m || !MP.role) return;
  if (m.t === 'gift' || m.t === 'giftok') { giftOnMsg(m); return; }
  if (MP.role === 'host') {
    if (m.t === 'join') {
      let g = MP.guests.find(x => x.u === String(m.u)), isNew = false;
      if (!g) {
        if (state === 'playing' || MP.guests.length >= (vsMode ? 1 : MP.opts.max - 1)) { mpSend({ t: 'full', u: String(m.u) }); return; }
        let pid = 1; while (MP.guests.some(x => x.pid === pid)) pid++;
        g = { pid, u: String(m.u) }; MP.guests.push(g); isNew = true;
      }
      if (state === 'playing') return;
      Object.assign(g, { au: m.au ? 1 : 0, n: String(m.n || 'amigo').slice(0, 16), id: m.id, hp: clamp(+m.hp || 100, 1, 2000), dmg: clamp(+m.dmg || 20, 1, 500), rel: clamp(+m.rel || .6, .1, 3), speed: clamp(+m.speed || 190, 50, 600) });
      mpSend({ t: 'ack', u: g.u, pid: g.pid, n: sess ? sess.nome : 'anfitrião' });
      if (isNew) { $('mpGo').hidden = false; mpRoster(); }
      return;
    }
    const pid = +m.i;
    if (m.t === 'bye') {
      const q = allyBy(pid);
      if (state === 'playing' && q) dropAlly(q, 'saiu');
      else if (state !== 'playing') { MP.guests = MP.guests.filter(x => x.pid !== pid); if (!MP.guests.length) $('mpGo').hidden = true; mpRoster(); }
      return;
    }
    const q = allyBy(pid);
    if (!q || q.dead || state !== 'playing') return;
    const adm = q.shipId === 'n77';
    if (m.t === 'e') { const k = clamp(Math.round(+m.k) || 0, 0, 3); q.chat = { k, until: performance.now() + 3000 }; evp(['e', pid, k]); }
    else if (m.t === 'c') {
      if (adm && m.off) q.cloak = 0;
      else if (adm || !(q.cloak > 0 || q.cloakCd > 0)) { q.cloak = 9; q.cloakCd = adm ? 0 : 25; MP.mute = 1; floatText(q.x, q.y - 30, 'submerso', '#8aa3ab'); MP.mute = 0; }
    } else if (m.t === 'a') {
      if (adm || !(q.cloakCd > 0)) { q.cloakCd = adm ? 0 : 45; summonPlanes(q); }
    } else if (m.t === 'z') {
      if (adm || !(q.cloakCd > 0)) { q.cloakCd = adm ? 0 : ESC_CD; summonEscort(q, adm); }
    } else if (m.t === 'vg') {
      if ((adm || !(q.cloakCd > 0)) && q.hp > q.max * .1) { q.cloakCd = adm ? 0 : 20; vgBlast(q); }
    } else if (m.t === 'px') {
      if (adm || !(q.cloakCd > 0)) { q.cloakCd = adm ? 0 : 25; blast(q, Math.round((q.dmg || 20) * 8), 340, '255,170,60'); }
    } else if (m.t === 'ch') {
      if (adm || !(q.cloakCd > 0)) { q.cloakCd = adm ? 0 : 20; q.charge = 8; }
    } else if (m.t === 'tp') {
      if (adm || !(q.cloakCd > 0)) { q.cloakCd = adm ? 0 : 20; q.aim = +m.a || q.aim; torpedoSalvo(q); }
    } else if (m.t === 'nv') {
      if (adm || !(q.cloakCd > 0)) { q.cloakCd = adm ? 0 : 25; novaShot(q, +m.a || q.aim, m.f); }
    } else if (m.t === 'ms') {
      if (adm || !(q.cloakCd > 0)) { if (summonMissiles(q)) q.cloakCd = adm ? 0 : 30; }
    } else if (m.t === 'u') {
      if (adm || !(q.cloakCd > 0)) { q.cloakCd = adm ? 0 : 30; surge(q); }
    } else if (m.t === 'q') {
      if (adm || (!(q.cloakCd > 0) && cloneCount(q.pid) < CLONE_MAX)) { q.cloakCd = adm ? 0 : CLONE_CD; summonClone(q, adm); }
    } else if (m.t === 'bh') {
      if (adm) holeToggle(q);
    } else if (m.t === 'mt') {
      if (adm) startMeteor(q);
    } else if (m.t === 'au') {
      if (adm) q.auto = !!m.v;
    } else if (m.t === 'g') {
      q.lastIn = performance.now(); q.autoAim = +m.u || 0;
      { const nx = +m.x, ny = +m.y, k = Math.hypot(nx - q.x, ny - q.y) < 160 ? .6 : 1; q.x += (nx - q.x) * k; q.y += (ny - q.y) * k; } q.heading = +m.h; q.aim = +m.a; q.speed = +m.s;
      q.vx = Math.cos(q.heading) * q.speed; q.vy = Math.sin(q.heading) * q.speed;
    } else if (m.t === 'f') {
      const a = +m.a, n = m.u ? 1 : clamp(Math.round(+m.n) || 1, 1, 5), n0 = G.balls.length;
      if (m.u || !q.spec || !q.spec.turrets) for (const d of fan(n)) { const b = a + d; G.balls.push({ own: 'p', x: +m.x, y: +m.y, vx: Math.cos(b) * BALL_V, vy: Math.sin(b) * BALL_V, life: (m.u ? RANGE * .9 : RANGE) / BALL_V, dmg: m.u ? Math.round(q.dmg * .5) : q.dmg, trail: 0 }); }
      else turretShots(q, a, n, Math.round(q.dmg * vgMul(q)), BALL_V, RANGE / BALL_V, 'p', 0, +m.d || 380);
      if (G.vs) for (let i = n0; i < G.balls.length; i++) G.balls[i].vs = 1;
      else if (q.shipId === 'misseis') for (let i = n0; i < G.balls.length; i++) G.balls[i].hm = 1;
      else if (q.shipId === 'torpedeiro') for (let i = n0; i < G.balls.length; i++) G.balls[i].pr = new Set();
      MP.mute = 1; muzzle(+m.x, +m.y, a, m.u ? .6 : 1); MP.mute = 0; sfx.enemy(); if (!m.u) q.recoil = 1;
    }
  } else {
    if (m.t === 'full' && m.u === MP.uid && !MP.acked) { mpLeave(); mpBusy(false); mpSay('Sala cheia ou partida já iniciada.'); }
    else if (m.t === 'ack' && m.u === MP.uid) {
      if (!MP.acked) { MP.acked = true; MP.pid = +m.pid; MP.hostName = String(m.n || 'anfitrião').slice(0, 16); clearInterval(MP.joinI); clearTimeout(MP.joinT); mpSay('Conectado à sala de ' + MP.hostName + ' (jogador ' + (MP.pid + 1) + '). Aguardando ele zarpar…'); }
    } else if (m.t === 'ro' && state !== 'playing') mpList(m.r, +m.cap);
    else if (m.t === 'kick' && m.u === MP.uid && state !== 'playing') { mpLeave(); mpBusy(false); $('mpList').innerHTML = ''; $('mpBig').textContent = ''; mpSay('Você foi removido da sala pelo anfitrião.'); }
    else if (m.t === 'go') { mpStartGuest(m); }
    else if (m.t === 's' && G && state === 'playing') mpApply(m);
    else if (m.t === 'vend' && G && G.vs && state === 'playing') vsOver(+m.win);
    else if (m.t === 'end' && state === 'playing') mpGuestEnd(m);
    else if (m.t === 'bye' && m.i === 0 && state === 'playing') mpGuestEnd(null);
    else if (m.t === 'bye' && m.i === 0 && state === 'over') { mpLeave(); showOverlay('over'); $('sendMsg').textContent = 'O anfitrião saiu da sala.'; }
  }
}
function mpHostTick(dt) {
  MP.acc += dt;
  if (MP.acc < .066 || !G.allies.length || state !== 'playing') return;
  MP.acc = 0;
  const p = G.player;
  mpSend({ t: 's', q: G.queue.length, w: G.wave, sc: Math.floor(G.score), k: G.kills, c: G.coins,
    h: [r1(p.x), r1(p.y), r3(p.heading), r3(p.aim), Math.round(p.speed), p.dead ? 1 : 0, Math.round(p.hp), p.max, p.cloak > 0 ? 1 : 0, effShipId(), p.auto ? 1 : 0, r3(p.autoAim || 0), 0, r1(Math.max(0, p.shield)), r1(Math.max(0, p.triple))],
    al: G.allies.map(q => [q.pid, r1(q.x), r1(q.y), r3(q.heading), r3(q.aim), Math.round(q.speed), q.dead ? 1 : 0, Math.round(q.hp), q.max, q.cloak > 0 ? 1 : 0, q.shipId, q.auto ? 1 : 0, r3(q.autoAim || 0), r1(Math.max(0, q.rapid)), r1(Math.max(0, q.shield)), r1(Math.max(0, q.triple))]),
    e: G.enemies.map(e => [e.id, e.type, r1(e.x), r1(e.y), r3(e.heading), r3(e.aim), Math.round(e.hp), Math.round(e.max), Math.round(e.vx), Math.round(e.vy), e.pw ? HC_POWERS.indexOf(e.pw) + 1 : 0, e.cloak > 0 ? 1 : 0, e.fake ? 1 : 0]),
    b: G.balls.map(b => [G.vs ? (b.vs === 1 ? 0 : 1) : (b.own === 'p' ? 0 : 1), r1(b.x), r1(b.y), Math.round(b.vx), Math.round(b.vy), r3(b.life)]),
    cr: G.crates.map(c => [CRATE_TYPES.indexOf(c.type), r1(c.x), r1(c.y), r1(c.t), r1(c.life)]),
    pl: G.planes.map(a => [r1(a.x), r1(a.y), r3(a.h), r1(a.life)]),
    ms: G.missiles.map(a => [r1(a.x), r1(a.y), r3(a.h), r1(a.life)]),
    es: G.escorts.map(z => [r1(z.x), r1(z.y), r3(z.heading), r3(z.aim), Math.round(z.hp), z.max, r1(z.life), z.clone ? z.shipId : 0, z.pid || 0]),
    cv: G.esc && G.conv ? [r1(G.conv.x), r1(G.conv.y), r3(G.conv.heading), Math.round(G.conv.speed), Math.round(G.conv.hp), G.conv.max, G.conv.dead ? 1 : 0] : 0,
    bu: G.buoys.map(b => [b.who, r1(b.x), r1(b.y), r1(b.life), r3(b.prog / BUOY_T)]),
    ev: MP.ev });
  MP.ev = [];
}
function mpApply(m) {
  MP.lastIn = performance.now();
  G.wave = m.w; G.score = m.sc; G.kills = m.k; G.coins = m.c; G.qn = m.q || 0;
  const h = m.h, p = G.player, al = m.al || [], me = al.find(a => a[0] === MP.pid), seen = new Set();
  for (const a of [[0].concat(h)].concat(al.filter(a => a[0] !== MP.pid))) {
    let o = allyBy(a[0]);
    if (!o) { o = mkOther(a[10], 190, a[0]); o.nome = a[0] === 0 ? (MP.hostName || 'anfitrião') : 'Aliado'; G.allies.push(o); }
    seen.add(a[0]);
    { const dx = a[1] - o.x, dy = a[2] - o.y, k = Math.hypot(dx, dy) < 160 ? .55 : 1; o.x += dx * k; o.y += dy * k; }
    o.heading = a[3]; o.aim = a[4]; o.speed = a[5];
    o.vx = Math.cos(o.heading) * o.speed; o.vy = Math.sin(o.heading) * o.speed;
    if (a[7] < o.hp && !a[6]) o.hflash = .15;
    o.shield = a[14] || 0; o.triple = a[15] || 0;
    o.dead = !!a[6]; o.hp = a[7]; o.max = a[8]; o.cloak = a[9] ? 1 : 0; o.auto = !!a[11]; o.autoAim = a[12] || 0;
    if (o.shipId !== a[10]) { const sh = SHIPS.find(z => z.id === a[10]); if (sh) { o.spec = Object.assign({}, sh.spec, { speed: o.spec.speed }); o.shipId = sh.id; } }
  }
  G.allies = G.allies.filter(o => seen.has(o.pid));
  if (me) {
    if (me[7] < p.hp - .5 && !p.dead) { p.hflash = .15; G.flash = Math.min(.6, G.flash + .35); G.shake = Math.min(16, G.shake + 4); sfx.hurt(); }
    p.hp = me[7]; p.max = me[8]; p.rapid = me[13]; p.shield = me[14] || 0; p.triple = me[15] || 0;
    if (me[6] && !p.dead) killPlayer();
    else if (!me[6] && p.dead) p.dead = false;
  }
  const old = new Map(G.enemies.map(e => [e.id, e])), list = [];
  for (const a of m.e) {
    let e = old.get(a[0]);
    if (!e) e = { id: a[0], type: a[1], spec: SPEC[a[1]], flash: 0, recoil: 0, wakeT: 0, smokeT: 0, speed: 0, hp: a[6] };
    else if (a[6] < e.hp) e.flash = .12;
    { const dx = a[2] - e.x, dy = a[3] - e.y, k = (e.x !== undefined && Math.hypot(dx, dy) < 120) ? .55 : 1; e.x = k < 1 ? e.x + dx * k : a[2]; e.y = k < 1 ? e.y + dy * k : a[3]; } e.heading = a[4]; e.aim = a[5]; e.hp = a[6]; e.max = a[7]; e.vx = a[8]; e.vy = a[9]; e.speed = Math.hypot(a[8], a[9]);
    e.pw = a[10] ? HC_POWERS[a[10] - 1] : undefined; e.cloak = a[11] ? 1 : 0; e.fake = a[12] ? 1 : 0;
    if (e.spec) list.push(e);
  }
  G.enemies = list;
  G.balls = m.b.map(a => ({ own: a[0] ? 'e' : 'p', x: a[1], y: a[2], vx: a[3], vy: a[4], life: a[5], trail: 0 }));
  G.escorts = (m.es || []).map(a => ({ x: a[0], y: a[1], heading: a[2], aim: a[3], hp: a[4], max: a[5], life: a[6], pid: a[8] || 0, clone: !!a[7], cloak: 0, spec: (a[7] && (SHIPS.find(s => s.id === a[7]) || {}).spec) || ESC_SPEC, flash: 0, recoil: 0, vx: 0, vy: 0, speed: 0, wakeT: 0, smokeT: 0 }));
  if (m.cv && G.esc) {
    const a = m.cv; if (!G.conv) convInit(); const c = G.conv, wasDead = c.dead;
    { const dx = a[0] - c.x, dy = a[1] - c.y, k = Math.hypot(dx, dy) < 160 ? .55 : 1; c.x += dx * k; c.y += dy * k; }
    c.heading = a[2]; c.speed = a[3]; c.vx = Math.cos(c.heading) * c.speed; c.vy = Math.sin(c.heading) * c.speed;
    if (a[4] < c.hp) c.flash = .12;
    c.hp = a[4]; c.max = a[5]; c.dead = !!a[6];
    if (c.dead && !wasDead) convWreck(c);
  }
  G.missiles = (m.ms || []).map(a => ({ x: a[0], y: a[1], h: a[2], v: 500, life: a[3], trail: 0 }));
  G.planes = (m.pl || []).map(a => ({ x: a[0], y: a[1], h: a[2], v: 480, life: a[3], trail: 0 }));
  G.buoys = (m.bu || []).map(a => ({ who: a[0], mine: a[0] === MP.pid, x: a[1], y: a[2], life: a[3], prog: a[4] * BUOY_T, t: performance.now() / 1000 }));
  G.crates = m.cr.map(a => ({ type: CRATE_TYPES[a[0]] || 'rapid', x: a[1], y: a[2], t: a[3], life: a[4] }));
  for (const v of m.ev) {
    if (v[0] === 'x') { explosion(v[1], v[2], v[3]); sfx.boom(); }
    else if (v[0] === 'b') banner(v[1], v[2]);
    else if (v[0] === 't') floatText(v[1], v[2], v[3], v[4]);
    else if (v[0] === 'w' && SPEC[v[4]]) G.wrecks.push({ x: v[1], y: v[2], heading: v[3], spec: SPEC[v[4]], aim: v[5], t: 0, vx: 0, vy: 0 });
    else if (v[0] === 'm') muzzle(v[1], v[2], v[3], v[4]);
    else if (v[0] === 'p') sparks(v[1], v[2], v[3], v[4]);
    else if (v[0] === 'sp') splash(v[1], v[2]);
    else if (v[0] === 'ic') iceNet(v[1], v[2], v[3], v[4]);
    else if (v[0] === 'cl') cloneFx(v[1], v[2], v[3], v[4]);
    else if (v[0] === 'bh') G.hole = v[3] ? { x: v[1], y: v[2], t: 0, sp: 0 } : null;
    else if (v[0] === 'mt') { if (!G.meteor) G.meteor = { t: 0, x: v[1], y: v[2], fx: 0 }; }
    else if (v[0] === 'e') { if (v[1] !== MP.pid) { const oo = allyBy(v[1]); if (oo) oo.chat = { k: v[2], until: performance.now() + 3000 }; } }
    else if (v[0] === 'k') {
      if (v[1] === 'e') { sfx.enemy(); const e = G.enemies.find(z => z.id === v[2]); if (e) e.recoil = 1; }
      else if (v[1] === 'c') { sfx.cannon(); const oo = allyBy(0); if (oo) oo.recoil = 1; }
      else if (v[1] === 'h') sfx.hit();
      else if (v[1] === 'p') sfx.pick();
    }
    else if (v[0] === 'r' && v[1] === MP.pid) { p.dead = false; p.x = v[2]; p.y = v[3]; p.speed = 0; p.vx = p.vy = 0; p.cloak = 0; }
  }
}
function stepGuest(dt) {
  G.t += dt;
  const p = G.player;
  if (state === 'playing' && !p.dead) { const inp = gatherInput(); G.aimActive = inp.aim != null; stepPlayer(dt, inp); hazShip(p, dt); }
  for (const e of G.enemies) { e.x += e.vx * dt; e.y += e.vy * dt; e.flash = Math.max(0, e.flash - dt); wake(e, dt, e.spec.len, e.spec.wid); damageSmoke(e, dt, e.hp / e.max); }
  for (const b of G.balls) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.trail -= dt;
    if (b.trail <= 0) { b.trail = .03; addP({ t: 'smoke', x: b.x, y: b.y, life: .45, size: 2, grow: 7 }); }
  }
  for (const e of G.enemies) e.recoil = Math.max(0, e.recoil - dt * 5);
  for (const pl of G.planes) {
    pl.x += Math.cos(pl.h) * pl.v * dt; pl.y += Math.sin(pl.h) * pl.v * dt; pl.trail -= dt;
    if (pl.trail <= 0) { pl.trail = .03; addP({ t: 'smoke', x: pl.x - Math.cos(pl.h) * 12, y: pl.y - Math.sin(pl.h) * 12, life: .5, size: 2, grow: 6 }); }
  }
  for (const ms of G.missiles) {
    ms.x += Math.cos(ms.h) * ms.v * dt; ms.y += Math.sin(ms.h) * ms.v * dt; ms.trail -= dt;
    if (ms.trail <= 0) { ms.trail = .03; addP({ t: 'smoke', x: ms.x - Math.cos(ms.h) * 14, y: ms.y - Math.sin(ms.h) * 14, life: .5, size: 2, grow: 6 }); }
  }
  for (const o of G.allies) { o.hflash = Math.max(0, o.hflash - dt); o.recoil = Math.max(0, o.recoil - dt * 6); }
  for (const c of G.crates) { c.t += dt; c.life -= dt; }
  updateHole(dt, true); updateMeteor(dt);
  for (const o of G.allies) if (!o.dead) { o.x += o.vx * dt; o.y += o.vy * dt; wake(o, dt, o.spec.len, o.spec.wid); }
  if (G.esc && G.conv && !G.conv.dead) { const c = G.conv; c.x += c.vx * dt; c.y += c.vy * dt; c.flash = Math.max(0, c.flash - dt); wake(c, dt, c.spec.len, c.spec.wid); damageSmoke(c, dt, c.hp / c.max); }
  updateParts(dt);
  G.shake *= Math.exp(-dt * 7); if (G.shake < .1) G.shake = 0;
  G.flash = Math.max(0, G.flash - dt * 1.6);
  lowAlarm(dt);
  followCam(dt);
  MP.acc += dt;
  if (MP.acc >= .05 && !p.dead) {
    MP.acc = 0;
    mpSend({ t: 'g', i: MP.pid, x: r1(p.x), y: r1(p.y), h: r3(p.heading), a: r3(p.aim), s: Math.round(p.speed), u: r3(p.autoAim || 0) });
  }
  if (performance.now() - MP.lastIn > 6000 && state === 'playing') mpGuestEnd(null);
}
function mpGuestEnd(m) {
  if (!m) mpLeave();
  if (m) { G.wave = m.w; G.score = m.sc; G.kills = m.k; G.coins = m.c; }
  save.coins += G.coins; save.kills += G.kills; evtAdd(G.kills, 0); persist();
  gameOver();
  if (!m) $('sendMsg').textContent = 'Conexão com o anfitrião perdida.';
}

const rpc = (fn, args) => api('rpc/' + fn, { method: 'POST', body: JSON.stringify(args || {}) }).then(r => r.json());

/* ---------- administrador ---------- */
async function checkAdmin() {
  try { const bn = await rpc('esta_banido'); if (bn && bn.motivo !== undefined) { alert('Conta banida' + (bn.ate ? ' até ' + dia(bn.ate) : '') + (bn.motivo ? ': ' + bn.motivo : '') + '.'); logout(); return; } } catch (e) {}
  try { ADMIN = (await rpc('eh_admin')) === true; } catch (e) { ADMIN = false; }
  $('btnAdm').hidden = !ADMIN || !$('btnAlt').hidden;
  if (ADMIN) { ADMINS.add(sess.nome); save.owned = SHIPS.map(s => s.id); save.coins = 99999999; persist(); refreshAcct(); }
}
const ADMINS_READY = rpc('admins_nomes').then(a => { if (Array.isArray(a)) a.forEach(n => ADMINS.add(n)); }).catch(() => {});

/* ---------- prêmio do ranking semanal ---------- */
const WK_PRIZE = [100000, 50000, 25000];
let wkBusy = false;
async function weeklyPrize() {
  if (wkBusy || !sess || ADMIN || TEST_MODE) return;
  wkBusy = true; let again = false;
  const me = sess;
  try {
    await ADMINS_READY;
    const w = await rpc('ranking_semana', { p_limit: 1 });
    if (!sess || sess.id !== me.id || ADMIN || !w || !/^\d{4}-\d{2}-\d{2}/.test(w.inicio)) return;
    const prev = new Date(Date.parse(String(w.inicio).slice(0, 10) + 'T00:00:00Z') - 7 * 864e5).toISOString().slice(0, 10);
    if (((save.wk && save.wk.paid) || '') >= prev) return;
    const r = await api('ranking_semanal?semana=eq.' + prev + '&pontos=gt.0&select=user_id,nome,pontos&order=pontos.desc,atualizado.asc&limit=30');
    if (!r.ok) return;
    const d = await r.json();
    if (!Array.isArray(d) || !sess || sess.id !== me.id || ADMIN) return;
    const top = d.filter(x => !ADMINS.has(String(x.nome))).slice(0, 3);
    const pos = top.findIndex(x => x.user_id === me.id);
    if (pos >= 0 && (document.getElementById('loading') || state === 'playing')) { again = true; return; } // espera o carregamento / a partida acabar
    save.wk = { paid: prev };
    if (pos >= 0) save.coins += WK_PRIZE[pos];
    persist(); refreshAcct();
    try { await pushCloud(); } catch (e) {}
    if (pos >= 0) wkShow(top, pos, prev);
  } catch (e) {} finally { wkBusy = false; if (again) setTimeout(weeklyPrize, 1500); }
}
function wkShow(top, pos, prev) {
  const ini = new Date(Date.parse(prev + 'T00:00:00Z')), fim = new Date(ini.getTime() + 6 * 864e5);
  const dm = x => String(x.getUTCDate()).padStart(2, '0') + '/' + String(x.getUTCMonth() + 1).padStart(2, '0');
  const ICO = ['🥇', '🥈', '🥉'];
  $('wkIco').textContent = ICO[pos];
  $('wkTitle').textContent = ['Campeão da semana!', 'Vice-campeão da semana!', 'Pódio da semana!'][pos];
  $('wkSub').textContent = 'Você ficou em ' + (pos + 1) + 'º lugar no ranking semanal (' + dm(ini) + ' a ' + dm(fim) + ').';
  $('wkAmt').textContent = '+' + fmt(WK_PRIZE[pos]) + ' moedas';
  $('wkList').innerHTML = top.map((x, i) => '<div class="wk-row' + (x.user_id === sess.id ? ' me' : '') + '" style="--c:' + MEDAL[i] + '"><b>' + ICO[i] + '</b><span>' + esc(x.nome) + '</span><em>' + fmt(+x.pontos || 0) + ' pts</em><i>$ ' + fmt(WK_PRIZE[i]) + '</i></div>').join('');
  $('wkPrize').hidden = false; $('wkPrize').scrollTop = 0;
  try { initAudio(); sfx.pick(); } catch (e) {}
}
$('wkOk').addEventListener('click', () => { $('wkPrize').hidden = true; });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('wkPrize').hidden) $('wkOk').click(); });
setInterval(() => { if (!document.hidden) weeklyPrize(); }, 120000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) weeklyPrize(); });
let admTab = 'contas', admData = [];
const admBs = 'style="min-height:30px;padding:3px 8px;font-size:11px"';
const admSay = t => { $('admMsg').textContent = t; };
async function admCall(fn, args, ok) {
  try { const r = await rpc(fn, args); admSay(r === 'ok' ? ok : r === 'nao_encontrado' ? 'Conta não encontrada.' : r === 'e_admin' ? 'Não dá para banir um admin.' : r === 'proprio' ? 'Não dá para alterar a própria conta.' : String(r)); }
  catch (e) { admSay('Sem permissão ou sem conexão.'); }
}
function admRows() {
  const q = $('admQ').value.trim().toLowerCase();
  const l = admData.filter(x => !q || x.nome.toLowerCase().includes(q));
  $('admBody').innerHTML = l.map(x => { const n = esc(x.nome); const bt = (a, t) => '<button class="btn ghost" ' + admBs + ' data-a="' + a + '" data-n="' + n + '" type="button">' + t + '</button>';
    return '<div style="padding:8px 0;border-top:1px solid var(--line)"><b>' + n + '</b>' + adm(x.nome) + (x.banido ? '<em class="rk-you" style="color:var(--rust);border-color:var(--rust)">banido</em>' : '') +
      '<div style="color:var(--steel);font-size:11px;margin:2px 0 6px">criada ' + dia(x.criado) + ' · último acesso ' + dia(x.ultimo) + (x.no_ranking ? ' · ' + fmt(+x.pontos || 0) + ' pts' : '') + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:6px">' + (x.no_ranking ? bt('rm', 'Tirar do ranking') : '') + (x.eh_adm ? bt('rmadm', 'Remover admin') : bt('mkadm', 'Tornar admin') + (x.banido ? bt('unban', 'Desbanir') : bt('ban', 'Banir'))) + bt('coins', 'Moedas') + bt('ship', 'Navio') + bt('ach', 'Conquista') + bt('perfil', 'Perfil') + '</div></div>'; }).join('') || '<p class="note">Nenhuma conta encontrada.</p>';
}
async function admLoad() {
  const b = $('admBody'); $('admQ').hidden = admTab !== 'contas';
  for (const t of $('admTabs').children) t.classList.toggle('on', t.dataset.t === admTab);
  admSay('Carregando…');
  try {
    if (admTab === 'contas') { const d = await rpc('admin_contas'); if (!Array.isArray(d)) throw 0; admData = d; admSay(d.length + ' contas'); admRows(); }
    else if (admTab === 'stats') {
      const d = await rpc('admin_stats'); if (!d || typeof d !== 'object') throw 0; admSay('');
      const nm = id => { const s = SHIPS.find(x => x.id === id); return s ? s.name : id; };
      b.innerHTML = kv('Contas', num(d.contas)) + kv('Ativas nas últimas 24h', num(d.ativos24)) + kv('Ativas em 7 dias', num(d.ativos7)) + kv('Novas em 7 dias', num(d.novos7)) + kv('Pontuaram na semana', num(d.rank_sem)) + kv('Onda média (ranking)', d.onda_media == null ? '—' : String(d.onda_media)) + kv('Pontos médios (ranking)', num(d.pontos_media)) + kv('Banidos agora', num(d.banidos)) +
        '<div style="margin-top:10px;color:var(--steel);font-size:11px">NAVIOS MAIS USADOS</div>' + ((d.navios || []).map(x => kv(esc(nm(x.id)), num(x.n))).join('') || '<p class="note">Sem dados.</p>');
    } else if (admTab === 'avisos') {
      admSay('Avisos aparecem no topo para todos os jogadores. Eventos multiplicam as moedas ganhas.');
      const inp = 'style="width:100%;box-sizing:border-box;min-height:38px;padding:0 8px;background:transparent;border:1px solid var(--line);color:inherit;font:inherit;margin:4px 0"';
      b.innerHTML = '<div style="color:var(--steel);font-size:11px">AVISO GLOBAL</div><input id="admAviso" maxlength="200" placeholder="Ex.: manutenção às 22h" ' + inp + '><div style="display:flex;gap:6px"><button class="btn ghost" ' + admBs + ' data-a="aviso" type="button">Publicar</button><button class="btn ghost" ' + admBs + ' data-a="avisoclr" type="button">Limpar aviso</button></div>' +
        '<div style="color:var(--steel);font-size:11px;margin-top:14px">EVENTO DE MOEDAS</div><div style="display:flex;gap:6px"><select id="admEvM" ' + inp + '><option value="2">2x moedas</option><option value="3">3x moedas</option><option value="5">5x moedas</option></select><select id="admEvH" ' + inp + '><option value="1">1 hora</option><option value="6">6 horas</option><option value="24">24 horas</option><option value="72">3 dias</option></select></div><div style="display:flex;gap:6px"><button class="btn ghost" ' + admBs + ' data-a="evt" type="button">Iniciar evento</button><button class="btn ghost" ' + admBs + ' data-a="evtstop" type="button">Encerrar evento</button></div>';
    } else {
      const d = await rpc('admin_log_lista'); if (!Array.isArray(d)) throw 0; admSay(d.length ? 'Últimas ' + d.length + ' ações' : 'Nenhuma ação registrada ainda.');
      b.innerHTML = d.map(x => '<div style="padding:7px 0;border-top:1px solid var(--line)"><b>' + esc(x.acao) + '</b> ' + esc(x.alvo || '') + '<div style="color:var(--steel);font-size:11px">' + esc(x.admin) + ' · ' + new Date(x.criado).toLocaleString('pt-BR') + (x.detalhe ? ' · ' + esc(x.detalhe) : '') + '</div></div>').join('');
    }
  } catch (e) { admSay('Sem permissão ou sem conexão.'); b.innerHTML = ''; }
}
const admOpen = () => { $('adm').hidden = false; admLoad(); };
$('pAdm').addEventListener('click', admOpen);
$('btnAdm').addEventListener('click', admOpen);
$('admBack').addEventListener('click', () => { $('adm').hidden = true; });
$('admQ').addEventListener('input', admRows);
$('admTabs').addEventListener('click', e => { const t = e.target.closest('[data-t]'); if (t) { admTab = t.dataset.t; admLoad(); } });
$('admBody').addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a, n = b.dataset.n;
  if (a === 'rm') { if (!confirm('Remover ' + n + ' do ranking (geral e semanal)?')) return; await admCall('admin_remover_ranking', { p_nome: n }, 'Removido do ranking.'); }
  else if (a === 'ban') { const m = prompt('Motivo do banimento de ' + n + ':'); if (m === null) return; const d = prompt('Dias de banimento (0 = permanente):', '0'); if (d === null) return; await admCall('admin_banir', { p_nome: n, p_motivo: m, p_dias: Math.max(0, parseInt(d) || 0) }, 'Conta banida e removida do ranking.'); }
  else if (a === 'unban') await admCall('admin_desbanir', { p_nome: n }, 'Conta desbanida.');
  else if (a === 'coins') { const q = parseInt(prompt('Moedas para dar a ' + n + ' (negativo tira):', '1000')); if (!q) return; await admCall('admin_moedas', { p_nome: n, p_qtd: q }, 'Moedas atualizadas (valem no próximo login da conta).'); }
  else if (a === 'ship') { const id = (prompt('Navio para dar a ' + n + ':\n' + SHIPS.filter(x => !x.adminOnly).map(x => x.id + ' — ' + x.name).join('\n')) || '').trim(); if (!SHIPS.some(x => x.id === id && !x.adminOnly)) return; await admCall('admin_dar_navio', { p_nome: n, p_navio: id }, 'Navio entregue.'); }
  else if (a === 'ach') { const id = (prompt('Conquista para dar a ' + n + ':\n' + ACH.map(x => x.id + ' — ' + x.n).join('\n')) || '').trim(); if (!ACH.some(x => x.id === id)) return; await admCall('admin_dar_conquista', { p_nome: n, p_id: id }, 'Conquista entregue.'); }
  else if (a === 'mkadm') { if (!confirm('Tornar ' + n + ' administrador? Ele sai do ranking.')) return; await admCall('admin_set_admin', { p_nome: n, p_valor: true }, n + ' agora é admin.'); }
  else if (a === 'rmadm') { if (!confirm('Remover o admin de ' + n + '?')) return; ADMINS.delete(n); await admCall('admin_set_admin', { p_nome: n, p_valor: false }, 'Admin removido.'); }
  else if (a === 'perfil') { $('adm').hidden = true; if (typeof openProfile === 'function') openProfile(n); return; }
  else if (a === 'aviso') { const t = $('admAviso').value.trim(); if (!t) return; await admCall('admin_aviso', { p_texto: t }, 'Aviso publicado.'); loadNotices(); return; }
  else if (a === 'avisoclr') { await admCall('admin_aviso', { p_texto: '' }, 'Aviso removido.'); loadNotices(); return; }
  else if (a === 'evt') { await admCall('admin_evento', { p_tipo: 'moedas', p_mult: +$('admEvM').value, p_horas: +$('admEvH').value }, 'Evento iniciado.'); loadNotices(); return; }
  else if (a === 'evtstop') { await admCall('admin_evento', { p_tipo: 'moedas', p_mult: 1, p_horas: 0 }, 'Evento encerrado.'); loadNotices(); return; }
  const m = $('admMsg').textContent; await admLoad(); admSay(m);
});
let EVT = null;
async function loadNotices() {
  try {
    const [t, ev] = await Promise.all([rpc('aviso_atual'), rpc('evento_atual')]);
    EVT = ev && ev.mult ? ev : null; const parts = [];
    if (EVT) parts.push('Evento: moedas x' + EVT.mult + ' até ' + new Date(EVT.ate).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }));
    if (evtAtivo()) parts.push('Evento ' + EVENTO.nome + ': conquiste o Yamaton na Oficina');
    if (t) parts.push(t);
    const bn = $('admBanner'); bn.textContent = parts.join(' · '); bn.hidden = !parts.length;
  } catch (e) {}
}
loadNotices(); setInterval(loadNotices, 300000);
$('admBanner').addEventListener('click', () => { $('admBanner').hidden = true; });

/* ---------- configurações ---------- */
const cfgEl = $('cfg');
function cfgRefresh() {
  pSoundUi(); $('cfgSound').textContent = muted ? 'Desligado' : 'Ligado'; $('cfgAcct').textContent = sess ? 'Minha conta' : 'Entrar / Criar';
  $('cfgVol').value = cfg.vol; $('cfgVolN').textContent = cfg.vol + '%';
  $('cfgVibRow').hidden = !navigator.vibrate;
  for (const g of document.querySelectorAll('#cfg .seg')) for (const b of g.children) b.classList.toggle('on', +b.dataset.v === cfg[g.dataset.c]);
}
$('cfgVol').addEventListener('input', e => { cfg.vol = +e.target.value; $('cfgVolN').textContent = cfg.vol + '%'; if (master && !muted) master.gain.value = cfg.vol / 100; saveCfg(); });
$('cfg').addEventListener('click', e => {
  const b = e.target.closest('.seg button'); if (!b) return;
  cfg[b.parentNode.dataset.c] = +b.dataset.v; saveCfg(); resize(); cfgRefresh();
  if (b.parentNode.dataset.c === 'vib' && cfg.vib && navigator.vibrate) { try { navigator.vibrate(40); } catch (er) {} }
});
$('cfgReset').addEventListener('click', () => { cfg = Object.assign({}, CFG_DEF); saveCfg(); resize(); if (master && !muted) master.gain.value = cfg.vol / 100; cfgRefresh(); });
$('btnCfg').addEventListener('click', () => { cfgRefresh(); cfgEl.hidden = false; });
$('cfgBack').addEventListener('click', () => { cfgEl.hidden = true; });
$('cfgSound').addEventListener('click', () => { $('btnSound').click(); cfgRefresh(); });
$('pSound').addEventListener('click', () => { $('btnSound').click(); pSoundUi(); });
$('pCfg').addEventListener('click', () => $('btnCfg').click());
$('cfgFull').addEventListener('click', () => { try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) {} });
$('cfgAcct').addEventListener('click', () => { cfgEl.hidden = true; $('btnAcct').click(); });

/* ---------- conquistas ---------- */
let achF = 'all', achC = 'all';
const ACH_ICO = { Combate: '💥', Progresso: '🌊', Frota: '⚓', Ranking: '👑', Evento: '💀' };
const achTier = a => { const r = a.r || 0; return r >= 1500 ? ['plat', 'Platina'] : r >= 600 ? ['ouro', 'Ouro'] : r >= 200 ? ['prata', 'Prata'] : ['bronze', 'Bronze']; };
const achPr = a => { let pr = [0, 1]; try { if (a.p) pr = a.p(); } catch (e) {} return pr; };
function renderAch() {
  const got = ACH.filter(a => save.ach[a.id]), earned = got.reduce((t, a) => t + (a.r || 0), 0), pend = ACH.reduce((t, a) => t + (save.ach[a.id] ? 0 : (a.r || 0)), 0);
  const pct = Math.round(got.length / ACH.length * 100), cats = [...new Set(ACH.map(a => a.c))];
  $('achRing').style.setProperty('--p', pct); $('achRing').setAttribute('aria-label', pct + '% concluído'); $('achPct').textContent = pct + '%';
  $('achNum').textContent = got.length; $('achTot').textContent = '/ ' + ACH.length;
  $('achCoin').innerHTML = '<b>' + fmt(earned) + '</b> moedas ganhas · <b>' + fmt(pend) + '</b> ainda a ganhar';
  const nt = $('achNote'); nt.hidden = !!sess; nt.textContent = 'Entre numa conta para guardar as moedas das conquistas.';
  /* quase lá */
  const near = ACH.filter(a => !save.ach[a.id] && a.p).map(a => ({ a, pr: achPr(a) })).filter(x => x.pr[0] > 0 && x.pr[1] > 0).sort((x, y) => y.pr[0] / y.pr[1] - x.pr[0] / x.pr[1]).slice(0, 3);
  const nx = $('achNext'); nx.hidden = !near.length || achF === 'ok' || achC !== 'all';
  nx.innerHTML = near.length ? '<h3>Quase lá</h3>' + near.map(x => { const pc = clamp(x.pr[0] / x.pr[1], 0, 1); return '<div class="anr"><span>' + esc(x.a.n) + '</span><div class="ac-pb" style="margin:0;--tc:var(--brass)"><u><i style="transform:scaleX(' + pc.toFixed(3) + ')"></i></u></div><span>' + Math.round(pc * 100) + '%</span></div>'; }).join('') : '';
  /* categorias */
  $('achCats').innerHTML = [['all', 'Todas', got.length, ACH.length]].concat(cats.map(c => [c, c, ACH.filter(a => a.c === c && save.ach[a.id]).length, ACH.filter(a => a.c === c).length]))
    .map(x => '<button type="button" role="tab" data-c="' + esc(x[0]) + '" aria-selected="' + (achC === x[0]) + '" class="' + (achC === x[0] ? 'on' : '') + '">' + (ACH_ICO[x[0]] || '') + ' ' + esc(x[1]) + ' <em>' + x[2] + '/' + x[3] + '</em></button>').join('');
  const pool = ACH.filter(a => achC === 'all' || a.c === achC);
  const cnt = { all: pool.length, ok: pool.filter(a => save.ach[a.id]).length }; cnt.lock = cnt.all - cnt.ok;
  for (const t of $('achTabs').children) { t.classList.toggle('on', t.dataset.f === achF); t.lastChild.textContent = cnt[t.dataset.f]; }
  let h = '';
  for (const c of cats) {
    if (achC !== 'all' && c !== achC) continue;
    const all = ACH.filter(a => a.c === c);
    let l = all.filter(a => achF === 'all' || (achF === 'ok') === !!save.ach[a.id]);
    if (achF === 'lock') l = l.map(a => ({ a, v: achPr(a) })).sort((x, y) => (y.v[0] / y.v[1]) - (x.v[0] / x.v[1])).map(x => x.a);
    if (!l.length) continue;
    if (achC === 'all') h += '<div class="ac-cat"><span>' + (ACH_ICO[c] || '') + ' ' + esc(c) + '</span><span>' + all.filter(a => save.ach[a.id]).length + '/' + all.length + '</span></div>';
    for (const a of l) {
      const ok = !!save.ach[a.id], pr = achPr(a), pc = clamp(pr[0] / pr[1], 0, 1), tr = achTier(a);
      h += '<div class="ac-card t-' + tr[0] + (ok ? ' ok' : '') + '"><div class="ac-ico">' + (ok ? ACH_ICO[c] || '★' : '🔒') + '</div><div style="min-width:0"><div class="ac-n">' + esc(a.n) + '<span class="ac-t">' + tr[1] + '</span></div><div class="ac-d">' + esc(a.d) + '</div>' +
        (ok || !a.p ? '' : '<div class="ac-pb"><u><i style="transform:scaleX(' + Math.max(pc, .02).toFixed(3) + ')"></i></u><span>' + fmt(Math.min(pr[0], pr[1])) + ' / ' + fmt(pr[1]) + '</span></div>') + '</div>' +
        '<div class="ac-rw">' + (ok ? '✓ resgatada' : '<b>+' + fmt(a.r || 0) + '</b>moedas') + '</div></div>';
    }
  }
  $('achBody').innerHTML = h || '<p class="note">Nada por aqui ainda.</p>';
}
$('btnAch').addEventListener('click', () => { renderAch(); $('achEl').hidden = false; });
$('achTabs').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { achF = b.dataset.f; renderAch(); } });
$('achCats').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { achC = b.dataset.c; renderAch(); const on = $('achCats').querySelector('.on'); if (on) on.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } });
$('achBack').addEventListener('click', () => { $('achEl').hidden = true; });

/* ---------- oficina ---------- */
const shopEl = $('shop'), shopBody = $('shopBody');
let shopTab = 'ships';
const ITEMS = [
  { k: 'shield', n: 'Escudo inicial', d: 'Começa a partida com escudo por 12 s', cost: 400, max: 5 },
  { k: 'triple', n: 'Tiro triplo inicial', d: 'Começa a partida com tiro triplo por 15 s', cost: 400, max: 5 }
];
function sbar(l, v, mx, ref) {
  const d = ref == null ? 0 : Math.round(v) - Math.round(ref);
  return '<div class="sb"><span>' + l + '</span><i><u style="width:' + clamp(v / mx * 100, 4, 100).toFixed(0) + '%"></u></i><em>' + Math.round(v) + (d ? '<span class="dl ' + (d > 0 ? 'up' : 'dn') + '">' + (d > 0 ? '+' : '−') + Math.abs(d) + '</span>' : '') + '</em></div>';
}
const AB_TAG = { reaper: 'ceifador', adm: 'admin', auto: 'torre', cloak: 'submersão', air: 'aviões', multi: 'tiro triplo', clone: 'clones', surge: 'sobrecarga', esc: 'escolta', msl: 'mísseis' };
const rarTag = s => s.rar ? '<span class="rar r-' + s.rar.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '">' + s.rar + '</span>' : '';
function abTag(s) { for (const k in AB_TAG) if (s[k] && !(k === 'multi' && !(s.multi > 1))) return '<span class="tagab">' + AB_TAG[k] + '</span>'; return ''; }
/* miniatura: desenha o navio no canvas principal e copia (o laço de render repinta em seguida) */
function shipThumb(c, s, acc) {
  const w = c.width, h = c.height, k = Math.min(w / (s.spec.len + 16), h / (s.spec.wid + 16) * 1.0) * .92 * 1;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2); ctx.scale(k, k);
  drawShip(0, 0, 0, s.spec, 0, { recoil: 0, acc });
  ctx.restore();
  const g = c.getContext('2d'); g.clearRect(0, 0, w, h); g.drawImage(cv, 0, 0, w, h, 0, 0, w, h);
  ctx.clearRect(0, 0, w, h);
}
let upShip = null, shopFilter = 'all', armed = '', armT = 0;
const CONFIRM_MIN = 2500;
const rarCls = o => o.rar ? ' rr-' + o.rar.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') : '';
function upCur() { const id = upShip && save.owned.includes(upShip) ? upShip : save.ship; return SHIPS.find(x => x.id === id) || SHIPS[0]; }
const shopShips = () => SHIPS.filter(x => (!x.adminOnly || ADMIN) && ((!x.eventOnly && !x.dailyOnly) || save.owned.includes(x.id)));
function renderEvento() {
  const s = SHIPS.find(x => x.id === EVENTO.ship), e = save.evt || { kills: 0, bosses: 0 }, own = save.owned.includes(s.id), on = evtAtivo();
  const rq = (ic, l, v, m) => '<div class="rq' + (v >= m ? ' ok' : '') + '"><span>' + ic + ' ' + l + '</span><i><u style="width:' + clamp(v / m * 100, 2, 100).toFixed(0) + '%"></u></i><em>' + fmt(Math.min(v, m)) + ' / ' + fmt(m) + '</em></div>';
  const ok = e.kills >= EVENTO.kills && e.bosses >= EVENTO.bosses && save.coins >= EVENTO.coins;
  const ab = [['Ceifador', 'ao destruir um navio inimigo, recupera 8% do HP máximo.'], ['Execução', 'inimigos abaixo de 30% de HP recebem +25% de dano.'], ['Colheita Sombria', 'ao destruir um chefe, recupera 20% do HP máximo.']];
  return '<div class="wc ship evt" data-ship="' + s.id + '" data-id="' + s.id + '"><div class="w-row"><canvas width="152" height="112"></canvas><div class="w-info"><b>' + s.name + rarTag(s) + '</b><small>' + EVENTO.nome + ' · Barco de Evento</small>' +
    sbar('Casco', s.hp, s.hp, null) + '</div></div>' +
    '<div class="evt-ab">' + ab.map(a => '<p><b>' + a[0] + '</b> ' + a[1] + '</p>').join('') + '</div>' +
    '<div class="evt-rq"><small>Requisitos (contam durante o evento)</small>' + rq('⚔️', 'Navios destruídos', e.kills, EVENTO.kills) + rq('👑', 'Chefes derrotados', e.bosses, EVENTO.bosses) + rq('🪙', 'Moedas', Math.min(save.coins, EVENTO.coins), EVENTO.coins) + '</div>' +
    '<div class="w-foot">' + (own ? '<span class="w-tag">Conquistado · permanente</span>' : !on ? '<span class="w-tag off">Evento encerrado</span>' : '<button class="w-btn" data-a="claim" data-id="' + s.id + '"' + (ok ? '' : ' disabled') + '>Resgatar · <b>$ ' + fmt(EVENTO.coins) + '</b></button>') + '</div></div>';
}
function renderShop() {
  const sc = shopEl.scrollTop;
  const st = playerStats(), it = save.items || (save.items = { shield: 0, triple: 0 });
  const eq = SHIPS.find(x => x.id === save.ship) || SHIPS[0], eD = eq.dmg * (eq.multi || 1) / eq.rel;
  const ush = upCur();
  $('shopCoins').textContent = fmt(save.coins);
  const evM = shopTab === 'evt'; $('shopTitle').textContent = evM ? 'Evento' : 'Oficina'; $('shopTabs').hidden = evM; $('shopCur').hidden = evM;
  const cnt = { ships: save.owned.filter(id => shopShips().some(x => x.id === id)).length + '/' + shopShips().length, ups: UPS.reduce((n, u) => n + upOf(ush.id)[u.k], 0) + '/' + UPS.length * MAXLV };
  for (const t of $('shopTabs').children) { t.classList.toggle('on', t.dataset.t === shopTab); t.querySelector('i').textContent = cnt[t.dataset.t]; }
  $('shopCur').innerHTML = [['Casco', st.hp], ['Dano', st.dmg + (st.multi > 1 ? '×' + st.multi : '')], ['Recarga', st.rel.toFixed(2) + ' s'], ['Nós', Math.round(st.spec.speed / 7)]].map(x => '<div><small>' + x[0] + '</small><b>' + x[1] + '</b></div>').join('');
  const need = c => save.coins < c ? '<div class="w-need">Faltam $ ' + fmt(c - save.coins) + '<i><u style="width:' + clamp(save.coins / c * 100, 2, 100).toFixed(0) + '%"></u></i></div>' : '';
  const btn = (a, id, c, l) => { const ar = c >= CONFIRM_MIN && armed === a + id; return '<button class="w-btn' + (ar ? ' armed' : c && save.coins >= c ? ' can' : '') + '" data-a="' + a + '" data-id="' + id + '" data-c="' + (c || 0) + '"' + (c && save.coins < c ? ' disabled' : '') + '>' + (ar ? 'Confirmar? <b>$ ' + fmt(c) + '</b>' : c ? '<b>$ ' + fmt(c) + '</b>' : l) + '</button>'; };
  let h = '';
  if (shopTab === 'ships') {
    const VS_ = shopShips(), mH = Math.max(...VS_.map(x => x.hp)), mD = Math.max(...VS_.map(x => x.dmg * (x.multi || 1) / x.rel)), mS = Math.max(...VS_.map(x => x.speed / 7));
    const has = id => save.owned.includes(id) ? 1 : 0;
    const FL = [['all', 'Todos'], ['own', 'Meus'], ['sale', 'À venda']];
    h += '<div class="ushp wf">' + FL.map(f => '<button type="button" class="gchip' + (shopFilter === f[0] ? ' on' : '') + '" data-a="flt" data-id="' + f[0] + '">' + f[1] + '</button>').join('') + '</div>';
    const list = [...VS_].filter(x => shopFilter === 'all' || (shopFilter === 'own') === !!has(x.id)).sort((x, y) => (y.id === save.ship) - (x.id === save.ship) || has(y.id) - has(x.id) || x.cost - y.cost);
    const nx = (list.find(x => !has(x.id)) || {}).id;
    for (const s of list) {
      const own = has(s.id), cur = s.id === save.ship, ref = !cur;
      h += '<div class="wc ship' + rarCls(s) + (cur ? ' cur' : '') + (s.id === nx ? ' next' : '') + '" data-ship="' + s.id + '" data-id="' + s.id + '"><div class="w-row"><canvas width="152" height="112"></canvas><div class="w-info"><b>' + s.name + rarTag(s) + '</b>' + (s.note ? '<small>' + s.note + '</small>' : '') +
        sbar('Casco', s.hp, mH, ref ? eq.hp : null) + sbar('Dano/s', s.dmg * (s.multi || 1) / s.rel, mD, ref ? eD : null) + sbar('Nós', s.speed / 7, mS, ref ? eq.speed / 7 : null) + '</div></div>' +
        '<div class="w-foot">' + (cur ? '<span class="w-tag">Equipado</span>' : own ? btn('eq', s.id, 0, 'Equipar') : need(s.cost) + btn('buy', s.id, s.cost, 'Comprar')) + '</div></div>';
    }
  } else if (shopTab === 'evt') {
    h = renderEvento();
  } else if (shopTab === 'ups') {
    const eq = ush, up = upOf(ush.id);
    h += '<div class="ushp">' + shopShips().filter(x => save.owned.includes(x.id)).map(x => '<button type="button" class="gchip' + (x.id === ush.id ? ' on' : '') + '" data-a="upsel" data-id="' + x.id + '">' + x.name + '</button>').join('') + '</div><small class="w-hint">Cada navio tem as suas próprias melhorias.</small>';
    const UV = { hull: ['Casco', l => Math.round(eq.hp * (1 + .15 * l))], gun: ['Dano', l => Math.round(eq.dmg * (1 + .12 * l))], rel: ['Recarga', l => (eq.rel * (1 - .07 * l)).toFixed(2) + ' s'], eng: ['Nós', l => Math.round(eq.speed * (1 + .06 * l) / 7)] };
    for (const u of UPS) {
      const l = up[u.k], c = upCost(l), v = UV[u.k];
      h += '<div class="wc" data-id="' + u.k + '"><div class="w-row"><div class="w-info"><b>' + u.n + '<span class="w-lv">nível ' + l + '/' + MAXLV + '</span></b><small>' + u.d + ' por nível</small>' +
        '<div class="w-pips">' + Array.from({ length: MAXLV }, (_, k) => '<u' + (k < l ? ' class="on"' : '') + '></u>').join('') + '</div>' +
        '<div class="w-eff">' + v[0] + ' ' + v[1](l) + (l < MAXLV ? ' → <b>' + v[1](l + 1) + '</b>' : ' <b>máx.</b>') + '</div></div></div>' +
        '<div class="w-foot">' + (l >= MAXLV ? '<span class="w-tag">Máximo</span>' : need(c) + btn('up', u.k, c, 'Melhorar')) + '</div></div>';
    }
  }
  shopBody.innerHTML = h;
  shopEl.scrollTop = sc;
  for (const c of shopBody.querySelectorAll('.wc.ship')) { const sh = SHIPS.find(x => x.id === c.dataset.ship); try { if (sh) shipThumb(c.querySelector('canvas'), sh, []); } catch (e) {} }
}
function applyItems() {
  return;
  const it = save.items; if (!it || !G || !G.player) return;
  if (it.shield > 0) { it.shield--; G.player.shield = 12; }
  if (it.triple > 0) { it.triple--; G.player.triple = 15; }
  persist();
}
shopBody.addEventListener('click', e => {
  const b = e.target.closest('[data-a]');
  if (!b || b.disabled) return;
  const a = b.dataset.a, id = b.dataset.id;
  initAudio();
  if ((SHIPS.find(x => x.id === id) || {}).adminOnly && !ADMIN) return;
  if (a === 'flt') { shopFilter = id; sfx.click && sfx.click(); renderShop(); return; }
  const cst = +b.dataset.c || 0;
  if (cst >= CONFIRM_MIN && armed !== a + id) { armed = a + id; clearTimeout(armT); armT = setTimeout(() => { armed = ''; if (!shopEl.hidden) renderShop(); }, 4000); sfx.click && sfx.click(); renderShop(); return; }
  armed = ''; clearTimeout(armT);
  if (a === 'eq' && save.owned.includes(id)) save.ship = id;
  else if (a === 'buy') {
    const s = SHIPS.find(x => x.id === id);
    if (s && !s.dailyOnly && !s.eventOnly && !save.owned.includes(id) && save.coins >= s.cost) { save.coins -= s.cost; save.owned.push(id); save.ship = id; sfx.pick(); }
  } else if (a === 'claim') {
    claimEvento();
  } else if (a === 'upsel') {
    upShip = id;
  } else if (a === 'up') {
    const U = upOf(upCur().id), l = U[id];
    if (l < MAXLV && save.coins >= upCost(l)) { save.coins -= upCost(l); U[id] = l + 1; sfx.pick(); }
  }
  persist(); pushCloud(); renderShop();
  if (a !== 'eq') { const fc = shopBody.querySelector('.wc[data-id="' + id + '"]'); if (fc) fc.classList.add('flash'); }
});
$('shopTabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { armed = ''; shopTab = b.dataset.t; renderShop(); shopEl.scrollTop = 0; } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !shopEl.hidden) $('shopBack').click(); });
$('btnEvt').addEventListener('click', () => { shopTab = 'evt'; shopEl.hidden = false; renderShop(); shopEl.scrollTop = 0; });
$('btnShop').addEventListener('click', () => { shopTab = 'ships'; shopEl.hidden = false; renderShop(); shopEl.scrollTop = 0; });
$('shopBack').addEventListener('click', () => { shopEl.hidden = true; showOverlay(state === 'over' ? 'over' : 'menu'); if (fromLaunch) { fromLaunch = false; openLaunch(); } });
$('pings').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) { sendPing(+b.dataset.k); b.blur(); } });
$('btnCloak').addEventListener('click', e => { useCloak(); e.currentTarget.blur(); });
$('admMenu').addEventListener('click', e => { if (e.target.closest('[data-tg]')) { apowOpen = !apowOpen; sfx.click(); e.target.blur(); return; } const b = e.target.closest('[data-k]'); if (b && G && G.player.admin) { G.player.apow = b.dataset.k; sfx.click(); b.blur(); } });

/* ---------- recompensa diária ---------- */
const DAILY = [{ c: 500 }, { c: 800 }, { c: 1200 }, { c: 1500, up: 1 }, { c: 3000 }, { c: 5000 }, { c: 15000, ship: 'fenix' }];
/* cada ciclo completo de 7 dias dá +25% de moedas nos ciclos seguintes (máx. +100%) */
const dailyMult = () => 1 + Math.min(4, (save.daily && save.daily.cyc) || 0) * .25;
const dailyCoins = r => Math.round(r.c * dailyMult());
/* data validada pelo servidor (Supabase), no fuso de Brasília: mudar o relógio do aparelho não adianta */
let srvBase = 0, srvPerf = 0, srvOk = false;
async function syncServerTime() {
  try {
    const t0 = performance.now();
    const r = await fetch(SUPABASE_URL + '/rest/v1/rpc/server_time_ms', { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY, 'Content-Type': 'application/json' }, body: '{}' });
    if (!r.ok) return false;
    const ms = Number(await r.json());
    if (!Number.isFinite(ms) || ms < 1.7e12) return false;
    srvBase = ms; srvPerf = (t0 + performance.now()) / 2; srvOk = true; return true;
  } catch (e) { return false; }
}
const srvDay = back => new Date(srvBase + (performance.now() - srvPerf) - 3 * 3600e3 - (back || 0) * 864e5).toISOString().slice(0, 10);
const dailyEl = $('daily');
function dailyInfo() {
  const d = save.daily || { streak: 0, last: '' };
  if (!srvOk) return { off: true, claimed: true, done: d.streak % 7 || (d.streak ? 7 : 0) };
  const claimed = d.last === srvDay(0);
  return { off: false, claimed, done: claimed ? d.streak : d.last === srvDay(1) ? d.streak % 7 : 0 };
}
function dailyDot() { $('btnDaily').classList.toggle('dot', srvOk && !dailyInfo().claimed); }
function ensureSrv() { if (RANK_ON && (!srvOk || performance.now() - srvPerf > 60000)) syncServerTime().then(() => { try { dailyDot(); } catch (e) {} }); }
function renderDaily() {
  const st = dailyInfo(), fx = SHIPS.find(x => x.id === 'fenix'), ownF = save.owned.includes('fenix');
  let h = '<div class="dl-grid">';
  DAILY.forEach((r, i) => {
    const got = i < st.done, now = !st.claimed && i === st.done, big = i === 6;
    h += '<div class="dl-cell' + (got ? ' got' : '') + (now ? ' now' : '') + (big ? ' big' : '') + '"><small>Dia ' + (i + 1) + '</small>' +
      (big ? '<canvas width="152" height="112"></canvas><b>Fênix</b><em>' + (ownF ? 'já conquistado · $ ' + fmt(dailyCoins(r)) : 'barco lendário exclusivo') + '</em>' : '<b>$ ' + fmt(dailyCoins(r)) + '</b>' + (r.up ? '<em>+ melhoria grátis</em>' : '')) + (got ? '<i>✓</i>' : '') + '</div>';
  });
  $('dailyBody').innerHTML = h + '</div>';
  $('dailyStreak').textContent = st.done + '/7';
  { const bm = Math.round((dailyMult() - 1) * 100); $('dailyBonus').textContent = bm ? 'Bônus de ciclos completos: +' + bm + '% de moedas' : 'Complete os 7 dias para ganhar +25% de moedas nos próximos ciclos'; }
  const b = $('dailyClaim'); b.disabled = st.claimed; b.textContent = st.off ? 'Sem conexão' : st.claimed ? 'Volte amanhã' : 'Resgatar dia ' + (st.done + 1);
  const c = dailyEl.querySelector('canvas'); if (c && fx) { try { shipThumb(c, fx, []); } catch (e) {} }
}
async function claimDaily() {
  $('dailyClaim').disabled = true;
  if (!(await syncServerTime())) { renderDaily(); try { banner('Sem conexão', 'Precisa de internet para validar a data'); } catch (e) {} return; }
  const st = dailyInfo(); if (st.claimed) { renderDaily(); dailyDot(); return; }
  const r = DAILY[st.done]; let msg;
  if (r.ship && !save.owned.includes(r.ship)) { save.owned.push(r.ship); msg = 'Você ganhou o barco Fênix!'; }
  else {
    const c = dailyCoins(r); save.coins += c; msg = '+$ ' + fmt(c);
    if (r.up) {
      const U = upOf(save.ship), opts = UPS.filter(u => U[u.k] < MAXLV);
      if (opts.length) { const u = opts[Math.floor(Math.random() * opts.length)]; U[u.k]++; msg += ' e melhoria grátis: ' + u.n; }
    }
  }
  save.daily = { cyc: (save.daily.cyc || 0) + (st.done === 6 ? 1 : 0), streak: st.done + 1, last: srvDay(0) };
  initAudio(); sfx.pick(); persist(); try { pushCloud(); } catch (e) {}
  try { banner('Recompensa diária', msg); } catch (e) {}
  renderDaily(); dailyDot();
}
$('btnDaily').addEventListener('click', () => { renderDaily(); dailyEl.hidden = false; dailyEl.scrollTop = 0; syncServerTime().then(() => { renderDaily(); dailyDot(); }); });
$('dailyClaim').addEventListener('click', claimDaily);

/* ---------- missões diárias (3 por dia, iguais para todos, data do servidor) ---------- */
const MIS = [
  { k: 'kills', t: 'Afunde {n} navios inimigos', n: [20, 30, 45], r: 200 },
  { k: 'waves', t: 'Chegue à onda {n} em uma partida', n: [5, 7, 9], r: 250 },
  { k: 'boss', t: 'Derrote {n} chefe{s}', n: [1, 2, 3], r: 400 },
  { k: 'sharks', t: 'Afunde {n} tubarões', n: [2, 3, 4], r: 300 },
  { k: 'crates', t: 'Colete {n} caixas', n: [4, 6, 8], r: 200 },
  { k: 'score', t: 'Faça {n} pontos em uma partida', n: [2500, 4000, 6000], r: 300 },
  { k: 'games', t: 'Jogue {n} partidas', n: [2, 3, 4], r: 150 },
  { k: 'coins', t: 'Ganhe {n} moedas em partidas', n: [150, 300, 500], r: 250 }
];
const MIS_TIER = [{ n: 'Fácil', m: 1 }, { n: 'Média', m: 1.4 }, { n: 'Difícil', m: 2 }];
const MIS_BONUS = 500, MIS_STREAK = 100, MIS_STREAK_MAX = 7, misEl = $('misEl');
let misTick = 0;
const misToday = () => srvOk ? srvDay(0) : new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const misYest = () => srvOk ? srvDay(1) : new Date(Date.now() - 3 * 3600e3 - 864e5).toISOString().slice(0, 10);
function misPick(day) {
  let h = 5381; for (let i = 0; i < day.length; i++) h = (h * 33 + day.charCodeAt(i)) >>> 0;
  const pool = MIS.slice(), out = [], nx = () => { h = (h * 1664525 + 1013904223) >>> 0; return h >>> 16; };
  for (let i = 0; i < 3; i++) {
    const m = pool.splice(nx() % pool.length, 1)[0], ti = nx() % 3, n = m.n[ti];
    out.push({ k: m.k, n, ti, r: Math.round(m.r * MIS_TIER[ti].m / 10) * 10, t: m.t.replace('{n}', fmt(n)).replace('{s}', n > 1 ? 's' : '') });
  }
  return out;
}
function misState() {
  const day = misToday();
  if (!save.dm || save.dm.d !== day) save.dm = { d: day, p: [0, 0, 0], c: [0, 0, 0], b: 0 };
  return save.dm;
}
const misMs = () => save.ms || (save.ms = { s: 0, l: '' });
/* sequência de dias em que o bônus foi resgatado; só vale se foi hoje ou ontem */
function misStreak() { const m = misMs(), d = misToday(); return m.l === d || m.l === misYest() ? m.s : 0; }
function misNextStreak() { const m = misMs(); return m.l === misYest() ? m.s + 1 : 1; }
function misBonus() { return MIS_BONUS + MIS_STREAK * (Math.min(misNextStreak(), MIS_STREAK_MAX) - 1); }
function misAdd(k, v, max) {
  if (!G || G.vs || MP.role === 'guest') return;
  const st = misState(); let done = false;
  misPick(st.d).forEach((m, i) => {
    if (m.k !== k || st.p[i] >= m.n) return;
    st.p[i] = Math.min(m.n, max ? Math.max(st.p[i], Math.floor(v)) : st.p[i] + Math.floor(v));
    if (st.p[i] >= m.n) { done = true; try { banner('Missão cumprida', m.t); sfx.pick(); } catch (e) {} }
  });
  if (done) { try { persist(); } catch (e) {} }
}
function misDot() {
  const st = misState(), list = misPick(st.d);
  $('btnMis').classList.toggle('dot', list.some((m, i) => st.p[i] >= m.n && !st.c[i]) || (st.c.every(Boolean) && !st.b));
}
function misLeft() {
  const st = misState(), [y, mo, d] = st.d.split('-').map(Number);
  const now = srvOk ? srvBase + (performance.now() - srvPerf) : Date.now();
  return Date.UTC(y, mo - 1, d + 1, 3) - now;
}
function misTime() {
  const ms = misLeft();
  if (ms <= 0) { syncServerTime().then(() => { renderMis(); misDot(); }); return; }
  const h = Math.floor(ms / 3600e3), m = Math.floor(ms % 3600e3 / 60e3);
  $('misTime').textContent = 'Novas missões em ' + (h ? h + 'h ' : '') + m + 'min';
}
function renderMis() {
  const st = misState(), list = misPick(st.d), done = st.c.filter(Boolean).length, all = done === 3;
  const ready = list.filter((m, i) => st.p[i] >= m.n && !st.c[i]), bonus = misBonus(), sk = misStreak();
  $('misCount').textContent = done + '/3';
  $('misStreak').textContent = sk ? 'Sequência: ' + sk + (sk > 1 ? ' dias' : ' dia') : 'Sem sequência';
  $('misTime').textContent = '';
  let h = '';
  if (ready.length >= 2 || (ready.length === 1 && done === 2)) {
    const tot = ready.reduce((s, m) => s + m.r, 0) + (done + ready.length === 3 && !st.b ? bonus : 0);
    h += '<button class="ms-all" type="button" data-i="a">Resgatar tudo · $ ' + fmt(tot) + '</button>';
  }
  h += '<div class="fr-list">' + list.map((m, i) => {
    const ok = st.p[i] >= m.n, got = !!st.c[i], pc = Math.round(Math.min(1, st.p[i] / m.n) * 100);
    return '<div class="ms-card' + (got ? ' got' : ok ? ' ok' : '') + '"><div class="ms-top"><div class="ms-t"><em class="ms-tier t' + m.ti + '">' + MIS_TIER[m.ti].n + '</em><b>' + esc(m.t) + '</b></div><span>$ ' + fmt(m.r) + '</span></div><div class="ms-bar"><i style="width:' + pc + '%"></i></div><div class="ms-bot"><small>' + fmt(st.p[i]) + ' / ' + fmt(m.n) + ' · ' + pc + '%</small><button class="ms-b' + (ok && !got ? ' pri' : '') + '" type="button" data-i="' + i + '"' + (ok && !got ? '' : ' disabled') + '>' + (got ? 'Resgatado' : ok ? 'Resgatar' : 'Em andamento') + '</button></div></div>';
  }).join('');
  h += '<div class="ms-card bonus' + (st.b ? ' got' : all ? ' ok' : '') + '"><div class="ms-top"><div class="ms-t"><b>Bônus: resgatar as 3</b></div><span>$ ' + fmt(bonus) + '</span></div><div class="ms-bot"><small>' + (st.b ? 'Bônus resgatado hoje' : done + ' / 3 resgatadas · +$ ' + MIS_STREAK + ' por dia seguido (até ' + MIS_STREAK_MAX + ')') + '</small><button class="ms-b' + (all && !st.b ? ' pri' : '') + '" type="button" data-i="b"' + (all && !st.b ? '' : ' disabled') + '>' + (st.b ? 'Resgatado' : all ? 'Resgatar' : 'Bloqueado') + '</button></div></div></div>';
  $('misBody').innerHTML = h;
  misTime();
}
async function misClaim(i) {
  const old = save.dm && save.dm.d;
  if (!(await syncServerTime())) { $('misMsg').textContent = 'Precisa de internet para validar a data.'; renderMis(); return; }
  const st = misState();
  if (old && old !== st.d) { $('misMsg').textContent = 'As missões anteriores expiraram. Novas missões disponíveis!'; renderMis(); misDot(); return; }
  const list = misPick(st.d); let gain = 0;
  const take = j => { if (list[j] && st.p[j] >= list[j].n && !st.c[j]) { st.c[j] = 1; gain += list[j].r; } };
  if (i === 'a') list.forEach((m, j) => take(j)); else if (i !== 'b') take(+i);
  if ((i === 'a' || i === 'b') && st.c.every(Boolean) && !st.b) {
    gain += misBonus();
    const ms = misMs(); ms.s = misNextStreak(); ms.l = st.d; st.b = 1;
  }
  if (!gain) { renderMis(); return; }
  save.coins += gain; initAudio(); sfx.pick(); persist(); try { pushCloud(); } catch (e) {}
  try { banner('Missão diária', '+$ ' + fmt(gain)); } catch (e) {}
  $('misMsg').textContent = ''; renderMis(); misDot();
}
$('btnMis').addEventListener('click', () => { $('misMsg').textContent = ''; renderMis(); misEl.hidden = false; misEl.scrollTop = 0; clearInterval(misTick); misTick = setInterval(misTime, 20000); syncServerTime().then(() => { renderMis(); misDot(); }); });
$('misBack').addEventListener('click', () => { misEl.hidden = true; clearInterval(misTick); misDot(); });
$('misBody').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b && !b.disabled) { b.disabled = true; misClaim(b.dataset.i); } });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !misEl.hidden) $('misBack').click(); });
$('dailyBack').addEventListener('click', () => { dailyEl.hidden = true; dailyDot(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !dailyEl.hidden) $('dailyBack').click(); });

/* ---------- amizades, conversas privadas e convites ---------- */
const frEl = $('frEl');
let frTab = 'amigos', frChat = null, frChatT = 0, frChatSig = '', frUnread = 0, frNew = new Set(), frBox = [], frSum = {}, frData = { amigos: [], enviados: [], recebidos: [] };
const FR_TXT = {
  ok: 'Pedido enviado.', aceito: 'Vocês agora são amigos!', recusado: 'Pedido recusado.',
  nome_invalido: 'Nome inválido: use 3 a 16 letras minúsculas, números ou _.',
  nao_encontrado: 'Não existe nenhuma conta com esse nome.', proprio: 'Esse é o seu próprio nome.',
  ja_amigos: 'Vocês já são amigos.', ja_pedido: 'Você já enviou um pedido para essa pessoa.',
  muitos_pedidos: 'Você tem pedidos demais pendentes. Espere alguns serem respondidos.',
  lista_cheia: 'Sua lista de amigos está cheia (100).', nao_existe: 'Esse pedido não existe mais.',
  texto_invalido: 'A mensagem precisa ter de 1 a 200 caracteres.', nao_amigo: 'Só dá para falar com amigos.',
  devagar: 'Calma: espere um pouco antes de repetir.', chat_cheio: 'Essa pessoa ainda não leu suas últimas mensagens.',
  sala_invalida: 'Sala inválida.', sem_login: 'Entre numa conta primeiro.'
};
const frSay = t => { $('frMsg').textContent = t || ''; };
async function frCall(fn, args) {
  const d = await rpc(fn, args);
  if (d && typeof d === 'object' && !Array.isArray(d) && d.message && d.code) throw new Error(d.code === 'PGRST202' ? 'nao_instalado' : d.message);
  return d;
}
const frErr = e => e && e.message === 'nao_instalado' ? 'Falta instalar essa parte no servidor (rode o chat_convites.sql).' : 'Sem conexão. Tente de novo.';
function frAgo(ts) { const s = Math.max(0, (Date.now() - Date.parse(ts)) / 1000); return s < 60 ? 'agora' : s < 3600 ? Math.floor(s / 60) + ' min' : s < 86400 ? Math.floor(s / 3600) + ' h' : Math.floor(s / 86400) + ' d'; }
function frBadge() {
  const set = (id, n) => { const b = $(id); b.hidden = !(n > 0); b.textContent = n > 99 ? '99+' : n; };
  set('frN', frUnread);
  set('frTabN', frBox.filter(m => !m.lida).length);
  set('frTabA', Object.values(frSum).reduce((t, x) => t + (+x.nao_lidas || 0), 0));
}
async function frPoll() {
  if (!sess || !RANK_ON) { frUnread = 0; frBadge(); return; }
  try {
    let n; try { n = await frCall('mf_nao_lidas'); } catch (e) { n = await frCall('mf_caixa_nao_lidas'); }
    if (typeof n === 'number') { frUnread = n; frBadge(); }
  } catch (e) {}
}
setInterval(() => { if (sess && !document.hidden && state !== 'playing') frPoll(); }, 20000);
const frBtn = (a, label, o) => '<button' + (o && (o.pri || o.dng) ? ' class="' + (o.pri ? 'pri' : 'dng') + '"' : '') + ' type="button" data-a="' + a + '"' + (o && o.id ? ' data-id="' + esc(o.id) + '"' : '') + (o && o.n ? ' data-n="' + esc(o.n) + '"' : '') + '>' + label + '</button>';
const FR_COL = ['#e0a93c', '#4fd1a5', '#5aa9ff', '#b074ff', '#e2552f', '#7fe3ff'];
function frAv(nome) { const s = String(nome || '?'); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; const c = THUMBS.get(s), ph = sess && s === sess.nome ? (save.prof && (save.prof.thumb || save.prof.photo)) : (c && c[0]); return '<span class="fr-av" style="background:' + FR_COL[h % FR_COL.length] + '" aria-hidden="true">' + (ph ? '<img alt="" src="' + esc(ph) + '">' : esc(s.charAt(0))) + '</span>'; }
const FR_ICO = { users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>' };
const frEmpty = (ico, t, s) => '<div class="fr-empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + FR_ICO[ico] + '</svg><b>' + t + '</b><span>' + s + '</span></div>';
const frSec = (t, n) => '<p class="fr-sec">' + t + (n ? ' <b>' + n + '</b>' : '') + '</p>';
const frRow = (cls, av, main, act) => '<div class="fr-row' + (cls ? ' ' + cls : '') + '">' + av + '<div class="fr-main">' + main + '</div><div class="fr-act">' + act + '</div></div>';
function frRender() {
  const chat = !!(frChat && sess);
  for (const t of $('frTabs').children) t.classList.toggle('on', t.dataset.t === frTab);
  $('frTabs').hidden = chat; $('frChat').hidden = !chat; $('frBody').hidden = chat;
  $('frAddBox').hidden = !sess || frTab !== 'add' || chat;
  const b = $('frBody');
  if (chat) { $('frChatName').textContent = frChat.nome; $('frChatAv').innerHTML = frAv(frChat.nome); return; }
  if (!sess) {
    $('frCount').textContent = '';
    b.innerHTML = frEmpty('users', 'Entre numa conta', 'Com uma conta você tem amigos, conversas e convites.') + '<div class="actions"><button class="btn" type="button" data-a="login">Entrar / Criar conta</button></div>';
    return;
  }
  const na = frData.amigos.length;
  $('frCount').textContent = na + (na === 1 ? ' amigo' : ' amigos');
  let h = '';
  if (frTab === 'amigos') {
    if (frData.recebidos.length) h += frSec('Pedidos recebidos', frData.recebidos.length) + '<div class="fr-list">' + frData.recebidos.map(x =>
      frRow('req', frAv(x.nome), '<b>' + esc(x.nome) + '</b><small>quer ser seu amigo</small>', frBtn('acc', 'Aceitar', { pri: 1, id: x.id }) + frBtn('rej', 'Recusar', { id: x.id }))).join('') + '</div>';
    h += frSec('Meus amigos', na);
    h += na ? '<div class="fr-list">' + frData.amigos.map(x => {
      const s = frSum[x.id] || {}, nl = +s.nao_lidas || 0;
      return frRow(nl ? 'new' : '', frAv(x.nome), '<b>' + esc(x.nome) + (nl ? '<i class="frn inl">' + nl + '</i>' : '') + '</b>' + (s.ultima ? '<span class="fr-prev">' + esc(s.ultima) + '</span>' : '<small>amigo</small>'),
        frBtn('msg', 'Conversar', { pri: 1, id: x.id, n: x.nome }) + frBtn('vs', 'Desafiar', { id: x.id, n: x.nome }) + frBtn('rem', 'Remover', { dng: 1, id: x.id, n: x.nome }));
    }).join('') + '</div>' : frEmpty('users', 'Sem amigos ainda', 'Toque em Adicionar e digite o nome de um jogador para enviar um pedido.');
  } else if (frTab === 'caixa') {
    if (frBox.some(m => m.lida && m.tipo !== 'pedido')) h += '<div class="fr-top"><div class="fr-act">' + frBtn('clear', 'Limpar lidas') + '</div></div>';
    h += frBox.length ? '<div class="fr-list">' + frBox.map(m => {
      const cls = frNew.has(m.id) ? 'new' : '', ago = frAgo(m.criada), nm = esc(m.de_nome || '?');
      if (m.tipo === 'pedido') return frRow(cls + ' req', frAv(m.de_nome), '<b>' + nm + '</b><small>quer ser seu amigo · ' + ago + '</small>', frBtn('acc', 'Aceitar', { pri: 1, id: m.de }) + frBtn('rej', 'Recusar', { id: m.de }));
      if (m.tipo === 'convite') {
        const p = String(m.texto).split('|'), cod = esc(p[0]), exp = Date.now() - Date.parse(m.criada) > 900000;
        return frRow(cls + ' req', frAv(m.de_nome), '<b>' + nm + '</b><small>convidou você · ' + ago + '</small><span class="fr-txt">Sala <b>' + cod + '</b> · ' + (p[1] === '1' ? 'Duelo 1×1' : 'Esquadra') + (exp ? ' · expirado' : '') + '</span>',
          (exp ? '' : frBtn('join', 'Entrar', { pri: 1, id: m.id, n: p[0] + '|' + (p[1] || '0') })) + frBtn('del', 'Apagar', { id: m.id }));
      }
      if (m.tipo === 'mensagem') return frRow(cls, frAv(m.de_nome), '<b>' + nm + '</b><small>' + ago + '</small><span class="fr-txt fr-bub">' + esc(m.texto) + '</span>', (m.de ? frBtn('reply', 'Responder', { pri: 1, id: m.de, n: m.de_nome }) : '') + frBtn('del', 'Apagar', { id: m.id }));
      return frRow(cls, '<span class="fr-av sys" aria-hidden="true">!</span>', '<span class="fr-txt">' + esc(m.texto) + '</span><small>aviso · ' + ago + '</small>', frBtn('del', 'Apagar', { id: m.id }));
    }).join('') + '</div>' : frEmpty('mail', 'Caixa vazia', 'Pedidos de amizade, convites e avisos aparecem aqui.');
  } else {
    if (frData.enviados.length) h += frSec('Pedidos enviados', frData.enviados.length) + '<div class="fr-list">' + frData.enviados.map(x =>
      frRow('', frAv(x.nome), '<b>' + esc(x.nome) + '</b><small>aguardando resposta</small>', frBtn('cancel', 'Cancelar', { dng: 1, id: x.id }))).join('') + '</div>';
    else h += frEmpty('send', 'Convide um amigo', 'Digite o nome exato do jogador, o mesmo que ele usa para entrar.');
  }
  b.innerHTML = h;
}
async function frMarkRead() {
  if (!frBox.some(m => !m.lida)) return;
  frBox.forEach(m => { m.lida = true; }); frBadge();
  try { await frCall('mf_caixa_ler', {}); } catch (e) {}
  frPoll();
}
function frSetTab(t) {
  frTab = t;
  if (t === 'caixa') frBox.forEach(m => { if (!m.lida) frNew.add(m.id); });
  frRender();
  if (t === 'caixa') frMarkRead();
}
async function frLoad(keepMsg) {
  if (!sess) { frRender(); return; }
  if (!keepMsg) frSay('Carregando…');
  try {
    const [l, c, s] = await Promise.all([frCall('mf_amigo_lista'), frCall('mf_caixa_lista'), frCall('mf_chat_resumo').catch(() => [])]);
    if (l && Array.isArray(l.amigos)) frData = { amigos: l.amigos, enviados: l.enviados || [], recebidos: l.recebidos || [] };
    frBox = Array.isArray(c) ? c : [];
    frSum = {}; (Array.isArray(s) ? s : []).forEach(x => { frSum[x.id] = x; });
    await loadThumbs([...frData.amigos, ...frData.enviados, ...frData.recebidos].map(x => x.nome).concat(frBox.map(m => m.de_nome)).filter(Boolean));
    if (!keepMsg) frSay('');
    if (frTab === 'caixa') { frBox.forEach(m => { if (!m.lida) frNew.add(m.id); }); frRender(); frMarkRead(); }
    else { frRender(); frBadge(); }
    frPoll();
  } catch (e) { frSay(frErr(e)); frRender(); }
}
/* conversa privada */
async function frChatLoad(first) {
  if (!frChat) return;
  const id = frChat.id;
  try {
    const d = await frCall('mf_chat_abrir', { p_com: id });
    if (!frChat || frChat.id !== id || !Array.isArray(d)) return;
    const sig = (d.length ? d[d.length - 1].id : 0) + ':' + d.length;
    if (!first && sig === frChatSig) return;
    frChatSig = sig;
    const box = $('frMsgs'), atEnd = first || box.scrollHeight - box.scrollTop - box.clientHeight < 60;
    box.innerHTML = d.length ? d.map(m => '<div class="fr-m' + (m.minha ? ' me' : '') + '">' + esc(m.texto) + '<small>' + frAgo(m.criada) + '</small></div>').join('') : '<p class="note" style="margin:auto;text-align:center">Nenhuma mensagem ainda. Diga olá!</p>';
    if (atEnd) box.scrollTop = box.scrollHeight;
    frPoll();
  } catch (e) { if (first) frSay(frErr(e)); }
}
function frChatStop() { clearInterval(frChatT); frChatT = 0; frChat = null; frChatSig = ''; }
async function frOpenChat(id, nome) {
  frChatStop(); frChat = { id, nome: nome || '?' }; frSay('');
  if (frSum[id]) frSum[id].nao_lidas = 0;
  $('frMsgs').innerHTML = ''; frRender(); frBadge();
  frChatT = setInterval(() => { if (!frEl.hidden && frChat) frChatLoad(false); }, 4000);
  await frChatLoad(true);
  $('frText').focus();
}
async function frChallenge(id, nome) {
  frEl.hidden = true; frChatStop(); openMp(true);
  $('mpCreate').click();
  for (let i = 0; i < 50 && !(MP.role === 'host' && MP.code && $('mpBig').textContent === MP.code); i++) await new Promise(r => setTimeout(r, 200));
  if (!(MP.role === 'host' && MP.code && $('mpBig').textContent === MP.code)) return;
  try {
    const r = await frCall('mf_convite_enviar', { p_para: id, p_sala: MP.code, p_vs: true });
    mpSay(r === 'ok' ? 'Desafio enviado para ' + nome + '. Aguarde na sala.' : (FR_TXT[r] || 'Não foi possível enviar o desafio.'));
  } catch (e) { mpSay(frErr(e)); }
}
function frJoin(code, vs, caixaId) {
  frEl.hidden = true; frChatStop(); openMp(vs);
  $('mpCode').value = code; $('mpJoin').click();
  if (caixaId) frCall('mf_caixa_apagar', { p_id: +caixaId }).catch(() => {});
  frPoll();
}
$('btnFr').addEventListener('click', () => { frChatStop(); frTab = 'amigos'; frNew = new Set(); frSay(''); frEl.hidden = false; frEl.scrollTop = 0; frRender(); frLoad(); });
$('frBack').addEventListener('click', () => { frChatStop(); frEl.hidden = true; frPoll(); });
$('frChatBack').addEventListener('click', () => { frChatStop(); frSay(''); frRender(); frLoad(true); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !frEl.hidden) $(frChat ? 'frChatBack' : 'frBack').click(); });
$('frTabs').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (b) { frSay(''); frSetTab(b.dataset.t); } });
$('frBody').addEventListener('click', async e => {
  const b = e.target.closest('[data-a]');
  if (!b || b.disabled) return;
  const a = b.dataset.a, id = b.dataset.id;
  if (a === 'login') { frEl.hidden = true; $('btnAcct').click(); return; }
  if (a === 'msg' || a === 'reply') { frOpenChat(id, b.dataset.n); return; }
  if (a === 'vs') { frChallenge(id, b.dataset.n || 'seu amigo'); return; }
  if (a === 'join') { const p = (b.dataset.n || '').split('|'); if (/^[A-Z]{4}$/.test(p[0])) frJoin(p[0], p[1] === '1', id); return; }
  if (a === 'rem' && !confirm('Remover ' + (b.dataset.n || 'este jogador') + ' dos amigos?')) return;
  b.disabled = true;
  try {
    let r, say = '';
    if (a === 'acc' || a === 'rej') { r = await frCall('mf_amigo_responder', { p_de: id, p_aceitar: a === 'acc' }); say = FR_TXT[r] || ''; }
    else if (a === 'rem') { await frCall('mf_amigo_remover', { p_id: id }); say = 'Amigo removido.'; }
    else if (a === 'cancel') { await frCall('mf_amigo_remover', { p_id: id }); say = 'Pedido cancelado.'; }
    else if (a === 'del') await frCall('mf_caixa_apagar', { p_id: +id });
    else if (a === 'clear') await frCall('mf_caixa_apagar', {});
    frSay(say);
    await frLoad(true);
  } catch (err) { frSay(frErr(err)); b.disabled = false; }
});
$('frAdd').addEventListener('click', async () => {
  const n = $('frName').value.trim().toLowerCase();
  if (!n) return;
  $('frAdd').disabled = true; frSay('Enviando…');
  try {
    const r = await frCall('mf_amigo_pedir', { p_nome: n });
    frSay(FR_TXT[r] || 'Não foi possível enviar o pedido.');
    if (r === 'ok' || r === 'aceito') { $('frName').value = ''; await frLoad(true); }
  } catch (e) { frSay(frErr(e)); } finally { $('frAdd').disabled = false; }
});
$('frSend').addEventListener('click', async () => {
  const t = $('frText').value.trim();
  if (!frChat || !t) return;
  $('frSend').disabled = true;
  try {
    const r = await frCall('mf_chat_enviar', { p_para: frChat.id, p_texto: t });
    if (r === 'ok') { $('frText').value = ''; frSay(''); await frChatLoad(true); }
    else frSay(FR_TXT[r] || 'Não foi possível enviar.');
  } catch (e) { frSay(frErr(e)); } finally { $('frSend').disabled = false; $('frText').focus(); }
});
for (const id of ['frName', 'frText']) {
  $(id).addEventListener('keydown', e => { if (e.key !== 'Escape') e.stopPropagation(); if (e.key === 'Enter') $(id === 'frName' ? 'frAdd' : 'frSend').click(); });
  $(id).addEventListener('keyup', e => e.stopPropagation());
}
$('frName').addEventListener('input', e => { e.target.value = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); });
/* convidar amigos na sala (só o anfitrião) */
async function mpInvLoad() {
  const box = $('mpInvBox'); box.hidden = true;
  if (!sess || !RANK_ON) return;
  try {
    const l = await frCall('mf_amigo_lista'), am = l && Array.isArray(l.amigos) ? l.amigos : [];
    $('mpInvN').textContent = am.length ? am.length + (am.length === 1 ? ' amigo' : ' amigos') : '';
    $('mpInv').innerHTML = am.length ? '<div class="fr-list">' + am.map(x => frRow('', frAv(x.nome), '<b>' + esc(x.nome) + '</b>', frBtn('inv', 'Convidar', { pri: 1, id: x.id, n: x.nome }))).join('') + '</div>' : '<p class="note">Adicione amigos no menu Amigos para poder convidá-los.</p>';
    box.hidden = false;
  } catch (e) {}
}
$('mpInv').addEventListener('click', async e => {
  const b = e.target.closest('[data-a="inv"]');
  if (!b || b.disabled || !MP.code) return;
  b.disabled = true; const t0 = b.textContent;
  try {
    const r = await frCall('mf_convite_enviar', { p_para: b.dataset.id, p_sala: MP.code, p_vs: !!vsMode });
    if (r === 'ok') { b.textContent = 'Enviado ✓'; setTimeout(() => { b.disabled = false; b.textContent = t0; }, 30000); mpSay('Convite enviado para ' + b.dataset.n + '.'); }
    else { b.disabled = false; mpSay(FR_TXT[r] || 'Não foi possível convidar.'); }
  } catch (err) { b.disabled = false; mpSay(frErr(err)); }
});

/* ---------- entrada ---------- */
function stickHome(k) { return k === 'move' ? [W * .2, H - 118] : [W * .8, H - 118]; }
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse') {
    setTouchMode(false);
    mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    if (e.button === 0) mouse.down = true;
    return;
  }
  setTouchMode(true);
  const k = e.clientX < W / 2 ? 'move' : 'aim';
  if (sticks[k]) return;
  const st = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY, vx: 0, vy: 0, mag: 0 };
  if (cfg.stick) {
    const h = stickHome(k); st.ox = h[0]; st.oy = h[1];
    const dx = e.clientX - st.ox, dy = e.clientY - st.oy, len = Math.hypot(dx, dy);
    st.vx = len ? dx / len : 0; st.vy = len ? dy / len : 0; st.mag = Math.min(1, len / STICK_R);
    st.x = st.ox + st.vx * Math.min(len, STICK_R); st.y = st.oy + st.vy * Math.min(len, STICK_R);
  }
  sticks[k] = st;
  used[k] = true;
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; return; }
  for (const k of ['move', 'aim']) {
    const s = sticks[k];
    if (s && s.id === e.pointerId) {
      const dx = e.clientX - s.ox, dy = e.clientY - s.oy, len = Math.hypot(dx, dy);
      s.vx = len ? dx / len : 0; s.vy = len ? dy / len : 0;
      s.mag = Math.min(1, len / STICK_R);
      s.x = s.ox + s.vx * Math.min(len, STICK_R); s.y = s.oy + s.vy * Math.min(len, STICK_R);
    }
  }
});
function endPointer(e) {
  if (e.pointerType === 'mouse') { mouse.down = false; return; }
  for (const k of ['move', 'aim']) if (sticks[k] && sticks[k].id === e.pointerId) sticks[k] = null;
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
window.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') mouse.down = false; });
window.addEventListener('keydown', e => {
  if (/^Digit[1-4]$/.test(e.code) && !e.repeat && G && G.allies.length && state === 'playing') { sendPing(+e.code.slice(5) - 1); return; }
  if (e.code === 'KeyQ' && !e.repeat && G && G.player.admin && state === 'playing') { admCycle(); return; }
  if ((e.code === 'KeyE' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') && !e.repeat) { useCloak(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (!e.repeat) togglePause(); return; }
  const nav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(e.code);
  if (state === 'playing' && (nav || e.code === 'Space')) e.preventDefault();
  if (nav) setTouchMode(false);
  keys.add(e.code);
});
window.addEventListener('keyup', e => keys.delete(e.code));
window.addEventListener('blur', () => { keys.clear(); mouse.down = false; });
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });
window.addEventListener('resize', resize);
/* tenta travar em paisagem (tela cheia) no primeiro toque; se não der, o aviso de girar cobre a tela */
let lockTried = false;
function tryLandscape() {
  if (lockTried || !matchMedia('(pointer: coarse)').matches) return;
  lockTried = true;
  try {
    const el = document.documentElement;
    const fs = el.requestFullscreen ? el.requestFullscreen({ navigationUI: 'hide' }) : null;
    Promise.resolve(fs).then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape')).catch(() => {});
  } catch (e) {}
}
window.addEventListener('pointerdown', tryLandscape, { once: true });


/* ---------- laço principal ---------- */
const fpsEl = $('fpsEl');
let fpsN = 0, fpsT = 0, fpsShown = -1;
function fpsTick(dt) {
  if (!cfg.fps) { if (!fpsEl.hidden) fpsEl.hidden = true; fpsN = 0; fpsT = 0; return; }
  if (fpsEl.hidden) fpsEl.hidden = false;
  if (!(dt > 0) || dt > 1) return;
  fpsN++; fpsT += dt;
  if (fpsT >= .5) {
    const f = Math.round(fpsN / fpsT);
    fpsN = 0; fpsT = 0;
    if (f !== fpsShown) {
      fpsShown = f;
      fpsEl.textContent = f + ' FPS';
      fpsEl.style.color = f >= 50 ? 'var(--good)' : f >= 30 ? 'var(--brass)' : 'var(--rust)';
    }
  }
}
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  fpsTick(dt);
  if (!(dt > 0)) dt = 0;
  if (dt > .05) dt = .05;
  tickResume(dt);
  if (state !== 'paused' && !(resumeCd > 0)) step(dt);
  render();
  hud();
}

(function hideLoading() {
  const t0 = performance.now(), L = $('loading'), fill = $('ldFill'), pct = $('ldPct'), tipEl = $('ldTip'), stage = $('ldStage');
  const tips = [
    'Mova-se com WASD e mire com o mouse. Espaço também atira.',
    'Caixas soltas pelos inimigos dão reparo, escudo ou tiro triplo.',
    'Passe bem perto de uma caixa e ela vem até você.',
    'Sombras escuras na água são minas: desvie delas!',
    'O Nautilon fica invisível e invulnerável por 9 s.',
    'O Mirage 3 cria até 3 clones que atraem o fogo e só somem se forem destruídos.',
    'Navios com várias torretas atiram de todos os canos de uma vez.',
    'Chefes e encouraçados têm muitas torretas: mantenha distância.',
    'As moedas das vitórias compram novos navios na Oficina.',
    'Hardcore: inimigos usam poderes de navios e chefes têm o triplo de vida.',
    'Ilhas e icebergs bloqueiam navios e tiros; use-os como cobertura. Redemoinhos puxam e giram quem passa perto.',
    'O minimapa mostra inimigos, aliados, caixas e perigos ao redor do seu navio.',
    'Um arco vermelho em volta do navio indica de que lado você levou dano.',
    'Abaixo de 50% de vida o chefe fica enfurecido: mais rápido e com mais tiros.'
  ];
  for (let k = tips.length - 1; k > 0; k--) { const r = Math.floor(Math.random() * (k + 1)); [tips[k], tips[r]] = [tips[r], tips[k]]; }
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const loaded = new Promise(r => { if (document.readyState === 'complete') r(); else window.addEventListener('load', r); });
  const fonts = (document.fonts && document.fonts.ready) || Promise.resolve();
  const steps = [
    { n: 'Carregando fontes', p: Promise.race([fonts, wait(4000)]) },
    { n: 'Carregando recursos', p: Promise.race([loaded, wait(6000)]) }
  ];
  if (sess) steps.push({ n: 'Sincronizando conta', p: Promise.race([CLOUD_READY, wait(3500)]) });
  steps.push({ n: 'Carregando canhões', p: wait(900) });
  let doneN = 0;
  for (const st of steps) { const ok = () => { st.done = true; doneN++; }; st.p.then(ok, ok); }
  let ti = 0, prog = 0, finished = false;
  const showTip = () => { tipEl.style.opacity = 0; setTimeout(() => { tipEl.textContent = tips[ti++ % tips.length]; tipEl.style.opacity = 1; }, 300); };
  tipEl.textContent = tips[ti++ % tips.length];
  const tipI = setInterval(showTip, 3000);
  const paint = () => {
    fill.style.width = prog.toFixed(1) + '%'; pct.textContent = Math.round(prog) + '%';
    const cur = steps.find(x => !x.done);
    stage.textContent = prog >= 99.5 ? 'Zarpando' : cur ? cur.n : 'Zarpando';
  };
  const progI = setInterval(() => {
    if (finished) return;
    const all = doneN >= steps.length, per = 100 / steps.length;
    const target = all ? 100 : Math.min(98, doneN * per + per * .75);
    prog += (target - prog) * (all ? .25 : .08);
    if (all && target - prog < .4) prog = 100;
    paint();
    if (prog >= 100 && performance.now() - t0 >= 1800) {
      finished = true; clearInterval(progI); paint();
      setTimeout(() => { clearInterval(tipI); L.classList.add('out'); setTimeout(() => L.remove(), 700); }, 350);
    }
  }, 60);
})();

resize();
newGame();
setState('menu');
showOverlay('menu');
requestAnimationFrame(frame);
try { const qs = new URLSearchParams(location.search), sl = qs.get('sala'); if (sl && /^[A-Za-z]{4}$/.test(sl)) { (qs.get('vs') ? $('btnVs') : $('btnMp')).click(); $('mpCode').value = sl.toUpperCase(); } } catch (e) {}
})();
