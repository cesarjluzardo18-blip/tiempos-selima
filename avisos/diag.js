// Diagnóstico de solo lectura (temporal)
const admin = require("firebase-admin");
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = admin.firestore();
(async () => {
  const ad = (await db.collection("usuarios").where("rol", "==", "admin").get()).docs[0];
  const uid = ad.id; console.log("admin", ad.data().nombre);
  const act = await db.collection("actividad").orderBy("cuando", "desc").limit(25).get();
  console.log("--- actividad reciente");
  act.docs.forEach(d => { const a = d.data(); console.log(a.cuando, "|", a.por, "|", a.accion, "|", a.cliente, "|", a.clienteId) });
  const pc = await db.collection(`data/users/${uid}/clientes`).get();
  console.log("--- privadas:", pc.size);
  pc.docs.forEach(d => { const c = d.data(); console.log(d.id, "|", c.cliente, "| borrado:", !!c.borrado, "| editado:", c.editado || "", "| fecha:", c.fecha) });
  const tr = await db.collection("clientes").where("borrado", "==", true).get();
  console.log("--- papelera compartida:", tr.size);
  tr.docs.forEach(d => { const c = d.data(); console.log(d.id, "|", c.cliente, "|", c.borradoEn, "|", c.borradoPor) });
  const md = await db.doc(`data/users/${uid}/midia`).get();
  console.log("--- midia", JSON.stringify(md.data()));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
