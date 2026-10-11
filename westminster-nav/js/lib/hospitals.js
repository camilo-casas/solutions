// Which hospital a Transporter patient goes to: one of the closest hospitals
// that can handle the patient's need. Capabilities are keyed by the hospital
// names in data/landmarks.json; edit CAPABILITY to match local protocols.

// full: full-service hospital (cardiac, stroke, surgery)
// limited: freestanding ER or smaller community hospital
// trauma: Level I trauma center (also full-service)
// pediatric: children's hospital
export const CAPABILITY = {
  'HCA HealthONE Mountain Ridge': ['full'],
  'Lutheran Hospital': ['full'],
  'St. Anthony North Hospital': ['full'],
  'Good Samaritan Medical Center': ['full'],
  "Children's Hospital Colorado": ['pediatric'],
  '84th Ave ER (St. Anthony)': ['limited'],
  'AdventHealth Avista Hospital': ['limited'],
  'UCHealth Broomfield Hospital': ['limited'],
  'Denver Health Medical Center': ['trauma', 'full'],
  'St. Anthony Hospital (West)': ['trauma', 'full'],
  'UCHealth University of Colorado Hospital': ['trauma', 'full'],
};

// Patient needs, how often they come up, and which hospitals take them.
export const NEEDS = [
  { id: 'minor', weight: 30, accepts: ['limited', 'full', 'trauma'], rule: 'closest emergency department (a freestanding ER is fine)',
    complaints: ['Ankle injury', 'Laceration needing stitches', 'Fall with wrist pain', 'Mild allergic reaction', 'Back pain'] },
  { id: 'medical', weight: 46, accepts: ['full'], rule: 'closest full-service hospital, not a freestanding ER or small community hospital',
    complaints: ['Chest pain', 'Stroke symptoms', 'Difficulty breathing', 'Possible sepsis', 'Diabetic emergency', 'GI bleed', 'Syncope'] },
  { id: 'trauma', weight: 12, accepts: ['trauma'], rule: 'closest Level I trauma center',
    complaints: ['Rollover crash, multiple injuries', 'Fall from height', 'Penetrating trauma', 'Pedestrian struck'] },
  { id: 'pediatric', weight: 12, accepts: ['pediatric'], rule: "Children's Hospital",
    complaints: ['Pediatric seizure', 'Child with breathing trouble', 'Pediatric fracture', 'Sick infant'] },
];

export const capabilityOf = (name) => CAPABILITY[name] || ['full'];

/** Pick a need at random, by weight. */
export function pickNeed(rand = Math.random) {
  let r = rand() * NEEDS.reduce((t, n) => t + n.weight, 0);
  for (const n of NEEDS) { r -= n.weight; if (r <= 0) return n; }
  return NEEDS[0];
}
