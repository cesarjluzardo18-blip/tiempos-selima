// Envía un aviso de prueba a los administradores (se lanza al cambiar avisos/prueba.txt)
const admin = require("firebase-admin");
const URL_APP = "https://cesarjluzardo18-blip.github.io/tiempos-selima/";
if (!process.env.FIREBASE_SA) { console.log("Falta FIREBASE_SA"); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SA)) });
const db = admin.firestore();
(async () => {
  const us = await db.collection("usuarios").where("rol", "==", "admin").get();
  if (us.empty) { console.log("No hay administrador registrado"); process.exit(1); }
  for (const d of us.docs) {
    const tokens = ((await db.doc(`data/users/${d.id}/push`).get()).data() || {}).tokens || [];
    console.log(`${d.data().nombre}: ${tokens.length} dispositivo(s) con avisos activados`);
    if (!tokens.length) continue;
    const r = await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title: "Tiempos Selima", body: "¡Prueba de Claude! Si ves esto, los avisos funcionan. 🎉" },
      webpush: { fcmOptions: { link: URL_APP }, notification: { icon: URL_APP + "icon-192.png" } }
    });
    r.responses.forEach((x, i) => console.log(`  dispositivo ${i + 1}: ${x.success ? "enviado" : "error " + x.error.code}`));
  }
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
