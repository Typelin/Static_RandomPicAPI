const { useState, useEffect, useRef, useCallback } = React;

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
function GlowCursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  useEffect(() => {
    let af;
    const pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const cur = { x: pos.x, y: pos.y };
    const onMove = e => { pos.x = e.clientX; pos.y = e.clientY; };
    const onHover = e => {
      const el = e.target.closest('a, button, .interactive');
      if(dotRef.current) dotRef.current.classList.toggle('h', !!el);
      if(ringRef.current) ringRef.current.classList.toggle('h', !!el);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseover', onHover);
    const loop = () => {
      cur.x += (pos.x - cur.x) * 0.16;
      cur.y += (pos.y - cur.y) * 0.16;
      if (dotRef.current) dotRef.current.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
      if (ringRef.current) ringRef.current.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
      af = requestAnimationFrame(loop);
    };
    loop();
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseover', onHover); cancelAnimationFrame(af); };
  }, []);
  return (
    <>
      <div ref={dotRef} className="cur-dot" />
      <div ref={ringRef} className="cur-ring" />
    </>
  );
}

function DemoCard({ type, label }) {
  const [displaySrc, setDisplaySrc] = useState('');
  const [pendingSrc, setPendingSrc] = useState('');
  const [isPreloading, setIsPreloading] = useState(false);
  const ref = useRef(null);
  
  const refresh = useCallback(() => {
    const next = `/ri/${type}/${Math.floor(Math.random() * window.__COUNTS__[type]) + 1}.webp?t=${Date.now()}`;
    setIsPreloading(true);
    setPendingSrc(next);
  }, [type]);

  useEffect(() => { refresh(); }, [refresh]);

  const onMove = useCallback((e) => {
    const c = ref.current; if (!c) return;
    const r = c.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    c.style.transform = 'perspective(800px) rotateY(' + ((x - 0.5) * 20) + 'deg) rotateX(' + ((y - 0.5) * -20) + 'deg) scale3d(1.02,1.02,1.02)';
    c.style.setProperty('--sx', (x * 100) + '%');
    c.style.setProperty('--sy', (y * 100) + '%');
  }, []);
  const onLeave = useCallback(() => { const c = ref.current; if (c) c.style.transform = ''; }, []);

  const handlePendingLoad = () => {
    setDisplaySrc(pendingSrc);
    setIsPreloading(false);
    setPendingSrc('');
  };

  const isVertical = type === 'v';
  const aspectRatio = isVertical ? '10/14' : '16/10';

  return (
    <div className="demo-card interactive" ref={ref} onMouseMove={onMove} onMouseLeave={onLeave}>
      <div className="demo-header">
        <h3>{label}</h3>
        <p className="code-hint"><code>Alt: "random:{type}"</code></p>
      </div>
      <div className="demo-img-box" onClick={refresh} style={{ aspectRatio, position: 'relative', overflow: 'hidden' }}>
        {/* Persistent Display Layer */}
        {displaySrc && (
          <img 
            src={displaySrc} 
            className="ok" 
            alt={label} 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        )}
        
        {/* Preload Layer (Invisible) */}
        {pendingSrc && (
          <img 
            src={pendingSrc} 
            onLoad={handlePendingLoad} 
            style={{ position: 'absolute', inset: 0, opacity: 0, pointerEvents: 'none' }} 
            alt="preloader" 
          />
        )}

        {/* Initial Loading Shim */}
        {!displaySrc && <div className="shim" />}
        
        {isPreloading && <div className="shim" style={{ opacity: 0.4 }} />}
        
        <div className="shine" />
        <div className="refresh-hint">Click to Re-roll</div>
      </div>
    </div>
  );
}

function HomeApp() {
  const { theme, toggle } = useTheme();

  return (
    <>
      <GlowCursor />
      <ThemeToggle theme={theme} toggle={toggle} />
      <div className="app flex-col">
        <header className="hero">
          <h1 className="hero-title">Static Random Pic <span>API</span></h1>
          <p className="hero-sub">A premium, highly-optimized image delivery service</p>
          <div className="hero-btns">
            <a href="gallery.html" className="btn-primary interactive">
              <span>View Gallery</span>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </a>
            <a href="https://github.com/typelin/Static_RandomPicAPI" target="_blank" className="btn-secondary interactive">
              <span>GitHub Core</span>
            </a>
          </div>
        </header>

        <section className="live-demo">
          <h2 className="section-title">Live API Demo</h2>
          <div className="demo-stack">
            <DemoCard type="h" label="Horizontal Pictures" />
            <div className="v-card-wrap">
              <DemoCard type="v" label="Vertical Pictures" />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
