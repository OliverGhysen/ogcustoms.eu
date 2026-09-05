(() => {
  "use strict";

  // Code-split the 3D viewer into its own module so non-3D pages (and the
  // initial homepage paint) stay light; it only spins up WebGL once the viewer
  // scrolls into view.
  if (document.getElementById("handle-viewer")) {
    void import("./handle-viewer.js").then((m) => m.initHandleViewer());
  }

  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("nav-toggle");
  const navLinks = document.getElementById("nav-links");

  // Nav scroll shadow
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("nav--scrolled", window.scrollY > 10);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // Mobile nav toggle
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      navLinks.classList.toggle("nav__links--open");
    });

    // Close mobile nav on link click
    navLinks.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("nav__links--open");
      });
    });
  }

  // Lightbox
  const lightbox = document.createElement("div");
  lightbox.className = "lightbox";
  lightbox.innerHTML = `
    <button class="lightbox__close" aria-label="Close">&times;</button>
    <img src="" alt="">
  `;
  document.body.appendChild(lightbox);

  const lightboxImg = lightbox.querySelector("img");

  const bindLightbox = (img) => {
    img.addEventListener("click", () => {
      if (!lightboxImg) return;
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add("lightbox--active");
      document.body.style.overflow = "hidden";
    });
  };

  document.querySelectorAll(".gallery__item img").forEach(bindLightbox);

  lightbox.addEventListener("click", () => {
    lightbox.classList.remove("lightbox--active");
    document.body.style.overflow = "";
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      lightbox.classList.remove("lightbox--active");
      document.body.style.overflow = "";
    }
  });

  // Fade-in on scroll
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );

  const observeFadeIn = (el) => {
    el.classList.add("fade-in");
    observer.observe(el);
  };

  document
    .querySelectorAll(
      ".model-card, .feature, .gallery__item, .sizing__table, .buy__title"
    )
    .forEach(observeFadeIn);

  // Gallery carousel: arrows, plus vertical-wheel → horizontal spin while the
  // pointer is over the picture row (not the whole page).
  const carousel = document.getElementById("product-gallery");
  const carouselTrack = document.querySelector(".carousel__track");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  if (carousel && carouselTrack && prevBtn && nextBtn) {
    const scrollAmount = () => carouselTrack.clientWidth * 0.8;
    prevBtn.addEventListener("click", () => {
      carouselTrack.scrollBy({ left: -scrollAmount(), behavior: "smooth" });
    });
    nextBtn.addEventListener("click", () => {
      carouselTrack.scrollBy({ left: scrollAmount(), behavior: "smooth" });
    });

    const wheelDelta = (e) => {
      const raw = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (e.deltaMode === 1) return raw * 16;
      if (e.deltaMode === 2) return raw * carouselTrack.clientWidth;
      return raw;
    };

    window.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey) return;
        const target = e.target;
        if (!(target instanceof Node) || !carousel.contains(target)) return;
        const max = carouselTrack.scrollWidth - carouselTrack.clientWidth;
        if (max <= 1) return;
        const dy = wheelDelta(e);
        if (dy === 0) return;
        const next = carouselTrack.scrollLeft + dy;
        if ((dy > 0 && carouselTrack.scrollLeft >= max - 0.5) || (dy < 0 && carouselTrack.scrollLeft <= 0.5)) {
          return;
        }
        e.preventDefault();
        carouselTrack.scrollLeft = Math.max(0, Math.min(max, next));
      },
      { passive: false, capture: true }
    );
  }

  // Gallery: read a static manifest (gallery.json) generated from the
  // images/gallery/ folder. The folder is the single source of truth;
  // files are shown in alphabetical order (use numeric filename prefixes to order).
  const galleryTrack = document.getElementById("carousel-track");
  if (galleryTrack) {
    const IMAGE_EXT = /\.(webp|png|jpe?g|avif)$/i;

    const altFromName = (name) => {
      const cleaned = name
        .replace(IMAGE_EXT, "")
        .replace(/^\d+[_-]?/, "")
        .replace(/[_-]+/g, " ")
        .trim();
      return cleaned ? `OGC handle - ${cleaned}` : "OGC handle";
    };

    const renderGallery = (names) => {
      galleryTrack.innerHTML = "";
      names.forEach((name) => {
        const item = document.createElement("div");
        item.className = "gallery__item";
        const img = document.createElement("img");
        img.src = `/images/gallery/${encodeURIComponent(name)}`;
        img.alt = altFromName(name);
        img.loading = "lazy";
        item.appendChild(img);
        galleryTrack.appendChild(item);
        bindLightbox(img);
        observeFadeIn(item);
      });
    };

    fetch("/gallery.json")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((names) => {
        if (Array.isArray(names)) renderGallery(names.filter((n) => typeof n === "string"));
      })
      .catch(() => {
        // No manifest (or fetch failed): leave the carousel empty rather than
        // depend on any external service.
      });
  }

  // ---- Reviews ----
  // Render approved reviews from a committed reviews.json snapshot. Stays hidden
  // entirely when empty (no fake/empty aggregate — honest, and avoids a bare
  // section on a new store).
  const escapeHtml = (s) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        }[c] ?? c)
    );

  const STAR_PATH =
    "M12 2.4l2.62 6.62 7.18.63-5.42 4.68 1.64 7.07L12 17.78 6.98 21.4l1.64-7.07-5.42-4.68 7.18-.63L12 2.4z";

  const starRow = (rating) => {
    const full = Math.round(rating);
    let out = "";
    for (let i = 1; i <= 5; i++) {
      const on = i <= full ? " star--on" : "";
      out += `<svg class="star${on}" viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg>`;
    }
    return out;
  };

  const fmtDate = (iso) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
  };

  async function loadReviews() {
    const empty = { reviews: [], aggregate: { average: 0, count: 0 } };
    try {
      const res = await fetch("/reviews.json");
      if (res.ok) return await res.json();
    } catch {
      // fall through to empty
    }
    return empty;
  }

  function renderReviewList(reviews) {
    const list = document.getElementById("reviews-list");
    if (!list) return;
    list.innerHTML = "";
    for (const r of reviews) {
      const card = document.createElement("article");
      card.className = "review-card";
      const photos = r.image_urls
        .map(
          (u) =>
            `<img class="review-card__photo" src="${encodeURI(u)}" alt="Customer photo of an OGC handle" loading="lazy">`
        )
        .join("");
      card.innerHTML = `
        <div class="review-card__head">
          <span class="review-card__stars" role="img" aria-label="${r.rating} out of 5 stars">${starRow(r.rating)}</span>
          ${r.verified ? '<span class="review-card__verified">Verified buyer</span>' : ""}
        </div>
        <div class="review-card__meta"><span class="review-card__name">${escapeHtml(r.first_name)}</span> &middot; ${fmtDate(r.date)}</div>
        <p class="review-card__text">${escapeHtml(r.text)}</p>
        ${photos ? `<div class="review-card__photos">${photos}</div>` : ""}`;
      list.appendChild(card);
      observeFadeIn(card);
      card
        .querySelectorAll(".review-card__photo")
        .forEach(bindLightbox);
    }
  }

  function emitReviewsJsonLd(data) {
    const ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "The OGC Handle",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: data.aggregate.average,
        reviewCount: data.aggregate.count,
        bestRating: 5,
      },
      review: data.reviews.slice(0, 20).map((r) => ({
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
        author: { "@type": "Person", name: r.first_name },
        datePublished: r.date,
        reviewBody: r.text,
      })),
    };
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.textContent = JSON.stringify(ld);
    document.head.appendChild(script);
  }

  async function initReviews() {
    const section = document.getElementById("reviews");
    if (!section) return;
    const data = await loadReviews();
    if (data.aggregate.count === 0) return; // stay hidden on a fresh store

    const agg = document.getElementById("reviews-aggregate");
    if (agg) {
      const n = data.aggregate.count;
      agg.innerHTML = `
        <span class="reviews__stars" aria-hidden="true">${starRow(data.aggregate.average)}</span>
        <span class="reviews__score">${data.aggregate.average.toFixed(1)}</span>
        <span class="reviews__count">${n} review${n === 1 ? "" : "s"}</span>`;
    }

    const filterEl = document.getElementById("reviews-filter");
    const sortEl = document.getElementById("reviews-sort");
    const apply = () => {
      let rows = data.reviews.slice();
      const f = filterEl?.value ?? "all";
      if (f !== "all") rows = rows.filter((r) => Math.round(r.rating) === Number(f));
      const s = sortEl?.value ?? "newest";
      rows.sort((a, b) => {
        if (s === "highest") return b.rating - a.rating;
        if (s === "lowest") return a.rating - b.rating;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
      renderReviewList(rows);
    };
    filterEl?.addEventListener("change", apply);
    sortEl?.addEventListener("change", apply);
    apply();

    emitReviewsJsonLd(data);
    section.removeAttribute("hidden");
    observeFadeIn(section);
  }

  void initReviews();
})();
