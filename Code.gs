// =====================================================================
// GREAT EXPERTIZ — Code.gs V3.0.0-TEST  (COPIE DE TEST — ne pas déployer en production)
// Base : V2.6.0 (fonctions existantes conservées). Ajouts : OTP multi-fournisseurs, numéro de commande serveur,
// enregistrement unique dans « Commandes_GE », file d'e-mails avec reprises, journal technique, tarifs intra/extra-urbains,
// cotation interne, diagnostic de migration (lecture seule). Voir RAPPORT_MODIFICATIONS.md.
// =====================================================================
// =====================================================================
// GREAT EXPERTIZ — Backend Google Apps Script (version consolidée)
// Colonnes feuille commandes (A→Q) :
// Code, Date, Prestation, Expéditeur, Téléphone, Destinataire, Tél. destinataire,
// Détail, Enlèvement, Livraison, Cbm, Prix estimé, Fréquence, Notes, Statut, Paiement, Date souhaitée,
// puis (boîte de réception) R Lu, S Dossier (inbox|archive|trash), T Date action, U Date suppression,
// V Véhicule souhaité, W ClientID (ajout V2.3 — vide pour une commande passée en invité)
// Onglets créés automatiquement si absents : Membres, Candidatures GREAT EXPERTIZ,
// Clients GREAT EXPERTIZ, Sessions Clients, Messages GREAT EXPERTIZ
// Version 2.6.0 — fuseau Africa/Abidjan, sessions d'administration, clé propriétaire auto-initialisée, lecture robuste des anciennes commandes, diagnostic, catalogue/emballage/photo.
// Version 2.5.0 — ajout des champs GPS/distance (colonnes X à AB) ; limites de texte relevées (détail marchandise, notes).
// Version 2.4.1 — schéma compatible avec l'onglet réel, migration non destructive vers Commandes_GE
// Permissions propriétaire côté serveur, clé en Script Properties, codes de suivi renforcés
// =====================================================================

// La clé propriétaire est stockée dans Script Properties, jamais dans le code source.
// Après remplacement du fichier, exécuter rotateOwnerKey() UNE SEULE FOIS dans l'éditeur Apps Script.
function getOwnerKey_() {
  return PropertiesService.getScriptProperties().getProperty("GE_OWNER_KEY") || "";
}

function newOwnerKey_() {
  return "GE-OWNER-" + Utilities.getUuid().replace(/-/g, "").toUpperCase() + Utilities.getUuid().replace(/-/g, "").slice(0, 8).toUpperCase();
}

function mailOwnerKey_(key, why) {
  try {
    MailApp.sendEmail({ to: NOTIFY_EMAIL, subject: "GREAT EXPERTIZ — Votre clé propriétaire",
      htmlBody: "<div style='font-family:Arial,sans-serif;max-width:520px'><h2 style='color:#0E3A54'>Clé propriétaire GREAT EXPERTIZ</h2><p>" + esc_(why) + "</p><p style='font-size:18px;font-weight:bold;letter-spacing:1px;background:#EEF6FB;padding:12px;border-radius:8px;word-break:break-all'>" + esc_(key) + "</p><p>Saisissez cette clé sur la page d'administration. Ne la partagez avec personne. Pour la remplacer : exécutez rotateOwnerKey dans Apps Script.</p></div>" });
    return true;
  } catch (err) { return false; }
}

// Crée la clé propriétaire UNE FOIS si elle n'existe pas encore, et l'envoie par e-mail au propriétaire.
// Appelée à l'ouverture de ?action=health : aucune clé n'est jamais visible publiquement.
function ensureOwnerKey_() {
  if (getOwnerKey_()) return false;
  var key = CUSTOM_OWNER_KEY && String(CUSTOM_OWNER_KEY).length >= 12 ? String(CUSTOM_OWNER_KEY) : newOwnerKey_();
  PropertiesService.getScriptProperties().setProperty("GE_OWNER_KEY", key);
  mailOwnerKey_(key, "Aucune clé propriétaire n'existait sur ce script : celle-ci vient d'être créée.");
  return true;
}

// Génère une NOUVELLE clé aléatoire (l'ancienne cesse de fonctionner), l'affiche dans le journal et l'envoie par e-mail.
function rotateOwnerKey() {
  var key = newOwnerKey_();
  PropertiesService.getScriptProperties().setProperty("GE_OWNER_KEY", key);
  revokeAdminSessions_();
  var sent = mailOwnerKey_(key, "Votre clé propriétaire vient d'être renouvelée. L'ancienne clé ne fonctionne plus.");
  Logger.log("NOUVELLE CLE PROPRIETAIRE GREAT EXPERTIZ : " + key + (sent ? "  (envoyée aussi par e-mail à " + NOTIFY_EMAIL + ")" : "  (e-mail non envoyé : autorisation à accorder)"));
  return key;
}

// Définit VOTRE propre clé : écrivez-la dans CUSTOM_OWNER_KEY (12 caractères minimum), exécutez setOwnerKey, puis EFFACEZ-la du code.
function setOwnerKey() {
  var k = String(CUSTOM_OWNER_KEY || "");
  if (k.length < 12) { Logger.log("Clé trop courte : renseignez CUSTOM_OWNER_KEY (12 caractères minimum) puis relancez."); return "clé trop courte"; }
  PropertiesService.getScriptProperties().setProperty("GE_OWNER_KEY", k);
  revokeAdminSessions_();
  Logger.log("Clé propriétaire définie. Videz maintenant CUSTOM_OWNER_KEY dans le code et enregistrez.");
  return "ok";
}

// Affiche dans le journal la clé actuellement enregistrée (si vous l'avez perdue).
function showOwnerKey() {
  var k = getOwnerKey_();
  Logger.log(k ? "CLE PROPRIETAIRE ACTUELLE : " + k : "Aucune clé enregistrée : ouvrez ?action=health ou exécutez rotateOwnerKey.");
  return k ? "ok" : "aucune clé";
}

var SHEET_ID = "REMPLACER_PAR_L_ID_DE_LA_COPIE_DE_TEST";   // ← identifiant de la COPIE de test du classeur (jamais la production)
var ORDERS_SHEET_NAME = "Commandes";    // si l'onglet porte un autre nom, le 1er onglet est utilisé
var NOTIFY_EMAIL = "greatexpertiz225@gmail.com";
var TZ = "Africa/Abidjan";                 // fuseau de la Côte d'Ivoire (GMT, sans heure d'été)
var VERSION = "3.0.0-test";
var RELEASE_DATE = "2026-11-20";
var ADMIN_SESSION_DAYS = 30;
var ADMIN_SESSIONS_SHEET_NAME = "Sessions Admin";
var PHOTO_FOLDER_NAME = "GREAT EXPERTIZ - Photos objets";
var CUSTOM_OWNER_KEY = "";                 // OPTIONNEL : voir setOwnerKey() — à vider après usage
var STATUSES = ["Reçue", "Confirmée", "En cours", "Livrée", "Annulée"];
var HEADERS = ["Code", "Date", "Prestation", "Expéditeur", "Téléphone", "Destinataire", "Téléphone destinataire",
  "Détail", "Enlèvement", "Livraison", "Cbm", "Prix estimé", "Fréquence", "Notes", "Statut", "Paiement", "Date souhaitée",
  "Lu", "Dossier", "Date action", "Date suppression"];
var FOLDERS = ["inbox", "archive", "trash"];

// ---- Espace membre client (ajout V2.3) ----
var CLIENTS_SHEET_NAME = "Clients GREAT EXPERTIZ";
var CLIENTS_HEADERS = ["ClientID", "Nom", "Entreprise", "Email", "Téléphone", "MotDePasseHash", "Sel", "Date d'inscription", "Statut", "ResetToken", "ResetExpiration"];
var SESSIONS_SHEET_NAME = "Sessions Clients";
var SESSIONS_HEADERS = ["Jeton", "ClientID", "Créée le", "Expire le"];
var MESSAGES_SHEET_NAME = "Messages GREAT EXPERTIZ";
var MESSAGES_HEADERS = ["ID", "Date", "ClientID", "Client", "Auteur", "Message", "LuAdmin", "LuClient"];
var SESSION_DAYS = 30;            // durée de la session « connecté »
var RESET_MINUTES = 60;           // durée de validité d'un lien de réinitialisation
var PASSWORD_MIN_LEN = 8;

// ---------- Feuilles ----------
var EXTRA_HEADERS = ["GPS enlèvement", "GPS livraison", "Lien enlèvement", "Lien livraison", "Distance km", "Photo objet", "Emballage", "Température", "Poids estimé (kg)", "Évaluation demandée"];
var ORDER_COLS = 39;   // 33 colonnes historiques + 6 colonnes V3 (AH à AM)

function ordersHeaders_() { return HEADERS.concat(["Véhicule souhaité", "ClientID"]).concat(EXTRA_HEADERS).concat(NEW_ORDER_HEADERS); }

function ensureTimeZone_(ss) { try { if (ss.getSpreadsheetTimeZone() !== TZ) ss.setSpreadsheetTimeZone(TZ); } catch (e) {} }

// Colonnes X à AG (24 à 33) : ajoutées seulement si leur en-tête est vide — rien d'existant n'est modifié.
function ensureExtraHeaders_(sheet) {
  var all = EXTRA_HEADERS.concat(NEW_ORDER_HEADERS);
  for (var i = 0; i < all.length; i++) {
    var c = 24 + i;
    if (c > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), c - sheet.getMaxColumns());
    if (!sheet.getRange(1, c).getValue()) sheet.getRange(1, c).setValue(all[i]);
  }
}

function headerIndex_(headers) { var idx = {}; headers.forEach(function (h, i) { idx[h] = i; }); return idx; }

function isNewSchema_(headers) {
  return headers.indexOf("code commande") >= 0 && headers.indexOf("date creation") >= 0 && headers.indexOf("adresse enlevement") >= 0;
}

// Trouve l'onglet d'origine des commandes : « Commandes », sinon le premier onglet dont l'en-tête contient « code ».
function findOrdersSource_(ss) {
  var s = ss.getSheetByName(ORDERS_SHEET_NAME);
  if (s) return s;
  var all = ss.getSheets();
  for (var i = 0; i < all.length; i++) {
    var n = all[i].getName();
    if (n === "Commandes_GE" || n === "Membres" || /Clients|Sessions|Messages|Candidatures/.test(n)) continue;
    var h = String(all[i].getRange(1, 1).getDisplayValue()).toLowerCase() + "|" + String(all[i].getRange(1, 2).getDisplayValue()).toLowerCase();
    if (/code/.test(h)) return all[i];
  }
  return null;
}

// Convertit une ligne du « vrai » onglet (colonnes code commande, date creation…) vers la mise en page de travail.
function mapNewSchemaRow_(row, idx) {
  function cell(label) { var i = idx[label]; return i == null ? "" : (row[i] == null ? "" : row[i]); }
  var code = cell("code commande");
  if (!code) return null;
  var nom = [cell("nom"), cell("prenom")].filter(Boolean).join(" ");
  var notes = cell("instructions"), extras = [];
  if (cell("manutention")) extras.push("Manutention: " + cell("manutention"));
  if (cell("etages")) extras.push("Étages: " + cell("etages"));
  if (cell("distance")) extras.push("Distance: " + cell("distance"));
  if (cell("vehicule")) extras.push("Véhicule: " + cell("vehicule"));
  if (extras.length) notes = (notes ? notes + " | " : "") + extras.join(" | ");
  var quantite = cell("quantite");
  var detail = [cell("marchandises"), quantite ? "Quantité: " + quantite : ""].filter(Boolean).join(" — ");
  var dateSouhaitee = cell("date souhaitee"), heure = cell("heure souhaitee");
  if (heure) dateSouhaitee = (dateSouhaitee ? dateSouhaitee + " " : "") + heure;
  var out = [code, cell("date creation"), "Transport B2B", nom, cell("telephone"), cell("entreprise") || cell("email"), "", detail,
    cell("adresse enlevement"), cell("adresse livraison"), cell("volume estime"), cell("montant estime"), "", notes,
    cell("statut") || "Reçue", cell("mode paiement") || cell("paiement"), dateSouhaitee, "false", "inbox", "", "", cell("vehicule"), ""];
  while (out.length < ORDER_COLS) out.push("");
  return out;
}

// COPIE (sans jamais déplacer ni effacer) dans « Commandes_GE » les commandes de l'onglet d'origine qui n'y figurent pas encore.
function syncLegacyOrders_(normalized, source) {
  try {
    if (!source || source.getSheetId() === normalized.getSheetId()) return;
    var last = source.getLastRow(), props = PropertiesService.getScriptProperties();
    if (last <= 1) return;
    if (Number(props.getProperty("GE_LEGACY_ROWS") || 0) === last) return;
    var data = source.getDataRange().getDisplayValues();
    var headers = data[0].map(function (v) { return String(v || "").trim().toLowerCase(); });
    var newSchema = isNewSchema_(headers), idx = headerIndex_(headers), have = {}, nr = normalized.getLastRow(), add = [];
    if (nr > 1) normalized.getRange(2, 1, nr - 1, 1).getValues().forEach(function (r) { have[String(r[0])] = true; });
    for (var r = 1; r < data.length; r++) {
      var row;
      if (newSchema) row = mapNewSchemaRow_(data[r], idx);
      else { row = data[r].slice(0, ORDER_COLS); while (row.length < ORDER_COLS) row.push(""); }
      if (!row || !row[0] || have[String(row[0])]) continue;
      have[String(row[0])] = true; add.push(row);
    }
    if (add.length) normalized.getRange(normalized.getLastRow() + 1, 1, add.length, ORDER_COLS).setValues(add);
    props.setProperty("GE_LEGACY_ROWS", String(last));
  } catch (e) { Logger.log("Synchronisation des anciennes commandes impossible : " + e); }
}

// V3 : l'onglet « Commandes_GE » est le SEUL onglet opérationnel. Plus de repli sur « Commandes », plus de synchronisation automatique.
function getOrdersSheet_() {
  var ss = openSS_();
  ensureTimeZone_(ss);
  var sh = ss.getSheetByName(OFFICIAL_ORDERS_SHEET);
  if (!sh) throw new Error("Onglet officiel « Commandes_GE » introuvable. Lancez setupTest() (il crée un onglet vide, sans rien migrer).");
  ensureExtraHeaders_(sh);
  return sh;
}

// ANCIENNE VERSION (V2.6.0) conservée pour mémoire et retour arrière : n'est plus appelée.
function legacyGetOrdersSheet_() {
  var ss = openSS_();
  ensureTimeZone_(ss);
  var normalized = ss.getSheetByName("Commandes_GE"), source = findOrdersSource_(ss);
  if (normalized) { ensureExtraHeaders_(normalized); syncLegacyOrders_(normalized, source); return normalized; }
  if (!source) throw new Error("Onglet Commandes introuvable.");
  var headers = source.getRange(1, 1, 1, Math.max(1, source.getLastColumn())).getDisplayValues()[0]
    .map(function (v) { return String(v || "").trim().toLowerCase(); });
  if (isNewSchema_(headers)) {
    normalized = ss.insertSheet("Commandes_GE");
    var th = ordersHeaders_();
    normalized.getRange(1, 1, 1, th.length).setValues([th]);
    normalized.getRange("A:A").setNumberFormat("@");
    normalized.getRange("E:E").setNumberFormat("@");
    normalized.getRange("G:G").setNumberFormat("@");
    var data = source.getDataRange().getDisplayValues(), idx = headerIndex_(headers), migrated = [];
    for (var r = 1; r < data.length; r++) { var m = mapNewSchemaRow_(data[r], idx); if (m) migrated.push(m); }
    if (migrated.length) normalized.getRange(2, 1, migrated.length, th.length).setValues(migrated);
    SpreadsheetApp.flush();
    PropertiesService.getScriptProperties().setProperty("GE_LEGACY_ROWS", String(source.getLastRow()));
    return normalized;
  }
  // Mise en page déjà compatible : on continue de l'utiliser sans toucher aux données existantes.
  [1, 5, 7, 17, 18, 19, 20, 21, 23].forEach(function (c) {
    if (c <= source.getMaxColumns()) source.getRange(1, c, source.getMaxRows(), 1).setNumberFormat("@");
  });
  for (var h = 17; h <= 21; h++) {
    if (!source.getRange(1, h).getValue()) source.getRange(1, h).setValue(HEADERS[h - 1]);
  }
  if (!source.getRange(1, 22).getValue()) source.getRange(1, 22).setValue("Véhicule souhaité");
  if (!source.getRange(1, 23).getValue()) source.getRange(1, 23).setValue("ClientID");
  ensureExtraHeaders_(source);
  return source;
}

// Photo facultative d'un objet : enregistrée dans un dossier Google Drive ; l'échec n'empêche jamais la commande.
function saveOrderPhoto_(code, dataUrl) {
  var m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+\/=]+)$/.exec(String(dataUrl));
  if (!m) throw new Error("format de photo invalide");
  if (m[2].length > 1500000) throw new Error("photo trop lourde");
  var ext = m[1] === "image/png" ? "png" : (m[1] === "image/webp" ? "webp" : "jpg");
  var blob = Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], String(code).replace(/[^A-Za-z0-9_-]/g, "") + "." + ext);
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME), folder = it.hasNext() ? it.next() : DriveApp.createFolder(PHOTO_FOLDER_NAME);
  var file = folder.createFile(blob);
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  return file.getUrl();
}

// Diagnostic (propriétaire) : quel onglet est lu, combien de lignes, quels en-têtes — sans données personnelles.
function diagnostic_() {
  var out = { version: VERSION, release: RELEASE_DATE, tz: TZ, now: nowIso_(), sheetId: SHEET_ID, ownerKeySet: !!getOwnerKey_(), sheets: [], orders: {} };
  try {
    var ss = openSS_();
    out.spreadsheetTz = ss.getSpreadsheetTimeZone();
    out.spreadsheetName = ss.getName();
    out.spreadsheetUrl = ss.getUrl();
    ss.getSheets().forEach(function (s) { out.sheets.push({ name: s.getName(), rows: s.getLastRow(), cols: s.getLastColumn() }); });
    var os = getOrdersSheet_(), vals = os.getDataRange().getValues(), src = findOrdersSource_(ss);
    out.orders = { sheetUsed: os.getName(), rows: Math.max(0, os.getLastRow() - 1), headers: vals[0] ? vals[0].slice(0, ORDER_COLS).map(String) : [],
      lastCode: vals.length > 1 ? String(vals[vals.length - 1][0]) : "", sourceSheet: src ? src.getName() : "",
      legacySyncedRows: PropertiesService.getScriptProperties().getProperty("GE_LEGACY_ROWS") || "" };
  } catch (e) { out.error = String(e && e.message ? e.message : e); }
  return out;
}

function getMembersSheet_() {
  var ss = openSS_();
  var sheet = ss.getSheetByName("Membres");
  if (!sheet) {
    var prev = ss.getActiveSheet();
    sheet = ss.insertSheet("Membres");
    sheet.appendRow(["Nom", "Clé", "Date d'ajout", "Statut"]);
    if (prev) ss.setActiveSheet(prev);
  }
  return sheet;
}

function getClientsSheet_() {
  var ss = openSS_();
  var sheet = ss.getSheetByName(CLIENTS_SHEET_NAME);
  if (!sheet) {
    var prev = ss.getActiveSheet();
    sheet = ss.insertSheet(CLIENTS_SHEET_NAME);
    sheet.appendRow(CLIENTS_HEADERS);
    sheet.getRange(1, 4, sheet.getMaxRows(), 1).setNumberFormat("@"); // Email en texte
    sheet.getRange(1, 5, sheet.getMaxRows(), 1).setNumberFormat("@"); // Téléphone en texte
    if (prev) ss.setActiveSheet(prev);
  }
  return sheet;
}

function getSessionsSheet_() {
  var ss = openSS_();
  var sheet = ss.getSheetByName(SESSIONS_SHEET_NAME);
  if (!sheet) {
    var prev = ss.getActiveSheet();
    sheet = ss.insertSheet(SESSIONS_SHEET_NAME);
    sheet.appendRow(SESSIONS_HEADERS);
    if (prev) ss.setActiveSheet(prev);
  }
  return sheet;
}

function getMessagesSheet_() {
  var ss = openSS_();
  var sheet = ss.getSheetByName(MESSAGES_SHEET_NAME);
  if (!sheet) {
    var prev = ss.getActiveSheet();
    sheet = ss.insertSheet(MESSAGES_SHEET_NAME);
    sheet.appendRow(MESSAGES_HEADERS);
    if (prev) ss.setActiveSheet(prev);
  }
  return sheet;
}

// ---------- Utilitaires ----------
function sha256_(s) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s));
  return b.map(function (x) { return ("0" + (x & 0xFF).toString(16)).slice(-2); }).join("");
}

function getAdminSessionsSheet_() {
  var ss = openSS_();
  var sheet = ss.getSheetByName(ADMIN_SESSIONS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(ADMIN_SESSIONS_SHEET_NAME);
    sheet.appendRow(["Jeton", "Nom", "Rôle", "EmpreinteClé", "Créée le", "Expire le"]);
  }
  return sheet;
}

function revokeAdminSessions_() {
  try {
    var sh = openSS_().getSheetByName(ADMIN_SESSIONS_SHEET_NAME);
    if (sh && sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  } catch (e) {}
}

// Vérifie une clé brute OU un jeton de session d'administration (préfixe AS-).
function checkAuth_(key) {
  if (!key) return { valid: false };
  key = String(key);
  if (key.indexOf("AS-") === 0) return checkAdminSession_(key);
  var ownerKey = getOwnerKey_();
  if (ownerKey && key === ownerKey) return { valid: true, isOwner: true, name: "Propriétaire" };
  var data = getMembersSheet_().getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][1] === key && data[i][3] === "Actif") return { valid: true, isOwner: false, name: data[i][0] };
  }
  return { valid: false };
}

function checkAdminSession_(token) {
  var sh = getAdminSessionsSheet_(), d = sh.getDataRange().getValues();
  for (var i = 1; i < d.length; i++) {
    if (String(d[i][0]) !== token) continue;
    if (!d[i][5] || new Date(d[i][5]).getTime() < Date.now()) return { valid: false, error: "session expirée" };
    if (d[i][2] === "owner") {
      var ok = getOwnerKey_() && sha256_(getOwnerKey_()) === d[i][3];
      return ok ? { valid: true, isOwner: true, name: "Propriétaire" } : { valid: false, error: "clé renouvelée" };
    }
    var m = getMembersSheet_().getDataRange().getValues();
    for (var j = 1; j < m.length; j++) {
      if (m[j][3] === "Actif" && sha256_(m[j][1]) === d[i][3]) return { valid: true, isOwner: false, name: m[j][0] };
    }
    return { valid: false, error: "compte désactivé" };
  }
  return { valid: false };
}

// Connexion : échange la clé contre un jeton de session (la clé elle-même n'est pas conservée sur l'appareil).
function adminLogin_(key) {
  ensureOwnerKey_();
  var auth = checkAuth_(key);
  if (!auth.valid || String(key).indexOf("AS-") === 0) return { ok: false, error: "clé incorrecte ou compte désactivé" };
  var token = "AS-" + Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
  var now = new Date(), exp = new Date(now.getTime() + ADMIN_SESSION_DAYS * 24 * 60 * 60 * 1000);
  getAdminSessionsSheet_().appendRow([token, auth.name, auth.isOwner ? "owner" : "member", sha256_(key), now, exp]);
  purgeAdminSessions_();
  return { ok: true, token: token, auth: auth, expires: exp.getTime() };
}

function adminLogout_(token) {
  var sh = getAdminSessionsSheet_(), d = sh.getDataRange().getValues();
  for (var i = d.length - 1; i >= 1; i--) if (String(d[i][0]) === String(token)) { sh.deleteRow(i + 1); break; }
  return { ok: true };
}

function purgeAdminSessions_() {
  if (Math.random() > 0.1) return;
  var sh = getAdminSessionsSheet_(), d = sh.getDataRange().getValues(), now = Date.now();
  for (var i = d.length - 1; i >= 1; i--) if (d[i][5] && new Date(d[i][5]).getTime() < now) sh.deleteRow(i + 1);
}

function generateKey_() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", key = "GE-";
  for (var i = 0; i < 8; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

function esc_(v) {
  return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function safeMapLink_(v) {
  var s = String(v == null ? "" : v).trim().substring(0, 120);
  return /^https:\/\/www\.google\.com\/maps\?q=-?[0-9.]+,-?[0-9.]+$/.test(s) ? s : "";
}

function clean_(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001F]/g, " ").trim().substring(0, max || 300);
}

function nowIso_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"); }

function isRead_(row) {
  var v = String(row[17] == null ? "" : row[17]).toLowerCase();
  if (v === "true") return true;
  if (v === "false") return false;
  return String(row[14] || "Reçue") !== "Reçue";   // anciennes commandes (colonne vide) : lues sauf si encore « Reçue »
}

function dateOnly_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, "yyyy-MM-dd");
  return String(v == null ? "" : v);
}

function phone_(v) {
  var s = String(v == null ? "" : v);
  var d = s.replace(/\D/g, "");
  if (d.length === 9) return "0" + d;   // anciens enregistrements où le 0 initial a été perdu
  return s;
}

function safeCallback_(cb) { cb = String(cb == null ? "" : cb); return /^[A-Za-z_$][\w$]{0,63}(\.[A-Za-z_$][\w$]{0,63}){0,3}$/.test(cb) ? cb : ""; }

function outputJson_(obj, callback) {
  var json = JSON.stringify(obj);
  callback = safeCallback_(callback);   // V3 : un nom de fonction invalide est ignoré (pas d'injection de code)
  if (callback) return ContentService.createTextOutput(callback + "(" + json + ")").setMimeType(ContentService.MimeType.JAVASCRIPT);
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function findRowByCode_(sheet, code) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) if (String(data[i][0]) === String(code)) return { index: i, row: data[i] };
  return null;
}

// ---------- Espace membre client : sécurité et sessions (ajout V2.3) ----------
// Limite connue : Apps Script ne propose pas de bcrypt/scrypt natif. On utilise SHA-256
// avec un sel aléatoire propre à chaque compte, ce qui est raisonnable pour cette
// architecture mais reste moins robuste qu'un hachage lent dédié aux mots de passe.
function makeSalt_() { return Utilities.getUuid().replace(/-/g, ""); }

function hashPassword_(password, salt) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(password) + ":" + String(salt));
  return bytes.map(function (b) { return ("0" + (b & 0xFF).toString(16)).slice(-2); }).join("");
}

function normalizeEmail_(v) { return String(v == null ? "" : v).trim().toLowerCase(); }

function isValidEmail_(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); }

function newClientId_() { return "CLI-" + Utilities.getUuid().split("-")[0].toUpperCase(); }

function findClientRow_(sheet, predicate) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) { if (data[i][0] && predicate(data[i])) return { index: i, row: data[i] }; }
  return null;
}

function findClientByEmail_(sheet, email) {
  var norm = normalizeEmail_(email);
  return findClientRow_(sheet, function (r) { return normalizeEmail_(r[3]) === norm; });
}

function findClientById_(sheet, id) {
  return findClientRow_(sheet, function (r) { return String(r[0]) === String(id); });
}

// Jeton de session : table dédiée (et non PropertiesService/CacheService) pour que la
// session survive un redémarrage du service et reste simple à invalider côté serveur.
function createSession_(clientId) {
  var token = Utilities.getUuid() + Utilities.getUuid();
  var now = new Date(), expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  getSessionsSheet_().appendRow([token, clientId, now, expires]);
  maybePurgeSessions_();
  return token;
}

function maybePurgeSessions_() {
  if (Math.random() > 0.08) return; // purge occasionnelle pour éviter d'alourdir chaque appel
  var sh = getSessionsSheet_(), data = sh.getDataRange().getValues(), now = new Date();
  for (var i = data.length - 1; i >= 1; i--) {
    var exp = data[i][3];
    if (exp && new Date(exp).getTime() < now.getTime()) sh.deleteRow(i + 1);
  }
}

// Authentification client par jeton de session (jamais par simple identifiant transmis par le navigateur).
function checkClientAuth_(token) {
  if (!token) return { valid: false };
  var sd = getSessionsSheet_().getDataRange().getValues();
  for (var i = 1; i < sd.length; i++) {
    if (String(sd[i][0]) === String(token)) {
      var expires = sd[i][3];
      if (expires && new Date(expires).getTime() < Date.now()) return { valid: false, error: "session expirée" };
      var cs = getClientsSheet_(), cf = findClientById_(cs, sd[i][1]);
      if (!cf) return { valid: false };
      if (String(cf.row[8]) === "Suspendu") return { valid: false, error: "compte suspendu" };
      return { valid: true, clientId: String(cf.row[0]), nom: String(cf.row[1] || ""), entreprise: String(cf.row[2] || ""), email: String(cf.row[3] || ""), telephone: phone_(cf.row[4]) };
    }
  }
  return { valid: false };
}

// ---------- Actions publiques de l'espace membre (POST, sans clé admin) ----------
function handleClient_(p) {
  var action = p.action;

  if (action === "registerClient") {
    var nom = clean_(p.nom, 120), entreprise = clean_(p.entreprise, 150), email = normalizeEmail_(p.email), tel = clean_(p.telephone, 30), pwd = String(p.password || "");
    if (!nom || !email || !isValidEmail_(email)) return { ok: false, error: "nom ou e-mail invalide" };
    if (pwd.length < PASSWORD_MIN_LEN) return { ok: false, error: "le mot de passe doit contenir au moins " + PASSWORD_MIN_LEN + " caractères" };
    var lock = LockService.getScriptLock(); lock.waitLock(15000);
    try {
      var sheet = getClientsSheet_();
      if (findClientByEmail_(sheet, email)) return { ok: false, error: "cet e-mail est déjà inscrit" };
      var salt = makeSalt_(), hash = hashPassword_(pwd, salt), id = newClientId_();
      sheet.appendRow([id, nom, entreprise, email, tel, hash, salt, new Date(), "Actif", "", ""]);
      SpreadsheetApp.flush();
    } finally { lock.releaseLock(); }
    var token = createSession_(id);
    try {
      MailApp.sendEmail({ to: email, subject: "Bienvenue chez GREAT EXPERTIZ", htmlBody: "<p>Bonjour " + esc_(nom) + ",</p><p>Votre espace client GREAT EXPERTIZ (TRANSPORT. LOGISTIQUE. B2B.) est créé. Vous pouvez suivre vos commandes et nous écrire directement depuis votre espace.</p>" });
    } catch (err) {}
    return { ok: true, token: token, client: { nom: nom, entreprise: entreprise, email: email, telephone: tel } };
  }

  if (action === "loginClient") {
    var lemail = normalizeEmail_(p.email), lpwd = String(p.password || "");
    var sh = getClientsSheet_(), f = findClientByEmail_(sh, lemail);
    if (!f) return { ok: false, error: "e-mail ou mot de passe incorrect" };
    if (String(f.row[8]) === "Suspendu") return { ok: false, error: "compte suspendu, contactez GREAT EXPERTIZ" };
    var expectedHash = hashPassword_(lpwd, f.row[6]);
    if (expectedHash !== f.row[5]) return { ok: false, error: "e-mail ou mot de passe incorrect" };
    var tok = createSession_(f.row[0]);
    return { ok: true, token: tok, client: { nom: f.row[1], entreprise: f.row[2], email: f.row[3], telephone: phone_(f.row[4]) } };
  }

  if (action === "logoutClient") {
    var ssh = getSessionsSheet_(), sv = ssh.getDataRange().getValues();
    for (var i = sv.length - 1; i >= 1; i--) { if (String(sv[i][0]) === String(p.token)) { ssh.deleteRow(i + 1); break; } }
    return { ok: true };
  }

  if (action === "requestPasswordReset") {
    var remail = normalizeEmail_(p.email);
    var rsh = getClientsSheet_(), rf = findClientByEmail_(rsh, remail);
    // Réponse identique que le compte existe ou non : on ne confirme jamais qu'un e-mail est inscrit.
    if (rf) {
      var rtoken = Utilities.getUuid(), rexp = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
      rsh.getRange(rf.index + 1, 10).setValue(rtoken);
      rsh.getRange(rf.index + 1, 11).setValue(rexp);
      try {
        var baseUrl = ScriptApp.getService().getUrl();
        MailApp.sendEmail({ to: remail, subject: "Réinitialisation de votre mot de passe — GREAT EXPERTIZ",
          htmlBody: "<p>Un changement de mot de passe a été demandé pour ce compte.</p><p>Code de réinitialisation valable " + RESET_MINUTES + " minutes : <b>" + rtoken + "</b></p><p>Saisissez ce code sur la page GREAT EXPERTIZ, rubrique « Mot de passe oublié ».</p>" });
      } catch (err) {}
    }
    return { ok: true };
  }

  if (action === "confirmPasswordReset") {
    var ctoken = clean_(p.resetToken, 60), npwd = String(p.newPassword || "");
    if (npwd.length < PASSWORD_MIN_LEN) return { ok: false, error: "le mot de passe doit contenir au moins " + PASSWORD_MIN_LEN + " caractères" };
    var csh = getClientsSheet_(), cf2 = findClientRow_(csh, function (r) { return String(r[9]) === ctoken && ctoken; });
    if (!cf2) return { ok: false, error: "code invalide ou expiré" };
    var cexp = cf2.row[10];
    if (!cexp || new Date(cexp).getTime() < Date.now()) return { ok: false, error: "code invalide ou expiré" };
    var nsalt = makeSalt_(), nhash = hashPassword_(npwd, nsalt);
    csh.getRange(cf2.index + 1, 6).setValue(nhash);
    csh.getRange(cf2.index + 1, 7).setValue(nsalt);
    csh.getRange(cf2.index + 1, 10).setValue("");
    csh.getRange(cf2.index + 1, 11).setValue("");
    return { ok: true };
  }

  if (action === "sendMessage") {
    var auth = checkClientAuth_(p.token);
    if (!auth.valid) return { ok: false, error: auth.error || "session invalide, reconnectez-vous" };
    var texte = clean_(p.message, 1200);
    if (!texte) return { ok: false, error: "message vide" };
    var id = "MSG-" + Utilities.getUuid().split("-")[0].toUpperCase();
    getMessagesSheet_().appendRow([id, new Date(), auth.clientId, auth.nom, "client", texte, "false", "true"]);
    try {
      MailApp.sendEmail({ to: NOTIFY_EMAIL, subject: "Nouveau message client — " + auth.nom, htmlBody: "<p><b>" + esc_(auth.nom) + "</b> (" + esc_(auth.email) + ") a écrit :</p><p>" + esc_(texte) + "</p>" });
    } catch (err) {}
    return { ok: true };
  }

  return { ok: false, error: "action inconnue" };
}

// ---------- Candidatures réseau (propriétaires d’engins et chauffeurs) ----------
function getCandidatesSheet_() {
  var ss = openSS_();
  var sh = ss.getSheetByName("Candidatures GREAT EXPERTIZ");
  if (!sh) {
    sh = ss.insertSheet("Candidatures GREAT EXPERTIZ");
    sh.appendRow(["Référence", "Date", "Profil", "Nom", "Téléphone", "E-mail", "Localisation", "Véhicule / engin", "Capacité", "Permis", "Disponibilité", "Expérience", "Message", "Statut"]);
  }
  return sh;
}
function saveCandidate_(p) {
  var profile = clean_(p.profil, 80), nom = clean_(p.nom, 120), tel = clean_(p.telephone, 30), location = clean_(p.localisation, 120);
  if (!profile || !nom || !tel || !location || p.consentement !== "oui") return { ok: false, error: "champs obligatoires ou consentement manquants" };
  var ref = "GEC-" + Utilities.formatDate(new Date(), TZ, "yyMMdd") + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
  var c = { ref: ref, profil: profile, nom: nom, telephone: tel, email: clean_(p.email, 120), localisation: location,
    vehicule: clean_(p.vehicule, 120), capacite: clean_(p.capacite, 160), permis: clean_(p.permis, 100),
    disponibilite: clean_(p.disponibilite, 120), experience: clean_(p.experience, 120), message: clean_(p.message, 800) };
  var sh = getCandidatesSheet_();
  sh.appendRow([c.ref, new Date(), c.profil, c.nom, c.telephone, c.email, c.localisation, c.vehicule, c.capacite, c.permis, c.disponibilite, c.experience, c.message, "À étudier"]);
  SpreadsheetApp.flush();
  try {
    var rows = [["Référence", c.ref], ["Profil", c.profil], ["Nom", c.nom], ["Téléphone", c.telephone], ["E-mail", c.email || "—"], ["Localisation", c.localisation], ["Véhicule / engin", c.vehicule || "—"], ["Capacité", c.capacite || "—"], ["Permis", c.permis || "—"], ["Disponibilité", c.disponibilite || "—"], ["Expérience", c.experience || "—"], ["Message", c.message || "—"]];
    var html = "<div style='font-family:Arial,sans-serif;max-width:600px'><h2 style='color:#0E3A54'>Nouvelle candidature — GREAT EXPERTIZ</h2><table style='width:100%;border-collapse:collapse'>" + rows.map(function(r){return "<tr><td style='padding:7px;color:#5B7285'>"+esc_(r[0])+"</td><td style='padding:7px;font-weight:bold'>"+esc_(r[1])+"</td></tr>";}).join("") + "</table></div>";
    MailApp.sendEmail({to: NOTIFY_EMAIL, subject: "Candidature réseau — " + c.ref, htmlBody: html});
  } catch (err) {}
  return { ok: true, reference: ref };
}
// Les actions de l'espace membre passent par la même iframe cachée que les candidatures/commandes
// (nécessaire pour éviter les soucis CORS entre GitHub Pages et script.google.com) : le résultat
// revient donc par postMessage plutôt que par une réponse JSON lue directement.
function clientResponse_(action, result) {
  var payload = { type: "GE_CLIENT_RESULT", action: action, ok: !!result.ok, error: result.error || "", token: result.token || "", client: result.client || null, count: (result.count || result.count === 0) ? result.count : undefined };
  var json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput("<!doctype html><html><body><script>window.top.postMessage(" + json + ", '*');<\/script></body></html>").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function candidateResponse_(result) {
  var json = JSON.stringify({ type: "GE_CANDIDATE_RESULT", ok: !!result.ok, reference: result.reference || "", error: result.error || "" }).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput("<!doctype html><html><body><script>window.top.postMessage(" + json + ", '*');<\/script></body></html>").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// ---------- Demande publique sans OTP (parcours client simplifié) ----------
// Le navigateur ne choisit jamais le numéro de commande. Le serveur le génère.
// Un identifiant de requête assure l'idempotence en cas de double-clic ou de coupure réseau.
function handleDirectOrder_(p) {
  var rid = clean_(p.rid, 80);
  function fail(error, message) { return { ok: false, rid: rid, error: error, message: message }; }
  try {
    if (clean_(p.hp, 20)) { logEvent_("ALERTE", "commande.honeypot", "", "champ piège rempli"); return fail("REFUSE", "Demande refusée."); }
    if (!/^[A-Za-z0-9_-]{8,80}$/.test(rid)) return fail("REQUETE_INVALIDE", "Actualisez la page puis réessayez.");
    var v = validateOrderInput_(p);
    if (!v.ok) return fail("DONNEES_INVALIDES", v.message);
    var data = v.data;
    var rawWeight = clean_(p.poidsKg, 12);
    if (rawWeight) { var weightNumber = Number(rawWeight.replace(",", ".")); if (!isFinite(weightNumber) || weightNumber <= 0 || weightNumber > 220000) return fail("POIDS_INVALIDE", "Le poids total doit être un nombre positif en kilogrammes."); }
    data.poidsKg = rawWeight;
    data.temperature = clean_(p.temperature, 80);
    data.notes = clean_([data.notes, data.poidsKg ? "Poids total déclaré : " + data.poidsKg + " kg" : "Poids non communiqué",
      data.temperature ? "Température : " + data.temperature : ""].filter(Boolean).join(" | "), 2000);
    var clientAuth = checkClientAuth_(p.clientToken);
    data.clientId = clientAuth && clientAuth.valid ? clientAuth.clientId : "";
    data.zone = classifyZone_(data);
    var source = "site|direct|" + rid;
    return withLock_(function () {
      var sheet = getOrdersSheet_(), hdr = ordersHeaders_(), srcCol = hdr.indexOf("Source") + 1;
      var last = sheet.getLastRow(), i;
      if (last > 1) {
        var srcs = sheet.getRange(2, srcCol, last - 1, 1).getValues();
        for (i = 0; i < srcs.length; i++) {
          if (String(srcs[i][0]) === source) return { ok: true, rid: rid, code: String(sheet.getRange(i + 2, 1).getValue()), already: true,
            message: "Votre demande est déjà enregistrée. Conservez votre numéro de référence." };
        }
      }
      // Limitation simple par numéro : au plus 5 demandes par heure.
      var recent = 0, now = new Date(), cutoff = now.getTime() - 3600000;
      if (last > 1) {
        var recentRows = sheet.getRange(Math.max(2, last - 199), 2, Math.min(200, last - 1), 4).getValues();
        for (i = 0; i < recentRows.length; i++) {
          var dt = recentRows[i][0], tel = String(recentRows[i][3] || "");
          if (dt && new Date(dt).getTime() >= cutoff && tel === data.telE164) recent++;
        }
      }
      if (recent >= 5) return fail("TROP_DE_DEMANDES", "Plusieurs demandes ont déjà été envoyées depuis ce numéro. Réessayez plus tard.");
      var code = newOrderCode_(sheet);
      var row = buildOrderRow_(code, data, "direct|" + rid, "sans OTP", now);
      row[33] = now; row[34] = "sans OTP"; row[35] = source;
      sheet.getRange(sheet.getLastRow() + 1, 1, 1, ORDER_COLS).setValues([row]);
      SpreadsheetApp.flush();
      var saved = findRowByCode_(sheet, code);
      if (!saved || String(saved.row[0]) !== code || String(saved.row[srcCol - 1]) !== source)
        throw new Error("la relecture de la demande enregistrée a échoué");
      try { notifyNewOrder_(code, data, "demande web (sans OTP)"); }
      catch (mailErr) { logEvent_("ALERTE", "commande.notification", code, "notification non envoyée"); }
      logEvent_("INFO", "commande.web_sans_otp", code, "zone " + (data.zone || "indéterminée"));
      return { ok: true, rid: rid, code: code, message: "Votre demande est enregistrée. GREAT EXPERTIZ étudiera votre besoin et vous transmettra un devis." };
    });
  } catch (err) {
    logEvent_("ERREUR", "commande.web_sans_otp", "", err && err.message ? err.message : "erreur");
    return fail("ERREUR_SERVEUR", "L’enregistrement n’a pas pu être confirmé. Réessayez dans un instant.");
  }
}

// ---------- Nouvelle commande (POST depuis le site client) ----------
function doPost(e) {
  var p = (e && e.parameter) || {};

  // Candidature publique : enregistrée dans une feuille séparée et notifiée au propriétaire.
  if (p.action === "submitCandidate") return candidateResponse_(saveCandidate_(p));

  // Espace membre client : inscription, connexion, déconnexion, mot de passe, messagerie — jamais de clé admin requise ici.
  var CLIENT_ACTIONS = ["registerClient", "loginClient", "logoutClient", "requestPasswordReset", "confirmPasswordReset", "sendMessage"];
  if (CLIENT_ACTIONS.indexOf(p.action) > -1) return clientResponse_(p.action, handleClient_(p));

  // Demande publique sans OTP : validation serveur, identifiant unique et protection anti-doublon.
  if (p.action === "submitOrder") return orderResponse_(handleDirectOrder_(p));

  // V3 : confirmation de commande par code OTP (compatibilité technique, non utilisée par le formulaire client)
  if (p.action === "requestOtp") return otpResponse_(handleRequestOtp_(p));
  if (p.action === "resendOtp") return otpResponse_(handleResendOtp_(p));
  if (p.action === "verifyOtp") return otpResponse_(handleVerifyOtp_(p));
  if (p.action === "waWebhook") return handleWaWebhookPost_(e);

  // Compatibilité : anciennes actions admin en POST
  if (p.action) return outputJson_(handleAdmin_(p), null);

  // V3 : plus aucune commande n'est enregistrée sans code OTP validé (chemin hérité désactivé par défaut).
  if (!LEGACY_DIRECT_ORDER_POST) return orderResponse_({ ok: false, error: "Cette page de commande n'est plus acceptée : la validation par code est obligatoire. Merci d'utiliser la nouvelle page de commande." });

  if (!p.code || !p.telephone || !p.enlevement || !p.livraison) return orderResponse_({ ok: false, error: "Informations incomplètes : numéro de commande, téléphone, enlèvement et livraison sont obligatoires." });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var outcome;
  try {
    var sheet = getOrdersSheet_();
    // Idempotence : si ce code existe déjà (ex. nouvel essai après coupure réseau), on confirme
    // sans ré-enregistrer — jamais de doublon, jamais de fausse erreur sur un envoi déjà réussi.
    if (findRowByCode_(sheet, p.code)) {
      outcome = { ok: true, code: p.code, already: true };
    } else {
      var o = {
        code: clean_(p.code, 40), prestation: clean_(p.prestation, 60), nom: clean_(p.nom, 120), telephone: clean_(p.telephone, 30),
        contact: clean_(p.contact, 120), telephoneDestinataire: clean_(p.telephoneDestinataire, 30), detail: clean_(p.detail, 3000),
        enlevement: clean_(p.enlevement, 250), livraison: clean_(p.livraison, 250), cbm: clean_(p.cbm, 10), prix: clean_(p.prix, 40),
        frequence: clean_(p.frequence, 30), notes: clean_(p.notes, 2000), paiement: clean_(p.paiement, 40), dateSouhaitee: clean_(p.dateSouhaitee, 12),
        vehiculeSouhaite: clean_(p.vehiculeSouhaite, 100),
        gpsEnlevement: clean_(p.gpsEnlevement, 60), gpsLivraison: clean_(p.gpsLivraison, 60),
        lienEnlevement: safeMapLink_(p.lienEnlevement), lienLivraison: safeMapLink_(p.lienLivraison), distanceKm: clean_(p.distanceKm, 10),
        emballage: clean_(p.emballage, 200), temperature: clean_(p.temperature, 80), poidsKg: clean_(p.poidsKg, 12), evaluation: clean_(p.evaluation, 10)
      };
      if (o.vehiculeSouhaite) o.notes = clean_((o.notes ? o.notes + " | " : "") + "Véhicule souhaité: " + o.vehiculeSouhaite, 2000);
      var photoUrl = "";
      if (p.photoData) {
        try { photoUrl = saveOrderPhoto_(o.code, p.photoData); }
        catch (photoErr) { o.notes = clean_((o.notes ? o.notes + " | " : "") + "Photo non enregistrée (" + (photoErr && photoErr.message ? photoErr.message : "erreur") + ")", 2000); }
      }
      o.photoUrl = photoUrl;
      // Si le client est connecté (jeton de session valide), la commande est associée à son espace personnel.
      // Une commande en invité reste possible : le parcours de commande n'exige jamais la connexion.
      var clientAuth = checkClientAuth_(p.clientToken);
      var clientId = clientAuth.valid ? clientAuth.clientId : "";
      sheet.appendRow([o.code, new Date(), o.prestation, o.nom, o.telephone, o.contact, o.telephoneDestinataire, o.detail,
        o.enlevement, o.livraison, o.cbm, o.prix, o.frequence, o.notes, "Reçue", o.paiement, o.dateSouhaitee,
        "false", "inbox", "", "", o.vehiculeSouhaite, clientId,
        o.gpsEnlevement, o.gpsLivraison, o.lienEnlevement, o.lienLivraison, o.distanceKm,
        photoUrl, o.emballage, o.temperature, o.poidsKg, o.evaluation]);
      if (!sheet.getRange(1, 22).getValue()) sheet.getRange(1, 22).setValue("Véhicule souhaité");
      if (!sheet.getRange(1, 23).getValue()) sheet.getRange(1, 23).setValue("ClientID");
      SpreadsheetApp.flush();
      // Vérification réelle : on relit la dernière ligne de la feuille. Le code n'est confirmé au client
      // que si CETTE commande est bien présente dans Google Sheets (le verrou garantit que c'est la nôtre).
      var lastRow = sheet.getLastRow();
      if (String(sheet.getRange(lastRow, 1).getValue()) !== String(o.code)) {
        throw new Error("la commande n'a pas pu être relue dans Google Sheets ; elle n'est pas confirmée");
      }
      // Une panne d'e-mail (quota, autorisation) ne doit jamais faire croire que la commande a échoué.
      try { sendNotification_(o); } catch (mailErr) { Logger.log("Notification e-mail impossible : " + mailErr); }
      outcome = { ok: true, code: p.code };
    }
  } catch (err) {
    outcome = { ok: false, error: "Erreur d'enregistrement : " + (err && err.message ? err.message : "réessayez.") };
  } finally {
    lock.releaseLock();
  }
  return orderResponse_(outcome);
}

// Même mécanisme que candidateResponse_/clientResponse_ : la page vit sur GitHub Pages et
// l'iframe cachée charge script.google.com (origine différente), donc le seul moyen fiable
// de faire revenir un résultat exploitable au navigateur est un postMessage, pas un texte brut.
function orderResponse_(result) {
  var payload = { type: "GE_ORDER_RESULT", rid: result.rid || "", ok: !!result.ok, code: result.code || "", error: result.error || "", message: result.message || "" };
  var json = JSON.stringify(payload).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput("<!doctype html><html><body><script>window.top.postMessage(" + json + ", '*');<\/script></body></html>").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// (V3) sendNotification_ est redéfinie dans le bloc « V3.0.0-TEST » : notification via file d'attente avec nouvelles tentatives.

// ---------- Actions admin (communes à GET et POST) ----------
function handleAdmin_(p) {
  var auth = checkAuth_(p.key);
  if (!auth.valid) return { ok: false, error: "unauthorized" };

  // Contrôle des droits côté serveur : masquer les boutons HTML ne protège pas l'API.
  // Les données personnelles des clients et les conversations sont réservées au propriétaire.
  var ownerOnlyActions = ["adminListClients", "adminToggleClient", "adminListMessages",
    "adminReplyMessage", "adminMarkMessagesRead", "listCandidates", "updateCandidateStatus",
    "addMember", "toggleMember", "deleteForever"];
  if (ownerOnlyActions.indexOf(p.action) !== -1 && !auth.isOwner) {
    return { ok: false, error: "réservé au propriétaire" };
  }

  // V3 : nouvelles actions (chacune contrôle ses droits côté serveur)
  var v3 = handleAdminV3_(p, auth);
  if (v3) return v3;

  if (p.action === "updateStatus") {
    if (STATUSES.indexOf(p.status) === -1) return { ok: false, error: "statut invalide" };
    var sheet = getOrdersSheet_();
    var f = findRowByCode_(sheet, p.code);
    if (!f) return { ok: false, error: "commande introuvable" };
    sheet.getRange(f.index + 1, 15).setValue(p.status);
    if (p.status === "Livrée") sheet.getRange(f.index + 1, 18).setValue("true");
    sheet.getRange(f.index + 1, 20).setValue(nowIso_());
    return { ok: true };
  }

  // Boîte de réception : lu / non lu, archivage, corbeille, restauration (tous les membres)
  if (p.action === "markRead" || p.action === "setFolder" || p.action === "restore") {
    var codes = String(p.codes || p.code || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 200);
    if (!codes.length) return { ok: false, error: "aucune commande" };
    var sh = getOrdersSheet_(), vals = sh.getDataRange().getValues(), n = 0;
    for (var i = 1; i < vals.length; i++) {
      if (codes.indexOf(String(vals[i][0])) === -1) continue;
      var r = i + 1;
      if (p.action === "markRead") { sh.getRange(r, 18).setValue(p.read === "false" ? "false" : "true"); }
      else if (p.action === "setFolder") {
        if (FOLDERS.indexOf(p.folder) === -1) return { ok: false, error: "dossier invalide" };
        sh.getRange(r, 19).setValue(p.folder);
        sh.getRange(r, 21).setValue(p.folder === "trash" ? nowIso_() : "");
      } else { sh.getRange(r, 19).setValue("inbox"); sh.getRange(r, 21).setValue(""); }
      sh.getRange(r, 20).setValue(nowIso_());
      n++;
    }
    return { ok: true, count: n };
  }

  // Espace membre : consultation des clients et messagerie (tout membre authentifié, comme la boîte de réception).
  if (p.action === "adminListClients") {
    var clSheet = getClientsSheet_(), clData = clSheet.getDataRange().getValues(), ordData = getOrdersSheet_().getDataRange().getValues();
    var counts = {};
    for (var oi = 1; oi < ordData.length; oi++) { var cid = String(ordData[oi][22] || ""); if (cid) counts[cid] = (counts[cid] || 0) + 1; }
    var clients = [];
    for (var ci2 = 1; ci2 < clData.length; ci2++) {
      if (!clData[ci2][0]) continue;
      clients.push({ clientId: String(clData[ci2][0]), nom: String(clData[ci2][1] || ""), entreprise: String(clData[ci2][2] || ""), email: String(clData[ci2][3] || ""), telephone: phone_(clData[ci2][4]), dateInscription: dateOnly_(clData[ci2][7]), statut: String(clData[ci2][8] || "Actif"), commandes: counts[String(clData[ci2][0])] || 0 });
    }
    return { ok: true, clients: clients };
  }

  if (p.action === "adminToggleClient") {
    if (["Actif", "Suspendu"].indexOf(p.newStatus) === -1) return { ok: false, error: "statut invalide" };
    var tcSheet = getClientsSheet_(), tcf = findClientById_(tcSheet, p.clientId);
    if (!tcf) return { ok: false, error: "client introuvable" };
    tcSheet.getRange(tcf.index + 1, 9).setValue(p.newStatus);
    return { ok: true };
  }

  if (p.action === "adminListMessages") {
    var msSheet = getMessagesSheet_(), msData = msSheet.getDataRange().getValues(), out2 = [];
    for (var mi = 1; mi < msData.length; mi++) {
      if (!msData[mi][0]) continue;
      out2.push({ id: String(msData[mi][0]), date: msData[mi][1], clientId: String(msData[mi][2]), client: String(msData[mi][3] || ""), auteur: String(msData[mi][4]), message: String(msData[mi][5] || ""), luAdmin: String(msData[mi][6]) === "true", luClient: String(msData[mi][7]) === "true" });
    }
    return { ok: true, messages: out2 };
  }

  if (p.action === "adminReplyMessage") {
    var rcid = clean_(p.clientId, 40), rtxt = clean_(p.message, 1200);
    if (!rcid || !rtxt) return { ok: false, error: "destinataire ou message manquant" };
    var rcf = findClientById_(getClientsSheet_(), rcid);
    if (!rcf) return { ok: false, error: "client introuvable" };
    var rid = "MSG-" + Utilities.getUuid().split("-")[0].toUpperCase();
    getMessagesSheet_().appendRow([rid, new Date(), rcid, rcf.row[1], "admin", rtxt, "true", "false"]);
    try { MailApp.sendEmail({ to: rcf.row[3], subject: "Réponse de GREAT EXPERTIZ", htmlBody: "<p>" + esc_(rtxt) + "</p><p style='color:#5B7285;font-size:12px'>Connectez-vous à votre espace GREAT EXPERTIZ pour répondre.</p>" }); } catch (err) {}
    return { ok: true };
  }

  if (p.action === "adminMarkMessagesRead") {
    var amcid = clean_(p.clientId, 40);
    var amSheet = getMessagesSheet_(), amData = amSheet.getDataRange().getValues(), amn = 0;
    for (var ami = 1; ami < amData.length; ami++) {
      if (String(amData[ami][2]) === amcid && String(amData[ami][4]) === "client" && String(amData[ami][6]) !== "true") {
        amSheet.getRange(ami + 1, 7).setValue("true"); amn++;
      }
    }
    return { ok: true, count: amn };
  }

  if (!auth.isOwner) return { ok: false, error: "réservé au propriétaire" };

  // Suppression définitive : propriétaire uniquement, et seulement depuis la corbeille
  if (p.action === "deleteForever") {
    var dc = String(p.codes || p.code || "").split(",").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 200);
    var ds = getOrdersSheet_(), dv = ds.getDataRange().getValues(), del = 0;
    for (var k = dv.length - 1; k >= 1; k--) {
      if (dc.indexOf(String(dv[k][0])) > -1 && String(dv[k][18]) === "trash") { ds.deleteRow(k + 1); del++; }
    }
    return { ok: true, count: del };
  }

  if (p.action === "addMember") {
    var name = clean_(p.name, 80);
    if (!name) return { ok: false, error: "nom manquant" };
    var newKey = generateKey_();
    getMembersSheet_().appendRow([name, newKey, new Date(), "Actif"]);
    return { ok: true, name: name, key: newKey };
  }

  if (p.action === "toggleMember") {
    if (["Actif", "Inactif"].indexOf(p.newStatus) === -1) return { ok: false, error: "statut invalide" };
    var ms = getMembersSheet_(), md = ms.getDataRange().getValues();
    for (var j = 1; j < md.length; j++) {
      if (md[j][1] === p.targetKey) { ms.getRange(j + 1, 4).setValue(p.newStatus); return { ok: true }; }
    }
    return { ok: false, error: "membre introuvable" };
  }
  // Gestion des candidatures : propriétaire uniquement.
  if (p.action === "listCandidates") {
    if (!auth.isOwner) return { error: "unauthorized" };
    var cs = getCandidatesSheet_(), cv = cs.getDataRange().getValues(), out = [];
    for (var ci = 1; ci < cv.length; ci++) {
      if (!cv[ci][0]) continue;
      out.push({ reference: String(cv[ci][0]), date: cv[ci][1] instanceof Date ? Utilities.formatDate(cv[ci][1], TZ, "yyyy-MM-dd HH:mm") : String(cv[ci][1] || ""), profil: String(cv[ci][2] || ""), nom: String(cv[ci][3] || ""), telephone: phone_(cv[ci][4]), email: String(cv[ci][5] || ""), localisation: String(cv[ci][6] || ""), vehicule: String(cv[ci][7] || ""), capacite: String(cv[ci][8] || ""), permis: String(cv[ci][9] || ""), disponibilite: String(cv[ci][10] || ""), experience: String(cv[ci][11] || ""), message: String(cv[ci][12] || ""), statut: String(cv[ci][13] || "À étudier") });
    }
    return { ok: true, candidates: out };
  }
  if (p.action === "updateCandidateStatus") {
    if (!auth.isOwner) return { ok: false, error: "unauthorized" };
    var statusAllowed = ["À étudier", "Contacté", "Accepté", "Refusé"];
    if (statusAllowed.indexOf(p.status) === -1) return { ok: false, error: "statut invalide" };
    var candidateSheet = getCandidatesSheet_(), candidateRows = candidateSheet.getDataRange().getValues();
    for (var cj = 1; cj < candidateRows.length; cj++) {
      if (String(candidateRows[cj][0]) === String(p.reference)) { candidateSheet.getRange(cj + 1, 14).setValue(p.status); return { ok: true }; }
    }
    return { ok: false, error: "candidature introuvable" };
  }
  return { ok: false, error: "action inconnue" };
}

// ---------- Lecture (GET / JSONP) ----------
function doGet(e) {
  var p = (e && e.parameter) || {};

  // Diagnostic public minimal : permet de confirmer que la bonne version est déployée.
  // Ne renvoie aucune donnée de commande ni information privée.
  if (p.action === "health") {
    var created = false; try { created = ensureOwnerKey_(); } catch (e) {}
    return outputJson_({ ok: true, service: "GREAT EXPERTIZ", version: VERSION, release: RELEASE_DATE, mode: (MODE_TEST ? "test" : "production"), status: "active", tz: TZ, ownerKeySet: !!getOwnerKey_(), ownerKeyJustCreated: created, timestamp: nowIso_() }, p.callback);
  }

  if (p.action === "waWebhook") return handleWaWebhookGet_(p);
  if (p.action === "adminLogin") return outputJson_(adminLogin_(p.key), p.callback);
  if (p.action === "adminLogout") return outputJson_(adminLogout_(p.token), p.callback);
  if (p.action === "diag") {
    var da = checkAuth_(p.key);
    if (!da.valid || !da.isOwner) return outputJson_({ error: "unauthorized" }, p.callback);
    return outputJson_(diagnostic_(), p.callback);
  }

  if (p.action === "list") {
    var auth = checkAuth_(p.key);
    if (!auth.valid) return outputJson_({ auth: { valid: false }, orders: [] }, p.callback);
    var data = getOrdersSheet_().getDataRange().getValues();
    var rows = [];
    for (var i = 1; i < data.length; i++) {
      if (!data[i][0]) continue;
      try { rows.push({
        code: data[i][0], date: data[i][1], prestation: data[i][2], nom: data[i][3], telephone: phone_(data[i][4]),
        contact: data[i][5], telephoneDestinataire: phone_(data[i][6]), detail: data[i][7], enlevement: data[i][8],
        livraison: data[i][9], cbm: data[i][10], prix: data[i][11], frequence: data[i][12], notes: data[i][13],
        statut: data[i][14] || "Reçue", paiement: data[i][15], dateSouhaitee: dateOnly_(data[i][16]),
        lu: isRead_(data[i]), dossier: String(data[i][18] || "inbox"), dateAction: String(data[i][19] || ""), dateSuppression: String(data[i][20] || ""), vehiculeSouhaite: String(data[i][21] || ""), clientId: String(data[i][22] || ""),
        gpsEnlevement: String(data[i][23] || ""), gpsLivraison: String(data[i][24] || ""), lienEnlevement: String(data[i][25] || ""), lienLivraison: String(data[i][26] || ""), distanceKm: String(data[i][27] || ""),
        photoUrl: String(data[i][28] || ""), emballage: String(data[i][29] || ""), temperature: String(data[i][30] || ""), poidsKg: String(data[i][31] || ""), evaluation: String(data[i][32] || ""),
        verifieLe: data[i][33] instanceof Date ? Utilities.formatDate(data[i][33], TZ, "yyyy-MM-dd'T'HH:mm:ssXXX") : String(data[i][33] || ""), canalOtp: String(data[i][34] || ""), source: String(data[i][35] || ""), zone: String(data[i][36] || ""), tarifKm: String(data[i][37] || ""), dureeMin: String(data[i][38] || "")
      }); } catch (rowErr) { rows.push({ code: String(data[i][0]), statut: "Reçue", dossier: "inbox", lu: false, notes: "Ligne illisible dans la feuille (ligne " + (i + 1) + ")" }); }
    }
    return outputJson_({ auth: auth, meta: { version: VERSION, count: rows.length, tz: TZ }, orders: rows }, p.callback);
  }

  if (p.action === "listMembers") {
    var a2 = checkAuth_(p.key);
    if (!a2.valid || !a2.isOwner) return outputJson_({ error: "unauthorized" }, p.callback);
    var md = getMembersSheet_().getDataRange().getValues(), members = [];
    for (var j = 1; j < md.length; j++) {
      if (!md[j][0]) continue;
      members.push({ nom: md[j][0], cle: md[j][1], date: md[j][2], statut: md[j][3] });
    }
    return outputJson_(members, p.callback);
  }

  // Espace membre client : lecture par jeton de session (jamais par identifiant transmis seul par le navigateur).
  if (p.action === "myOrders") {
    var moAuth = checkClientAuth_(p.token);
    if (!moAuth.valid) return outputJson_({ auth: { valid: false, error: moAuth.error || "" }, orders: [] }, p.callback);
    var moData = getOrdersSheet_().getDataRange().getValues(), moOut = [];
    for (var moi = 1; moi < moData.length; moi++) {
      if (String(moData[moi][22] || "") !== moAuth.clientId) continue;
      moOut.push({ code: moData[moi][0], date: moData[moi][1], prestation: moData[moi][2], detail: moData[moi][7], enlevement: moData[moi][8], livraison: moData[moi][9], cbm: moData[moi][10], prix: moData[moi][11], statut: moData[moi][14] || "Reçue", paiement: moData[moi][15], dateSouhaitee: dateOnly_(moData[moi][16]) });
    }
    moOut.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
    return outputJson_({ auth: { valid: true, nom: moAuth.nom, entreprise: moAuth.entreprise, email: moAuth.email }, orders: moOut }, p.callback);
  }

  if (p.action === "myMessages") {
    var mmAuth = checkClientAuth_(p.token);
    if (!mmAuth.valid) return outputJson_({ auth: { valid: false, error: mmAuth.error || "" }, messages: [] }, p.callback);
    var mmData = getMessagesSheet_().getDataRange().getValues(), mmOut = [];
    for (var mmi = 1; mmi < mmData.length; mmi++) {
      if (String(mmData[mmi][2]) !== mmAuth.clientId) continue;
      mmOut.push({ id: mmData[mmi][0], date: mmData[mmi][1], auteur: mmData[mmi][4], message: mmData[mmi][5] });
    }
    // La visite de cette page vaut accusé de lecture des réponses de l'administration.
    var mmSheet = getMessagesSheet_();
    for (var mmj = 1; mmj < mmData.length; mmj++) {
      if (String(mmData[mmj][2]) === mmAuth.clientId && String(mmData[mmj][4]) === "admin" && String(mmData[mmj][7]) !== "true") mmSheet.getRange(mmj + 1, 8).setValue("true");
    }
    return outputJson_({ auth: { valid: true }, messages: mmOut }, p.callback);
  }

  if (V3_ADMIN_ACTIONS.concat(["updateStatus", "addMember", "toggleMember", "markRead", "setFolder", "restore", "deleteForever", "listCandidates", "updateCandidateStatus", "adminListClients", "adminToggleClient", "adminListMessages", "adminReplyMessage", "adminMarkMessagesRead"]).indexOf(p.action) > -1) {
    var adminResult = handleAdmin_(p);
    if (p.action === "listCandidates") return outputJson_(adminResult && adminResult.candidates ? adminResult.candidates : { error: (adminResult && adminResult.error) || "unauthorized" }, p.callback);
    return outputJson_(adminResult, p.callback);
  }

  // Suivi public : ne renvoie que l'essentiel (communes seulement, pas d'adresse précise)
  if (p.action === "track") {
    var trackCache = CacheService.getScriptCache(), trackKey = "trk" + Utilities.formatDate(new Date(), TZ, "yyyyMMddHHmm"), trackN = Number(trackCache.get(trackKey) || 0) + 1;
    trackCache.put(trackKey, String(trackN), 120);
    if (trackN > 60) return outputJson_({ found: false, throttled: true }, p.callback);   // V3 : limite anti-énumération des numéros de commande
    var f = findRowByCode_(getOrdersSheet_(), clean_(p.code, 40));
    if (!f) return outputJson_({ found: false }, p.callback);
    var r = f.row;
    return outputJson_({
      found: true, code: r[0], date: r[1], prestation: r[2],
      enlevement: String(r[8]).split(",").pop().trim(), livraison: String(r[9]).split(",").pop().trim(),
      cbm: r[10], prix: r[11], statut: r[14] || "Reçue", dateSouhaitee: dateOnly_(r[16])
    }, p.callback);
  }

  return HtmlService.createHtmlOutput("<!doctype html><html lang=\"fr\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>GREAT EXPERTIZ</title><body style=\"font:16px Arial,sans-serif;max-width:620px;margin:48px auto;padding:24px;color:#0E3A54\"><h1>GREAT EXPERTIZ</h1><p>Le service Apps Script répond.</p><p>Version backend : " + VERSION + "</p><p>Pour tester le diagnostic technique, ouvrez cette même adresse avec <code>?action=health</code>.</p></body></html>");
}

// =====================================================================
// ======================  V3.0.0-TEST — NOUVEAUX MODULES  ==============
// Tout ce qui suit est AJOUTÉ à la version 2.6.0 : les fonctions d'origine
// (authentification, espace client, candidatures, messagerie, suivi) sont conservées.
// =====================================================================
// ---- Sécurité de la copie de test ----
var MODE_TEST = true;                                   // true = copie de test (garde-fous actifs)
var PROD_SHEET_ID = ""; // aucun identifiant de production dans le dépôt ou le backend de test
var LEGACY_DIRECT_ORDER_POST = false;                   // false = plus aucune commande sans code OTP validé

// ---- Onglets ----
var OFFICIAL_ORDERS_SHEET = "Commandes_GE";             // seul onglet opérationnel officiel
var PENDING_SHEET = "Demandes_En_Attente";
var OTP_SHEET = "OTP";
var JOURNAL_SHEET = "Journal_GE";
var EMAIL_QUEUE_SHEET = "File_Emails";
var SETTINGS_SHEET = "Parametres";
var TARIFS_SHEET = "Tarifs_Km";
var TARIFS_HIST_SHEET = "Tarifs_Historique";
var QUOTES_SHEET = "Cotations";

// ---- Règles OTP VALIDÉES (non modifiables depuis l'administration) ----
var OTP_VALIDITE_MIN = 10;
var OTP_MAX_TENTATIVES = 5;
var OTP_MAX_ENVOIS_HEURE = 3;

// ---- Règles tarifaires VALIDÉES ----
var TARIF_BASE_FCFA = 20000;          // jusqu'à 2 CBM
var TARIF_BASE_CBM = 2;
var TARIF_CBM_SUPPL_FCFA = 10000;     // par CBM supplémentaire (volume arrondi à l'entier supérieur)
var TARIF_MANUTENTIONNAIRE_FCFA = 5000;
var TARIF_ETAGE_FCFA = 5000;          // rez-de-chaussée = 0
var TARIF_CBM_SPECIFIQUE_AU_DELA = 10; // au-delà de 10 CBM : cotation spécifique

var VALID_PRESTATIONS = ["Déménagement", "Transport de marchandises", "Transport de matériel et équipements",
  "Transport frigorifique", "Transport exceptionnel et charges lourdes", "Autres transports et prestations"];
var EMBALLAGE_CHOICES = {
  deja_emballe: "Déjà emballé",
  protection_supplementaire: "Protection supplémentaire souhaitée",
  prestation_emballage: "Prestation d'emballage souhaitée",
  besoin_conseils: "Conseils souhaités"
};

var NEW_ORDER_HEADERS = ["Vérifié WhatsApp le", "Canal OTP", "Source", "Zone", "Tarification km", "Durée estimée (min)"];
var PENDING_HEADERS = ["PendingID", "Créée le", "Expire le", "Données (JSON)", "État", "Code commande"];
var OTP_HEADERS = ["OtpID", "PendingID", "Créé le", "Expire le", "Téléphone (empreinte)", "Téléphone (masqué)", "Sel", "Code (empreinte)",
  "Tentatives", "État du code", "Canal", "État de l'envoi", "ID message prestataire", "Accepté le", "Accusé non vérifié", "Preuve de livraison", "Code commande"];
var JOURNAL_HEADERS = ["Date", "Niveau", "Opération", "Référence", "Détail"];
var EMAIL_HEADERS = ["ID", "Créé le", "Destinataire", "Sujet", "Corps HTML", "Référence", "État", "Tentatives", "Dernière tentative", "Prochaine tentative", "Dernière erreur"];
var SETTINGS_HEADERS = ["Clé", "Valeur", "Description", "Modifié le", "Modifié par"];
var TARIFS_HEADERS = ["ID", "Zone", "Catégorie", "Libellé", "Tarif FCFA/km", "Mode", "Actif", "Statut", "Note / source", "Modifié le", "Modifié par"];
var TARIFS_HIST_HEADERS = ["Date", "ID tarif", "Champ", "Ancienne valeur", "Nouvelle valeur", "Par"];
var QUOTE_HEADERS = ["CotationID", "Code commande", "Créée le", "Par", "Zone", "Catégorie véhicule", "Distance km", "Facturation du trajet",
  "CBM saisi", "CBM arrondi", "Manutentionnaires", "Étages", "Détail (JSON)", "Total partiel FCFA", "Complète", "Statut"];

var SETTINGS_DEFAULTS = [
  ["OTP_CANAL_PRINCIPAL", "whatsapp_meta", "Canal OTP principal : whatsapp_meta, sms_orange, sms_generic ou email"],
  ["OTP_CANAL_ALTERNATIF", "sms_orange", "Canal alternatif, utilisé seulement si OTP_ALTERNATIF_ACTIF = true"],
  ["OTP_ALTERNATIF_ACTIF", "false", "Activer le canal alternatif (true/false)"],
  ["OTP_ENVOI_REEL_ACTIF", "false", "Autoriser les envois réels, éventuellement payants. Laisser false tant que le propriétaire ne l'a pas autorisé."],
  ["OTP_LIMITE_JOUR", "50", "Plafond global d'envois OTP par jour (valeur de départ NON VALIDÉE)"],
  ["DEMANDE_VALIDITE_MIN", "60", "Durée de conservation d'une demande en attente de validation, en minutes (valeur de départ NON VALIDÉE)"],
  ["TRAJET_FACTURATION", "aller_simple", "aller_simple ou aller_retour (retour à vide facturé). Règle de facturation du retour NON DÉFINIE : ne pas changer sans décision."],
  ["GRAND_ABIDJAN_LIEUX", "Abobo|Adjamé|Anyama|Attécoubé|Bingerville|Cocody|Koumassi|Marcory|Plateau|Port-Bouët|Songon|Treichville|Yopougon|Abidjan",
    "Communes considérées comme Grand Abidjan (transport intra-urbain), séparées par |"]
];

var VEHICLE_CATEGORIES = {
  tricycle_cargo: "Tricycle cargo",
  utilitaire: "Utilitaire / camionnette",
  camion_6_roues: "Camion 6 roues",
  camion_10_roues: "Camion 10 roues",
  semi_remorque: "Semi-remorque",
  poids_lourd: "Poids lourd"
};
var DEC_TARIF = "Décision propriétaire du 2026-11-20";
var TARIFS_SEED = [
  ["T-INTRA-TRICYCLE", "intra", "tricycle_cargo", "Tricycle cargo", 200, "auto", "true", DEC_TARIF, "Intra-urbain : Grand Abidjan uniquement"],
  ["T-INTRA-UTILITAIRE", "intra", "utilitaire", "Utilitaire / camionnette", 300, "auto", "true", DEC_TARIF, "Intra-urbain : Grand Abidjan uniquement"],
  ["T-INTRA-POIDS_LOURD", "intra", "poids_lourd", "Poids lourd", 500, "auto", "true", DEC_TARIF, "Intra-urbain : Grand Abidjan uniquement"],
  ["T-EXTRA-UTILITAIRE", "extra", "utilitaire", "Utilitaire / camionnette", "", "devis", "true", "Sur devis (" + DEC_TARIF + ")", "Aucun tarif kilométrique automatique hors Abidjan"],
  ["T-EXTRA-CAMION_6", "extra", "camion_6_roues", "Camion 6 roues", "", "devis", "true", "Sur devis (" + DEC_TARIF + ")", "Aucun tarif kilométrique automatique hors Abidjan"],
  ["T-EXTRA-CAMION_10", "extra", "camion_10_roues", "Camion 10 roues", "", "devis", "true", "Sur devis (" + DEC_TARIF + ")", "Aucun tarif kilométrique automatique hors Abidjan"],
  ["T-EXTRA-SEMI", "extra", "semi_remorque", "Semi-remorque", "", "devis", "true", "Sur devis (" + DEC_TARIF + ")", "Aucun tarif kilométrique automatique hors Abidjan"],
  ["T-EXTRA-POIDS_LOURD", "extra", "poids_lourd", "Poids lourd", "", "devis", "true", "Sur devis (" + DEC_TARIF + ")", "Aucun tarif kilométrique automatique hors Abidjan"]
];

// ---------- Garde-fous de la copie de test ----------
var __ssCache = null;
function openSS_() {
  if (String(SHEET_ID).indexOf("REMPLACER") === 0) throw new Error("SHEET_ID non configuré : renseignez l'identifiant de la COPIE de test du classeur.");
  if (MODE_TEST && String(SHEET_ID) === PROD_SHEET_ID) throw new Error("Copie de test : le classeur de production ne doit pas être utilisé.");
  if (!__ssCache) __ssCache = SpreadsheetApp.openById(SHEET_ID);
  return __ssCache;
}

function getAuxSheet_(name, headers) {
  var ss = openSS_(), sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); }
  else if (sh.getLastRow() === 0) sh.appendRow(headers);
  return sh;
}

function colOf_(headers, label) { return headers.indexOf(label) + 1; }   // numéro de colonne (1-based)

// ---------- Journal technique (sans secrets, sans codes OTP, numéros masqués) ----------
var SECRET_PROP_NAMES = ["GE_WA_TOKEN", "GE_WA_WEBHOOK_SECRET", "GE_WA_WEBHOOK_VERIFY_TOKEN", "GE_ORANGE_CLIENT_SECRET", "GE_ORANGE_CLIENT_ID",
  "GE_SMS_HEADERS_JSON", "GE_OTP_PEPPER", "GE_OWNER_KEY"];
// Masque toute valeur de secret configurée si un message d'erreur d'un prestataire la répète.
function scrubSecrets_(s) {
  try {
    var props = PropertiesService.getScriptProperties();
    SECRET_PROP_NAMES.forEach(function (n) { var v = props.getProperty(n); if (v && String(v).length >= 6) s = s.split(String(v)).join("***"); });
  } catch (e) {}
  return s;
}

function scrubForLog_(s) {
  s = scrubSecrets_(String(s == null ? "" : s));
  s = s.replace(/\+?225\s?\d{10}/g, "+225**********")
       .replace(/\b0[157]\d{8}\b/g, "0*********")
       .replace(/\b\d{6}\b/g, "******")
       .replace(/(Bearer\s+)[A-Za-z0-9._\-~+\/=]+/gi, "$1***")
       .replace(/(access_token|client_secret|token|key|k)=[^&\s"']+/gi, "$1=***");
  return s.substring(0, 300);
}

function logEvent_(level, op, ref, detail) {
  try {
    var sh = getAuxSheet_(JOURNAL_SHEET, JOURNAL_HEADERS);
    sh.appendRow([new Date(), level, op, clean_(ref, 40), scrubForLog_(detail)]);
  } catch (e) {
    try { Logger.log("[journal indisponible] " + op + " " + scrubForLog_(detail)); } catch (e2) {}
  }
}

// ---------- Numéros ivoiriens : +225 suivi de 10 chiffres (préfixes 01, 05, 07) ----------
function normalizePhoneCI_(raw) {
  var s = String(raw == null ? "" : raw).replace(/\D/g, "");
  if (s.indexOf("00225") === 0) s = s.substring(5);
  else if (s.indexOf("225") === 0 && s.length === 13) s = s.substring(3);
  if (s.length === 8 || s.length === 9) return { ok: false, error: "Les numéros ivoiriens comportent 10 chiffres (ex. 07 48 11 03 35)." };
  if (s.length !== 10) return { ok: false, error: "Numéro invalide : indiquez 10 chiffres." };
  if (!/^(01|05|07)\d{8}$/.test(s)) return { ok: false, error: "Numéro mobile invalide : il doit commencer par 01, 05 ou 07." };
  return { ok: true, national: s, e164: "+225" + s, masked: "+225 " + s.substr(0, 2) + " ** ** ** " + s.substr(8, 2) };
}

// ---------- Paramètres (onglet « Parametres ») ----------
function getSettingsMap_() {
  var map = {}, i;
  for (i = 0; i < SETTINGS_DEFAULTS.length; i++) map[SETTINGS_DEFAULTS[i][0]] = String(SETTINGS_DEFAULTS[i][1]);
  var sh = openSS_().getSheetByName(SETTINGS_SHEET);
  if (sh && sh.getLastRow() > 1) {
    var d = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (i = 0; i < d.length; i++) if (d[i][0] && Object.prototype.hasOwnProperty.call(map, String(d[i][0]))) map[String(d[i][0])] = String(d[i][1]);
  }
  return map;
}
function getSetting_(key) { var m = getSettingsMap_(); return m[key]; }

function oneOf_(list) { return function (v) { v = String(v).trim(); return list.indexOf(v) > -1 ? v : null; }; }
function boolSetting_(v) { v = String(v).trim().toLowerCase(); return (v === "true" || v === "false") ? v : null; }
function intRange_(a, b) { return function (v) { var n = Number(String(v).trim()); return (isFinite(n) && Math.floor(n) === n && n >= a && n <= b) ? String(n) : null; }; }
var SETTING_VALIDATORS = {
  OTP_CANAL_PRINCIPAL: oneOf_(["whatsapp_meta", "sms_orange", "sms_generic", "email"]),
  OTP_CANAL_ALTERNATIF: oneOf_(["whatsapp_meta", "sms_orange", "sms_generic", "email"]),
  OTP_ALTERNATIF_ACTIF: boolSetting_,
  OTP_ENVOI_REEL_ACTIF: boolSetting_,
  OTP_LIMITE_JOUR: intRange_(1, 5000),
  DEMANDE_VALIDITE_MIN: intRange_(15, 240),
  TRAJET_FACTURATION: oneOf_(["aller_simple", "aller_retour"]),
  GRAND_ABIDJAN_LIEUX: function (v) { v = String(v).trim(); return /^[A-Za-zÀ-ÿ' \-|]{2,600}$/.test(v) ? v : null; }
};

function setSetting_(key, value, who) {
  var validator = SETTING_VALIDATORS[key];
  if (!validator) return { ok: false, error: "paramètre non modifiable" };
  var v = validator(value);
  if (v === null) return { ok: false, error: "valeur invalide pour " + key };
  var sh = getAuxSheet_(SETTINGS_SHEET, SETTINGS_HEADERS), rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [];
  var old = null, r = -1;
  for (var i = 0; i < rows.length; i++) if (String(rows[i][0]) === key) { r = i + 2; old = String(rows[i][1]); break; }
  if (r < 0) {
    var desc = ""; for (var j = 0; j < SETTINGS_DEFAULTS.length; j++) if (SETTINGS_DEFAULTS[j][0] === key) desc = SETTINGS_DEFAULTS[j][2];
    sh.appendRow([key, v, desc, new Date(), who || ""]);
  } else {
    sh.getRange(r, 2).setValue(v); sh.getRange(r, 4).setValue(new Date()); sh.getRange(r, 5).setValue(who || "");
  }
  logEvent_("INFO", "parametre.modifie", key, "ancienne valeur : " + (old == null ? "(défaut)" : old) + " ; nouvelle : " + v + " ; par " + (who || "?"));
  return { ok: true, key: key, value: v };
}

// ---------- Zone : intra-urbain (Grand Abidjan) ou extra-urbain ----------
function norm_(s) { return String(s == null ? "" : s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim(); }
function placeCommune_(place, communeField) {
  var c = clean_(communeField, 80);
  if (c) return c;
  var parts = String(place == null ? "" : place).split(",");
  return parts[parts.length - 1].trim();
}
function inGrandAbidjan_(commune, listStr) {
  var c = norm_(commune);
  if (!c) return false;
  var list = String(listStr || getSetting_("GRAND_ABIDJAN_LIEUX")).split("|").map(norm_);
  return list.indexOf(c) > -1;
}
// Retourne « intra », « extra » ou « indetermine » (traité comme « sur devis » : jamais de prix automatique en cas de doute).
function classifyZone_(o, listStr) {
  var a = placeCommune_(o.enlevement, o.communeEnlevement), b = placeCommune_(o.livraison, o.communeLivraison);
  if (!a || !b) return "indetermine";
  return (inGrandAbidjan_(a, listStr) && inGrandAbidjan_(b, listStr)) ? "intra" : "extra";
}

// ---------- Tarifs kilométriques (onglet « Tarifs_Km » + historique) ----------
function seedSheets_() {
  var i, sh;
  sh = getAuxSheet_(SETTINGS_SHEET, SETTINGS_HEADERS);
  var have = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { have[String(r[0])] = true; });
  for (i = 0; i < SETTINGS_DEFAULTS.length; i++) if (!have[SETTINGS_DEFAULTS[i][0]]) sh.appendRow([SETTINGS_DEFAULTS[i][0], SETTINGS_DEFAULTS[i][1], SETTINGS_DEFAULTS[i][2], new Date(), "installation"]);
  sh = getAuxSheet_(TARIFS_SHEET, TARIFS_HEADERS);
  var haveT = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { haveT[String(r[0])] = true; });
  for (i = 0; i < TARIFS_SEED.length; i++) {
    var t = TARIFS_SEED[i];
    if (!haveT[t[0]]) sh.appendRow([t[0], t[1], t[2], t[3], t[4], t[5], t[6], t[7], t[8], new Date(), "installation"]);
  }
  getAuxSheet_(TARIFS_HIST_SHEET, TARIFS_HIST_HEADERS);
  getAuxSheet_(QUOTES_SHEET, QUOTE_HEADERS);
}

function getTarifs_() {
  var sh = getAuxSheet_(TARIFS_SHEET, TARIFS_HEADERS), out = [];
  if (sh.getLastRow() < 2) return out;
  var d = sh.getRange(2, 1, sh.getLastRow() - 1, TARIFS_HEADERS.length).getValues();
  for (var i = 0; i < d.length; i++) {
    if (!d[i][0]) continue;
    var n = d[i][4] === "" || d[i][4] == null ? null : Number(d[i][4]);
    out.push({ row: i + 2, id: String(d[i][0]), zone: String(d[i][1]), categorie: String(d[i][2]), libelle: String(d[i][3]),
      tarif: (n != null && isFinite(n)) ? n : null, mode: String(d[i][5]), actif: String(d[i][6]).toLowerCase() === "true",
      statut: String(d[i][7]), note: String(d[i][8]) });
  }
  return out;
}

function findTarif_(tarifs, zone, categorie) {
  for (var i = 0; i < tarifs.length; i++) if (tarifs[i].zone === zone && tarifs[i].categorie === categorie && tarifs[i].actif) return tarifs[i];
  return null;
}

function setTarif_(p, who) {
  var id = clean_(p.id, 40), tarifs = getTarifs_(), t = null;
  for (var i = 0; i < tarifs.length; i++) if (tarifs[i].id === id) { t = tarifs[i]; break; }
  if (!t) return { ok: false, error: "tarif introuvable" };
  var sh = getAuxSheet_(TARIFS_SHEET, TARIFS_HEADERS), hist = getAuxSheet_(TARIFS_HIST_SHEET, TARIFS_HIST_HEADERS), changes = [];
  if (p.mode != null && p.mode !== "") {
    if (p.mode !== "auto" && p.mode !== "devis") return { ok: false, error: "mode invalide (auto ou devis)" };
    if (p.mode !== t.mode) changes.push(["Mode", t.mode, p.mode, 6, p.mode]);
  }
  if (p.tarif != null && p.tarif !== "") {
    var n = Number(String(p.tarif).replace(",", "."));
    if (!isFinite(n) || n < 0 || n > 100000) return { ok: false, error: "tarif invalide (0 à 100000 FCFA/km)" };
    if (n !== t.tarif) changes.push(["Tarif FCFA/km", t.tarif == null ? "" : t.tarif, n, 5, n]);
  }
  if (p.actif != null && p.actif !== "") {
    var a = String(p.actif).toLowerCase();
    if (a !== "true" && a !== "false") return { ok: false, error: "actif invalide (true/false)" };
    if ((a === "true") !== t.actif) changes.push(["Actif", String(t.actif), a, 7, a]);
  }
  var newMode = p.mode ? p.mode : t.mode, newTarif = (p.tarif != null && p.tarif !== "") ? Number(String(p.tarif).replace(",", ".")) : t.tarif;
  if (newMode === "auto" && !(newTarif > 0)) return { ok: false, error: "un tarif automatique doit avoir un montant supérieur à 0" };
  if (p.note != null && p.note !== "") { var note = clean_(p.note, 200); if (note !== t.note) changes.push(["Note / source", t.note, note, 9, note]); }
  if (!changes.length) return { ok: true, id: id, unchanged: true };
  var now = new Date();
  changes.forEach(function (c) {
    sh.getRange(t.row, c[3]).setValue(c[4]);
    hist.appendRow([now, id, c[0], c[1], c[2], who || ""]);
  });
  sh.getRange(t.row, 8).setValue("Modifié par le propriétaire");
  sh.getRange(t.row, 10).setValue(now); sh.getRange(t.row, 11).setValue(who || "");
  logEvent_("INFO", "tarif.modifie", id, changes.map(function (c) { return c[0] + ": " + c[1] + " -> " + c[2]; }).join("; "));
  return { ok: true, id: id };
}

// ---------- Cotation interne ----------
function roundUpCbm_(cbm) { return Math.ceil(Math.round(cbm * 1e6) / 1e6); }

// Calcul pur : aucune écriture. Ne produit JAMAIS un prix pour un trajet « sur devis » et n'inclut aucun prix d'emballage ou de protection.
function computeQuote_(inp, tarifs, settings) {
  var warn = [], lines = [];
  var cbm = Number(inp.cbm), helpers = Number(inp.helpers || 0), floors = Number(inp.floors || 0);
  if (!isFinite(cbm) || cbm <= 0) return { ok: false, error: "volume (CBM) requis et supérieur à 0" };
  if (!(helpers >= 0 && helpers <= 50 && Math.floor(helpers) === helpers)) return { ok: false, error: "nombre de manutentionnaires invalide" };
  if (!(floors >= 0 && floors <= 100 && Math.floor(floors) === floors)) return { ok: false, error: "nombre d'étages invalide" };
  var dist = (inp.distanceKm === null || inp.distanceKm === undefined || inp.distanceKm === "") ? null : Number(inp.distanceKm);
  if (dist !== null && (!isFinite(dist) || dist < 0 || dist > 10000)) return { ok: false, error: "distance invalide" };
  var vol = roundUpCbm_(cbm), specifique = vol > TARIF_CBM_SPECIFIQUE_AU_DELA;
  lines.push({ code: "base", label: "Base (jusqu'à " + TARIF_BASE_CBM + " CBM)", montant: TARIF_BASE_FCFA, statut: "calcule" });
  lines.push({ code: "volume", label: "Supplément volume (" + Math.max(0, vol - TARIF_BASE_CBM) + " CBM × " + TARIF_CBM_SUPPL_FCFA + ")",
    montant: vol <= TARIF_BASE_CBM ? 0 : (vol - TARIF_BASE_CBM) * TARIF_CBM_SUPPL_FCFA, statut: "calcule" });
  lines.push({ code: "manutention", label: "Manutention (" + helpers + " × " + TARIF_MANUTENTIONNAIRE_FCFA + ")", montant: helpers * TARIF_MANUTENTIONNAIRE_FCFA, statut: "calcule" });
  lines.push({ code: "etages", label: "Étages (" + floors + " × " + TARIF_ETAGE_FCFA + ")", montant: floors * TARIF_ETAGE_FCFA, statut: "calcule" });
  var zone = inp.zone === "intra" || inp.zone === "extra" ? inp.zone : "indetermine";
  var facturation = inp.facturation === "aller_retour" ? "aller_retour" : "aller_simple";
  var km = { code: "km", label: "Kilométrage", montant: null, statut: "sur_devis" }, snapshot = null;
  if (zone === "indetermine") {
    km.note = "Zone indéterminée : cotation spécifique par l'administration.";
  } else {
    var t = findTarif_(tarifs, zone, inp.categorie);
    if (!t) { km.statut = zone === "intra" ? "categorie_sans_tarif" : "sur_devis"; km.note = zone === "intra" ? "Aucun tarif intra-urbain actif pour cette catégorie de véhicule." : "Hors Grand Abidjan : cotation par l'administration."; }
    else {
      snapshot = { id: t.id, zone: t.zone, categorie: t.categorie, tarif: t.tarif, mode: t.mode, statut: t.statut };
      if (t.mode !== "auto" || !(t.tarif > 0)) { km.statut = "sur_devis"; km.note = zone === "extra" ? "Hors Grand Abidjan : cotation par l'administration." : "Tarif non automatique : cotation par l'administration."; }
      else if (dist === null) { km.statut = "distance_manquante"; km.note = "Distance routière manquante."; }
      else {
        km.montant = Math.round(dist * t.tarif * (facturation === "aller_retour" ? 2 : 1));
        km.statut = "calcule";
        km.label = "Kilométrage (" + dist + " km × " + t.tarif + (facturation === "aller_retour" ? " × 2 aller-retour" : " aller simple") + ")";
      }
    }
  }
  lines.push(km);
  lines.push({ code: "emballage", label: "Emballage et protection", montant: null, statut: "a_chiffrer_separement", note: "Aucun prix automatique : à évaluer séparément." });
  if (specifique) warn.push("Volume arrondi supérieur à " + TARIF_CBM_SPECIFIQUE_AU_DELA + " CBM : cotation spécifique requise.");
  var total = 0; lines.forEach(function (l) { if (typeof l.montant === "number") total += l.montant; });
  var complete = !specifique && km.statut === "calcule";
  if (!complete) warn.push("Total partiel : la cotation n'est pas complète.");
  return { ok: true, volume: { saisi: cbm, arrondi: vol }, zone: zone, categorie: inp.categorie || "", facturation: facturation, distanceKm: dist,
    lines: lines, totalPartiel: total, complete: complete, specifique: specifique, tarif: snapshot, avertissements: warn };
}

function saveQuote_(code, q, inp, who) {
  var sh = getAuxSheet_(QUOTES_SHEET, QUOTE_HEADERS);
  var id = "Q-" + Utilities.formatDate(new Date(), TZ, "yyMMdd") + "-" + Utilities.getUuid().split("-")[0].toUpperCase().substring(0, 5);
  sh.appendRow([id, clean_(code, 40), new Date(), who || "", q.zone, q.categorie, q.distanceKm == null ? "" : q.distanceKm, q.facturation,
    inp.cbm, q.volume.arrondi, Number(inp.helpers || 0), Number(inp.floors || 0), JSON.stringify({ lines: q.lines, tarif: q.tarif, avertissements: q.avertissements }),
    q.totalPartiel, q.complete ? "true" : "false", "brouillon"]);
  logEvent_("INFO", "cotation.enregistree", code, id + " partiel=" + q.totalPartiel + " complete=" + q.complete);
  return id;
}

// =====================================================================
// ---------- OTP : primitives (aléa, empreintes) ----------
// =====================================================================
function hmacHex_(key, msg) {
  var b = Utilities.computeHmacSha256Signature(String(msg), String(key));
  return b.map(function (x) { return ("0" + (x & 0xFF).toString(16)).slice(-2); }).join("");
}

// Secret de hachage : créé une fois, conservé dans les propriétés du script, jamais écrit dans une feuille ni dans le journal.
function getPepper_() {
  var props = PropertiesService.getScriptProperties(), v = props.getProperty("GE_OTP_PEPPER");
  if (!v) { v = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid(); props.setProperty("GE_OTP_PEPPER", v); }
  return v;
}

// Code à 6 chiffres tiré d'un UUID aléatoire (SecureRandom côté Google) passé dans un HMAC ; échantillonnage par rejet pour éviter tout biais.
function randomCode6_() {
  var pepper = getPepper_();
  for (var i = 0; i < 30; i++) {
    var sig = Utilities.computeHmacSha256Signature(Utilities.getUuid() + "|" + Date.now() + "|" + i, pepper);
    var n = 0;
    for (var k = 0; k < 4; k++) n = n * 256 + ((sig[k] + 256) % 256);
    if (n < 4294000000) return ("000000" + (n % 1000000)).slice(-6);
  }
  throw new Error("génération du code impossible");
}

function safeEqual_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var r = 0;
  for (var i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function codeHash_(salt, pendingId, code) { return hmacHex_(getPepper_(), salt + ":" + pendingId + ":" + code); }

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function lastRows_(sh, ncols, n) {
  var last = sh.getLastRow(); if (last < 2) return [];
  var start = Math.max(2, last - n + 1), vals = sh.getRange(start, 1, last - start + 1, ncols).getValues(), out = [];
  for (var i = 0; i < vals.length; i++) out.push({ r: start + i, v: vals[i] });
  return out;
}

// =====================================================================
// ---------- OTP : fournisseurs interchangeables (interface commune) ----------
// Chaque fournisseur expose : id, label, isConfigured(ctx), send(ctx) → { accepted, providerMessageId, error }
// « accepted » = le prestataire a ACCEPTÉ le message. Ce n'est PAS une preuve de livraison.
// Les clés et jetons sont lus dans les propriétés du script (Paramètres du projet), jamais dans le code ni dans le navigateur.
// =====================================================================
function prop_(name, fallback) { var v = PropertiesService.getScriptProperties().getProperty(name); return (v == null || v === "") ? (fallback || "") : v; }

function otpSmsText_(code) {
  return "GREAT EXPERTIZ : votre code de verification est " + code + ". Il est valable " + OTP_VALIDITE_MIN + " minutes. Ne le communiquez a personne.";
}

function parseJsonSafe_(txt) { try { return JSON.parse(txt); } catch (e) { return null; } }

function getByPath_(obj, path) {
  if (!path) return undefined;
  var cur = obj, parts = String(path).split(".");
  for (var i = 0; i < parts.length; i++) { if (cur == null) return undefined; cur = cur[parts[i]]; }
  return cur;
}

var OTP_PROVIDERS = {
  whatsapp_meta: {
    id: "whatsapp_meta", label: "WhatsApp Business (Meta Cloud API)",
    isConfigured: function () { return !!(prop_("GE_WA_TOKEN") && prop_("GE_WA_PHONE_NUMBER_ID") && prop_("GE_WA_TEMPLATE_NAME")); },
    send: function (ctx) {
      var url = "https://graph.facebook.com/" + prop_("GE_WA_API_VERSION", "v21.0") + "/" + prop_("GE_WA_PHONE_NUMBER_ID") + "/messages";
      var payload = {
        messaging_product: "whatsapp", to: ctx.e164.replace("+", ""), type: "template",
        template: { name: prop_("GE_WA_TEMPLATE_NAME"), language: { code: prop_("GE_WA_TEMPLATE_LANG", "fr") }, components: [
          { type: "body", parameters: [{ type: "text", text: ctx.code }] },
          { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: ctx.code }] }
        ] }
      };
      var resp = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", headers: { Authorization: "Bearer " + prop_("GE_WA_TOKEN") },
        payload: JSON.stringify(payload), muteHttpExceptions: true });
      var status = resp.getResponseCode(), body = parseJsonSafe_(resp.getContentText());
      var id = body && body.messages && body.messages[0] && body.messages[0].id;
      if (status >= 200 && status < 300 && id) return { accepted: true, providerMessageId: String(id) };
      return { accepted: false, error: "HTTP " + status + " " + ((body && body.error && body.error.message) || "réponse inattendue") };
    }
  },
  sms_orange: {
    id: "sms_orange", label: "SMS Orange (API Orange Côte d'Ivoire)",
    isConfigured: function () { return !!(prop_("GE_ORANGE_CLIENT_ID") && prop_("GE_ORANGE_CLIENT_SECRET") && prop_("GE_ORANGE_SENDER")); },
    send: function (ctx) {
      var cache = CacheService.getScriptCache(), token = cache.get("GE_ORANGE_TOKEN");
      if (!token) {
        var basic = Utilities.base64Encode(prop_("GE_ORANGE_CLIENT_ID") + ":" + prop_("GE_ORANGE_CLIENT_SECRET"));
        var tr = UrlFetchApp.fetch("https://api.orange.com/oauth/v3/token", { method: "post", headers: { Authorization: "Basic " + basic },
          payload: { grant_type: "client_credentials" }, muteHttpExceptions: true });
        var tb = parseJsonSafe_(tr.getContentText());
        if (tr.getResponseCode() !== 200 || !tb || !tb.access_token) return { accepted: false, error: "authentification Orange refusée (HTTP " + tr.getResponseCode() + ")" };
        token = tb.access_token; cache.put("GE_ORANGE_TOKEN", token, Math.max(60, Math.min(21000, Number(tb.expires_in || 3600) - 120)));
      }
      var sender = prop_("GE_ORANGE_SENDER");
      var body = { outboundSMSMessageRequest: { address: "tel:" + ctx.e164, senderAddress: sender, outboundSMSTextMessage: { message: otpSmsText_(ctx.code) } } };
      var sr = UrlFetchApp.fetch("https://api.orange.com/smsmessaging/v1/outbound/" + encodeURIComponent(sender) + "/requests",
        { method: "post", contentType: "application/json", headers: { Authorization: "Bearer " + token }, payload: JSON.stringify(body), muteHttpExceptions: true });
      var sb = parseJsonSafe_(sr.getContentText()), st = sr.getResponseCode();
      var res = sb && sb.outboundSMSMessageRequest && sb.outboundSMSMessageRequest.resourceURL;
      if (st === 401) cache.remove("GE_ORANGE_TOKEN");
      if ((st === 200 || st === 201) && res) return { accepted: true, providerMessageId: String(res).split("/").pop() };
      return { accepted: false, error: "HTTP " + st + " " + ((sb && sb.requestError && sb.requestError.serviceException && sb.requestError.serviceException.text) || "réponse inattendue") };
    }
  },
  // Connecteur HTTP générique (SMSPro Africa ou autre). Le gabarit exact doit être complété d'après la documentation du prestataire.
  sms_generic: {
    id: "sms_generic", label: "SMS — connecteur générique (ex. SMSPro Africa)",
    isConfigured: function () { return !!(prop_("GE_SMS_URL") && prop_("GE_SMS_BODY_TEMPLATE")); },
    send: function (ctx) {
      var tpl = prop_("GE_SMS_BODY_TEMPLATE"), msg = otpSmsText_(ctx.code);
      var body = tpl.replace(/\{\{to\}\}/g, ctx.e164).replace(/\{\{to_national\}\}/g, ctx.e164.replace("+225", "")).replace(/\{\{message\}\}/g, JSON.stringify(msg).slice(1, -1));
      var headers = parseJsonSafe_(prop_("GE_SMS_HEADERS_JSON", "{}")) || {};
      var resp = UrlFetchApp.fetch(prop_("GE_SMS_URL"), { method: prop_("GE_SMS_METHOD", "post").toLowerCase(), contentType: "application/json", headers: headers, payload: body, muteHttpExceptions: true });
      var st = resp.getResponseCode(), parsed = parseJsonSafe_(resp.getContentText());
      var okPath = prop_("GE_SMS_SUCCESS_PATH"), idPath = prop_("GE_SMS_ID_PATH");
      var okVal = okPath ? getByPath_(parsed, okPath) : true;
      if (st >= 200 && st < 300 && okVal !== undefined && okVal !== false && okVal !== "false" && okVal !== null) {
        var mid = idPath ? getByPath_(parsed, idPath) : "";
        return { accepted: true, providerMessageId: mid == null ? "" : String(mid) };
      }
      return { accepted: false, error: "HTTP " + st + " réponse non acceptée" };
    }
  },
  email: {
    id: "email", label: "E-mail (complément, si le client a donné son adresse)",
    isConfigured: function (ctx) { return !!(ctx && ctx.email); },
    send: function (ctx) {
      MailApp.sendEmail({ to: ctx.email, subject: "Votre code GREAT EXPERTIZ", htmlBody: "<p>Votre code de vérification GREAT EXPERTIZ : <b style='font-size:20px'>" + esc_(ctx.code) + "</b></p><p>Il est valable " + OTP_VALIDITE_MIN + " minutes. Ne le communiquez à personne.</p>" });
      return { accepted: true, providerMessageId: "mail" };
    }
  }
};

function providersStatus_() {
  var out = [];
  Object.keys(OTP_PROVIDERS).forEach(function (k) {
    var p = OTP_PROVIDERS[k], conf = false;
    try { conf = k === "email" ? true : !!p.isConfigured({}); } catch (e) {}
    out.push({ id: p.id, label: p.label, configure: conf });
  });
  return out;
}

// Essaie le canal principal puis, seulement si l'administration l'a activé, le canal alternatif.
function dispatchOtp_(ctx) {
  var order = [getSetting_("OTP_CANAL_PRINCIPAL")];
  if (getSetting_("OTP_ALTERNATIF_ACTIF") === "true") order.push(getSetting_("OTP_CANAL_ALTERNATIF"));
  var attempts = [];
  for (var i = 0; i < order.length; i++) {
    var ch = order[i], prov = OTP_PROVIDERS[ch];
    if (i === 1 && ch === order[0]) continue;
    if (!prov) { attempts.push({ canal: ch, error: "canal inconnu" }); continue; }
    var conf = false; try { conf = prov.isConfigured(ctx); } catch (e) {}
    if (!conf) { attempts.push({ canal: ch, error: "canal non configuré" }); logEvent_("ALERTE", "otp.canal_non_configure", "", ch); continue; }
    var r;
    try { r = prov.send(ctx); } catch (err) { r = { accepted: false, error: "exception : " + (err && err.message ? err.message : "inconnue") }; }
    if (r.accepted) return { accepted: true, canal: ch, providerMessageId: r.providerMessageId || "", attempts: attempts };
    attempts.push({ canal: ch, error: r.error });
    logEvent_("ERREUR", "otp.envoi_refuse", "", ch + " : " + r.error);
  }
  return { accepted: false, attempts: attempts };
}

// =====================================================================
// ---------- OTP : demande, renvoi, vérification ----------
// =====================================================================
function otpFail_(rid, error, message, extra) {
  var r = { ok: false, rid: rid, error: error, message: message };
  if (extra) for (var k in extra) r[k] = extra[k];
  return r;
}

function validateOrderInput_(p) {
  function bad(m) { return { ok: false, message: m }; }
  var prestation = clean_(p.prestation, 80);
  if (VALID_PRESTATIONS.indexOf(prestation) < 0) return bad("Choisissez une prestation dans la liste.");
  var nom = clean_(p.nom, 120);
  if (nom.length < 2) return bad("Indiquez votre nom ou celui de votre entreprise.");
  var ph = normalizePhoneCI_(p.telephone);
  if (!ph.ok) return bad(ph.error);
  var email = clean_(p.email || p.contact, 120);
  if (email && !isValidEmail_(email)) return bad("Adresse e-mail invalide.");
  var enl = clean_(p.enlevement, 250), liv = clean_(p.livraison, 250);
  if (enl.length < 3) return bad("Indiquez le lieu de départ.");
  if (liv.length < 3) return bad("Indiquez le lieu d'arrivée.");
  var date = clean_(p.dateSouhaitee, 12);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad("Date souhaitée invalide.");
  var detail = clean_(p.detail, 3000);
  if (detail.length < 5) return bad("Décrivez simplement ce que vous souhaitez transporter.");
  var embKey = clean_(p.emballage, 40), emb = "";
  if (embKey) { if (!EMBALLAGE_CHOICES[embKey]) return bad("Choix d'emballage invalide."); emb = EMBALLAGE_CHOICES[embKey]; }
  var destTel = "", rawDestTel = clean_(p.telephoneDestinataire, 30);
  if (rawDestTel) { var dp = normalizePhoneCI_(rawDestTel); if (!dp.ok) return bad("Téléphone du destinataire : " + dp.error); destTel = dp.e164; }
  var dist = "", rawDist = clean_(p.distanceKm, 12);
  if (rawDist) { var dn = Number(rawDist.replace(",", ".")); if (!isFinite(dn) || dn < 0 || dn > 10000) return bad("Distance invalide."); dist = String(Math.round(dn * 10) / 10); }
  var dur = "", rawDur = clean_(p.dureeMin, 8);
  if (rawDur) { var dd = Number(rawDur); if (!isFinite(dd) || dd < 0 || dd > 20000) return bad("Durée invalide."); dur = String(Math.round(dd)); }
  var data = {
    prestation: prestation, nom: nom, telE164: ph.e164, telMasque: ph.masked, email: email, destNom: clean_(p.nomDestinataire, 120), destTel: destTel,
    enlevement: enl, livraison: liv, communeEnlevement: clean_(p.communeEnlevement, 80), communeLivraison: clean_(p.communeLivraison, 80),
    dateSouhaitee: date, detail: detail, emballage: emb, notes: clean_(p.notes, 2000), distanceKm: dist, dureeMin: dur,
    gpsEnlevement: clean_(p.gpsEnlevement, 60), gpsLivraison: clean_(p.gpsLivraison, 60),
    lienEnlevement: safeMapLink_(p.lienEnlevement), lienLivraison: safeMapLink_(p.lienLivraison)
  };
  return { ok: true, data: data };
}

function findPending_(pendingId) {
  var sh = getAuxSheet_(PENDING_SHEET, PENDING_HEADERS), rows = lastRows_(sh, PENDING_HEADERS.length, 600);
  for (var i = rows.length - 1; i >= 0; i--) if (String(rows[i].v[0]) === pendingId) return { sh: sh, r: rows[i].r, v: rows[i].v };
  return null;
}

// Écrit, sous verrou, la demande en attente (si nouvelle) et une ligne OTP ; applique les limites. Aucun appel réseau ici.
function prepareOtp_(pendingId, data, isNew) {
  return withLock_(function () {
    var now = new Date(), otpSh = getAuxSheet_(OTP_SHEET, OTP_HEADERS), pepper = getPepper_();
    var phoneHash = hmacHex_(pepper, "tel:" + data.telE164);
    var rows = lastRows_(otpSh, OTP_HEADERS.length, 600), hourAgo = now.getTime() - 3600000;
    var today = Utilities.formatDate(now, TZ, "yyyy-MM-dd"), nPhone = 0, nDay = 0;
    rows.forEach(function (x) {
      if (String(x.v[11]) === "ECHEC") return;                       // un envoi refusé ne consomme pas le quota du client
      var created = new Date(x.v[2]);
      if (String(x.v[4]) === phoneHash && created.getTime() > hourAgo) nPhone++;
      if (Utilities.formatDate(created, TZ, "yyyy-MM-dd") === today) nDay++;
    });
    if (nPhone >= OTP_MAX_ENVOIS_HEURE) { logEvent_("ALERTE", "otp.limite_numero", "", data.telMasque); return { ok: false, error: "TROP_DE_DEMANDES", message: "Trop de codes demandés pour ce numéro. Réessayez dans une heure." }; }
    if (nDay >= Number(getSetting_("OTP_LIMITE_JOUR"))) { logEvent_("ALERTE", "otp.limite_journaliere", "", "plafond atteint"); return { ok: false, error: "LIMITE_JOURNALIERE", message: "Le service de vérification est momentanément saturé. Réessayez plus tard ou appelez-nous." }; }
    if (isNew) {
      var pj = JSON.stringify(data);
      if (pj.length > 40000) return { ok: false, error: "DONNEES_INVALIDES", message: "Demande trop volumineuse." };
      var pend = getAuxSheet_(PENDING_SHEET, PENDING_HEADERS);
      pend.appendRow([pendingId, now, new Date(now.getTime() + Number(getSetting_("DEMANDE_VALIDITE_MIN")) * 60000), pj, "EN_ATTENTE", ""]);
    } else {
      rows.forEach(function (x) { if (String(x.v[1]) === pendingId && String(x.v[9]) === "ACTIF") otpSh.getRange(x.r, colOf_(OTP_HEADERS, "État du code")).setValue("REMPLACE"); });
    }
    var code = randomCode6_(), salt = Utilities.getUuid().replace(/-/g, "").substring(0, 16);
    var otpId = "O-" + Utilities.getUuid().split("-")[0].toUpperCase();
    otpSh.appendRow([otpId, pendingId, now, new Date(now.getTime() + OTP_VALIDITE_MIN * 60000), phoneHash, data.telMasque, salt,
      codeHash_(salt, pendingId, code), 0, "ACTIF", "", "EN_ATTENTE", "", "", "", "", ""]);
    return { ok: true, code: code, otpRow: otpSh.getLastRow() };
  });
}

function finalizeOtpSend_(otpRow, res) {
  withLock_(function () {
    var sh = getAuxSheet_(OTP_SHEET, OTP_HEADERS);
    if (res.accepted) {
      sh.getRange(otpRow, colOf_(OTP_HEADERS, "Canal")).setValue(res.canal);
      sh.getRange(otpRow, colOf_(OTP_HEADERS, "État de l'envoi")).setValue("ACCEPTE");
      sh.getRange(otpRow, colOf_(OTP_HEADERS, "ID message prestataire")).setValue(res.providerMessageId || "");
      sh.getRange(otpRow, colOf_(OTP_HEADERS, "Accepté le")).setValue(new Date());
    } else {
      sh.getRange(otpRow, colOf_(OTP_HEADERS, "État de l'envoi")).setValue("ECHEC");
      sh.getRange(otpRow, colOf_(OTP_HEADERS, "État du code")).setValue("EXPIRE");   // un code jamais transmis ne doit pas rester utilisable
    }
  });
}

function otpSuccess_(rid, pendingId, data, canal) {
  return { ok: true, rid: rid, pendingId: pendingId, expiresInSec: OTP_VALIDITE_MIN * 60, channel: canal, phoneMasked: data.telMasque, etatEnvoi: "ACCEPTE",
    message: "Le code a été transmis au prestataire de messagerie. S'il n'arrive pas dans quelques instants, demandez un nouvel envoi." };
}

function issueOtp_(rid, pendingId, data, isNew) {
  var prep = prepareOtp_(pendingId, data, isNew);
  if (!prep.ok) return otpFail_(rid, prep.error, prep.message);
  var res = dispatchOtp_({ e164: data.telE164, email: data.email, code: prep.code, validityMin: OTP_VALIDITE_MIN });
  finalizeOtpSend_(prep.otpRow, res);
  prep.code = null;
  if (!res.accepted) return otpFail_(rid, "ENVOI_ECHEC", "Impossible d'envoyer le code pour le moment. Réessayez dans un instant ou appelez-nous.", { pendingId: pendingId });
  logEvent_("INFO", "otp.accepte", pendingId.substring(0, 8), "canal " + res.canal);
  return otpSuccess_(rid, pendingId, data, res.canal);
}

function handleRequestOtp_(p) {
  var rid = clean_(p.rid, 40);
  try {
    if (clean_(p.hp, 20)) { logEvent_("ALERTE", "otp.honeypot", "", "champ piège rempli"); return otpFail_(rid, "REFUSE", "Demande refusée."); }
    if (getSetting_("OTP_ENVOI_REEL_ACTIF") !== "true") return otpFail_(rid, "ENVOI_DESACTIVE", "L'envoi des codes de vérification est désactivé (mode test).");
    var v = validateOrderInput_(p);
    if (!v.ok) return otpFail_(rid, "DONNEES_INVALIDES", v.message);
    var data = v.data;
    var ca = checkClientAuth_(p.clientToken); data.clientId = ca && ca.valid ? ca.clientId : "";
    data.zone = classifyZone_(data);
    var pendingId = Utilities.getUuid().replace(/-/g, "");
    return issueOtp_(rid, pendingId, data, true);
  } catch (err) {
    logEvent_("ERREUR", "otp.demande", "", err && err.message ? err.message : "erreur");
    return otpFail_(rid, "ERREUR_SERVEUR", "Erreur technique. Réessayez dans un instant.");
  }
}

function handleResendOtp_(p) {
  var rid = clean_(p.rid, 40), pendingId = clean_(p.pendingId, 64);
  try {
    if (!/^[0-9a-f]{32}$/.test(pendingId)) return otpFail_(rid, "DEMANDE_INTROUVABLE", "Demande introuvable.");
    if (getSetting_("OTP_ENVOI_REEL_ACTIF") !== "true") return otpFail_(rid, "ENVOI_DESACTIVE", "L'envoi des codes de vérification est désactivé (mode test).");
    var pr = findPending_(pendingId);
    if (!pr) return otpFail_(rid, "DEMANDE_INTROUVABLE", "Demande introuvable.");
    if (String(pr.v[4]) !== "EN_ATTENTE") return otpFail_(rid, "DEMANDE_CLOSE", "Cette demande n'est plus en attente de validation.");
    if (new Date(pr.v[2]).getTime() < Date.now()) return otpFail_(rid, "DEMANDE_EXPIREE", "Votre demande a expiré. Merci de la renvoyer.");
    var data = parseJsonSafe_(pr.v[3]);
    if (!data) return otpFail_(rid, "DEMANDE_INTROUVABLE", "Demande introuvable.");
    return issueOtp_(rid, pendingId, data, false);
  } catch (err) {
    logEvent_("ERREUR", "otp.renvoi", "", err && err.message ? err.message : "erreur");
    return otpFail_(rid, "ERREUR_SERVEUR", "Erreur technique. Réessayez dans un instant.");
  }
}

// ---------- Numéro de commande : GE-AAMMJJ-xxxx, généré côté serveur, unique ----------
var ORDER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function randomOrderSuffix_() {
  var sig = Utilities.computeHmacSha256Signature(Utilities.getUuid() + "|" + Date.now(), getPepper_()), s = "";
  for (var i = 0; i < 4; i++) s += ORDER_CODE_ALPHABET.charAt(((sig[i] + 256) % 256) % ORDER_CODE_ALPHABET.length);
  return s;
}
function newOrderCode_(sheet) {
  var have = {}, last = sheet.getLastRow();
  if (last > 1) sheet.getRange(2, 1, last - 1, 1).getValues().forEach(function (r) { have[String(r[0])] = true; });
  var day = Utilities.formatDate(new Date(), TZ, "yyMMdd");
  for (var i = 0; i < 60; i++) { var c = "GE-" + day + "-" + randomOrderSuffix_(); if (!have[c]) return c; }
  throw new Error("génération du numéro de commande impossible");
}

function buildOrderRow_(code, data, pendingId, canal, now) {
  var notes = [];
  if (data.notes) notes.push(data.notes);
  if (data.email) notes.push("E-mail client : " + data.email);
  if (data.destNom || data.destTel) notes.push("Destinataire : " + [data.destNom, data.destTel].filter(Boolean).join(" · "));
  notes.push("Date souhaitée : " + (data.dateSouhaitee || "à convenir"));
  var row = [code, now, data.prestation, data.nom, data.telE164, data.destNom || data.email || "", data.destTel, data.detail,
    data.enlevement, data.livraison, "", "", "Ponctuel", notes.join(" | "), "Reçue", "À convenir", data.dateSouhaitee,
    "false", "inbox", "", "", "", data.clientId || "",
    data.gpsEnlevement, data.gpsLivraison, data.lienEnlevement, data.lienLivraison, data.distanceKm,
    "", data.emballage, data.temperature || "", data.poidsKg || "", "",
    now, canal || "", (String(pendingId).indexOf("direct|") === 0 ? "site|direct|" + String(pendingId).substring(7) : "site|" + pendingId), data.zone || "indetermine", data.zone === "intra" ? "auto_intra" : "sur_devis", data.dureeMin];
  while (row.length < ORDER_COLS) row.push("");
  return row;
}

// Crée la commande depuis la demande validée. Appelée sous verrou. Idempotent grâce à la colonne « Source ».
function createOrderFromPending_(pr, otpRef, canal) {
  var data = parseJsonSafe_(pr.v[3]);
  if (!data) throw new Error("données de la demande illisibles");
  var sheet = getOrdersSheet_(), pendingId = String(pr.v[0]), source = "site|" + pendingId;
  var hdr = ordersHeaders_(), srcCol = hdr.indexOf("Source") + 1, last = sheet.getLastRow(), existing = "", i;
  if (last > 1) {
    var sv = sheet.getRange(2, srcCol, last - 1, 1).getValues();
    for (i = 0; i < sv.length; i++) if (String(sv[i][0]) === source) { existing = String(sheet.getRange(i + 2, 1).getValue()); break; }
  }
  var code = existing, isNew = false;
  if (!existing) {
    var now = new Date();
    code = newOrderCode_(sheet);
    var row = buildOrderRow_(code, data, pendingId, canal, now), r = sheet.getLastRow() + 1;
    sheet.getRange(r, 1).setNumberFormat("@"); sheet.getRange(r, 5).setNumberFormat("@"); sheet.getRange(r, 7).setNumberFormat("@");
    sheet.getRange(r, 1, 1, ORDER_COLS).setValues([row]);
    SpreadsheetApp.flush();
    var back = sheet.getRange(r, 1, 1, ORDER_COLS).getValues()[0];
    if (String(back[0]) !== code || String(back[4]) !== data.telE164 || String(back[srcCol - 1]) !== source) {
      throw new Error("la commande n'a pas pu être relue dans Google Sheets ; elle n'est pas confirmée");
    }
    isNew = true;
  }
  var pend = getAuxSheet_(PENDING_SHEET, PENDING_HEADERS);
  pend.getRange(pr.r, colOf_(PENDING_HEADERS, "État")).setValue("CONFIRMEE");
  pend.getRange(pr.r, colOf_(PENDING_HEADERS, "Code commande")).setValue(code);
  pend.getRange(pr.r, colOf_(PENDING_HEADERS, "Données (JSON)")).setValue("");      // les données vivent désormais dans Commandes_GE
  if (otpRef) getAuxSheet_(OTP_SHEET, OTP_HEADERS).getRange(otpRef.r, colOf_(OTP_HEADERS, "Code commande")).setValue(code);
  logEvent_("INFO", isNew ? "commande.creee" : "commande.deja_creee", code, "zone " + (data.zone || "?"));
  return { code: code, isNew: isNew, data: data };
}

function verifyCore_(pendingId, code, now) {
  var pr = findPending_(pendingId);
  if (!pr) return { ok: false, error: "DEMANDE_INTROUVABLE", message: "Demande introuvable. Merci de recommencer." };
  var otpSh = getAuxSheet_(OTP_SHEET, OTP_HEADERS), rows = lastRows_(otpSh, OTP_HEADERS.length, 600), latest = null, i;
  for (i = rows.length - 1; i >= 0; i--) if (String(rows[i].v[1]) === pendingId) { latest = rows[i]; break; }
  if (!latest) return { ok: false, error: "DEMANDE_INTROUVABLE", message: "Aucun code n'a été envoyé pour cette demande." };
  var cEtat = colOf_(OTP_HEADERS, "État du code"), cTent = colOf_(OTP_HEADERS, "Tentatives"), v = latest.v, etat = String(v[9]);
  var matches = function () { return safeEqual_(codeHash_(String(v[6]), pendingId, code), String(v[7])); };
  var cfg = String(pr.v[4]);
  if (cfg === "CONFIRMEE") {                                              // double clic / nouvel essai : même numéro, aucun doublon
    if (etat === "VERIFIE" && matches()) return { ok: true, code: String(pr.v[5]), already: true };
    return { ok: false, error: "CODE_INCORRECT", message: "Code incorrect ou déjà utilisé." };
  }
  if (cfg !== "EN_ATTENTE") return { ok: false, error: "DEMANDE_CLOSE", message: "Cette demande n'est plus en attente de validation." };
  if (new Date(pr.v[2]).getTime() < now.getTime()) {
    pr.sh.getRange(pr.r, colOf_(PENDING_HEADERS, "État")).setValue("EXPIREE"); pr.sh.getRange(pr.r, colOf_(PENDING_HEADERS, "Données (JSON)")).setValue("");
    return { ok: false, error: "DEMANDE_EXPIREE", message: "Votre demande a expiré. Merci de la renvoyer." };
  }
  var canal = String(v[10]);
  if (etat === "ACTIF") {
    if (new Date(v[3]).getTime() < now.getTime()) { otpSh.getRange(latest.r, cEtat).setValue("EXPIRE"); return { ok: false, error: "CODE_EXPIRE", message: "Ce code a expiré. Demandez un nouvel envoi." }; }
    var tent = Number(v[8]) || 0;
    if (tent >= OTP_MAX_TENTATIVES) { otpSh.getRange(latest.r, cEtat).setValue("BLOQUE"); return { ok: false, error: "CODE_BLOQUE", message: "Trop d'essais. Demandez un nouvel envoi." }; }
    tent++; otpSh.getRange(latest.r, cTent).setValue(tent);
    if (!matches()) {
      var remaining = OTP_MAX_TENTATIVES - tent;
      if (remaining <= 0) { otpSh.getRange(latest.r, cEtat).setValue("BLOQUE"); logEvent_("ALERTE", "otp.bloque", pendingId.substring(0, 8), "5 essais incorrects"); return { ok: false, error: "CODE_BLOQUE", message: "Trop d'essais. Demandez un nouvel envoi." }; }
      return { ok: false, error: "CODE_INCORRECT", message: "Code incorrect. Il vous reste " + remaining + " essai" + (remaining > 1 ? "s" : "") + ".", remaining: remaining };
    }
    otpSh.getRange(latest.r, cEtat).setValue("VERIFIE");
    otpSh.getRange(latest.r, colOf_(OTP_HEADERS, "Preuve de livraison")).setValue("code saisi le " + Utilities.formatDate(now, TZ, "yyyy-MM-dd'T'HH:mm:ssXXX"));
    otpSh.getRange(latest.r, colOf_(OTP_HEADERS, "État de l'envoi")).setValue("LIVRE");     // preuve de livraison = saisie du bon code
  } else if (etat === "VERIFIE") {
    if (!matches()) return { ok: false, error: "CODE_INCORRECT", message: "Code incorrect ou déjà utilisé." };   // reprise après un échec d'enregistrement
  } else if (etat === "BLOQUE") {
    return { ok: false, error: "CODE_BLOQUE", message: "Trop d'essais. Demandez un nouvel envoi." };
  } else if (etat === "REMPLACE") {
    return { ok: false, error: "CODE_REMPLACE", message: "Un nouveau code a été envoyé : utilisez le plus récent." };
  } else {
    return { ok: false, error: "CODE_EXPIRE", message: "Ce code a expiré. Demandez un nouvel envoi." };
  }
  var created = createOrderFromPending_(pr, latest, canal);
  return { ok: true, code: created.code, newOrder: created.isNew, data: created.data, canal: canal };
}

function handleVerifyOtp_(p) {
  var rid = clean_(p.rid, 40), pendingId = clean_(p.pendingId, 64), code = String(p.code == null ? "" : p.code).replace(/\s/g, "");
  if (!/^[0-9a-f]{32}$/.test(pendingId)) return otpFail_(rid, "DEMANDE_INTROUVABLE", "Demande introuvable. Merci de recommencer.");
  if (!/^\d{6}$/.test(code)) return otpFail_(rid, "CODE_INVALIDE", "Saisissez les 6 chiffres reçus.");
  var res;
  try { res = withLock_(function () { return verifyCore_(pendingId, code, new Date()); }); }
  catch (err) {
    logEvent_("ERREUR", "otp.verification", pendingId.substring(0, 8), err && err.message ? err.message : "erreur");
    return otpFail_(rid, "ERREUR_SERVEUR", "Erreur technique : votre commande n'a pas été confirmée. Réessayez avec le même code.");
  }
  if (!res.ok) return otpFail_(rid, res.error, res.message, res.remaining != null ? { remaining: res.remaining } : null);
  if (res.newOrder) { try { notifyNewOrder_(res.code, res.data, res.canal); } catch (mailErr) { logEvent_("ERREUR", "notification.preparation", res.code, mailErr && mailErr.message ? mailErr.message : "erreur"); } }
  return { ok: true, rid: rid, code: res.code, already: !!res.already,
    message: "Votre demande a bien été prise en compte par GREAT EXPERTIZ. Un conseiller du service client vous contactera pour la suite. Veuillez conserver votre numéro de commande, il vous sera demandé pour le suivi de votre dossier." };
}

// Réponse « postMessage » (même mécanisme que orderResponse_) : seuls les champs autorisés sont renvoyés.
function otpResponse_(result) {
  var safe = { type: "GE_OTP_RESULT", rid: result.rid || "", ok: !!result.ok, error: result.error || "", message: result.message || "" };
  ["pendingId", "expiresInSec", "channel", "phoneMasked", "etatEnvoi", "remaining", "code", "already"].forEach(function (k) { if (result[k] !== undefined) safe[k] = result[k]; });
  var json = JSON.stringify(safe).replace(/</g, "\\u003c");
  return HtmlService.createHtmlOutput("<!doctype html><html><body><script>window.top.postMessage(" + json + ", '*');<\/script></body></html>").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// =====================================================================
// ---------- Accusés de réception des prestataires (informatifs, NON vérifiés) ----------
// Limite d'Apps Script : doPost/doGet ne donnent pas accès aux en-têtes HTTP. La signature X-Hub-Signature-256 de Meta ne peut donc pas être contrôlée ici.
// Un accusé n'est donc jamais une preuve de livraison : il est seulement noté dans « Accusé non vérifié ».
// La preuve de livraison retenue est la saisie du bon code par le client.
// =====================================================================
function handleWaWebhookGet_(p) {
  var tok = prop_("GE_WA_WEBHOOK_VERIFY_TOKEN");
  if (tok && p["hub.mode"] === "subscribe" && safeEqual_(p["hub.verify_token"] || "", tok)) return ContentService.createTextOutput(String(p["hub.challenge"] || ""));
  return ContentService.createTextOutput("refusé");
}

function handleWaWebhookPost_(e) {
  var p = (e && e.parameter) || {}, secret = prop_("GE_WA_WEBHOOK_SECRET");
  if (!secret || !safeEqual_(p.k || "", secret)) { logEvent_("ALERTE", "wa.webhook_refuse", "", "secret absent ou incorrect"); return ContentService.createTextOutput("refusé"); }
  var body = parseJsonSafe_(e.postData && e.postData.contents), n = 0;
  try {
    var entries = (body && body.entry) || [];
    var sh = getAuxSheet_(OTP_SHEET, OTP_HEADERS), rows = lastRows_(sh, OTP_HEADERS.length, 600);
    entries.forEach(function (en) { (en.changes || []).forEach(function (ch) { ((ch.value && ch.value.statuses) || []).forEach(function (st) {
      for (var i = rows.length - 1; i >= 0; i--) {
        if (String(rows[i].v[12]) === String(st.id)) {
          var cell = sh.getRange(rows[i].r, colOf_(OTP_HEADERS, "Accusé non vérifié")), prev = String(cell.getValue() || "");
          cell.setValue((prev ? prev + " | " : "") + clean_(st.status, 20) + "@" + clean_(st.timestamp, 20) + " (non vérifié)");
          n++; break;
        }
      }
    }); }); });
  } catch (err) { logEvent_("ERREUR", "wa.webhook", "", err && err.message ? err.message : "erreur"); }
  logEvent_("INFO", "wa.accuse", "", n + " accusé(s) noté(s), non vérifiés");
  return ContentService.createTextOutput("OK");
}

// =====================================================================
// ---------- E-mails : file d'attente avec nouvelles tentatives ----------
// =====================================================================
var EMAIL_BACKOFF_MIN = [5, 15, 60, 240];
var EMAIL_MAX_ATTEMPTS = 5;

function trySendQueuedRow_(sh, rowIdx) {
  var v = sh.getRange(rowIdx, 1, 1, EMAIL_HEADERS.length).getValues()[0];
  if (String(v[6]) !== "EN_ATTENTE") return false;
  var tent = (Number(v[7]) || 0) + 1, now = new Date();
  try {
    MailApp.sendEmail({ to: String(v[2]), subject: String(v[3]), htmlBody: String(v[4]) });
    sh.getRange(rowIdx, 5).setValue("(envoyé)"); sh.getRange(rowIdx, 7).setValue("ENVOYE");
    sh.getRange(rowIdx, 8).setValue(tent); sh.getRange(rowIdx, 9).setValue(now); sh.getRange(rowIdx, 10).setValue(""); sh.getRange(rowIdx, 11).setValue("");
    return true;
  } catch (err) {
    var msg = scrubForLog_(err && err.message ? err.message : "erreur d'envoi");
    sh.getRange(rowIdx, 8).setValue(tent); sh.getRange(rowIdx, 9).setValue(now); sh.getRange(rowIdx, 11).setValue(msg);
    if (tent >= EMAIL_MAX_ATTEMPTS) { sh.getRange(rowIdx, 7).setValue("ECHEC_DEFINITIF"); logEvent_("ERREUR", "email.echec_definitif", String(v[5]), msg); }
    else { sh.getRange(rowIdx, 10).setValue(new Date(now.getTime() + EMAIL_BACKOFF_MIN[Math.min(tent - 1, EMAIL_BACKOFF_MIN.length - 1)] * 60000)); logEvent_("ALERTE", "email.nouvelle_tentative", String(v[5]), "tentative " + tent + " : " + msg); }
    return false;
  }
}

function queueEmail_(to, subject, html, ref) {
  var sh = getAuxSheet_(EMAIL_QUEUE_SHEET, EMAIL_HEADERS), now = new Date();
  var id = "M-" + Utilities.getUuid().split("-")[0].toUpperCase();
  sh.appendRow([id, now, to, subject, html, clean_(ref, 40), "EN_ATTENTE", 0, "", new Date(now.getTime() + 3 * 60000), ""]);
  return trySendQueuedRow_(sh, sh.getLastRow());
}

function notifyNewOrder_(code, d, canal) {
  var rows = [["Prestation", d.prestation], ["Client", d.nom], ["Téléphone client", d.telE164], ["E-mail", d.email || "—"],
    ["Destinataire", [d.destNom, d.destTel].filter(Boolean).join(" · ") || "—"], ["Besoin décrit", d.detail], ["Départ", d.enlevement], ["Arrivée", d.livraison],
    ["Date souhaitée", d.dateSouhaitee || "—"], ["Distance", d.distanceKm ? d.distanceKm + " km" : "—"], ["Durée estimée", d.dureeMin ? d.dureeMin + " min" : "—"], ["Poids déclaré", d.poidsKg ? d.poidsKg + " kg" : "Non communiqué"], ["Température", d.temperature || "—"],
    ["Zone", d.zone === "intra" ? "Grand Abidjan" : (d.zone === "extra" ? "Hors Grand Abidjan (sur devis)" : "À vérifier")], ["Emballage", d.emballage || "—"], ["Canal de réception", canal || "—"]];
  var html = "<div style='font-family:Arial,sans-serif;max-width:480px;border:2px solid #0E3A54;padding:24px;'>"
    + "<h2 style='color:#0B9DE0;margin:0 0 4px;'>GREAT EXPERTIZ</h2><p style='color:#5B7285;margin:0 0 18px;'>Nouvelle demande reçue — à étudier et à coter</p>"
    + "<p style='font-size:20px;font-weight:bold;color:#0E3A54;margin:0 0 16px;'>" + esc_(code) + "</p><table style='width:100%;border-collapse:collapse;font-size:14px;'>"
    + rows.map(function (r) { return "<tr><td style='color:#5B7285;padding:6px 0;vertical-align:top;'>" + r[0] + "</td><td style='text-align:right;font-weight:bold;'>" + esc_(r[1]) + "</td></tr>"; }).join("")
    + "</table></div>";
  return queueEmail_(NOTIFY_EMAIL, "Nouvelle commande — " + code, html, code);
}

// Compatibilité : l'ancienne fonction reste appelable (chemin hérité, désactivé par défaut).
function sendNotification_(o) {
  var d = { prestation: o.prestation, nom: o.nom, telE164: o.telephone, email: o.contact, destNom: "", destTel: o.telephoneDestinataire, detail: o.detail,
    enlevement: o.enlevement, livraison: o.livraison, dateSouhaitee: o.dateSouhaitee, distanceKm: o.distanceKm, dureeMin: "", zone: "", emballage: o.emballage };
  return notifyNewOrder_(o.code, d, "chemin hérité (sans OTP)");
}

function expirePending_() {
  var sh = getAuxSheet_(PENDING_SHEET, PENDING_HEADERS), rows = lastRows_(sh, PENDING_HEADERS.length, 600), now = Date.now(), n = 0;
  rows.forEach(function (x) {
    if (String(x.v[4]) === "EN_ATTENTE" && new Date(x.v[2]).getTime() < now) {
      sh.getRange(x.r, colOf_(PENDING_HEADERS, "État")).setValue("EXPIREE"); sh.getRange(x.r, colOf_(PENDING_HEADERS, "Données (JSON)")).setValue(""); n++;
    }
  });
  return n;
}

// Déclencheur (toutes les 5 minutes) : renvoie les e-mails en attente et efface les données des demandes expirées.
function processEmailQueue() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return { skipped: true };
  try {
    var sh = getAuxSheet_(EMAIL_QUEUE_SHEET, EMAIL_HEADERS), rows = lastRows_(sh, EMAIL_HEADERS.length, 300), now = Date.now(), sent = 0, tried = 0;
    rows.forEach(function (x) {
      if (String(x.v[6]) !== "EN_ATTENTE") return;
      var next = x.v[9] ? new Date(x.v[9]).getTime() : 0;
      if (next > now) return;
      tried++; if (trySendQueuedRow_(sh, x.r)) sent++;
    });
    var exp = expirePending_();
    return { tried: tried, sent: sent, pendingExpired: exp };
  } finally { lock.releaseLock(); }
}

// =====================================================================
// ---------- Migration Google Sheets : DIAGNOSTIC et SIMULATION uniquement (aucune écriture dans les onglets de commandes) ----------
// =====================================================================
function readTabForDiag_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 1) return null;
  var data = sh.getDataRange().getDisplayValues(), headers = (data[0] || []).map(function (h) { return String(h || "").trim().toLowerCase(); });
  var newSchema = isNewSchema_(headers), codeCol = newSchema ? headers.indexOf("code commande") : 0;
  return { sh: sh, data: data, headers: headers, newSchema: newSchema, codeCol: codeCol };
}

function migrationDiagnostic_() {
  var ss = openSS_(), names = ["Commandes", "Commandes_Backup", OFFICIAL_ORDERS_SHEET], report = { generatedAt: nowIso_(), readOnly: true, sheets: {}, crossChecks: {}, quasiDoublons: [] }, tabs = {}, codes = {};
  names.forEach(function (n) {
    var t = readTabForDiag_(ss, n);
    if (!t) { report.sheets[n] = { exists: !!ss.getSheetByName(n), rows: 0 }; codes[n] = {}; return; }
    tabs[n] = t;
    var cnt = {}, empty = 0, dupList = [], rows = t.data.length - 1;
    for (var r = 1; r < t.data.length; r++) {
      var c = String(t.data[r][t.codeCol] || "").trim();
      if (!c) { empty++; continue; }
      cnt[c] = (cnt[c] || 0) + 1;
    }
    Object.keys(cnt).forEach(function (c) { if (cnt[c] > 1) dupList.push({ code: c, occurrences: cnt[c] }); });
    codes[n] = cnt;
    report.sheets[n] = { exists: true, rows: rows, columns: t.headers.length, schema: t.newSchema ? "nouveau (code commande…)" : "historique (Code, Date…)",
      rowsWithoutCode: empty, uniqueCodes: Object.keys(cnt).length, duplicateCodes: dupList.slice(0, 50), duplicateCount: dupList.length };
  });
  var ge = codes[OFFICIAL_ORDERS_SHEET] || {};
  ["Commandes", "Commandes_Backup"].forEach(function (n) {
    var only = Object.keys(codes[n] || {}).filter(function (c) { return !ge[c]; });
    report.crossChecks[n + " → absents de " + OFFICIAL_ORDERS_SHEET] = { count: only.length, sample: only.slice(0, 20) };
  });
  var geOnly = Object.keys(ge).filter(function (c) { return !(codes["Commandes"] || {})[c] && !(codes["Commandes_Backup"] || {})[c]; });
  report.crossChecks[OFFICIAL_ORDERS_SHEET + " → absents de Commandes et Commandes_Backup"] = { count: geOnly.length, sample: geOnly.slice(0, 20) };
  var t = tabs[OFFICIAL_ORDERS_SHEET];
  if (t && !t.newSchema) {
    var groups = {};
    for (var r2 = 1; r2 < t.data.length; r2++) {
      var row = t.data[r2], key = [String(row[4]).replace(/\D/g, ""), norm_(row[8]), norm_(row[9]), String(row[1]).substring(0, 10)].join("|");
      if (!row[0] || !String(row[4]).replace(/\D/g, "")) continue;
      (groups[key] = groups[key] || []).push(String(row[0]));
    }
    Object.keys(groups).forEach(function (k) { if (groups[k].length > 1 && report.quasiDoublons.length < 50) report.quasiDoublons.push({ codes: groups[k], critere: "même téléphone, mêmes lieux, même jour" }); });
  }
  logEvent_("INFO", "migration.diagnostic", "", "lecture seule effectuée");
  return report;
}

function migrationSimulation_() {
  var ss = openSS_(), src = readTabForDiag_(ss, "Commandes"), ge = readTabForDiag_(ss, OFFICIAL_ORDERS_SHEET);
  var out = { generatedAt: nowIso_(), simulation: true, writes: 0, toAdd: 0, sampleCodes: [], conflicts: [], note: "Simulation : aucune ligne n'a été écrite." };
  if (!src) { out.note = "Onglet « Commandes » absent ou vide : rien à migrer."; return out; }
  var have = {};
  if (ge) for (var g = 1; g < ge.data.length; g++) have[String(ge.data[g][0]).trim()] = ge.data[g];
  var idx = headerIndex_(src.headers);
  for (var r = 1; r < src.data.length; r++) {
    var row = src.newSchema ? mapNewSchemaRow_(src.data[r], idx) : src.data[r].slice(0, ORDER_COLS);
    if (!row || !row[0]) continue;
    var c = String(row[0]).trim();
    if (!have[c]) { out.toAdd++; if (out.sampleCodes.length < 50) out.sampleCodes.push(c); }
    else {
      var a = String(have[c][4]).replace(/\D/g, ""), b = String(row[4]).replace(/\D/g, "");
      if (a !== b && out.conflicts.length < 50) out.conflicts.push({ code: c, champ: "téléphone", detail: "valeurs différentes entre Commandes et " + OFFICIAL_ORDERS_SHEET });
    }
  }
  logEvent_("INFO", "migration.simulation", "", out.toAdd + " ligne(s) à ajouter, " + out.conflicts.length + " conflit(s)");
  return out;
}

// À lancer MANUELLEMENT depuis l'éditeur avant toute migration réelle : copie complète du classeur dans Drive.
function makeBackupCopy() {
  var name = "GREAT EXPERTIZ — Sauvegarde " + Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd HHmm");
  var copy = DriveApp.getFileById(SHEET_ID).makeCopy(name);
  logEvent_("INFO", "sauvegarde.creee", "", "copie du classeur créée dans Drive");
  Logger.log("Sauvegarde créée : " + copy.getUrl());
  return copy.getUrl();
}

// Migration réelle : volontairement NON implémentée tant que le propriétaire n'a pas donné son autorisation écrite.
function runMigrationExecute() { throw new Error("Migration réelle non autorisée : diagnostic et simulation uniquement."); }
function runMigrationDiagnostic() { var r = migrationDiagnostic_(); Logger.log(JSON.stringify(r, null, 1)); return r; }
function runMigrationSimulation() { var r = migrationSimulation_(); Logger.log(JSON.stringify(r, null, 1)); return r; }

// =====================================================================
// ---------- Actions d'administration ajoutées en V3 (contrôle des droits côté serveur) ----------
// =====================================================================
var V3_ADMIN_ACTIONS = ["adminGetSettings", "adminSetSetting", "adminListTarifs", "adminSetTarif", "adminTarifsHistory", "adminQuote",
  "adminListQuotes", "adminMigrationDiag", "adminMigrationSim", "adminLogs", "adminOtpStats"];
var V3_OWNER_ONLY = ["adminGetSettings", "adminSetSetting", "adminSetTarif", "adminTarifsHistory", "adminMigrationDiag", "adminMigrationSim", "adminLogs", "adminOtpStats"];

function handleAdminV3_(p, auth) {
  if (V3_ADMIN_ACTIONS.indexOf(p.action) < 0) return null;
  if (V3_OWNER_ONLY.indexOf(p.action) > -1 && !auth.isOwner) return { ok: false, error: "réservé au propriétaire" };
  var who = auth.name || "";
  switch (p.action) {
    case "adminGetSettings": {      var map = getSettingsMap_(), list = [];
      SETTINGS_DEFAULTS.forEach(function (d) { list.push({ key: d[0], value: map[d[0]], description: d[2], modifiable: !!SETTING_VALIDATORS[d[0]] }); });
      return { ok: true, settings: list, providers: providersStatus_(),
        reglesOtpValidees: { validiteMin: OTP_VALIDITE_MIN, tentativesMax: OTP_MAX_TENTATIVES, envoisParHeure: OTP_MAX_ENVOIS_HEURE }, modeTest: MODE_TEST };
    }
    case "adminSetSetting": return setSetting_(clean_(p.setting, 60), p.value, who);   // « key » est réservé à l'authentification : le nom du paramètre est dans « setting »
    case "adminListTarifs": return { ok: true, tarifs: getTarifs_(), categories: VEHICLE_CATEGORIES, trajetFacturation: getSetting_("TRAJET_FACTURATION") };
    case "adminSetTarif": return setTarif_(p, who);
    case "adminTarifsHistory": {
      var hs = getAuxSheet_(TARIFS_HIST_SHEET, TARIFS_HIST_HEADERS), rows = lastRows_(hs, TARIFS_HIST_HEADERS.length, 200);
      return { ok: true, historique: rows.map(function (x) { return { date: x.v[0], tarif: x.v[1], champ: x.v[2], ancien: x.v[3], nouveau: x.v[4], par: x.v[5] }; }).reverse() };
    }
    case "adminQuote": {
      var cat = clean_(p.categorie, 40);
      if (!VEHICLE_CATEGORIES[cat]) return { ok: false, error: "catégorie de véhicule invalide" };
      var inp = { cbm: p.cbm, helpers: p.helpers, floors: p.floors, distanceKm: p.distanceKm, zone: clean_(p.zone, 12), categorie: cat, facturation: clean_(p.facturation, 20) || getSetting_("TRAJET_FACTURATION") };
      var code = clean_(p.code, 40);
      if (code) {
        var f = findRowByCode_(getOrdersSheet_(), code);
        if (!f) return { ok: false, error: "commande introuvable" };
        if (!inp.zone) inp.zone = String(f.row[36] || "");
        if (inp.distanceKm === undefined || inp.distanceKm === "") inp.distanceKm = f.row[27] === "" ? null : f.row[27];
        if (inp.cbm === undefined || inp.cbm === "") inp.cbm = f.row[10];
      }
      var q = computeQuote_(inp, getTarifs_(), getSettingsMap_());
      if (!q.ok) return q;
      var out = { ok: true, quote: q };
      if (String(p.save) === "true") out.cotationId = saveQuote_(code, q, inp, who);
      return out;
    }
    case "adminListQuotes": {
      var qs = getAuxSheet_(QUOTES_SHEET, QUOTE_HEADERS), qr = lastRows_(qs, QUOTE_HEADERS.length, 300), want = clean_(p.code, 40);
      return { ok: true, cotations: qr.filter(function (x) { return !want || String(x.v[1]) === want; }).map(function (x) {
        return { id: x.v[0], code: x.v[1], date: x.v[2], par: x.v[3], zone: x.v[4], categorie: x.v[5], totalPartiel: x.v[13], complete: String(x.v[14]) === "true", statut: x.v[15], detail: parseJsonSafe_(x.v[12]) }; }).reverse() };
    }
    case "adminMigrationDiag": return { ok: true, rapport: migrationDiagnostic_() };
    case "adminMigrationSim": return { ok: true, rapport: migrationSimulation_() };
    case "adminLogs": {
      var js = getAuxSheet_(JOURNAL_SHEET, JOURNAL_HEADERS), jr = lastRows_(js, JOURNAL_HEADERS.length, Math.min(Number(p.n) || 100, 300));
      return { ok: true, journal: jr.map(function (x) { return { date: x.v[0], niveau: x.v[1], operation: x.v[2], ref: x.v[3], detail: x.v[4] }; }).reverse() };
    }
    case "adminOtpStats": {
      var os = getAuxSheet_(OTP_SHEET, OTP_HEADERS), orows = lastRows_(os, OTP_HEADERS.length, 600), today = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"), st = { aujourdhui: 0, accepte: 0, livre: 0, echec: 0, enAttente: 0 };
      orows.forEach(function (x) {
        if (Utilities.formatDate(new Date(x.v[2]), TZ, "yyyy-MM-dd") !== today) return;
        st.aujourdhui++; var e = String(x.v[11]);
        if (e === "ACCEPTE") st.accepte++; else if (e === "LIVRE") st.livre++; else if (e === "ECHEC") st.echec++; else st.enAttente++;
      });
      st.limiteJour = Number(getSetting_("OTP_LIMITE_JOUR"));
      return { ok: true, stats: st };
    }
  }
  return null;
}

// =====================================================================
// ---------- Installation et contrôles (à lancer depuis l'éditeur Apps Script) ----------
// =====================================================================
function setupTest() {
  var ss = openSS_();
  seedSheets_();
  [PENDING_SHEET, OTP_SHEET, JOURNAL_SHEET, EMAIL_QUEUE_SHEET].forEach(function (n) {
    getAuxSheet_(n, { "Demandes_En_Attente": PENDING_HEADERS, "OTP": OTP_HEADERS, "Journal_GE": JOURNAL_HEADERS, "File_Emails": EMAIL_HEADERS }[n]);
  });
  var created = false;
  if (!ss.getSheetByName(OFFICIAL_ORDERS_SHEET)) {
    var sh = ss.insertSheet(OFFICIAL_ORDERS_SHEET), th = ordersHeaders_();
    sh.getRange(1, 1, 1, th.length).setValues([th]);
    sh.getRange("A:A").setNumberFormat("@"); sh.getRange("E:E").setNumberFormat("@"); sh.getRange("G:G").setNumberFormat("@");
    created = true;
  } else ensureExtraHeaders_(ss.getSheetByName(OFFICIAL_ORDERS_SHEET));
  getPepper_();
  logEvent_("INFO", "installation", "", "onglets vérifiés" + (created ? " ; Commandes_GE créé vide" : ""));
  return checkConfiguration();
}

function installTriggers() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "processEmailQueue"; });
  if (!exists) ScriptApp.newTrigger("processEmailQueue").timeBased().everyMinutes(5).create();
  return exists ? "déclencheur déjà présent" : "déclencheur créé (toutes les 5 minutes)";
}

// Affiche l'état de la configuration SANS jamais afficher de secret.
function checkConfiguration() {
  var names = ["GE_WA_TOKEN", "GE_WA_PHONE_NUMBER_ID", "GE_WA_TEMPLATE_NAME", "GE_WA_WEBHOOK_VERIFY_TOKEN", "GE_WA_WEBHOOK_SECRET",
    "GE_ORANGE_CLIENT_ID", "GE_ORANGE_CLIENT_SECRET", "GE_ORANGE_SENDER", "GE_SMS_URL", "GE_SMS_BODY_TEMPLATE"], present = {};
  names.forEach(function (n) { present[n] = !!prop_(n); });
  var rep = { version: VERSION, modeTest: MODE_TEST, sheetConfigured: String(SHEET_ID).indexOf("REMPLACER") !== 0 && SHEET_ID !== PROD_SHEET_ID,
    envoiReelActif: getSetting_("OTP_ENVOI_REEL_ACTIF") === "true", canalPrincipal: getSetting_("OTP_CANAL_PRINCIPAL"), canalAlternatifActif: getSetting_("OTP_ALTERNATIF_ACTIF") === "true",
    proprietesPresentes: present, fournisseurs: providersStatus_() };
  Logger.log(JSON.stringify(rep, null, 1));
  return rep;
}