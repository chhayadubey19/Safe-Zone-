/**
 * Phase 4 — Hindi / English toggle. Simple string map, no i18n library.
 *
 * Covers the top ~25 static labels: nav items, Report / My reports buttons,
 * tier chips, status labels, "You helped fix this", department names and the
 * reporter trust badges. Dynamic content (report text, venue names, history
 * descriptions) stays as-authored.
 */

export type Lang = "en" | "hi";

export const LANG_STORAGE_KEY = "safezone-lang";
/** Custom event fired on toggle so every mounted component re-renders. */
export const LANG_CHANGE_EVENT = "safezone-lang";

export const STRINGS = {
  // Nav + header
  tagline: { en: "Bhopal Community Safety Registry", hi: "भोपाल सामुदायिक सुरक्षा रजिस्ट्री" },
  registry: { en: "Registry", hi: "रजिस्ट्री" },
  my_reports: { en: "My reports", hi: "मेरी रिपोर्ट्स" },
  report_issue: { en: "Report an issue", hi: "शिकायत दर्ज करें" },
  report_short: { en: "Report", hi: "रिपोर्ट" },
  venues: { en: "venues", hi: "स्थान" },
  nav_about: { en: "About", hi: "परिचय" },
  open_app: { en: "Open the app", hi: "ऐप खोलें" },
  learn_more: { en: "Learn more", hi: "और जानें" },

  // Risk tier chips (labels only — thresholds untouched)
  tier_urgent: { en: "Urgent", hi: "अत्यावश्यक" },
  tier_high: { en: "High", hi: "उच्च" },
  tier_verify: { en: "Verify", hi: "जाँच बाकी" },
  tier_no_data: { en: "No data", hi: "कोई डेटा नहीं" },

  // Photo / upload errors (shared image pipeline)
  photo_invalid: { en: "That file could not be read as a photo. Please pick a JPEG, PNG or WebP image.", hi: "यह फ़ाइल फ़ोटो के रूप में नहीं पढ़ी जा सकी। कृपया JPEG, PNG या WebP चुनें।" },
  photo_too_large: { en: "That photo is too large even after compression. Please try a different image.", hi: "संपीड़न के बाद भी यह फ़ोटो बहुत बड़ी है। कृपया कोई और तस्वीर चुनें।" },

  // Status labels (incident lifecycle)
  status_open: { en: "Open", hi: "खुली" },
  status_reported: { en: "Reported", hi: "दर्ज" },
  status_verified: { en: "Verified", hi: "सत्यापित" },
  status_inspected: { en: "Inspected", hi: "जाँच हुई" },
  status_action_taken: { en: "Action taken", hi: "कार्रवाई हुई" },
  status_resolved: { en: "Resolved", hi: "हल हो गया" },
  status_filed: { en: "Filed", hi: "दर्ज हुई" },

  // Closure loop
  helped_fix: { en: "You helped fix this", hi: "आपकी मदद से यह ठीक हुआ" },
  fixed: { en: "Fixed", hi: "ठीक हो गया" },
  still_exists: { en: "Still exists", hi: "अब भी है" },
  full_receipt: { en: "Full receipt", hi: "पूरी रसीद" },
  venue_passport: { en: "Venue passport", hi: "वेन्यू पासपोर्ट" },

  // Departments
  dept_fire: { en: "Fire", hi: "अग्निशमन" },
  dept_health: { en: "Health", hi: "स्वास्थ्य" },
  dept_municipal: { en: "Municipal", hi: "नगरपालिका" },
  dept_building: { en: "Building", hi: "भवन" },
  all_departments: { en: "All departments", hi: "सभी विभाग" },

  // Back navigation (Phase 5 — every sub-page, top-left)
  back: { en: "Back", hi: "वापस" },
  back_to_home: { en: "Back to home", hi: "होम पर वापस" },

  // Delete my report (Phase 5 — citizen, /my-reports)
  delete_report_title: { en: "Delete this report?", hi: "यह रिपोर्ट हटाएँ?" },
  delete_report_body: { en: "This cannot be undone.", hi: "यह वापस नहीं हो सकता।" },
  delete: { en: "Delete", hi: "हटाएँ" },
  cancel: { en: "Cancel", hi: "रद्द करें" },
  report_deleted: { en: "Report deleted", hi: "रिपोर्ट हटा दी गई" },
  locked_after_inspection: { en: "Locked after inspection", hi: "जाँच के बाद लॉक" },

  // Reporter trust badges
  trusted_reporter: { en: "Trusted reporter", hi: "विश्वसनीय रिपोर्टर" },
  new_reporter: { en: "New reporter", hi: "नए रिपोर्टर" },

  // Certificates / NOC (Phase 5 spec completion)
  certificates: { en: "Certificates", hi: "प्रमाणपत्र" },
  cert_fire_noc: { en: "Fire NOC", hi: "अग्नि सुरक्षा NOC" },
  cert_health_license: { en: "Health licence", hi: "स्वास्थ्य लाइसेंस" },
  cert_trade_license: { en: "Trade licence", hi: "व्यापार लाइसेंस" },
  cert_valid: { en: "Valid", hi: "वैध" },
  cert_expiring_soon: { en: "Expiring soon", hi: "जल्द समाप्त" },
  cert_expired: { en: "Expired", hi: "समाप्त" },
  cert_unknown_expiry: { en: "Expiry unknown", hi: "समाप्ति अज्ञात" },
  cert_valid_until: { en: "Valid until {date}", hi: "{date} तक वैध" },
  officer_verified: { en: "Officer verified", hi: "अधिकारी द्वारा सत्यापित" },
  upload_certificate: { en: "Upload certificate", hi: "प्रमाणपत्र अपलोड करें" },
  extract_details: { en: "Extract details (AI)", hi: "विवरण निकालें (AI)" },
  extracting: { en: "Extracting…", hi: "निकाल रहे हैं…" },
  save_certificate: { en: "Save certificate", hi: "प्रमाणपत्र सहेजें" },
  cert_number: { en: "Certificate number", hi: "प्रमाणपत्र संख्या" },
  issue_date: { en: "Issue date", hi: "जारी तिथि" },
  expiry_date: { en: "Expiry date", hi: "समाप्ति तिथि" },
  cert_type: { en: "Certificate type", hi: "प्रमाणपत्र प्रकार" },
  authority: { en: "Issuing authority", hi: "जारीकर्ता प्राधिकरण" },
  cert_saved: { en: "Certificate saved", hi: "प्रमाणपत्र सहेजा गया" },
  ocr_failed: {
    en: "Could not read the certificate — please enter the details manually.",
    hi: "प्रमाणपत्र पढ़ा नहीं जा सका — कृपया विवरण स्वयं भरें।",
  },
  no_certificates: { en: "No certificates on record", hi: "कोई प्रमाणपत्र दर्ज नहीं" },

  // Monsoon / waterlogging indicator (Phase 5 spec completion)
  monsoon_banner: {
    en: "⚠️ Potential waterlogging risk — previous reports indicate recurring waterlogging at this location. Verification recommended.",
    hi: "⚠️ संभावित जलजमाव जोखिम — पिछली रिपोर्टों से इस स्थान पर बार-बार जलजमाव होने का संकेत है। सत्यापन की सिफारिश की जाती है।",
  },
  seasonal_risks: { en: "Seasonal risks", hi: "मौसमी जोखिम" },
  waterlogging_reports: { en: "{count} waterlogging report{s}", hi: "{count} जलजमाव रिपोर्ट" },
  last_report: { en: "Last report {date}", hi: "अंतिम रिपोर्ट {date}" },
  monsoon_chip: { en: "Waterlogging risk", hi: "जलजमाव जोखिम" },
  no_seasonal_risks: {
    en: "No recurring waterlogging reported in the last 12 months.",
    hi: "पिछले 12 महीनों में कोई आवर्ती जलजमाव रिपोर्ट नहीं हुई।",
  },
  // Map container states — a failure is never silent (mobile-blank-map lesson)
  map_loading: { en: "Loading map…", hi: "मानचित्र लोड हो रहा है…" },
  map_error: { en: "Map failed to load", hi: "मानचित्र लोड नहीं हो सका" },
  map_error_hint: {
    en: "Check your connection and try again.",
    hi: "अपना कनेक्शन जाँचें और फिर से प्रयास करें।",
  },
  map_retry: { en: "Retry", hi: "पुनः प्रयास करें" },


  // Error boundary panel
  error_boundary_title: { en: "Something went wrong", hi: "कुछ गड़बड़ हो गई" },
  error_boundary_hint: {
    en: "This part of SafeZone hit an unexpected problem. The rest of the app still works — retry, or go back to the registry.",
    hi: "SafeZone के इस हिस्से में अचानक कोई समस्या आई। बाकी ऐप अभी भी काम कर रहा है — पुनः प्रयास करें, या रजिस्ट्री पर वापस जाएँ।",
  },
  error_retry: { en: "Try again", hi: "पुनः प्रयास करें" },
  error_back_home: { en: "Back to registry", hi: "रजिस्ट्री पर वापस जाएँ" },

  // Welcome / onboarding (first visit only)
  welcome_title: { en: "Check a place before you step in", hi: "किसी जगह जाने से पहले जाँच लें" },
  welcome_headline: { en: "Know the place before you go.", hi: "जाने से पहले जगह को जानें।" },
  welcome_subtitle: {
    en: "SafeZone is Bhopal's community safety registry — venue safety records, citizen reports and municipal inspections, transparent for everyone.",
    hi: "SafeZone भोपाल की सामुदायिक सुरक्षा रजिस्ट्री है — वेन्यू सुरक्षा रिकॉर्ड, नागरिक रिपोर्ट और नगरपालिका निरीक्षण, सबके लिए पारदर्शी।",
  },
  welcome_point_report_title: { en: "See every venue's safety record", hi: "हर जगह का सुरक्षा रिकॉर्ड देखें" },
  welcome_point_report_hint: {
    en: "Risk scores, verified inspections and certificates — 120 Bhopal venues.",
    hi: "रिस्क स्कोर, सत्यापित निरीक्षण और प्रमाणपत्र — 120 भोपाल वेन्यू।",
  },
  welcome_point_photo_title: { en: "Snap a photo, AI reads the hazard", hi: "फ़ोटो खींचें, AI खतरे को पहचानेगा" },
  welcome_point_photo_hint: {
    en: "Report blocked exits or unsafe wiring in seconds — Hindi or English.",
    hi: "अवरुद्ध निकास या खतरनाक वायरिंग सेकंडों में रिपोर्ट करें — हिंदी या अंग्रेज़ी।",
  },
  welcome_point_gov_title: { en: "Departments act on your reports", hi: "विभाग आपकी रिपोर्ट पर कार्रवाई करते हैं" },
  welcome_point_gov_hint: {
    en: "Fire, Health and Municipal officers verify, resolve and notify reporters.",
    hi: "फायर, स्वास्थ्य और नगरपालिका अधिकारी सत्यापित करते हैं, समाधान करते हैं और सूचित करते हैं।",
  },
  welcome_get_started: { en: "Get started", hi: "शुरू करें" },
  welcome_how_it_works: { en: "Learn how it works", hi: "यह कैसे काम करता है" },
  welcome_chips_explore: { en: "Explore places & venues", hi: "जगहें और वेन्यू देखें" },
  welcome_chips_records: { en: "Safety records & inspections", hi: "सुरक्षा रिकॉर्ड और निरीक्षण" },
  welcome_chips_ai: { en: "AI photo analysis", hi: "AI फ़ोटो विश्लेषण" },
} as const;

export type StringKey = keyof typeof STRINGS;

/** Translate a key. Falls back to English for unknown keys / bad input. */
export function tr(lang: Lang, key: StringKey): string {
  const entry = STRINGS[key] as { en: string; hi: string } | undefined;
  if (!entry) return key;
  return lang === "hi" ? entry.hi : entry.en;
}

/**
 * Translate a key with {placeholder} substitution, e.g.
 *   trParams(lang, "cert_valid_until", { date: "2027-01-10" })
 * Unknown placeholders are left as-is; missing params keep the token visible.
 */
export function trParams(lang: Lang, key: StringKey, params: Record<string, string | number>): string {
  return tr(lang, key).replace(/\{(\w+)\}/g, (token, name: string) =>
    name in params ? String(params[name]) : token,
  );
}

/** Read the persisted language choice ("en" on server / first visit / errors). */
export function loadLang(): Lang {
  try {
    const raw = globalThis.localStorage?.getItem(LANG_STORAGE_KEY);
    return raw === "hi" ? "hi" : "en";
  } catch {
    return "en";
  }
}

/** Persist the language choice (never throws — private mode etc.). */
export function saveLang(lang: Lang): void {
  try {
    globalThis.localStorage?.setItem(LANG_STORAGE_KEY, lang);
  } catch {
    // storage unavailable — the toggle still works for this session
  }
}
