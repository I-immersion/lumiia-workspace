// ════════════════════════════════════════════════════════════════════
// LUMIIA Bons Kdo — Cloud Functions (v0.2)
// ════════════════════════════════════════════════════════════════════
// Format ticket de concert A5 paysage (210x148mm)
// - Zone principale gauche (~75%) + stub QR validation droite (~25%)
// - Logo Team Building couleur, fond degrade bleu nuit
// - 3 variantes : standard (cyan), vip (lime), consolation (magenta)
// ════════════════════════════════════════════════════════════════════

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getDatabase } = require('firebase-admin/database');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Mailjet = require('node-mailjet');

const { LUMIIA_LOGO_PNG_B64, LUMIIA_LOGO_MAIL_B64 } = require('./assets');

const MAILJET_PUBLIC_KEY = defineSecret('MAILJET_PUBLIC_KEY');
const MAILJET_SECRET_KEY = defineSecret('MAILJET_SECRET_KEY');

// ── Constantes LUMIIA ──────────────────────────────────────────────
const LUMIIA = {
  adresse: '1 route de Fontagnal — 26400 Aouste-sur-Sye',
  tel: '06 50 88 60 91',
  web: 'lumiia.fr',
  email: 'contact@lumiia.fr',
  nom_expediteur: 'LUMIIA — Emmanuel Exbrayat',
};

const SCAN_BASE_URL = 'https://i-immersion.github.io/bons_kdo/scan';

// ── Couleurs LUMIIA ────────────────────────────────────────────────
const C = {
  bgTop: '#0a0a3e', bgMid: '#1a1a64', bgBot: '#0e0e30',
  cyan: '#4dd9e8', mag: '#d946ef', violet: '#a855f7',
  lime: '#b8ff3c', white: '#ffffff', soft: '#c9c2e8',
  dim: '#9b9bcb', muted: '#5a5a8a',
};

const LOGO_BUFFER = Buffer.from(LUMIIA_LOGO_PNG_B64, 'base64');

// Format A5 paysage en points (595 x 420)
const PAGE = { w: 595, h: 420 };
const STUB_X = 445;
const STUB_W = PAGE.w - STUB_X;

// ════════════════════════════════════════════════════════════════════
// CODE UNIQUE
// ════════════════════════════════════════════════════════════════════
function genererCodeUnique() {
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return code;
}

// ════════════════════════════════════════════════════════════════════
// FORMATAGE DATE FR
// ════════════════════════════════════════════════════════════════════
function formaterDateFr(iso) {
  if (!iso) return '';
  const MOIS = ['janvier','fevrier','mars','avril','mai','juin',
                'juillet','aout','septembre','octobre','novembre','decembre'];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear();
}

function dateValiditeDefault(type) {
  // VIP team building → 30 sept 2026, autres → 30 juin 2026
  return type === 'vip' ? '2026-09-30' : '2026-06-30';
}

function accentColor(type) {
  if (type === 'vip') return C.lime;
  if (type === 'consolation') return C.mag;
  return C.cyan;
}

function labelHeader(type) {
  if (type === 'vip') return 'GRAND GAGNANT';
  return 'BON CADEAU';
}

// ════════════════════════════════════════════════════════════════════
// GENERATEUR PDF — TICKET A5 PAYSAGE
// ════════════════════════════════════════════════════════════════════
async function genererBonPDF(bon, evenement) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [PAGE.w, PAGE.h],
        margin: 0,
        info: {
          Title: 'Bon cadeau LUMIIA - ' + (bon.lot || 'Cadeau'),
          Author: 'LUMIIA',
        },
      });

      const chunks = [];
      doc.on('data', c => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const type = bon.type || 'standard';
      const accent = accentColor(type);

      // ── FOND DEGRADE BLEU NUIT ──
      const grad = doc.linearGradient(0, 0, PAGE.w, PAGE.h);
      grad.stop(0, C.bgTop).stop(0.55, C.bgMid).stop(1, C.bgBot);
      doc.rect(0, 0, PAGE.w, PAGE.h).fill(grad);

      // Halos colores en coins
      doc.save();
      doc.circle(60, 50, 180).fillOpacity(0.28).fill(C.mag);
      doc.circle(540, 380, 200).fillOpacity(0.22).fill(C.cyan);
      doc.fillOpacity(1);
      doc.restore();

      // ── LIGNE POINTILLEE VERTICALE ──
      doc.save();
      doc.lineWidth(1).strokeColor(C.cyan).strokeOpacity(0.55).dash(2, { space: 5 });
      doc.moveTo(STUB_X, 25).lineTo(STUB_X, PAGE.h - 25).stroke();
      doc.undash().strokeOpacity(1);
      doc.restore();

      // ════════════════════════════════════════════════
      // ZONE PRINCIPALE (gauche)
      // ════════════════════════════════════════════════
      const ML = 36;
      const MR_main = STUB_X - 30;

      // Logo TB largeur 320pt
      doc.image(LOGO_BUFFER, ML, 28, { width: 320 });

      // Bandeau type + evenement
      const yHeader = 130;
      doc.fillColor(accent).font('Helvetica-Bold').fontSize(10);
      doc.text(labelHeader(type), ML, yHeader, { characterSpacing: 3 });

      doc.fillColor(C.dim).font('Helvetica').fontSize(10);
      doc.text((evenement.nom || '').toUpperCase(), ML, yHeader + 18,
               { width: MR_main - ML });

      doc.moveTo(ML, yHeader + 38).lineTo(MR_main, yHeader + 38)
         .strokeColor(C.cyan).strokeOpacity(0.35).lineWidth(0.6).stroke().strokeOpacity(1);

      // Bloc nom et prenom
      const yNom = yHeader + 60;
      doc.fillColor(C.dim).font('Helvetica').fontSize(8);
      doc.text('NOM ET PRENOM', ML, yNom, { characterSpacing: 2 });

      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(18);
      doc.text(bon.nom || '', ML, yNom + 14, { width: MR_main - ML });

      // Bloc societe
      const ySoc = yNom + 44;
      doc.fillColor(C.dim).font('Helvetica').fontSize(8);
      doc.text('SOCIETE', ML, ySoc, { characterSpacing: 2 });

      doc.fillColor(C.soft).font('Helvetica-Bold').fontSize(15);
      doc.text(bon.co || '—', ML, ySoc + 14, { width: MR_main - ML });

      // Trait fin separateur
      const ySep2 = ySoc + 42;
      doc.moveTo(ML, ySep2).lineTo(MR_main, ySep2)
         .strokeColor(C.cyan).strokeOpacity(0.18).lineWidth(0.4).stroke().strokeOpacity(1);

      // Bloc votre lot
      const yLot = ySep2 + 14;
      doc.fillColor(C.lime).font('Helvetica-Bold').fontSize(8.5);
      doc.text('VOTRE LOT', ML, yLot, { characterSpacing: 2.5 });

      const lotText = bon.lot || '';
      const lotFontSize = lotText.length > 60 ? 14 : (lotText.length > 35 ? 16 : 19);
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(lotFontSize);
      doc.text(lotText, ML, yLot + 16, {
        width: MR_main - ML, lineGap: 3,
      });

      // Footer
      const yFoot = PAGE.h - 50;
      doc.moveTo(ML, yFoot - 8).lineTo(MR_main, yFoot - 8)
         .strokeColor(C.cyan).strokeOpacity(0.35).lineWidth(0.6).stroke().strokeOpacity(1);

      doc.fillColor(C.cyan).font('Helvetica-Bold').fontSize(8);
      doc.text('LUMIIA · EMMANUEL EXBRAYAT', ML, yFoot, { characterSpacing: 2.5 });

      doc.fillColor(C.dim).font('Helvetica').fontSize(7.5);
      doc.text(LUMIIA.adresse + '   ·   ' + LUMIIA.tel + '   ·   ' + LUMIIA.web,
               ML, yFoot + 12, { width: MR_main - ML });

      doc.fillColor(C.muted).font('Helvetica').fontSize(6.5);
      doc.text('Bon nominatif et non cessible. Sur reservation, sous reserve de disponibilite.',
               ML, yFoot + 23, { width: MR_main - ML });

      // ════════════════════════════════════════════════
      // STUB (droite)
      // ════════════════════════════════════════════════
      const SX = STUB_X + 6;
      const SW = STUB_W - 12;
      const SCenter = SX + SW / 2;

      // QR code
      const qrUrl = SCAN_BASE_URL + '?code=' + bon.code_unique;
      const qrBuffer = await QRCode.toBuffer(qrUrl, {
        errorCorrectionLevel: 'M',
        margin: 1, width: 280,
        color: { dark: '#000000', light: '#ffffff' },
      });

      const qrSize = 100;
      const qrY = 35;
      doc.roundedRect(SCenter - qrSize/2 - 5, qrY - 5, qrSize + 10, qrSize + 10, 6)
         .fillColor(C.white).fill();
      doc.image(qrBuffer, SCenter - qrSize/2, qrY, { width: qrSize });

      // "Scannez a l'accueil"
      doc.fillColor(C.dim).font('Helvetica').fontSize(7);
      doc.text("SCANNEZ A L ACCUEIL", SX, qrY + qrSize + 12,
               { width: SW, align: 'center', characterSpacing: 1.2 });

      // CODE en gros
      const yCode = qrY + qrSize + 36;
      doc.fillColor(C.dim).font('Helvetica').fontSize(7);
      doc.text('CODE', SX, yCode, { width: SW, align: 'center', characterSpacing: 2.2 });

      const code = bon.code_unique || '';
      const code1 = code.slice(0, 4);
      const code2 = code.slice(4, 8);
      doc.fillColor(C.lime).font('Courier-Bold').fontSize(19);
      doc.text(code1, SX, yCode + 14,
               { width: SW, align: 'center', characterSpacing: 2.5 });
      doc.text(code2, SX, yCode + 36,
               { width: SW, align: 'center', characterSpacing: 2.5 });

      // Trait separateur
      const ySepStub = yCode + 64;
      doc.moveTo(SX, ySepStub).lineTo(SX + SW, ySepStub)
         .strokeColor(C.cyan).strokeOpacity(0.3).lineWidth(0.4).stroke().strokeOpacity(1);

      // Date validite
      const yDate = ySepStub + 12;
      doc.fillColor(C.dim).font('Helvetica').fontSize(7);
      doc.text("VALIDE JUSQU AU", SX, yDate,
               { width: SW, align: 'center', characterSpacing: 1.8 });

      const dateValide = bon.date_validite || dateValiditeDefault(type);
      doc.fillColor(C.white).font('Helvetica-Bold').fontSize(12);
      doc.text(formaterDateFr(dateValide), SX, yDate + 14,
               { width: SW, align: 'center' });

      // Bandeau evenement bas du stub
      // Date d'abord (1 ligne), nom evenement ensuite (peut etre sur 2 lignes)
      const dateEv = evenement.date ? formaterDateFr(evenement.date) : '';
      const nomEvShort = (evenement.nom || '').replace(/\s+\u2014\s+.*$/, '').toUpperCase();

      // Position du bandeau, calee depuis le bas
      const yEvSep = PAGE.h - 60;
      doc.moveTo(SX, yEvSep).lineTo(SX + SW, yEvSep)
         .strokeColor(C.cyan).strokeOpacity(0.3).lineWidth(0.4).stroke().strokeOpacity(1);

      doc.fillColor(C.dim).font('Helvetica').fontSize(6.5);
      doc.text(dateEv, SX, yEvSep + 7, { width: SW, align: 'center' });

      doc.fillColor(C.cyan).font('Helvetica-Bold').fontSize(7);
      doc.text(nomEvShort, SX, yEvSep + 22,
               { width: SW, align: 'center', characterSpacing: 1.2, lineGap: 1 });

      doc.end();
    } catch (e) { reject(e); }
  });
}

// ════════════════════════════════════════════════════════════════════
// TEMPLATE EMAIL HTML — Direction A : Neon Gradient festif
// Logo embarque en CID Mailjet (cid:lumiia_logo)
// ════════════════════════════════════════════════════════════════════
function templateEmailHTML(bon, evenement) {
  const type = bon.type || 'standard';
  const prenom = (bon.nom || '').split(' ')[0] || 'cher gagnant';

  // Couleur d accent visible sur fond CLAIR (versions assombries des couleurs neon)
  const ACCENT_DARK = type === 'vip' ? '#5e7a0e'
                    : type === 'consolation' ? '#a02d8a'
                    : '#1d8a9a';

  let titreHero, sousTitreHero, corps, lotDisplay;
  if (type === 'vip') {
    titreHero = '🏆 Vous avez gagné !';
    sousTitreHero = 'Soirée des Lauréats REDA · 28 avril 2026';
    lotDisplay = 'Team Building 1000 €';
    corps = `<p style="margin:0 0 16px 0;">Bonjour <strong>${prenom}</strong>,</p>
      <p style="margin:0 0 16px 0;">C'est officiel : vous êtes <strong>la grande gagnante du tirage au sort</strong> de la Soirée des Lauréats REDA !</p>
      <p style="margin:0 0 16px 0;">Votre lot : un <strong style="color:${ACCENT_DARK};">Team Building d'une valeur de 1000 €</strong> chez LUMIIA pour votre équipe ${bon.co ? '<strong>' + bon.co + '</strong>' : ''}.</p>
      <p style="margin:0 0 16px 0;">Votre bon cadeau est en pièce jointe (PDF). <strong>Contactez-nous pour organiser cet événement avec votre équipe</strong> au moment qui vous conviendra le mieux.</p>
      <p style="margin:24px 0 0 0;font-size:18px;color:${ACCENT_DARK};font-weight:700;">Félicitations ! 🎉</p>`;
  } else if (type === 'consolation') {
    titreHero = '🍹 Un cocktail pour vous';
    sousTitreHero = 'Soirée des Lauréats REDA · 28 avril 2026';
    lotDisplay = bon.lot || '';
    corps = `<p style="margin:0 0 16px 0;">Bonjour <strong>${prenom}</strong>,</p>
      <p style="margin:0 0 16px 0;">Vous étiez l'un des <strong>5 finalistes</strong> du tirage au sort Team Building 1000 € lors de la Soirée des Lauréats REDA du 28 avril dernier.</p>
      <p style="margin:0 0 16px 0;">Cette fois la chance a souri à <strong>Florence Martin</strong> (Pic group) qui remporte le grand lot. Mais on ne vous laisse pas repartir les mains vides : un <strong style="color:${ACCENT_DARK};">cocktail au choix au LUMIIA Bar</strong> vous attend pour trinquer avec nous.</p>
      <p style="margin:0;">Votre bon cadeau est en pièce jointe (PDF). Sortez-le sur votre téléphone à votre arrivée — on s'occupe du reste.</p>`;
  } else {
    titreHero = '🎁 Vous avez gagné !';
    sousTitreHero = 'Soirée des Lauréats REDA · 28 avril 2026';
    lotDisplay = bon.lot || '';
    corps = `<p style="margin:0 0 16px 0;">Bonjour <strong>${prenom}</strong>,</p>
      <p style="margin:0 0 16px 0;">Merci pour votre participation à la <strong>Soirée des Lauréats du Réseau Entreprendre Drôme-Ardèche</strong> du 28 avril 2026 !</p>
      <p style="margin:0;">Votre bon cadeau est en pièce jointe (PDF). Imprimez-le ou présentez-le simplement sur votre téléphone à votre arrivée chez nous.</p>`;
  }

  return `<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${titreHero}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a3e;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 4px 24px rgba(26,26,62,0.08);">

      <!-- HEADER NEON GRADIENT avec logo -->
      <tr><td style="background:#0a0a3e;background-image:linear-gradient(135deg,#0a0a3e 0%,#3a1a78 50%,#5a2a8e 100%);padding:36px 24px;text-align:center;">
        <img src="cid:lumiia_logo" alt="LUMIIA - Team Building Fun &amp; Augmenté - Studio Podcast Professionnel" width="380" style="display:inline-block;max-width:90%;height:auto;border:0;outline:none;">
      </td></tr>

      <!-- HERO -->
      <tr><td style="background:#ffffff;padding:36px 32px 16px 32px;text-align:center;">
        <h1 style="margin:0 0 10px 0;font-size:28px;font-weight:900;color:#1a1a3e;letter-spacing:-0.02em;">${titreHero}</h1>
        <p style="margin:0;font-size:13px;color:#7a8295;letter-spacing:1px;text-transform:uppercase;">${sousTitreHero}</p>
      </td></tr>

      <!-- LOT EN GROS - bandeau neon -->
      <tr><td style="padding:0 32px 12px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td style="background:#0a0a3e;background-image:linear-gradient(135deg,#0a0a3e 0%,#3a1a78 100%);border-radius:12px;padding:24px 20px;text-align:center;">
            <div style="font-size:11px;color:#b8ff3c;letter-spacing:2.5px;font-weight:700;margin-bottom:10px;">VOTRE LOT</div>
            <div style="font-size:${type === 'vip' ? '26px' : '18px'};font-weight:900;color:#ffffff;line-height:1.3;">${lotDisplay}</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- CORPS -->
      <tr><td style="padding:24px 32px;color:#1a1a3e;font-size:15px;line-height:1.6;">
        ${corps}
      </td></tr>

      <!-- BLOC CODE -->
      <tr><td style="padding:0 32px 32px 32px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr><td style="background:#f4f6fb;border:2px solid ${ACCENT_DARK};border-radius:12px;padding:18px 20px;text-align:center;">
            <div style="font-size:10px;color:${ACCENT_DARK};letter-spacing:2px;font-weight:700;margin-bottom:8px;">📎 CODE DE VALIDATION</div>
            <div style="font-family:'Courier New',monospace;font-size:24px;font-weight:700;color:#1a1a3e;letter-spacing:5px;">${bon.code_unique || ''}</div>
            <div style="margin-top:10px;font-size:12px;color:#7a8295;">Bon cadeau au format PDF en pièce jointe</div>
          </td></tr>
        </table>
      </td></tr>

      <!-- SIGNATURE -->
      <tr><td style="padding:0 32px 28px 32px;color:#4a5170;font-size:14px;line-height:1.5;">
        <p style="margin:0;">À très bientôt chez LUMIIA,</p>
        <p style="margin:4px 0 0 0;font-weight:700;color:#1a1a3e;">Emmanuel Exbrayat</p>
        <p style="margin:0;font-size:12px;color:#7a8295;">Fondateur · LUMIIA</p>

        <div style="margin-top:18px;padding-top:14px;border-top:1px solid #e5e7eb;">
          <p style="margin:0 0 8px 0;font-size:12px;color:#7a8295;font-weight:700;letter-spacing:0.5px;">Découvrez nos activités :</p>
          <p style="margin:0;font-size:13px;color:#4a5170;line-height:1.65;">
            🎮 <strong style="color:#1a1a3e;">LUMIIA</strong> — Espace de jeux &amp; bar immersif<br>
            <a href="https://www.lumiia.fr" style="color:#1d8a9a;text-decoration:none;font-size:12px;">www.lumiia.fr</a>
          </p>
          <p style="margin:8px 0 0 0;font-size:13px;color:#4a5170;line-height:1.65;">
            🎙️ <strong style="color:#1a1a3e;">LUMIIA Studios</strong> — Team building &amp; podcast vidéo<br>
            <a href="https://www.lumiiastudios.fr" style="color:#1d8a9a;text-decoration:none;font-size:12px;">www.lumiiastudios.fr</a>
            <span style="color:#9b9bcb;font-size:11px;font-style:italic;">(site en construction)</span>
          </p>
        </div>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:24px 32px;background:#f4f6fb;text-align:center;color:#7a8295;font-size:11px;line-height:1.7;border-top:1px solid #e5e7eb;">
        <strong style="color:#1a1a3e;font-size:12px;">${LUMIIA.adresse}</strong><br>
        ${LUMIIA.tel} · <a href="https://${LUMIIA.web}" style="color:#7a8295;text-decoration:none;">${LUMIIA.web}</a> · ${LUMIIA.email}
      </td></tr>
    </table>
  </td></tr>
</table></body></html>`;
}

// ════════════════════════════════════════════════════════════════════
// ENVOI MAILJET
// ════════════════════════════════════════════════════════════════════
async function envoyerMailjet(bon, evenement, pdfBuffer, publicKey, secretKey, overrideEmail) {
  const mailjet = new Mailjet({ apiKey: publicKey, apiSecret: secretKey });
  const html = templateEmailHTML(bon, evenement);

  const type = bon.type || 'standard';
  const sujets = {
    standard: '🎁 Fête des Lauréats REDA — LUMIIA : Vous avez gagné un bon cadeau !',
    vip: '🏆 Fête des Lauréats REDA — LUMIIA : Vous avez gagné le Team Building 1000€ !',
    consolation: '🍹 Fête des Lauréats REDA — LUMIIA : Un cocktail pour vous remercier',
  };

  const destinataire = overrideEmail || bon.email;
  if (!destinataire) throw new Error('Pas d email destinataire');

  const filenameSafe = (bon.code_unique || 'bon').replace(/[^A-Z0-9]/gi, '');
  const result = await mailjet.post('send', { version: 'v3.1' }).request({
    Messages: [{
      From: { Email: LUMIIA.email, Name: LUMIIA.nom_expediteur },
      To: [{ Email: destinataire, Name: bon.nom || '' }],
      Subject: sujets[type] || sujets.standard,
      HTMLPart: html,
      InlinedAttachments: [{
        ContentType: 'image/png',
        Filename: 'lumiia_logo.png',
        ContentID: 'lumiia_logo',
        Base64Content: LUMIIA_LOGO_MAIL_B64,
      }],
      Attachments: [{
        ContentType: 'application/pdf',
        Filename: 'bon_cadeau_LUMIIA_' + filenameSafe + '.pdf',
        Base64Content: pdfBuffer.toString('base64'),
      }],
      CustomID: 'bon_kdo_' + bon.id,
    }],
  });

  const msgs = result.body && result.body.Messages;
  if (!msgs || !msgs[0] || msgs[0].Status !== 'success') {
    throw new Error('Mailjet a refuse l envoi : ' + JSON.stringify(msgs));
  }
  return msgs[0].To[0].MessageID;
}

// ════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION : sendBonEmail
// ════════════════════════════════════════════════════════════════════
exports.sendBonEmail = onCall(
  {
    region: 'europe-west1',
    secrets: [MAILJET_PUBLIC_KEY, MAILJET_SECRET_KEY],
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Auth requise.');
    }

    const { evenement_id, bon_id, test_email } = req.data || {};
    if (!evenement_id || !bon_id) {
      throw new HttpsError('invalid-argument', 'evenement_id et bon_id requis');
    }

    const db = getDatabase();
    const [evSnap, bonSnap] = await Promise.all([
      db.ref('bons_kdo/evenements/' + evenement_id).get(),
      db.ref('bons_kdo/bons/' + bon_id).get(),
    ]);

    const evenement = evSnap.val();
    const bon = bonSnap.val();
    if (!evenement) throw new HttpsError('not-found', 'Evenement introuvable');
    if (!bon) throw new HttpsError('not-found', 'Bon introuvable');

    bon.id = bon_id;

    const pdfBuffer = await genererBonPDF(bon, evenement);

    const mailjetId = await envoyerMailjet(
      bon, evenement, pdfBuffer,
      MAILJET_PUBLIC_KEY.value(), MAILJET_SECRET_KEY.value(),
      test_email || null,
    );

    if (!test_email) {
      await db.ref('bons_kdo/bons/' + bon_id).update({
        statut: 'emis',
        emis_at: Date.now(),
        mailjet_id: mailjetId,
      });
    }

    return {
      success: true,
      mailjet_id: mailjetId,
      sent_to: test_email || bon.email,
      pdf_size: pdfBuffer.length,
    };
  }
);

// ════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION : validerBon (scanner mobile)
// ════════════════════════════════════════════════════════════════════
exports.validerBon = onCall(
  { region: 'europe-west1', timeoutSeconds: 10 },
  async (req) => {
    const { code_unique } = req.data || {};
    if (!code_unique) throw new HttpsError('invalid-argument', 'code_unique requis');

    const db = getDatabase();
    const snap = await db.ref('bons_kdo/bons').orderByChild('code_unique').equalTo(code_unique).get();
    const found = snap.val();
    if (!found) return { status: 'inconnu' };

    const bonId = Object.keys(found)[0];
    const bon = found[bonId];

    if (bon.statut === 'utilise') {
      return {
        status: 'deja_utilise',
        utilise_at: bon.utilise_at,
        nom: bon.nom, co: bon.co, lot: bon.lot,
      };
    }

    await db.ref('bons_kdo/bons/' + bonId).update({
      statut: 'utilise',
      utilise_at: Date.now(),
    });

    return {
      status: 'valide',
      nom: bon.nom, co: bon.co, lot: bon.lot,
      type: bon.type,
    };
  }
);

// ════════════════════════════════════════════════════════════════════
// CLOUD FUNCTION : getMailjetStats
// Recupere les stats d ouvertures/clics/bounces depuis Mailjet
// pour une liste de bons (par leur mailjet_id) et persiste en Firebase
// ════════════════════════════════════════════════════════════════════
exports.getMailjetStats = onCall(
  {
    region: 'europe-west1',
    secrets: [MAILJET_PUBLIC_KEY, MAILJET_SECRET_KEY],
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (req) => {
    if (!req.auth) {
      throw new HttpsError('unauthenticated', 'Auth requise.');
    }

    const { bon_ids } = req.data || {};
    if (!Array.isArray(bon_ids) || !bon_ids.length) {
      throw new HttpsError('invalid-argument', 'bon_ids (array) requis');
    }
    if (bon_ids.length > 100) {
      throw new HttpsError('invalid-argument', 'Max 100 bons par appel');
    }

    const db = getDatabase();
    const mailjet = new Mailjet({
      apiKey: MAILJET_PUBLIC_KEY.value(),
      apiSecret: MAILJET_SECRET_KEY.value(),
    });

    // Charger tous les bons concernes en parallele
    const bonsSnaps = await Promise.all(
      bon_ids.map(id => db.ref('bons_kdo/bons/' + id).get())
    );

    const results = {};
    let processed = 0, skipped = 0, errors = 0;

    // Pour chaque bon avec un mailjet_id, on appelle l API
    for (let i = 0; i < bon_ids.length; i++) {
      const bonId = bon_ids[i];
      const bon = bonsSnaps[i].val();

      if (!bon || !bon.mailjet_id) {
        skipped++;
        results[bonId] = { skipped: true, reason: 'no_mailjet_id' };
        continue;
      }

      try {
        // Endpoint /messagehistory/{id} retourne les events ordered : Sent, Opened, Clicked, etc.
        const r = await mailjet.get('messagehistory', { version: 'v3' })
          .id(bon.mailjet_id)
          .request();

        const events = (r.body && r.body.Data) || [];
        // Format Mailjet : [{EventAt: timestamp_seconds, EventType: 'sent|delivered|opened|clicked|bounced|spam', ...}]
        const stats = {
          last_refreshed: Date.now(),
          opens: 0,
          clicks: 0,
        };

        for (const ev of events) {
          const ts = ev.EventAt ? ev.EventAt * 1000 : null;  // sec -> ms
          const type = (ev.EventType || '').toLowerCase();

          if (type === 'sent' && ts && !stats.sent_at) stats.sent_at = ts;
          if (type === 'delivered' && ts && !stats.delivered_at) stats.delivered_at = ts;
          if (type === 'opened') {
            stats.opens++;
            if (ts && (!stats.opened_at || ts < stats.opened_at)) stats.opened_at = ts;
          }
          if (type === 'clicked') {
            stats.clicks++;
            if (ts && (!stats.clicked_at || ts < stats.clicked_at)) stats.clicked_at = ts;
          }
          if ((type === 'bounce' || type === 'hardbounced' || type === 'softbounced') && ts) {
            stats.bounced_at = ts;
            stats.bounce_reason = ev.Comment || type;
          }
          if (type === 'spam' && ts) stats.spam_at = ts;
          if (type === 'unsub' && ts) stats.unsubscribed_at = ts;
        }

        // Persiste dans Firebase
        await db.ref('bons_kdo/bons/' + bonId).update({ mailjet_stats: stats });

        results[bonId] = stats;
        processed++;
      } catch (err) {
        errors++;
        results[bonId] = { error: (err.message || String(err)).slice(0, 200) };
      }
    }

    return {
      success: true,
      processed, skipped, errors,
      total: bon_ids.length,
      stats: results,
    };
  }
);

exports._genererCodeUnique = genererCodeUnique;
