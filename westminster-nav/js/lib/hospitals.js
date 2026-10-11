// Which hospital a Transporter patient goes to: one of the closest hospitals
// that can handle the patient's need. Capabilities are keyed by the hospital
// names in data/landmarks.json and come from each hospital's published
// designations (looked up October 2026); edit CAPABILITY to match local
// protocols and current verifications.

// Tags:
//   ed          emergency department (every entry has one)
//   freestanding freestanding ER, no inpatient hospital behind it
//   full        full-service acute-care hospital (ICU, surgery, admissions)
//   trauma1 / trauma2 / trauma3   state-designated adult trauma level
//   strokeC     comprehensive stroke center (clot retrieval, neurosurgery)
//   strokeP     primary stroke center (clot-busting drugs)
//   pci         24/7 cardiac cath lab for heart attacks (STEMI)
//   peds        Level I pediatric trauma center (Children's Colorado, Anschutz)
//   pedsEd      children's emergency department
//   burn        verified burn center
export const CAPABILITY = {
  // Thornton. Level II trauma (Adams County's only Level II), primary stroke, cath lab.
  'HCA HealthONE Mountain Ridge': ['ed', 'full', 'trauma2', 'strokeP', 'pci'],
  // Wheat Ridge (Clear Creek Crossing). Level II trauma, North Metro's only comprehensive stroke center, interventional cardiology.
  'Lutheran Hospital': ['ed', 'full', 'trauma2', 'strokeC', 'pci'],
  // Westminster. Level III trauma, primary stroke, chest pain center with primary PCI.
  'St. Anthony North Hospital': ['ed', 'full', 'trauma3', 'strokeP', 'pci'],
  // Lafayette. Level II trauma (re-verified 2025), primary stroke, chest pain center, 3 cath labs.
  'Good Samaritan Medical Center': ['ed', 'full', 'trauma2', 'strokeP', 'pci'],
  // Aurora (Anschutz). The region's only Level I pediatric trauma center.
  "Children's Hospital Colorado": ['ed', 'peds', 'pedsEd'],
  // Broomfield (Hwy 7 and I-25). 24/7 children's emergency department; not a trauma center.
  "Children's Colorado North Campus": ['ed', 'pedsEd'],
  // Westminster, 2551 W 84th Ave. CommonSpirit freestanding ER; admits to St. Anthony North.
  '84th Ave ER (St. Anthony)': ['ed', 'freestanding'],
  // Westminster, 11230 Benton St. Freestanding ER, part of Mountain Ridge.
  'Northwest ER (HCA HealthONE)': ['ed', 'freestanding'],
  // Northglenn, 11900 Grant St. Intermountain Saint Joseph freestanding ER with observation beds.
  'Saint Joseph ER Northglenn': ['ed', 'freestanding'],
  // Thornton, 12793 Holly St. Freestanding ER, part of Mountain Ridge.
  'Northeast ER (HCA HealthONE)': ['ed', 'freestanding'],
  // Thornton, 12020 Colorado Blvd. UCHealth freestanding ER.
  'UCHealth ER Thornton': ['ed', 'freestanding'],
  // Louisville. Level III trauma, primary stroke, cardiac cath lab.
  'AdventHealth Avista Hospital': ['ed', 'full', 'trauma3', 'strokeP', 'pci'],
  // Broomfield. Small community hospital (18 rooms, 4-bed ICU); sends advanced stroke care elsewhere.
  'UCHealth Broomfield Hospital': ['ed'],
  // Denver. Level I adult trauma (Level II pediatric), primary stroke (2026), cath lab.
  'Denver Health Medical Center': ['ed', 'full', 'trauma1', 'strokeP', 'pci'],
  // Lakewood. Level I trauma, comprehensive stroke, cardiac receiving center, Flight For Life base.
  'St. Anthony Hospital (West)': ['ed', 'full', 'trauma1', 'strokeC', 'pci'],
  // Aurora (Anschutz). Level I trauma, comprehensive stroke, Colorado's only verified burn center.
  'UCHealth University of Colorado Hospital': ['ed', 'full', 'trauma1', 'strokeC', 'pci', 'burn'],
};

// Patient needs, how often they come up, and which hospitals take them.
// `accepts` is any-of: a hospital fits when it has at least one of the tags.
export const NEEDS = [
  { id: 'minor', weight: 24, accepts: ['ed'], rule: 'closest emergency department (a freestanding ER is fine)',
    complaints: ['Ankle injury', 'Laceration needing stitches', 'Fall with wrist pain', 'Mild allergic reaction', 'Back pain'] },
  { id: 'medical', weight: 26, accepts: ['full'], rule: 'closest full-service hospital, not a freestanding ER or small community hospital',
    complaints: ['Difficulty breathing', 'Possible sepsis', 'Diabetic emergency', 'GI bleed', 'Syncope', 'Severe abdominal pain'] },
  { id: 'stemi', weight: 8, accepts: ['pci'], rule: 'closest hospital with a 24/7 cath lab (STEMI receiving)',
    complaints: ['Chest pain, STEMI on the 12-lead', 'Cardiac arrest with return of pulses'] },
  { id: 'stroke', weight: 7, accepts: ['strokeP', 'strokeC'], rule: 'closest certified stroke center',
    complaints: ['Stroke symptoms, last known well 1 hour ago', 'Sudden slurred speech and facial droop'] },
  { id: 'lvo', weight: 3, accepts: ['strokeC'], rule: 'closest comprehensive stroke center (large-vessel stroke needs clot retrieval)',
    complaints: ['Stroke with signs of large-vessel occlusion', 'Stroke: gaze deviation and one-sided paralysis'] },
  { id: 'trauma', weight: 10, accepts: ['trauma1', 'trauma2'], rule: 'closest Level I or II trauma center',
    complaints: ['Rollover crash, multiple injuries', 'Fall from height', 'Penetrating trauma', 'Pedestrian struck'] },
  { id: 'trauma3', weight: 6, accepts: ['trauma1', 'trauma2', 'trauma3'], rule: 'closest trauma center (Level I, II or III)',
    complaints: ['Low-speed crash, stable, possible fractures', 'Elderly fall with hip fracture', 'Assault with facial injuries'] },
  { id: 'burn', weight: 2, accepts: ['burn'], rule: 'the verified burn center (UCHealth University of Colorado Hospital)',
    complaints: ['Major burns from a house fire', 'Burns over a large part of the body'] },
  { id: 'pediatric', weight: 10, accepts: ['pedsEd'], rule: "closest Children's Colorado emergency department (Anschutz or North Campus)",
    complaints: ['Pediatric seizure', 'Child with breathing trouble', 'Pediatric fracture', 'Sick infant'] },
  { id: 'pedsTrauma', weight: 4, accepts: ['peds'], rule: "Children's Colorado Anschutz, the Level I pediatric trauma center",
    complaints: ['Child struck by a car', 'Child ejected in a rollover', 'Child fell from a second-story window'] },
];

export const capabilityOf = (name) => CAPABILITY[name] || ['ed', 'full'];

const LABELS = {
  freestanding: 'freestanding ER', trauma1: 'Level I trauma', trauma2: 'Level II trauma', trauma3: 'Level III trauma',
  strokeC: 'comprehensive stroke', strokeP: 'primary stroke', pci: 'cath lab', peds: 'Level I pediatric trauma', pedsEd: 'pediatric ER', burn: 'burn center',
};
/** "Level II trauma · primary stroke · cath lab" */
export const capabilityText = (name) => {
  const tags = capabilityOf(name);
  const words = tags.filter((t) => !(t === 'pedsEd' && tags.includes('peds'))).map((t) => LABELS[t]).filter(Boolean);
  if (!words.length) words.push('community hospital ER');
  return words.join(' · ');
};

/** Pick a need at random, by weight. */
export function pickNeed(rand = Math.random) {
  let r = rand() * NEEDS.reduce((t, n) => t + n.weight, 0);
  for (const n of NEEDS) { r -= n.weight; if (r <= 0) return n; }
  return NEEDS[0];
}
