/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Student {
  id: string; // Internal state ID
  nic: string;
  name: string;
  idNumber: string;
  grade: string;
  course: string;
  issueDate: string;
  trainingCenter: string;
  photo?: string; // Data URL or placeholder
  signatureType: 'handwritten' | 'typed' | 'uploaded';
  signatureText?: string; // If typed
  signatureImage?: string; // If handwritten or uploaded (Data URL)
  cardDesignation?: 'student' | 'operator'; // 'student' or 'operator'
  equipmentType?: 'forklift' | 'backhoe'; // 'forklift' or 'backhoe'
  equipmentClass?: string; // "Counterbalance Forklift / Class A" or "JCB Backhoe Loader / Class A"
}

export interface CardConfig {
  institutionLogo?: string; // Custom header logo
  leftMainHeader: string; // "JAYALATH"
  leftSubHeader: string; // "CAMPUS FOR CONSTRUCTION & INDUSTRIAL TRAINING CENTER"
  rightMainHeader: string; // "GLOBAL SKILLS"
  rightSubHeader: string; // "INSTITUTE"
  
  validityYears: number; // 2 by default
  backVerificationUrl: string; // "www.globalskills.lk/verify"
  backAddress: string; // "Global Skills Institute\nNo. 123, Skills Avenue,\nColombo 07, Sri Lanka."
  backContactPhone: string; // "+94 XX XXX XXXX"
  backContactEmail: string; // "info@globalskills.lk"
  backLogoLabel: string; // "FAUGET HIGH SCHOOL" or empty to stick to Global Skills
}
