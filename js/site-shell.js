(() => {
  'use strict';

  const inArticle = window.location.pathname.includes('/blog/');
  const root = inArticle ? '../' : '';
  const nav = document.querySelector('.navbar .nav-container');
  if (nav) {
    nav.innerHTML = `
      <a href="${root}index.html" class="nav-logo" aria-label="Model Prompt Lab home">
        <span class="shell-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="logo-text">MODEL PROMPT LAB</span>
      </a>
      <div class="nav-links" aria-label="Main navigation">
        <a href="${root}index.html#tool" class="nav-link">Prompt checker</a>
        <a href="${root}index.html#how-it-works" class="nav-link">How it works</a>
        <a href="${root}blog.html" class="nav-link" aria-current="page">Guides</a>
      </div>
      <div class="nav-actions"><a href="${root}index.html#tool" class="btn btn-primary btn-sm">Open checker</a></div>`;
  }

  document.querySelectorAll('.article-tag').forEach((tag) => {
    tag.textContent = tag.textContent.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').trim();
  });

  const article = document.querySelector('.article-body');
  if (article) {
    const notice = document.createElement('aside');
    notice.className = 'archive-notice';
    notice.innerHTML = `<strong>Guide archive</strong> This article preserves an earlier V8 search entry. Parameters and product behavior may have changed. <a href="${root}index.html#tool">Check a prompt against the current V8.2 rules →</a>`;
    article.prepend(notice);
  }

  const footer = document.querySelector('.footer .container');
  if (footer) {
    footer.innerHTML = `
      <div class="footer-shell">
        <div><strong>MODEL PROMPT LAB</strong><p>An independent prompt compatibility utility and archive of practical Midjourney guides.</p></div>
        <div><p>Midjourney™ is a trademark of Midjourney, Inc. This site is not endorsed by or affiliated with Midjourney, Inc.</p><a href="${root}index.html#tool">Prompt checker</a><a href="${root}blog.html">All guides</a></div>
      </div>`;
  }
})();
