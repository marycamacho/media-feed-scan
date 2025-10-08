// src/topics.js
// Tip: we match case-insensitively; add \b boundaries for single tokens.
// We also include common brand names to avoid the generic word "watch".

export const TOPIC_BUCKETS = {
  wearables: [
    /wearable|sensor/i,
    /\bring\b|\bring(s)?\b/i,                 // ring as a device (Oura, Ultrahuman)
    /\bsmart\s*ring\b/i,
    /\bapple\s*watch\b/i,
    /\bfitbit\b|\bgarmin\b|\bwhoop\b|\bultrahuman\b/i
  ],

  entrepreneur: [
    /\bwellnesstech\b|\bhealthtech\b/i,
    /\bfemale\s+founder(s)?\b|\bfemale\s+funder(s)?\b/i,
    /\bfemale\s+(investment|investor(s)?)\b/i
  ],

  privacy: [
    /\bprivacy\b|\bbiometric(s)?\b/i,
    /\bgdpr\b|\bhipaa\b|\bconsent\b/i,
    /\bdata\s+broker(s)?\b/i,
    /\btech\s+profiling\b|\bbioprofiling\b/i,
    /\bpolicy\b/i
  ],

  midlife_women: [
    /\bperi[-\s]?menopause\b|\bmenopause\b|\bmidlife\b/i,
    /women[’']s\s+(wellness|health)/i,
    /\bfemtech\b/i
  ],

  longevity: [
    /\blongevity\b|\bhealthspan\b|\blifespan\b/i,
    /\baging\b|\bageing\b|\bsenes/i,
    /\baging\s+gracefully\b/i
  ],

  wellness: [
    /\bwellness\b|\bresilience\b|\bstress\b|\bsleep\b|\brecovery\b|\bhabit(s)?\b/i
  ],

  ux: [
    /\bux\b|\buser\s+experience\b|\bonboarding\b|\bfriction\b|\bretention\b|\bactivation\b/i
  ],

  pbc_mission_lock: [
    /\bpublic\s+benefit\b|\bpbc\b|\bmission[-\s]?lock\b/i,
    /\bconsumer\s+coop(erative)?\b|\bsteward\s+ownership\b/i
  ],

  employee_ownership: [
    /\bemployee\s+ownership\b|\bemployee[-\s]?owned\b/i,
    /\beot\b|\besop\b|\bworker[-\s]?owned\b/i
  ],

  policy_law: [
    /\bregulation\b|\bpolicy\b/i,
    /\bftc\b|\bdoj\b|\bec\b|\beu\b/i,
    /\beu\s*ai\s*act\b|\bnih\b|\bnia\b/i
  ],

  research: [
    /\bstudy\b|\brandomi[sz]ed\b|\bmeta[-\s]?analysis\b/i,
    /doi\.org|preprint|arxiv|nber|pubmed/i
  ]
};
