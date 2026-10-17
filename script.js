(() => {
  const body = document.body;
  const nav = document.getElementById('mainNav');
  const menuToggle = document.getElementById('menuToggle');
  const languageSwitch = document.getElementById('languageSwitch');
  const searchToggle = document.getElementById('searchToggle');
  const searchPanel = document.getElementById('searchPanel');
  const searchInput = document.getElementById('siteSearch');
  const searchFeedback = document.getElementById('searchFeedback');
  const toast = document.getElementById('toast');
  let language = localStorage.getItem('salmikkhang-language') || 'en';

  function applyLanguage(next) {
    language = next;
    body.classList.toggle('lang-bn', language === 'bn');
    document.documentElement.lang = language;
    document.querySelectorAll('[data-en][data-bn]').forEach(el => {
      const value = el.dataset[language];
      if (value !== undefined) el.innerHTML = value;
    });
    document.querySelectorAll('[data-placeholder-en][data-placeholder-bn]').forEach(el => {
      el.placeholder = el.dataset[`placeholder${language === 'bn' ? 'Bn' : 'En'}`];
    });
    languageSwitch.textContent = language === 'en' ? 'বাংলা' : 'English';
    languageSwitch.setAttribute('aria-label', language === 'en' ? 'Switch to Bangla' : 'Switch to English');
    document.title = language === 'bn' ? 'সালমিকখাং — গ্রাম যুব কমিউনিটি' : 'Salmikkhang — Village Youth Community';
    localStorage.setItem('salmikkhang-language', language);
  }

  languageSwitch.addEventListener('click', () => applyLanguage(language === 'en' ? 'bn' : 'en'));
  applyLanguage(language);

  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
  }));

  searchToggle.addEventListener('click', () => {
    searchPanel.hidden = !searchPanel.hidden;
    if (!searchPanel.hidden) searchInput.focus();
  });

  function runSearch() {
    const q = searchInput.value.trim().toLowerCase();
    document.querySelectorAll('.searchable').forEach(item => {
      const haystack = (item.innerText + ' ' + (item.dataset.search || '')).toLowerCase();
      item.classList.toggle('search-hidden', !!q && !haystack.includes(q));
    });
    if (!q) {
      searchFeedback.textContent = language === 'bn' ? 'খবর, অনুষ্ঠান ও উদ্যোগের তালিকা দেখানো হচ্ছে।' : 'Showing all news, events and projects.';
      return;
    }
    const count = [...document.querySelectorAll('.searchable')].filter(el => !el.classList.contains('search-hidden')).length;
    searchFeedback.textContent = language === 'bn' ? `${count}টি ফলাফল পাওয়া গেছে।` : `${count} result${count === 1 ? '' : 's'} found.`;
  }
  document.getElementById('searchGo').addEventListener('click', runSearch);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') runSearch(); });
  searchInput.addEventListener('input', () => { if (!searchInput.value.trim()) runSearch(); });

  document.querySelectorAll('.gallery-tile').forEach(tile => tile.addEventListener('click', () => {
    const lightbox = document.getElementById('lightbox');
    const image = document.getElementById('lightboxImage');
    image.src = tile.dataset.image;
    image.alt = tile.querySelector('img').alt;
    lightbox.hidden = false;
    document.getElementById('lightboxClose').focus();
  }));
  function closeLightbox() { document.getElementById('lightbox').hidden = true; document.getElementById('lightboxImage').src = ''; }
  document.getElementById('lightboxClose').addEventListener('click', closeLightbox);
  document.getElementById('lightbox').addEventListener('click', e => { if (e.target.id === 'lightbox') closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeLightbox(); searchPanel.hidden = true; } });

  document.getElementById('contactForm').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.currentTarget;
    const name = form.elements.name.value.trim();
    const contact = form.elements.contact.value.trim();
    const message = form.elements.message.value.trim();
    if (!name || !message) return;
    const subject = encodeURIComponent(`Salmikkhang website message from ${name}`);
    const bodyText = encodeURIComponent(`Name: ${name}\nContact: ${contact || 'Not provided'}\n\nMessage:\n${message}`);
    const feedback = document.getElementById('formFeedback');
    feedback.textContent = language === 'bn'
      ? 'এই ডেমোতে বার্তা সংরক্ষণ করা হয় না। প্রকৃত যোগাযোগের জন্য অ্যাডমিনের ইমেইল যুক্ত করতে হবে।'
      : 'This demo does not store messages. Connect an official email or backend to enable real submissions.';
    showToast(language === 'bn' ? 'ফর্মটি যাচাই করা হয়েছে; বার্তা পাঠাতে ব্যাকএন্ড লাগবে।' : 'Form validated; a backend is needed to send the message.');
    // An email destination is intentionally not invented. Connect a verified community address before launch.
  });

  document.getElementById('privacyLink').addEventListener('click', e => {
    e.preventDefault();
    showToast(language === 'bn' ? 'প্রকাশের আগে প্রকৃত গোপনীয়তা নীতি যোগ করতে হবে।' : 'Add the community’s real privacy policy before launch.');
  });
  document.getElementById('termsLink').addEventListener('click', e => {
    e.preventDefault();
    showToast(language === 'bn' ? 'প্রকাশের আগে ব্যবহারের শর্তাবলি যোগ করতে হবে।' : 'Add the community’s terms of use before launch.');
  });

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3400);
  }
  document.getElementById('year').textContent = new Date().getFullYear();

  const sections = [...document.querySelectorAll('main section[id]')];
  const links = [...nav.querySelectorAll('a')];
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          links.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`));
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(section => observer.observe(section));
  }

  const communityToggle = document.getElementById('communityMenuToggle');
  const communityMenu = document.getElementById('communityMenu');
  if (communityToggle && communityMenu) {
    communityToggle.addEventListener('click', () => {
      const open = communityMenu.hidden;
      communityMenu.hidden = !open;
      communityToggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.community-menu-wrap')) {
        communityMenu.hidden = true;
        communityToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }
})();
