(() => {
  'use strict';

  const SLOTS = ['esquerda', 'frente', 'direita'];
  const MAX_SIDE = 1280; // px — reduz o upload e o custo da análise
  const state = {
    photos: {},          // slot -> Blob (JPEG redimensionado)
    estilo: null,
    publico: 'masculino',
    comprimento: '',
    manutencao: 'média (alguns minutos)',
    result: null,
    rec: 0,
  };

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- navegação ---------- */
  function go(step) {
    $$('.step').forEach((s) => s.classList.remove('active'));
    $(step === 'loading' ? '#step-loading' : `#step-${step}`).classList.add('active');
    const n = step === 'loading' ? 2 : Number(step);
    $$('.stepper li').forEach((li) => {
      const s = Number(li.dataset.step);
      li.classList.toggle('active', s === n);
      li.classList.toggle('done', s < n);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => go(b.dataset.goto)));

  function showError(msg) {
    const el = $('#error');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(showError.t);
    showError.t = setTimeout(() => (el.hidden = true), 6000);
  }

  /* ---------- passo 1: fotos ---------- */
  async function resize(file) {
    let src;
    try {
      src = await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      src = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });
    }
    const w = src.width, h = src.height;
    const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(src, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  }

  $$('.photo-slot').forEach((slot) => {
    const input = $('input', slot);
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      if (!file) return;
      try {
        const blob = await resize(file);
        state.photos[slot.dataset.slot] = blob;
        const img = $('img', slot);
        if (img.src) URL.revokeObjectURL(img.src);
        img.src = URL.createObjectURL(blob);
        img.hidden = false;
        $('.slot-empty', slot).hidden = true;
        slot.classList.add('filled');
      } catch {
        showError('Não consegui abrir essa imagem. Tente outra foto.');
      }
      input.value = '';
      $('#to-step-2').disabled = !SLOTS.every((s) => state.photos[s]);
    });
  });
  $('#to-step-2').addEventListener('click', () => go(2));

  /* ---------- passo 2: estilo ---------- */
  $$('.style-card').forEach((card) => {
    card.addEventListener('click', () => {
      $$('.style-card').forEach((c) => c.setAttribute('aria-checked', 'false'));
      card.setAttribute('aria-checked', 'true');
      state.estilo = card.dataset.value;
      $('#analisar').disabled = false;
    });
  });
  $$('.chips').forEach((group) => {
    $$('button', group).forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('button', group).forEach((b) => b.setAttribute('aria-pressed', 'false'));
        btn.setAttribute('aria-pressed', 'true');
        state[group.dataset.name] = btn.dataset.value;
      });
    });
  });

  /* ---------- análise ---------- */
  const LOADING_MSGS = [
    'Medindo proporções do rosto…',
    'Analisando os perfis e a nuca…',
    'Identificando o tipo de cabelo…',
    'Cruzando com o estilo que você escolheu…',
    'Montando a ficha para o barbeiro…',
  ];

  $('#analisar').addEventListener('click', async () => {
    const fd = new FormData();
    SLOTS.forEach((s) => fd.append(`foto_${s}`, state.photos[s], `${s}.jpg`));
    fd.append('estilo', state.estilo);
    fd.append('publico', state.publico);
    fd.append('comprimento', state.comprimento);
    fd.append('manutencao', state.manutencao);
    fd.append('observacoes', $('#observacoes').value);

    $('#loading-photo').src = $('[data-slot="frente"] img').src;
    go('loading');
    let i = 0;
    $('#loading-msg').textContent = LOADING_MSGS[0];
    const timer = setInterval(() => {
      i = Math.min(i + 1, LOADING_MSGS.length - 1);
      $('#loading-msg').textContent = LOADING_MSGS[i];
    }, 5000);

    try {
      const res = await fetch('/api/analisar', { method: 'POST', body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.erro || 'Algo deu errado na análise.');
      state.result = data.resultado;
      state.rec = 0;
      render();
      go(3);
    } catch (e) {
      go(2);
      showError(e.message || 'Sem conexão. Tente novamente.');
    } finally {
      clearInterval(timer);
    }
  });

  $('#nova').addEventListener('click', () => {
    state.photos = {};
    state.result = null;
    $$('.photo-slot').forEach((slot) => {
      const img = $('img', slot);
      if (img.src) URL.revokeObjectURL(img.src);
      img.removeAttribute('src');
      img.hidden = true;
      $('.slot-empty', slot).hidden = false;
      slot.classList.remove('filled');
    });
    $('#to-step-2').disabled = true;
    go(1);
  });

  /* ---------- resultado ---------- */
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
        <p class="lead">Tente de novo seguindo as dicas: luz de frente, sem boné, cabeça e ombros no enquadramento.</p>`;
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
            <h2>${esc(FACE_NAMES[shape] || shape)} <span class="conf">confiança ${esc(a.confianca === 'media' ? 'média' : a.confianca)}</span></h2>
          </div>
        </div>
        <p style="margin-top:12px">${esc(a.justificativa)}</p>
        <dl class="kv">
          <div><dt>Proporções</dt><dd>${esc(a.proporcoes)}</dd></div>
          <div><dt>Perfis</dt><dd>${esc(a.perfil)}</dd></div>
        </dl>
        <div class="two-col">
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

      <div class="rec-tabs" role="tablist">
        ${r.recomendacoes.map((rec, i) => `
          <button role="tab" aria-selected="${i === state.rec}" data-rec="${i}">
            <b>Opção ${i + 1} · ${esc(rec.compatibilidade)}%</b><span>${esc(rec.nome)}</span>
          </button>`).join('')}
      </div>
      <div id="rec-body"></div>

      ${r.evitar && r.evitar.length ? `
      <div class="card">
        <h3>Evite</h3>
        <ul class="avoid">${r.evitar.map((e) => `<li><b>${esc(e.corte)}</b><span>${esc(e.motivo)}</span></li>`).join('')}</ul>
      </div>` : ''}

      ${r.barba && !/não se aplica/i.test(r.barba) ? `
      <div class="card"><h3>Barba</h3><p>${esc(r.barba)}</p></div>` : ''}
    `;
    $$('[data-rec]', el).forEach((b) => b.addEventListener('click', () => {
      state.rec = Number(b.dataset.rec);
      $$('[data-rec]', el).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
      renderRec();
    }));
    renderRec();
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
      </div>

      <div class="card barber">
        <h3>Ficha para o barbeiro</h3>
        <dl class="kv">
          <div><dt>Laterais</dt><dd>${esc(f.laterais)}</dd></div>
          <div><dt>Nuca</dt><dd>${esc(f.nuca)}</dd></div>
          <div><dt>Topo</dt><dd>${esc(f.topo)}</dd></div>
          <div><dt>Frente</dt><dd>${esc(f.franja_frente)}</dd></div>
          <div><dt>Acabamento</dt><dd>${esc(f.textura_acabamento)}</dd></div>
        </dl>
        <div class="barber-text">${esc(f.texto_para_mostrar)}</div>
        <div class="barber-actions">
          <button class="btn small primary" id="copiar">Copiar</button>
          <a class="btn small outline" id="whats" target="_blank" rel="noopener" style="text-decoration:none">Enviar no WhatsApp</a>
        </div>
      </div>

      <div class="card">
        <h3>Como finalizar em casa</h3>
        <p><b>${esc(rec.finalizacao.produto)}</b></p>
        <ol class="steps">${rec.finalizacao.passo_a_passo.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
      </div>`;

    const texto = `✂️ ${rec.nome}\n\n${f.texto_para_mostrar}\n\n• Laterais: ${f.laterais}\n• Nuca: ${f.nuca}\n• Topo: ${f.topo}\n• Frente: ${f.franja_frente}\n• Acabamento: ${f.textura_acabamento}`;
    $('#whats').href = `https://wa.me/?text=${encodeURIComponent(texto)}`;
    $('#copiar').addEventListener('click', async (ev) => {
      try {
        await navigator.clipboard.writeText(texto);
        ev.target.textContent = 'Copiado ✓';
        setTimeout(() => (ev.target.textContent = 'Copiar'), 2000);
      } catch {
        showError('Não consegui copiar. Selecione o texto manualmente.');
      }
    });
  }

  /* ---------- status ---------- */
  fetch('/api/status').then((r) => r.json()).then((s) => { $('#demo-banner').hidden = !s.demo; }).catch(() => {});
})();
