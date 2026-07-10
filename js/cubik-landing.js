import { PRODUCTS, FACET_PRODUCTS, FAQ_ITEMS, TESTIMONIALS } from './landing-data.js';

function measureEmbedHeight() {
    const page = document.querySelector('body.landing-cubik > .page');
    const sections = document.querySelectorAll('.page__container > *');
    let bottom = 0;

    sections.forEach((section) => {
        const rect = section.getBoundingClientRect();
        bottom = Math.max(bottom, rect.bottom + window.scrollY);
    });

    if (page) {
        const pageRect = page.getBoundingClientRect();
        bottom = Math.max(bottom, pageRect.bottom + window.scrollY);
    }

    if (bottom < 320) {
        return Math.ceil(document.documentElement.scrollHeight);
    }

    return Math.ceil(bottom);
}

let embedResizeState = null;

function initEmbedMode() {
    const params = new URLSearchParams(window.location.search);
    const embedded = params.has('embed') || window.self !== window.top;
    if (!embedded) return;

    document.documentElement.classList.add('is-embed');
    document.body.classList.add('is-embed');

    let lastSent = 0;
    let timer = null;
    let sentCount = 0;

    const notifyHeight = () => {
        if (sentCount >= 2) return;
        const height = measureEmbedHeight();
        if (height < 800 || height > 12000 || Math.abs(height - lastSent) < 2) return;
        lastSent = height;
        sentCount += 1;
        window.parent.postMessage({ type: 'qubik-landing:resize', height }, '*');
    };

    const scheduleNotify = () => {
        clearTimeout(timer);
        timer = setTimeout(notifyHeight, 150);
    };

    embedResizeState = { scheduleNotify, notifyHeight };

    window.addEventListener('load', () => {
        scheduleNotify();
        setTimeout(notifyHeight, 500);
    });

    document.querySelectorAll('img, video').forEach((media) => {
        if (media.complete) return;
        media.addEventListener('load', scheduleNotify, { once: true });
        media.addEventListener('loadeddata', scheduleNotify, { once: true });
    });
}

function refreshEmbedHeight() {
    embedResizeState?.scheduleNotify();
}

initEmbedMode();

const swipers = [];

function assetUrl(path) {
    return path.split('/').map((part) => encodeURIComponent(part)).join('/');
}

function collectionSwiperOptions(root) {
    const section = root.closest('.collections');
    return {
        slidesPerView: 'auto',
        spaceBetween: 16,
        freeMode: {
            enabled: true,
            momentumRatio: 0.45,
            momentumVelocityRatio: 0.45,
        },
        watchOverflow: true,
        grabCursor: true,
        touchRatio: 1,
        touchAngle: 45,
        resistanceRatio: 0.65,
        longSwipesRatio: 0.35,
        navigation: {
            nextEl: section?.querySelector('.collections__nav .swiper-button-next') ?? null,
            prevEl: section?.querySelector('.collections__nav .swiper-button-prev') ?? null,
        },
        scrollbar: {
            el: root.querySelector('.swiper-scrollbar') ?? null,
            draggable: true,
            hide: false,
        },
        breakpoints: {
            480: { spaceBetween: 16 },
            768: { spaceBetween: 20 },
            1024: { spaceBetween: 24 },
            1920: { spaceBetween: 28 },
        },
    };
}

function buildCollectionSlide(item) {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';

    const link = document.createElement('a');
    link.className = 'collections__item';
    link.href = item.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';

    const imagesWrap = document.createElement('div');
    imagesWrap.className = 'collections__images';

    (item.images || []).slice(0, 2).forEach((src) => {
        const imgWrap = document.createElement('div');
        imgWrap.className = 'collections__image';
        const img = document.createElement('img');
        img.src = assetUrl(src);
        img.alt = item.name;
        img.loading = 'lazy';
        img.decoding = 'async';
        imgWrap.appendChild(img);
        imagesWrap.appendChild(imgWrap);
    });

    if (item.cubiks) {
        const counter = document.createElement('div');
        counter.className = 'collections__counter';
        counter.style.backgroundColor = '#B2E76A';
        counter.textContent = item.cubiks;
        imagesWrap.appendChild(counter);
    }

    const details = document.createElement('div');
    details.className = 'collections__details';

    const box1 = document.createElement('div');
    box1.className = 'collections__box';
    const subtitle = document.createElement('div');
    subtitle.className = 'collections__subtitle';
    subtitle.textContent = item.name;
    box1.appendChild(subtitle);

    const box2 = document.createElement('div');
    box2.className = 'collections__box';
    const price = document.createElement('div');
    price.className = 'collections__price';
    price.textContent = item.price;
    box2.appendChild(price);

    details.appendChild(box1);
    details.appendChild(box2);

    link.appendChild(imagesWrap);
    link.appendChild(details);
    slide.appendChild(link);
    return slide;
}

function buildTestimonialSlide(t) {
    const slide = document.createElement('div');
    slide.className = 'swiper-slide';

    const item = document.createElement('div');
    item.className = 'carousel__item';

    const head = document.createElement('div');
    head.className = 'd-flex align-items-center mb-4';

    const logoWrap = document.createElement('div');
    logoWrap.className = 'me-3';
    const logo = document.createElement('img');
    logo.className = 'carousel__logo';
    logo.src = assetUrl(t.companyLogo);
    logo.alt = t.company;
    logoWrap.appendChild(logo);

    const companyName = document.createElement('p');
    companyName.innerHTML = `<b>${t.company}</b>`;

    head.appendChild(logoWrap);
    head.appendChild(companyName);

    const quote = document.createElement('p');
    quote.className = 'mb-4';
    quote.textContent = t.quote;

    const foot = document.createElement('div');
    foot.className = 'd-flex align-items-center';

    const photoWrap = document.createElement('div');
    photoWrap.className = 'me-4';
    const photo = document.createElement('img');
    photo.className = 'carousel__image';
    photo.src = assetUrl(t.personPhoto);
    photo.alt = t.name;
    photoWrap.appendChild(photo);

    const who = document.createElement('div');
    const nameEl = document.createElement('p');
    nameEl.className = 'carousel__name mb-1';
    nameEl.innerHTML = `<b>${t.name}</b>`;
    const roleEl = document.createElement('p');
    roleEl.className = 'carousel__position';
    roleEl.textContent = t.role;
    who.appendChild(nameEl);
    who.appendChild(roleEl);

    foot.appendChild(photoWrap);
    foot.appendChild(who);

    item.appendChild(head);
    item.appendChild(quote);
    item.appendChild(foot);
    slide.appendChild(item);
    return slide;
}

function mountSwiperCollection(rootId, items) {
    const root = document.getElementById(rootId);
    if (!root || !items.length) return null;

    const wrapper = root.querySelector('.swiper-wrapper');
    if (!wrapper) return null;

    wrapper.replaceChildren();
    items.forEach((item) => wrapper.appendChild(buildCollectionSlide(item)));

    const instance = new Swiper(root, collectionSwiperOptions(root));
    swipers.push(instance);
    return instance;
}

function mountFaq() {
    const group = document.getElementById('faqCategories');
    if (!group) return;

    group.replaceChildren();
    FAQ_ITEMS.forEach((item) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'categories__item';

        const head = document.createElement('div');
        head.className = 'categories__head h4';
        head.textContent = item.q;
        const plus = document.createElement('div');
        plus.className = 'categories__plus';
        head.appendChild(plus);

        const body = document.createElement('div');
        body.className = 'categories__body';
        const p = document.createElement('p');
        p.textContent = item.a;
        body.appendChild(p);

        itemEl.appendChild(head);
        itemEl.appendChild(body);

        head.addEventListener('click', () => {
            const open = itemEl.classList.contains('active');
            group.querySelectorAll('.categories__item.active').forEach((el) => el.classList.remove('active'));
            if (!open) itemEl.classList.add('active');
        });

        group.appendChild(itemEl);
    });
}

function initHeadVideo() {
    const section = document.getElementById('headVideo');
    const v = section?.querySelector('.head-video-media, .cb-hv__media');
    if (!v || !section) return;

    v.muted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');

    let inView = false;
    const tryPlay = () => v.play().catch(() => {});

    const io = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                inView = entry.isIntersecting;
                if (inView) {
                    if (v.readyState >= 2) tryPlay();
                    else v.addEventListener('canplay', tryPlay, { once: true });
                } else {
                    v.pause();
                }
            });
        },
        { threshold: 0.22 }
    );
    io.observe(section);
}

function initNavBurger() {
    const burger = document.getElementById('navBurger');
    const nav = document.getElementById('navLinks');
    if (!burger || !nav) return;

    const close = () => {
        nav.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
    };

    burger.addEventListener('click', () => {
        const open = !nav.classList.contains('open');
        nav.classList.toggle('open', open);
        burger.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
    });

    nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));

    window.addEventListener('resize', () => {
        if (window.innerWidth >= 1024) close();
    });
}

function refreshAllSwipers() {
    swipers.forEach((s) => {
        try {
            s.update();
        } catch (e) {}
    });
}

mountSwiperCollection('swiperProducts', PRODUCTS);
mountSwiperCollection('swiperFacets', FACET_PRODUCTS);

const discoverSwiper = document.querySelector('.swiper-discover');
if (discoverSwiper) {
    const discoverInstance = new Swiper(discoverSwiper, {
        effect: 'fade',
        fadeEffect: { crossFade: true },
        allowTouchMove: false,
        speed: 600,
    });
    swipers.push(discoverInstance);
}

const testimonialsRoot = document.getElementById('swiperTestimonials');
if (testimonialsRoot) {
    const wrapper = testimonialsRoot.querySelector('.swiper-wrapper');
    wrapper?.replaceChildren();
    TESTIMONIALS.forEach((t) => wrapper?.appendChild(buildTestimonialSlide(t)));
    const testimonialsInstance = new Swiper(testimonialsRoot, collectionSwiperOptions(testimonialsRoot));
    swipers.push(testimonialsInstance);
}

let resizeTimer = null;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshAllSwipers, 120);
});

if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => refreshAllSwipers());
    document.querySelectorAll('.collections__wrapper, .swiper-collections').forEach((el) => ro.observe(el));
}

mountFaq();
initHeadVideo();
initNavBurger();
window.addEventListener('load', () => {
    setTimeout(refreshEmbedHeight, 300);
});
