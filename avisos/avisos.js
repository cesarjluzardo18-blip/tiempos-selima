// Revisa la actividad de Tiempos Selima y envía notificaciones push.
// Lo ejecuta GitHub Actions cada pocos minutos (gratis). Necesita el secreto FIREBASE_SA.
const admin = require("firebase-admin");
const URL_APP = "https://cesarjluzardo18-blip.github.io/tiempos-selima/";

if (!process.env.FIREBASE_SA) { console.log("Falta el secreto FIREBASE_SA: no se envían avisos todavía."); process.exit(0); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = admin.firestore();

async function main() {
  const estadoRef = db.doc("ajustes/push-estado");
  const estado = (await estadoRef.get()).data() || {};
  const desde = estado.ultimo || new Date(Date.now() - 15 * 60000).toISOString();

  const usuarios = {};
  (await db.collection("usuarios").get()).forEach(d => (usuarios[d.id] = d.data()));
  const admins = Object.keys(usuarios).filter(id => usuarios[id].rol === "admin");
  const aprobados = Object.keys(usuarios).filter(id => usuarios[id].estado === "aprobado" || usuarios[id].rol === "admin");

  const cola = {}; // uid -> [mensajes]
  const avisar = (uids, body, title = "Tiempos Selima") => uids.forEach(u => (cola[u] = cola[u] || []).push({ title, body }));

  // 1. Personas nuevas que piden acceso
  for (const [id, u] of Object.entries(usuarios)) {
    if (u.estado === "pendiente" && !u.avisoPendiente) {
      avisar(admins, `${u.nombre || "Alguien"} pide acceso. Entra en Personas para aceptarlo.`, "Nueva persona");
      await db.doc("usuarios/" + id).update({ avisoPendiente: true });
    }
  }

  // 2. Actividad nueva
  const acts = await db.collection("actividad").where("cuando", ">", desde).orderBy("cuando").get();
  let ultimo = desde;
  acts.forEach(d => {
    const a = d.data(); ultimo = a.cuando > ultimo ? a.cuando : ultimo;
    const quien = a.por || "Alguien", que = a.cliente ? `«${a.cliente}»` : "";
    const otros = l => l.filter(u => u !== a.porId);
    if (a.accion === "añadió" || a.accion === "editó") avisar(otros(aprobados), `${quien} ${a.accion} ${que}`);
    else if (a.accion === "movió a la papelera" || a.accion === "borró para siempre") avisar(otros(admins), `${quien} ${a.accion} ${que}`, "Algo se ha borrado");
    else if (a.accion === "dio acceso a" && a.clienteId) avisar([a.clienteId], "Ya tienes acceso. Abre la app para entrar.", "¡Bienvenido a Tiempos Selima!");
  });

  // 3. Enviar
  for (const [uid, msgs] of Object.entries(cola)) {
    const ref = db.doc(`data/users/${uid}/push`);
    const tokens = ((await ref.get()).data() || {}).tokens || [];
    if (!tokens.length) continue;
    const m = msgs.length > 3 ? { title: "Tiempos Selima", body: `${msgs.length} cambios nuevos. Último: ${msgs[msgs.length - 1].body}` } : null;
    const lista = m ? [m] : msgs;
    const malos = new Set();
    for (const n of lista) {
      const r = await admin.messaging().sendEachForMulticast({
        tokens,
        notification: { title: n.title, body: n.body },
        webpush: { fcmOptions: { link: URL_APP }, notification: { icon: URL_APP + "icon-192.png", badge: URL_APP + "icon-192.png" } }
      });
      r.responses.forEach((x, i) => {
        const c = x.error && x.error.code;
        if (c === "messaging/registration-token-not-registered" || c === "messaging/invalid-registration-token") malos.add(tokens[i]);
      });
      console.log(`→ ${usuarios[uid]?.nombre || uid}: ${n.body} (${r.successCount}/${tokens.length})`);
    }
    if (malos.size) await ref.update({ tokens: tokens.filter(t => !malos.has(t)) });
  }

  await estadoRef.set({ ultimo, revisado: new Date().toISOString() }, { merge: true });
  console.log(`Revisado. ${acts.size} movimientos nuevos.`);
}
main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
