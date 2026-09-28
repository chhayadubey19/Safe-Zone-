/**
 * About page content — bilingual (EN / हिं), structured, and honest.
 *
 * Everything here describes what the application ACTUALLY does (citizen /
 * inspector / officer personas, report → route → inspect → resolve loop,
 * AI photo classification, certificate records). No invented features.
 * Icons are referenced by id and mapped to lucide components in the page,
 * so this module stays dependency-free and test-safe.
 */

import type { CategoryVariant } from "@/components/safezone/design";

export type L = { en: string; hi: string };

export const ABOUT = {
  hero: {
    eyebrow: { en: "About SafeZone", hi: "SafeZone के बारे में" },
    title: {
      en: "Know more about the place. Before you step into it.",
      hi: "जगह के बारे में ज़्यादा जानें। अंदर क़दम रखने से पहले।",
    },
    lede: {
      en: "SafeZone is Bhopal's community safety registry. It collects venue safety records, citizen reports and municipal inspections in one transparent place — so residents can check a place before they walk into it.",
      hi: "SafeZone भोपाल की सामुदायिक सुरक्षा रजिस्ट्री है। यह वेन्यू सुरक्षा रिकॉर्ड, नागरिक रिपोर्ट और नगरपालिका निरीक्षण को एक पारदर्शी जगह पर रखती है — ताकि निवासी किसी जगह में जाने से पहले उसकी जाँच कर सकें।",
    },
    ctaPrimary: { en: "Explore the registry", hi: "रजिस्ट्री देखें" },
    ctaSecondary: { en: "See how it works", hi: "देखें यह कैसे काम करता है" },
  },

  /** Section 02 — what SafeZone does (4 differentiated cards). */
  whatHeading: {
    eyebrow: { en: "What SafeZone does", hi: "SafeZone क्या करता है" },
    title: { en: "Four things, done properly", hi: "चार काम, ठीक से" },
    lede: {
      en: "One registry, one map, one reporting loop — built for a city, not for a demo.",
      hi: "एक रजिस्ट्री, एक नक्शा, एक रिपोर्टिंग लूप — डेमो के लिए नहीं, शहर के लिए।",
    },
  },
  whatCards: [
    {
      id: "explore" as const,
      variant: "location" as CategoryVariant,
      meta: { en: "Explore", hi: "खोज" },
      title: { en: "Browse the city's places", hi: "शहर की जगहें देखें" },
      body: {
        en: "120 venues across Bhopal — schools, cafés, coaching centres, malls, parks — on a live map or a searchable list, filterable by type and risk tier.",
        hi: "भोपाल भर के 120 वेन्यू — स्कूल, कैफ़े, कोचिंग सेंटर, मॉल, पार्क — लाइव नक्शे या खोजयोग्य सूची में, प्रकार और रिस्क स्तर के अनुसार फ़िल्टर के साथ।",
      },
    },
    {
      id: "safety" as const,
      variant: "safety" as CategoryVariant,
      meta: { en: "Safety", hi: "सुरक्षा" },
      title: { en: "Venue safety records", hi: "वेन्यू सुरक्षा रिकॉर्ड" },
      body: {
        en: "Every venue has a passport: current risk tier, safety checklist, inspection history, certificates such as the Fire NOC, and any open concerns.",
        hi: "हर वेन्यू का एक पासपोर्ट है: मौजूदा रिस्क स्तर, सुरक्षा चेकलिस्ट, निरीक्षण इतिहास, अग्नि NOC जैसे प्रमाणपत्र, और कोई भी खुली शिकायत।",
      },
    },
    {
      id: "ai" as const,
      variant: "ai" as CategoryVariant,
      meta: { en: "AI analysis", hi: "AI विश्लेषण" },
      title: { en: "AI that reads photos", hi: "फ़ोटो पढ़ने वाला AI" },
      body: {
        en: "Snap a photo of a hazard — a blocked exit, tangled wiring — and AI helps classify the issue and draft the description in seconds.",
        hi: "खतरे की फ़ोटो खींचें — अवरुद्ध निकास, उलझी वायरिंग — और AI सेकंडों में समस्या पहचानकर विवरण तैयार करता है।",
      },
      hasInfo: true,
    },
    {
      id: "reports" as const,
      variant: "report" as CategoryVariant,
      meta: { en: "Reports", hi: "रिपोर्ट" },
      title: { en: "Reports that reach departments", hi: "रिपोर्ट जो विभाग तक पहुँचती हैं" },
      body: {
        en: "Citizen reports are routed to the responsible department — Fire, Health, Municipal or Building — and tracked from filed to fixed.",
        hi: "नागरिक रिपोर्ट ज़िम्मेदार विभाग को भेजी जाती है — फायर, स्वास्थ्य, नगरपालिका या भवन — और दर्ज होने से ठीक होने तक ट्रैक की जाती हैं।",
      },
    },
  ],

  /** Section 03 — the five-step workflow. */
  workflowHeading: {
    eyebrow: { en: "How SafeZone works", hi: "SafeZone कैसे काम करता है" },
    title: { en: "From finding a place to trusting it", hi: "जगह खोजने से भरोसा करने तक" },
    lede: {
      en: "Five steps, one loop — every step below opens with more detail.",
      hi: "पाँच क़दम, एक लूप — नीचे हर क़दम और विवरण खुलता है।",
    },
  },
  workflow: [
    {
      num: "01",
      id: "discover" as const,
      variant: "location" as CategoryVariant,
      title: { en: "Discover", hi: "खोज" },
      short: {
        en: "Find a place on the Bhopal map, or search the registry by name, ward or venue type.",
        hi: "भोपाल के नक्शे पर जगह खोजें, या नाम, वार्ड या वेन्यू प्रकार से रजिस्ट्री खोजें।",
      },
      detail: {
        en: "The registry covers schools, coaching centres, gyms, clinics, malls, cinemas, restaurants, hotels, offices, bus stands, parks, pools, community halls and construction sites. Filters narrow by risk tier; the list and the map always stay in sync.",
        hi: "रजिस्ट्री में स्कूल, कोचिंग सेंटर, जिम, क्लिनिक, मॉल, सिनेमा, रेस्टोरेंट, होटल, दफ़्तर, बस स्टैंड, पार्क, पूल, कम्युनिटी हॉल और निर्माण स्थल शामिल हैं। फ़िल्टर रिस्क स्तर से छाँटते हैं; सूची और नक्शा हमेशा समानांतर रहते हैं।",
      },
    },
    {
      num: "02",
      id: "inspect" as const,
      variant: "education" as CategoryVariant,
      title: { en: "Inspect", hi: "जाँच" },
      short: {
        en: "Open the venue passport — risk tier, safety checklist, certificates and full history.",
        hi: "वेन्यू पासपोर्ट खोलें — रिस्क स्तर, सुरक्षा चेकलिस्ट, प्रमाणपत्र और पूरा इतिहास।",
      },
      detail: {
        en: "The passport shows the risk score (0–100) and tier, the safety checklist from the latest inspection, certificates like the Fire NOC with their validity, past incidents and every recorded event — inspections, notices, reports and resolutions.",
        hi: "पासपोर्ट में रिस्क स्कोर (0–100) और स्तर, नवीनतम निरीक्षण की सुरक्षा चेकलिस्ट, अग्नि NOC जैसे प्रमाणपत्र उनकी वैधता के साथ, पिछली घटनाएँ और हर दर्ज घटना — निरीक्षण, सूचनाएँ, रिपोर्ट और समाधान — दिखते हैं।",
      },
    },
    {
      num: "03",
      id: "analyze" as const,
      variant: "ai" as CategoryVariant,
      title: { en: "Analyze", hi: "विश्लेषण" },
      short: {
        en: "Read verified inspections alongside citizen reports — with photos and AI analysis where available.",
        hi: "सत्यापित निरीक्षण और नागरिक रिपोर्ट साथ पढ़ें — जहाँ उपलब्ध हो, फ़ोटो और AI विश्लेषण के साथ।",
      },
      detail: {
        en: "Every item is labelled by its source: verified inspections and citizen reports look different on purpose. Photo evidence is attached to reports, and AI classifies what the photo shows. Severity is never mixed with trust — an unconfirmed critical report is shown differently from a confirmed one.",
        hi: "हर आइटम अपने स्रोत के साथ लेबल किया जाता है: सत्यापित निरीक्षण और नागरिक रिपोर्ट जान-बूझकर अलग दिखते हैं। रिपोर्ट के साथ फ़ोटो साक्ष्य जुड़ता है, और AI फ़ोटो में क्या है पहचानता है। गंभीरता को कभी भरोसे से नहीं मिलाया जाता — असत्यापित गंभीर रिपोर्ट सत्यापित से अलग दिखती है।",
      },
    },
    {
      num: "04",
      id: "understand" as const,
      variant: "medical" as CategoryVariant,
      title: { en: "Understand", hi: "समझ" },
      short: {
        en: "The risk score combines it all — confirmed issues, unverified reports, stale inspections, missing certificates.",
        hi: "रिस्क स्कोर सब कुछ मिलाकर बनता है — पुष्ट शिकायतें, असत्यापित रिपोर्ट, पुराने निरीक्षण, ग़ायब प्रमाणपत्र।",
      },
      detail: {
        en: "The score is computed from inspection results, open incidents, citizen report volume and certificate validity. 'Insufficient data' is shown honestly when a venue has never been inspected — absence of information is information too.",
        hi: "स्कोर निरीक्षण परिणामों, खुली घटनाओं, नागरिक रिपोर्ट संख्या और प्रमाणपत्र वैधता से बनता है। जब किसी वेन्यू का निरीक्षण कभी नहीं हुआ, ईमानदारी से 'अपर्याप्त डेटा' दिखता है — जानकारी का अभाव भी जानकारी है।",
      },
      hasInfo: true,
    },
    {
      num: "05",
      id: "decide" as const,
      variant: "community" as CategoryVariant,
      title: { en: "Decide", hi: "निर्णय" },
      short: {
        en: "Walk in informed — and report what you see to help the next person.",
        hi: "जानकारी के साथ जाएँ — और जो देखें उसे रिपोर्ट कर अगले व्यक्ति की मदद करें।",
      },
      detail: {
        en: "Use the passport to decide. If you spot a hazard, reporting takes under a minute — pick the venue, optionally snap a photo, submit. Departments act on it, and your report updates the venue's tier for everyone after you.",
        hi: "निर्णय के लिए पासपोर्ट देखें। खतरा दिखे तो रिपोर्ट करने में एक मिनट से कम लगता है — वेन्यू चुनें, चाहें तो फ़ोटो खींचें, भेज दें। विभाग कार्रवाई करते हैं, और आपकी रिपोर्ट आपके बाद आने वाले सबके लिए वेन्यू का स्तर अपडेट करती है।",
      },
    },
  ],

  /** Section — who SafeZone is for (the REAL roles the app supports). */
  rolesHeading: {
    eyebrow: { en: "Who SafeZone is for", hi: "SafeZone किसके लिए है" },
    title: { en: "Four roles, one loop", hi: "चार भूमिकाएँ, एक लूप" },
    lede: {
      en: "Everyone sees the same transparent registry — what differs is what you can do in it.",
      hi: "सबको एक ही पारदर्शी रजिस्ट्री दिखती है — फ़र्क़ सिर्फ़ यह है कि आप उसमें क्या कर सकते हैं।",
    },
  },
  roles: [
    {
      id: "citizen" as const,
      variant: "community" as CategoryVariant,
      meta: { en: "Citizens & visitors", hi: "नागरिक और आगंतुक" },
      title: { en: "Check places. Report hazards.", hi: "जगहें जाँचें। खतरे रिपोर्ट करें।" },
      short: {
        en: "Browse the registry, file photo reports, and follow them to resolution.",
        hi: "रजिस्ट्री देखें, फ़ोटो रिपोर्ट भेजें, और समाधान तक उनका पीछा करें।",
      },
      canDo: {
        en: [
          "Browse the map and open any venue passport",
          "File a report with an optional photo — AI helps draft it",
          "Track every report in My reports, with a full receipt",
          "Get notified when a reported issue is resolved",
        ],
        hi: [
          "नक्शा देखें और किसी भी वेन्यू का पासपोर्ट खोलें",
          "फ़ोटो के साथ रिपोर्ट भेजें — AI ड्राफ़्ट में मदद करता है",
          "मेरी रिपोर्ट्स में हर रिपोर्ट को पूरी रसीद के साथ देखें",
          "रिपोर्ट की गई समस्या हल होने पर सूचना पाएँ",
        ],
      },
      provides: {
        en: "Photos, descriptions and an honest location check.",
        hi: "फ़ोटो, विवरण और ईमानदार स्थान-जाँच।",
      },
      receives: {
        en: "An up-to-date risk picture of the city, and closure on what they reported.",
        hi: "शहर का अपडेटेड रिस्क चित्र, और रिपोर्ट की गई समस्या का समाधान।",
      },
    },
    {
      id: "inspector" as const,
      variant: "safety" as CategoryVariant,
      meta: { en: "Inspectors", hi: "निरीक्षक" },
      title: { en: "Verify reports in the field.", hi: "मैदान में रिपोर्ट सत्यापित करें।" },
      short: {
        en: "Work the queue, open case files, log field audits against reports.",
        hi: "कतार संभालें, केस फ़ाइल खोलें, रिपोर्ट के विरुद्ध फ़ील्ड ऑडिट दर्ज करें।",
      },
      canDo: {
        en: [
          "Open the department queue and pick a case file",
          "Review every citizen report, photo and prior inspection",
          "Log a field audit — confirm or clear each reported item",
          "Record checklist results and upload certificates",
        ],
        hi: [
          "विभागीय कतार खोलें और केस फ़ाइल चुनें",
          "हर नागरिक रिपोर्ट, फ़ोटो और पिछला निरीक्षण देखें",
          "फ़ील्ड ऑडिट दर्ज करें — हर रिपोर्ट की पुष्टि या खंडन",
          "चेकलिस्ट परिणाम दर्ज करें और प्रमाणपत्र अपलोड करें",
        ],
      },
      provides: {
        en: "Verified inspections, on-site evidence and certificate records.",
        hi: "सत्यापित निरीक्षण, स्थल पर साक्ष्य और प्रमाणपत्र रिकॉर्ड।",
      },
      receives: {
        en: "Prioritised case files with all prior reports and full history.",
        hi: "प्राथमिकता वाली केस फ़ाइलें, सभी पिछली रिपोर्ट और पूरे इतिहास के साथ।",
      },
    },
    {
      id: "officer" as const,
      variant: "education" as CategoryVariant,
      meta: { en: "Officers", hi: "अधिकारी" },
      title: { en: "Review, resolve, close the loop.", hi: "समीक्षा करें, समाधान करें, लूप पूरा करें।" },
      short: {
        en: "See what is verified, resolve confirmed incidents, record the outcome.",
        hi: "देखें क्या सत्यापित है, पुष्ट घटनाओं का समाधान करें, परिणाम दर्ज करें।",
      },
      canDo: {
        en: [
          "Review the department queue by risk and status",
          "Open any venue's case file with its full history",
          "Resolve verified incidents and record what was done",
          "See resolution history across venues",
        ],
        hi: [
          "रिस्क और स्थिति के अनुसार विभागीय कतार देखें",
          "किसी भी वेन्यू की केस फ़ाइल पूरे इतिहास के साथ खोलें",
          "सत्यापित घटनाओं का समाधान करें और कार्रवाई दर्ज करें",
          "वेन्यू के समाधान इतिहास को देखें",
        ],
      },
      provides: {
        en: "Resolutions and the final status of every incident.",
        hi: "समाधान और हर घटना की अंतिम स्थिति।",
      },
      receives: {
        en: "Verified case files and the department's real workload.",
        hi: "सत्यापित केस फ़ाइलें और विभाग का वास्तविक कार्यभार।",
      },
    },
    {
      id: "ai" as const,
      variant: "ai" as CategoryVariant,
      meta: { en: "The AI system", hi: "AI सिस्टम" },
      title: { en: "Assists. Never decides.", hi: "मदद करता है। निर्णय नहीं लेता।" },
      short: {
        en: "Classifies photos, drafts descriptions, extracts certificate details.",
        hi: "फ़ोटो पहचानता है, विवरण लिखता है, प्रमाणपत्र विवरण निकालता है।",
      },
      canDo: {
        en: [
          "Classify a hazard photo in the report flow",
          "Draft a description the reporter can edit",
          "Extract details from an uploaded certificate",
          "Work alongside — never instead of — human inspectors",
        ],
        hi: [
          "रिपोर्ट प्रवाह में खतरे की फ़ोटो पहचानना",
          "रिपोर्टर द्वारा संपादनयोग्य विवरण लिखना",
          "अपलोड किए प्रमाणपत्र से विवरण निकालना",
          "मानव निरीक्षकों के साथ काम करना — उनके बदले नहीं",
        ],
      },
      provides: {
        en: "Fast classification and drafting, clearly labelled as AI.",
        hi: "तेज़ वर्गीकरण और ड्राफ़्टिंग, स्पष्ट रूप से AI लेबल के साथ।",
      },
      receives: {
        en: "Only the photo and text the citizen chooses to submit.",
        hi: "केवल वही फ़ोटो और पाठ जो नागरिक भेजना चुनता है।",
      },
    },
  ],

  /** Section — the report journey (the actual product flow). */
  journeyHeading: {
    eyebrow: { en: "The report journey", hi: "रिपोर्ट की यात्रा" },
    title: { en: "From a photo to a fixed exit", hi: "फ़ोटो से ठीक निकास तक" },
    lede: {
      en: "What actually happens when someone reports a hazard — every step exists in the app today.",
      hi: "जब कोई खतरा रिपोर्ट करता है तो वास्तव में क्या होता है — हर क़दम ऐप में आज मौजूद है।",
    },
  },
  journey: [
    {
      title: { en: "Spot an issue", hi: "समस्या देखें" },
      body: {
        en: "A citizen notices a blocked fire exit at a café and taps Report an issue.",
        hi: "नागरिक कैफ़े में अवरुद्ध फायर एग्जिट देखकर 'शिकायत दर्ज करें' दबाता है।",
      },
    },
    {
      title: { en: "Optional photo", hi: "वैकल्पिक फ़ोटो" },
      body: {
        en: "They snap a photo — AI classifies the hazard and drafts a description they can edit.",
        hi: "फ़ोटो खींचता है — AI खतरा पहचानकर विवरण लिखता है जिसे वह संपादित कर सकता है।",
      },
    },
    {
      title: { en: "Submit", hi: "भेजें" },
      body: {
        en: "The report is filed against the venue with its category, severity and optional photo.",
        hi: "रिपोर्ट वेन्यू के विरुद्ध श्रेणी, गंभीरता और वैकल्पिक फ़ोटो के साथ दर्ज होती है।",
      },
    },
    {
      title: { en: "Route", hi: "रूटिंग" },
      body: {
        en: "The report is routed to the responsible department and appears in the officer queue.",
        hi: "रिपोर्ट ज़िम्मेदार विभाग को भेजी जाती है और अधिकारी कतार में दिखती है।",
      },
    },
    {
      title: { en: "Inspect", hi: "निरीक्षण" },
      body: {
        en: "An inspector opens the case file and logs a field audit — confirming or clearing the report.",
        hi: "निरीक्षक केस फ़ाइल खोलकर फ़ील्ड ऑडिट दर्ज करता है — रिपोर्ट की पुष्टि या खंडन।",
      },
    },
    {
      title: { en: "Resolve", hi: "समाधान" },
      body: {
        en: "The officer resolves the verified incident and records what was done.",
        hi: "अधिकारी सत्यापित घटना का समाधान करता है और कार्रवाई दर्ज करता है।",
      },
    },
    {
      title: { en: "Notify", hi: "सूचना" },
      body: {
        en: "The reporter is notified — and the venue's tier updates for everyone.",
        hi: "रिपोर्टर को सूचना मिलती है — और सबके लिए वेन्यू का स्तर अपडेट होता है।",
      },
    },
  ],

  /** Section — capabilities (editorial, not card soup). */
  capabilitiesHeading: {
    eyebrow: { en: "Capabilities", hi: "क्षमताएँ" },
    title: { en: "The details that make it usable", hi: "चीज़ें जो इसे उपयोगी बनाती हैं" },
  },
  capabilities: [
    {
      num: "01",
      title: { en: "Search & filter", hi: "खोज और फ़िल्टर" },
      body: { en: "By name, ward, venue type and risk tier — list and map agree.", hi: "नाम, वार्ड, वेन्यू प्रकार और रिस्क स्तर से — सूची और नक्शा एक राय पर।" },
    },
    {
      num: "02",
      title: { en: "Venue passports", hi: "वेन्यू पासपोर्ट" },
      body: { en: "The full safety record of a place in one scroll.", hi: "एक जगह का पूरा सुरक्षा रिकॉर्ड एक ही स्क्रॉल में।" },
    },
    {
      num: "03",
      title: { en: "Certificate records", hi: "प्रमाणपत्र रिकॉर्ड" },
      body: { en: "Fire NOC, health and trade licences — with expiry tracking.", hi: "अग्नि NOC, स्वास्थ्य और व्यापार लाइसेंस — समाप्ति ट्रैकिंग के साथ।" },
    },
    {
      num: "04",
      title: { en: "Seasonal risks", hi: "मौसमी जोखिम" },
      body: { en: "Monsoon waterlogging flags from recurring reports.", hi: "आवर्ती रिपोर्टों से मानसून जलजमाव संकेत।" },
    },
    {
      num: "05",
      title: { en: "Bilingual throughout", hi: "पूरा द्विभाषी" },
      body: { en: "Every label in English and हिंदी — one toggle.", hi: "हर लेबल अंग्रेज़ी और हिंदी में — एक टॉगल।" },
    },
    {
      num: "06",
      title: { en: "Built for phones", hi: "फ़ोन के लिए बना" },
      body: { en: "Installable as an app; camera reports straight from mobile.", hi: "ऐप की तरह इंस्टॉल करें; मोबाइल से सीधे कैमरा रिपोर्ट।" },
    },
  ],

  /** Dialogs. */
  aiInfo: {
    eyebrow: { en: "AI analysis", hi: "AI विश्लेषण" },
    title: { en: "How does AI analysis work?", hi: "AI विश्लेषण कैसे काम करता है?" },
    body: {
      en: "When a photo is attached to a report, SafeZone sends it to a vision model that classifies the visible hazard and drafts a description. The AI never decides a venue's risk tier — inspectors verify on site. Its output is clearly labelled, and if it is unavailable, reporting still works without it.",
      hi: "जब रिपोर्ट के साथ फ़ोटो जुड़ती है, SafeZone उसे एक विज़न मॉडल को भेजता है जो दिखता खतरा पहचानकर विवरण लिखता है। AI कभी वेन्यू का रिस्क स्तर तय नहीं करता — निरीक्षक स्थल पर सत्यापन करते हैं। इसका आउटपुट स्पष्ट रूप से लेबल किया जाता है, और यदि यह उपलब्ध न हो, तो रिपोर्टिंग इसके बिना भी काम करती है।",
    },
  },
  scoreInfo: {
    eyebrow: { en: "Risk score", hi: "रिस्क स्कोर" },
    title: { en: "What does the risk score mean?", hi: "रिस्क स्कोर का क्या मतलब है?" },
    body: {
      en: "The score (0–100) is computed from inspection results, open incidents, citizen report volume and certificate validity — higher means more attention needed. Tiers: Urgent, High, Needs verification, and Insufficient data. 'Insufficient data' is honest: it means the venue has never been inspected.",
      hi: "स्कोर (0–100) निरीक्षण परिणामों, खुली घटनाओं, नागरिक रिपोर्ट संख्या और प्रमाणपत्र वैधता से बनता है — ज़्यादा का मतलब ज़्यादा ध्यान चाहिए। स्तर: अत्यावश्यक, उच्च, जाँच बाकी, और अपर्याप्त डेटा। 'अपर्याप्त डेटा' ईमानदार है: इसका मतलब वेन्यू का निरीक्षण कभी नहीं हुआ।",
    },
  },

  /** Closing CTA. */
  closing: {
    title: { en: "Check a place before you step in.", hi: "किसी जगह में जाने से पहले जाँच लें।" },
    body: {
      en: "The registry is open to everyone — no account needed to look.",
      hi: "रजिस्ट्री सबके लिए खुली है — देखने के लिए किसी खाते की ज़रूरत नहीं।",
    },
    cta: { en: "Explore the registry", hi: "रजिस्ट्री देखें" },
  },
} as const;
