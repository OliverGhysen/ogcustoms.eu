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

  document.querySelectorAll(".gallery__item img").forEach((img) => {
    img.addEventListener("click", () => {
      lightboxImg.src = img.src;
      lightboxImg.alt = img.alt;
      lightbox.classList.add("lightbox--active");
      document.body.style.overflow = "hidden";
    });
  });

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

  // Gallery collapse toggle
  const galleryGrid = document.getElementById("product-gallery");
  const galleryToggle = document.getElementById("gallery-toggle");
  if (galleryGrid && galleryToggle) {
    galleryToggle.addEventListener("click", () => {
      const collapsed = galleryGrid.classList.toggle("gallery__grid--collapsed");
      galleryToggle.textContent = collapsed ? "Show all" : "Show less";
    });
  }

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

  document
    .querySelectorAll(
      ".model-card, .feature, .gallery__item, .sizing__table, .buy__title"
    )
    .forEach((el) => {
      el.classList.add("fade-in");
      observer.observe(el);
    });
})();
