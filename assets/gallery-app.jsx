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

function ThemeToggle({ theme, toggle }) {
  return (
    <button className="nav-btn nav-btn-right interactive" onClick={toggle} title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}>
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
}function GlowCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  useEffect(() => {
    if ('ontouchstart' in window) return;
    document.body.classList.add('hide-cursor');
    const dot = dotRef.current, ring = ringRef.current;
    let mx = -100, my = -100, rx = -100, ry = -100;
    const onMove = (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = 'translate(' + mx + 'px,' + my + 'px)'; };
    let raf;
    const tick = () => { rx += (mx - rx) * 0.12; ry += (my - ry) * 0.12; ring.style.transform = 'translate(' + rx + 'px,' + ry + 'px)'; raf = requestAnimationFrame(tick); };
    window.addEventListener('mousemove', onMove);
    tick();
    const hIn = () => { dot.classList.add('h'); ring.classList.add('h'); };
    const hOut = () => { dot.classList.remove('h'); ring.classList.remove('h'); };
    const bind = () => document.querySelectorAll('button,.gallery-card,.lb-nav,.lb-close').forEach(el => { el.addEventListener('mouseenter', hIn); el.addEventListener('mouseleave', hOut); });
    bind();
    const mo = new MutationObserver(bind);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { window.removeEventListener('mousemove', onMove); cancelAnimationFrame(raf); mo.disconnect(); document.body.classList.remove('hide-cursor'); };
  }, []);
  return React.createElement(React.Fragment, null,
    React.createElement('div', { ref: dotRef, className: 'cur-dot' }),
    React.createElement('div', { ref: ringRef, className: 'cur-ring' })
  );
}

function GalleryCard({ src, alt, index, onClick }) {
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const onMove = useCallback((e) => {
    const c = ref.current; if (!c) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.transform = 'perspective(800px) rotateY(' + ((x - 0.5) * 22) + 'deg) rotateX(' + ((y - 0.5) * -22) + 'deg) scale3d(1.04,1.04,1.04)';
    c.style.setProperty('--sx', (x * 100) + '%');
    c.style.setProperty('--sy', (y * 100) + '%');
  }, []);
  const onLeave = useCallback(() => { const c = ref.current; if (c) c.style.transform = ''; }, []);
  return (
    <div ref={ref} className="gallery-card" style={{'--d': (index % 25) * 40 + 'ms'}} onMouseMove={onMove} onMouseLeave={onLeave} onClick={() => loaded && onClick(index)}>
      <img src={src} alt={alt} loading="lazy" className={loaded ? 'ok' : ''} onLoad={() => setLoaded(true)} draggable="false" />
      {!loaded && <div className="shim" style={{position:'absolute', inset:0, height:'100%', padding:0}} />}
      <div className="shine" />
    </div>
  );
}

function Lightbox({ images, startIndex, onClose }) {
  const [idx, setIdx] = useState(startIndex);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
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
  const onBgMove = useCallback((e) => {
    setTilt({ x: (e.clientX / window.innerWidth - 0.5) * 10, y: (e.clientY / window.innerHeight - 0.5) * 10 });
  }, []);
  return (
    <div className={'lb' + (closing ? ' lb-out' : '')} onClick={doClose} onMouseMove={onBgMove}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const d = e.changedTouches[0].clientX - touchX.current; if (Math.abs(d) > 60) { d > 0 ? goP() : goN(); } }}>
      <div className="lb-wrap" onClick={e => e.stopPropagation()}>
        <img src={images[idx].src} alt={images[idx].id} className={ok ? 'lb-ok' : ''}
          style={{ transform: 'perspective(1200px) rotateY(' + tilt.x + 'deg) rotateX(' + (-tilt.y) + 'deg)' }}
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
  const { theme, toggle } = useTheme();
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
      <GlowCursor />
      <ThemeToggle theme={theme} toggle={toggle} />
      <a href="index.html" className="nav-btn nav-btn-left interactive" aria-label="Go Back" title="Back to Home">
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"></path><path d="M12 19l-7-7 7-7"></path></svg>
      </a>
      <div className="app">
        <header className="hdr">
          <h1>Image Gallery</h1>
          <p className="sub">{total.toLocaleString()} curated images</p>
        </header>
        <nav className="fbar">
          <button className={'fc' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All</button>
          {types.map(t => <button key={t} className={'fc' + (filter === t ? ' on' : '')} onClick={() => setFilter(t)}>{t.toUpperCase()} ({data[t].total})</button>)}
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
