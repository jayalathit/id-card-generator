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
  photo?: string; // Data URL while editing or signed Storage URL after loading
  photoPath?: string; // Private Supabase Storage object path
  signatureType: 'handwritten' | 'typed' | 'uploaded';
  signatureText?: string; // If typed
  signatureImage?: string; // Data URL while editing or signed Storage URL after loading
  signaturePath?: string; // Private Supabase Storage object path
  cardDesignation?: 'student' | 'operator'; // 'student' or 'operator'
  equipmentType?: 'forklift' | 'backhoe'; // 'forklift' or 'backhoe'
  equipmentClass?: string; // "Counterbalance Forklift / Class A" or "JCB Backhoe Loader / Class A"
}

export type TemplateSurface = 'student-front' | 'student-back' | 'operator-front' | 'operator-back';
export type CanvasElementKind = 'builtin' | 'text' | 'rectangle' | 'circle';

export interface CanvasElement {
  id: string;
  surface: TemplateSurface;
  name: string;
  kind: CanvasElementKind;
  x: number;
  y: number;
  width?: number;
  height?: number;
  rotation: number;
  scale: number;
  opacity: number;
  zIndex: number;
  hidden?: boolean;
  text?: string;
  fontSize?: number;
  color?: string;
  fill?: string;
  borderColor?: string;
}

export interface TemplateDetails {
  leftMainHeader: string;
  leftSubHeader: string;
  rightMainHeader: string;
  rightSubHeader: string;
  validityYears: number;
  backVerificationUrl: string;
  backAddress: string;
  backContactPhone: string;
  backContactEmail: string;
  backLogoLabel: string;
}

export interface CardConfig {
  institutionLogo?: string; // Signed Storage URL for a custom header logo
  institutionLogoPath?: string; // Private Supabase Storage object path
  adminSignatureText: string; // Default signature shown on student ID cards
  adminSignatureImage?: string; // Data URL or signed Storage URL for student admin signature
  adminSignaturePath?: string; // Private Supabase Storage object path
  leftMainHeader: string; // "JAYALATH CAMPUS"
  leftSubHeader: string; // "CAREER EDUCATION & TRAINING INSTITUTE"
  rightMainHeader: string; // "OFFICIAL ID"
  rightSubHeader: string; // "CREDENTIAL"
  
  validityYears: number; // 2 by default
  backVerificationUrl: string; // "jceti.com/verification"
  backAddress: string; // "Jayalath Campus\nNo. 123, Training Road,\nKandana, Sri Lanka."
  backContactPhone: string; // Primary telephone
  backContactEmail: string; // Secondary telephone retained in legacy database column
  backLogoLabel: string; // "JAYALATH CAMPUS"
  primaryColor: string;
  accentColor: string;
  canvasElements: CanvasElement[];
  studentDetails: TemplateDetails;
  operatorDetails: TemplateDetails;
}
