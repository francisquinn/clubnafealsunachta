let header: HTMLElement | null = null;
let hero: HTMLElement | null = null;
let scrolledClass = "cnf-header--scrolled";
let heroThreshold = 0;
let cleanup: (() => void) | null = null;

function updateHeaderState() {
  if (!header) return;

  const scrollY = window.scrollY;

  let shouldBeScrolled = false;

  if (hero) {
    // Use offsetHeight which is more reliable than getBoundingClientRect
    const heroBottom = hero.offsetTop + hero.offsetHeight;
    shouldBeScrolled = scrollY > heroBottom;
  } else {
    shouldBeScrolled = scrollY > heroThreshold;
  }

  if (shouldBeScrolled) {
    header.classList.add(scrolledClass);
  } else {
    header.classList.remove(scrolledClass);
  }
}

function onScroll() {
  // Use requestAnimationFrame to avoid layout thrashing
  requestAnimationFrame(updateHeaderState);
}

export function initHeaderScroll() {
  // Clean up any existing listener
  if (cleanup) {
    cleanup();
  }

  header = document.querySelector(".cnf-header");
  hero = document.getElementById("hero");

  if (!header) return;

  // Set initial hero threshold based on hero height if hero exists
  if (hero) {
    heroThreshold = hero.offsetHeight;
  } else {
    heroThreshold = 100; // default threshold
  }

  // Set initial state
  updateHeaderState();

  // Listen for scroll events
  window.addEventListener("scroll", onScroll, { passive: true });

  // Return cleanup function
  cleanup = () => {
    window.removeEventListener("scroll", onScroll);
  };

  return cleanup;
}

// Auto-initialize if in browser
if (typeof window !== "undefined") {
  // Defer to next tick to ensure DOM is ready
  setTimeout(initHeaderScroll, 0);
}