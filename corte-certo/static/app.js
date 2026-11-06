(() => {
  'use strict';

  const SLOTS = ['esquerda', 'frente', 'direita'];
  const SLOT_INFO = {
    esquerda: {
      title: 'Perfil esquerdo',
      guide: '#sil-side',
      hint: 'Vire o corpo para a sua direita até a câmera ver o lado esquerdo do rosto. Encaixe a cabeça no contorno.',
    },
    frente: {
      title: 'Frente',
      guide: '#sil-front',
      hint: 'Olhe para a câmera com o rosto relaxado e encaixe a cabeça no contorno.',
    },
    direita: {
      title: 'Perfil direito',
      guide: '#sil-side-r',
      hint: 'Vire o corpo para a sua esquerda até a câmera ver o lado direito do rosto.',
    },
  };
  const MAX_SIDE = 1280; // px — reduz o upload e o custo da análise
  const TIMERS = [0, 3, 10];

  const state = {
    step: '1',
    photos: {}, // slot -> Blob JPEG
    estilo: null,
    publico: 'masculino',
    comprimento: '',
    manutencao: 'média (alguns minutos)',
    result: null,
    rec: 0,
    request: null, // AbortController da análise em andamento
  };

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const haptic = (ms = 10) => { try { navigator.vibrate && navigator.vibrate(ms); } catch { /* sem vibração */ } };
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* modo privado */ } },
  };

  /* =========================================================
   * Navegação entre telas, integrada ao botão "voltar" do
   * Android e ao gesto de voltar do iPhone (History API).
   * ========================================================= */
  const STEP_META = {
    '1': { n: 1, progress: 33 },
    '2': { n: 2, progress: 66 },
    loading: { n: 2, progress: 85 },
    '3': { n: 3, progress: 100 },
  };

  function go(step, { push = true, replace = false, back = false } = {}) {
    state.step = step;
    if (!$('#toast').classList.contains('error')) $('#toast').hidden = true;
    $$('.step').forEach((s) => s.classList.remove('active', 'back'));
    const section = $(step === 'loading' ? '#step-loading' : `#step-${step}`);
    section.classList.add('active');
    if (back) section.classList.add('back');

    const meta = STEP_META[step];
    $('#nav-back').hidden = step === '1' || step === 'loading';
    $('#nav-title').innerHTML = step === '1'
      ? $('#nav-title').dataset.brand
      : `<span>${esc(section.dataset.title)}</span>`;
    $('#nav-step').textContent = step === 'loading' ? '' : `${meta.n} de 3`;
    $('#progress-bar').style.width = `${meta.progress}%`;
    $('#bottombar').hidden = step === 'loading';
    updatePrimary();

    const i = (history.state && history.state.i) || 0;
    if (replace) history.replaceState({ step, i }, '');
    else if (push) history.pushState({ step, i: i + 1 }, '');
    window.scrollTo(0, 0);
  }

  $('#nav-title').dataset.brand = $('#nav-title').innerHTML;
  $('#nav-back').addEventListener('click', () => history.back());

  window.addEventListener('popstate', (e) => {
    if (cam.ignorePop) { cam.ignorePop = false; return; }
    if (!$('#camera').hidden) { closeCamera({ fromHistory: true }); return; }
    if (state.request) { state.request.abort(); state.request = null; }
    const step = (e.state && e.state.step) || '1';
    go(step === 'loading' ? '2' : step, { push: false, back: true });
  });

  function updatePrimary() {
    const btn = $('#primary');
    const filled = SLOTS.filter((s) => state.photos[s]).length;
    btn.disabled = false;
    if (state.step === '1') {
      btn.textContent = filled === 3 ? 'Continuar' : filled === 0 ? 'Tirar as fotos' : `Tirar ${3 - filled === 1 ? 'a foto que falta' : 'as fotos que faltam'}`;
    } else if (state.step === '2') {
      btn.textContent = 'Analisar meu rosto';
      btn.disabled = !state.estilo;
    } else if (state.step === '3') {
      btn.textContent = 'Nova análise';
    }
  }

  $('#primary').addEventListener('click', () => {
    haptic();
    if (state.step === '1') {
      const missing = SLOTS.find((s) => !state.photos[s]);
      if (missing) openCamera(missing);
      else go('2');
    } else if (state.step === '2') {
      analisar();
    } else if (state.step === '3') {
      novaAnalise();
    }
  });

  let toastTimer;
  function toast(msg, error = false) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.toggle('error', error);
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 4500);
  }

  /* =========================================================
   * Fotos
   * ========================================================= */
  async function loadImage(file) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }
  }

  function toJpeg(source, w, h) {
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  }

  async function fileToJpeg(file) {
    const img = await loadImage(file);
    return toJpeg(img, img.width, img.height);
  }

  function setPhoto(slot, blob) {
    state.photos[slot] = blob;
    const el = $(`.photo-slot[data-slot="${slot}"]`);
    const img = $('img', el);
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(blob);
    img.hidden = false;
    $('.slot-empty', el).hidden = true;
    el.classList.add('filled');
    updatePrimary();
  }

  $$('.photo-slot').forEach((el) => el.addEventListener('click', () => { haptic(); openCamera(el.dataset.slot); }));

  // Alternativa quando a câmera ao vivo não está disponível: câmera/galeria nativa do sistema.
  const fallbackInput = $('#fallback-input');
  fallbackInput.addEventListener('change', async () => {
    const file = fallbackInput.files && fallbackInput.files[0];
    const slot = fallbackInput.dataset.slot;
    fallbackInput.value = '';
    if (!file || !slot) return;
    try { setPhoto(slot, await fileToJpeg(file)); } catch { toast('Não consegui abrir essa imagem.', true); }
  });

  /* =========================================================
   * Câmera guiada em tela cheia
   * ========================================================= */
  const video = $('#cam-video');
  const cam = {
    slot: null,
    facing: 'user',
    stream: null,
    timer: 3,
    blob: null,
    run: 0,         // id da contagem em andamento (para cancelar)
    ignorePop: false,
    audio: null,
  };
  const hasLiveCamera = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext;

  function openCamera(slot) {
    if (!hasLiveCamera) {
      fallbackInput.dataset.slot = slot;
      fallbackInput.click();
      return;
    }
    setCamSlot(slot);
    showLive();
    $('#camera').hidden = false;
    document.body.style.overflow = 'hidden';
    history.pushState({ ...(history.state || {}), cam: true }, '');
    startStream();
  }

  function closeCamera({ fromHistory = false } = {}) {
    cam.run++;
    stopStream();
    $('#camera').hidden = true;
    document.body.style.overflow = '';
    if (!fromHistory && history.state && history.state.cam) {
      cam.ignorePop = true;
      history.back();
    }
  }

  function setCamSlot(slot) {
    cam.slot = slot;
    const info = SLOT_INFO[slot];
    $('#cam-title').textContent = info.title;
    $('#cam-count').textContent = `${SLOTS.indexOf(slot) + 1} de 3`;
    $('#cam-guide-use').setAttribute('href', info.guide);
    setHint();
  }

  function setHint(text) {
    $('#cam-hint').textContent = text || (cam.facing === 'environment'
      ? 'Câmera traseira: peça para alguém enquadrar sua cabeça no contorno.'
      : SLOT_INFO[cam.slot].hint);
  }

  async function startStream() {
    stopStream();
    try {
      cam.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: cam.facing, width: { ideal: 1920 }, height: { ideal: 1920 } },
        audio: false,
      });
      if ($('#camera').hidden) { stopStream(); return; }
      video.srcObject = cam.stream;
      await video.play().catch(() => {});
      $('#cam-stage').classList.toggle('mirror', cam.facing === 'user');
      setHint();
    } catch {
      setHint('Sem acesso à câmera. Permita o acesso nas configurações do navegador ou escolha uma foto da galeria.');
    }
  }

  function stopStream() {
    if (cam.stream) cam.stream.getTracks().forEach((t) => t.stop());
    cam.stream = null;
    video.srcObject = null;
  }

  function showLive() {
    $('#cam-stage').hidden = false;
    $('#cam-review').hidden = true;
    $('#cam-controls').hidden = false;
    $('#cam-review-controls').hidden = true;
    $('#cam-countdown').hidden = true;
    $('#cam-shutter').classList.remove('busy');
    setHint();
  }

  function showReview(blob) {
    cam.blob = blob;
    const img = $('#cam-review');
    if (img.src) URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(blob);
    img.hidden = false;
    $('#cam-stage').hidden = true;
    $('#cam-controls').hidden = true;
    $('#cam-review-controls').hidden = false;
    setHint('Confira se a cabeça inteira e o cabelo aparecem bem.');
  }

  function beep(freq, ms) {
    try {
      const ac = cam.audio;
      if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.12, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + ms / 1000);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + ms / 1000);
    } catch { /* sem áudio */ }
  }

  async function captureFrame() {
    const w = video.videoWidth, h = video.videoHeight;
    if (!w || !h) throw new Error('sem imagem');
    // Salva a imagem real (sem espelhar), para que os perfis esquerdo/direito fiquem corretos.
    return toJpeg(video, w, h);
  }

  $('#cam-shutter').addEventListener('click', async () => {
    const shutter = $('#cam-shutter');
    if (shutter.classList.contains('busy')) { // toque durante a contagem cancela
      cam.run++;
      showLive();
      return;
    }
    if (!cam.stream) { toast('A câmera ainda não está pronta.'); return; }
    if (!cam.audio) {
      try { cam.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* sem áudio */ }
    }
    const run = ++cam.run;
    shutter.classList.add('busy');
    const cd = $('#cam-countdown');
    for (let n = cam.timer; n > 0; n--) {
      cd.textContent = n;
      cd.hidden = false;
      beep(660, 120);
      haptic(20);
      await sleep(1000);
      if (run !== cam.run) return;
    }
    cd.hidden = true;
    beep(1320, 160);
    haptic(50);
    const flash = $('#cam-flash');
    flash.classList.remove('go');
    void flash.offsetWidth;
    flash.classList.add('go');
    try {
      const blob = await captureFrame();
      if (run !== cam.run) return;
      shutter.classList.remove('busy');
      showReview(blob);
    } catch {
      shutter.classList.remove('busy');
      toast('Não consegui capturar a foto. Tente de novo.', true);
    }
  });

  $('#cam-retake').addEventListener('click', () => { haptic(); showLive(); });

  $('#cam-use').addEventListener('click', () => {
    haptic(15);
    setPhoto(cam.slot, cam.blob);
    const after = SLOTS.slice(SLOTS.indexOf(cam.slot) + 1).concat(SLOTS);
    const next = after.find((s) => !state.photos[s]);
    if (next) {
      setCamSlot(next);
      showLive();
    } else {
      closeCamera();
      toast('Pronto! As três fotos estão ok.');
    }
  });

  $('#cam-close').addEventListener('click', () => closeCamera());

  $('#cam-flip').addEventListener('click', () => {
    haptic();
    cam.facing = cam.facing === 'user' ? 'environment' : 'user';
    startStream();
  });

  $('#cam-timer').addEventListener('click', () => {
    haptic();
    cam.timer = TIMERS[(TIMERS.indexOf(cam.timer) + 1) % TIMERS.length];
    $('#cam-timer-label').textContent = cam.timer ? `${cam.timer}s` : 'Off';
    $('#cam-timer').classList.toggle('on', cam.timer > 0);
  });
  $('#cam-timer').classList.toggle('on', cam.timer > 0);

  $('#cam-gallery').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { showReview(await fileToJpeg(file)); } catch { toast('Não consegui abrir essa imagem.', true); }
  });

  // Libera a câmera quando o app vai para segundo plano.
  document.addEventListener('visibilitychange', () => {
    if ($('#camera').hidden) return;
    if (document.hidden) { cam.run++; stopStream(); showLive(); }
    else if ($('#cam-review').hidden) startStream();
  });

  /* =========================================================
   * Passo 2: estilo e preferências
   * ========================================================= */
  $$('.style-card').forEach((card) => {
    card.addEventListener('click', () => {
      haptic();
      $$('.style-card').forEach((c) => c.setAttribute('aria-checked', 'false'));
      card.setAttribute('aria-checked', 'true');
      state.estilo = card.dataset.value;
      updatePrimary();
    });
  });

  $$('#step-2 .segmented').forEach((group) => {
    $$('button', group).forEach((btn) => {
      btn.addEventListener('click', () => {
        haptic();
        $$('button', group).forEach((b) => b.setAttribute('aria-checked', 'false'));
        btn.setAttribute('aria-checked', 'true');
        state[group.dataset.name] = btn.dataset.value;
      });
    });
  });

  /* =========================================================
   * Análise
   * ========================================================= */
  const LOADING_MSGS = [
    'Medindo proporções do rosto…',
    'Analisando os perfis e a nuca…',
    'Identificando o tipo de cabelo…',
    'Cruzando com o estilo que você escolheu…',
    'Montando a ficha para o barbeiro…',
  ];

  async function analisar() {
    if (!navigator.onLine) { toast('Sem internet. Conecte-se para fazer a análise.', true); return; }
    const fd = new FormData();
    SLOTS.forEach((s) => fd.append(`foto_${s}`, state.photos[s], `${s}.jpg`));
    ['estilo', 'publico', 'comprimento', 'manutencao'].forEach((k) => fd.append(k, state[k] || ''));
    fd.append('observacoes', $('#observacoes').value);

    $('#loading-photo').src = $('[data-slot="frente"] img').src;
    go('loading');
    let i = 0;
    $('#loading-msg').textContent = LOADING_MSGS[0];
    const timer = setInterval(() => {
      i = Math.min(i + 1, LOADING_MSGS.length - 1);
      $('#loading-msg').textContent = LOADING_MSGS[i];
    }, 5000);

    const ctrl = new AbortController();
    state.request = ctrl;
    try {
      const res = await fetch('/api/analisar', { method: 'POST', body: fd, signal: ctrl.signal });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erro || 'Algo deu errado na análise.');
      state.result = data.resultado;
      state.rec = 0;
      render();
      haptic([20, 60, 20]);
      go('3', { replace: true });
    } catch (e) {
      if (e.name === 'AbortError') return; // o usuário voltou
      history.back();
      toast(e.message || 'Sem conexão. Tente novamente.', true);
    } finally {
      clearInterval(timer);
      if (state.request === ctrl) state.request = null;
    }
  }

  function novaAnalise() {
    state.photos = {};
    state.result = null;
    $$('.photo-slot').forEach((el) => {
      const img = $('img', el);
      if (img.src) URL.revokeObjectURL(img.src);
      img.removeAttribute('src');
      img.hidden = true;
      $('.slot-empty', el).hidden = false;
      el.classList.remove('filled');
    });
    const i = (history.state && history.state.i) || 0;
    if (i > 0) history.go(-i);
    else go('1', { replace: true });
  }

  /* =========================================================
   * Resultado
   * ========================================================= */
  const FACE_ICONS = {
    oval: '<ellipse cx="20" cy="20" rx="12" ry="16"/>',
    redondo: '<circle cx="20" cy="20" r="15"/>',
    quadrado: '<rect x="6" y="6" width="28" height="28" rx="5"/>',
    retangular: '<rect x="9" y="3" width="22" height="34" rx="5"/>',
    coracao: '<path d="M5 9 Q20 3 35 9 Q34 22 20 37 Q6 22 5 9 Z"/>',
    diamante: '<path d="M20 3 L33 18 L20 37 L7 18 Z"/>',
    triangular: '<path d="M13 4 L27 4 L35 30 Q20 38 5 30 Z"/>',
  };
  const FACE_NAMES = { coracao: 'coração' };
  const MANUT = { baixa: 'Manutenção baixa', media: 'Manutenção média', alta: 'Manutenção alta' };

  function render() {
    const r = state.result;
    const el = $('#result');
    if (!r.fotos_validas) {
      el.innerHTML = `
        <h1>Não consegui analisar</h1>
        <div class="warn-box">${(r.problemas_fotos || []).map(esc).join('<br>') || 'As fotos não mostram o rosto com clareza.'}</div>
        <p class="lead">Tente de novo: luz de frente, sem boné, cabeça e ombros dentro do contorno.</p>`;
      return;
    }
    const a = r.analise_facial, c = r.cabelo_atual;
    const shape = a.formato_rosto;
    el.innerHTML = `
      <h1 id="t3">Seu resultado</h1>
      ${r.problemas_fotos && r.problemas_fotos.length ? `<div class="warn-box">${r.problemas_fotos.map(esc).join('<br>')}</div>` : ''}

      <div class="card">
        <div class="face-head">
          <div class="face-badge"><svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="2.5">${FACE_ICONS[shape] || FACE_ICONS.oval}</svg></div>
          <div>
            <div class="kicker">Formato do rosto</div>
            <h2>${esc(FACE_NAMES[shape] || shape)}</h2>
            <span class="conf">confiança ${esc(a.confianca === 'media' ? 'média' : a.confianca)}</span>
          </div>
        </div>
        <p style="margin-top:12px">${esc(a.justificativa)}</p>
        <dl class="kv">
          <div><dt>Proporções</dt><dd>${esc(a.proporcoes)}</dd></div>
          <div><dt>Perfis</dt><dd>${esc(a.perfil)}</dd></div>
        </dl>
        <div class="split">
          <div><h3>Valorizar</h3><div class="tags">${a.pontos_fortes.map((p) => `<span class="tag good">${esc(p)}</span>`).join('')}</div></div>
          <div><h3>Equilibrar</h3><div class="tags">${a.pontos_de_atencao.map((p) => `<span class="tag care">${esc(p)}</span>`).join('')}</div></div>
        </div>
      </div>

      <div class="card">
        <h3>Seu cabelo</h3>
        <dl class="kv">
          <div><dt>Tipo</dt><dd>${esc(c.tipo)} · ${esc(c.espessura_densidade)}</dd></div>
          <div><dt>Linha frontal</dt><dd>${esc(c.linha_frontal)}</dd></div>
          <div><dt>Redemoinhos</dt><dd>${esc(c.redemoinhos)}</dd></div>
          <div><dt>Comprimento atual</dt><dd>${esc(c.comprimento_atual)}</dd></div>
        </dl>
      </div>

      <p class="summary">${esc(r.resumo_objetivo)}</p>

      <h2 class="section-title">Cortes para você</h2>
      <div class="segmented rec-seg" role="tablist">
        ${r.recomendacoes.map((rec, i) => `
          <button role="tab" aria-checked="${i === state.rec}" data-rec="${i}">
            Opção ${i + 1}<small>${esc(rec.compatibilidade)}%</small>
          </button>`).join('')}
      </div>
      <div id="rec-body"></div>

      ${r.evitar && r.evitar.length ? `
      <div class="card">
        <h3>Evite</h3>
        <ul class="avoid">${r.evitar.map((e) => `<li><b>${esc(e.corte)}</b><span>${esc(e.motivo)}</span></li>`).join('')}</ul>
      </div>` : ''}

      ${r.barba && !/não se aplica/i.test(r.barba) ? `<div class="card"><h3>Barba</h3><p>${esc(r.barba)}</p></div>` : ''}
    `;
    $$('[data-rec]', el).forEach((b) => b.addEventListener('click', () => {
      haptic();
      state.rec = Number(b.dataset.rec);
      $$('[data-rec]', el).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      renderRec();
    }));
    renderRec();
  }

  // Busca de fotos do corte (abre fora do app). Usa o termo sugerido pela análise ou o nome do corte.
  function photoLinks(rec) {
    const termo = String(rec.termo_busca || rec.nome || '').trim();
    const q = encodeURIComponent(`${termo} corte de cabelo ${state.publico === 'feminino' ? 'feminino' : 'masculino'}`);
    return `
      <div class="photo-links">
        <a class="btn primary" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=isch&q=${q}">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>
          Ver fotos
        </a>
        <a class="btn secondary" target="_blank" rel="noopener" href="https://br.pinterest.com/search/pins/?q=${q}">Pinterest</a>
        <small>As fotos são da internet: use como referência do estilo.</small>
      </div>`;
  }

  function renderRec() {
    const rec = state.result.recomendacoes[state.rec];
    if (!rec) return;
    const f = rec.ficha_barbeiro;
    $('#rec-body').innerHTML = `
      <div class="card">
        <div class="rec-title">
          <h2>${esc(rec.nome)}</h2>
          <div class="score"><strong>${esc(rec.compatibilidade)}%</strong><small>compatível</small></div>
        </div>
        <p style="margin-top:10px">${esc(rec.por_que_funciona)}</p>
        <div class="meta">
          <span class="tag">${esc(MANUT[rec.manutencao] || rec.manutencao)}</span>
          <span class="tag">Retocar a cada ${esc(rec.retorno_semanas)} semanas</span>
        </div>
        ${photoLinks(rec)}
      </div>

      <div class="card barber">
        <h3>Mostre para o barbeiro</h3>
        <dl class="kv">
          <div><dt>Laterais</dt><dd>${esc(f.laterais)}</dd></div>
          <div><dt>Nuca</dt><dd>${esc(f.nuca)}</dd></div>
          <div><dt>Topo</dt><dd>${esc(f.topo)}</dd></div>
          <div><dt>Frente</dt><dd>${esc(f.franja_frente)}</dd></div>
          <div><dt>Acabamento</dt><dd>${esc(f.textura_acabamento)}</dd></div>
        </dl>
        <div class="barber-text">${esc(f.texto_para_mostrar)}</div>
        <div class="barber-actions">
          <button class="btn primary" id="compartilhar">Compartilhar</button>
          <button class="btn dark" id="copiar">Copiar</button>
        </div>
      </div>

      <div class="card">
        <h3>Como finalizar em casa</h3>
        <p><b>${esc(rec.finalizacao.produto)}</b></p>
        <ol class="steps">${rec.finalizacao.passo_a_passo.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
      </div>`;

    const texto = `✂️ ${rec.nome}\n\n${f.texto_para_mostrar}\n\n• Laterais: ${f.laterais}\n• Nuca: ${f.nuca}\n• Topo: ${f.topo}\n• Frente: ${f.franja_frente}\n• Acabamento: ${f.textura_acabamento}`;

    // Folha de compartilhamento nativa (iOS/Android); sem ela, abre o WhatsApp.
    $('#compartilhar').addEventListener('click', async () => {
      haptic();
      if (navigator.share) {
        try { await navigator.share({ title: rec.nome, text: texto }); } catch { /* cancelado */ }
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
      }
    });
    $('#copiar').addEventListener('click', async (ev) => {
      try {
        await navigator.clipboard.writeText(texto);
        haptic(15);
        ev.target.textContent = 'Copiado ✓';
        setTimeout(() => (ev.target.textContent = 'Copiar'), 2000);
      } catch {
        toast('Não consegui copiar. Segure o texto para selecionar.', true);
      }
    });
  }

  /* =========================================================
   * App instalável (PWA)
   * ========================================================= */
  const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let installPrompt = null;

  function showInstall(kind) {
    if (isStandalone || store.get('install-dismissed')) return;
    const card = $('#install-card');
    if (kind === 'ios') {
      $('#install-text').textContent = 'No Safari, toque em Compartilhar e depois em “Adicionar à Tela de Início”.';
      $('#install-btn').hidden = true;
    }
    card.hidden = false;
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    showInstall('android');
  });
  $('#install-btn').addEventListener('click', async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice.catch(() => {});
    installPrompt = null;
    $('#install-card').hidden = true;
  });
  $('#install-close').addEventListener('click', () => {
    store.set('install-dismissed', '1');
    $('#install-card').hidden = true;
  });
  if (isIOS) showInstall('ios');

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }

  /* ---------- início ---------- */
  history.replaceState({ step: '1', i: 0 }, '');
  go('1', { push: false });
  fetch('/api/status').then((r) => r.json()).then((s) => { $('#demo-banner').hidden = !s.demo; }).catch(() => {});
})();
