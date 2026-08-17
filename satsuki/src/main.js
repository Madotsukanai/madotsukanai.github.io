// ==========================================================
// フッター年号（フッターが存在する場合のみ）
// ==========================================================
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear();
}

// ==========================================================
// モバイルナビ開閉
// ==========================================================
const navToggle = document.getElementById('nav-toggle');
const mainNav = document.getElementById('main-nav');

navToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('is-open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

mainNav.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// ==========================================================
// スクロールで要素をフェードイン表示
// ==========================================================
const revealTargets = document.querySelectorAll('.reveal');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if ('IntersectionObserver' in window && !prefersReducedMotion) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  revealTargets.forEach((el) => observer.observe(el));
} else {
  revealTargets.forEach((el) => el.classList.add('is-visible'));
}

// ==========================================================
// ヒーローのステータス行：タイピング風ローテーション
// ==========================================================
const statusMessages = [
  'building the next release',
  'compiling assets…',
  'fixing a physics bug',
  'writing patch notes',
];

const statusEl = document.getElementById('status-text');

if (statusEl && !prefersReducedMotion) {
  let messageIndex = 0;

  const rotateStatus = () => {
    messageIndex = (messageIndex + 1) % statusMessages.length;
    const nextMessage = statusMessages[messageIndex];
    typeMessage(nextMessage);
  };

  const typeMessage = (message) => {
    let charIndex = 0;
    statusEl.textContent = '';
    const interval = setInterval(() => {
      statusEl.textContent = message.slice(0, charIndex + 1);
      charIndex += 1;
      if (charIndex >= message.length) {
        clearInterval(interval);
        setTimeout(rotateStatus, 3200);
      }
    }, 38);
  };

  setTimeout(rotateStatus, 3200);
}
