/* Cinnamon Coffee — sistema de movimiento
   ------------------------------------------------------------------------
   Motion (motion.dev) servido desde el repo: sin esperar a un CDN.

   Principios (Emil Kowalski):
   - Una sola curva para entrar: ease-out fuerte. Nada de ease-in en entradas.
   - Duraciones cortas y de una misma escala (ver T.dur). Lo grande dura un
     poco más, lo chico menos; nunca más de ~0,8 s.
   - Siempre opacidad + desplazamiento corto + blur leve, juntos: así nada
     "aparece de golpe" ni viaja demasiado.
   - Nada nace en scale(0): se parte de 0,96–1,06.
   - Solo transform, opacity y filter.
   - Springs solo para lo que responde a la mano (puntero, click).
   - prefers-reduced-motion: todo visible, sin animar. */

import { animate, inView, scroll, stagger } from "./vendor/motion-11.11.13.js";

/* ---------- Tokens ---------- */

const T = {
  ease: [0.23, 1, 0.32, 1], // ease-out fuerte (mismo valor que --ease-out en CSS)
  dur: { fast: 0.3, base: 0.6, hero: 0.8 },
  stagger: 0.06,
  rise: 16, // px que sube un elemento al entrar
  blur: 6, // px de desenfoque inicial
  follow: { type: "spring", stiffness: 150, damping: 20, mass: 0.6 },
  tap: { type: "spring", bounce: 0.25, duration: 0.6 },
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

/* ---------- Primitivas ---------- */

// Entrada estándar: opacidad + subida corta + blur. La usa todo el sitio.
const enter = (el, { delay = 0, duration = T.dur.base, rise = T.rise } = {}) =>
  animate(
    el,
    { opacity: [0, 1], y: [rise, 0], filter: [`blur(${T.blur}px)`, "blur(0px)"] },
    { duration, delay, ease: T.ease },
  );

// Grupo: la misma entrada, escalonada.
const enterGroup = (els, { delay = 0 } = {}) =>
  animate(
    els,
    { opacity: [0, 1], y: [T.rise, 0], filter: [`blur(${T.blur}px)`, "blur(0px)"] },
    { duration: T.dur.base, delay: stagger(T.stagger, { startDelay: delay }), ease: T.ease },
  );

/* ---------- Nav ---------- */

const nav = $("#nav");
const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 8);
addEventListener("scroll", onScroll, { passive: true });
onScroll();

const yearEl = $("#year");
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- Título del hero, palabra por palabra ---------- */

function splitWords(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) return frag.append(" ");
          const span = document.createElement("span");
          span.className = "word";
          span.textContent = part;
          frag.append(span);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1) walk(child);
    });
  };
  walk(el);
  return $$(".word", el);
}

/* ---------- Coreografía ---------- */

if (!reduceMotion) {
  try {
    heroIntro();
    heroInteraction();
    sections();
    window.__motion = true;
  } catch (err) {
    console.error(err);
    root.classList.remove("motion-ready");
  }
}

/* Hero: texto y taza entran en paralelo; todo termina en ~1 s.
   La taza "se apoya" en el plato: baja poco, se achica de 1,06 a 1 (desde
   arriba, más cerca = más grande), gira hasta acomodar el asa y su sombra
   se cierra a la vez. El fade dura casi todo el movimiento: nunca hay pop. */
function heroIntro() {
  const title = $("[data-split]");
  const words = splitWords(title);
  words.forEach((w) => (w.style.opacity = 0));
  title.style.opacity = 1;

  enterGroup(words, { delay: 0.05 });
  enterGroup($$("[data-hero]"), { delay: 0.25 });

  animate(
    "#plate",
    { opacity: [0, 1], scale: [0.96, 1], filter: ["blur(8px)", "blur(0px)"] },
    { duration: T.dur.hero, delay: 0.05, ease: T.ease },
  );
  animate(
    "#cup",
    {
      opacity: [0, 1],
      y: [-24, 0],
      scale: [1.06, 1],
      rotate: [-10, 0],
      filter: [`blur(${T.blur}px)`, "blur(0px)"],
    },
    { duration: T.dur.hero, delay: 0.18, ease: T.ease },
  );
  animate("#cupShadow", { opacity: [0, 1], scale: [1.12, 1] }, { duration: T.dur.hero, delay: 0.18, ease: T.ease });
  animate(".hero__ring", { opacity: [0, 1] }, { duration: T.dur.hero, delay: 0.3, ease: T.ease });
}

/* Interacción: springs, porque responden a la mano. */
function heroInteraction() {
  const hero = $(".hero");
  const media = $("#heroCup");
  const lift = $("#cupLift");
  const shadow = $("#cupShadow");

  if (finePointer) {
    // Parallax: la taza (más cerca) apenas más que el plato.
    const layers = $$("[data-depth]");
    let frame = 0;
    hero.addEventListener("pointermove", (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = media.getBoundingClientRect();
        const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 1.2)));
        const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 1.2)));
        layers.forEach((l) => animate(l, { x: nx * +l.dataset.depth, y: ny * +l.dataset.depth }, T.follow));
      });
    });
    hero.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      layers.forEach((l) => animate(l, { x: 0, y: 0 }, T.follow));
    });

    // Hover: la taza se levanta apenas y su sombra se abre.
    lift.addEventListener("pointerenter", () => {
      animate(lift, { scale: 1.03, y: -3 }, T.follow);
      animate(shadow, { scale: 1.05, opacity: 0.7 }, T.follow);
    });
    lift.addEventListener("pointerleave", () => {
      animate(lift, { scale: 1, y: 0 }, T.follow);
      animate(shadow, { scale: 1, opacity: 1 }, T.follow);
    });
  } else {
    // Táctil: no hay hover, así que el scroll hace de mano. Mientras la página
    // se mueve, la taza se levanta (el mismo gesto del hover) y las capas se
    // quedan un poco atrás por inercia; al frenar, vuelve a apoyarse.
    const layers = $$("[data-depth]");
    let lastY = scrollY;
    let lastT = performance.now();
    let frame = 0;
    let idle = 0;
    let lifted = false;
    let visible = true;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(media);

    const settle = () => {
      lifted = false;
      animate(lift, { scale: 1, y: 0 }, T.follow);
      animate(shadow, { scale: 1, opacity: 1 }, T.follow);
      layers.forEach((l) => animate(l, { y: 0 }, T.follow));
    };

    addEventListener(
      "scroll",
      () => {
        if (!visible) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const now = performance.now();
          const v = (scrollY - lastY) / Math.max(16, now - lastT); // px/ms
          lastY = scrollY;
          lastT = now;
          const n = Math.max(-1, Math.min(1, v / 1.5));
          if (!lifted) {
            lifted = true;
            animate(lift, { scale: 1.03, y: -3 }, T.follow);
            animate(shadow, { scale: 1.05, opacity: 0.7 }, T.follow);
          }
          layers.forEach((l) => animate(l, { y: n * +l.dataset.depth }, T.follow));
          clearTimeout(idle);
          idle = setTimeout(settle, 140);
        });
      },
      { passive: true },
    );
  }

  // Click / tap: girás la taza sobre el plato.
  let turn = 0;
  lift.addEventListener("click", () => {
    turn += 40;
    animate(lift, { rotate: turn }, T.tap);
  });

  // Scroll: giro mínimo al salir del hero.
  const offset = ["start start", "end start"];
  scroll(animate("#cupTurn", { rotate: [0, 12] }, { ease: "linear" }), { target: hero, offset });
  scroll(animate(".layer--plate", { rotate: [0, -5] }, { ease: "linear" }), { target: hero, offset });
}

/* Secciones: misma entrada que el hero, una sola vez al aparecer.
   (En Motion 11 el callback de inView recibe el IntersectionObserverEntry.) */
function sections() {
  const margin = "0px 0px -10% 0px";
  inView("[data-reveal]", ({ target }) => void enter(target), { margin });
  inView("[data-stagger]", ({ target }) => void enterGroup([...target.children]), { margin });
}
