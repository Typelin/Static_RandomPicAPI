/** @jsxRuntime classic */
const { useState, useEffect, useRef, useMemo, useCallback } = React;

function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('srp-theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('srp-theme', theme);
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  }, [theme]);

  const toggle = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  return { theme, toggle };
}

const translations = {
  tw: {
    back: "返回首頁",
    gallery: "視覺畫廊",
    gallerySub: "預覽所有高品質圖片資源",
    originalSource: "原始倉庫",
    all: "全部"
  },
  en: {
    back: "Back to Home",
    gallery: "Visual Gallery",
    gallerySub: "Preview all high-quality image resources",
    originalSource: "Original Source",
    all: "All"
  }
};

function useLanguage() {
  const [lang, setLang] = useState(localStorage.getItem('srp-lang') || 'tw');
  const t = translations[lang];
  const toggle = () => {
    const next = lang === 'tw' ? 'en' : 'tw';
    setLang(next);
    localStorage.setItem('srp-lang', next);
    window.dispatchEvent(new CustomEvent('langchange', { detail: next }));
  };
  useEffect(() => {
    const fn = e => setLang(e.detail);
    window.addEventListener('langchange', fn);
    return () => window.removeEventListener('langchange', fn);
  }, []);
  return { lang, t, toggle };
}

function LanguageToggle({ lang, toggle }) {
  return (
    <button className="nav-btn nav-btn-lang interactive" onClick={toggle} title="Switch Language">
      <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{lang === 'tw' ? 'EN' : '繁'}</span>
    </button>
  );
}

function ThemeToggle({ theme, toggle }) {
  return (
    <button className="nav-btn interactive" onClick={toggle} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}>
      {theme === 'dark' ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
      )}
    </button>
  );
}

function useWindowWidth() {
  const [w, setW] = useState(window.innerWidth);
  useEffect(() => {
    let t;
    const fn = () => { clearTimeout(t); t = setTimeout(() => setW(window.innerWidth), 100); };
    window.addEventListener('resize', fn);
    return () => { window.removeEventListener('resize', fn); clearTimeout(t); };
  }, []);
  return w;
}

/* ── Virtualized Gallery Card (only render when visible) ── */
function GalleryCard({ src, alt, index, onClick }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        io.disconnect();
      }
    }, { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} className="gallery-card" style={{'--d': (index % 20) * 30 + 'ms'}} onClick={() => loaded && onClick(index)}>
      {visible ? (
        <>
          <img src={src} alt={alt} loading="lazy" className={loaded ? 'ok' : ''} onLoad={() => setLoaded(true)} draggable="false" />
          {!loaded && <div className="shim" style={{position:'absolute', inset:0, height:'100%', padding:0}} />}
        </>
      ) : (
        <div className="shim" style={{position:'relative', width:'100%', paddingBottom: alt && alt.startsWith('v') ? '150%' : '66%'}} />
      )}
    </div>
  );
}

function Lightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const [closing, setClosing] = useState(false);
  const [ok, setOk] = useState(false);
  const touchX = useRef(0);
  const total = images.length;
  const goN = useCallback(() => { setIdx(i => (i + 1) % total); setOk(false); }, [total]);
  const goP = useCallback(() => { setIdx(i => (i - 1 + total) % total); setOk(false); }, [total]);
  const doClose = useCallback(() => { setClosing(true); setTimeout(onClose, 220); }, [onClose]);
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') doClose(); if (e.key === 'ArrowRight') goN(); if (e.key === 'ArrowLeft') goP(); };
    window.addEventListener('keydown', fn); return () => window.removeEventListener('keydown', fn);
  }, [doClose, goN, goP]);
  return (
    <div className={'lb' + (closing ? ' lb-out' : '')} onClick={doClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - touchX.current; if (Math.abs(d) > 60) { d > 0 ? goP() : goN(); } }}>
      <div className="lb-wrap" onClick={e => e.stopPropagation()}>
        <img src={images[idx].src} alt={images[idx].id} className={ok ? 'lb-ok' : ''}
          onLoad={() => setOk(true)} draggable="false" />
        {!ok && <div className="lb-spin" />}
      </div>
      <button className="lb-nav lb-prev" onClick={e => { e.stopPropagation(); goP(); }}>
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <button className="lb-nav lb-next" onClick={e => { e.stopPropagation(); goN(); }}>
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
      </button>
      <div className="lb-count">{idx + 1} / {total}</div>
      <button className="lb-close" onClick={e => { e.stopPropagation(); doClose(); }}>
        <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
  );
}

function App() {
  const { theme, toggle: toggleTheme } = useTheme();
  const { lang, t, toggle: toggleLang } = useLanguage();
  const [filter, setFilter] = useState('all');
  const [lbIdx, setLbIdx] = useState(null);
  const data = window.__GALLERY_DATA__;
  const types = Object.keys(data);
  const total = types.reduce((s, t) => s + data[t].total, 0);
  const w = useWindowWidth();

  const imgs = useMemo(() => {
    const vis = filter === 'all' ? types : [filter];
    const r = [];
    vis.forEach(t => data[t].images.forEach(img => r.push(img)));
    return r;
  }, [filter, data, types]);

  const columns = useMemo(() => {
    const cols = w > 1280 ? 4 : w > 860 ? 3 : w > 520 ? 2 : 1;
    const arr = Array.from({length: cols}, () => []);
    imgs.forEach((img, i) => arr[i % cols].push({ img, index: i }));
    return arr;
  }, [imgs, w]);

  return (
    <>
      <div className="nav-group-right">
        <LanguageToggle lang={lang} toggle={toggleLang} />
        <ThemeToggle theme={theme} toggle={toggleTheme} />
      </div>
      <div className="nav-group-left">
        <a href="index.html" className="nav-btn interactive" aria-label="Go Back" title={t.back}>
          <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
        </a>
      </div>
      <div className="app">
        <header className="hdr">
          <h1>{t.gallery}</h1>
          <p className="sub">{total.toLocaleString()} {t.gallerySub}</p>
        </header>
        <nav className="fbar">
          <button className={'fc' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>{t.all}</button>
          {types.map(tk => <button key={tk} className={'fc' + (filter === tk ? ' on' : '')} onClick={() => setFilter(tk)}>{tk.toUpperCase()} ({data[tk].total})</button>)}
        </nav>
        <div className="masonry-js" key={filter}>
          {columns.map((col, cIdx) => (
            <div key={cIdx} className="masonry-col">
              {col.map(item => <GalleryCard key={item.img.id} src={item.img.src} alt={item.img.id} index={item.index} onClick={setLbIdx} />)}
            </div>
          ))}
        </div>
      </div>
      {lbIdx !== null && <Lightbox images={imgs} startIndex={lbIdx} onClose={() => setLbIdx(null)} />}
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
