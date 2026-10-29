/**
 * Migration Script: Seed ASCOMS Jammu Equipment, Beds & 117 Specialist Doctors Roster
 * 
 * 1. Seeds all 15 Estimated Equipment & Bed Categories for ASCOMS (hospital_id = 5)
 * 2. Seeds all 117 Faculty Doctors across 26 Clinical Departments with a 24/7 Rotational Emergency Duty Roster.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const db = require("../src/config/db");

const ASCOMS_HOSPITAL_ID = 5;

// 1. ASCOMS Equipment & Bed Capacities (15 Categories)
const ASCOMS_RESOURCES = [
  {
    resource_type: "Defibrillator Unit",
    total_quantity: 12,
    available_quantity: 9,
    status: "available",
    notes: "Estimated 6–12 units; automated external & biphasic resuscitation units across ER and Critical Care"
  },
  {
    resource_type: "Mechanical Ventilator",
    total_quantity: 30,
    available_quantity: 19,
    status: "available",
    notes: "Estimated 15–30 units; invasive mechanical ventilators in adult Medical and Surgical ICUs"
  },
  {
    resource_type: "Defibrillator",
    total_quantity: 15,
    available_quantity: 11,
    status: "available",
    notes: "Estimated 8–15 units; crash-cart and transport defibrillator monitors"
  },
  {
    resource_type: "Ventilator",
    total_quantity: 35,
    available_quantity: 23,
    status: "available",
    notes: "Estimated 20–35 units; total ventilator inventory including transport and emergency backup"
  },
  {
    resource_type: "ICU Bed",
    total_quantity: 35,
    available_quantity: 18,
    status: "available",
    notes: "Estimated 20–35 tertiary critical care beds with dedicated multipara monitoring"
  },
  {
    resource_type: "General Ward Bed",
    total_quantity: 500,
    available_quantity: 330,
    status: "available",
    notes: "Estimated 400–500 in-patient multi-specialty general ward beds"
  },
  {
    resource_type: "Pediatric ICU Bed",
    total_quantity: 12,
    available_quantity: 7,
    status: "available",
    notes: "Estimated 6–12 specialized PICU / NICU neonatal & pediatric critical beds"
  },
  {
    resource_type: "Emergency Resuscitation Bay",
    total_quantity: 4,
    available_quantity: 3,
    status: "available",
    notes: "Estimated 2–4 red-priority acute trauma resuscitation bays"
  },
  {
    resource_type: "CT Scanner (64-Slice)",
    total_quantity: 1,
    available_quantity: 1,
    status: "available",
    notes: "CT facility documented; 24/7 emergency diagnostic spiral imaging"
  },
  {
    resource_type: "MRI Scanner (1.5T)",
    total_quantity: 1,
    available_quantity: 1,
    status: "available",
    notes: "MRI facility documented; 1.5 Tesla superconducting MRI"
  },
  {
    resource_type: "Operating Room (Trauma)",
    total_quantity: 2,
    available_quantity: 1,
    status: "available",
    notes: "Estimated 1–2 dedicated 24/7 emergency trauma surgery suites"
  },
  {
    resource_type: "Cardiac Telemetry Monitor",
    total_quantity: 20,
    available_quantity: 14,
    status: "available",
    notes: "Estimated 10–20 continuous bedside cardiac telemetry monitors"
  },
  {
    resource_type: "Dialysis Machine",
    total_quantity: 15,
    available_quantity: 10,
    status: "available",
    notes: "Estimated 8–15 hemodialysis stations in dedicated renal dialysis unit"
  },
  {
    resource_type: "Burn Unit Bed",
    total_quantity: 6,
    available_quantity: 4,
    status: "available",
    notes: "Estimated 0–6 dedicated burn-unit capacity with isolated climate control"
  },
  {
    resource_type: "Negative Pressure Isolation Room",
    total_quantity: 4,
    available_quantity: 2,
    status: "available",
    notes: "Estimated 1–4 airborne infection isolation rooms (AIIR)"
  }
];

// 2. ASCOMS 117 Specialist Doctors & 24/7 Duty Roster
const ASCOMS_DOCTORS = [
  // 1. Anatomy (5)
  {
    sno: 1,
    department: "Anatomy",
    doctor_name: "Dr. Zeenat Akhtar",
    specialty: "Anatomy",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Clinical Gross Anatomy & Surgical Dissection Lead",
    contact_phone: "+91-191-2233445 (Ext: 201)"
  },
  {
    sno: 2,
    department: "Anatomy",
    doctor_name: "Dr. Bonita Gupte",
    specialty: "Anatomy",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Histology & Neuroanatomy Consultant",
    contact_phone: "+91-191-2233445 (Ext: 202)"
  },
  {
    sno: 3,
    department: "Anatomy",
    doctor_name: "Dr. Rishu",
    specialty: "Anatomy",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Embryology & Teratology Specialist",
    contact_phone: "+91-191-2233445 (Ext: 203)"
  },
  {
    sno: 4,
    department: "Anatomy",
    doctor_name: "Dr. Jasbir Kaur Bali",
    specialty: "Anatomy",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Applied Clinical Anatomy Lead",
    contact_phone: "+91-191-2233445 (Ext: 204)"
  },
  {
    sno: 5,
    department: "Anatomy",
    doctor_name: "Dr. Ritu Tandon",
    specialty: "Anatomy",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Microscopic & Cross-sectional Anatomy",
    contact_phone: "+91-191-2233445 (Ext: 205)"
  },

  // 2. Anaesthesiology (7)
  {
    sno: 6,
    department: "Anaesthesiology",
    doctor_name: "Dr. Shikha Sharma",
    specialty: "Anaesthesiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency OT & Trauma Airway Management Lead",
    contact_phone: "+91-191-2233445 (Ext: 206)"
  },
  {
    sno: 7,
    department: "Anaesthesiology",
    doctor_name: "Dr. Rasmeet Kour",
    specialty: "Anaesthesiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Critical Care Sedation & Neuro-anaesthesia Lead",
    contact_phone: "+91-191-2233445 (Ext: 207)"
  },
  {
    sno: 8,
    department: "Anaesthesiology",
    doctor_name: "Dr. Anshu",
    specialty: "Anaesthesiology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Emergency Resuscitation & Ultrasound-guided Blocks",
    contact_phone: "+91-191-2233445 (Ext: 208)"
  },
  {
    sno: 9,
    department: "Anaesthesiology",
    doctor_name: "Dr. Priyanka Mengi",
    specialty: "Anaesthesiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Obstetric Anaesthesia & Emergency Labour Epidural",
    contact_phone: "+91-191-2233445 (Ext: 209)"
  },
  {
    sno: 10,
    department: "Anaesthesiology",
    doctor_name: "Dr. Pallavi Bloria",
    specialty: "Anaesthesiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Paediatric & Neonatal Anaesthesia Specialist",
    contact_phone: "+91-191-2233445 (Ext: 210)"
  },
  {
    sno: 11,
    department: "Anaesthesiology",
    doctor_name: "Dr. Jyoti Sakral",
    specialty: "Anaesthesiology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Polytrauma Anaesthesia On-Call",
    contact_phone: "+91-191-2233445 (Ext: 211)"
  },
  {
    sno: 12,
    department: "Anaesthesiology",
    doctor_name: "Dr. Nashrah Ashraf",
    specialty: "Anaesthesiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Acute Pain Management & Resuscitation Bay",
    contact_phone: "+91-191-2233445 (Ext: 212)"
  },

  // 3. Biochemistry (4)
  {
    sno: 13,
    department: "Biochemistry",
    doctor_name: "Dr. Ajay Puri",
    specialty: "Biochemistry",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Stat Emergency ABG & Cardiac Biomarker Lead",
    contact_phone: "+91-191-2233445 (Ext: 213)"
  },
  {
    sno: 14,
    department: "Biochemistry",
    doctor_name: "Dr. Anjali Tikoo",
    specialty: "Biochemistry",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Emergency Renal & Liver Function Testing",
    contact_phone: "+91-191-2233445 (Ext: 214)"
  },
  {
    sno: 15,
    department: "Biochemistry",
    doctor_name: "Dr. Usha Kumari Gupta",
    specialty: "Biochemistry",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Toxicology Screening & Electrolyte Analysis",
    contact_phone: "+91-191-2233445 (Ext: 215)"
  },
  {
    sno: 16,
    department: "Biochemistry",
    doctor_name: "Mrs. Navdeep Kaur",
    specialty: "Biochemistry",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Clinical Immuno-assay & Quality Diagnostics",
    contact_phone: "+91-191-2233445 (Ext: 216)"
  },

  // 4. Blood Bank (1)
  {
    sno: 17,
    department: "Blood Bank",
    doctor_name: "Dr. Sandeep Sadhu",
    specialty: "Transfusion Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Massive Transfusion Protocol (MTP) & Universal O- Bank Lead",
    contact_phone: "+91-191-2233445 (Ext: 217)"
  },

  // 5. Community Medicine (8)
  {
    sno: 18,
    department: "Community Medicine",
    doctor_name: "Dr. R. K. Khajuria",
    specialty: "Community Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Epidemic Surveillance & Preventive Emergency Lead",
    contact_phone: "+91-191-2233445 (Ext: 218)"
  },
  {
    sno: 19,
    department: "Community Medicine",
    doctor_name: "Dr. Bhavna Sahni",
    specialty: "Community Medicine",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Public Health & Hospital Infection Control Officer",
    contact_phone: "+91-191-2233445 (Ext: 219)"
  },
  {
    sno: 20,
    department: "Community Medicine",
    doctor_name: "Dr. Sunny Babber",
    specialty: "Medical Statistics",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Surveillance Analytics & Epidemic Statistics",
    contact_phone: "+91-191-2233445 (Ext: 220)"
  },
  {
    sno: 21,
    department: "Community Medicine",
    doctor_name: "Dr. Chandni Gupta",
    specialty: "Community Medicine",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Disease Outbreak Response Coordinator",
    contact_phone: "+91-191-2233445 (Ext: 221)"
  },
  {
    sno: 22,
    department: "Community Medicine",
    doctor_name: "Dr. Sandeepa Balim",
    specialty: "Community Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Maternal & Child Health Community Outreach Lead",
    contact_phone: "+91-191-2233445 (Ext: 222)"
  },
  {
    sno: 23,
    department: "Community Medicine",
    doctor_name: "Dr. Rana Zahoor Ahmad",
    specialty: "Epidemiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Field Epidemiology & Vector-Borne Outbreak Control",
    contact_phone: "+91-191-2233445 (Ext: 223)"
  },
  {
    sno: 24,
    department: "Community Medicine",
    doctor_name: "Dr. Nazuk Razdan",
    specialty: "Community Medicine",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Community Disaster Triage & Vaccination Lead",
    contact_phone: "+91-191-2233445 (Ext: 224)"
  },
  {
    sno: 25,
    department: "Community Medicine",
    doctor_name: "Dr. Tasneef Banoo Zargar",
    specialty: "Community Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Occupational Health & Preventive Medicine Lead",
    contact_phone: "+91-191-2233445 (Ext: 225)"
  },

  // 6. Dental Surgery (4)
  {
    sno: 26,
    department: "Dental Surgery",
    doctor_name: "Dr. Sonam Kohli",
    specialty: "Dental Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Maxillofacial Trauma & Acute Dental Emergency Lead",
    contact_phone: "+91-191-2233445 (Ext: 226)"
  },
  {
    sno: 27,
    department: "Dental Surgery",
    doctor_name: "Dr. Varinder Pal Singh",
    specialty: "Dental Surgery",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Mandibular Fracture Reduction & Surgical Extraction",
    contact_phone: "+91-191-2233445 (Ext: 227)"
  },
  {
    sno: 28,
    department: "Dental Surgery",
    doctor_name: "Dr. Amandeep Kour",
    specialty: "Dental Surgery",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Odontogenic Infection & Facial Space Abscess Drain",
    contact_phone: "+91-191-2233445 (Ext: 228)"
  },
  {
    sno: 29,
    department: "Dental Surgery",
    doctor_name: "Dr. Anuradha Arora",
    specialty: "Dental Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Paediatric Dental Trauma & Conservative Care",
    contact_phone: "+91-191-2233445 (Ext: 229)"
  },

  // 7. Dermatology (3)
  {
    sno: 30,
    department: "Dermatology",
    doctor_name: "Dr. Ennakshe Sharma",
    specialty: "Dermatology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Severe Drug Eruptions & SJS/TEN Emergency Lead",
    contact_phone: "+91-191-2233445 (Ext: 230)"
  },
  {
    sno: 31,
    department: "Dermatology",
    doctor_name: "Dr. Irfan Ahmed",
    specialty: "Dermatology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Angioedema & Autoimmune Blistering Disease",
    contact_phone: "+91-191-2233445 (Ext: 231)"
  },
  {
    sno: 32,
    department: "Dermatology",
    doctor_name: "Dr. Ananya Sambyal",
    specialty: "Dermatology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Dermato-Infectious Emergencies & Erythroderma",
    contact_phone: "+91-191-2233445 (Ext: 232)"
  },

  // 8. Emergency (1)
  {
    sno: 33,
    department: "Emergency",
    doctor_name: "Dr. Anandhi Gandotra",
    specialty: "Emergency Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Emergency Resuscitation Unit & Level-1 Triage Chief",
    contact_phone: "+91-191-2233445 (Ext: 233)"
  },

  // 9. Forensic Medicine & Toxicology (1)
  {
    sno: 34,
    department: "Forensic Medicine & Toxicology",
    doctor_name: "Dr. C. S. Gupta",
    specialty: "Forensic Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Clinical Toxicology & Medico-legal Emergency Lead",
    contact_phone: "+91-191-2233445 (Ext: 234)"
  },

  // 10. Gastroenterology (1)
  {
    sno: 35,
    department: "Gastroenterology",
    doctor_name: "Dr. Ankush Sharma",
    specialty: "Gastroenterology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute GI Bleed & Emergency Therapeutic Endoscopy Lead",
    contact_phone: "+91-191-2233445 (Ext: 235)"
  },

  // 11. General Medicine (11)
  {
    sno: 36,
    department: "General Medicine",
    doctor_name: "Dr. Puneeta Gupta",
    specialty: "Internal Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Medical Admissions & Resuscitation Triage Lead",
    contact_phone: "+91-191-2233445 (Ext: 236)"
  },
  {
    sno: 37,
    department: "General Medicine",
    doctor_name: "Dr. Vikram Sharma",
    specialty: "Internal Medicine",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Severe Sepsis Protocol & Diabetic Ketoacidosis Lead",
    contact_phone: "+91-191-2233445 (Ext: 237)"
  },
  {
    sno: 38,
    department: "General Medicine",
    doctor_name: "Dr. Sidharth Kapoor",
    specialty: "Internal Medicine",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Emergency Medical On-Call & Cardiogenic Shock",
    contact_phone: "+91-191-2233445 (Ext: 238)"
  },
  {
    sno: 39,
    department: "General Medicine",
    doctor_name: "Dr. Vinu Jamwal",
    specialty: "Internal Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Hypertensive Crisis & Acute Heart Failure Specialist",
    contact_phone: "+91-191-2233445 (Ext: 239)"
  },
  {
    sno: 40,
    department: "General Medicine",
    doctor_name: "Dr. Sanjay Bhat",
    specialty: "Internal Medicine",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Infectious Disease Triage & Fever of Unknown Origin",
    contact_phone: "+91-191-2233445 (Ext: 240)"
  },
  {
    sno: 41,
    department: "General Medicine",
    doctor_name: "Dr. Abhinav Gupta",
    specialty: "Internal Medicine",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Medical ICU & Critical Vent Support",
    contact_phone: "+91-191-2233445 (Ext: 241)"
  },
  {
    sno: 42,
    department: "General Medicine",
    doctor_name: "Dr. Prabhjeet Kour",
    specialty: "Internal Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Acute Metabolic & Severe Electrolyte Derangement",
    contact_phone: "+91-191-2233445 (Ext: 242)"
  },
  {
    sno: 43,
    department: "General Medicine",
    doctor_name: "Dr. Supinder Singh",
    specialty: "Internal Medicine",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Geriatric Medical Emergencies & Acute Toxicology",
    contact_phone: "+91-191-2233445 (Ext: 243)"
  },
  {
    sno: 44,
    department: "General Medicine",
    doctor_name: "Dr. Rakesh Koul",
    specialty: "Internal Medicine",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Acute Neurological & Stroke Medical Workup Lead",
    contact_phone: "+91-191-2233445 (Ext: 244)"
  },
  {
    sno: 45,
    department: "General Medicine",
    doctor_name: "Dr. Sunakshi Sharma",
    specialty: "Internal Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Acute Severe Asthma & COPD Exacerbation Lead",
    contact_phone: "+91-191-2233445 (Ext: 245)"
  },
  {
    sno: 46,
    department: "General Medicine",
    doctor_name: "Dr. Mohd Yaseen",
    specialty: "Internal Medicine",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Tropical Fevers, Dengue & Sepsis Interventions",
    contact_phone: "+91-191-2233445 (Ext: 246)"
  },

  // 12. General Surgery (7)
  {
    sno: 47,
    department: "General Surgery",
    doctor_name: "Dr. Gurpreet Singh",
    specialty: "General Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Abdomen & Emergency Exploratory Laparotomy Lead",
    contact_phone: "+91-191-2233445 (Ext: 247)"
  },
  {
    sno: 48,
    department: "General Surgery",
    doctor_name: "Dr. Harbinder Singh Bali",
    specialty: "General Surgery",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Gastrointestinal Perforation & Peritonitis Lead",
    contact_phone: "+91-191-2233445 (Ext: 248)"
  },
  {
    sno: 49,
    department: "General Surgery",
    doctor_name: "Dr. Samia Mohan",
    specialty: "General Surgery",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Emergency Polytrauma Surgery On-Call",
    contact_phone: "+91-191-2233445 (Ext: 249)"
  },
  {
    sno: 50,
    department: "General Surgery",
    doctor_name: "Dr. Owais Zargar",
    specialty: "General Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Emergency Vascular Clamping & Splenectomy Lead",
    contact_phone: "+91-191-2233445 (Ext: 250)"
  },
  {
    sno: 51,
    department: "General Surgery",
    doctor_name: "Dr. Virender Singh Sambyal",
    specialty: "General Surgery",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Strangulated Hernia & Acute Intestinal Obstruction",
    contact_phone: "+91-191-2233445 (Ext: 251)"
  },
  {
    sno: 52,
    department: "General Surgery",
    doctor_name: "Dr. Aseem Mahajan",
    specialty: "General Surgery",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Acute Appendicitis & Gallbladder Gangrene Repair",
    contact_phone: "+91-191-2233445 (Ext: 252)"
  },
  {
    sno: 53,
    department: "General Surgery",
    doctor_name: "Dr. Aayushi",
    specialty: "General Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Necrotizing Soft Tissue Infection & Burn Debridement",
    contact_phone: "+91-191-2233445 (Ext: 253)"
  },

  // 13. ENT (8)
  {
    sno: 54,
    department: "ENT",
    doctor_name: "Dr. Padam Singh Jamwal",
    specialty: "ENT",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Stridor & Foreign Body Airway Obstruction Lead",
    contact_phone: "+91-191-2233445 (Ext: 254)"
  },
  {
    sno: 55,
    department: "ENT",
    doctor_name: "Dr. Apurab Gupta",
    specialty: "ENT",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Severe Refractory Epistaxis & Posterior Packing Lead",
    contact_phone: "+91-191-2233445 (Ext: 255)"
  },
  {
    sno: 56,
    department: "ENT",
    doctor_name: "Dr. Chandpreet Kour",
    specialty: "ENT",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Peritonsillar & Retropharyngeal Abscess Drainage",
    contact_phone: "+91-191-2233445 (Ext: 256)"
  },
  {
    sno: 57,
    department: "ENT",
    doctor_name: "Dr. Mohit Goel",
    specialty: "ENT",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Acute Mastoiditis & Facial Nerve Decompression",
    contact_phone: "+91-191-2233445 (Ext: 257)"
  },
  {
    sno: 58,
    department: "ENT",
    doctor_name: "Dr. Iaichika Sethi",
    specialty: "ENT",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Emergency Surgical Tracheostomy & Laryngeal Trauma",
    contact_phone: "+91-191-2233445 (Ext: 258)"
  },
  {
    sno: 59,
    department: "ENT",
    doctor_name: "Dr. Navneet Gupta",
    specialty: "Speech and Hearing / ENT-related",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Audiovestibular Emergency & Sudden Sensorineural Loss",
    contact_phone: "+91-191-2233445 (Ext: 259)"
  },
  {
    sno: 60,
    department: "ENT",
    doctor_name: "Dr. Priyanka Mahajan",
    specialty: "ENT",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight ENT Emergency Triage & Temporal Trauma",
    contact_phone: "+91-191-2233445 (Ext: 260)"
  },
  {
    sno: 61,
    department: "ENT",
    doctor_name: "Dr. Pallavi Saroch",
    specialty: "ENT",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Rigid Esophagoscopy & Bronchoscopic Extraction Lead",
    contact_phone: "+91-191-2233445 (Ext: 261)"
  },

  // 14. Microbiology (7)
  {
    sno: 62,
    department: "Microbiology",
    doctor_name: "Dr. Bella Mahajan",
    specialty: "Medical Microbiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Stat Blood Culture & Emergency Sepsis Diagnostics Lead",
    contact_phone: "+91-191-2233445 (Ext: 262)"
  },
  {
    sno: 63,
    department: "Microbiology",
    doctor_name: "Dr. Dipender Kaur Najotra",
    specialty: "Medical Microbiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "CSF Pathogen Identification & Antimicrobial Resistance",
    contact_phone: "+91-191-2233445 (Ext: 263)"
  },
  {
    sno: 64,
    department: "Microbiology",
    doctor_name: "Dr. Jyoti Kohli",
    specialty: "Medical Microbiology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Rapid Gram Stain & Emergency Biological Triage",
    contact_phone: "+91-191-2233445 (Ext: 264)"
  },
  {
    sno: 65,
    department: "Microbiology",
    doctor_name: "Dr. Sarika Ghai",
    specialty: "Medical Microbiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Hospital Outbreak & Nosocomial Surveillance Lead",
    contact_phone: "+91-191-2233445 (Ext: 265)"
  },
  {
    sno: 66,
    department: "Microbiology",
    doctor_name: "Dr. Lubna Samad",
    specialty: "Medical Microbiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Emergency Parasitology & Severe Malaria Diagnostics",
    contact_phone: "+91-191-2233445 (Ext: 266)"
  },
  {
    sno: 67,
    department: "Microbiology",
    doctor_name: "Mrs. Poonam Slathia",
    specialty: "Medical Microbiology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Molecular PCR Testing & Rapid Microbial Detection",
    contact_phone: "+91-191-2233445 (Ext: 267)"
  },
  {
    sno: 68,
    department: "Microbiology",
    doctor_name: "Dr. Shivani Raina",
    specialty: "Medical Microbiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Emergency Serology, Dengue & Leptospirosis Screening",
    contact_phone: "+91-191-2233445 (Ext: 268)"
  },

  // 15. Obstetrics & Gynaecology (4)
  {
    sno: 69,
    department: "Obstetrics & Gynaecology",
    doctor_name: "Dr. Sandeep Kour",
    specialty: "Obstetrics and Gynaecology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Severe Eclampsia & Emergency Caesarean Section Lead",
    contact_phone: "+91-191-2233445 (Ext: 269)"
  },
  {
    sno: 70,
    department: "Obstetrics & Gynaecology",
    doctor_name: "Dr. Farhana Yaqoob",
    specialty: "Obstetrics and Gynaecology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Postpartum Haemorrhage (PPH) & Ruptured Ectopic Lead",
    contact_phone: "+91-191-2233445 (Ext: 270)"
  },
  {
    sno: 71,
    department: "Obstetrics & Gynaecology",
    doctor_name: "Dr. Narita Jamwal",
    specialty: "Obstetrics and Gynaecology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Obstructed Labour & Acute Foetal Distress On-Call",
    contact_phone: "+91-191-2233445 (Ext: 271)"
  },
  {
    sno: 72,
    department: "Obstetrics & Gynaecology",
    doctor_name: "Dr. Gagandeep Kour",
    specialty: "Obstetrics and Gynaecology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "High-Risk Pregnancy & Antepartum Haemorrhage Care",
    contact_phone: "+91-191-2233445 (Ext: 272)"
  },

  // 16. Ophthalmology (5)
  {
    sno: 73,
    department: "Ophthalmology",
    doctor_name: "Dr. Renu Hashia",
    specialty: "Ophthalmology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Chemical Eye Burns & Penetrating Ocular Trauma Lead",
    contact_phone: "+91-191-2233445 (Ext: 273)"
  },
  {
    sno: 74,
    department: "Ophthalmology",
    doctor_name: "Dr. Chandni Arora",
    specialty: "Ophthalmology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Angle-Closure Glaucoma & IOP Decompression",
    contact_phone: "+91-191-2233445 (Ext: 274)"
  },
  {
    sno: 75,
    department: "Ophthalmology",
    doctor_name: "Dr. Rushali Gupta",
    specialty: "Ophthalmology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Ocular Trauma & Severe Corneal Ulcer Care",
    contact_phone: "+91-191-2233445 (Ext: 275)"
  },
  {
    sno: 76,
    department: "Ophthalmology",
    doctor_name: "Dr. Surbhi Gupta",
    specialty: "Ophthalmology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Traumatic Hyphema & Open Globe Microsurgical Repair",
    contact_phone: "+91-191-2233445 (Ext: 276)"
  },
  {
    sno: 77,
    department: "Ophthalmology",
    doctor_name: "Dr. Poonam Sharma",
    specialty: "Ophthalmology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Endophthalmitis & Orbital Cellulitis Lead",
    contact_phone: "+91-191-2233445 (Ext: 277)"
  },

  // 17. Orthopaedics (5)
  {
    sno: 78,
    department: "Orthopaedics",
    doctor_name: "Dr. Rajesh Kumar Gupta",
    specialty: "Orthopaedics",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Open Polytrauma Fractures & External Fixation Chief",
    contact_phone: "+91-191-2233445 (Ext: 278)"
  },
  {
    sno: 79,
    department: "Orthopaedics",
    doctor_name: "Dr. Sumeet Singh Charak",
    specialty: "Orthopaedics",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Compartment Syndrome & Pelvic Binder Specialist",
    contact_phone: "+91-191-2233445 (Ext: 279)"
  },
  {
    sno: 80,
    department: "Orthopaedics",
    doctor_name: "Dr. Anitipal Singh Raina",
    specialty: "Orthopaedics",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Fracture Closed Reduction & Splinting",
    contact_phone: "+91-191-2233445 (Ext: 280)"
  },
  {
    sno: 81,
    department: "Orthopaedics",
    doctor_name: "Dr. Pallav Gupta",
    specialty: "Orthopaedics",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Spinal Cord Trauma & Emergency Cervical Stabilization",
    contact_phone: "+91-191-2233445 (Ext: 281)"
  },
  {
    sno: 82,
    department: "Orthopaedics",
    doctor_name: "Dr. Shafiq Hackla",
    specialty: "Orthopaedics",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Septic Joint Debridement & Paediatric Physeal Trauma",
    contact_phone: "+91-191-2233445 (Ext: 282)"
  },

  // 18. Paediatrics (8)
  {
    sno: 83,
    department: "Paediatrics",
    doctor_name: "Dr. Manoj Sharma",
    specialty: "Paediatrics",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Pediatric Advanced Life Support (PALS) & Shock Lead",
    contact_phone: "+91-191-2233445 (Ext: 283)"
  },
  {
    sno: 84,
    department: "Paediatrics",
    doctor_name: "Dr. Ramesh Khajuria",
    specialty: "Paediatrics",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Severe Dehydration, Sepsis & Pediatric Resuscitation",
    contact_phone: "+91-191-2233445 (Ext: 284)"
  },
  {
    sno: 85,
    department: "Paediatrics",
    doctor_name: "Dr. Vikas Mahajan",
    specialty: "Paediatrics",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Acute Pediatric Respiratory Failure & Croup Management",
    contact_phone: "+91-191-2233445 (Ext: 285)"
  },
  {
    sno: 86,
    department: "Paediatrics",
    doctor_name: "Dr. Sushil Sharma",
    specialty: "Paediatrics / Neonatology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Neonatal Resuscitation & Extreme Prematurity ICU Lead",
    contact_phone: "+91-191-2233445 (Ext: 286)"
  },
  {
    sno: 87,
    department: "Paediatrics",
    doctor_name: "Dr. Ifra Rasool",
    specialty: "Paediatrics",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Pediatric Ingestion, Poisoning & Anaphylaxis Care",
    contact_phone: "+91-191-2233445 (Ext: 287)"
  },
  {
    sno: 88,
    department: "Paediatrics",
    doctor_name: "Dr. Vikas Sharma",
    specialty: "Paediatrics",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight PICU / NICU Critical Monitoring On-Call",
    contact_phone: "+91-191-2233445 (Ext: 288)"
  },
  {
    sno: 89,
    department: "Paediatrics",
    doctor_name: "Dr. Shaurya Pratab",
    specialty: "Paediatrics",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Congenital Cardiac Emergency & Cyanotic Spell Care",
    contact_phone: "+91-191-2233445 (Ext: 289)"
  },
  {
    sno: 90,
    department: "Paediatrics",
    doctor_name: "Dr. Akshdeep Kour",
    specialty: "Paediatrics",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Pediatric Meningitis & Status Epilepticus Protocols",
    contact_phone: "+91-191-2233445 (Ext: 290)"
  },

  // 19. Pathology (9)
  {
    sno: 91,
    department: "Pathology",
    doctor_name: "Dr. Aneeta Singh",
    specialty: "Pathology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Stat Emergency Frozen Section & Tissue Pathology Lead",
    contact_phone: "+91-191-2233445 (Ext: 291)"
  },
  {
    sno: 92,
    department: "Pathology",
    doctor_name: "Dr. Bawana Raina",
    specialty: "Pathology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Acute Leukemic Workup & Hematological Emergencies",
    contact_phone: "+91-191-2233445 (Ext: 292)"
  },
  {
    sno: 93,
    department: "Pathology",
    doctor_name: "Dr. Anuja Sharma",
    specialty: "Pathology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Disseminated Intravascular Coagulation (DIC) Screening",
    contact_phone: "+91-191-2233445 (Ext: 293)"
  },
  {
    sno: 94,
    department: "Pathology",
    doctor_name: "Dr. Archana Gupta",
    specialty: "Pathology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Emergency Fluid Cytology & Serous Effusion Diagnostics",
    contact_phone: "+91-191-2233445 (Ext: 294)"
  },
  {
    sno: 95,
    department: "Pathology",
    doctor_name: "Dr. Swati Gupta",
    specialty: "Pathology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Immuno-histochemistry & Urgent Oncopathology",
    contact_phone: "+91-191-2233445 (Ext: 295)"
  },
  {
    sno: 96,
    department: "Pathology",
    doctor_name: "Dr. Nitin Gupta",
    specialty: "Pathology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Peripheral Blood Smear & Toxic Granularity Check",
    contact_phone: "+91-191-2233445 (Ext: 296)"
  },
  {
    sno: 97,
    department: "Pathology",
    doctor_name: "Dr. Shalija Kotwal",
    specialty: "Pathology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Clinical Microscopy & Emergency Urinalysis Sediment",
    contact_phone: "+91-191-2233445 (Ext: 297)"
  },
  {
    sno: 98,
    department: "Pathology",
    doctor_name: "Dr. Prableen Kour",
    specialty: "Pathology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Stat Thrombocyte & Automated Coagulation Profile",
    contact_phone: "+91-191-2233445 (Ext: 298)"
  },
  {
    sno: 99,
    department: "Pathology",
    doctor_name: "Dr. Urvashi Andotra",
    specialty: "Pathology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Clinical Pathology & Hemolysis Workup",
    contact_phone: "+91-191-2233445 (Ext: 299)"
  },

  // 20. Pharmacology (4)
  {
    sno: 100,
    department: "Pharmacology",
    doctor_name: "Dr. Archana Parihar",
    specialty: "Pharmacology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Adverse Drug Reaction (ADR) & Toxicovigilance Chief",
    contact_phone: "+91-191-2233445 (Ext: 300)"
  },
  {
    sno: 101,
    department: "Pharmacology",
    doctor_name: "Dr. Pavan Malhotra",
    specialty: "Pharmacology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Emergency Pharmacotherapy & Antidote Availability",
    contact_phone: "+91-191-2233445 (Ext: 301)"
  },
  {
    sno: 102,
    department: "Pharmacology",
    doctor_name: "Dr. Shivani Rani",
    specialty: "Pharmacology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Overnight Critical Care Drug Interactions & Dosing",
    contact_phone: "+91-191-2233445 (Ext: 302)"
  },
  {
    sno: 103,
    department: "Pharmacology",
    doctor_name: "Mrs. Srishti Mantoo",
    specialty: "Medical Pharmacology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Therapeutic Drug Monitoring (TDM) & Patient Safety",
    contact_phone: "+91-191-2233445 (Ext: 303)"
  },

  // 21. Physiology (5)
  {
    sno: 104,
    department: "Physiology",
    doctor_name: "Dr. Geetika Gupta",
    specialty: "Physiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Neurophysiology, Evoked Potentials & Autonomic Lead",
    contact_phone: "+91-191-2233445 (Ext: 304)"
  },
  {
    sno: 105,
    department: "Physiology",
    doctor_name: "Dr. Sunil Sachdev",
    specialty: "Physiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Pulmonary Function Mechanics & Exercise Physiology",
    contact_phone: "+91-191-2233445 (Ext: 305)"
  },
  {
    sno: 106,
    department: "Physiology",
    doctor_name: "Dr. Kasturi Lal Gupta",
    specialty: "Physiology",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Cardiovascular Autonomic Reflexes & Syncope Study",
    contact_phone: "+91-191-2233445 (Ext: 306)"
  },
  {
    sno: 107,
    department: "Physiology",
    doctor_name: "Dr. Navneet Kour",
    specialty: "Physiology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: false,
    duty_notes: "Electromyography (EMG) & Nerve Conduction Studies",
    contact_phone: "+91-191-2233445 (Ext: 307)"
  },
  {
    sno: 108,
    department: "Physiology",
    doctor_name: "Dr. Saima Chowdhary",
    specialty: "Physiology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Polysomnography & Sleep Apnoea Diagnostic Lead",
    contact_phone: "+91-191-2233445 (Ext: 308)"
  },

  // 22. Plastic Surgery (2)
  {
    sno: 109,
    department: "Plastic Surgery",
    doctor_name: "Dr. Jharna Verma",
    specialty: "Plastic Surgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Major Burn Debridement & Emergency Microvascular Flap",
    contact_phone: "+91-191-2233445 (Ext: 309)"
  },
  {
    sno: 110,
    department: "Plastic Surgery",
    doctor_name: "Dr. Maneesh Kumar Sharma",
    specialty: "Plastic Surgery",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Complex Facial Laceration & Hand Tendon Repair Lead",
    contact_phone: "+91-191-2233445 (Ext: 310)"
  },

  // 23. Psychiatry (3)
  {
    sno: 111,
    department: "Psychiatry",
    doctor_name: "Dr. Manmeet Singh",
    specialty: "Psychiatry",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Psychosis, Agitation & Crisis Intervention Lead",
    contact_phone: "+91-191-2233445 (Ext: 311)"
  },
  {
    sno: 112,
    department: "Psychiatry",
    doctor_name: "Dr. Rohit Jasrotia",
    specialty: "Psychiatry",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Severe Depressive Crisis & Suicidology Assessment",
    contact_phone: "+91-191-2233445 (Ext: 312)"
  },
  {
    sno: 113,
    department: "Psychiatry",
    doctor_name: "Dr. Parul Gupta",
    specialty: "Psychiatry",
    shift: "Night (00:00 - 08:00)",
    on_duty: false,
    duty_notes: "Acute Delirium, Catatonia & Substance Withdrawal",
    contact_phone: "+91-191-2233445 (Ext: 313)"
  },

  // 24. Neurosurgery (1)
  {
    sno: 114,
    department: "Neurosurgery",
    doctor_name: "Dr. Bhavuk Kapoor",
    specialty: "Neurosurgery",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Traumatic Brain Injury & Emergency Craniotomy Lead",
    contact_phone: "+91-191-2233445 (Ext: 314)"
  },

  // 25. Urology (2)
  {
    sno: 115,
    department: "Urology",
    doctor_name: "Dr. Ravinder Singh Ghai",
    specialty: "Urology",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Urinary Obstruction & Renal Trauma Emergency Lead",
    contact_phone: "+91-191-2233445 (Ext: 315)"
  },
  {
    sno: 116,
    department: "Urology",
    doctor_name: "Dr. Ranjeet Singh Rathore",
    specialty: "Urology",
    shift: "Evening (16:00 - 00:00)",
    on_duty: false,
    duty_notes: "Testicular Torsion, Urethral Rupture & Stenting",
    contact_phone: "+91-191-2233445 (Ext: 316)"
  },

  // 26. Dialysis (1)
  {
    sno: 117,
    department: "Dialysis",
    doctor_name: "Dr. Anoop Tandon",
    specialty: "Dialysis / General Medicine",
    shift: "Morning (08:00 - 16:00)",
    on_duty: true,
    duty_notes: "Acute Kidney Injury (AKI) & Emergent Hemodialysis Lead",
    contact_phone: "+91-191-2233445 (Ext: 317)"
  }
];

async function migrate() {
  console.log("=========================================================");
  console.log(" MedLink: Migrating ASCOMS Jammu Equipment, Beds & 117 Doctors");
  console.log("=========================================================\n");

  const client = await db.pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Verify ASCOMS Hospital Existence
    const hospRes = await client.query(
      `SELECT id, name FROM hospitals WHERE id = $1`,
      [ASCOMS_HOSPITAL_ID]
    );
    if (!hospRes.rowCount) {
      throw new Error(`Hospital ID ${ASCOMS_HOSPITAL_ID} (ASCOMS) not found in database.`);
    }
    console.log(`Found target hospital: [ID: ${hospRes.rows[0].id}] ${hospRes.rows[0].name}`);

    // 2. Clear old placeholder resources and specialists for ASCOMS
    await client.query(`DELETE FROM hospital_resources WHERE hospital_id = $1`, [ASCOMS_HOSPITAL_ID]);
    await client.query(`DELETE FROM hospital_specialists WHERE hospital_id = $1`, [ASCOMS_HOSPITAL_ID]);
    console.log("Cleared previous placeholder resources and specialists for ASCOMS.");

    // 3. Insert 15 Equipment & Bed Categories
    console.log(`\n1. Seeding ${ASCOMS_RESOURCES.length} equipment and bed categories for ASCOMS...`);
    for (const res of ASCOMS_RESOURCES) {
      await client.query(
        `INSERT INTO hospital_resources
          (hospital_id, resource_type, total_quantity, available_quantity, status, notes, updated_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          ASCOMS_HOSPITAL_ID,
          res.resource_type,
          res.total_quantity,
          res.available_quantity,
          res.status,
          res.notes
        ]
      );
    }
    console.log(`✅ Successfully inserted all ${ASCOMS_RESOURCES.length} equipment & bed capacities.`);

    // 4. Insert 117 Specialist Doctors across 26 Clinical Departments
    console.log(`\n2. Seeding all ${ASCOMS_DOCTORS.length} faculty doctors with 24/7 rotational duty roster...`);
    for (const doc of ASCOMS_DOCTORS) {
      await client.query(
        `INSERT INTO hospital_specialists
          (hospital_id, doctor_name, department, specialty, shift, on_duty, available, count_available, duty_notes, contact_phone, updated_at)
         VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          ASCOMS_HOSPITAL_ID,
          doc.doctor_name,
          doc.department,
          doc.specialty,
          doc.shift,
          doc.on_duty,
          doc.on_duty, // available matches on_duty
          doc.on_duty ? 1 : 0,
          doc.duty_notes,
          doc.contact_phone
        ]
      );
    }
    console.log(`✅ Successfully seeded all ${ASCOMS_DOCTORS.length} faculty doctors.`);

    await client.query("COMMIT");

    // 5. Query and output validation summary
    const resSummary = await db.query(
      `SELECT resource_type, total_quantity, available_quantity FROM hospital_resources WHERE hospital_id = $1 ORDER BY id`,
      [ASCOMS_HOSPITAL_ID]
    );
    console.log("\n--- ASCOMS Equipment & Bed Summary ---");
    console.table(resSummary.rows);

    const docSummary = await db.query(
      `SELECT department, COUNT(*) as total_doctors, SUM(CASE WHEN on_duty THEN 1 ELSE 0 END) as on_duty_doctors
       FROM hospital_specialists
       WHERE hospital_id = $1
       GROUP BY department
       ORDER BY department`,
      [ASCOMS_HOSPITAL_ID]
    );
    console.log("\n--- ASCOMS Faculty Doctors by Department & On-Duty Status ---");
    console.table(docSummary.rows);

    const totalStats = await db.query(
      `SELECT COUNT(*) as total_doctors, SUM(CASE WHEN on_duty THEN 1 ELSE 0 END) as on_duty_count
       FROM hospital_specialists
       WHERE hospital_id = $1`,
      [ASCOMS_HOSPITAL_ID]
    );
    console.log("Overall ASCOMS Roster:", totalStats.rows[0]);

    console.log("\n🎉 ASCOMS Jammu migration completed successfully!");
    process.exit(0);

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed with error:", err);
    process.exit(1);
  } finally {
    client.release();
  }
}

migrate();
