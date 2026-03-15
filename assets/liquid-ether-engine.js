/**
 * LiquidEther Engine — Vanilla Three.js (Zero React Dependency)
 * Ported from ReactBits LiquidEther component.
 * Usage:
 *   const engine = new LiquidEtherEngine(containerElement, { colors: [...] });
 *   // later:
 *   engine.dispose();
 */
(function (globalScope) {
  'use strict';

  // ── Shaders ──────────────────────────────────────────────
  const face_vert = `
    attribute vec3 position;
    uniform vec2 px;
    uniform vec2 boundarySpace;
    varying vec2 uv;
    precision highp float;
    void main(){
      vec3 pos = position;
      vec2 scale = 1.0 - boundarySpace * 2.0;
      pos.xy = pos.xy * scale;
      uv = vec2(0.5)+(pos.xy)*0.5;
      gl_Position = vec4(pos, 1.0);
    }
  `;

  const line_vert = `
    attribute vec3 position;
    uniform vec2 px;
    precision highp float;
    varying vec2 uv;
    void main(){
      vec3 pos = position;
      uv = 0.5 + pos.xy * 0.5;
      vec2 n = sign(pos.xy);
      pos.xy = abs(pos.xy) - px * 1.0;
      pos.xy *= n;
      gl_Position = vec4(pos, 1.0);
    }
  `;

  const mouse_vert = `
    precision highp float;
    attribute vec3 position;
    attribute vec2 uv;
    uniform vec2 center;
    uniform vec2 scale;
    uniform vec2 px;
    varying vec2 vUv;
    void main(){
      vec2 pos = position.xy * scale * 2.0 * px + center;
      vUv = uv;
      gl_Position = vec4(pos, 0.0, 1.0);
    }
  `;

  const advection_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform float dt;
    uniform bool isBFECC;
    uniform vec2 fboSize;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
      vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
      if(isBFECC == false){
        vec2 vel = texture2D(velocity, uv).xy;
        vec2 uv2 = uv - vel * dt * ratio;
        gl_FragColor = vec4(texture2D(velocity, uv2).xy, 0.0, 0.0);
      } else {
        vec2 spot_new = uv;
        vec2 vel_old = texture2D(velocity, uv).xy;
        vec2 spot_old = spot_new - vel_old * dt * ratio;
        vec2 vel_new1 = texture2D(velocity, spot_old).xy;
        vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
        vec2 error = spot_new2 - spot_new;
        vec2 spot_new3 = spot_new - error / 2.0;
        vec2 vel_2 = texture2D(velocity, spot_new3).xy;
        vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
        gl_FragColor = vec4(texture2D(velocity, spot_old2).xy, 0.0, 0.0);
      }
    }
  `;

  const color_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform sampler2D palette;
    uniform vec4 bgColor;
    varying vec2 uv;
    void main(){
      vec2 vel = texture2D(velocity, uv).xy;
      float lenv = clamp(length(vel), 0.0, 1.0);
      vec3 c = texture2D(palette, vec2(lenv, 0.5)).rgb;
      vec3 outRGB = mix(bgColor.rgb, c, lenv);
      float outA = mix(bgColor.a, 1.0, lenv);
      gl_FragColor = vec4(outRGB, outA);
    }
  `;

  const divergence_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform float dt;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
      float x0 = texture2D(velocity, uv-vec2(px.x, 0.0)).x;
      float x1 = texture2D(velocity, uv+vec2(px.x, 0.0)).x;
      float y0 = texture2D(velocity, uv-vec2(0.0, px.y)).y;
      float y1 = texture2D(velocity, uv+vec2(0.0, px.y)).y;
      gl_FragColor = vec4((x1 - x0 + y1 - y0) / 2.0 / dt);
    }
  `;

  const externalForce_frag = `
    precision highp float;
    uniform vec2 force;
    uniform vec2 center;
    uniform vec2 scale;
    uniform vec2 px;
    varying vec2 vUv;
    void main(){
      vec2 circle = (vUv - 0.5) * 2.0;
      float d = 1.0 - min(length(circle), 1.0);
      d *= d;
      gl_FragColor = vec4(force * d, 0.0, 1.0);
    }
  `;

  const poisson_frag = `
    precision highp float;
    uniform sampler2D pressure;
    uniform sampler2D divergence;
    uniform vec2 px;
    varying vec2 uv;
    void main(){
      float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r;
      float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r;
      float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r;
      float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r;
      float div = texture2D(divergence, uv).r;
      gl_FragColor = vec4((p0 + p1 + p2 + p3) / 4.0 - div);
    }
  `;

  const pressure_frag = `
    precision highp float;
    uniform sampler2D pressure;
    uniform sampler2D velocity;
    uniform vec2 px;
    uniform float dt;
    varying vec2 uv;
    void main(){
      float step = 1.0;
      float p0 = texture2D(pressure, uv + vec2(px.x * step, 0.0)).r;
      float p1 = texture2D(pressure, uv - vec2(px.x * step, 0.0)).r;
      float p2 = texture2D(pressure, uv + vec2(0.0, px.y * step)).r;
      float p3 = texture2D(pressure, uv - vec2(0.0, px.y * step)).r;
      vec2 v = texture2D(velocity, uv).xy;
      vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5;
      gl_FragColor = vec4(v - gradP * dt, 0.0, 1.0);
    }
  `;

  const viscous_frag = `
    precision highp float;
    uniform sampler2D velocity;
    uniform sampler2D velocity_new;
    uniform float v;
    uniform vec2 px;
    uniform float dt;
    varying vec2 uv;
    void main(){
      vec2 old = texture2D(velocity, uv).xy;
      vec2 new0 = texture2D(velocity_new, uv + vec2(px.x * 2.0, 0.0)).xy;
      vec2 new1 = texture2D(velocity_new, uv - vec2(px.x * 2.0, 0.0)).xy;
      vec2 new2 = texture2D(velocity_new, uv + vec2(0.0, px.y * 2.0)).xy;
      vec2 new3 = texture2D(velocity_new, uv - vec2(0.0, px.y * 2.0)).xy;
      vec2 newv = 4.0 * old + v * dt * (new0 + new1 + new2 + new3);
      newv /= 4.0 * (1.0 + v * dt);
      gl_FragColor = vec4(newv, 0.0, 0.0);
    }
  `;

  // ── Helper: Palette Texture ──
  function makePaletteTexture(stops) {
    var arr = (Array.isArray(stops) && stops.length > 0)
      ? (stops.length === 1 ? [stops[0], stops[0]] : stops)
      : ['#ffffff', '#ffffff'];
    var w = arr.length;
    var data = new Uint8Array(w * 4);
    for (var i = 0; i < w; i++) {
      var c = new THREE.Color(arr[i]);
      data[i * 4] = Math.round(c.r * 255);
      data[i * 4 + 1] = Math.round(c.g * 255);
      data[i * 4 + 2] = Math.round(c.b * 255);
      data[i * 4 + 3] = 255;
    }
    var tex = new THREE.DataTexture(data, w, 1, THREE.RGBAFormat);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;
    return tex;
  }

  // ── Common (renderer singleton) ──
  function CommonManager() {
    this.width = 0; this.height = 0; this.aspect = 1;
    this.pixelRatio = 1; this.time = 0; this.delta = 0;
    this.container = null; this.renderer = null; this.clock = null;
  }
  CommonManager.prototype.init = function (container) {
    this.container = container;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.resize();
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.autoClear = false;
    this.renderer.setClearColor(new THREE.Color(0x000000), 0);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    var el = this.renderer.domElement;
    el.style.width = '100%'; el.style.height = '100%'; el.style.display = 'block';
    el.style.position = 'absolute'; el.style.top = '0'; el.style.left = '0';
    this.clock = new THREE.Clock(); this.clock.start();
  };
  CommonManager.prototype.resize = function () {
    if (!this.container) return;
    var rect = this.container.getBoundingClientRect();
    this.width = Math.max(1, Math.floor(rect.width));
    this.height = Math.max(1, Math.floor(rect.height));
    this.aspect = this.width / this.height;
    if (this.renderer) this.renderer.setSize(this.width, this.height, false);
  };
  CommonManager.prototype.update = function () {
    this.delta = this.clock.getDelta();
    this.time += this.delta;
  };

  // ── Mouse Controller ──
  function MouseController() {
    this.mouseMoved = false;
    this.coords = new THREE.Vector2();
    this.coords_old = new THREE.Vector2();
    this.diff = new THREE.Vector2();
    this.timer = null; this.container = null;
    this.isHoverInside = false; this.hasUserControl = false;
    this.isAutoActive = false; this.autoIntensity = 2.0;
    this.takeoverActive = false; this.takeoverStartTime = 0;
    this.takeoverDuration = 0.25;
    this.takeoverFrom = new THREE.Vector2();
    this.takeoverTo = new THREE.Vector2();
    this.onInteract = null;
    this._onMouseMove = this._handleMouseMove.bind(this);
    this._onTouchStart = this._handleTouchStart.bind(this);
    this._onTouchMove = this._handleTouchMove.bind(this);
    this._onTouchEnd = this._handleTouchEnd.bind(this);
    this._onLeave = this._handleLeave.bind(this);
  }
  MouseController.prototype.init = function (container) {
    this.container = container;
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('touchstart', this._onTouchStart, { passive: true });
    window.addEventListener('touchmove', this._onTouchMove, { passive: true });
    window.addEventListener('touchend', this._onTouchEnd);
    document.addEventListener('mouseleave', this._onLeave);
  };
  MouseController.prototype.dispose = function () {
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('touchstart', this._onTouchStart);
    window.removeEventListener('touchmove', this._onTouchMove);
    window.removeEventListener('touchend', this._onTouchEnd);
    document.removeEventListener('mouseleave', this._onLeave);
    this.container = null;
  };
  MouseController.prototype._isInside = function (cx, cy) {
    if (!this.container) return false;
    var r = this.container.getBoundingClientRect();
    return cx >= r.left && cx <= r.right && cy >= r.top && cy <= r.bottom;
  };
  MouseController.prototype._setCoords = function (x, y) {
    if (!this.container) return;
    if (this.timer) clearTimeout(this.timer);
    var r = this.container.getBoundingClientRect();
    if (!r.width || !r.height) return;
    this.coords.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height * 2 - 1));
    this.mouseMoved = true;
    this.timer = setTimeout(function () { this.mouseMoved = false; }.bind(this), 100);
  };
  MouseController.prototype.setNormalized = function (nx, ny) {
    this.coords.set(nx, ny); this.mouseMoved = true;
  };
  MouseController.prototype._handleMouseMove = function (e) {
    this.isHoverInside = this._isInside(e.clientX, e.clientY);
    if (!this.isHoverInside) return;
    if (this.onInteract) this.onInteract();
    if (this.isAutoActive && !this.hasUserControl && !this.takeoverActive) {
      var r = this.container.getBoundingClientRect();
      if (!r.width || !r.height) return;
      this.takeoverFrom.copy(this.coords);
      this.takeoverTo.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height * 2 - 1));
      this.takeoverStartTime = performance.now();
      this.takeoverActive = true; this.hasUserControl = true; this.isAutoActive = false;
      return;
    }
    this._setCoords(e.clientX, e.clientY); this.hasUserControl = true;
  };
  MouseController.prototype._handleTouchStart = function (e) {
    if (e.touches.length !== 1) return;
    var t = e.touches[0];
    this.isHoverInside = this._isInside(t.clientX, t.clientY);
    if (!this.isHoverInside) return;
    if (this.onInteract) this.onInteract();
    this._setCoords(t.clientX, t.clientY); this.hasUserControl = true;
  };
  MouseController.prototype._handleTouchMove = function (e) {
    if (e.touches.length !== 1) return;
    var t = e.touches[0];
    this.isHoverInside = this._isInside(t.clientX, t.clientY);
    if (!this.isHoverInside) return;
    if (this.onInteract) this.onInteract();
    this._setCoords(t.clientX, t.clientY);
  };
  MouseController.prototype._handleTouchEnd = function () { this.isHoverInside = false; };
  MouseController.prototype._handleLeave = function () { this.isHoverInside = false; };
  MouseController.prototype.update = function () {
    if (this.takeoverActive) {
      var t = (performance.now() - this.takeoverStartTime) / (this.takeoverDuration * 1000);
      if (t >= 1) { this.takeoverActive = false; this.coords.copy(this.takeoverTo); this.coords_old.copy(this.coords); this.diff.set(0, 0); }
      else { var k = t * t * (3 - 2 * t); this.coords.copy(this.takeoverFrom).lerp(this.takeoverTo, k); }
    }
    this.diff.subVectors(this.coords, this.coords_old);
    this.coords_old.copy(this.coords);
    if (this.coords_old.x === 0 && this.coords_old.y === 0) this.diff.set(0, 0);
    if (this.isAutoActive && !this.takeoverActive) this.diff.multiplyScalar(this.autoIntensity);
  };

  // ── AutoDriver ──
  function AutoDriver(mouse, manager, opts) {
    this.mouse = mouse; this.manager = manager;
    this.enabled = opts.enabled; this.speed = opts.speed;
    this.resumeDelay = opts.resumeDelay || 1000;
    this.rampDurationMs = (opts.rampDuration || 0) * 1000;
    this.active = false;
    this.current = new THREE.Vector2(0, 0);
    this.target = new THREE.Vector2();
    this.lastTime = performance.now();
    this.activationTime = 0; this.margin = 0.2;
    this._dir = new THREE.Vector2();
    this.pickNewTarget();
  }
  AutoDriver.prototype.pickNewTarget = function () {
    this.target.set((Math.random() * 2 - 1) * (1 - this.margin), (Math.random() * 2 - 1) * (1 - this.margin));
  };
  AutoDriver.prototype.forceStop = function () { this.active = false; this.mouse.isAutoActive = false; };
  AutoDriver.prototype.update = function () {
    if (!this.enabled) return;
    var now = performance.now();
    if (now - this.manager.lastUserInteraction < this.resumeDelay) { if (this.active) this.forceStop(); return; }
    if (this.mouse.isHoverInside) { if (this.active) this.forceStop(); return; }
    if (!this.active) { this.active = true; this.current.copy(this.mouse.coords); this.lastTime = now; this.activationTime = now; }
    if (!this.active) return;
    this.mouse.isAutoActive = true;
    var dtSec = (now - this.lastTime) / 1000; this.lastTime = now;
    if (dtSec > 0.2) dtSec = 0.016;
    var dir = this._dir.subVectors(this.target, this.current);
    var dist = dir.length();
    if (dist < 0.01) { this.pickNewTarget(); return; }
    dir.normalize();
    var ramp = 1;
    if (this.rampDurationMs > 0) { var tt = Math.min(1, (now - this.activationTime) / this.rampDurationMs); ramp = tt * tt * (3 - 2 * tt); }
    this.current.addScaledVector(dir, Math.min(this.speed * dtSec * ramp, dist));
    this.mouse.setNormalized(this.current.x, this.current.y);
  };

  // ── ShaderPass ──
  function ShaderPass(props) {
    this.props = props || {};
    this.uniforms = this.props.material ? this.props.material.uniforms : null;
    this.scene = null; this.camera = null; this.material = null; this.geometry = null; this.plane = null;
  }
  ShaderPass.prototype.init = function (common) {
    this._common = common;
    this.scene = new THREE.Scene(); this.camera = new THREE.Camera();
    if (this.uniforms) {
      this.material = new THREE.RawShaderMaterial(this.props.material);
      this.geometry = new THREE.PlaneGeometry(2.0, 2.0);
      this.plane = new THREE.Mesh(this.geometry, this.material);
      this.scene.add(this.plane);
    }
  };
  ShaderPass.prototype.update = function () {
    this._common.renderer.setRenderTarget(this.props.output || null);
    this._common.renderer.render(this.scene, this.camera);
    this._common.renderer.setRenderTarget(null);
  };

  // ── Advection ──
  function Advection(common, simProps) {
    ShaderPass.call(this, {
      material: { vertexShader: face_vert, fragmentShader: advection_frag, uniforms: {
        boundarySpace: { value: simProps.cellScale }, px: { value: simProps.cellScale },
        fboSize: { value: simProps.fboSize }, velocity: { value: simProps.src.texture },
        dt: { value: simProps.dt }, isBFECC: { value: true }
      }}, output: simProps.dst
    });
    this.uniforms = this.props.material.uniforms;
    this.init(common);
    // boundary lines
    var verts = new Float32Array([-1,-1,0,-1,1,0,-1,1,0,1,1,0,1,1,0,1,-1,0,1,-1,0,-1,-1,0]);
    var bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    this.line = new THREE.LineSegments(bg, new THREE.RawShaderMaterial({ vertexShader: line_vert, fragmentShader: advection_frag, uniforms: this.uniforms }));
    this.scene.add(this.line);
  }
  Advection.prototype = Object.create(ShaderPass.prototype);
  Advection.prototype.run = function (dt, isBounce, BFECC) {
    this.uniforms.dt.value = dt; this.line.visible = isBounce; this.uniforms.isBFECC.value = BFECC;
    this.update();
  };

  // ── ExternalForce ──
  function ExternalForce(common, mouse, simProps) {
    ShaderPass.call(this, { output: simProps.dst });
    this._mouse = mouse;
    this.init(common);
    var mouseG = new THREE.PlaneGeometry(1, 1);
    var mouseM = new THREE.RawShaderMaterial({
      vertexShader: mouse_vert, fragmentShader: externalForce_frag,
      blending: THREE.AdditiveBlending, depthWrite: false,
      uniforms: { px: { value: simProps.cellScale }, force: { value: new THREE.Vector2() }, center: { value: new THREE.Vector2() }, scale: { value: new THREE.Vector2(simProps.cursor_size, simProps.cursor_size) } }
    });
    this.mouseMesh = new THREE.Mesh(mouseG, mouseM);
    this.scene.add(this.mouseMesh);
  }
  ExternalForce.prototype = Object.create(ShaderPass.prototype);
  ExternalForce.prototype.run = function (props) {
    var u = this.mouseMesh.material.uniforms;
    u.force.value.set((this._mouse.diff.x / 2) * props.mouse_force, (this._mouse.diff.y / 2) * props.mouse_force);
    var csX = props.cursor_size * props.cellScale.x, csY = props.cursor_size * props.cellScale.y;
    u.center.value.set(
      Math.min(Math.max(this._mouse.coords.x, -1 + csX + props.cellScale.x * 2), 1 - csX - props.cellScale.x * 2),
      Math.min(Math.max(this._mouse.coords.y, -1 + csY + props.cellScale.y * 2), 1 - csY - props.cellScale.y * 2)
    );
    u.scale.value.set(props.cursor_size, props.cursor_size);
    this.update();
  };

  // ── Viscous ──
  function Viscous(common, simProps) {
    ShaderPass.call(this, {
      material: { vertexShader: face_vert, fragmentShader: viscous_frag, uniforms: {
        boundarySpace: { value: simProps.boundarySpace }, velocity: { value: simProps.src.texture },
        velocity_new: { value: simProps.dst_.texture }, v: { value: simProps.viscous },
        px: { value: simProps.cellScale }, dt: { value: simProps.dt }
      }}, output: simProps.dst, output0: simProps.dst_, output1: simProps.dst
    });
    this.init(common);
  }
  Viscous.prototype = Object.create(ShaderPass.prototype);
  Viscous.prototype.run = function (viscous, iterations, dt) {
    var fi, fo; this.uniforms.v.value = viscous;
    for (var i = 0; i < iterations; i++) {
      fi = (i % 2 === 0) ? this.props.output0 : this.props.output1;
      fo = (i % 2 === 0) ? this.props.output1 : this.props.output0;
      this.uniforms.velocity_new.value = fi.texture; this.props.output = fo; this.uniforms.dt.value = dt; this.update();
    }
    return fo;
  };

  // ── Divergence ──
  function Divergence(common, simProps) {
    ShaderPass.call(this, {
      material: { vertexShader: face_vert, fragmentShader: divergence_frag, uniforms: {
        boundarySpace: { value: simProps.boundarySpace }, velocity: { value: simProps.src.texture },
        px: { value: simProps.cellScale }, dt: { value: simProps.dt }
      }}, output: simProps.dst
    });
    this.init(common);
  }
  Divergence.prototype = Object.create(ShaderPass.prototype);
  Divergence.prototype.run = function (vel) { this.uniforms.velocity.value = vel.texture; this.update(); };

  // ── Poisson ──
  function Poisson(common, simProps) {
    ShaderPass.call(this, {
      material: { vertexShader: face_vert, fragmentShader: poisson_frag, uniforms: {
        boundarySpace: { value: simProps.boundarySpace }, pressure: { value: simProps.dst_.texture },
        divergence: { value: simProps.src.texture }, px: { value: simProps.cellScale }
      }}, output: simProps.dst, output0: simProps.dst_, output1: simProps.dst
    });
    this.init(common);
  }
  Poisson.prototype = Object.create(ShaderPass.prototype);
  Poisson.prototype.run = function (iterations) {
    var pi, po;
    for (var i = 0; i < iterations; i++) {
      pi = (i % 2 === 0) ? this.props.output0 : this.props.output1;
      po = (i % 2 === 0) ? this.props.output1 : this.props.output0;
      this.uniforms.pressure.value = pi.texture; this.props.output = po; this.update();
    }
    return po;
  };

  // ── Pressure ──
  function Pressure(common, simProps) {
    ShaderPass.call(this, {
      material: { vertexShader: face_vert, fragmentShader: pressure_frag, uniforms: {
        boundarySpace: { value: simProps.boundarySpace }, pressure: { value: simProps.src_p.texture },
        velocity: { value: simProps.src_v.texture }, px: { value: simProps.cellScale }, dt: { value: simProps.dt }
      }}, output: simProps.dst
    });
    this.init(common);
  }
  Pressure.prototype = Object.create(ShaderPass.prototype);
  Pressure.prototype.run = function (vel, pressure) {
    this.uniforms.velocity.value = vel.texture; this.uniforms.pressure.value = pressure.texture; this.update();
  };

  // ── Simulation ──
  function Simulation(common, mouse, options) {
    this.common = common; this.mouse = mouse;
    this.options = Object.assign({
      iterations_poisson: 32, iterations_viscous: 32, mouse_force: 20,
      resolution: 0.5, cursor_size: 100, viscous: 30, isBounce: false,
      dt: 0.014, isViscous: false, BFECC: true
    }, options);
    this.fbos = {}; this.fboSize = new THREE.Vector2(); this.cellScale = new THREE.Vector2(); this.boundarySpace = new THREE.Vector2();
    this._init();
  }
  Simulation.prototype._init = function () {
    this._calcSize(); this._createFBOs(); this._createPasses();
  };
  Simulation.prototype._getFloatType = function () {
    return /(iPad|iPhone|iPod)/i.test(navigator.userAgent) ? THREE.HalfFloatType : THREE.FloatType;
  };
  Simulation.prototype._calcSize = function () {
    var w = Math.max(1, Math.round(this.options.resolution * this.common.width));
    var h = Math.max(1, Math.round(this.options.resolution * this.common.height));
    this.cellScale.set(1.0 / w, 1.0 / h); this.fboSize.set(w, h);
  };
  Simulation.prototype._createFBOs = function () {
    var type = this._getFloatType();
    var opts = { type: type, depthBuffer: false, stencilBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, wrapS: THREE.ClampToEdgeWrapping, wrapT: THREE.ClampToEdgeWrapping };
    var keys = ['vel_0', 'vel_1', 'vel_viscous0', 'vel_viscous1', 'div', 'pressure_0', 'pressure_1'];
    for (var i = 0; i < keys.length; i++) this.fbos[keys[i]] = new THREE.WebGLRenderTarget(this.fboSize.x, this.fboSize.y, opts);
  };
  Simulation.prototype._createPasses = function () {
    this.advection = new Advection(this.common, { cellScale: this.cellScale, fboSize: this.fboSize, dt: this.options.dt, src: this.fbos.vel_0, dst: this.fbos.vel_1 });
    this.externalForce = new ExternalForce(this.common, this.mouse, { cellScale: this.cellScale, cursor_size: this.options.cursor_size, dst: this.fbos.vel_1 });
    this.viscous = new Viscous(this.common, { cellScale: this.cellScale, boundarySpace: this.boundarySpace, viscous: this.options.viscous, src: this.fbos.vel_1, dst: this.fbos.vel_viscous1, dst_: this.fbos.vel_viscous0, dt: this.options.dt });
    this.divergence = new Divergence(this.common, { cellScale: this.cellScale, boundarySpace: this.boundarySpace, src: this.fbos.vel_viscous0, dst: this.fbos.div, dt: this.options.dt });
    this.poisson = new Poisson(this.common, { cellScale: this.cellScale, boundarySpace: this.boundarySpace, src: this.fbos.div, dst: this.fbos.pressure_1, dst_: this.fbos.pressure_0 });
    this.pressure = new Pressure(this.common, { cellScale: this.cellScale, boundarySpace: this.boundarySpace, src_p: this.fbos.pressure_0, src_v: this.fbos.vel_viscous0, dst: this.fbos.vel_0, dt: this.options.dt });
  };
  Simulation.prototype.resize = function () {
    this._calcSize();
    for (var k in this.fbos) this.fbos[k].setSize(this.fboSize.x, this.fboSize.y);
  };
  Simulation.prototype.update = function () {
    this.boundarySpace.copy(this.options.isBounce ? new THREE.Vector2(0, 0) : this.cellScale);
    this.advection.run(this.options.dt, this.options.isBounce, this.options.BFECC);
    this.externalForce.run({ cursor_size: this.options.cursor_size, mouse_force: this.options.mouse_force, cellScale: this.cellScale });
    var vel = this.fbos.vel_1;
    if (this.options.isViscous) vel = this.viscous.run(this.options.viscous, this.options.iterations_viscous, this.options.dt);
    this.divergence.run(vel);
    var pres = this.poisson.run(this.options.iterations_poisson);
    this.pressure.run(vel, pres);
  };

  // ── Output (final render) ──
  function OutputRenderer(common, simulation, paletteTex, bgVec4) {
    this.common = common; this.simulation = simulation;
    this.scene = new THREE.Scene(); this.camera = new THREE.Camera();
    this.output = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.RawShaderMaterial({
        vertexShader: face_vert, fragmentShader: color_frag, transparent: true, depthWrite: false,
        uniforms: { velocity: { value: simulation.fbos.vel_0.texture }, boundarySpace: { value: new THREE.Vector2() }, palette: { value: paletteTex }, bgColor: { value: bgVec4 } }
      })
    );
    this.scene.add(this.output);
  }
  OutputRenderer.prototype.resize = function () { this.simulation.resize(); };
  OutputRenderer.prototype.render = function () {
    this.common.renderer.setRenderTarget(null);
    this.common.renderer.render(this.scene, this.camera);
  };
  OutputRenderer.prototype.update = function () { this.simulation.update(); this.render(); };

  // ── Main Engine ──
  function LiquidEtherEngine(container, opts) {
    opts = opts || {};
    this.originalColors = opts.colors || ['#5227FF', '#FF9FFC', '#B19EEF'];
    this._colors = [...this.originalColors];
    this._autoDemo = opts.autoDemo !== undefined ? opts.autoDemo : true;
    this._autoSpeed = opts.autoSpeed || 0.5;
    this._autoIntensity = opts.autoIntensity || 2.2;
    this._autoResumeDelay = opts.autoResumeDelay || 1000;
    this._autoRampDuration = opts.autoRampDuration || 0.6;
    this._takeoverDuration = opts.takeoverDuration || 0.25;

    this._container = container;
    container.style.position = 'fixed';
    container.style.inset = '0';
    container.style.overflow = 'hidden';
    container.style.zIndex = '0';

    this._common = new CommonManager();
    this._common.init(container);
    container.appendChild(this._common.renderer.domElement);

    this._mouse = new MouseController();
    this._mouse.init(container);
    this._mouse.autoIntensity = this._autoIntensity;
    this._mouse.takeoverDuration = this._takeoverDuration;

    this.lastUserInteraction = performance.now();
    this._mouse.onInteract = function () {
      this.lastUserInteraction = performance.now();
      if (this._autoDriver) this._autoDriver.forceStop();
    }.bind(this);

    this._autoDriver = new AutoDriver(this._mouse, this, {
      enabled: this._autoDemo, speed: this._autoSpeed,
      resumeDelay: this._autoResumeDelay, rampDuration: this._autoRampDuration
    });

    var paletteTex = makePaletteTexture(this._colors);
    var bgVec4 = new THREE.Vector4(0, 0, 0, 0);
    this._simulation = new Simulation(this._common, this._mouse);
    this._output = new OutputRenderer(this._common, this._simulation, paletteTex, bgVec4);

    this._running = false;
    this._rafId = null;
    this._loop = this._loopFn.bind(this);
    this._resizeHandler = this._onResize.bind(this);
    window.addEventListener('resize', this._resizeHandler);

    this._visHandler = function () {
      if (document.hidden) this.pause(); else this.start();
    }.bind(this);
    document.addEventListener('visibilitychange', this._visHandler);

    var self = this;
    this._themeHandler = function(e) {
      if (e.detail && e.detail.theme === 'light') {
        self.setColors(['#ffb7b2', '#ffdac1', '#e2f0cb']);
      } else {
        self.setColors(self.originalColors);
      }
    };
    window.addEventListener('themechange', this._themeHandler);

    // Initial theme check
    var currentTheme = document.documentElement.getAttribute('data-theme');
    if (currentTheme === 'light') {
       this.setColors(['#ffb7b2', '#ffdac1', '#e2f0cb']);
    }

    this.start();
  }
  
  LiquidEtherEngine.prototype.setColors = function (colors) {
    this._colors = colors;
    if (this.paletteTex) this.paletteTex.dispose();
    this.paletteTex = makePaletteTexture(this._colors);
    if (this._output && this._output.output.material.uniforms.palette) {
        this._output.output.material.uniforms.palette.value = this.paletteTex;
    }
  };

  LiquidEtherEngine.prototype._onResize = function () { this._common.resize(); this._output.resize(); };
  LiquidEtherEngine.prototype._loopFn = function () {
    if (!this._running) return;
    if (this._autoDriver) this._autoDriver.update();
    this._mouse.update();
    this._common.update();
    this._output.update();
    this._rafId = requestAnimationFrame(this._loop);
  };
  LiquidEtherEngine.prototype.start = function () {
    if (this._running) return; this._running = true; this._loop();
  };
  LiquidEtherEngine.prototype.pause = function () {
    this._running = false;
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  };
  LiquidEtherEngine.prototype.dispose = function () {
    this.pause();
    window.removeEventListener('resize', this._resizeHandler);
    document.removeEventListener('visibilitychange', this._visHandler);
    window.removeEventListener('themechange', this._themeHandler);
    this._mouse.dispose();
    if (this._common.renderer) {
      var c = this._common.renderer.domElement;
      if (c && c.parentNode) c.parentNode.removeChild(c);
      this._common.renderer.dispose();
      this._common.renderer.forceContextLoss();
    }
  };

  globalScope.LiquidEtherEngine = LiquidEtherEngine;
})(window);
