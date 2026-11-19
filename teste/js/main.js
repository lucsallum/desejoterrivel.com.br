/* Desejo Terrível — Década Dodói
   1) intro: vídeo (ou placeholder) e descida automática até o player
   2) player: fila A1→B8, barra fixa, Media Session */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduzMovimento = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ================= 1. INTRO ================= */
  const intro = $('#intro');
  const video = $('#intro-video');
  const alvo = $('#player');
  let descidaCancelada = false;
  let timerPlaceholder = null;

  // qualquer gesto do visitante cancela a descida automática
  const cancelar = () => { descidaCancelada = true; clearTimeout(timerPlaceholder); };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach((ev) =>
    addEventListener(ev, cancelar, { once: true, passive: true }));

  // rolagem com aceleração suave, "como se o palhaço puxasse a página"
  function descer(duracao = 1400) {
    if (descidaCancelada) return;
    const ini = scrollY;
    const fim = alvo.getBoundingClientRect().top + scrollY;
    if (reduzMovimento) { scrollTo(0, fim); return; }
    const t0 = performance.now();
    const ease = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const passo = (agora) => {
      if (descidaCancelada) return;
      const t = Math.min(1, (agora - t0) / duracao);
      scrollTo(0, ini + (fim - ini) * ease(t));
      if (t < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  // Ao recarregar, o navegador restauraria a rolagem (que ficou no player
  // depois da descida). Sem âncora na URL, a visita começa sempre na capa.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  const naCapa = !location.hash;
  if (naCapa) scrollTo(0, 0);

  // 9:16 só cabe bem em tela em pé; em tela larga usa o 16:9 (se existir)
  const emPe = innerWidth / innerHeight <= 0.75;
  const base = emPe ? video.dataset.srcRetrato : video.dataset.srcPaisagem;

  // sem vídeo: a capa fica parada uns segundos e a página desce sozinha
  const descerSemVideo = () => {
    if (!reduzMovimento) timerPlaceholder = setTimeout(() => descer(), 4000);
  };

  if (base && naCapa) {
    // iOS só deixa tocar sozinho se estiver mudo e inline (propriedades, não só atributos)
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('webkit-playsinline', '');
    video.src = `${base}.mp4`;   // MP4/H.264: o WebM o iPhone diz que "talvez" toca e falha
    video.preload = 'auto';
    video.hidden = false;        // o poster é o 1º frame, idêntico à foto
    video.addEventListener('ended', () => { descidaCancelada = false; descer(900); }, { once: true });

    // Autoplay bloqueado (economia de bateria, "reduzir movimento"): o vídeo
    // fica parado no 1º frame e toca no primeiro toque na capa.
    const tocarNoToque = () => {
      descerSemVideo();
      intro.addEventListener('click', () => {
        clearTimeout(timerPlaceholder);
        video.play().catch(() => {});
      }, { once: true });
    };
    if (reduzMovimento) tocarNoToque();
    else video.play().catch(tocarNoToque);
  } else if (naCapa) {
    descerSemVideo();
  }

  /* ================= 2. PLAYER ================= */
  const F = window.FAIXAS || [];
  const audio = $('#audio');
  const barra = $('#barra');
  const prog = $('#prog');
  const btPlay = $('#play');
  const elCod = $('#agora-cod');
  const elTit = $('#agora-tit');
  const elTempo = $('#tempo');
  const aviso = $('#aviso');
  let atual = -1;
  let arrastando = false;

  const fmt = (s) => {
    if (!isFinite(s)) return '–:––';
    s = Math.floor(s);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
  const durDe = (f) => { const [m, s] = f.dur.split(':').map(Number); return m * 60 + s; };

  let timerAviso;
  // avisos "fracos" (ex.: sintonizando) não atropelam um aviso que está na tela
  function avisar(txt, ms = 2600, fraco = false) {
    if (fraco && aviso.classList.contains('on')) return;
    aviso.textContent = txt;
    aviso.classList.add('on');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(() => aviso.classList.remove('on'), ms);
  }

  function marcar() {
    const id = F[atual] && F[atual].id;
    const pausado = audio.paused;
    $$('.faixa, .letra').forEach((el) => {
      const on = el.dataset.id === id;
      el.classList.toggle('tocando', on);
      el.classList.toggle('pausado', on && pausado);
    });
    barra.classList.toggle('tocando', !pausado);
    btPlay.setAttribute('aria-label', pausado ? 'Tocar' : 'Pausar');
  }

  function tempo() {
    const f = F[atual];
    const dur = isFinite(audio.duration) ? audio.duration : (f ? durDe(f) : 0);
    elTempo.textContent = `${fmt(audio.currentTime || 0)} / ${fmt(dur)}`;
    if (!arrastando && dur) prog.value = Math.round((audio.currentTime / dur) * 1000);
  }

  function carregar(i, tocar = true) {
    if (i < 0 || i >= F.length) return;
    const anterior = F[atual];
    atual = i;
    const f = F[i];
    audio.src = f.src;
    elCod.textContent = f.cod;
    elTit.textContent = f.titulo;
    prog.disabled = false;
    prog.value = 0;
    tempo();
    mostrarBarra(true);
    if (anterior && anterior.lado === 'A' && f.lado === 'B') avisar('Vire para o lado B');
    if (tocar) audio.play().catch(() => {});
    sessao(f);
    marcar();
  }

  function alternar() {
    if (atual < 0) return carregar(0);
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }

  // botões "tocar" na tracklist, no "iniciar" e nas letras
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tocar]');
    if (!b) return;
    const i = F.findIndex((f) => f.id === b.dataset.tocar);
    if (i === atual) alternar(); else carregar(i);
  });

  btPlay.addEventListener('click', alternar);
  $('#ant').addEventListener('click', () => {
    if (audio.currentTime > 4 || atual <= 0) { audio.currentTime = 0; if (atual < 0) carregar(0); }
    else carregar(atual - 1);
  });
  $('#prox').addEventListener('click', () => carregar(Math.min(atual + 1, F.length - 1)));

  prog.addEventListener('input', () => {
    arrastando = true;
    const dur = isFinite(audio.duration) ? audio.duration : durDe(F[atual]);
    elTempo.textContent = `${fmt((prog.value / 1000) * dur)} / ${fmt(dur)}`;
  });
  prog.addEventListener('change', () => {
    const dur = isFinite(audio.duration) ? audio.duration : durDe(F[atual]);
    audio.currentTime = (prog.value / 1000) * dur;
    arrastando = false;
  });

  audio.addEventListener('timeupdate', tempo);
  audio.addEventListener('loadedmetadata', tempo);
  audio.addEventListener('play', marcar);
  audio.addEventListener('pause', marcar);
  audio.addEventListener('waiting', () => avisar('Sintonizando…', 1800, true));
  audio.addEventListener('ended', () => {
    if (atual < F.length - 1) carregar(atual + 1);
    else { avisar('Fim da fita. Rebobine.', 3500); marcar(); }
  });
  audio.addEventListener('error', () => {
    avisar('Áudio ainda não disponível', 3000);
    marcar();
  });

  /* Media Session: capa e controles na tela de bloqueio */
  function sessao(f) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: f.titulo,
      artist: 'Desejo Terrível',
      album: 'Década Dodói (2026—2016)',
      artwork: [
        { src: 'img/capa-800.jpg', sizes: '800x800', type: 'image/jpeg' },
        { src: 'img/capa-1600.jpg', sizes: '1600x1600', type: 'image/jpeg' },
      ],
    });
  }
  if ('mediaSession' in navigator) {
    const ms = navigator.mediaSession;
    const h = (a, fn) => { try { ms.setActionHandler(a, fn); } catch (_) {} };
    h('play', () => audio.play());
    h('pause', () => audio.pause());
    h('previoustrack', () => $('#ant').click());
    h('nexttrack', () => $('#prox').click());
    h('seekto', (d) => { audio.currentTime = d.seekTime; });
  }

  /* a barra aparece quando a capa sai da tela (ou quando algo toca) */
  let tocouAlgo = false;
  function mostrarBarra(forcar) {
    if (forcar) tocouAlgo = true;
    barra.classList.toggle('visivel', tocouAlgo || !introVisivel);
  }
  let introVisivel = true;
  new IntersectionObserver(([e]) => { introVisivel = e.intersectionRatio > 0.35; mostrarBarra(); },
    { threshold: [0, 0.35, 1] }).observe(intro);

  // estado inicial da barra: A1 pronta
  if (F.length) { elCod.textContent = F[0].cod; elTit.textContent = F[0].titulo; elTempo.textContent = `0:00 / ${F[0].dur}`; }
})();
