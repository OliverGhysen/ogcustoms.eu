(() => {
  "use strict";

  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("nav-toggle");
  const navLinks = document.getElementById("nav-links");

  // Nav scroll shadow
  const onScroll = () => {
    nav.classList.toggle("nav--scrolled", window.scrollY > 10);
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Mobile nav toggle
  navToggle.addEventListener("click", () => {
    navLinks.classList.toggle("nav__links--open");
  });

  // Close mobile nav on link click
  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("nav__links--open");
    });
  });

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

  // Gallery carousel arrows
  const carouselTrack = document.querySelector(".carousel__track");
  const prevBtn = document.getElementById("carousel-prev");
  const nextBtn = document.getElementById("carousel-next");
  if (carouselTrack && prevBtn && nextBtn) {
    const scrollAmount = () => carouselTrack.clientWidth * 0.8;
    prevBtn.addEventListener("click", () => {
      carouselTrack.scrollBy({ left: -scrollAmount(), behavior: "smooth" });
    });
    nextBtn.addEventListener("click", () => {
      carouselTrack.scrollBy({ left: scrollAmount(), behavior: "smooth" });
    });
  }

  // Gallery: load images straight from the images/gallery/ folder.
  // The folder is the single source of truth; files are shown in
  // alphabetical order (use numeric filename prefixes to control order).
  const galleryTrack = document.getElementById("carousel-track");
  if (galleryTrack) {
    const GITHUB_API =
      "https://api.github.com/repos/OliverGhysen/ogcustoms.eu/contents/images/gallery";
    const IMAGE_EXT = /\.(webp|png|jpe?g|avif)$/i;

    // Fallback list used only if the live folder listing can't be fetched
    // (e.g. GitHub API rate limit or a private repo).
    const FALLBACK = [
      "00_apwithhandle.webp",
      "01_ap_front.webp",
      "02_ap_logo_copy.webp",
      "03_ap_side_copy.webp",
      "04_ap_side2.webp",
      "10_mini_olive.webp",
      "11_mini_herp.webp",
      "12_mini_flat.webp",
      "13_mini_yellow.webp",
      "20_tall_red.webp",
      "21_tall_text2.webp",
      "22_tall_side.webp",
      "23_tall_text.webp",
      "24_tall_flat.webp",
      "25_tall_blqck.webp",
      "26_tall_purple.webp",
      "27_tall_white.webp",
      "30_trap_hero.webp",
      "31_trap_side.webp",
      "32_trap_flat.webp",
      "35_trap_clear.webp",
    ];

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
        img.src = `images/gallery/${encodeURIComponent(name)}`;
        img.alt = altFromName(name);
        img.loading = "lazy";
        item.appendChild(img);
        galleryTrack.appendChild(item);
        bindLightbox(img);
        observeFadeIn(item);
      });
    };

    fetch(GITHUB_API)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((files) => {
        const names = files
          .filter((f) => f.type === "file" && IMAGE_EXT.test(f.name))
          .map((f) => f.name)
          .sort((a, b) => a.localeCompare(b));
        renderGallery(names.length ? names : FALLBACK);
      })
      .catch(() => renderGallery(FALLBACK));
  }
})();
