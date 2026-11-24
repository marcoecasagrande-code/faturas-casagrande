/* Faturas Casagrande — versão independente do Claude.
   Faz o papel de window.claude.use("db" | "user") usando o Firebase (Firestore + login Google),
   para que o mesmo código do app funcione fora do Claude. Usa o mesmo projeto do Treinos,
   com o mesmo login da família; as faturas ficam na coleção "faturas". */
(() => {
  const CFG = {
    apiKey: "AIzaSyBajf8IHC6VQ_NSrksyMHCkTfdHM-Zki6o",
    authDomain: "treinos-casagrande.firebaseapp.com",
    projectId: "treinos-casagrande",
    storageBucket: "treinos-casagrande.firebasestorage.app",
    messagingSenderId: "784923030606",
    appId: "1:784923030606:web:bae344cc4d2477819dff1f"
  };
  // Botão oficial do Google (accounts.google.com); mesmo cliente do Treinos, mesmo endereço github.io.
  const GOOGLE_CLIENT_ID = "784923030606-n7g9udsuq4dihor1hn1et2trih3pdf3j.apps.googleusercontent.com";
  firebase.initializeApp(CFG);
  const auth = firebase.auth(), fs = firebase.firestore();
  try { fs.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch {}
  window.__fbLogin = true;

  // O Firestore não aceita lista dentro de lista: guarda como objeto e desfaz na leitura.
  const enc = v => Array.isArray(v) ? (v.some(Array.isArray) ? { __lista: v.map(x => Array.isArray(x) ? { __lista: x.map(enc) } : enc(x)) } : v.map(enc))
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, enc(x)])) : v;
  const dec = v => Array.isArray(v) ? v.map(dec) : v && typeof v === "object" ? ("__lista" in v && Object.keys(v).length === 1 ? dec(v.__lista) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)]))) : v;
  const erro = e => { const x = new Error(e && e.message || "erro"); x.code = e && e.code === "permission-denied" ? "invalid_argument" : e && e.code === "resource-exhausted" ? "quota_exceeded" : e && e.code === "unavailable" ? "unavailable" : (e && e.code) || "erro"; return x; };
  const snap = s => ({ id: s.id, exists: s.exists, data: () => s.exists ? dec(s.data()) : undefined, metadata: s.metadata });
  const qsnap = q => ({ docs: q.docs.map(snap), size: q.size, empty: q.empty, metadata: q.metadata });
  const docApi = ref => ({ id: ref.id,
    get: async () => { try { return snap(await ref.get()); } catch (e) { throw erro(e); } },
    set: async d => { try { await ref.set(enc(d)); } catch (e) { throw erro(e); } },
    update: async d => { try { await ref.set(enc(d), { merge: true }); } catch (e) { throw erro(e); } },
    delete: async () => { try { await ref.delete(); } catch (e) { throw erro(e); } },
    onSnapshot: (fn, err) => ref.onSnapshot({ includeMetadataChanges: true }, s => fn(snap(s)), e => err && err(erro(e))) });
  const queryApi = (q, col) => ({
    where: (...a) => queryApi(q.where(...a), col), orderBy: (...a) => queryApi(q.orderBy(...a), col), limit: n => queryApi(q.limit(n), col),
    get: async () => { try { return qsnap(await q.get()); } catch (e) { throw erro(e); } },
    onSnapshot: (fn, err) => q.onSnapshot({ includeMetadataChanges: true }, s => fn(qsnap(s)), e => err && err(erro(e))),
    doc: id => docApi(id ? col.doc(id) : col.doc()) });
  const db = { collection: c => { const r = fs.collection(c); return queryApi(r, r); }, doc: p => docApi(fs.doc(p)) };
  let atual = null;
  const user = { id: async () => atual && atual.uid, me: async () => ({ id: atual && atual.uid, name: atual && atual.displayName || "" }), isOwner: async () => true, canEdit: async () => true, can: async () => true };

  // Tela de entrada (login Google) — só a família tem acesso (regras do Firestore).
  const css = `#fb-login{position:fixed;inset:0;z-index:99999;background:#F3F5F8;background-image:radial-gradient(circle,#C7D0DE 1.1px,transparent 1.5px);background-size:9px 9px;display:flex;align-items:center;justify-content:center;padding:24px;font-family:Inter,system-ui,sans-serif}
  #fb-login .box{background:#fff;border:1px solid #DCE1EA;border-radius:22px;padding:28px 24px;max-width:360px;width:100%;text-align:center;box-shadow:0 12px 40px rgba(20,28,43,.16)}
  #fb-login img{width:88px;height:88px;border-radius:20px}#fb-login h1{font:700 28px "Bricolage Grotesque",Inter,sans-serif;margin:12px 0 4px;color:#141C2B;letter-spacing:-.02em}#fb-login h1 span{color:#C2410C}
  #fb-login p{color:#5A6577;font-size:14px;margin:0 0 18px}#fb-login button{width:100%;border:0;border-radius:14px;padding:14px;font:600 16px Inter,sans-serif;background:#2341C9;color:#fff;cursor:pointer}
  #fb-login .sec{background:#ECEFF4;color:#141C2B;margin-top:10px}#fb-login #fb-gis{display:flex;justify-content:center;min-height:44px}#fb-login .err{color:#B42318;font-size:13px;margin-top:12px;min-height:1em}`;
  let tela = null;
  function mostrarLogin(msg, sair) {
    if (!tela) { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); tela = document.createElement("div"); tela.id = "fb-login"; document.body.appendChild(tela); }
    tela.innerHTML = `<div class="box"><img src="icon-192-v2.png" alt=""><h1>Financeiro <span>Casagrande</span></h1><p>Entre com a sua conta Google da família.</p>
      ${sair ? `<button id="fb-sair">Entrar com outra conta</button>` : `<div id="fb-gis"></div><button id="fb-entrar" class="sec">Outra forma de entrar</button>`}<div class="err"></div></div>`;
    tela.querySelector(".err").textContent = msg || "";
    tela.hidden = false;
    if (!sair) botaoGoogle();
    const b = tela.querySelector("#fb-entrar"); if (b) b.onclick = entrar;
    const s = tela.querySelector("#fb-sair"); if (s) s.onclick = () => auth.signOut();
  }
  let gisPronto = null;
  function botaoGoogle() {
    gisPronto ||= new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "https://accounts.google.com/gsi/client"; sc.async = true; sc.onload = ok; sc.onerror = no; document.head.appendChild(sc); });
    gisPronto.then(() => {
      google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, ux_mode: "popup", auto_select: false, itp_support: true,
        callback: async r => { try { await auth.signInWithCredential(firebase.auth.GoogleAuthProvider.credential(r.credential)); }
          catch (e) { mostrarLogin("Não deu para entrar (" + ((e && e.code) || "erro") + "). Tente de novo."); } } });
      const alvo = document.getElementById("fb-gis");
      if (alvo) google.accounts.id.renderButton(alvo, { theme: "filled_blue", size: "large", shape: "pill", text: "signin_with", locale: "pt-BR", width: Math.min(312, alvo.clientWidth || 300) });
    }).catch(() => { const e = tela && tela.querySelector(".err"); if (e) e.textContent = "Não consegui carregar o botão do Google. Use “Outra forma de entrar”."; });
  }
  async function entrar() {
    const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
    try { await auth.signInWithPopup(p); }
    catch (e) { if (e && /popup-blocked|operation-not-supported|popup-closed-by-browser/.test(e.code || "")) return auth.signInWithRedirect(p); mostrarLogin(e && e.code === "auth/popup-closed-by-user" ? "" : "Não deu para entrar. Tente de novo."); }
  }
  let liberar; const pronto = new Promise(r => liberar = r); let aberto = false;
  setTimeout(() => {
    if (aberto || (tela && !tela.hidden) || (pinEl && !pinEl.hidden)) return;
    const d = document.createElement("div"); d.id = "fb-lento";
    d.innerHTML = `<style>#fb-lento{position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:99998;background:#141C2B;color:#fff;border-radius:14px;padding:14px;font:14px Inter,system-ui,sans-serif;display:flex;gap:10px;align-items:center;flex-wrap:wrap}#fb-lento button{margin-left:auto;border:0;border-radius:10px;padding:9px 14px;font:600 14px Inter,sans-serif;background:#2341C9;color:#fff}</style><span>Está demorando para conectar. Confira a internet.</span><button type="button">Tentar de novo</button>`;
    d.querySelector("button").onclick = () => location.reload(); document.body.appendChild(d);
    pronto.then(() => d.remove());
  }, 12000);
  auth.getRedirectResult().catch(() => {});
  auth.onAuthStateChanged(async u => {
    if (!u) { if (aberto) location.reload(); return document.readyState === "loading" ? addEventListener("DOMContentLoaded", () => mostrarLogin()) : mostrarLogin(); }
    try { await fs.collection("faturas").limit(1).get(); }
    catch (e) { if (e && e.code === "permission-denied") return mostrarLogin(`A conta ${u.email} não tem acesso às faturas da família.`, true); }
    atual = u;
    if (tela) tela.hidden = true;
    setTimeout(mostraInstalar, 1500);
    await portaPin();
    aberto = true; liberar();
    addSair(u);
  });
  // botão "Instalar app": usa o instalador do próprio navegador (Chrome/Edge no PC e no Android)
  let pedidoInstalar = null;
  const jaInstalado = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  addEventListener("beforeinstallprompt", e => { e.preventDefault(); pedidoInstalar = e; mostraInstalar(); });
  addEventListener("appinstalled", () => { pedidoInstalar = null; const b = document.getElementById("fb-inst"); if (b) b.remove(); });
  function mostraInstalar() {
    if (!pedidoInstalar || jaInstalado() || document.getElementById("fb-inst")) return;
    const st = document.getElementById("status"); if (!st) return setTimeout(mostraInstalar, 800);
    const b = document.createElement("button"); b.id = "fb-inst"; b.type = "button"; b.className = "btn small";
    b.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 20h16"/></svg>Instalar app';
    b.title = "Instalar o Financeiro Casagrande neste computador ou celular";
    b.onclick = async () => { const p = pedidoInstalar; if (!p) return; pedidoInstalar = null; p.prompt(); try { const r = await p.userChoice; if (r && r.outcome === "accepted") b.remove(); else { pedidoInstalar = p; } } catch (e) {} };
    const ancora = document.getElementById("cotBox"); if (ancora) ancora.before(b); else st.after(b);
  }
  function addSair(u) {
    if (document.getElementById("fb-out")) return;
    const st = document.getElementById("status"); if (!st) return;
    const b = document.createElement("button"); b.id = "fb-out"; b.type = "button"; b.className = "btn small"; b.textContent = "Sair";
    b.title = "Conectado como " + (u.email || ""); b.onclick = () => auth.signOut();
    st.after(b);
  }

  /* ---------- PIN da família ---------- */
  // Um PIN só para toda a família, guardado no Firestore como hash (PBKDF2). É uma trava de tela:
  // a proteção dos dados continua sendo o login Google + as regras do Firestore.
  const pinRef = () => fs.collection("faturas").doc("_pin");
  const b64 = buf => btoa(String.fromCharCode(...new Uint8Array(buf)));
  async function pinHash(pin, saltB64, iter) {
    const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
    return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, key, 256));
  }
  const pinCss = `#fb-pin{position:fixed;inset:0;z-index:100000;background:#F3F5F8;background-image:radial-gradient(circle,#C7D0DE 1.1px,transparent 1.5px);background-size:9px 9px;display:flex;align-items:center;justify-content:center;padding:max(16px,env(safe-area-inset-top,0px)) 16px max(16px,env(safe-area-inset-bottom,0px));font-family:Inter,system-ui,sans-serif;color:#141C2B}
  #fb-pin .box{background:#fff;border:1px solid #DCE1EA;border-radius:22px;padding:24px 22px;max-width:340px;width:100%;text-align:center;box-shadow:0 12px 40px rgba(20,28,43,.16)}
  #fb-pin img{width:64px;height:64px;border-radius:16px}#fb-pin h2{font:700 22px "Bricolage Grotesque",Inter,sans-serif;margin:10px 0 2px;letter-spacing:-.01em}
  #fb-pin p{color:#5A6577;font-size:14px;margin:0 0 14px;min-height:1.4em}
  #fb-pin .dots{display:flex;gap:12px;justify-content:center;margin:6px 0 8px;height:16px}
  #fb-pin .dots i{width:14px;height:14px;border-radius:50%;border:2px solid #2341C9;display:block}#fb-pin .dots i.on{background:#2341C9}
  #fb-pin .dots.shake{animation:fbshake .35s}@keyframes fbshake{25%{transform:translateX(-8px)}75%{transform:translateX(8px)}}
  #fb-pin .err{color:#B42318;font-size:13px;min-height:1.3em;margin-bottom:6px}
  #fb-pin .pad{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:6px}
  #fb-pin .pad button{height:58px;border:1px solid #DCE1EA;border-radius:16px;background:#F3F5F8;font:600 22px Inter,sans-serif;color:#141C2B;cursor:pointer}
  #fb-pin .pad button:active{background:#E6EBFC}#fb-pin .pad button.txt{font-size:13px;font-weight:600;color:#2341C9;background:none;border-color:transparent}
  #fb-pin .ok{width:100%;margin-top:12px;border:0;border-radius:14px;padding:13px;font:600 16px Inter,sans-serif;background:#2341C9;color:#fff;cursor:pointer}#fb-pin .ok:disabled{opacity:.4}
  #fb-pin .ok[hidden]{display:none}#fb-pin .bio{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 12px;background:#141C2B}
  #fb-pin .sec{background:#ECEFF4;color:#141C2B}`;
  const ICONE_BIO = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 11v3a8 8 0 0 1-1.2 4.2M8.5 8.8A4 4 0 0 1 16 11v1.5M7.8 20A11 11 0 0 0 8 11a4 4 0 0 1 .2-1.3M16 15.5a15 15 0 0 1-.9 4.5M4.5 15.5A12 12 0 0 0 5 11a7 7 0 0 1 12.6-4.2M19 10.5c.2 2 .1 4-.3 6"/></svg>`;
  function escolha(titulo, texto, sim, nao) {
    return new Promise(resolve => {
      pinEl.innerHTML = `<div class="box"><img src="icon-192-v2.png" alt=""><h2></h2><p></p><button type="button" class="ok" data-r="1"></button><button type="button" class="ok sec" data-r="0"></button></div>`;
      pinEl.querySelector("h2").textContent = titulo; pinEl.querySelector("p").textContent = texto;
      const [a, b] = pinEl.querySelectorAll("button"); a.textContent = sim; b.textContent = nao; pinEl.hidden = false;
      pinEl.onclick = e => { const x = e.target.closest("button"); if (x) resolve(x.dataset.r === "1"); };
    });
  }
  let pinEl = null;
  function telaPin({ titulo, texto, tamanho, criar, esqueci, cancelar, bio }) {
    return new Promise(resolve => {
      if (!pinEl) { const st = document.createElement("style"); st.textContent = pinCss; document.head.appendChild(st); pinEl = document.createElement("div"); pinEl.id = "fb-pin"; pinEl.setAttribute("role", "dialog"); pinEl.setAttribute("aria-modal", "true"); document.body.appendChild(pinEl); }
      const max = tamanho || 6;
      pinEl.innerHTML = `<div class="box"><img src="icon-192-v2.png" alt=""><h2></h2><p></p>${bio ? `<button type="button" class="ok bio" data-x="bio">${ICONE_BIO} Usar digital ou Face ID</button>` : ""}<div class="dots" aria-live="polite"></div><div class="err"></div>
        <div class="pad">${[1,2,3,4,5,6,7,8,9].map(n => `<button type="button" data-n="${n}">${n}</button>`).join("")}
        <button type="button" class="txt" data-x="${esqueci ? "esqueci" : cancelar ? "cancelar" : ""}">${esqueci ? "Esqueci" : cancelar ? "Cancelar" : ""}</button><button type="button" data-n="0">0</button><button type="button" data-x="apagar" aria-label="Apagar">⌫</button></div>
        <button type="button" class="ok" ${criar ? "" : "hidden"} disabled>Continuar</button></div>`;
      pinEl.querySelector("h2").textContent = titulo; pinEl.querySelector("p").textContent = texto || "";
      pinEl.hidden = false;
      let v = "", bloqueado = false;
      const dots = pinEl.querySelector(".dots"), err = pinEl.querySelector(".err"), ok = pinEl.querySelector(".ok");
      const desenha = () => { dots.innerHTML = Array.from({ length: tamanho || Math.max(4, v.length) }, (_, i) => `<i class="${i < v.length ? "on" : ""}"></i>`).join(""); ok.disabled = v.length < 4; };
      const fim = r => { document.removeEventListener("keydown", tecla, true); resolve(r); };
      const api = { erro: m => { err.textContent = m; v = ""; dots.classList.remove("shake"); void dots.offsetWidth; dots.classList.add("shake"); desenha(); },
        travar: s => { bloqueado = true; let t = s; const tick = () => { err.textContent = "Muitas tentativas. Aguarde " + t + " s."; if (t-- <= 0) { bloqueado = false; err.textContent = ""; } else setTimeout(tick, 1000); }; tick(); } };
      const envia = () => { if (bloqueado || v.length < 4) return; const pin = v; fim({ pin, api }); };
      const digita = n => { if (bloqueado || v.length >= max) return; v += n; err.textContent = ""; desenha(); if (tamanho && v.length === tamanho) setTimeout(envia, 120); };
      const tecla = e => { if (pinEl.hidden) return; if (/^[0-9]$/.test(e.key)) { digita(e.key); e.preventDefault(); } else if (e.key === "Backspace") { v = v.slice(0, -1); desenha(); e.preventDefault(); } else if (e.key === "Enter" && criar) { envia(); e.preventDefault(); } };
      document.addEventListener("keydown", tecla, true);
      pinEl.onclick = e => { const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.n != null) digita(b.dataset.n);
        else if (b.dataset.x === "apagar") { v = v.slice(0, -1); desenha(); }
        else if (b.dataset.x === "esqueci") fim({ esqueci: true });
        else if (b.dataset.x === "cancelar") fim({ cancelar: true });
        else if (b.dataset.x === "bio") fim({ bio: true });
        else if (b.classList.contains("ok")) envia(); };
      desenha();
      // reaproveita a mesma tela para a próxima chamada
      telaPin.atual = api;
    });
  }
  async function criarPin(textoInicio) {
    for (;;) {
      const a = await telaPin({ titulo: "Crie o PIN da família", texto: textoInicio || "De 4 a 6 números. Vale para todos os aparelhos.", criar: true });
      const b = await telaPin({ titulo: "Repita o PIN", texto: "Digite o mesmo PIN de novo.", tamanho: a.pin.length });
      if (a.pin !== b.pin) { textoInicio = "Os PINs não eram iguais. Comece de novo."; continue; }
      const salt = b64(crypto.getRandomValues(new Uint8Array(16))), iter = 150000;
      await pinRef().set({ kind: "pin", salt, iter, len: a.pin.length, hash: await pinHash(a.pin, salt, iter), criadoPor: atual && atual.email || "", criadoEm: new Date().toISOString() });
      return;
    }
  }
  /* ---------- biometria do aparelho (digital / Face ID) ---------- */
  // Credencial do próprio celular (WebAuthn). Fica só neste aparelho; o PIN continua valendo.
  const BIO = "faturasBio", BIO_NAO = "faturasBioNao";
  const deB64 = t => Uint8Array.from(atob(t), c => c.charCodeAt(0));
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
  async function bioDisponivel() { try { return !!(window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()); } catch { return false; } }
  async function bioAtivar() {
    const u = atual || {};
    const cred = await navigator.credentials.create({ publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)), rp: { name: "Financeiro Casagrande" },
      user: { id: new TextEncoder().encode(String(u.uid || "familia").slice(0, 64)), name: u.email || "familia", displayName: u.displayName || u.email || "Família Casagrande" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "discouraged" },
      timeout: 60000, attestation: "none" } });
    ls.set(BIO, b64(cred.rawId)); ls.set(BIO_NAO, null);
  }
  async function bioConferir() {
    const id = ls.get(BIO); if (!id) return false;
    try { await navigator.credentials.get({ publicKey: { challenge: crypto.getRandomValues(new Uint8Array(32)), allowCredentials: [{ type: "public-key", id: deB64(id), transports: ["internal"] }], userVerification: "required", timeout: 60000 } }); return true; }
    catch (e) { if (e && e.name === "InvalidStateError") ls.set(BIO, null); return false; }
  }

  async function pedirPin(cfg, opts) {
    const temBio = !!ls.get(BIO) && !(opts && opts.semBio);
    const base = Object.assign({ titulo: "Digite o PIN", texto: "Financeiro da família Casagrande", tamanho: cfg.len, esqueci: true, bio: temBio }, opts);
    let erradas = 0, msg = "", trava = 0, primeira = true;
    for (;;) {
      const espera = telaPin(base);          // a tela do PIN aparece na hora
      const api = telaPin.atual;
      if (msg) { api.erro(msg); if (trava) api.travar(trava); }
      // biometria automática só na primeira tela; se o aparelho não mostrar o pedido, o PIN continua ali
      const auto = temBio && primeira ? bioConferir().then(ok => ok ? { bioOk: true } : new Promise(() => {})) : new Promise(() => {});
      primeira = false;
      const r = await Promise.race([espera, auto]);
      if (r.bioOk) return { ok: true, bio: true };
      if (r.esqueci || r.cancelar) return r;
      if (r.bio) { if (await bioConferir()) return { ok: true, bio: true }; msg = "Não deu para usar a biometria. Use o PIN."; trava = 0; continue; }
      if (await pinHash(r.pin, cfg.salt, cfg.iter) === cfg.hash) return { ok: true };
      erradas++; msg = "PIN incorreto."; trava = erradas % 5 === 0 ? 30 : 0;
    }
  }
  async function portaPin(volta) {
    let cfg = null;
    try { const d = await pinRef().get(); cfg = d.exists ? d.data() : null; } catch {}
    let reset = false; try { reset = sessionStorage.getItem("faturasPinReset") === "1"; sessionStorage.removeItem("faturasPinReset"); } catch {}
    if (!cfg || !cfg.hash || reset) { await criarPin(reset ? "Você entrou de novo com o Google. Crie um PIN novo para a família." : null); await oferecerBio(); pinEl.hidden = true; return; }
    const r = await pedirPin(cfg);
    if (r.esqueci) { try { sessionStorage.setItem("faturasPinReset", "1"); } catch {} pinEl.hidden = true; await auth.signOut(); location.reload(); return new Promise(() => {}); }
    await oferecerBio();
    pinEl.hidden = true;
  }
  async function oferecerBio() {
    if (ls.get(BIO) || ls.get(BIO_NAO) || !(await bioDisponivel())) return;
    const sim = await escolha("Entrar com digital ou Face ID?", "Neste aparelho, você pode destravar o app com a biometria do celular. O PIN continua valendo.", "Usar biometria", "Agora não");
    if (!sim) { ls.set(BIO_NAO, "1"); return; }
    try { await bioAtivar(); } catch { ls.set(BIO_NAO, "1"); }
  }
  window.__fbBio = {
    disponivel: bioDisponivel, ativa: () => !!ls.get(BIO),
    ativar: async () => { await bioAtivar(); return true; },
    desativar: () => { ls.set(BIO, null); ls.set(BIO_NAO, "1"); }
  };
  // Volta a pedir o PIN se o app ficou fechado/em segundo plano por mais de 3 minutos.
  let escondidoEm = 0, pedindo = false;
  document.addEventListener("visibilitychange", async () => {
    if (document.hidden) { escondidoEm = Date.now(); return; }
    if (!aberto || pedindo || !escondidoEm || Date.now() - escondidoEm < 3 * 60 * 1000) return;
    pedindo = true; try { await portaPin(true); } finally { pedindo = false; }
  });
  window.__fbChangePin = async () => {
    let cfg = null; try { const d = await pinRef().get(); cfg = d.exists ? d.data() : null; } catch {}
    if (cfg && cfg.hash) { const r = await pedirPin(cfg, { titulo: "PIN atual", texto: "Para trocar, digite o PIN atual.", esqueci: false, cancelar: true }); if (!r.ok) { pinEl.hidden = true; return false; } }
    await criarPin("Escolha o novo PIN (4 a 6 números)."); pinEl.hidden = true; return true;
  };

  window.claude = { use: async name => { await pronto; return name === "db" ? db : name === "user" ? user : null; } };
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
