/* No Man's Weather — Hide UI add-on: push the whole interface off-screen to watch the scene */
(function () {
  const q = s => document.querySelector(s);
  const snd = () => { try { Sfx.resume(); Sfx.whoosh(); } catch (e) {} };
  const hideBtn = document.createElement('button');
  hideBtn.className = 'hide-btn'; hideBtn.id = 'btnHide'; hideBtn.setAttribute('aria-label', 'Hide interface'); hideBtn.textContent = '▼';
  const cd = q('#cdPill'); if (cd) cd.insertAdjacentElement('afterend', hideBtn);
  const showBtn = document.createElement('button');
  showBtn.id = 'btnShow'; showBtn.setAttribute('aria-label', 'Show interface'); showBtn.innerHTML = '<span>▲</span>';
  document.body.appendChild(showBtn);
  let fadeT;
  function setHidden(h) {
    const app = q('#app'); if (!app) return;
    if (h) app.scrollTo({ top: 0 });
    app.classList.toggle('ui-hidden', h);
    showBtn.classList.toggle('on', h); showBtn.classList.remove('fade');
    const sl = q('#scanline'); if (sl) sl.style.display = h ? 'none' : '';
    const t = q('#toast'); if (t) t.style.visibility = h ? 'hidden' : '';
    clearTimeout(fadeT); if (h) fadeT = setTimeout(() => showBtn.classList.add('fade'), 4000);
    snd();
  }
  const press = el => { el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 160); };
  hideBtn.addEventListener('click', () => { press(hideBtn); setHidden(true); });
  showBtn.addEventListener('click', () => setHidden(false));
})();
