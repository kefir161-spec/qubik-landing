import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
    FAQ_ITEMS,
    PRODUCTS,
    GALLERY_ITEMS,
    HOW_IT_WORKS,
    SOCIAL_PROOF,
    SUCCESS_STORY_VISUALS,
} from './landing-data.js';

THREE.ColorManagement.enabled = true;
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { mergeVertices, mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

gsap.registerPlugin(ScrollTrigger);
console.log('%c[app.js v107] LOADED', 'color:lime;font-weight:bold;font-size:14px');

/** Пути к моделям от каталога модуля — работает при деплое в подпапку (GitHub Pages и т.п.). */
const ASSETS_BASE = new URL('../assets/', import.meta.url).href;
function assetModelUrl(fileName) {
    return new URL(`models/${fileName}`, ASSETS_BASE).href;
}

/** Тот же CDN, что и importmap для three — надёжнее gstatic на части мобильных сетей / регионов. */
const DRACO_DECODER_URL = 'https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/libs/draco/gltf/';

/**
 * Общие настройки WebGL для телефонов, планшетов и десктопа — без привязки к ширине вьюпорта.
 * `logarithmicDepthBuffer` на части мобильных/встроенных GPU ломает создание контекста.
 * `powerPreference: high-performance` иногда выбирает нестабильный GPU на Android.
 */
function createCompatWebGLRenderer(options) {
    const { canvas, ...rest } = options;
    return new THREE.WebGLRenderer({
        antialias: rest.antialias ?? true,
        alpha: rest.alpha ?? false,
        logarithmicDepthBuffer: rest.logarithmicDepthBuffer ?? false,
        powerPreference: rest.powerPreference ?? 'default',
        ...rest,
        canvas,
    });
}

/** Должна совпадать с проверкой после загрузки assembly: глобальный ScrollTrigger.refresh() сдвигает все триггеры и может вызвать onToggle(false) у соседних секций без последующего onToggle(true). */
function isSectionInPlayViewport(sectionEl) {
    if (!sectionEl) return false;
    const r = sectionEl.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    return r.top < vh * 0.72 && r.bottom > vh * 0.12;
}

/**
 * Совпадает с ScrollTrigger на stage: start "top bottom" / end "bottom top" (любое пересечение с вьюпортом).
 * Узкая зона top 80% давала белый холст при прокрутке снизу вверх: карточка уже в кадре, а триггер ещё «не вошёл».
 */
function isStageScrollZoneApprox(stageEl) {
    if (!stageEl) return false;
    const r = stageEl.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const vw = window.innerWidth || 1;
    if (r.height <= 0 || r.width <= 0) return false;
    return r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;
}

/**
 * Этап 3D виден пользователю только если пересекает среднюю полосу экрана (не только «хвост» у края).
 * ScrollTrigger с top/bottom остаётся активным при частичном пересечении → анимация «в фоне».
 */
function isStageInViewportCenterBand(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    if (r.height <= 0 || r.width <= 0) return false;
    const margin = vh * 0.14;
    return r.bottom > margin && r.top < vh - margin;
}

/** Совпадает с триггером #assemblyStage (см. isStageScrollZoneApprox). */
function isAssemblyScrollRangeApprox(sectionEl) {
    return isStageScrollZoneApprox(document.getElementById('assemblyStage') || sectionEl);
}

// =============================================
// Navigation
// =============================================
const burger = document.getElementById('navBurger');
const navLinks = document.querySelector('.nav-links');
burger?.addEventListener('click', () => {
    burger.classList.toggle('open');
    navLinks.classList.toggle('open');
    const open = navLinks.classList.contains('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
});
navLinks?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
        burger.classList.remove('open');
        navLinks.classList.remove('open');
        burger?.setAttribute('aria-expanded', 'false');
    });
});

(function initHeadBrandFilm() {
    const section = document.getElementById('headVideo');
    const v = section?.querySelector('.head-video-media');
    if (!v || !section) return;
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    if ('playsInline' in v) v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');

    const tryPlay = () => v.play().catch(() => {});

    let inView = false;
    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                inView = entry.isIntersecting;
                if (inView) {
                    try { v.currentTime = 0; } catch (e) {}
                    if (v.readyState >= 2) tryPlay();
                    else {
                        v.addEventListener(
                            'canplay',
                            () => {
                                if (inView) tryPlay();
                            },
                            { once: true }
                        );
                    }
                } else {
                    v.pause();
                    try { v.currentTime = 0; } catch (e) {}
                }
            });
        },
        { root: null, rootMargin: '0px 0px -8% 0px', threshold: 0.22 }
    );
    io.observe(section);
})();

// =============================================
// Hero — crossfade + карточки категорий (автосмена всех фото каждые 5 с)
// =============================================
const heroTL = gsap.timeline({ defaults: { ease: 'power3.out' } });
if (document.querySelector('.hero-copy') && document.querySelector('.hero-showcase')) {
    heroTL
        .to('.hero-copy', { opacity: 1, y: 0, duration: 0.55 })
        .to('.hero-showcase', { opacity: 1, y: 0, duration: 0.52 }, '-=0.32');
}

function bannerAssetUrl(folder, file) {
    return ['assets', 'images', 'banner', folder, file].map(encodeURIComponent).join('/');
}

(function initHeroShowcase() {
    const showcase = document.getElementById('heroShowcase');
    if (!showcase) return;

    const layerA = showcase.querySelector('.hero-showcase-layer--a');
    const layerB = showcase.querySelector('.hero-showcase-layer--b');
    const floats = showcase.querySelectorAll('.hero-float');
    const parallax = showcase.querySelector('[data-hero-parallax] .hero-showcase-parallax');

    if (!layerA || !layerB) return;

    const categories = [
        {
            folder: 'Garden',
            label: 'Garden',
            files: ['2.jpeg', '3 (1).jpeg', 'hf-20260210-145115-85d5663e-480f-468c-b147-8c97ea81ff32.jpeg'],
        },
        {
            folder: 'Interior',
            label: 'Interior',
            files: ['Image_202601231409.jpeg'],
        },
        {
            folder: 'Pet house',
            label: 'Pet house',
            files: ['photo_2026-03-26_13-29-32.jpg'],
        },
        {
            folder: 'Public space',
            label: 'Public space',
            files: ['1 render  (1).png', 'Image_202601231443.jpeg'],
        },
    ];

    const slides = [];
    categories.forEach((cat, categoryIndex) => {
        cat.files.forEach((file) => {
            slides.push({
                src: bannerAssetUrl(cat.folder, file),
                label: cat.label,
                categoryIndex,
            });
        });
    });

    let activeIndex = 0;
    /** True if layer A currently has the visible image (opacity 1). */
    let visibleIsA = true;
    let autoplayTimer = null;

    function setFloatState(categoryIndex) {
        floats.forEach((btn) => {
            const ci = Number(btn.dataset.categoryIndex);
            const on = ci === categoryIndex;
            btn.classList.toggle('is-active', on);
            btn.setAttribute('aria-selected', on ? 'true' : 'false');
        });
    }

    function firstSlideIndexForCategory(categoryIndex) {
        const i = slides.findIndex((s) => s.categoryIndex === categoryIndex);
        return i >= 0 ? i : 0;
    }

    function restartAutoplay() {
        clearInterval(autoplayTimer);
        autoplayTimer = setInterval(() => {
            const next = (activeIndex + 1) % slides.length;
            applySlide(next);
        }, 5000);
    }

    function applySlide(index) {
        if (index === activeIndex || index < 0 || index >= slides.length) return;

        const outgoing = visibleIsA ? layerA : layerB;
        const incoming = visibleIsA ? layerB : layerA;
        const { src, label, categoryIndex } = slides[index];

        incoming.removeAttribute('aria-hidden');

        const finalize = () => {
            incoming.classList.add('is-visible');
            outgoing.classList.remove('is-visible');
            visibleIsA = incoming === layerA;
            activeIndex = index;
            setFloatState(categoryIndex);
            incoming.alt = label;
            outgoing.setAttribute('aria-hidden', 'true');
        };

        const run = () => {
            if (incoming.decode) {
                incoming.decode().then(finalize).catch(finalize);
            } else {
                finalize();
            }
        };

        function sameImageUrl(a, b) {
            if (!a || !b) return false;
            try {
                return new URL(a, window.location.href).pathname === new URL(b, window.location.href).pathname;
            } catch {
                return a === b;
            }
        }

        if (sameImageUrl(incoming.getAttribute('src') || incoming.src, src)) {
            requestAnimationFrame(run);
            return;
        }

        incoming.onload = () => {
            incoming.onload = null;
            incoming.onerror = null;
            run();
        };
        incoming.onerror = () => {
            incoming.onload = null;
            incoming.onerror = null;
            run();
        };
        incoming.src = src;
    }

    layerA.classList.add('is-visible');
    layerB.classList.remove('is-visible');
    layerA.alt = slides[0].label;
    setFloatState(0);
    restartAutoplay();

    const hoverMedia = window.matchMedia('(hover: hover) and (pointer: fine)');

    floats.forEach((btn) => {
        const catIdx = Number(btn.dataset.categoryIndex);
        if (Number.isNaN(catIdx)) return;

        btn.addEventListener('click', () => {
            const inCat = slides
                .map((s, i) => (s.categoryIndex === catIdx ? i : -1))
                .filter((i) => i >= 0);
            if (slides[activeIndex].categoryIndex === catIdx && inCat.length > 1) {
                const curPos = inCat.indexOf(activeIndex);
                const nextSlide = inCat[(curPos + 1) % inCat.length];
                applySlide(nextSlide);
            } else {
                applySlide(firstSlideIndexForCategory(catIdx));
            }
            restartAutoplay();
        });

        btn.addEventListener('mouseenter', () => {
            if (hoverMedia.matches) applySlide(firstSlideIndexForCategory(catIdx));
        });
    });

    if (parallax && hoverMedia.matches) {
        showcase.addEventListener('mousemove', (e) => {
            const r = showcase.getBoundingClientRect();
            const mx = (e.clientX - r.left) / r.width - 0.5;
            const my = (e.clientY - r.top) / r.height - 0.5;
            parallax.style.setProperty('--px', `${mx * 1.2}%`);
            parallax.style.setProperty('--py', `${my * 0.9}%`);
        });
        showcase.addEventListener('mouseleave', () => {
            parallax.style.setProperty('--px', '0%');
            parallax.style.setProperty('--py', '0%');
        });
    }
})();

// =============================================
// Modular hero — entrance (editorial column + 3D)
// =============================================
const modularHeroTL = gsap.timeline({ defaults: { ease: 'power3.out' } });
modularHeroTL
    .to('.modular-accordion', { opacity: 1, y: 0, duration: 0.52 })
    .to('.modular-canvas-wrap', { opacity: 1, y: 0, scale: 1, duration: 0.62, ease: 'power2.out' }, '-=0.3')
    .to('.modular-controls', { opacity: 1, y: 0, duration: 0.45 }, '-=0.52');
modularHeroTL.pause(0);
if (document.getElementById('material')) {
    ScrollTrigger.create({
        trigger: '#material',
        start: 'top 88%',
        once: true,
        onEnter: () => modularHeroTL.play(0),
    });
} else {
    modularHeroTL.play(0);
}

(function initModularAccordion() {
    const root = document.getElementById('modularAccordion');
    if (!root) return;

    const isNarrowUi = window.matchMedia('(max-width: 900px)').matches;

    /** На touch play() из IntersectionObserver не считается user gesture — только пауза при уходе с экрана. */
    const accVideoIoShouldPlay = !(
        window.matchMedia('(pointer: coarse)').matches || isNarrowUi
    );

    const items = root.querySelectorAll('[data-acc-item]');
    let refreshTimer = null;

    function scheduleScrollTriggerRefresh() {
        if (typeof ScrollTrigger === 'undefined') return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
            refreshTimer = null;
            requestAnimationFrame(() => ScrollTrigger.refresh());
        }, 420);
    }

    function setPanelA11y(item, open) {
        const panel = item.querySelector('.modular-acc-panel');
        const trig = item.querySelector('.modular-acc-trigger');
        if (panel) {
            panel.setAttribute('aria-hidden', open ? 'false' : 'true');
        }
        if (trig) {
            trig.setAttribute('aria-expanded', open ? 'true' : 'false');
        }
    }

    function pauseVideo(item) {
        const v = item.querySelector('video[data-acc-video]');
        if (v) {
            v.pause();
            v.currentTime = 0;
        }
    }

    /**
     * Muted + playsInline — допустимый автоплей; на iOS play() должен быть в том же turn, что и tap,
     * иначе браузер блокирует (requestAnimationFrame ломает user gesture).
     */
    function playVideo(item) {
        const v = item.querySelector('video[data-acc-video]');
        if (!v) return;
        v.muted = true;
        v.defaultMuted = true;
        v.setAttribute('muted', '');
        if ('playsInline' in v) v.playsInline = true;
        v.setAttribute('playsinline', '');
        v.setAttribute('webkit-playsinline', '');
        if (v.preload !== 'auto') {
            v.preload = 'auto';
        }

        const tryPlay = () => v.play().catch(() => {});

        if (v.readyState >= 2) {
            tryPlay();
            return;
        }
        tryPlay();
        const onReady = () => {
            v.removeEventListener('canplay', onReady);
            v.removeEventListener('loadeddata', onReady);
            v.removeEventListener('canplaythrough', onReady);
            tryPlay();
        };
        v.addEventListener('canplay', onReady, { once: true });
        v.addEventListener('loadeddata', onReady, { once: true });
        v.addEventListener('canplaythrough', onReady, { once: true });
        if (v.readyState < 2) {
            v.load();
        }
    }

    items.forEach((item) => {
        const trigger = item.querySelector('.modular-acc-trigger');
        if (!trigger) return;

        trigger.addEventListener('click', () => {
            const opening = !item.classList.contains('is-open');
            items.forEach((other) => {
                other.classList.remove('is-open');
                pauseVideo(other);
                setPanelA11y(other, false);
            });
            if (opening) {
                item.classList.add('is-open');
                setPanelA11y(item, true);
                playVideo(item);
            }
            scheduleScrollTriggerRefresh();
        });
    });

    const accVideoIo =
        'IntersectionObserver' in window
            ? new IntersectionObserver(
                  (entries) => {
                      entries.forEach((en) => {
                          const item = en.target;
                          if (!item.classList.contains('is-open')) return;
                          if (en.isIntersecting) {
                              if (accVideoIoShouldPlay) playVideo(item);
                          } else {
                              pauseVideo(item);
                          }
                      });
                  },
                  { root: null, threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
              )
            : null;
    items.forEach((item) => {
        if (item.querySelector('video[data-acc-video]')) accVideoIo?.observe(item);
    });

    const initialOpen = root.querySelector('.modular-acc-item.is-open');
    if (initialOpen) {
        setPanelA11y(initialOpen, true);
        if (accVideoIoShouldPlay) {
            playVideo(initialOpen);
        }
        scheduleScrollTriggerRefresh();
    }
})();

// =============================================
// Three.js — modular hero: cubik + табы Bion / Void / Zen / Zen/2
// =============================================
/** Modular hero: наклон cubik (видна верхняя грань). Секция assembly без наклона модели — только камера. */
const HERO_BASE_TILT_X = 0.3;

const canvas = document.getElementById('heroCanvas');
const canvasWrap = document.getElementById('heroCanvasWrap');
const loaderEl = document.getElementById('heroLoader');

let heroScene = null;
let heroCamera = null;
let heroRenderer = null;
let heroRotationY = 0;
let heroCompositionRoot = null;

function getActiveHeroColorSwatchHex() {
    const el = document.querySelector('#colorPicker .swatch.active');
    const hex = el?.dataset?.color;
    return typeof hex === 'string' && hex.length ? hex : '#F4F4F4';
}

function applyHeroPaletteColorToRoot(root, hexCss, { animate = false } = {}) {
    if (!root || !hexCss) return;
    const h = hexCss.startsWith('#') ? parseInt(hexCss.slice(1), 16) : parseInt(hexCss, 16);
    if (!Number.isFinite(h)) return;
    const target = new THREE.Color().setHex(h, THREE.SRGBColorSpace);
    root.traverse((child) => {
        if (!child.isMesh || !child.material?.color) return;
        if (animate) {
            gsap.to(child.material.color, {
                r: target.r,
                g: target.g,
                b: target.b,
                duration: 0.45,
                ease: 'power2.inOut',
                overwrite: 'auto',
            });
        } else {
            child.material.color.copy(target);
        }
    });
}

/** Согласовать материалы hero с активным свотчем (модели Zen стартуют с серым «фасетным» базовым цветом). */
function syncHeroSceneToActiveColorSwatch(options = {}) {
    applyHeroPaletteColorToRoot(heroCompositionRoot, getActiveHeroColorSwatchHex(), options);
}

const HERO_ROT_SPEED = -0.0075;
const objLoader = new OBJLoader();

/**
 * Каталог (sRGB): Void/Flora — светлый «белый»; Bion — тёплый беж.
 * Раньше hero красил все GLB в #f4f4f4, а сборка — бежевые грани Bion в #ede6dc → белый и беж «не сходились» между блоками и с линейками.
 */
const PALETTE_FLORA_VOID_WHITE = 0xf4f4f4;
/** Beige = тот же hex, что свотч в hero (`index.html` #E1B589) — верх Void в секции assembly */
const PALETTE_BEIGE_ASSEMBLY_VOID = 0xe1b589;
const PALETTE_ZEN_FACE_GREY = 0x8c8f8c;

function cleanMeshGeometry(mesh, fixGeometry) {
    if (!mesh.isMesh || !mesh.geometry?.isBufferGeometry) return;
    let g = mesh.geometry;
    if (fixGeometry) {
        g = mergeVertices(g, 0.001);
        g.computeVertexNormals();
        mesh.geometry = g;
    }
}

if (canvas && canvasWrap) {
try {
    heroRenderer = createCompatWebGLRenderer({ canvas });
} catch {
    heroRenderer = null;
}
const heroGlOk = Boolean(heroRenderer?.getContext?.());
if (!heroGlOk) {
    try {
        heroRenderer?.dispose?.();
    } catch {
        /* ignore */
    }
    heroRenderer = null;
    loaderEl?.classList.add('hidden');
    canvas.classList.add('visually-hidden');
    canvas.setAttribute('aria-hidden', 'true');
    canvasWrap.classList.add('has-static-fallback');
    if (!canvasWrap.querySelector('.hero-static-fallback')) {
        const fig = document.createElement('figure');
        fig.className = 'hero-static-fallback';
        fig.innerHTML =
            '<img src="assets/images/banner/Garden/2.jpeg" alt="Cubik modular system in a garden setting" width="1200" height="900" decoding="async" fetchpriority="high" />';
        canvasWrap.insertBefore(fig, canvasWrap.firstChild);
    }
} else {
heroScene = new THREE.Scene();
heroScene.background = new THREE.Color(0xffffff);

heroCamera = new THREE.PerspectiveCamera(32, 2.5, 0.1, 500);
heroCamera.position.set(0, 1.2, 34);

function getHeroPixelRatioCap() {
    return window.matchMedia('(max-width: 900px)').matches ? 1.25 : 2;
}
function applyHeroPixelRatio() {
    if (!heroRenderer) return;
    heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, getHeroPixelRatioCap()));
}
applyHeroPixelRatio();
heroRenderer.outputColorSpace = THREE.SRGBColorSpace;
heroRenderer.toneMapping = THREE.ACESFilmicToneMapping;
heroRenderer.toneMappingExposure = 1.2;

heroScene.add(new THREE.AmbientLight(0xffffff, 0.75));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(6, 10, 8);
heroScene.add(dirLight);
const fill = new THREE.DirectionalLight(0xffffff, 0.3);
fill.position.set(-5, 3, -4);
heroScene.add(fill);

const sharedMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color().setHex(PALETTE_FLORA_VOID_WHITE, THREE.SRGBColorSpace),
    roughness: 0.6,
    metalness: 0.05,
});

/** Базовый масштаб hero-модели: больше значение → крупнее cubik в кадре */
const MODEL_SCALE = 7.35;

const modelFiles = [
    { file: assetModelUrl('bion.glb'), fixGeometry: false, format: 'gltf', color: PALETTE_FLORA_VOID_WHITE },
    { file: assetModelUrl('void.glb'), fixGeometry: false, format: 'gltf', color: PALETTE_FLORA_VOID_WHITE },
    /** Полный Zen-cubik: zen_facet.glb в сцене с «раздутым» root-bbox нормализуется почти как void → выглядит вторым Void. */
    { file: assetModelUrl('zen.glb'), fixGeometry: false, format: 'gltf', color: PALETTE_ZEN_FACE_GREY },
    /** GLB точнее и детальнее OBJ */
    { file: assetModelUrl('zen-2.glb'), fixGeometry: true, format: 'gltf', color: PALETTE_ZEN_FACE_GREY },
];

const loadedModels = new Array(modelFiles.length).fill(null);
const dracoHero = new DRACOLoader();
dracoHero.setDecoderPath(DRACO_DECODER_URL);
const heroGltfLoader = new GLTFLoader();
heroGltfLoader.setDRACOLoader(dracoHero);

let heroLayoutInitialized = false;

function scheduleRemainingHeroModels() {
    const run = () => {
        modelFiles.forEach((_, i) => {
            if (i === HERO_DEFAULT_FACET_INDEX) return;
            loadHeroModelAt(i);
        });
    };
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(run, { timeout: 2500 });
    } else {
        setTimeout(run, 0);
    }
}

function onHeroModelLoaded(index) {
    if (!heroLayoutInitialized) {
        if (index !== HERO_DEFAULT_FACET_INDEX) return;
        layoutHeroSingleCubikMode();
        setupHeroFacetPicker();
        heroLayoutInitialized = true;
        loaderEl?.classList.add('hidden');
        scheduleRemainingHeroModels();
    } else if (heroTiltGroup && loadedModels[index]) {
        const g = loadedModels[index];
        heroTiltGroup.add(g);
        g.visible = index === heroFacetIndex;
        syncHeroSceneToActiveColorSwatch({ animate: false });
    }
    updateHeroFacetTabAvailability();
}

function loadHeroModelAt(index) {
    const { file, fixGeometry, format } = modelFiles[index];
    if (format === 'gltf') {
        heroGltfLoader.load(
            file,
            (gltf) => {
                loadedModels[index] = buildHeroModelGroup(gltf.scene, fixGeometry, modelFiles[index].color);
                onHeroModelLoaded(index);
            },
            undefined,
            () => loadHeroFallbackBox(index)
        );
    } else {
        objLoader.load(
            file,
            (obj) => {
                loadedModels[index] = buildHeroModelGroup(obj, fixGeometry, modelFiles[index].color);
                onHeroModelLoaded(index);
            },
            undefined,
            () => loadHeroFallbackBox(index)
        );
    }
}

/**
 * Группа вращается вокруг Y; меш внутри отцентрован в (0,0,0) и без «левого» quaternion из OBJ —
 * тогда все cubiks визуально крутятся в одну сторону с одинаковой скоростью.
 */
function buildHeroModelGroup(obj, fixGeometry = false, colorHex = PALETTE_FLORA_VOID_WHITE) {
    obj.rotation.set(0, 0, 0);
    obj.quaternion.set(0, 0, 0, 1);

    obj.traverse((child) => {
        if (child.isMesh) {
            cleanMeshGeometry(child, fixGeometry);
            const mat = sharedMaterial.clone();
            mat.color.setHex(colorHex, THREE.SRGBColorSpace);
            if (fixGeometry) {
                mat.polygonOffset = true;
                mat.polygonOffsetFactor = 1;
                mat.polygonOffsetUnits = 1;
            }
            child.material = mat;
        }
    });

    const box0 = new THREE.Box3().setFromObject(obj);
    const size0 = box0.getSize(new THREE.Vector3());
    const maxDim = Math.max(size0.x, size0.y, size0.z, 0.001);
    const scale = MODEL_SCALE / maxDim;
    obj.scale.setScalar(scale);

    const box1 = new THREE.Box3().setFromObject(obj);
    const center = box1.getCenter(new THREE.Vector3());
    obj.position.sub(center);

    const group = new THREE.Group();
    group.add(obj);
    group.rotation.order = 'YXZ';
    /** Локальные габариты без вращения турнтейбла — иначе world AABB «дышит» с углом Y и камера прыгает при каждом fit */
    const fitBox = new THREE.Box3().setFromObject(group);
    const fitSize = fitBox.getSize(new THREE.Vector3());
    group.userData.heroFitSpan = {
        x: Math.max(fitSize.x, 1e-6),
        y: Math.max(fitSize.y, 1e-6),
        z: Math.max(fitSize.z, 1e-6),
    };
    return group;
}

/** Внешняя группа: только Y (турнтейбл). Дети: tilt → меши (центр вращения — центр куба) */
let heroTiltGroup = null;

/** Стартовый cubik: 0 Bion, 1 Void, 2 Zen, 3 Zen/2 */
const HERO_DEFAULT_FACET_INDEX = 2;

const HERO_FACET_BENEFITS = [
    'Решётчатая грань — свет и воздух проходят сквозь конструкцию, удобно для растений и декоративных экранов.',
    'Открытый контур — полки, ниши и витринные проёмы без лишней массы.',
    'Сплошная рельефная поверхность — зонирование и приватность, спокойный минималистичный вид.',
    'Низкий профиль — компактные стопки и аккуратные горизонтальные линии.',
];

function groundHeroGroupOnY(g) {
    g.position.set(0, 0, 0);
    g.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(g);
    g.position.y -= box.min.y;
}

function layoutHeroSingleCubikMode() {
    const hasAny = loadedModels.some(Boolean);
    if (!hasAny) return;

    if (heroCompositionRoot) {
        heroScene.remove(heroCompositionRoot);
        while (heroCompositionRoot.children.length) {
            heroCompositionRoot.remove(heroCompositionRoot.children[0]);
        }
        heroCompositionRoot = null;
    }
    heroTiltGroup = null;

    heroCompositionRoot = new THREE.Group();
    heroCompositionRoot.rotation.order = 'YXZ';

    heroTiltGroup = new THREE.Group();
    heroTiltGroup.rotation.x = HERO_BASE_TILT_X;
    heroCompositionRoot.add(heroTiltGroup);

    loadedModels.forEach((g) => {
        if (g) heroTiltGroup.add(g);
    });

    heroScene.add(heroCompositionRoot);
    const startIdx = HERO_DEFAULT_FACET_INDEX;
    heroFacetIndex = startIdx;
    loadedModels.forEach((g, j) => {
        if (g) g.visible = j === startIdx;
    });
    syncHeroFacetChrome(startIdx);
    const active = loadedModels[startIdx];
    if (active) {
        runHeroAssemblyEntrance([active]);
    }
    syncHeroSceneToActiveColorSwatch({ animate: false });
}

/** Без анимации scale 0.22→1 — сразу полный масштаб, как после повторного клика по табу */
function runHeroAssemblyEntrance(groups) {
    groups.forEach((g) => {
        gsap.killTweensOf(g.scale);
        g.scale.setScalar(1);
    });
    const active = groups[0];
    if (active) fitHeroCamera([active], { tight: true, frameLoosen: currentHeroFrameLoosen() });
}

let heroFacetIndex = HERO_DEFAULT_FACET_INDEX;
/** GSAP-твин смены cubik; kill при быстром переключении табов */
let heroFacetSwitchTween = null;

function syncHeroFacetChrome(index) {
    const benefitEl = document.getElementById('heroFacetBenefit');
    if (benefitEl) benefitEl.textContent = HERO_FACET_BENEFITS[index] ?? '';
    document.querySelectorAll('#heroFacetPicker .facet-tab').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
        btn.setAttribute('aria-selected', i === index ? 'true' : 'false');
    });
}

function setHeroFacetFocus(index) {
    const switchedModel = index !== heroFacetIndex;
    heroFacetIndex = index;
    syncHeroFacetChrome(index);

    const next = loadedModels[index];
    loadedModels.forEach((g, j) => {
        if (g) g.visible = j === index;
    });

    if (!next) return;

    syncHeroSceneToActiveColorSwatch({ animate: false });

    next.position.set(0, 0, 0);
    if (heroFacetSwitchTween) {
        heroFacetSwitchTween.kill();
        heroFacetSwitchTween = null;
    }

    if (!switchedModel) {
        next.scale.setScalar(1);
        fitHeroCamera([next], { tight: true, frameLoosen: currentHeroFrameLoosen() });
        return;
    }

    /**
     * Видимый «пульс»: нормальный размер → чуть уменьшить → сразу вернуть к 1.
     * fit только до/после: во время scale камера не двигается — куб реально мельчает и отскакивает.
     */
    next.scale.setScalar(1);
    fitHeroCamera([next], { tight: true, frameLoosen: currentHeroFrameLoosen() });

    const pulse = { s: 1 };
    const dipS = 0.86;

    heroFacetSwitchTween = gsap.timeline({
        onComplete: () => {
            heroFacetSwitchTween = null;
            next.scale.setScalar(1);
            fitHeroCamera([next], { tight: true, frameLoosen: currentHeroFrameLoosen() });
        },
    });
    heroFacetSwitchTween.to(pulse, {
        s: dipS,
        duration: 0.14,
        ease: 'power2.in',
        onUpdate: () => {
            next.scale.setScalar(pulse.s);
        },
    });
    heroFacetSwitchTween.to(pulse, {
        s: 1,
        duration: 0.32,
        ease: 'power3.out',
        onUpdate: () => {
            next.scale.setScalar(pulse.s);
        },
    });
}

function updateHeroFacetTabAvailability() {
    document.querySelectorAll('#heroFacetPicker .facet-tab').forEach((btn, i) => {
        const loaded = !!loadedModels[i];
        btn.disabled = !loaded;
        btn.setAttribute('aria-disabled', loaded ? 'false' : 'true');
    });
}

function setupHeroFacetPicker() {
    const tabs = document.querySelectorAll('#heroFacetPicker .facet-tab');
    const picker = document.getElementById('heroFacetPicker');
    if (!tabs.length) return;
    function refitHeroForFacetHover() {
        const active = loadedModels[heroFacetIndex];
        if (!active) return;
        fitHeroCamera([active], { tight: true, frameLoosen: currentHeroFrameLoosen() });
    }
    tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
            const i = Number.parseInt(btn.dataset.facetIndex, 10);
            if (!Number.isFinite(i) || !loadedModels[i]) return;
            setHeroFacetFocus(i);
        });
    });
    picker?.addEventListener('mouseenter', () => {
        picker.dataset.heroLoosen = '1';
        refitHeroForFacetHover();
    });
    picker?.addEventListener('mouseleave', () => {
        delete picker.dataset.heroLoosen;
        refitHeroForFacetHover();
    });
    updateHeroFacetTabAvailability();
}

/**
 * Подгоняет камеру под bbox групп. `tight` — один cubik крупно в hero (меньше поля, ближе камера).
 * Для одной hero-модели используем заранее сохранённые локальные габариты: world AABB при вращении
 * родителя по Y меняется от кадра к кадру, из-за этого при каждом fit камера «прыгала».
 */
function fitHeroCamera(groups, opts = {}) {
    if (!groups.length || !heroCamera) return;

    const tight = opts.tight === true;
    const narrow =
        typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
    const loosen =
        typeof opts.frameLoosen === 'number' && opts.frameLoosen > 1 ? opts.frameLoosen : 1;
    /** Запас под вращение и наклон без обрезки в канвасе; на узких экранах — крупнее модель */
    let padding = tight ? (narrow ? 1.16 : 1.32) : 1.18;
    if (tight && loosen > 1) {
        padding *= loosen;
    }
    /** Доп. вертикальный запас: верх граней при tilt+Y-вращении не вылезает из canvas */
    const paddingV = tight ? padding * (narrow ? 1.06 : 1.12) : padding;
    let minDist = tight ? (narrow ? 5.1 : 7.8) : 24;
    if (tight && loosen > 1) {
        minDist *= Math.min(loosen, 1.2);
    }

    const g0 = groups[0];
    const u = g0.userData?.heroFitSpan;

    if (groups.length === 1 && u) {
        g0.updateMatrixWorld(true);
        const center = new THREE.Vector3();
        g0.getWorldPosition(center);
        const s = typeof g0.scale?.x === 'number' ? g0.scale.x : 1;
        /** Горизонталь после поворота вокруг Y: максимальный размах в XZ не больше hypot локальных dx,dz */
        const horiz = Math.hypot(u.x * s, u.z * s);
        const spanX = horiz;
        const spanY = u.y * s;
        const spanZ = horiz;

        const vHalf = THREE.MathUtils.degToRad(heroCamera.fov * 0.5);
        const tanHalfV = Math.tan(vHalf);
        const tanHalfH = tanHalfV * Math.max(heroCamera.aspect, 0.01);

        const distV = (spanY * paddingV) / (2 * tanHalfV);
        const distH = (spanX * padding) / (2 * tanHalfH);
        const distZ = (spanZ * padding) / (2 * tanHalfV);
        const dist = Math.max(distV, distH, distZ, minDist);

        const yLift = tight ? spanY * 0.072 : spanY * 0.07;
        /** Сдвиг точки взгляда по Y (tight): меньше |коэфф.| → куб ниже в кадре */
        const lookYOffset = tight ? -spanY * 0.14 : 0;
        heroCamera.position.set(center.x, center.y + yLift, center.z + dist);
        heroCamera.lookAt(center.x, center.y + lookYOffset, center.z);
        heroCamera.updateProjectionMatrix();
        return;
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    groups.forEach((g) => {
        g.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(g);
        const sx = box.max.x - box.min.x;
        const sz = box.max.z - box.min.z;
        const cx = (box.max.x + box.min.x) * 0.5;
        const cz = (box.max.z + box.min.z) * 0.5;
        const rxz = Math.hypot(sx * 0.5, sz * 0.5);
        minX = Math.min(minX, cx - rxz);
        maxX = Math.max(maxX, cx + rxz);
        minY = Math.min(minY, box.min.y);
        maxY = Math.max(maxY, box.max.y);
        minZ = Math.min(minZ, cz - rxz);
        maxZ = Math.max(maxZ, cz + rxz);
    });

    const center = new THREE.Vector3(
        (minX + maxX) * 0.5,
        (minY + maxY) * 0.5,
        (minZ + maxZ) * 0.5
    );
    const spanX = maxX - minX;
    const spanY = maxY - minY;
    const spanZ = maxZ - minZ;

    const vHalf = THREE.MathUtils.degToRad(heroCamera.fov * 0.5);
    const tanHalfV = Math.tan(vHalf);
    const tanHalfH = tanHalfV * Math.max(heroCamera.aspect, 0.01);

    const padV = tight ? padding * 1.12 : padding;
    const distV = (spanY * padV) / (2 * tanHalfV);
    const distH = (spanX * padding) / (2 * tanHalfH);
    const distZ = (spanZ * padding) / (2 * tanHalfV);
    const dist = Math.max(distV, distH, distZ, minDist);

    const yLift = tight ? spanY * 0.072 : spanY * 0.07;
    const lookYOffset = tight ? -spanY * 0.14 : 0;
    heroCamera.position.set(center.x, center.y + yLift, center.z + dist);
    heroCamera.lookAt(center.x, center.y + lookYOffset, center.z);
    heroCamera.updateProjectionMatrix();
}

function currentHeroFrameLoosen() {
    return document.getElementById('heroFacetPicker')?.dataset.heroLoosen === '1' ? 1.24 : 1;
}

function loadHeroFallbackBox(index) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), sharedMaterial.clone());
    loadedModels[index] = buildHeroModelGroup(mesh, false, modelFiles[index].color);
    onHeroModelLoaded(index);
}

loadHeroModelAt(HERO_DEFAULT_FACET_INDEX);
window.setTimeout(() => {
    if (heroLayoutInitialized) return;
    loaderEl?.classList.add('hidden');
    if (!canvasWrap?.classList.contains('has-static-fallback')) {
        canvasWrap?.classList.add('has-static-fallback');
        canvas?.classList.add('visually-hidden');
        canvas?.setAttribute('aria-hidden', 'true');
        if (!canvasWrap.querySelector('.hero-static-fallback')) {
            const fig = document.createElement('figure');
            fig.className = 'hero-static-fallback';
            fig.innerHTML =
                '<img src="assets/images/banner/Garden/2.jpeg" alt="Cubik modular system in a garden setting" width="1200" height="900" decoding="async" />';
            canvasWrap.insertBefore(fig, canvasWrap.firstChild);
        }
    }
}, 14000);

function resizeHeroRenderer() {
    const w = canvasWrap.clientWidth;
    const h = canvasWrap.clientHeight;
    if (w === 0 || h === 0) return;
    applyHeroPixelRatio();
    heroRenderer.setSize(w, h);
    heroCamera.aspect = w / h;
    heroCamera.updateProjectionMatrix();
    if (heroCompositionRoot) {
        const active = loadedModels[heroFacetIndex];
        if (active) fitHeroCamera([active], { tight: true, frameLoosen: currentHeroFrameLoosen() });
    }
}
resizeHeroRenderer();
window.addEventListener('resize', resizeHeroRenderer);

}
}

let heroSectionInView = true;
const materialSectionEl = document.getElementById('material');
if (materialSectionEl && 'IntersectionObserver' in window) {
    new IntersectionObserver(
        (entries) => {
            heroSectionInView = entries[0]?.isIntersecting ?? true;
        },
        { rootMargin: '80px 0px', threshold: 0.02 }
    ).observe(materialSectionEl);
}

let asmRenderer;
let asmScene;
let asmCamera;
let asmModelRoot;
/** Плоскость ShadowMaterial под кубом — лёгкая тень «от пола» */
let asmShadowCatcher = null;
let asmAssemblyComplete = false;
/** Сбрасывает отложенный play со скролла (задаётся в initAssemblyViewer) */
let cancelAssemblyScrollPlayRaf = () => {};
/** Колбэки из init: остановка/запуск по «центральной полосе» вьюпорта (см. animate) */
let asmStageVisibilityReset = () => {};
let asmStageVisibilityPlay = () => {};
let consStageVisibilityPause = () => {};
let consStageVisibilityPlay = () => {};
let asmPrevCenterBand = false;
let consPrevCenterBand = false;
/** План пошаговой стыковки граней (пары + последовательность) — после загрузки bion.glb */
let assemblyMacroPlan = null;

/**
 * Плавная адаптация сборки под любой мобильный экран: 0 = крупный планшет/десктоп, 1 = узкий телефон.
 * Ориентация не важна — берём min(width,height). Диапазон 380…900 px покрывает от SE до Pro Max и планшеты.
 */
function getAssemblyViewportAdaptT() {
    if (typeof window === 'undefined') return 0;
    const s = Math.min(window.innerWidth, window.innerHeight);
    return THREE.MathUtils.clamp((900 - s) / (900 - 380), 0, 1);
}

/** Минимальный множитель разлёта граней при t=1 (камера ближе — иначе вылезают за холст) */
const ASM_EXPLODE_SCALE_MIN = 0.62;

/** Короче разлёт относительно старого кадра — стык крупным планом без сильного «вылета» деталей. */
const ASM_ASSEMBLY_EXPLODE_LEN_SCALE = 0.78;

/**
 * Как у modular hero (PerspectiveCamera 32°): тот же масштаб перспективы на секции сборки.
 * На узких экранах чуть шире — по аналогии с hero pixel ratio breakpoint.
 */
const ASM_CAMERA_FOV_DEFAULT = 32;
const ASM_CAMERA_FOV_COMPACT = 36;

/**
 * Азимут вокруг Y от базового вида «с +Z»: отрицательный угол — камера слева-спереди (три четверти).
 */
const ASM_CAMERA_ORBIT_Y_DEG = -40;

/** Множитель расстояния камеры меньше 1 — ближе к кубу (~15 % при 0.85). */
const ASM_CAMERA_DISTANCE_ZOOM = 0.85;

/** Над горизонтальной плоскостью через центр куба: выше → лучше видна верхняя грань. */
const ASM_CAMERA_ELEVATION_DEG = 30;

/**
 * Точка lookAt по Y относительно центра куба: −spanY×frac (доля от «высоты» спана).
 * Меньше frac → взгляд ближе к горизонтали через центр → куб ниже в кадре. Больше frac → сильнее «вниз» по кубу.
 */
const ASM_CAMERA_LOOK_Y_FRAC = 0.08;

function applyAssemblyCameraViewportFov() {
    if (!asmCamera) return;
    const t = getAssemblyViewportAdaptT();
    asmCamera.fov = THREE.MathUtils.lerp(ASM_CAMERA_FOV_DEFAULT, ASM_CAMERA_FOV_COMPACT, t);
    asmCamera.updateProjectionMatrix();
}

/**
 * Ракурс «сверху в три четверти»: азимут + угол возвышения (ASM_CAMERA_ELEVATION_DEG), взгляд чуть ниже центра.
 * Геометрия куба без наклона — только камера.
 * @param {{ closer?: boolean }} opts — closer: крупнее план на время стыковки; иначе чуть дальше для вращения.
 */
function computeAssemblyCameraFitHeroStyle(opts = {}) {
    const closer = opts.closer === true;
    if (!asmCamera || !asmModelRoot || asmModelRoot.children.length === 0) return null;
    const r0 = asmModelRoot.userData.assembledBoundingRadius;
    if (r0 == null || !isFinite(r0) || r0 <= 0) return null;

    const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
    const basePad = narrow ? 1.16 : 1.32;
    const closeness = closer ? 0.93 : 1.06;
    const padding = basePad * closeness;
    const paddingV = padding * (narrow ? 1.06 : 1.12);

    const spanX = 2 * r0;
    const spanY = 2 * r0;
    const spanZ = 2 * r0;

    applyAssemblyCameraViewportFov();

    const vHalf = THREE.MathUtils.degToRad(asmCamera.fov * 0.5);
    const tanHalfV = Math.tan(vHalf);
    const tanHalfH = tanHalfV * Math.max(asmCamera.aspect, 0.01);

    const distV = (spanY * paddingV) / (2 * tanHalfV);
    const distH = (spanX * padding) / (2 * tanHalfH);
    const distZ = (spanZ * padding) / (2 * tanHalfV);
    const minDist = narrow ? r0 * 2.15 : r0 * 3.1;
    const distBase = Math.max(distV, distH, distZ, minDist);
    /** Запас по лучу при подъёме камеры × приближение ASM_CAMERA_DISTANCE_ZOOM */
    const dist = distBase * 1.1 * ASM_CAMERA_DISTANCE_ZOOM;

    const lookYOffset = -spanY * ASM_CAMERA_LOOK_Y_FRAC;

    const orbit = THREE.MathUtils.degToRad(ASM_CAMERA_ORBIT_Y_DEG);
    const elev = THREE.MathUtils.degToRad(ASM_CAMERA_ELEVATION_DEG);
    const cosEl = Math.cos(elev);
    const sinEl = Math.sin(elev);
    const sinO = Math.sin(orbit);
    const cosO = Math.cos(orbit);
    const ch = dist * cosEl;
    const pos = new THREE.Vector3(-ch * sinO, dist * sinEl, ch * cosO);

    return {
        dist,
        pos,
        look: new THREE.Vector3(0, lookYOffset, 0),
        near: Math.max(0.02, dist * 0.015),
        far: Math.max(200, dist * 4),
    };
}

function getAssemblyCameraFitVectors() {
    return computeAssemblyCameraFitHeroStyle({ closer: false });
}

/** Крупный план стыковки — тот же ракурс что modular hero, чуть ближе камера */
function getAssemblyCloseUpCameraFit() {
    return computeAssemblyCameraFitHeroStyle({ closer: true });
}

function applyAssemblyCloseUpCamera() {
    const fit = getAssemblyCloseUpCameraFit();
    if (!fit || !asmCamera) return;
    asmCamera.position.copy(fit.pos);
    asmCamera.lookAt(fit.look);
    asmCamera.near = fit.near;
    asmCamera.far = fit.far;
    asmCamera.updateProjectionMatrix();
}

/** Пересчёт разлёта при смене размера окна / ориентации (explodedPos + при необходимости позиции) */
function refreshAssemblyExplodedPositions(meshes) {
    if (!meshes?.length) return;
    const t = getAssemblyViewportAdaptT();
    const k = THREE.MathUtils.lerp(1, ASM_EXPLODE_SCALE_MIN, t);
    meshes.forEach((mesh) => {
        const dir = mesh.userData.asmExplodeDir;
        const len = mesh.userData.asmExplodeLen;
        const ap = mesh.userData.assembledPos;
        if (!dir || len == null || !ap) return;
        const prev = mesh.position.clone();
        mesh.position.copy(ap);
        mesh.updateMatrixWorld(true);
        const assembledWorld = new THREE.Vector3();
        mesh.getWorldPosition(assembledWorld);
        const explodedWorld = assembledWorld.clone().addScaledVector(dir, len * k);
        mesh.parent.updateMatrixWorld(true);
        const invParent = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert();
        mesh.userData.explodedPos = explodedWorld.clone().applyMatrix4(invParent);
        mesh.position.copy(prev);
    });
}

function updateAssemblyCameraFit() {
    const fit = getAssemblyCameraFitVectors();
    if (!fit) return;
    asmCamera.position.copy(fit.pos);
    asmCamera.lookAt(fit.look);
    asmCamera.near = fit.near;
    asmCamera.far = fit.far;
    asmCamera.updateProjectionMatrix();
}

function updateAssemblyShadowCatcher() {
    if (!asmShadowCatcher || !asmModelRoot || asmModelRoot.children.length === 0) return;
    if (!asmAssemblyComplete) {
        asmShadowCatcher.visible = false;
        return;
    }
    asmModelRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(asmModelRoot);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const span = Math.max(size.x, size.z, 0.2);
    /** Только собранный куб; радиус ×2 от прежнего коэффициента */
    const worldR = span * 0.96;
    asmShadowCatcher.visible = true;
    asmShadowCatcher.scale.set(worldR, worldR, 1);
    asmShadowCatcher.position.set(center.x, box.min.y - 0.004, center.z);
    asmShadowCatcher.updateMatrixWorld(true);
}

/** Секция «Клипса»: стенка 3×3 + клипсы */
let consRenderer;
let consScene;
let consCamera;
let consWallRoot;
let consWallComplete = false;
let consBuildTL = null;
let consAnimPayload = null;
let consBackClipTL = null;
let consLeftClipTL = null;
let consRightClipTL = null;
/** Перезапуск цикла «сборка + клипсы + вращение» после полного оборота (задаётся в initConstructionWall) */
let consLoopRestartFn = null;
/** Секция #construction в зоне ScrollTrigger — иначе idle-вращение и клипсы не крутят в фоне */
let consConstructionVisible = false;

const CONS_LOOP_TURN_RAD = Math.PI * 2;

/** POV «за клипсой»: камера сзади и выше, чуть сбоку — виден силуэт, впереди паз */
function updateConsCameraRideClip(clip) {
    if (!clip || !consCamera || !consWallRoot) return;
    consWallRoot.updateMatrixWorld(true);
    clip.updateMatrixWorld(true);
    const wpos = new THREE.Vector3();
    clip.getWorldPosition(wpos);
    const parentZ = new THREE.Vector3(0, 0, 1).applyQuaternion(consWallRoot.quaternion).normalize();
    const parentY = new THREE.Vector3(0, 1, 0).applyQuaternion(consWallRoot.quaternion).normalize();
    const parentX = new THREE.Vector3(1, 0, 0).applyQuaternion(consWallRoot.quaternion).normalize();
    consCamera.position
        .copy(wpos)
        .addScaledVector(parentZ, 0.54)
        .addScaledVector(parentY, 0.15)
        .addScaledVector(parentX, 0.075);
    const lookAtPt = wpos
        .clone()
        .addScaledVector(parentZ, -0.52)
        .addScaledVector(parentY, -0.04);
    consCamera.lookAt(lookAtPt);
}

const _consLeftFacetN = new THREE.Vector3();
const _consRightFacetN = new THREE.Vector3();
const _consToCamera = new THREE.Vector3();

/** Задние клипсы — по накопленному повороту от конца сборки (135°) */
const CONS_BACK_CLIP_AT_RAD = THREE.MathUtils.degToRad(135);
/** Боковые клипсы — когда внешняя нормаль фасета смотрит на камеру (dot с направлением на камеру) */
const CONS_SIDE_FACET_DOT = 0.52;

/** Construction: по 135° чередуем скорость — быстро к вставке задних клипс, потом обычно, снова быстро… */
const CONS_WALL_SEGMENT_RAD = THREE.MathUtils.degToRad(135);
/** Тернтейбл (вращение стенки после сборки): базовая скорость; ×2.6 для «быстрых» сегментов */
const CONS_WALL_ROT_NORMAL = 0.0056;
const CONS_WALL_ROT_FAST = CONS_WALL_ROT_NORMAL * 2.6;

/** Масштаб кадра: приращения rotation.* ниже подобраны под ~60 fps; без этого на слабом FPS вращение «ползёт». */
const ANIM_DT_REF_FPS = 60;
let animPrevFrameMs = performance.now();

(function animate() {
    requestAnimationFrame(animate);
    const animNow = performance.now();
    let animDtSec = (animNow - animPrevFrameMs) / 1000;
    animPrevFrameMs = animNow;
    if (!Number.isFinite(animDtSec) || animDtSec <= 0) animDtSec = 1 / ANIM_DT_REF_FPS;
    if (animDtSec > 0.05) animDtSec = 0.05;
    const animFrameScale = animDtSec * ANIM_DT_REF_FPS;

    if (heroRenderer && heroScene && heroCamera) {
        heroRotationY += HERO_ROT_SPEED * animFrameScale;
        if (heroCompositionRoot) {
            heroCompositionRoot.rotation.y = heroRotationY;
            heroCompositionRoot.rotation.x = 0;
            heroCompositionRoot.rotation.z = 0;
        }
        if (heroSectionInView) {
            heroRenderer.render(heroScene, heroCamera);
        }
    }

    const asmStageEl = document.getElementById('assemblyStage');
    const asmInBand = asmStageEl && isStageInViewportCenterBand(asmStageEl);
    if (asmPrevCenterBand && !asmInBand) {
        asmStageVisibilityReset();
    } else if (!asmPrevCenterBand && asmInBand) {
        asmStageVisibilityPlay();
    }
    asmPrevCenterBand = asmInBand;

    const consStageEl = document.getElementById('constructionStage');
    const consInBand = consStageEl && isStageInViewportCenterBand(consStageEl);
    if (consPrevCenterBand && !consInBand) {
        consStageVisibilityPause();
    } else if (!consPrevCenterBand && consInBand) {
        consStageVisibilityPlay();
    }
    consPrevCenterBand = consInBand;

    if (asmRenderer && asmScene && asmCamera) {
        if (asmInBand && asmShadowCatcher && asmModelRoot?.children?.length) {
            updateAssemblyShadowCatcher();
        }
        if (asmAssemblyComplete && asmModelRoot && asmInBand) {
            asmModelRoot.rotation.y -= 0.0065 * animFrameScale;
            const rAsm = asmModelRoot.userData?.assembledBoundingRadius;
            const lookYAsm =
                rAsm != null && isFinite(rAsm) && rAsm > 0
                    ? -2 * rAsm * ASM_CAMERA_LOOK_Y_FRAC
                    : 0;
            asmCamera.lookAt(0, lookYAsm, 0);
        }
        asmRenderer.render(asmScene, asmCamera);
    }
    if (consRenderer && consScene && consCamera) {
        const consUd = consWallRoot?.userData;
        if (consInBand && consConstructionVisible && consUd?.consClipMacroActive && consUd?.macroClip) {
            updateConsCameraRideClip(consUd.macroClip);
        }
        if (consInBand && consConstructionVisible && consWallComplete && consWallRoot) {
            const ud = consWallRoot.userData;
            const deltaBefore =
                ud.consIdleStartY != null ? consWallRoot.rotation.y - ud.consIdleStartY : 0;
            /** Пока летят клипсы (GSAP), крутим как в «медленном» 135°-сегменте — иначе боковые ловят fast-фазу без этого «микроторможения». */
            const consClipFlyInActive =
                consBackClipTL != null || consLeftClipTL != null || consRightClipTL != null;
            let rotSpeed;
            if (consClipFlyInActive) {
                rotSpeed = CONS_WALL_ROT_NORMAL;
            } else if (ud.consRotFastAfterBack) {
                rotSpeed = CONS_WALL_ROT_FAST;
            } else {
                const segIndex = Math.max(0, Math.floor(deltaBefore / CONS_WALL_SEGMENT_RAD));
                rotSpeed = segIndex % 2 === 0 ? CONS_WALL_ROT_FAST : CONS_WALL_ROT_NORMAL;
            }
            consWallRoot.rotation.y += rotSpeed * animFrameScale;
            const deltaAfter =
                ud.consIdleStartY != null ? consWallRoot.rotation.y - ud.consIdleStartY : 0;
            if (ud.consIdleStartY != null) {
                _consLeftFacetN.set(-1, 0, 0).applyQuaternion(consWallRoot.quaternion);
                _consRightFacetN.set(1, 0, 0).applyQuaternion(consWallRoot.quaternion);
                _consToCamera.copy(consCamera.position).normalize();
                const dotL = _consLeftFacetN.dot(_consToCamera);
                const dotR = _consRightFacetN.dot(_consToCamera);
                if (
                    ud.leftClipMeshes?.length &&
                    !ud.consLeftClipPlayed &&
                    dotL > CONS_SIDE_FACET_DOT &&
                    dotL > dotR
                ) {
                    ud.consLeftClipPlayed = true;
                    ud.playLeftClipFlyIn?.();
                }
                if (
                    ud.rightClipMeshes?.length &&
                    !ud.consRightClipPlayed &&
                    dotR > CONS_SIDE_FACET_DOT &&
                    dotR > dotL
                ) {
                    ud.consRightClipPlayed = true;
                    ud.playRightClipFlyIn?.();
                }
                if (
                    ud.backClipMeshes?.length &&
                    !ud.consBackClipPlayed &&
                    deltaAfter >= CONS_BACK_CLIP_AT_RAD
                ) {
                    ud.consBackClipPlayed = true;
                    ud.playBackClipFlyIn?.();
                }
                if (
                    consLoopRestartFn &&
                    consWallRoot.rotation.y - ud.consIdleStartY >= CONS_LOOP_TURN_RAD
                ) {
                    consWallRoot.rotation.y -= CONS_LOOP_TURN_RAD;
                    consLoopRestartFn();
                }
            }
        }
        consRenderer.render(consScene, consCamera);
    }
})();

// =============================================
// Color Picker (modular 3D hero)
// =============================================
const colorNames = {
    '#7D7F7D': 'Серый',
    '#E1B589': 'Бежевый',
    '#0A6F3C': 'Зелёный',
    '#F4F4F4': 'Белый',
    '#0A0A0A': 'Чёрный',
};

document.querySelectorAll('#colorPicker .swatch').forEach((sw) => {
    sw.addEventListener('click', () => {
        document.querySelectorAll('#colorPicker .swatch').forEach((s) => s.classList.remove('active'));
        sw.classList.add('active');

        const hex = sw.dataset.color;
        const h = hex?.startsWith('#') ? parseInt(hex.slice(1), 16) : parseInt(hex || '0', 16);
        if (!Number.isFinite(h)) return;
        const label = document.getElementById('colorLabel');
        if (label) label.textContent = sw.dataset.name || colorNames[hex] || '';

        applyHeroPaletteColorToRoot(heroCompositionRoot, hex, { animate: true });
    });
});

// =============================================
// FAQ + products DOM (before scroll fade-in hooks)
// =============================================
(function mountFaqAccordion() {
    const root = document.getElementById('faqAccordion');
    if (!root) return;

    root.innerHTML = '';
    FAQ_ITEMS.forEach((item, i) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'faq-item';
        itemEl.dataset.faqItem = '';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'faq-trigger';
        btn.id = `faq-trigger-${i}`;
        btn.setAttribute('aria-expanded', 'false');
        btn.setAttribute('aria-controls', `faq-panel-${i}`);
        const btnLabel = document.createElement('span');
        btnLabel.className = 'faq-trigger-text';
        btnLabel.textContent = item.q;
        const btnIcon = document.createElement('span');
        btnIcon.className = 'faq-trigger-icon';
        btnIcon.setAttribute('aria-hidden', 'true');
        btn.appendChild(btnLabel);
        btn.appendChild(btnIcon);

        const panel = document.createElement('div');
        panel.className = 'faq-panel';
        panel.id = `faq-panel-${i}`;
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', `faq-trigger-${i}`);
        panel.setAttribute('aria-hidden', 'true');
        const inner = document.createElement('div');
        inner.className = 'faq-panel-inner';
        inner.textContent = item.a;
        panel.appendChild(inner);

        itemEl.appendChild(btn);
        itemEl.appendChild(panel);
        root.appendChild(itemEl);

        btn.addEventListener('click', () => {
            const open = !itemEl.classList.contains('is-open');
            root.querySelectorAll('.faq-item.is-open').forEach((o) => {
                o.classList.remove('is-open');
                const t = o.querySelector('.faq-trigger');
                const p = o.querySelector('.faq-panel');
                t?.setAttribute('aria-expanded', 'false');
                p?.setAttribute('aria-hidden', 'true');
            });
            if (open) {
                itemEl.classList.add('is-open');
                btn.setAttribute('aria-expanded', 'true');
                panel.setAttribute('aria-hidden', 'false');
            }
        });
    });
})();

/** Иконки в карточках отзывов (inline SVG, viewBox 0 0 24 24). */
const SOCIAL_CARD_ICON_PATHS = {
    bolt: 'M7 2v11h3v9l7-12h-4l4-8H7z',
    heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5c0 1.38.56 2.63 1.46 3.54L12 7.35l1.96-1.89C14.87 3.56 16.12 3 17.5 3 20.58 3 23 5.42 23 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    spark: 'M12 2l2.2 6.8H21l-5.5 4 2.1 6.5L12 15.9 6.4 19.3l2.1-6.5L3 8.8h6.8L12 2z',
    grid: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z',
};

function appendSocialCardIcon(wrap, iconKey) {
    const d = SOCIAL_CARD_ICON_PATHS[iconKey] || SOCIAL_CARD_ICON_PATHS.bolt;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '14');
    svg.setAttribute('height', '14');
    svg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    wrap.appendChild(svg);
}

function fillGalleryMosaic(mosaicRoot) {
    if (!mosaicRoot || !GALLERY_ITEMS.length) return;
    mosaicRoot.replaceChildren();
    GALLERY_ITEMS.forEach((g, i) => {
        const cell = document.createElement('div');
        cell.className = `gm-cell gm-cell--${i + 1}`;
        const img = document.createElement('img');
        img.src = g.src;
        img.alt = g.alt;
        img.loading = i < 2 ? 'eager' : 'lazy';
        img.decoding = 'async';
        cell.appendChild(img);
        mosaicRoot.appendChild(cell);
    });
}

(function mountGalleryHowSocial() {
    fillGalleryMosaic(document.getElementById('galleryMosaic'));

    const howRoot = document.getElementById('howGrid');
    if (howRoot) {
        howRoot.innerHTML = '';
        HOW_IT_WORKS.forEach((h) => {
            const div = document.createElement('div');
            div.className = 'how-card';
            div.dataset.anim = '';
            const step = document.createElement('span');
            step.className = 'how-step';
            step.textContent = h.step;
            const title = document.createElement('h3');
            title.className = 'how-title';
            title.textContent = h.title;
            const body = document.createElement('p');
            body.className = 'how-body';
            body.textContent = h.body;
            div.appendChild(step);
            div.appendChild(title);
            div.appendChild(body);
            howRoot.appendChild(div);
        });
    }

    const fTrack = document.getElementById('socialFslidesTrack');
    const fDots = document.getElementById('socialFslidesDots');
    const fPrev = document.getElementById('socialFPrev');
    const fNext = document.getElementById('socialFNext');
    const fViewport = fTrack?.parentElement;

    function storyVisualImages(index) {
        const pack = SUCCESS_STORY_VISUALS[index];
        if (pack) {
            return { image: pack.image, alt: pack.alt };
        }
        const n = GALLERY_ITEMS.length || 1;
        const a = GALLERY_ITEMS[index % n];
        return { image: a.src, alt: a.alt };
    }

    function buildStorySlide(slide, index) {
        const slideEl = document.createElement('div');
        slideEl.className = 'social-fslide';
        slideEl.setAttribute('role', 'group');
        slideEl.setAttribute('aria-roledescription', 'slide');

        const vis = document.createElement('div');
        vis.className = 'social-fslide-visual';
        const { image, alt } = storyVisualImages(index);
        const imgMain = document.createElement('img');
        imgMain.className = 'social-fslide-visual__main';
        imgMain.src = image;
        imgMain.alt = alt;
        imgMain.loading = index === 0 ? 'eager' : 'lazy';
        imgMain.decoding = 'async';
        vis.appendChild(imgMain);

        const copy = document.createElement('div');
        copy.className = 'social-fslide-copy';
        const q = document.createElement('blockquote');
        q.className = 'social-fslide-quote';
        q.textContent = slide.quote;
        const meta = document.createElement('p');
        meta.className = 'social-fslide-meta';
        const nameEl = document.createElement('span');
        nameEl.className = 'social-fslide-name';
        nameEl.textContent = slide.name;
        const roleEl = document.createElement('span');
        roleEl.className = 'social-fslide-role';
        roleEl.textContent = `${slide.role}, ${slide.org}`;
        meta.appendChild(nameEl);
        meta.appendChild(roleEl);
        copy.appendChild(q);
        copy.appendChild(meta);

        slideEl.appendChild(vis);
        slideEl.appendChild(copy);
        return slideEl;
    }

    const storySlides = [
        { quote: SOCIAL_PROOF.featured.quote, name: SOCIAL_PROOF.featured.name, role: SOCIAL_PROOF.featured.role, org: SOCIAL_PROOF.featured.org },
        ...SOCIAL_PROOF.cards.map((c) => ({
            quote: c.quote,
            name: c.name,
            role: c.role,
            org: c.org,
        })),
    ];

    if (fTrack && storySlides.length) {
        fTrack.replaceChildren();
        storySlides.forEach((s, i) => {
            fTrack.appendChild(buildStorySlide(s, i));
        });
    }

    const cardsRoot = document.getElementById('socialCards');
    const cardsVp = document.getElementById('socialCardsViewport');
    if (cardsRoot) {
        cardsRoot.innerHTML = '';
        SOCIAL_PROOF.cards.forEach((c) => {
            const el = document.createElement('article');
            el.className = 'social-card';
            const head = document.createElement('div');
            head.className = 'social-card__head';
            const iconWrap = document.createElement('span');
            iconWrap.className = 'social-card__icon';
            appendSocialCardIcon(iconWrap, c.icon || 'bolt');
            const brand = document.createElement('span');
            brand.className = 'social-card__brand';
            brand.textContent = c.brand || c.org;
            head.appendChild(iconWrap);
            head.appendChild(brand);

            const q = document.createElement('p');
            q.className = 'social-card__quote';
            q.textContent = c.quote;

            const foot = document.createElement('div');
            foot.className = 'social-card__foot';
            const av = document.createElement('div');
            av.className = 'social-card__avatar';
            av.setAttribute('aria-hidden', 'true');
            av.textContent = c.initials;
            const who = document.createElement('div');
            who.className = 'social-card__who';
            const n = document.createElement('span');
            n.className = 'social-name';
            n.textContent = c.name;
            const r = document.createElement('span');
            r.className = 'social-role';
            r.textContent = `${c.role} — ${c.org}`;
            who.appendChild(n);
            who.appendChild(r);
            foot.appendChild(av);
            foot.appendChild(who);

            el.appendChild(head);
            el.appendChild(q);
            el.appendChild(foot);
            cardsRoot.appendChild(el);
        });
    }

    if (fTrack && fViewport && fDots && fPrev && fNext && storySlides.length) {
        let fi = 0;
        const nSlides = storySlides.length;

        fDots.replaceChildren();
        for (let i = 0; i < nSlides; i++) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'social-fslide-dot';
            dot.setAttribute('role', 'tab');
            dot.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
            dot.setAttribute('aria-label', `Story ${i + 1} of ${nSlides}`);
            dot.addEventListener('click', () => {
                fi = i;
                applyFeaturedSlide();
            });
            fDots.appendChild(dot);
        }

        function featuredSlideWidth() {
            return fViewport.getBoundingClientRect().width;
        }

        function applyFeaturedSlide() {
            const w = featuredSlideWidth();
            fTrack.style.transform = `translate3d(${-fi * w}px, 0, 0)`;
            fDots.querySelectorAll('.social-fslide-dot').forEach((d, j) => {
                d.classList.toggle('is-active', j === fi);
                d.setAttribute('aria-selected', j === fi ? 'true' : 'false');
            });
        }

        fPrev.addEventListener('click', () => {
            fi = (fi - 1 + nSlides) % nSlides;
            applyFeaturedSlide();
        });
        fNext.addEventListener('click', () => {
            fi = (fi + 1) % nSlides;
            applyFeaturedSlide();
        });

        let ftResizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(ftResizeTimer);
            ftResizeTimer = setTimeout(() => {
                ftResizeTimer = null;
                applyFeaturedSlide();
            }, 120);
        });
        applyFeaturedSlide();
    }

    const prevCards = document.getElementById('socialCardsPrev');
    const nextCards = document.getElementById('socialCardsNext');
    if (cardsVp && prevCards && nextCards && cardsRoot?.children.length) {
        const scrollStep = () => {
            const first = cardsRoot.querySelector('.social-card');
            if (!first) return 320;
            const gap = parseFloat(getComputedStyle(cardsRoot).columnGap || getComputedStyle(cardsRoot).gap) || 16;
            return first.getBoundingClientRect().width + gap;
        };
        prevCards.addEventListener('click', () => {
            cardsVp.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
        });
        nextCards.addEventListener('click', () => {
            cardsVp.scrollBy({ left: scrollStep(), behavior: 'smooth' });
        });
    }

})();

(function mountProductCards() {
    const grid = document.getElementById('productsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    PRODUCTS.forEach((p) => {
        const card = document.createElement('article');
        card.className = 'product-card';
        card.dataset.anim = '';

        const wrap = document.createElement('div');
        wrap.className = 'prod-img-wrap' + (p.dark ? ' prod-img-dark' : '');

        const imgMain = document.createElement('img');
        imgMain.className = 'prod-img prod-img-main';
        imgMain.src = p.imgMain;
        imgMain.alt = p.name;
        imgMain.loading = 'lazy';
        imgMain.decoding = 'async';

        const imgHover = document.createElement('img');
        imgHover.className = 'prod-img prod-img-hover';
        imgHover.src = p.imgHover;
        imgHover.alt = `${p.name} — alternate view`;
        imgHover.loading = 'lazy';
        imgHover.decoding = 'async';

        wrap.appendChild(imgMain);
        wrap.appendChild(imgHover);

        const h3 = document.createElement('h3');
        h3.className = 'prod-name';
        h3.textContent = p.name;

        const desc = document.createElement('p');
        desc.className = 'prod-desc';
        desc.textContent = p.desc;

        const price = document.createElement('p');
        price.className = 'prod-price';
        price.textContent = p.price;

        const a = document.createElement('a');
        a.className = 'btn-primary btn-sm';
        a.href = p.href;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.textContent = 'Buy';

        card.appendChild(wrap);
        card.appendChild(h3);
        card.appendChild(desc);
        card.appendChild(price);
        card.appendChild(a);
        grid.appendChild(card);
    });
})();

// =============================================
// Scroll Animations — fade-in
// =============================================
gsap.utils.toArray('[data-anim]').forEach(el => {
    gsap.to(el, {
        opacity: 1, y: 0, duration: 0.4, ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    });
});

// =============================================
// Assembly — фасеты сходятся в cubik (ScrollTrigger)
//
// Эталон загрузки — bion.glb; грани можно подменить мешами с других полных кубов из assets/models
// (см. ASSEMBLY_MIXED_CUBE): у каждого файла те же 6 граней, выбирается меш по оси относительно центра куба.
// =============================================
const asmCanvas = document.getElementById('assemblyCanvas');
/** Совпадает с блоком канваса: границы скролла/центра полосы и размер WebGL = видимый прямоугольник куба */
const asmStage = document.getElementById('assemblyStage');
const asmFallback = document.getElementById('assemblyFallback');

let asmBuildTL = null;
/** После загрузки куба для сборки — для кнопки «ещё раз» */
let assemblyMeshesRef = null;
/** Сборка фасетов: 1.5 = на 50% медленнее базовой скорости */
const ASM_BUILD_TIME_SCALE = 1.5;

/**
 * Демо «микс»: разные цвета по сторонам куба (как разные линейки/отделки). Геометрия одна и та же;
 * выключите false, если нужен монохром.
 */
const ASSEMBLY_SHOW_MIXED_FACET_COLORS = true;

/**
 * Цвет грани по доминирующей оси центра фасета относительно центра куба.
 * ±x Bion белый; +y void беж как свотч Beige в hero; ±z Zen grey; −y тёмно-зелёный.
 */
const ASSEMBLY_SLOT_COLORS = {
    '-x': PALETTE_FLORA_VOID_WHITE,
    '+x': PALETTE_FLORA_VOID_WHITE,
    '+z': PALETTE_ZEN_FACE_GREY,
    '-z': PALETTE_ZEN_FACE_GREY,
    '+y': PALETTE_BEIGE_ASSEMBLY_VOID,
    '-y': 0x2a6b45,
};

/**
 * Куб из разных полных GLB в `assets/models`: у каждого куба берётся меш грани по оси (как в bion.glb).
 * Позиция/стыковка — с эталона bion; геометрия — с выбранного файла.
 */
const ASSEMBLY_MIXED_CUBE = {
    sources: {
        bion: assetModelUrl('bion.glb'),
        void: assetModelUrl('void.glb'),
        /** Полный куб Zen (не zen-2 — другой продукт). Масштаб выравнивается normalize + assemblyMeshFromOtherCubik. */
        zen: assetModelUrl('zen.glb'),
    },
    /** Какой куб даёт грань на слоте (`source` — ключ из `sources`). */
    slots: [
        { key: '-x', source: 'bion', color: PALETTE_FLORA_VOID_WHITE },
        { key: '+x', source: 'bion', color: PALETTE_FLORA_VOID_WHITE },
        { key: '-z', source: 'zen', color: PALETTE_ZEN_FACE_GREY },
        { key: '+z', source: 'zen', color: PALETTE_ZEN_FACE_GREY },
        { key: '+y', source: 'void', color: PALETTE_BEIGE_ASSEMBLY_VOID },
        { key: '-y', source: 'zen', color: 0x2a6b45 },
    ],
};


const ASSEMBLY_FACE_KEYS = ['-x', '+x', '-y', '+y', '-z', '+z'];

const ASSEMBLY_SLOT_OUTWARD = {
    '-x': new THREE.Vector3(-1, 0, 0),
    '+x': new THREE.Vector3(1, 0, 0),
    '-y': new THREE.Vector3(0, -1, 0),
    '+y': new THREE.Vector3(0, 1, 0),
    '-z': new THREE.Vector3(0, 0, -1),
    '+z': new THREE.Vector3(0, 0, 1),
};

function assemblyOutwardNormalFromSlotKey(key) {
    const v = ASSEMBLY_SLOT_OUTWARD[key];
    return v ? v.clone() : new THREE.Vector3(0, 1, 0);
}

function assemblyColorHexForLog(hex) {
    return (Number(hex) >>> 0).toString(16).padStart(6, '0');
}

function assemblyMeshVertexCount(mesh) {
    return mesh.geometry?.attributes?.position?.count || 0;
}

function assemblyDominantFaceKey(dir) {
    const ax = Math.abs(dir.x);
    const ay = Math.abs(dir.y);
    const az = Math.abs(dir.z);
    if (ax >= ay && ax >= az) return dir.x >= 0 ? '+x' : '-x';
    if (ay >= ax && ay >= az) return dir.y >= 0 ? '+y' : '-y';
    return dir.z >= 0 ? '+z' : '-z';
}

function applyAssemblySlotColors(meshes, cubikCenterW) {
    if (!ASSEMBLY_SHOW_MIXED_FACET_COLORS || !meshes?.length) return;
    meshes.forEach((mesh) => {
        mesh.updateMatrixWorld(true);
        const fb = new THREE.Box3().setFromObject(mesh);
        const ctr = fb.getCenter(new THREE.Vector3());
        const key = assemblyDominantFaceKey(ctr.clone().sub(cubikCenterW));
        const hex = ASSEMBLY_SLOT_COLORS[key];
        const m = mesh.material;
        if (hex == null || !m?.color) return;
        m.color.setHex(hex, THREE.SRGBColorSpace);
    });
}

function loadGltfPromise(loader, url) {
    return new Promise((resolve, reject) => {
        loader.load(url, resolve, undefined, reject);
    });
}

function assemblyObjectWorldMaxAxisDim(obj) {
    obj.updateMatrixWorld(true);
    const sz = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    return Math.max(sz.x, sz.y, sz.z, 1e-6);
}

/** Обновить matrixWorld у всего поддерева от верхнего предка (нужно для мешей из клона GLTF вне сцены). */
function assemblyUpdateWorldFromGraphRoot(obj) {
    let top = obj;
    while (top.parent) top = top.parent;
    top.updateMatrixWorld(true);
}

/** Одна целевая толщина/размер грани с эталона: max по всем 6 слотам — иначе узкая деталь даёт refD≈0.02 и ratio≈0.01. */
function assemblyRefUniformTargetDim(refByKey) {
    let d = 0;
    for (const k of ASSEMBLY_FACE_KEYS) {
        const m = refByKey[k];
        if (m) d = Math.max(d, assemblyObjectWorldMaxAxisDim(m));
    }
    return Math.max(d, 1e-6);
}

function assemblyBuildRefByKey(refMeshes, cubikCenterW) {
    const buckets = Object.create(null);
    for (const m of refMeshes) {
        m.updateMatrixWorld(true);
        const fb = new THREE.Box3().setFromObject(m);
        const ctr = fb.getCenter(new THREE.Vector3());
        const key = assemblyDominantFaceKey(ctr.clone().sub(cubikCenterW));
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(m);
    }
    const refByKey = Object.create(null);
    for (const k of ASSEMBLY_FACE_KEYS) {
        const arr = buckets[k];
        if (!arr?.length) {
            console.warn(`[BuildRefByKey] missing face key ${k}`);
            return null;
        }
        refByKey[k] = arr.reduce((a, b) =>
            assemblyMeshVertexCount(a) >= assemblyMeshVertexCount(b) ? a : b
        );
    }
    console.log(`[BuildRefByKey] OK — ${Object.keys(refByKey).join(', ')}, from ${refMeshes.length} meshes`);
    return refByKey;
}

function assemblyStripGeometryVertexColors(geometry) {
    if (!geometry?.isBufferGeometry) return;
    if (geometry.getAttribute('color')) geometry.deleteAttribute('color');
}

/**
 * Верхняя грань (void.glb): тот же беж, что свотч Beige в hero; env выключен, чтобы не уводило в серо-зелёный.
 */
function assemblyApplyVoidFrameMaterial(mesh) {
    const old = mesh.material;
    if (!old) return;
    const color = new THREE.Color().setHex(PALETTE_BEIGE_ASSEMBLY_VOID, THREE.SRGBColorSpace);
    if (typeof old.dispose === 'function') old.dispose();
    mesh.material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.05,
        envMapIntensity: 0,
        side: THREE.DoubleSide,
    });
}

/** Все меши с нормалью грани +Y (верх куба) — единый материал рамки Void после любого пути сборки. */
function assemblyApplyVoidMaterialToPlusYMeshes(root, cubikCenterW) {
    if (!root || !cubikCenterW || !ASSEMBLY_SHOW_MIXED_FACET_COLORS) return;
    root.updateMatrixWorld(true);
    root.traverse((c) => {
        if (!(c.isMesh || c.isSkinnedMesh) || !c.material) return;
        c.updateMatrixWorld(true);
        const fb = new THREE.Box3().setFromObject(c);
        const ctr = fb.getCenter(new THREE.Vector3());
        const key = assemblyDominantFaceKey(ctr.clone().sub(cubikCenterW));
        if (key !== '+y') return;
        assemblyApplyVoidFrameMaterial(c);
    });
}

/** Клон грани с эталона bion (та же геометрия/трансформ), другой цвет. */
function assemblyCloneRefFacet(refMesh, baseMaterial, colorHex) {
    const mat = baseMaterial.clone();
    mat.color.setHex(colorHex, THREE.SRGBColorSpace);
    mat.vertexColors = false;
    if (refMesh.isSkinnedMesh) {
        const c = refMesh.clone(true);
        c.material = mat;
        if (c.geometry) assemblyStripGeometryVertexColors(c.geometry);
        c.frustumCulled = false;
        return c;
    }
    const geom = refMesh.geometry.clone();
    assemblyStripGeometryVertexColors(geom);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(refMesh.position);
    mesh.quaternion.copy(refMesh.quaternion);
    mesh.scale.copy(refMesh.scale);
    mesh.userData.assemblyFacetMaxDim = assemblyObjectWorldMaxAxisDim(refMesh);
    mesh.frustumCulled = false;
    return mesh;
}

/**
 * Сдвигает `root` в локальных координатах родителя так, чтобы AABB содержимого
 * совпадал с началом координат родителя в мире (после микса граней центр часто «уплывает»).
 */
function assemblyRecenterRootContent(root) {
    if (!root?.parent) return;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    if (box.isEmpty()) return;
    const worldC = box.getCenter(new THREE.Vector3());
    root.parent.updateMatrixWorld(true);
    const invP = new THREE.Matrix4().copy(root.parent.matrixWorld).invert();
    const inParent = worldC.clone().applyMatrix4(invP);
    root.position.sub(inParent);
}

/**
 * Масштаб 2.38 / maxD, центр по **мешам**.
 * void.glb (и подобные) дают у root/scene bbox сотни тысяч единиц из пустышек/transform,
 * при нормализации по root все грани сжимаются в «точки» — на экране два противоположных bion и мусор.
 */
function assemblyNormalizeCubikRoot(root, label) {
    root.updateMatrixWorld(true);
    const union = new THREE.Box3().makeEmpty();
    let meshCount = 0;
    root.traverse((ch) => {
        if ((ch.isMesh || ch.isSkinnedMesh) && ch.geometry) {
            union.expandByObject(ch);
            meshCount++;
        }
    });
    if (union.isEmpty()) {
        console.warn(`[Normalize ${label}] empty bbox, ${meshCount} meshes`);
        return false;
    }
    const size = union.getSize(new THREE.Vector3());
    const maxD = Math.max(size.x, size.y, size.z, 0.001);
    const scaleFactor = 2.38 / maxD;
    console.log(`[Normalize ${label}] meshes=${meshCount} rawSize=(${size.x.toFixed(3)},${size.y.toFixed(3)},${size.z.toFixed(3)}) maxD=${maxD.toFixed(4)} scale=${scaleFactor.toFixed(6)}`);
    root.scale.setScalar(scaleFactor);
    root.updateMatrixWorld(true);
    const union2 = new THREE.Box3().makeEmpty();
    root.traverse((ch) => {
        if ((ch.isMesh || ch.isSkinnedMesh) && ch.geometry) union2.expandByObject(ch);
    });
    root.position.sub(union2.getCenter(new THREE.Vector3()));
    root.updateMatrixWorld(true);
    return true;
}

function assemblyCubikCenterFromMeshes(root) {
    const b = new THREE.Box3().makeEmpty();
    root.updateMatrixWorld(true);
    root.traverse((ch) => {
        if ((ch.isMesh || ch.isSkinnedMesh) && ch.geometry) b.expandByObject(ch);
    });
    return b.isEmpty() ? null : b.getCenter(new THREE.Vector3());
}

/**
 * Загружает полный куб, нормализует, map «ось грани» → меш.
 * Несколько мешей на одну ось (винты, дубликаты) — оставляем с большим числом вершин.
 */
async function assemblyLoadCubikFaceMap(loader, url, facetMat, fixGeometry) {
    console.log(`[FaceMap] loading ${url}...`);
    const gltf = await loadGltfPromise(loader, url);
    const root = gltf.scene.clone(true);
    let meshTotal = 0;
    root.traverse((c) => {
        if (c.isMesh || c.isSkinnedMesh) {
            cleanMeshGeometry(c, fixGeometry);
            c.material = facetMat.clone();
            meshTotal++;
        }
    });
    console.log(`[FaceMap ${url}] raw meshes: ${meshTotal}`);
    if (!assemblyNormalizeCubikRoot(root, url)) {
        console.warn(`[FaceMap ${url}] normalize failed`);
        return null;
    }

    const meshes = [];
    root.traverse((c) => {
        if ((c.isMesh || c.isSkinnedMesh) && c.geometry) meshes.push(c);
    });
    console.log(`[FaceMap ${url}] valid meshes after normalize: ${meshes.length}`);
    if (meshes.length < 6) {
        console.warn(`[FaceMap ${url}] < 6 meshes, abort`);
        return null;
    }

    const cubikC = assemblyCubikCenterFromMeshes(root);
    if (!cubikC) return null;
    const buckets = Object.create(null);
    for (const m of meshes) {
        m.updateMatrixWorld(true);
        const fb = new THREE.Box3().setFromObject(m);
        const ctr = fb.getCenter(new THREE.Vector3());
        const key = assemblyDominantFaceKey(ctr.clone().sub(cubikC));
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(m);
    }

    const bucketSummary = Object.entries(buckets).map(([k, v]) => `${k}:${v.length}`).join(' ');
    console.log(`[FaceMap ${url}] buckets: ${bucketSummary}`);

    const byKey = Object.create(null);
    for (const k of ASSEMBLY_FACE_KEYS) {
        const arr = buckets[k];
        if (!arr?.length) {
            console.warn(`[FaceMap ${url}] missing face key ${k}`);
            return null;
        }
        byKey[k] = arr.reduce((a, b) =>
            assemblyMeshVertexCount(a) >= assemblyMeshVertexCount(b) ? a : b
        );
    }
    console.log(`[FaceMap ${url}] OK — all 6 keys resolved`);
    root.updateMatrixWorld(true);
    return byKey;
}

async function assemblyLoadCubikFaceMapFirstWorking(loader, urls, facetMat) {
    const list = Array.isArray(urls) ? urls : [urls];
    for (const url of list) {
        try {
            const map = await assemblyLoadCubikFaceMap(loader, url, facetMat, false);
            if (map) return map;
            console.warn(`[FaceMapFirstWorking] ${url} returned null, trying next`);
        } catch (err) {
            console.warn(`[FaceMapFirstWorking] ${url} error:`, err.message || err);
        }
    }
    return null;
}

/** Надёжный max-размер меша в мире: обход вершин × matrixWorld (setFromObject иногда врёт). */
function assemblyMeshWorldMaxAxisFromVertices(mesh) {
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry;
    if (!g?.attributes?.position) return 0;
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    const mw = mesh.matrixWorld;
    const box = new THREE.Box3().makeEmpty();
    const n = pos.count;
    for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mw);
        box.expandByPoint(v);
    }
    if (box.isEmpty()) return 0;
    const sz = box.getSize(new THREE.Vector3());
    return Math.max(sz.x, sz.y, sz.z, 0);
}

/**
 * После parent.add(mesh): подгоняем scale так, чтобы max-ось мирового AABB совпала с эталоном.
 */
function assemblyApplyWorldMaxFitFromVertices(mesh, targetMax, logTag) {
    if (!mesh || !(targetMax > 1e-6)) return;
    let wMax = assemblyMeshWorldMaxAxisFromVertices(mesh);
    if (wMax < 1e-10) {
        mesh.updateMatrixWorld(true);
        const sz = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
        wMax = Math.max(sz.x, sz.y, sz.z, 0);
    }
    const k = targetMax / Math.max(wMax, 1e-12);
    if (!Number.isFinite(k) || k <= 0) return;
    if (Math.abs(k - 1) <= 0.004) return;
    mesh.scale.multiplyScalar(k);
    mesh.updateMatrixWorld(true);
    console.log(`[Assembly ${logTag}] vertexWorldFit ×${k.toFixed(3)} (wMax ${wMax.toFixed(5)} → ${targetMax.toFixed(4)})`);
}

function assemblyGeometryCenterWorld(mesh) {
    mesh.updateMatrixWorld(true);
    const g = mesh.geometry;
    if (!g?.attributes?.position) return null;
    const pos = g.attributes.position;
    const v = new THREE.Vector3();
    const mw = mesh.matrixWorld;
    const box = new THREE.Box3().makeEmpty();
    for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mw);
        box.expandByPoint(v);
    }
    return box.isEmpty() ? null : box.getCenter(new THREE.Vector3());
}

/** Сдвиг mesh.position в локале родителя так, чтобы геометрия сместилась на deltaW в мире (родитель — без skew). */
function assemblyTranslateMeshByWorldDelta(mesh, deltaW) {
    const parent = mesh.parent;
    if (!parent) {
        mesh.position.add(deltaW);
        return;
    }
    parent.updateMatrixWorld(true);
    const p = new THREE.Vector3();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    parent.matrixWorld.decompose(p, q, s);
    const localDelta = deltaW.clone().applyQuaternion(q.clone().invert()).divide(s);
    mesh.position.add(localDelta);
}

function assemblySnapMeshCenterToRefWorld(mesh, targetWorldCenter, logTag) {
    if (!mesh || !targetWorldCenter) return;
    mesh.updateMatrixWorld(true);
    const cM = assemblyGeometryCenterWorld(mesh);
    if (!cM) return;
    const deltaW = targetWorldCenter.clone().sub(cM);
    if (deltaW.lengthSq() < 1e-12) return;
    assemblyTranslateMeshByWorldDelta(mesh, deltaW);
    mesh.updateMatrixWorld(true);
    console.log(`[Assembly ${logTag}] centerSnap len=${deltaW.length().toFixed(4)}`);
}

/** Индекс самой короткой стороны мирового AABB (0=x,1=y,2=z) — у плоской грани это «толщина». */
function assemblyThinAxisIndexWorld(mesh) {
    mesh.updateMatrixWorld(true);
    const sz = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3());
    const d = [sz.x, sz.y, sz.z];
    const m = Math.min(d[0], d[1], d[2]);
    return d.indexOf(m);
}

/** Для слота ±x/±y/±z тонкая ось в мире должна совпадать с осью нормали грани. */
function assemblyWantThinAxisIndex(slotKey) {
    const a = slotKey[1];
    if (a === 'x') return 0;
    if (a === 'y') return 1;
    return 2;
}

const ASSEMBLY_THIN_FIX = {
    '1-2': [new THREE.Vector3(1, 0, 0), Math.PI / 2],
    '2-1': [new THREE.Vector3(1, 0, 0), -Math.PI / 2],
    '0-2': [new THREE.Vector3(0, 1, 0), Math.PI / 2],
    '2-0': [new THREE.Vector3(0, 1, 0), -Math.PI / 2],
    '0-1': [new THREE.Vector3(0, 0, 1), Math.PI / 2],
    '1-0': [new THREE.Vector3(0, 0, 1), -Math.PI / 2],
};

function assemblyFixThinAxisToMatchSlot(mesh, slotKey, logTag) {
    const want = assemblyWantThinAxisIndex(slotKey);
    for (let step = 0; step < 4; step++) {
        const thin = assemblyThinAxisIndexWorld(mesh);
        if (thin === want) return;
        const spec = ASSEMBLY_THIN_FIX[`${thin}-${want}`];
        if (!spec) {
            console.warn(`[Assembly ${logTag}] thin=${thin} want=${want} — нет пары в ASSEMBLY_THIN_FIX`);
            return;
        }
        mesh.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(spec[0], spec[1]));
        mesh.updateMatrixWorld(true);
    }
    if (assemblyThinAxisIndexWorld(mesh) !== want) {
        console.warn(`[Assembly ${logTag}] thinAxis не сошёлся после поворотов`);
    } else {
        console.log(`[Assembly ${logTag}] thinAxis→${want} (${slotKey})`);
    }
}

/**
 * Zen: грань ориентирована «внешней» стороной наружу — нужна рабочая сторона к центру куба.
 * Поворот на π вокруг оси, лежащей в плоскости грани (переворот как вокруг ребра), меняет лицевую сторону на противоположную.
 */
function assemblyZenFlipFaceTowardCubeInterior(mesh, slotKey) {
    mesh.updateMatrixWorld(true);
    const nW = assemblyOutwardNormalFromSlotKey(slotKey).clone().normalize();
    let t = new THREE.Vector3(0, 1, 0);
    t.addScaledVector(nW, -t.dot(nW));
    if (t.lengthSq() < 1e-8) {
        t.set(1, 0, 0);
        t.addScaledVector(nW, -t.dot(nW));
    }
    if (t.lengthSq() < 1e-8) {
        t.set(0, 0, 1);
        t.addScaledVector(nW, -t.dot(nW));
    }
    t.normalize();
    mesh.rotateOnWorldAxis(t, Math.PI);
    mesh.updateMatrixWorld(true);
}

function assemblyMeshFromOtherCubik(sourceMesh, refMesh, baseMaterial, colorHex, slotKey, refTargetDim) {
    assemblyUpdateWorldFromGraphRoot(sourceMesh);
    sourceMesh.updateMatrixWorld(true);
    refMesh.updateMatrixWorld(true);
    const refParent = refMesh.parent;
    if (!refParent) {
        console.warn(`[MeshFromCubik ${slotKey || '?'}] refMesh без parent`);
        return assemblyCloneRefFacet(refMesh, baseMaterial, colorHex);
    }
    refParent.updateMatrixWorld(true);
    const cubikBion = new THREE.Box3().setFromObject(refParent).getCenter(new THREE.Vector3());

    let srcRoot = sourceMesh;
    while (srcRoot.parent) srcRoot = srcRoot.parent;
    srcRoot.updateMatrixWorld(true);
    const cubikSrc = new THREE.Box3().setFromObject(srcRoot).getCenter(new THREE.Vector3());

    const g = sourceMesh.geometry.clone();
    g.applyMatrix4(sourceMesh.matrixWorld);
    g.computeBoundingBox();
    const bb0 = g.boundingBox;
    const srcCtr = bb0.getCenter(new THREE.Vector3());

    let nSrc = srcCtr.clone().sub(cubikSrc);
    if (nSrc.lengthSq() < 1e-12) {
        nSrc.copy(assemblyOutwardNormalFromSlotKey(slotKey));
    } else {
        nSrc.normalize();
    }

    const refBox = new THREE.Box3().setFromObject(refMesh);
    const refCtrW = refBox.getCenter(new THREE.Vector3());
    let nRef = refCtrW.clone().sub(cubikBion);
    if (nRef.lengthSq() < 1e-12) {
        nRef.copy(assemblyOutwardNormalFromSlotKey(slotKey));
    } else {
        nRef.normalize();
    }

    const qAlign = new THREE.Quaternion().setFromUnitVectors(nSrc, nRef);
    if (Number.isFinite(qAlign.x) && Number.isFinite(qAlign.w)) {
        g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(qAlign));
    }

    g.computeBoundingBox();
    const bb = g.boundingBox;
    g.translate(-(bb.min.x + bb.max.x) * 0.5, -(bb.min.y + bb.max.y) * 0.5, -(bb.min.z + bb.max.z) * 0.5);
    g.computeBoundingBox();
    const sz = g.boundingBox.getSize(new THREE.Vector3());
    const facetMax = Math.max(sz.x, sz.y, sz.z, 1e-6);
    const refD =
        refTargetDim != null && Number.isFinite(refTargetDim) && refTargetDim > 1e-5
            ? refTargetDim
            : assemblyObjectWorldMaxAxisDim(refMesh);
    const ratio = refD / facetMax;
    console.log(`[MeshFromCubik ${slotKey || '?'}] facetMax=${facetMax.toFixed(4)} refD=${refD.toFixed(4)} ratio=${ratio.toFixed(6)} color=0x${assemblyColorHexForLog(colorHex)}`);
    if (!Number.isFinite(ratio) || ratio < 1e-4 || ratio > 1e4) {
        console.warn(`[MeshFromCubik ${slotKey || '?'}] bad ratio → cloning refMesh as fallback`);
        return assemblyCloneRefFacet(refMesh, baseMaterial, colorHex);
    }
    assemblyStripGeometryVertexColors(g);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const mat = baseMaterial.clone();
    mat.color.setHex(colorHex, THREE.SRGBColorSpace);
    mat.vertexColors = false;
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.copy(refMesh.position);
    mesh.quaternion.copy(refMesh.quaternion);
    mesh.scale.copy(refMesh.scale).multiplyScalar(ratio);
    mesh.userData.assemblyFacetMaxDim = refD;
    mesh.userData.assemblyRefWorldCenter = refCtrW.clone();
    mesh.frustumCulled = false;
    return mesh;
}

/**
 * Собирает куб: грани с разных полных GLB из `ASSEMBLY_MIXED_CUBE.sources`.
 * @returns {Promise<{ meshes: THREE.Mesh[], usedComposite: boolean }>}
 */
async function assemblyTryBuildMixedCubeFromModels(root, refMeshes, cubikCenterW, facetMat, loader) {
    console.log('[Assembly] === Building mixed cube from full models ===');
    const { sources, slots } = ASSEMBLY_MIXED_CUBE;
    const refByKey = assemblyBuildRefByKey(refMeshes, cubikCenterW);
    if (!refByKey) {
        console.warn('[Assembly] refByKey failed (duplicate axes in bion?)');
        return { meshes: refMeshes, usedComposite: false };
    }
    console.log('[Assembly] ref keys:', Object.keys(refByKey).join(', '));

    for (const s of slots) {
        if (!refByKey[s.key]) {
            console.warn(`[Assembly] missing ref for slot ${s.key}`);
            return { meshes: refMeshes, usedComposite: false };
        }
    }

    const needed = new Set(slots.map((sl) => sl.source));
    const faceMaps = Object.create(null);
    faceMaps.bion = refByKey;

    try {
        for (const name of needed) {
            if (name === 'bion') continue;
            const spec = sources[name];
            if (!spec) {
                console.warn(`[Assembly] no source spec for "${name}"`);
                return { meshes: refMeshes, usedComposite: false };
            }
            console.log(`[Assembly] loading "${name}" from`, spec);
            const byKey = await assemblyLoadCubikFaceMapFirstWorking(loader, spec, facetMat);
            if (!byKey) {
                console.warn(`[Assembly] faceMap for "${name}" returned null`);
                return { meshes: refMeshes, usedComposite: false };
            }
            console.log(`[Assembly] "${name}" face keys:`, Object.keys(byKey).join(', '));
            faceMaps[name] = byKey;
        }
    } catch (err) {
        console.error('[Assembly] loading models error:', err);
        return { meshes: refMeshes, usedComposite: false };
    }

    const refTargetDim = assemblyRefUniformTargetDim(refByKey);
    console.log(`[Assembly] refTargetDim (uniform scale vs bion) = ${refTargetDim.toFixed(4)}`);

    const newMeshes = [];
    for (const slot of slots) {
        const ref = refByKey[slot.key];
        if (slot.source === 'bion') {
            console.log(`[Assembly slot ${slot.key}] → bion clone, color=0x${assemblyColorHexForLog(slot.color)}`);
            newMeshes.push(assemblyCloneRefFacet(ref, facetMat, slot.color));
            continue;
        }
        const src = faceMaps[slot.source]?.[slot.key];
        if (!src) {
            console.warn(`[Assembly slot ${slot.key}] → ${slot.source} face not found, clone ref`);
            newMeshes.push(assemblyCloneRefFacet(ref, facetMat, slot.color));
        } else {
            console.log(`[Assembly slot ${slot.key}] → ${slot.source} geometry`);
            newMeshes.push(assemblyMeshFromOtherCubik(src, ref, facetMat, slot.color, slot.key, refTargetDim));
        }
    }

    while (root.children.length) root.remove(root.children[0]);
    newMeshes.forEach((m) => root.add(m));

    root.updateMatrixWorld(true);
    for (let i = 0; i < newMeshes.length; i++) {
        const sl = slots[i];
        if (sl && sl.source !== 'bion') {
            const m = newMeshes[i];
            assemblyApplyWorldMaxFitFromVertices(m, refTargetDim, `slot ${sl.key}`);
            assemblySnapMeshCenterToRefWorld(m, m.userData.assemblyRefWorldCenter, `slot ${sl.key}`);
            assemblyFixThinAxisToMatchSlot(m, sl.key, `slot ${sl.key}`);
            assemblySnapMeshCenterToRefWorld(m, m.userData.assemblyRefWorldCenter, `slot ${sl.key} post-twist`);
            if (sl.source === 'zen') {
                assemblyZenFlipFaceTowardCubeInterior(m, sl.key);
                assemblySnapMeshCenterToRefWorld(m, m.userData.assemblyRefWorldCenter, `slot ${sl.key} post-zenFlip`);
            }
        }
    }
    root.updateMatrixWorld(true);

    for (const m of newMeshes) {
        m.updateMatrixWorld(true);
        const wb = new THREE.Box3().setFromObject(m);
        const ws = wb.getSize(new THREE.Vector3());
        const wc = wb.getCenter(new THREE.Vector3());
        console.log(`[Assembly result] mesh pos=(${m.position.x.toFixed(4)},${m.position.y.toFixed(4)},${m.position.z.toFixed(4)}) worldSize=(${ws.x.toFixed(4)},${ws.y.toFixed(4)},${ws.z.toFixed(4)}) worldCenter=(${wc.x.toFixed(4)},${wc.y.toFixed(4)},${wc.z.toFixed(4)})`);
    }
    console.log('[Assembly] === Mixed cube built successfully ===');

    return { meshes: newMeshes, usedComposite: true };
}

function applyExplodedPositions(meshes) {
    if (!meshes?.length) return;
    meshes.forEach((mesh) => {
        const ex = mesh.userData.explodedPos;
        if (ex) mesh.position.copy(ex);
    });
}

/** GLB часто содержит Line/LineSegments (каркас) — traverse только на Mesh их не трогает, остаются «тонкие линии». */
function assemblySanitizeDrawables(root) {
    if (!root) return;
    root.traverse((c) => {
        if (c.isLine || c.isLineSegments || c.isLineLoop || c.isPoints) {
            c.visible = false;
            return;
        }
        const mat = c.material;
        if (!mat) return;
        const list = Array.isArray(mat) ? mat : [mat];
        for (const m of list) {
            if (m && m.wireframe) m.wireframe = false;
        }
    });
}

function assemblyApplyShadowFlags(root) {
    if (!root) return;
    root.traverse((c) => {
        if (c.isMesh || c.isSkinnedMesh) {
            c.castShadow = false;
            c.receiveShadow = false;
        }
    });
}

/** Одна мягкая «контактная» тень на полу — без карт теней от граней */
function createAssemblyFloorBlobTexture() {
    const s = 256;
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        const t = new THREE.CanvasTexture(canvas);
        t.colorSpace = THREE.SRGBColorSpace;
        return t;
    }
    const cx = s * 0.5;
    const r = s * 0.5;
    const g = ctx.createRadialGradient(cx, cx, 0, cx, cx, r);
    g.addColorStop(0, 'rgba(18, 20, 24, 0.58)');
    g.addColorStop(0.35, 'rgba(22, 24, 28, 0.28)');
    g.addColorStop(0.65, 'rgba(26, 28, 32, 0.1)');
    g.addColorStop(1, 'rgba(32, 34, 38, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
}

function buildAssemblyMacroPlan(meshes, modelRoot) {
    if (!meshes?.length) return null;
    modelRoot.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(modelRoot);
    const cubikCenterW = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const half = Math.max(size.x, size.y, size.z) * 0.5 * 1.02;

    const facets = meshes.map((mesh) => {
        mesh.updateMatrixWorld(true);
        const fb = new THREE.Box3().setFromObject(mesh);
        const c = fb.getCenter(new THREE.Vector3());
        const n = c.clone().sub(cubikCenterW);
        if (n.lengthSq() < 1e-12) n.set(0, 0, 1);
        else n.normalize();
        return { mesh, centerW: c, normalW: n };
    });

    const pairs = [];
    for (let i = 0; i < facets.length; i++) {
        for (let j = i + 1; j < facets.length; j++) {
            if (Math.abs(facets[i].normalW.dot(facets[j].normalW)) < 0.28) {
                pairs.push([facets[i], facets[j]]);
            }
        }
    }
    if (pairs.length === 0) return null;

    /** Остов: первая пара с разлёта, далее каждый новый фасет стыкуется к уже собранной оболочке. */
    function buildSequentialSteps() {
        const n = facets.length;
        const pk = (a, b) => [a.mesh.uuid, b.mesh.uuid].sort().join('|');
        const inAsm = new Set();
        const usedEdge = new Set();
        const steps = [];

        const p0 = pairs[0];
        steps.push({ mode: 'dual', pair: p0 });
        inAsm.add(p0[0].mesh.uuid);
        inAsm.add(p0[1].mesh.uuid);
        usedEdge.add(pk(p0[0], p0[1]));

        while (inAsm.size < n) {
            let dock = null;
            for (const p of pairs) {
                if (usedEdge.has(pk(p[0], p[1]))) continue;
                const [x, y] = p;
                const xi = inAsm.has(x.mesh.uuid);
                const yi = inAsm.has(y.mesh.uuid);
                if (xi && !yi) {
                    dock = { statFacet: x, moverFacet: y, pair: p };
                    break;
                }
                if (!xi && yi) {
                    dock = { statFacet: y, moverFacet: x, pair: p };
                    break;
                }
            }
            if (!dock) break;
            usedEdge.add(pk(dock.pair[0], dock.pair[1]));
            inAsm.add(dock.moverFacet.mesh.uuid);
            steps.push({ mode: 'dock', statFacet: dock.statFacet, moverFacet: dock.moverFacet, pair: dock.pair });
        }

        return steps;
    }

    const sequentialSteps = buildSequentialSteps();

    function focusForPair(facetA, facetB) {
        const n1 = facetA.normalW;
        const n2 = facetB.normalW;
        const focus = cubikCenterW.clone().addScaledVector(n1, half).addScaledVector(n2, half);
        const outward = n1.clone().add(n2);
        if (outward.lengthSq() < 1e-12) outward.set(0, 1, 0);
        outward.normalize();
        return { focus, outward };
    }

    return {
        cubikCenterW,
        half,
        pairs,
        sequentialSteps,
        focusForPair,
        pair1: sequentialSteps[0]?.pair,
        pair2: sequentialSteps[1]?.pair,
    };
}

function computePreSnapLocal(mesh, outwardW, gap) {
    const assembled = mesh.userData.assembledPos;
    mesh.position.copy(assembled);
    mesh.updateMatrixWorld(true);
    const p0 = new THREE.Vector3();
    mesh.getWorldPosition(p0);
    const p1 = p0.clone().addScaledVector(outwardW, gap);
    const local = p1.clone();
    mesh.parent.worldToLocal(local);
    mesh.position.copy(assembled);
    return local;
}

function pulseAssemblySnap(mesh) {
    const m = mesh.material;
    if (!m || m.emissiveIntensity === undefined) return;
    gsap.killTweensOf(m);
    gsap.fromTo(
        m,
        { emissiveIntensity: 0 },
        { emissiveIntensity: 0.75, duration: 0.085, yoyo: true, repeat: 1, ease: 'power2.out' }
    );
}

function assemblySequentialStepsCoverAllMeshes(steps, meshes) {
    if (!steps?.length || !meshes?.length) return false;
    const covered = new Set();
    for (const st of steps) {
        if (st.mode === 'dual') {
            covered.add(st.pair[0].mesh.uuid);
            covered.add(st.pair[1].mesh.uuid);
        } else {
            covered.add(st.statFacet.mesh.uuid);
            covered.add(st.moverFacet.mesh.uuid);
        }
    }
    return covered.size === meshes.length;
}

function resetAssemblyToExploded(meshes) {
    if (asmBuildTL) {
        asmBuildTL.kill();
        asmBuildTL = null;
    }
    asmAssemblyComplete = false;
    if (asmShadowCatcher) asmShadowCatcher.visible = false;
    if (asmModelRoot) asmModelRoot.rotation.y = 0;
    if (!meshes?.length) return;
    applyExplodedPositions(meshes);
    meshes.forEach((mesh) => {
        mesh.visible = false;
        const m = mesh.material;
        if (m && m.emissiveIntensity !== undefined) m.emissiveIntensity = 0;
    });
    updateAssemblyCameraFit();
}

function playAssemblyBuild(meshes) {
    if (!meshes?.length) return;
    cancelAssemblyScrollPlayRaf();
    if (asmBuildTL) asmBuildTL.kill();
    if (asmModelRoot) asmModelRoot.rotation.y = 0;
    applyExplodedPositions(meshes);
    meshes.forEach((m) => {
        m.visible = false;
        const mat = m.material;
        if (mat && mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;
    });
    asmAssemblyComplete = false;
    if (asmShadowCatcher) asmShadowCatcher.visible = false;
    updateAssemblyCameraFit();

    const plan = assemblyMacroPlan;
    const steps = plan?.sequentialSteps;
    const useSequential =
        Boolean(steps?.length && meshes.length >= 2) &&
        assemblySequentialStepsCoverAllMeshes(steps, meshes);

    const finishBuild = () => {
        meshes.forEach((m) => {
            m.visible = true;
            if (m.userData?.assembledPos) m.position.copy(m.userData.assembledPos);
            const mat = m.material;
            if (mat && mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;
        });
        asmAssemblyComplete = true;
        asmBuildTL = null;
        updateAssemblyShadowCatcher();
    };

    if (!useSequential) {
        if (steps?.length && !assemblySequentialStepsCoverAllMeshes(steps, meshes)) {
            console.warn('[Assembly] пошаговый план не охватывает все 6 граней — простая анимация сбора');
        }
        applyAssemblyCloseUpCamera();
        const S = ASM_BUILD_TIME_SCALE;
        const perFace = 1.12 * S;
        asmBuildTL = gsap.timeline({ onComplete: finishBuild });
        meshes.forEach((mesh, i) => {
            const p = mesh.userData.assembledPos;
            if (!p) return;
            const t0 = i * perFace;
            asmBuildTL.call(() => {
                mesh.visible = true;
            }, null, t0);
            asmBuildTL.to(
                mesh.position,
                {
                    x: p.x,
                    y: p.y,
                    z: p.z,
                    duration: perFace * 0.92,
                    ease: 'power1.inOut',
                },
                t0
            );
        });
        return;
    }

    const S = ASM_BUILD_TIME_SCALE;
    /** Короткий ход «вдоль нормали» — стык грань-к-грани без глубокого вылета камеры вместе с деталью. */
    const gap = Math.max(0.032, plan.half * 0.055);
    const MACRO_APPROACH = 0.52 * S;
    const MACRO_SNAP = 0.45 * S;

    applyAssemblyCloseUpCamera();
    asmBuildTL = gsap.timeline({ onComplete: finishBuild });

    function extrasBeforeStep(stepIndex) {
        const done = new Set();
        for (let s = 0; s < stepIndex; s++) {
            const st = steps[s];
            if (st.mode === 'dual') {
                done.add(st.pair[0].mesh.uuid);
                done.add(st.pair[1].mesh.uuid);
            } else {
                done.add(st.statFacet.mesh.uuid);
                done.add(st.moverFacet.mesh.uuid);
            }
        }
        const st = steps[stepIndex];
        if (st.mode === 'dual') {
            return meshes.filter((m) => done.has(m.uuid));
        }
        const stM = st.statFacet.mesh;
        const mvM = st.moverFacet.mesh;
        return meshes.filter((m) => done.has(m.uuid) && m !== stM && m !== mvM);
    }

    function addDualStep(tStart, step, extras) {
        const dualFlip = true;
        const [fA, fB] = step.pair;
        const stat = dualFlip ? fB.mesh : fA.mesh;
        const mover = dualFlip ? fA.mesh : fB.mesh;
        const { outward } = plan.focusForPair(fA, fB);
        const preLocal = computePreSnapLocal(mover, outward, gap);

        asmBuildTL.call(
            () => {
                const active = new Set(extras.map((e) => e.uuid));
                active.add(stat.uuid);
                active.add(mover.uuid);
                meshes.forEach((m) => {
                    m.visible = active.has(m.uuid);
                });
                extras.forEach((m) => {
                    m.position.copy(m.userData.assembledPos);
                });
                stat.position.copy(stat.userData.explodedPos);
                mover.position.copy(mover.userData.explodedPos);
            },
            null,
            tStart
        );

        const approachT = MACRO_APPROACH;

        asmBuildTL.to(
            stat.position,
            {
                x: stat.userData.assembledPos.x,
                y: stat.userData.assembledPos.y,
                z: stat.userData.assembledPos.z,
                duration: MACRO_APPROACH,
                ease: 'power1.inOut',
            },
            tStart
        );
        asmBuildTL.to(
            mover.position,
            { x: preLocal.x, y: preLocal.y, z: preLocal.z, duration: MACRO_APPROACH, ease: 'power1.inOut' },
            tStart
        );

        const snapT = tStart + approachT;
        asmBuildTL.to(
            mover.position,
            {
                x: mover.userData.assembledPos.x,
                y: mover.userData.assembledPos.y,
                z: mover.userData.assembledPos.z,
                duration: MACRO_SNAP,
                ease: 'power1.inOut',
                onComplete: () => {
                    pulseAssemblySnap(mover);
                    pulseAssemblySnap(stat);
                },
            },
            snapT
        );

        return snapT + MACRO_SNAP;
    }

    function addDockStep(tStart, step, extras) {
        const stat = step.statFacet.mesh;
        const mover = step.moverFacet.mesh;
        const { outward } = plan.focusForPair(step.statFacet, step.moverFacet);
        const preLocal = computePreSnapLocal(mover, outward, gap);

        asmBuildTL.call(
            () => {
                const active = new Set(extras.map((e) => e.uuid));
                active.add(stat.uuid);
                active.add(mover.uuid);
                meshes.forEach((m) => {
                    m.visible = active.has(m.uuid);
                });
                extras.forEach((m) => {
                    m.position.copy(m.userData.assembledPos);
                });
                stat.position.copy(stat.userData.assembledPos);
                mover.position.copy(mover.userData.explodedPos);
            },
            null,
            tStart
        );

        const approachT = MACRO_APPROACH;

        asmBuildTL.to(
            mover.position,
            { x: preLocal.x, y: preLocal.y, z: preLocal.z, duration: MACRO_APPROACH, ease: 'power1.inOut' },
            tStart
        );

        const snapT = tStart + approachT;
        asmBuildTL.to(
            mover.position,
            {
                x: mover.userData.assembledPos.x,
                y: mover.userData.assembledPos.y,
                z: mover.userData.assembledPos.z,
                duration: MACRO_SNAP,
                ease: 'power1.inOut',
                onComplete: () => {
                    pulseAssemblySnap(mover);
                    pulseAssemblySnap(stat);
                },
            },
            snapT
        );

        return snapT + MACRO_SNAP;
    }

    let t = 0;
    for (let i = 0; i < steps.length; i++) {
        const ex = extrasBeforeStep(i);
        t = steps[i].mode === 'dual' ? addDualStep(t, steps[i], ex) : addDockStep(t, steps[i], ex);
    }

    asmBuildTL.call(
        () => {
            meshes.forEach((m) => {
                m.visible = true;
                m.position.copy(m.userData.assembledPos);
                const mat = m.material;
                if (mat && mat.emissiveIntensity !== undefined) mat.emissiveIntensity = 0;
            });
        },
        null,
        t
    );
}

function initAssemblyViewer() {
    if (asmRenderer || !asmCanvas || !asmStage) return;

    asmScene = new THREE.Scene();
    asmScene.background = new THREE.Color(0xffffff);

    asmCamera = new THREE.PerspectiveCamera(ASM_CAMERA_FOV_DEFAULT, 1, 0.08, 200);
    asmCamera.position.set(0, 0, 5.5);

    asmRenderer = createCompatWebGLRenderer({
        canvas: asmCanvas,
        alpha: false,
    });
    if (!asmRenderer.getContext()) {
        try {
            asmRenderer.dispose();
        } catch {
            /* ignore */
        }
        asmRenderer = null;
        asmCanvas?.classList.add('visually-hidden');
        asmCanvas?.setAttribute('aria-hidden', 'true');
        asmStage?.classList.add('is-ready', 'has-static-fallback');
        document.getElementById('assemblyLoader')?.classList.add('hidden');
        const fb = document.getElementById('assemblyFallback');
        fb?.removeAttribute('hidden');
        fb?.setAttribute('aria-hidden', 'false');
        return;
    }
    function applyAsmPixelRatio() {
        if (!asmRenderer) return;
        const narrow = window.matchMedia('(max-width: 768px)').matches;
        const cap = narrow ? 1.5 : 2.5;
        asmRenderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
    }
    applyAsmPixelRatio();
    asmRenderer.setClearColor(0xffffff, 1);
    asmRenderer.outputColorSpace = THREE.SRGBColorSpace;
    /** Как у hero: иначе тот же hex (#E1B589) визуально расходится из‑за другого tone mapping */
    asmRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    asmRenderer.toneMappingExposure = 1.2;
    asmRenderer.shadowMap.enabled = false;

    const asmPmrem = new THREE.PMREMGenerator(asmRenderer);
    const asmRoomEnv = new RoomEnvironment();
    const asmEnvRt = asmPmrem.fromScene(asmRoomEnv, 0.04);
    asmScene.environment = asmEnvRt.texture;
    asmRoomEnv.dispose();
    asmPmrem.dispose();

    /** Ключевой свет — без castShadow: тень только мягким кругом под кубом */
    const asmKey = new THREE.DirectionalLight(0xffffff, 1.05);
    asmKey.position.set(4.5, 9.5, 5.2);
    asmKey.castShadow = false;
    asmScene.add(asmKey);

    asmScene.add(new THREE.AmbientLight(0xffffff, 0.2));
    asmScene.add(new THREE.HemisphereLight(0xffffff, 0xe8e6e3, 0.5));
    const asmFill = new THREE.DirectionalLight(0xfff8f2, 0.38);
    asmFill.position.set(-5.5, 6, 2);
    asmScene.add(asmFill);
    const asmRim = new THREE.DirectionalLight(0xf0f2f5, 0.22);
    asmRim.position.set(0.5, 4, -7.5);
    asmScene.add(asmRim);

    asmModelRoot = new THREE.Group();
    asmModelRoot.rotation.order = 'YXZ';
    asmScene.add(asmModelRoot);

    const blobTex = createAssemblyFloorBlobTexture();
    const catcherGeo = new THREE.CircleGeometry(1, 48);
    const catcherMat = new THREE.MeshBasicMaterial({
        map: blobTex,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -0.5,
        polygonOffsetUnits: -0.5,
    });
    asmShadowCatcher = new THREE.Mesh(catcherGeo, catcherMat);
    asmShadowCatcher.rotation.x = -Math.PI / 2;
    asmShadowCatcher.frustumCulled = false;
    asmScene.add(asmShadowCatcher);

    const facetMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color().setHex(0x8a8c8a, THREE.SRGBColorSpace),
        roughness: 0.42,
        metalness: 0.06,
        envMapIntensity: 0.44,
    });

    function resizeAsm() {
        const w = asmStage.clientWidth;
        const h = asmStage.clientHeight;
        if (w < 2 || h < 2) return;
        applyAsmPixelRatio();
        asmRenderer.setSize(w, h);
        asmCamera.aspect = w / h;
        applyAssemblyCameraViewportFov();
        const tlBusy = Boolean(asmBuildTL?.isActive?.());
        if (!tlBusy) {
            updateAssemblyCameraFit();
            if (assemblyMeshesRef?.length) {
                refreshAssemblyExplodedPositions(assemblyMeshesRef);
                updateAssemblyShadowCatcher();
            }
        }
    }
    resizeAsm();
    requestAnimationFrame(() => {
        requestAnimationFrame(() => resizeAsm());
    });
    window.addEventListener('resize', resizeAsm);
    if (typeof ResizeObserver !== 'undefined') {
        const asmResizeObserver = new ResizeObserver(() => resizeAsm());
        asmResizeObserver.observe(asmStage);
    }

    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath(DRACO_DECODER_URL);
    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    gltfLoader.load(
        assetModelUrl('bion.glb'),
        (gltf) => {
            void (async () => {
                asmCanvas?.classList.add('is-assembly-preparing');
                try {
                asmFallback?.setAttribute('hidden', '');

                const root = gltf.scene;
                root.traverse((c) => {
                    if (c.isMesh || c.isSkinnedMesh) {
                        c.material = facetMat.clone();
                    }
                });

                const box = new THREE.Box3().setFromObject(root);
                const size = box.getSize(new THREE.Vector3());
                const maxD = Math.max(size.x, size.y, size.z, 0.001);
                const scale = 2.38 / maxD;
                console.log(`[Assembly bion.glb] rawSize=(${size.x.toFixed(3)},${size.y.toFixed(3)},${size.z.toFixed(3)}) maxD=${maxD.toFixed(4)} scale=${scale.toFixed(6)}`);
                root.scale.setScalar(scale);

                box.setFromObject(root);
                const center = box.getCenter(new THREE.Vector3());
                root.position.sub(center);

                asmModelRoot.add(root);

                const refMeshes = [];
                root.updateMatrixWorld(true);
                asmModelRoot.updateMatrixWorld(true);
                root.traverse((c) => {
                    if ((c.isMesh || c.isSkinnedMesh) && c.geometry) refMeshes.push(c);
                });
                console.log(`[Assembly bion.glb] refMeshes: ${refMeshes.length}`);

                if (refMeshes.length === 0) {
                    asmCanvas?.classList.add('visually-hidden');
                    asmCanvas?.setAttribute('aria-hidden', 'true');
                    asmStage?.classList.add('has-static-fallback');
                    asmFallback?.removeAttribute('hidden');
                    asmFallback?.setAttribute('aria-hidden', 'false');
                    return;
                }

                let cubikC = new THREE.Box3().setFromObject(asmModelRoot).getCenter(new THREE.Vector3());
                console.log(`[Assembly] cubikCenter=(${cubikC.x.toFixed(4)},${cubikC.y.toFixed(4)},${cubikC.z.toFixed(4)})`);

                let meshes = refMeshes;
                console.log('%c[Assembly] Attempting mixed cube build...', 'color:cyan;font-weight:bold');
                console.log('[Assembly] sources config:', JSON.stringify(ASSEMBLY_MIXED_CUBE.sources));
                console.log('[Assembly] slots:', JSON.stringify(ASSEMBLY_MIXED_CUBE.slots.map(s => `${s.key}→${s.source}`)));
                try {
                    const cr = await assemblyTryBuildMixedCubeFromModels(
                        root,
                        refMeshes,
                        cubikC,
                        facetMat,
                        gltfLoader
                    );
                    meshes = cr.meshes;
                    console.log(`%c[Assembly] Mixed cube result: usedComposite=${cr.usedComposite}, meshes=${meshes.length}`, cr.usedComposite ? 'color:lime;font-weight:bold' : 'color:red;font-weight:bold');
                    asmModelRoot.updateMatrixWorld(true);
                    if (cr.usedComposite) {
                        assemblyRecenterRootContent(root);
                        asmModelRoot.updateMatrixWorld(true);
                        cubikC = new THREE.Box3().setFromObject(asmModelRoot).getCenter(new THREE.Vector3());
                    } else {
                        applyAssemblySlotColors(meshes, cubikC);
                    }
                } catch (err) {
                    console.error('%c[Assembly] build FAILED, fallback to bion only:', 'color:red;font-weight:bold', err);
                    meshes = refMeshes;
                    applyAssemblySlotColors(meshes, cubikC);
                }

                asmModelRoot.updateMatrixWorld(true);
                cubikC = new THREE.Box3().setFromObject(asmModelRoot).getCenter(new THREE.Vector3());
                assemblyApplyVoidMaterialToPlusYMeshes(asmModelRoot, cubikC);

                assemblySanitizeDrawables(asmModelRoot);
                assemblyApplyShadowFlags(asmModelRoot);

                meshes.forEach((m) => {
                    m.userData.assembledPos = m.position.clone();
                });

                asmModelRoot.updateMatrixWorld(true);
                const assembledSphere = new THREE.Box3()
                    .setFromObject(asmModelRoot)
                    .getBoundingSphere(new THREE.Sphere());
                asmModelRoot.userData.assembledBoundingRadius = assembledSphere.radius;

                const rAsm = assembledSphere.radius;
                const expandBase = Math.max(2.4, maxD * scale * 0.95);
                const expandW = Math.min(expandBase, Math.max(1.05, rAsm * 1.62));
                const explodeT = getAssemblyViewportAdaptT();
                const asmExplodeScale = THREE.MathUtils.lerp(1, ASM_EXPLODE_SCALE_MIN, explodeT);

                updateAssemblyCameraFit();
                asmScene.updateMatrixWorld(true);
                asmModelRoot.updateMatrixWorld(true);
                asmCamera.updateMatrixWorld(true);
                const camWorld = new THREE.Vector3();
                asmCamera.getWorldPosition(camWorld);
                const toCam = camWorld.clone().sub(cubikC);
                if (toCam.lengthSq() < 1e-12) toCam.set(0, 0, 1);
                else toCam.normalize();

                meshes.forEach((mesh, idx) => {
                    mesh.updateMatrixWorld(true);
                    const assembledWorld = new THREE.Vector3();
                    mesh.getWorldPosition(assembledWorld);

                    const fb = new THREE.Box3().setFromObject(mesh);
                    const facetCtr = fb.getCenter(new THREE.Vector3());

                    let dir = facetCtr.clone().sub(cubikC);
                    if (dir.lengthSq() < 1e-14) {
                        const ax = [
                            new THREE.Vector3(1, 0, 0),
                            new THREE.Vector3(-1, 0, 0),
                            new THREE.Vector3(0, 1, 0),
                            new THREE.Vector3(0, -1, 0),
                            new THREE.Vector3(0, 0, 1),
                            new THREE.Vector3(0, 0, -1),
                        ];
                        dir.copy(ax[idx % 6]);
                    } else {
                        dir.normalize();
                    }

                    const facing = dir.dot(toCam);
                    let mult = 1.42;
                    if (facing > 0.62) mult = 1.02;
                    else if (facing > 0.35) mult = 1.12;
                    else if (facing < -0.4) mult = 1.92;
                    else if (facing < -0.15) mult = 1.68;

                    mesh.userData.asmExplodeDir = dir.clone();
                    mesh.userData.asmExplodeLen = expandW * mult * ASM_ASSEMBLY_EXPLODE_LEN_SCALE;

                    const explodedWorldOrigin = assembledWorld
                        .clone()
                        .addScaledVector(dir, expandW * mult * asmExplodeScale);

                    mesh.parent.updateMatrixWorld(true);
                    const invParent = new THREE.Matrix4().copy(mesh.parent.matrixWorld).invert();
                    const explodedLocal = explodedWorldOrigin.clone().applyMatrix4(invParent);

                    mesh.position.copy(explodedLocal);
                    mesh.userData.explodedPos = mesh.position.clone();
                });

                meshes.forEach((m) => {
                    m.visible = false;
                });

                updateAssemblyCameraFit();
                updateAssemblyShadowCatcher();
                assemblyMacroPlan = buildAssemblyMacroPlan(meshes, asmModelRoot);

                assemblyMeshesRef = meshes;

                let asmPlayEnqueueRaf = null;
                /**
                 * Двойной rAF: после быстрой прокрутки isActive на один кадр может быть false при видимом stage.
                 * Проверяем и isActive, и геометрию — иначе onEnter сработал, а play отменился → белый холст.
                 */
                function assemblyShouldPlayNow() {
                    const stage = document.getElementById('assemblyStage');
                    return Boolean(stage && isStageInViewportCenterBand(stage));
                }

                function scheduleAssemblyPlayFromScroll() {
                    if (asmPlayEnqueueRaf != null) {
                        cancelAnimationFrame(asmPlayEnqueueRaf);
                        asmPlayEnqueueRaf = null;
                    }
                    const outerAsm = requestAnimationFrame(() => {
                        asmPlayEnqueueRaf = requestAnimationFrame(() => {
                            asmPlayEnqueueRaf = null;
                            if (!assemblyShouldPlayNow()) return;
                            playAssemblyBuild(meshes);
                        });
                    });
                    asmPlayEnqueueRaf = outerAsm;
                }

                cancelAssemblyScrollPlayRaf = () => {
                    if (asmPlayEnqueueRaf != null) {
                        cancelAnimationFrame(asmPlayEnqueueRaf);
                        asmPlayEnqueueRaf = null;
                    }
                };
                asmStageVisibilityReset = () => {
                    cancelAssemblyScrollPlayRaf();
                    resetAssemblyToExploded(meshes);
                };
                asmStageVisibilityPlay = () => scheduleAssemblyPlayFromScroll();
                {
                    const st = document.getElementById('assemblyStage');
                    asmPrevCenterBand = !!(st && isStageInViewportCenterBand(st));
                    if (asmPrevCenterBand) {
                        scheduleAssemblyPlayFromScroll();
                    }
                }
                /**
                 * Если модель догрузилась, когда пользователь уже в зоне секции, onEnter не сработает.
                 * Добавляем isAssemblyScrollRangeApprox + короткий слушатель scroll после загрузки.
                 */
                let assemblyPostLoadSyncRan = false;
                let assemblyScrollCleanup = null;
                function playAssemblyIfTriggerZoneActive() {
                    if (assemblyPostLoadSyncRan) return;
                    if (asmBuildTL?.isActive()) {
                        assemblyPostLoadSyncRan = true;
                        assemblyScrollCleanup?.();
                        assemblyScrollCleanup = null;
                        return;
                    }
                    const sec = document.getElementById('assembly');
                    const inZone =
                        isStageInViewportCenterBand(document.getElementById('assemblyStage')) ||
                        isAssemblyScrollRangeApprox(sec) ||
                        isSectionInPlayViewport(sec);
                    if (!inZone) return;
                    assemblyPostLoadSyncRan = true;
                    assemblyScrollCleanup?.();
                    assemblyScrollCleanup = null;
                    playAssemblyBuild(meshes);
                }
                requestAnimationFrame(() => {
                    ScrollTrigger.refresh();
                    playAssemblyIfTriggerZoneActive();
                    requestAnimationFrame(() => {
                        playAssemblyIfTriggerZoneActive();
                        setTimeout(playAssemblyIfTriggerZoneActive, 0);
                        setTimeout(playAssemblyIfTriggerZoneActive, 120);
                        setTimeout(playAssemblyIfTriggerZoneActive, 420);
                        setTimeout(playAssemblyIfTriggerZoneActive, 900);
                        setTimeout(playAssemblyIfTriggerZoneActive, 1800);
                    });
                });
                const assemblyScrollDeadline = performance.now() + 12000;
                const onAssemblyScrollSync = () => {
                    if (assemblyPostLoadSyncRan || performance.now() > assemblyScrollDeadline) {
                        window.removeEventListener('scroll', onAssemblyScrollSync, {
                            passive: true,
                        });
                        return;
                    }
                    playAssemblyIfTriggerZoneActive();
                };
                assemblyScrollCleanup = () =>
                    window.removeEventListener('scroll', onAssemblyScrollSync, { passive: true });
                window.addEventListener('scroll', onAssemblyScrollSync, { passive: true });
                setTimeout(() => {
                    assemblyScrollCleanup?.();
                    assemblyScrollCleanup = null;
                }, 12000);
                } finally {
                    asmCanvas?.classList.remove('is-assembly-preparing');
                    asmStage?.classList.add('is-ready');
                }
            })();
        },
        undefined,
        () => {
            asmCanvas?.classList.add('visually-hidden');
            asmCanvas?.setAttribute('aria-hidden', 'true');
            asmStage?.classList.add('has-static-fallback');
            asmFallback?.removeAttribute('hidden');
            asmFallback?.setAttribute('aria-hidden', 'false');
            asmStage?.classList.add('is-ready');
        }
    );
}

function replayAssemblyAnimation() {
    if (!assemblyMeshesRef?.length) return;
    resetAssemblyToExploded(assemblyMeshesRef);
    playAssemblyBuild(assemblyMeshesRef);
}

asmStage?.addEventListener('click', replayAssemblyAnimation);
asmStage?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    replayAssemblyAnimation();
});

// =============================================
// Construction — стенка 3×3 (Void / Bion / Zen) + клипсы clips.obj
// =============================================
const consCanvas = document.getElementById('constructionCanvas');
const consStage = document.getElementById('constructionStage');
const consFallback = document.getElementById('constructionFallback');

function mergeObjWorldGeometries(root) {
    const geoms = [];
    root.updateMatrixWorld(true);
    root.traverse((child) => {
        if (child.isMesh && child.geometry) {
            const g = child.geometry.clone();
            g.applyMatrix4(child.matrixWorld);
            geoms.push(g);
        }
    });
    if (geoms.length === 0) return null;
    return mergeGeometries(geoms, false);
}

/** Центрирует и тянет bbox до 1×1×1 по осям — соседние cubiks в сетке стык в стык без зазоров */
function normalizeObjectToUnitAxesBox(obj) {
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    obj.position.set(0, 0, 0);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const cx = Math.max(size.x, 1e-6);
    const cy = Math.max(size.y, 1e-6);
    const cz = Math.max(size.z, 1e-6);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    obj.updateMatrixWorld(true);
    obj.scale.set(1 / cx, 1 / cy, 1 / cz);
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj);
    const c2 = box2.getCenter(new THREE.Vector3());
    obj.position.sub(c2);
}

/**
 * Равномерный масштаб 1/max(size) — без разного масштаба по осям (иначе на Bion с normal map / рельефом — «рвёт» шейдинг).
 * Ячейка может быть чуть меньше 1 по отдельным осям, зато без искажений.
 */
function normalizeObjectToUnitUniformMax(obj) {
    obj.rotation.set(0, 0, 0);
    obj.scale.set(1, 1, 1);
    obj.position.set(0, 0, 0);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const maxD = Math.max(size.x, size.y, size.z, 1e-6);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.sub(center);
    obj.updateMatrixWorld(true);
    obj.scale.setScalar(1 / maxD);
    obj.updateMatrixWorld(true);
    const box2 = new THREE.Box3().setFromObject(obj);
    obj.position.sub(box2.getCenter(new THREE.Vector3()));
}

/** Как normalizeObjectToUnitAxesBox, но union bbox только по Mesh — для GLB с пустыми transform/helper у root */
function normalizeConstructionCubikToUnitBox(root) {
    root.rotation.set(0, 0, 0);
    root.scale.set(1, 1, 1);
    root.position.set(0, 0, 0);
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().makeEmpty();
    root.traverse((ch) => {
        if (ch.isMesh && ch.geometry) box.expandByObject(ch);
    });
    if (box.isEmpty()) {
        normalizeObjectToUnitAxesBox(root);
        return;
    }
    const size = box.getSize(new THREE.Vector3());
    const cx = Math.max(size.x, 1e-6);
    const cy = Math.max(size.y, 1e-6);
    const cz = Math.max(size.z, 1e-6);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);
    root.updateMatrixWorld(true);
    root.scale.set(1 / cx, 1 / cy, 1 / cz);
    root.updateMatrixWorld(true);
    const box2 = new THREE.Box3().makeEmpty();
    root.traverse((ch) => {
        if (ch.isMesh && ch.geometry) box2.expandByObject(ch);
    });
    if (!box2.isEmpty()) root.position.sub(box2.getCenter(new THREE.Vector3()));
}

/**
 * Совмещает union bbox мешей void.glb с bbox нормализованного void.obj — та же ячейка сетки, без ручных сдвигов.
 */
function alignVoidGlbMeshToObjReference(voidGlbRoot, voidObjRefNormalized) {
    voidGlbRoot.updateMatrixWorld(true);
    voidObjRefNormalized.updateMatrixWorld(true);
    const boxG = new THREE.Box3().makeEmpty();
    const boxR = new THREE.Box3().makeEmpty();
    voidGlbRoot.traverse((ch) => {
        if (ch.isMesh && ch.geometry) boxG.expandByObject(ch);
    });
    voidObjRefNormalized.traverse((ch) => {
        if (ch.isMesh && ch.geometry) boxR.expandByObject(ch);
    });
    if (boxG.isEmpty() || boxR.isEmpty()) return;
    const sizeG = boxG.getSize(new THREE.Vector3());
    const sizeR = boxR.getSize(new THREE.Vector3());
    voidGlbRoot.scale.multiply(
        new THREE.Vector3(
            sizeR.x / Math.max(sizeG.x, 1e-6),
            sizeR.y / Math.max(sizeG.y, 1e-6),
            sizeR.z / Math.max(sizeG.z, 1e-6)
        )
    );
    voidGlbRoot.updateMatrixWorld(true);
    boxG.makeEmpty();
    voidGlbRoot.traverse((ch) => {
        if (ch.isMesh && ch.geometry) boxG.expandByObject(ch);
    });
    const cG = boxG.getCenter(new THREE.Vector3());
    const cR = boxR.getCenter(new THREE.Vector3());
    voidGlbRoot.position.add(cR.clone().sub(cG));
}

/** Construction: общие PBR-параметры — кубики и клипсы */
const CONS_CUBIK_PBR_ENV_CLONE = 0.42;
const CONS_CUBIK_PBR_ENV_NEW = 0.48;
const CONS_CUBIK_PBR_ROUGH_NEW = 0.52;
const CONS_CUBIK_PBR_METAL_NEW = 0.06;

/**
 * Construction: PBR с IBL. hex — как в палитре (sRGB); Color.setHex уже переводит в рабочее пространство.
 * Низкий envMapIntensity — иначе отражения «перебивают» базовый цвет и он не совпадает с образцом.
 */
function applyCubikMaterial(obj, hex, envMap) {
    obj.traverse((child) => {
        if (!child.isMesh) return;
        const m = child.material;
        if (envMap && m && (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial)) {
            const mat = m.clone();
            mat.color.setHex(hex, THREE.SRGBColorSpace);
            mat.envMap = envMap;
            mat.envMapIntensity = CONS_CUBIK_PBR_ENV_CLONE;
            mat.roughness = THREE.MathUtils.clamp((mat.roughness ?? 0.5) * 0.92, 0.38, 0.78);
            mat.metalness = THREE.MathUtils.clamp(mat.metalness ?? 0.06, 0, 0.12);
            child.material = mat;
        } else {
            child.material = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHex(hex, THREE.SRGBColorSpace),
                roughness: CONS_CUBIK_PBR_ROUGH_NEW,
                metalness: CONS_CUBIK_PBR_METAL_NEW,
                envMap: envMap || null,
                envMapIntensity: envMap ? CONS_CUBIK_PBR_ENV_NEW : 0,
            });
        }
    });
}

function stripGltfLightsAndCameras(root) {
    const drop = [];
    root.traverse((o) => {
        if (o.isLight || o.isCamera) drop.push(o);
    });
    drop.forEach((o) => o.parent?.remove(o));
}

function initConstructionWall() {
    if (consRenderer || !consCanvas || !consStage) return;

    consScene = new THREE.Scene();
    consScene.background = new THREE.Color(0xffffff);

    consCamera = new THREE.PerspectiveCamera(38, 1, 0.06, 200);
    consCamera.position.set(0, 0.15, 6);

    consRenderer = createCompatWebGLRenderer({
        canvas: consCanvas,
        alpha: false,
    });
    if (!consRenderer.getContext()) {
        try {
            consRenderer.dispose();
        } catch {
            /* ignore */
        }
        consRenderer = null;
        consCanvas?.classList.add('visually-hidden');
        consCanvas?.setAttribute('aria-hidden', 'true');
        consStage?.classList.add('is-ready', 'has-static-fallback');
        document.getElementById('constructionLoader')?.classList.add('hidden');
        const fb = document.getElementById('constructionFallback');
        fb?.removeAttribute('hidden');
        fb?.setAttribute('aria-hidden', 'false');
        return;
    }
    function applyConsPixelRatio() {
        if (!consRenderer) return;
        const cap = window.matchMedia('(max-width: 768px)').matches ? 1.25 : 2;
        consRenderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
    }
    applyConsPixelRatio();
    consRenderer.setClearColor(0xffffff, 1);
    consRenderer.outputColorSpace = THREE.SRGBColorSpace;
    /** ACES сильно смещает оттенки относительно hex из палитры; Linear ближе к «как в макете» */
    consRenderer.toneMapping = THREE.LinearToneMapping;
    consRenderer.toneMappingExposure = 1.1;
    consRenderer.shadowMap.enabled = true;
    consRenderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const consPmrem = new THREE.PMREMGenerator(consRenderer);
    const consRoomEnv = new RoomEnvironment();
    const consEnvRt = consPmrem.fromScene(consRoomEnv, 0.04);
    consScene.environment = consEnvRt.texture;
    consRoomEnv.dispose();
    consPmrem.dispose();

    consScene.add(new THREE.AmbientLight(0xffffff, 0.22));
    consScene.add(new THREE.HemisphereLight(0xffffff, 0xb4b6bc, 0.48));

    const cDir = new THREE.DirectionalLight(0xffffff, 1.18);
    cDir.position.set(4.2, 9.2, 6.8);
    cDir.castShadow = true;
    const consMobilePerf = window.matchMedia('(max-width: 768px)').matches;
    cDir.shadow.mapSize.set(consMobilePerf ? 512 : 2048, consMobilePerf ? 512 : 2048);
    cDir.shadow.camera.near = 0.35;
    cDir.shadow.camera.far = 36;
    cDir.shadow.camera.left = -3.6;
    cDir.shadow.camera.right = 3.6;
    cDir.shadow.camera.top = 3.6;
    cDir.shadow.camera.bottom = -3.6;
    cDir.shadow.bias = -0.00038;
    cDir.shadow.normalBias = 0.048;
    consScene.add(cDir);

    const cFill = new THREE.DirectionalLight(0xf2f4f8, 0.36);
    cFill.position.set(-4.8, 3.4, -5.2);
    consScene.add(cFill);

    const cRim = new THREE.DirectionalLight(0xffffff, 0.26);
    cRim.position.set(0, 2.2, -8);
    consScene.add(cRim);

    consWallRoot = new THREE.Group();
    consWallRoot.rotation.order = 'YXZ';
    consScene.add(consWallRoot);

    function getConstructionCameraFitDistance(fovDeg) {
        if (!consWallRoot) return 6;
        consWallRoot.updateMatrixWorld(true);
        const r0 = consWallRoot.userData.assembledFitRadius;
        let r;
        if (r0 != null && isFinite(r0) && r0 > 0) {
            r = r0 * 1.22;
        } else {
            const box = new THREE.Box3().setFromObject(consWallRoot);
            if (box.isEmpty() || !isFinite(box.min.x)) return 6;
            const sp = box.getBoundingSphere(new THREE.Sphere());
            if (!isFinite(sp.radius) || sp.radius <= 0) return 6;
            r = sp.radius * 1.22;
        }
        const fov = fovDeg ?? consCamera?.fov ?? 38;
        const asp = Math.max(consCamera?.aspect ?? 1, 0.001);
        const vHalf = THREE.MathUtils.degToRad(fov * 0.5);
        const distV = r / Math.tan(vHalf);
        const distH = r / (Math.tan(vHalf) * asp);
        return Math.max(distV, distH, 0.5);
    }

    function updateConsCameraFit() {
        if (!consCamera || !consWallRoot) return;
        const dist = getConstructionCameraFitDistance();
        consCamera.position.set(0, 0.12, dist);
        consCamera.lookAt(0, 0, 0);
        consCamera.near = Math.max(0.02, dist * 0.02);
        consCamera.far = Math.max(200, dist * 4);
        consCamera.updateProjectionMatrix();
    }

    function resizeCons() {
        const w = consStage.clientWidth;
        const h = consStage.clientHeight;
        if (w < 2 || h < 2) return;
        applyConsPixelRatio();
        consRenderer.setSize(w, h);
        consCamera.aspect = w / h;
        consCamera.updateProjectionMatrix();
        if (!consWallRoot?.userData?.consClipMacroActive) {
            updateConsCameraFit();
        }
    }
    resizeCons();
    requestAnimationFrame(() => {
        requestAnimationFrame(() => resizeCons());
    });
    window.addEventListener('resize', resizeCons);
    if (typeof ResizeObserver !== 'undefined') {
        const consResizeObserver = new ResizeObserver(() => resizeCons());
        consResizeObserver.observe(consStage);
    }

    const loadObj = (url) =>
        new Promise((resolve, reject) => {
            objLoader.load(url, resolve, undefined, reject);
        });

    const consGltfLoader = new GLTFLoader();
    const consDracoLoader = new DRACOLoader();
    consDracoLoader.setDecoderPath(DRACO_DECODER_URL);
    consGltfLoader.setDRACOLoader(consDracoLoader);
    const loadConsGltf = (url) =>
        new Promise((resolve, reject) => {
            consGltfLoader.load(url, resolve, undefined, reject);
        });

    async function loadZenCubikRoot() {
        try {
            const gltf = await loadConsGltf(assetModelUrl('zen.glb'));
            const root = gltf.scene.clone(true);
            stripGltfLightsAndCameras(root);
            return root;
        } catch (err) {
            console.warn('Construction: zen.glb failed, using zen.obj', err);
            const o = await loadObj(assetModelUrl('zen.obj'));
            return o.clone(true);
        }
    }

    /** void.glb по геометрии совмещаем с нормализованным void.obj — позиция в сетке как у OBJ. */
    async function loadVoidTemplateForWall() {
        const voidObj = await loadObj(assetModelUrl('void.obj'));
        const voidRef = voidObj.clone(true);
        normalizeObjectToUnitAxesBox(voidRef);
        try {
            const gltf = await loadConsGltf(assetModelUrl('void.glb'));
            const voidT = gltf.scene.clone(true);
            stripGltfLightsAndCameras(voidT);
            normalizeConstructionCubikToUnitBox(voidT);
            alignVoidGlbMeshToObjReference(voidT, voidRef);
            return voidT;
        } catch (err) {
            console.warn('Construction: void.glb failed, using void.obj', err);
            return voidRef.clone(true);
        }
    }

    const GRID = [-1, 0, 1];
    const Z_CLIP_START = 1.45;
    const D_CUBIK_MOVE = 0.875;
    /** Клипсы: 0.5 с лёгким «набором» (отход от слота), затем короткая ускоренная посадка */
    const D_CLIP_BUILD = 0.5;
    /** Вставка в паз — ~в 2× дольше (скорость примерно на 50% ниже) */
    const D_CLIP_INSERT = 0.34;
    /** Первая фронтальная клипса: POV + сильное замедление у паза */
    const CONS_CLIP_MACRO_FOV = 43;
    const CONS_CAMERA_FOV_WIDE = consCamera.fov;
    const CONS_CLIP_MACRO_NUDGE_DUR = 0.2;
    const CONS_CLIP_MACRO_FAST_DUR = 1.05;
    const CONS_CLIP_MACRO_SLOW_DUR = 1.95;
    /** Пауза после полной посадки первой — затем отъезд и только остальные фронтальные клипсы */
    const CONS_PAUSE_AFTER_MACRO_SEATED = 0.38;
    const CONS_CLIP_PULLBACK_DUR = 1.55;
    /** Макро-клипса: смещение посадки относительно targetPos (+X вправо). Подгонка под паз — чуть левее расчёта */
    const CONS_MACRO_CLIP_SLOT_NUDGE_X = -0.0012;
    const CONS_MACRO_CLIP_SLOT_NUDGE_Y = -0.034;
    /** Доп. сдвиг макро-клипсы по Y (+ вверх, − вниз); не затрагивает остальные клипсы */
    const CONS_MACRO_CLIP_V_NUDGE = -0.008;
    /**
     * Смещение финальной Z макро-клипсы относительно tpM.z (+ — к камере, мельче; − — глубже в паз).
     * В clipPullT выставляем тот же tpM.z + bias, без щелчка наружу.
     */
    const CONS_MACRO_CLIP_Z_BIAS = -0.012;
    /** Базовый масштаб геометрии клипсы на стенке; итог: × CONS_CLIP_GLOBAL_SCALE_PERCENT / 100 */
    const CONS_CLIP_UNIFORM_SCALE = 0.765;
    /** 100 = как база; 110 = все клипсы на 10% крупнее (проценты от базового масштаба) */
    const CONS_CLIP_GLOBAL_SCALE_PERCENT = 102;
    const CONS_CLIP_SCALE = CONS_CLIP_UNIFORM_SCALE * (CONS_CLIP_GLOBAL_SCALE_PERCENT * 0.01);
    /**
     * Горизонтальные швы: фронт/спина — пары ближе к центру столбца по X; левый/правый торец — те же пары по Z к центру глубины стены.
     * Одно число для обоих (подбор, напр. 0.03). Макро — вертикальный клипс, не на этих рядах.
     */
    const CLIP_H_SEAM_PAIR_INSET = 0.032;
    /** Вертикальные швы на фронте/спине (x = ±STEP/2): пары по Y ближе к центру ряда */
    const CLIP_V_EDGE_PAIR_INSET = 0.032;
    const CLIP_BUILD_NUDGE = 0.07;
    const EASE_CLIP_BUILD = 'sine.inOut';
    const EASE_CLIP_INSERT = 'power4.in';
    /** Расстояние «разлёта» от слота — каждый cubik из своего направления */
    const EXPLODE_DIST = 2.35;
    const STAGGER_IN_ROW = 0.06;
    const ROW_GAP = 0.11;
    const PAUSE_BEFORE_CLIPS = 0.11;
    /** Стенка: упрощённые цвета сетки (не 1:1 с отделками каталога — там см. PALETTE_* в hero/assembly). */
    const CUBIK_VOID_WHITE = 0xf4f4f4;
    const CUBIK_ZEN_BEIGE = 0xe1b589;
    const CUBIK_GRAY = 0x7d7f7d;
    const CLIP_WHITE = 0xf4f4f4;

    /**
     * Поджатие крыльев по ширине — только макро-клипса (CONS_CLIP_MACRO_SLOW_DUR).
     * После rotClipUniform (π/2, π/2, 0) ширина в локальной Z.
     * Меньше значение → сильнее сжатие. 0.76 ≈ на 25% слабее прежнего 0.68 (глубина к 1).
     */
    const CLIP_LATERAL_SQUEEZE_MIN = 0.76;
    /** Доля медленной фазы посадки, за которую сжимаемся к минимуму */
    const CLIP_LATERAL_SQUEEZE_IN_FRAC = 0.42;

    function addClipBuildThenInsert(tl, mesh, tp, facet, startAt) {
        const p = mesh.position;
        if (facet === 'front') {
            tl.to(
                p,
                {
                    x: tp.x,
                    y: tp.y,
                    z: tp.z + Z_CLIP_START + CLIP_BUILD_NUDGE,
                    duration: D_CLIP_BUILD,
                    ease: EASE_CLIP_BUILD,
                },
                startAt
            );
            tl.to(
                p,
                { x: tp.x, y: tp.y, z: tp.z, duration: D_CLIP_INSERT, ease: EASE_CLIP_INSERT },
                startAt + D_CLIP_BUILD
            );
        } else if (facet === 'back') {
            tl.to(
                p,
                {
                    x: tp.x,
                    y: tp.y,
                    z: tp.z - Z_CLIP_START - CLIP_BUILD_NUDGE,
                    duration: D_CLIP_BUILD,
                    ease: EASE_CLIP_BUILD,
                },
                startAt
            );
            tl.to(
                p,
                { x: tp.x, y: tp.y, z: tp.z, duration: D_CLIP_INSERT, ease: EASE_CLIP_INSERT },
                startAt + D_CLIP_BUILD
            );
        } else if (facet === 'left') {
            tl.to(
                p,
                {
                    x: tp.x - Z_CLIP_START - CLIP_BUILD_NUDGE,
                    y: tp.y,
                    z: tp.z,
                    duration: D_CLIP_BUILD,
                    ease: EASE_CLIP_BUILD,
                },
                startAt
            );
            tl.to(
                p,
                { x: tp.x, y: tp.y, z: tp.z, duration: D_CLIP_INSERT, ease: EASE_CLIP_INSERT },
                startAt + D_CLIP_BUILD
            );
        } else if (facet === 'right') {
            tl.to(
                p,
                {
                    x: tp.x + Z_CLIP_START + CLIP_BUILD_NUDGE,
                    y: tp.y,
                    z: tp.z,
                    duration: D_CLIP_BUILD,
                    ease: EASE_CLIP_BUILD,
                },
                startAt
            );
            tl.to(
                p,
                { x: tp.x, y: tp.y, z: tp.z, duration: D_CLIP_INSERT, ease: EASE_CLIP_INSERT },
                startAt + D_CLIP_BUILD
            );
        }
    }

    (async () => {
        try {
            consStage?.classList.remove('is-ready');
            const [voidT, bionObj, zenRoot, clipsObj] = await Promise.all([
                loadVoidTemplateForWall(),
                loadObj(assetModelUrl('bion.obj')),
                loadZenCubikRoot(),
                loadObj(assetModelUrl('clips.obj')),
            ]);

            consFallback?.setAttribute('hidden', '');

            const consEnvTex = consScene.environment;
            const templates = new Map();
            const bionT = bionObj.clone(true);
            const zenT = zenRoot.clone(true);
            /** voidT: void.glb, выровнен под void.obj в loadVoidTemplateForWall. Bion — OBJ, равномерный масштаб (без артефактов нормалей). Zen — GLB по мешам. */
            normalizeObjectToUnitUniformMax(bionT);
            normalizeConstructionCubikToUnitBox(zenT);
            applyCubikMaterial(voidT, CUBIK_VOID_WHITE, consEnvTex);
            applyCubikMaterial(bionT, CUBIK_GRAY, consEnvTex);
            applyCubikMaterial(zenT, CUBIK_ZEN_BEIGE, consEnvTex);
            templates.set('void', voidT);
            templates.set('bion', bionT);
            templates.set('zen', zenT);

            /** После 1×1×1 все ячейки одинаковые */
            const STEP_X = 1;
            const STEP_Y = 1;

            const cubikRoots = [];

            function pickTemplate(iy) {
                if (iy === -1) return templates.get('void');
                if (iy === 0) return templates.get('bion');
                return templates.get('zen');
            }

            for (const iy of GRID) {
                const tpl = pickTemplate(iy);
                for (const ix of GRID) {
                    const cubik = tpl.clone(true);
                    const cubikTint =
                        iy === -1 ? CUBIK_VOID_WHITE : iy === 0 ? CUBIK_GRAY : CUBIK_ZEN_BEIGE;
                    cubik.traverse((ch) => {
                        if (ch.isMesh && ch.material) {
                            ch.material = ch.material.clone();
                            ch.material.color.setHex(cubikTint, THREE.SRGBColorSpace);
                        }
                    });
                    const ax = ix * STEP_X;
                    const ay = iy * STEP_Y;
                    cubik.userData.assembled = new THREE.Vector3(ax, ay, 0);
                    if (iy === -1) cubik.userData.assembled.y -= 0.5;
                    cubik.userData.ix = ix;
                    cubik.userData.iy = iy;
                    cubik.userData.sortY = cubik.userData.assembled.y;
                    cubik.userData.sortX = ax;
                    consWallRoot.add(cubik);
                    cubikRoots.push(cubik);
                }
            }

            /** Одна плоскость фасада: у Void/Bion/Zen разная геометрия — выравниваем по max Z */
            cubikRoots.forEach((c) => {
                c.position.copy(c.userData.assembled);
            });
            consWallRoot.updateMatrixWorld(true);
            let wallFrontZ = -Infinity;
            cubikRoots.forEach((c) => {
                const b = new THREE.Box3().setFromObject(c);
                wallFrontZ = Math.max(wallFrontZ, b.max.z);
            });
            cubikRoots.forEach((c) => {
                c.updateMatrixWorld(true);
                const b = new THREE.Box3().setFromObject(c);
                const dz = wallFrontZ - b.max.z;
                c.position.z += dz;
                c.userData.assembled.z += dz;
            });
            /** Стартовая позиция: каждый cubik — из своего угла (разные направления от слота) */
            /** Нижний ряд — снизу, верхний — сверху; средний — с заметным подъёмом снизу (как нижний), без «прыжка из ниоткуда» */
            const explodeDirs = [
                new THREE.Vector3(-1.15, -1.45, 0.95),
                new THREE.Vector3(0.05, -1.75, 1.05),
                new THREE.Vector3(1.15, -1.45, 0.95),
                new THREE.Vector3(-1.25, -1.38, 0.92),
                new THREE.Vector3(0.0, -1.48, 1.02),
                new THREE.Vector3(1.25, -1.38, 0.92),
                new THREE.Vector3(-1.15, 1.45, 0.95),
                new THREE.Vector3(0.05, 1.75, 1.05),
                new THREE.Vector3(1.15, 1.45, 0.95),
            ];
            cubikRoots.forEach((c) => {
                const ix = c.userData.ix;
                const iy = c.userData.iy;
                const idx = (iy + 1) * 3 + (ix + 1);
                const dir = explodeDirs[idx].clone().normalize().multiplyScalar(EXPLODE_DIST);
                c.userData.exploded = c.userData.assembled.clone().add(dir);
                c.position.copy(c.userData.exploded);
            });
            /**
             * Фронт стены и Z пазов — только из СОБРАННЫх позиций.
             * Раньше br здесь считали по «разлёту» → wallFrontZ раздувался, клипсы висели в стороне и не совпадали с пазами.
             */
            cubikRoots.forEach((c) => {
                c.position.copy(c.userData.assembled);
            });
            consWallRoot.updateMatrixWorld(true);
            let wallFrontZAssembled = -Infinity;
            let wallBackZAssembled = Infinity;
            let wallMinXAssembled = Infinity;
            let wallMaxXAssembled = -Infinity;
            cubikRoots.forEach((c) => {
                const b = new THREE.Box3().setFromObject(c);
                wallFrontZAssembled = Math.max(wallFrontZAssembled, b.max.z);
                wallBackZAssembled = Math.min(wallBackZAssembled, b.min.z);
                wallMinXAssembled = Math.min(wallMinXAssembled, b.min.x);
                wallMaxXAssembled = Math.max(wallMaxXAssembled, b.max.x);
            });
            cubikRoots.forEach((c) => {
                c.position.copy(c.userData.exploded);
            });
            consWallRoot.updateMatrixWorld(true);

            let clipGeom = mergeObjWorldGeometries(clipsObj);
            if (!clipGeom) {
                try {
                    clipGeom = mergeGeometries(
                        clipsObj.children
                            .filter((ch) => ch.isMesh && ch.geometry)
                            .map((ch) => ch.geometry.clone()),
                        false
                    );
                } catch {
                    clipGeom = null;
                }
            }
            if (!clipGeom) {
                clipGeom = new THREE.BoxGeometry(0.14, 0.05, 0.07);
            }

            const cb = new THREE.Box3().setFromBufferAttribute(clipGeom.attributes.position);
            const cs = cb.getSize(new THREE.Vector3());
            const maxClip = Math.max(cs.x, cs.y, cs.z, 0.001);
            const clipScale = 0.14 / maxClip;
            clipGeom.scale(clipScale, clipScale, clipScale);
            clipGeom.computeBoundingBox();
            clipGeom.center();
            clipGeom.computeBoundingSphere();

            const clipMatTemplate = new THREE.MeshStandardMaterial({
                color: new THREE.Color().setHex(CLIP_WHITE, THREE.SRGBColorSpace),
                roughness: CONS_CUBIK_PBR_ROUGH_NEW,
                metalness: CONS_CUBIK_PBR_METAL_NEW,
                envMap: consEnvTex,
                envMapIntensity: CONS_CUBIK_PBR_ENV_NEW,
                emissive: new THREE.Color(0x000000),
                emissiveIntensity: 0,
                polygonOffset: true,
                polygonOffsetFactor: -1,
                polygonOffsetUnits: -4,
            });

            const clipMeshes = [];
            const backClipMeshes = [];
            const leftClipMeshes = [];
            const rightClipMeshes = [];

            /** Глубже в паз: плоскость клипсы ближе к фасету cubik (ровнее с фасадом). */
            const zClipOnWall = wallFrontZAssembled - 0.028;
            const zClipOnWallBack = wallBackZAssembled + 0.028;
            /**
             * 24 клипса: по два гнезда на каждом внутреннем шве ячейки 1×1.
             * По инструкции cubiks — пазы на рёбрах; на стыке два cubiks дают общее гнездо.
             * Точки — на ¼ и ¾ длины ребра (не «угол ±0.38»), чтобы совпасть с разметкой пазов в модели.
             */
            const clipAlongEdge = Math.min(STEP_X, STEP_Y) * 0.25;
            /** Одна ориентация: клипса входит в стену фронтально (как в инструкции «Insert clip into the socket»). */
            const rotClipUniform = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(Math.PI / 2, Math.PI / 2, 0, 'XYZ')
            );
            /** Задний фасет: ось вставки и «верх» клипсы развернуты на 180° относительно фронта (вокруг Y). */
            const rotClipBack = new THREE.Quaternion()
                .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)
                .multiply(rotClipUniform.clone());
            /** Боковые фасеты: ±90° к фронту; только 4 клипсы — по одному пазу на каждый горизонтальный шов слева и справа. */
            const qClipRotLeft = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                -Math.PI / 2
            );
            const qClipRotRight = new THREE.Quaternion().setFromAxisAngle(
                new THREE.Vector3(0, 1, 0),
                Math.PI / 2
            );
            const rotClipLeft = qClipRotLeft.clone().multiply(rotClipUniform.clone());
            const rotClipRight = qClipRotRight.clone().multiply(rotClipUniform.clone());
            const CLIP_SIDE_INSET = 0.028;
            const zClipSideMid = (wallFrontZAssembled + wallBackZAssembled) * 0.5;
            const wallDepthZ = Math.max(wallFrontZAssembled - wallBackZAssembled, 0.08);
            const clipAlongZSide = wallDepthZ * 0.25;

            const fillClipTargets = (list, zPlane, quat) => {
                const push = (x, y) => {
                    list.push({
                        pos: new THREE.Vector3(x, y, zPlane),
                        quat: quat.clone(),
                    });
                };
                const vInset = CLIP_V_EDGE_PAIR_INSET;
                for (const iy of GRID) {
                    const yc = iy * STEP_Y;
                    push(-STEP_X / 2, yc - clipAlongEdge + vInset);
                    push(-STEP_X / 2, yc + clipAlongEdge - vInset);
                    push(STEP_X / 2, yc - clipAlongEdge + vInset);
                    push(STEP_X / 2, yc + clipAlongEdge - vInset);
                }
                const hInset = CLIP_H_SEAM_PAIR_INSET;
                for (const ix of GRID) {
                    const xc = ix * STEP_X;
                    push(xc - clipAlongEdge + hInset, -STEP_Y / 2);
                    push(xc + clipAlongEdge - hInset, -STEP_Y / 2);
                    push(xc - clipAlongEdge + hInset, STEP_Y / 2);
                    push(xc + clipAlongEdge - hInset, STEP_Y / 2);
                }
            };

            const frontTargets = [];
            const backTargets = [];
            const ySeamBottom = -STEP_Y / 2;
            const ySeamTop = STEP_Y / 2;
            const sideZInset = CLIP_H_SEAM_PAIR_INSET;
            const pushSideQuad = (list, xPlane, quatBase) => {
                const zm = zClipSideMid;
                const zh = clipAlongZSide;
                list.push(
                    {
                        pos: new THREE.Vector3(xPlane, ySeamBottom, zm - zh + sideZInset),
                        quat: quatBase.clone(),
                    },
                    {
                        pos: new THREE.Vector3(xPlane, ySeamBottom, zm + zh - sideZInset),
                        quat: quatBase.clone(),
                    },
                    {
                        pos: new THREE.Vector3(xPlane, ySeamTop, zm - zh + sideZInset),
                        quat: quatBase.clone(),
                    },
                    {
                        pos: new THREE.Vector3(xPlane, ySeamTop, zm + zh - sideZInset),
                        quat: quatBase.clone(),
                    }
                );
            };
            const leftTargets = [];
            const rightTargets = [];
            pushSideQuad(leftTargets, wallMinXAssembled + CLIP_SIDE_INSET, rotClipLeft);
            pushSideQuad(rightTargets, wallMaxXAssembled - CLIP_SIDE_INSET, rotClipRight);
            fillClipTargets(frontTargets, zClipOnWall, rotClipUniform);
            fillClipTargets(backTargets, zClipOnWallBack, rotClipBack);

            frontTargets.forEach((t, i) => {
                const m = new THREE.Mesh(clipGeom, clipMatTemplate.clone());
                m.name = `clip_front_${i}`;
                m.quaternion.copy(t.quat);
                m.userData.targetQuat = t.quat.clone();
                m.visible = false;
                m.position.set(t.pos.x, t.pos.y, t.pos.z + Z_CLIP_START);
                m.userData.targetPos = t.pos.clone();
                consWallRoot.add(m);
                clipMeshes.push(m);
            });

            backTargets.forEach((t, i) => {
                const m = new THREE.Mesh(clipGeom, clipMatTemplate.clone());
                m.name = `clip_back_${i}`;
                m.quaternion.copy(t.quat);
                m.userData.targetQuat = t.quat.clone();
                m.visible = false;
                m.position.set(t.pos.x, t.pos.y, t.pos.z - Z_CLIP_START);
                m.userData.targetPos = t.pos.clone();
                consWallRoot.add(m);
                backClipMeshes.push(m);
            });

            leftTargets.forEach((t, i) => {
                const m = new THREE.Mesh(clipGeom, clipMatTemplate.clone());
                m.name = `clip_left_${i}`;
                m.quaternion.copy(t.quat);
                m.userData.targetQuat = t.quat.clone();
                m.visible = false;
                m.position.set(t.pos.x - Z_CLIP_START, t.pos.y, t.pos.z);
                m.userData.targetPos = t.pos.clone();
                consWallRoot.add(m);
                leftClipMeshes.push(m);
            });

            rightTargets.forEach((t, i) => {
                const m = new THREE.Mesh(clipGeom, clipMatTemplate.clone());
                m.name = `clip_right_${i}`;
                m.quaternion.copy(t.quat);
                m.userData.targetQuat = t.quat.clone();
                m.visible = false;
                m.position.set(t.pos.x + Z_CLIP_START, t.pos.y, t.pos.z);
                m.userData.targetPos = t.pos.clone();
                consWallRoot.add(m);
                rightClipMeshes.push(m);
            });

            /** Центр вращения: сдвиг всей стенки, чтобы ось Y проходила через центр bbox cubiks */
            cubikRoots.forEach((c) => c.position.copy(c.userData.assembled));
            consWallRoot.updateMatrixWorld(true);
            const wallPivotBox = new THREE.Box3();
            cubikRoots.forEach((c) => {
                wallPivotBox.union(new THREE.Box3().setFromObject(c));
            });
            const wallPivotCenter = wallPivotBox.getCenter(new THREE.Vector3());
            cubikRoots.forEach((c) => {
                c.position.sub(wallPivotCenter);
                c.userData.assembled.sub(wallPivotCenter);
                c.userData.exploded.sub(wallPivotCenter);
            });
            const allWallClipMeshes = [
                ...clipMeshes,
                ...backClipMeshes,
                ...leftClipMeshes,
                ...rightClipMeshes,
            ];
            allWallClipMeshes.forEach((m) => {
                m.position.sub(wallPivotCenter);
                m.userData.targetPos.sub(wallPivotCenter);
                m.scale.setScalar(CONS_CLIP_SCALE);
            });

            function selectConstructionMacroClip(clips) {
                let topClipY = -Infinity;
                for (let ic = 0; ic < clips.length; ic++) {
                    topClipY = Math.max(topClipY, clips[ic].userData.targetPos.y);
                }
                let macro = clips[0];
                let bestX = -Infinity;
                for (let ic = 0; ic < clips.length; ic++) {
                    const cm = clips[ic];
                    const p0 = cm.userData.targetPos;
                    if (p0.y < topClipY - 0.002) continue;
                    if (p0.x > bestX) {
                        bestX = p0.x;
                        macro = cm;
                    }
                }
                return macro;
            }
            /** Макро не участвует в CLIP_V_EDGE_PAIR_INSET — возвращаем «верхнюю» Y пары + ручной nudge */
            {
                const m = selectConstructionMacroClip(clipMeshes);
                const tp = m.userData.targetPos;
                tp.y += CLIP_V_EDGE_PAIR_INSET + CONS_MACRO_CLIP_V_NUDGE;
                m.position.y += CLIP_V_EDGE_PAIR_INSET + CONS_MACRO_CLIP_V_NUDGE;
            }

            consWallRoot.traverse((o) => {
                if (o.isMesh) {
                    o.castShadow = true;
                    o.receiveShadow = true;
                }
            });

            function setCubikMeshesOpacity(cubik, alpha) {
                cubik.traverse((ch) => {
                    if (ch.isMesh && ch.material) {
                        const mat = ch.material;
                        mat.transparent = alpha < 0.999;
                        mat.opacity = alpha;
                    }
                });
            }

            function playBackClipFlyIn() {
                if (consBackClipTL) {
                    consBackClipTL.kill();
                    consBackClipTL = null;
                }
                consBackClipTL = gsap.timeline({
                    onComplete: () => {
                        consBackClipTL = null;
                        if (consWallRoot?.userData) consWallRoot.userData.consRotFastAfterBack = true;
                    },
                });
                backClipMeshes.forEach((m, i) => {
                    m.visible = true;
                    const tp = m.userData.targetPos;
                    addClipBuildThenInsert(consBackClipTL, m, tp, 'back', 0);
                });
            }

            function playLeftClipFlyIn() {
                if (consLeftClipTL) {
                    consLeftClipTL.kill();
                    consLeftClipTL = null;
                }
                consLeftClipTL = gsap.timeline({ onComplete: () => { consLeftClipTL = null; } });
                leftClipMeshes.forEach((m, i) => {
                    m.visible = true;
                    const tp = m.userData.targetPos;
                    addClipBuildThenInsert(consLeftClipTL, m, tp, 'left', 0);
                });
            }

            function playRightClipFlyIn() {
                if (consRightClipTL) {
                    consRightClipTL.kill();
                    consRightClipTL = null;
                }
                consRightClipTL = gsap.timeline({ onComplete: () => { consRightClipTL = null; } });
                rightClipMeshes.forEach((m, i) => {
                    m.visible = true;
                    const tp = m.userData.targetPos;
                    addClipBuildThenInsert(consRightClipTL, m, tp, 'right', 0);
                });
            }

            consWallRoot.userData.backClipMeshes = backClipMeshes;
            consWallRoot.userData.leftClipMeshes = leftClipMeshes;
            consWallRoot.userData.rightClipMeshes = rightClipMeshes;
            consWallRoot.userData.consIdleStartY = null;
            consWallRoot.userData.consLeftClipPlayed = false;
            consWallRoot.userData.consRightClipPlayed = false;
            consWallRoot.userData.consBackClipPlayed = false;
            consWallRoot.userData.consRotFastAfterBack = false;
            consWallRoot.userData.consClipMacroActive = false;
            consWallRoot.userData.macroClip = null;
            consWallRoot.userData.playBackClipFlyIn = playBackClipFlyIn;
            consWallRoot.userData.playLeftClipFlyIn = playLeftClipFlyIn;
            consWallRoot.userData.playRightClipFlyIn = playRightClipFlyIn;

            consAnimPayload = { cubikRoots, clipMeshes, backClipMeshes, leftClipMeshes, rightClipMeshes };

            function resetWallAnim() {
                if (consWallRoot) {
                    gsap.killTweensOf(consWallRoot.rotation);
                    consWallRoot.rotation.set(0, 0, 0);
                }
                if (consBuildTL) {
                    consBuildTL.kill();
                    consBuildTL = null;
                }
                if (consBackClipTL) {
                    consBackClipTL.kill();
                    consBackClipTL = null;
                }
                if (consLeftClipTL) {
                    consLeftClipTL.kill();
                    consLeftClipTL = null;
                }
                if (consRightClipTL) {
                    consRightClipTL.kill();
                    consRightClipTL = null;
                }
                consWallComplete = false;
                if (consWallRoot?.userData) {
                    consWallRoot.userData.consIdleStartY = null;
                    consWallRoot.userData.consLeftClipPlayed = false;
                    consWallRoot.userData.consRightClipPlayed = false;
                    consWallRoot.userData.consBackClipPlayed = false;
                    consWallRoot.userData.consRotFastAfterBack = false;
                    consWallRoot.userData.consClipMacroActive = false;
                    consWallRoot.userData.macroClip = null;
                }
                if (consCamera) {
                    gsap.killTweensOf(consCamera.position);
                    gsap.killTweensOf(consCamera);
                    consCamera.fov = CONS_CAMERA_FOV_WIDE;
                    consCamera.updateProjectionMatrix();
                    updateConsCameraFit();
                }
                [...clipMeshes, ...backClipMeshes, ...leftClipMeshes, ...rightClipMeshes].forEach((m) => {
                    gsap.killTweensOf(m.scale);
                    m.scale.setScalar(CONS_CLIP_SCALE);
                    const mat = m.material;
                    if (mat?.isMeshStandardMaterial) {
                        gsap.killTweensOf(mat);
                        mat.emissive.setHex(0x000000);
                        mat.emissiveIntensity = 0;
                        mat.roughness = CONS_CUBIK_PBR_ROUGH_NEW;
                        mat.metalness = CONS_CUBIK_PBR_METAL_NEW;
                        mat.envMapIntensity = CONS_CUBIK_PBR_ENV_NEW;
                    }
                });
                const firstRowIy = -1;
                cubikRoots.forEach((c) => {
                    c.traverse((ch) => {
                        if (ch.isMesh && ch.material) gsap.killTweensOf(ch.material);
                    });
                    c.position.copy(c.userData.exploded);
                    const isFirst = c.userData.iy === firstRowIy;
                    c.visible = isFirst;
                    setCubikMeshesOpacity(c, 0);
                });
                clipMeshes.forEach((m) => {
                    const tp = m.userData.targetPos;
                    m.visible = false;
                    m.position.set(tp.x, tp.y, tp.z + Z_CLIP_START);
                    if (m.userData.targetQuat) m.quaternion.copy(m.userData.targetQuat);
                });
                backClipMeshes.forEach((m) => {
                    const tp = m.userData.targetPos;
                    m.visible = false;
                    m.position.set(tp.x, tp.y, tp.z - Z_CLIP_START);
                    if (m.userData.targetQuat) m.quaternion.copy(m.userData.targetQuat);
                });
                leftClipMeshes.forEach((m) => {
                    const tp = m.userData.targetPos;
                    m.visible = false;
                    m.position.set(tp.x - Z_CLIP_START, tp.y, tp.z);
                    if (m.userData.targetQuat) m.quaternion.copy(m.userData.targetQuat);
                });
                rightClipMeshes.forEach((m) => {
                    const tp = m.userData.targetPos;
                    m.visible = false;
                    m.position.set(tp.x + Z_CLIP_START, tp.y, tp.z);
                    if (m.userData.targetQuat) m.quaternion.copy(m.userData.targetQuat);
                });
            }

            cubikRoots.forEach((c) => {
                c.position.copy(c.userData.assembled);
            });
            clipMeshes.forEach((m) => {
                const tp = m.userData.targetPos;
                m.position.set(tp.x, tp.y, tp.z);
            });
            backClipMeshes.forEach((m) => {
                const tp = m.userData.targetPos;
                m.position.set(tp.x, tp.y, tp.z);
                m.visible = true;
            });
            leftClipMeshes.forEach((m) => {
                const tp = m.userData.targetPos;
                m.position.set(tp.x, tp.y, tp.z);
                m.visible = true;
            });
            rightClipMeshes.forEach((m) => {
                const tp = m.userData.targetPos;
                m.position.set(tp.x, tp.y, tp.z);
                m.visible = true;
            });
            consWallRoot.updateMatrixWorld(true);
            const fitSph = new THREE.Box3().setFromObject(consWallRoot).getBoundingSphere(new THREE.Sphere());
            consWallRoot.userData.assembledFitRadius = fitSph.radius;

            backClipMeshes.forEach((m) => {
                m.visible = false;
                const tp = m.userData.targetPos;
                m.position.set(tp.x, tp.y, tp.z - Z_CLIP_START);
            });
            leftClipMeshes.forEach((m) => {
                m.visible = false;
                const tp = m.userData.targetPos;
                m.position.set(tp.x - Z_CLIP_START, tp.y, tp.z);
            });
            rightClipMeshes.forEach((m) => {
                m.visible = false;
                const tp = m.userData.targetPos;
                m.position.set(tp.x + Z_CLIP_START, tp.y, tp.z);
            });

            resetWallAnim();
            updateConsCameraFit();
            if (consRenderer?.compile) {
                consRenderer.compile(consScene, consCamera);
            }
            consRenderer.render(consScene, consCamera);
            consStage?.classList.add('is-ready');

            /** Сводит onEnter + refresh + fallback в один rAF — без двойного playWallAnim */
            let consPlayEnqueueRaf = null;

            function playWallAnim() {
                if (!consAnimPayload) return;
                if (consPlayEnqueueRaf != null) {
                    cancelAnimationFrame(consPlayEnqueueRaf);
                    consPlayEnqueueRaf = null;
                }
                resetWallAnim();
                const tl = gsap.timeline({
                    onComplete: () => {
                        consWallComplete = true;
                        consBuildTL = null;
                        updateConsCameraFit();
                        if (consWallRoot?.userData) {
                            consWallRoot.userData.consIdleStartY = consWallRoot.rotation.y;
                            consWallRoot.userData.consLeftClipPlayed = false;
                            consWallRoot.userData.consRightClipPlayed = false;
                            consWallRoot.userData.consBackClipPlayed = false;
                            consWallRoot.userData.consRotFastAfterBack = false;
                            consWallRoot.userData.consClipMacroActive = false;
                            consWallRoot.userData.macroClip = null;
                        }
                    },
                });
                consBuildTL = tl;
                const { cubikRoots: cubiks, clipMeshes: clips } = consAnimPayload;
                const rowOf = (iy) =>
                    cubiks
                        .filter((c) => c.userData.iy === iy)
                        .sort((a, b) => a.userData.sortX - b.userData.sortX);
                const rowOrder = [-1, 0, 1];
                let rowT = 0;
                rowOrder.forEach((iy) => {
                    const row = rowOf(iy);
                    tl.add(() => {
                        row.forEach((c) => {
                            c.visible = true;
                            setCubikMeshesOpacity(c, 0);
                            c.traverse((ch) => {
                                if (ch.isMesh && ch.material) {
                                    const m = ch.material;
                                    gsap.to(m, {
                                        opacity: 1,
                                        duration: D_CUBIK_MOVE * 0.92,
                                        ease: 'power2.out',
                                        overwrite: 'auto',
                                        onComplete: () => {
                                            m.transparent = false;
                                        },
                                    });
                                }
                            });
                        });
                    }, rowT);
                    row.forEach((c, i) => {
                        const p = c.userData.assembled;
                        tl.to(
                            c.position,
                            { x: p.x, y: p.y, z: p.z, duration: D_CUBIK_MOVE, ease: 'sine.inOut' },
                            rowT + i * STAGGER_IN_ROW
                        );
                    });
                    rowT += (row.length - 1) * STAGGER_IN_ROW + D_CUBIK_MOVE + ROW_GAP;
                });
                const cubikEnd = rowT - ROW_GAP;
                const clipPhaseStart = cubikEnd + PAUSE_BEFORE_CLIPS;
                /** Макро: верхний ярус (макс. Y), среди них — правый верхний (макс. X) */
                const macroClip = selectConstructionMacroClip(clips);
                if (consWallRoot.userData) {
                    consWallRoot.userData.macroClip = macroClip;
                }
                const macroSlowT0 =
                    clipPhaseStart + CONS_CLIP_MACRO_NUDGE_DUR + CONS_CLIP_MACRO_FAST_DUR;
                const macroClipSeatedT = macroSlowT0 + CONS_CLIP_MACRO_SLOW_DUR;
                const clipPullT = macroClipSeatedT + CONS_PAUSE_AFTER_MACRO_SEATED;
                const fitDistZ = getConstructionCameraFitDistance(CONS_CAMERA_FOV_WIDE);

                const tpM = macroClip.userData.targetPos;
                const pM = macroClip.position;
                const tpMx = tpM.x + CONS_MACRO_CLIP_SLOT_NUDGE_X;
                const tpMy = tpM.y + CONS_MACRO_CLIP_SLOT_NUDGE_Y;
                const zMacroSeat = tpM.z + CONS_MACRO_CLIP_Z_BIAS;

                tl.add(() => {
                    clips.forEach((m) => {
                        m.visible = m === macroClip;
                    });
                    if (consWallRoot.userData) {
                        consWallRoot.userData.consClipMacroActive = true;
                    }
                    pM.x = tpMx;
                    pM.y = tpMy;
                    macroClip.scale.setScalar(CONS_CLIP_SCALE);
                    consCamera.fov = CONS_CLIP_MACRO_FOV;
                    consCamera.updateProjectionMatrix();
                    updateConsCameraRideClip(macroClip);
                }, clipPhaseStart);

                tl.to(
                    pM,
                    {
                        x: tpMx,
                        y: tpMy,
                        z: tpM.z + Z_CLIP_START + CLIP_BUILD_NUDGE,
                        duration: CONS_CLIP_MACRO_NUDGE_DUR,
                        ease: 'sine.inOut',
                    },
                    clipPhaseStart
                );
                tl.to(
                    pM,
                    {
                        x: tpMx,
                        y: tpMy,
                        z: tpM.z + 0.065 + CONS_MACRO_CLIP_Z_BIAS * 0.35,
                        duration: CONS_CLIP_MACRO_FAST_DUR,
                        ease: 'power1.in',
                    },
                    clipPhaseStart + CONS_CLIP_MACRO_NUDGE_DUR
                );
                tl.to(
                    pM,
                    {
                        x: tpMx,
                        y: tpMy,
                        z: zMacroSeat,
                        duration: CONS_CLIP_MACRO_SLOW_DUR,
                        ease: 'power2.out',
                    },
                    macroSlowT0
                );

                const macroSqIn = CONS_CLIP_MACRO_SLOW_DUR * CLIP_LATERAL_SQUEEZE_IN_FRAC;
                const macroSqOut = Math.max(CONS_CLIP_MACRO_SLOW_DUR - macroSqIn, 0.001);
                const macroSqZMin = CONS_CLIP_SCALE * CLIP_LATERAL_SQUEEZE_MIN;
                tl.to(
                    macroClip.scale,
                    { z: macroSqZMin, duration: macroSqIn, ease: 'power2.in' },
                    macroSlowT0
                );
                tl.to(
                    macroClip.scale,
                    { z: CONS_CLIP_SCALE, duration: macroSqOut, ease: 'power2.out' },
                    macroSlowT0 + macroSqIn
                );

                tl.add(() => {
                    pM.z = tpM.z + CONS_MACRO_CLIP_Z_BIAS;
                    if (consWallRoot.userData) {
                        consWallRoot.userData.consClipMacroActive = false;
                    }
                    clips.forEach((m) => {
                        if (m !== macroClip) m.visible = true;
                    });
                }, clipPullT);

                tl.to(
                    consCamera.position,
                    {
                        x: 0,
                        y: 0.12,
                        z: fitDistZ,
                        duration: CONS_CLIP_PULLBACK_DUR,
                        ease: 'power2.inOut',
                        onUpdate: () => {
                            consCamera.lookAt(0, 0.02, 0);
                        },
                    },
                    clipPullT
                );
                const consFovTween = { f: CONS_CLIP_MACRO_FOV };
                tl.to(
                    consFovTween,
                    {
                        f: CONS_CAMERA_FOV_WIDE,
                        duration: CONS_CLIP_PULLBACK_DUR,
                        ease: 'power2.inOut',
                        onUpdate: () => {
                            consCamera.fov = consFovTween.f;
                            consCamera.updateProjectionMatrix();
                        },
                    },
                    clipPullT
                );

                clips.forEach((m) => {
                    if (m === macroClip) return;
                    const tp = m.userData.targetPos;
                    addClipBuildThenInsert(tl, m, tp, 'front', clipPullT);
                });
            }

            /** Цикл «полный оборот → перезапуск»: playWallAnim уже делает resetWallAnim в начале */
            consLoopRestartFn = () => {
                if (!consAnimPayload || !consConstructionVisible) return;
                playWallAnim();
            };

            /**
             * Блокируем только «угол снизу» при почти нулевом скролле (баннер + кусок блока без долистывания).
             * Не делаем один жёсткий порог по r.top — иначе onEnter срабатывает раньше, чем условие, и повторного onEnter нет → белый кадр.
             */
            function shouldAllowConstructionAutoplay() {
                if (window.location.hash === '#construction') return true;
                const stage = document.getElementById('constructionStage');
                if (!stage) return false;
                const r = stage.getBoundingClientRect();
                const vh = window.innerHeight || 1;
                if (window.scrollY < 20 && r.top > vh * 0.42) return false;
                return isStageScrollZoneApprox(stage);
            }

            let consScrollRetryRaf = null;
            function onConsWindowScrollRetry() {
                if (consScrollRetryRaf != null) return;
                consScrollRetryRaf = requestAnimationFrame(() => {
                    consScrollRetryRaf = null;
                    syncConstructionIfStuck();
                });
            }

            /** Выход из зоны: стоп GSAP + сброс + кадр */
            function pauseConstructionSection() {
                if (consPlayEnqueueRaf != null) {
                    cancelAnimationFrame(consPlayEnqueueRaf);
                    consPlayEnqueueRaf = null;
                }
                consConstructionVisible = false;
                resetWallAnim();
                if (consRenderer && consScene && consCamera) {
                    consRenderer.render(consScene, consCamera);
                }
            }

            function constructionShouldPlayNow() {
                const stage = document.getElementById('constructionStage');
                return Boolean(stage && isStageInViewportCenterBand(stage));
            }

            function enqueueConstructionPlay() {
                if (consPlayEnqueueRaf != null) {
                    cancelAnimationFrame(consPlayEnqueueRaf);
                    consPlayEnqueueRaf = null;
                }
                const outerCons = requestAnimationFrame(() => {
                    consPlayEnqueueRaf = requestAnimationFrame(() => {
                        consPlayEnqueueRaf = null;
                        if (!constructionShouldPlayNow()) return;
                        playWallAnim();
                    });
                });
                consPlayEnqueueRaf = outerCons;
            }

            /**
             * После refresh (аккордеон, resize) пересчитать, не «зависла» ли сцена в сброшенном виде.
             */
            function syncConstructionIfStuck() {
                if (!shouldAllowConstructionAutoplay()) return;
                const stage = document.getElementById('constructionStage');
                if (!stage || !isStageInViewportCenterBand(stage)) return;
                consConstructionVisible = true;
                if (consBuildTL) return;
                if (consWallComplete) return;
                enqueueConstructionPlay();
            }

            consStageVisibilityPause = () => pauseConstructionSection();
            consStageVisibilityPlay = () => {
                consConstructionVisible = true;
                enqueueConstructionPlay();
            };

            {
                const cst = document.getElementById('constructionStage');
                consPrevCenterBand = !!(cst && isStageInViewportCenterBand(cst));
                consConstructionVisible = consPrevCenterBand;
                if (consPrevCenterBand) {
                    enqueueConstructionPlay();
                }
            }

            const consGlobalRefreshHandler = () => {
                syncConstructionIfStuck();
            };
            ScrollTrigger.addEventListener('refresh', consGlobalRefreshHandler);
            ScrollTrigger.addEventListener?.('scrollEnd', syncConstructionIfStuck);
            window.addEventListener('scroll', onConsWindowScrollRetry, { passive: true });

            requestAnimationFrame(() => {
                ScrollTrigger.refresh();
                requestAnimationFrame(() => {
                    ScrollTrigger.refresh();
                    syncConstructionIfStuck();
                });
            });
        } catch (e) {
            console.warn('Construction wall:', e);
            consLoopRestartFn = null;
            consCanvas?.classList.add('visually-hidden');
            consCanvas?.setAttribute('aria-hidden', 'true');
            consStage?.classList.add('has-static-fallback');
            consFallback?.removeAttribute('hidden');
            consFallback?.setAttribute('aria-hidden', 'false');
            consStage?.classList.add('is-ready');
        }
    })();
}

function scheduleHeavySectionInit(sectionId, initFn) {
    const el = document.getElementById(sectionId);
    if (!el) return;
    let ran = false;
    const run = () => {
        if (ran) return;
        ran = true;
        initFn();
    };
    if (window.location.hash === `#${sectionId}`) {
        run();
        return;
    }
    if (!('IntersectionObserver' in window)) {
        run();
        return;
    }
    const io = new IntersectionObserver(
        (entries) => {
            if (entries.some((e) => e.isIntersecting)) {
                run();
                io.disconnect();
            }
        },
        { rootMargin: '420px 0px', threshold: 0 }
    );
    io.observe(el);
}

scheduleHeavySectionInit('construction', initConstructionWall);
scheduleHeavySectionInit('assembly', initAssemblyViewer);

// =============================================
// Contact — mailto handoff (no fake POST)
// =============================================
(function initContactForm() {
    const form = document.getElementById('contactForm');
    const status = document.getElementById('contactFormStatus');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const firstName = String(fd.get('firstName') || '').trim();
        const lastName = String(fd.get('lastName') || '').trim();
        const phone = String(fd.get('phone') || '').trim();
        const email = String(fd.get('email') || '').trim();
        const company = String(fd.get('company') || '').trim();
        const country = String(fd.get('country') || '').trim();
        const message = String(fd.get('message') || '').trim();
        if (!firstName || !lastName || !phone || !email || !company || !country || !message) return;

        const fullName = `${firstName} ${lastName}`.trim();
        const subject = encodeURIComponent(`Qubik — заявка от ${fullName}`);
        const body = encodeURIComponent(
            `Имя: ${firstName}\nФамилия: ${lastName}\nТелефон: ${phone}\nEmail: ${email}\nКомпания: ${company}\nСтрана: ${country}\n\nСообщение:\n${message}\n`,
        );
        window.location.href = `mailto:hello@qubik.one?subject=${subject}&body=${body}`;
        if (status) {
            status.hidden = false;
            status.textContent =
                'Если почта не открылась — напишите на hello@qubik.one и продублируйте данные из формы.';
        }
        form.reset();
    });
})();

// =============================================
// Section titles entrance
// =============================================
gsap.utils.toArray('.section-title').forEach(t => {
    gsap.from(t, {
        opacity: 0, y: 50, duration: 0.45, ease: 'power2.out',
        scrollTrigger: { trigger: t, start: 'top 85%', once: true },
    });
});
gsap.utils.toArray('.section-sub').forEach(s => {
    gsap.from(s, {
        opacity: 0, y: 30, duration: 0.35, ease: 'power2.out',
        scrollTrigger: { trigger: s, start: 'top 88%', once: true },
    });
});
