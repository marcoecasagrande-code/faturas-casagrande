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
    tela.innerHTML = `<div class="box"><img src="icon-192.png" alt=""><h1>Faturas <span>Casagrande</span></h1><p>Entre com a sua conta Google da família.</p>
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
  auth.getRedirectResult().catch(() => {});
  auth.onAuthStateChanged(async u => {
    if (!u) { if (aberto) location.reload(); return document.readyState === "loading" ? addEventListener("DOMContentLoaded", () => mostrarLogin()) : mostrarLogin(); }
    try { await fs.collection("faturas").limit(1).get(); }
    catch (e) { if (e && e.code === "permission-denied") return mostrarLogin(`A conta ${u.email} não tem acesso às faturas da família.`, true); }
    atual = u;
    if (tela) tela.hidden = true; aberto = true; liberar();
    addSair(u);
  });
  function addSair(u) {
    if (document.getElementById("fb-out")) return;
    const st = document.getElementById("status"); if (!st) return;
    const b = document.createElement("button"); b.id = "fb-out"; b.type = "button"; b.className = "btn small"; b.textContent = "Sair";
    b.title = "Conectado como " + (u.email || ""); b.onclick = () => auth.signOut();
    st.after(b);
  }

  window.claude = { use: async name => { await pronto; return name === "db" ? db : name === "user" ? user : null; } };
  if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
})();
