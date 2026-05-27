/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Student, CardConfig, CanvasElement, TemplateSurface } from './types';
import { IDCard } from './components/IDCard';
import { SignaturePad } from './components/SignaturePad';
import { downloadIDCardPDF } from './utils/pdfGenerator';
import { deleteStudent, loadWorkspaceData, saveCardConfig, saveStudent } from './services/idCardRepository';
import { supabase } from './lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Check, Edit2, Trash2, Plus, Download, Grid, Settings, Users, Upload, RefreshCw, LogOut, Loader2, Save, Square, Type, Eye, EyeOff } from 'lucide-react';
import { baseCanvasElement, surfaceFor, visibleLayers } from './designLayers';

type TrainingMethod = 'FC' | 'TT' | 'GAP';

const MAIN_FIELD_OPTIONS = [
  { code: 'HMA', label: 'Heavy Machinery', enabled: true },
  { code: 'HCA', label: 'Health Care (courses coming soon)', enabled: false }
];

function specialtyCode(equipmentType: 'forklift' | 'backhoe'): string {
  return equipmentType === 'forklift' ? 'FL' : 'BL';
}

function generatedCredentialId(
  mainField: string,
  equipmentType: 'forklift' | 'backhoe',
  method: TrainingMethod,
  year: string,
  serial: string
): string {
  return `${mainField}/${specialtyCode(equipmentType)}/${method}/${year}/${serial}`;
}

function parseCredentialId(idNumber: string): { mainField: string; method: TrainingMethod; year: string; serial: string } {
  const match = idNumber.match(/^([A-Z]+)\/(?:FL|BL)\/(FC|TT|GAP)\/(\d{4})\/(\d{6})$/i);
  if (match) {
    return { mainField: match[1].toUpperCase(), method: match[2].toUpperCase() as TrainingMethod, year: match[3], serial: match[4] };
  }
  const legacy = idNumber.match(/(?:^|\D)(\d{4})(?:\D+)(\d{1,6})$/);
  return {
    mainField: 'HMA',
    method: 'FC',
    year: legacy?.[1] || '2026',
    serial: (legacy?.[2] || '1').padStart(6, '0')
  };
}

const INITIAL_STUDENTS: Student[] = [
  {
    id: 'student-1',
    nic: '123456789V',
    name: 'John Perera',
    idNumber: 'HMA/FL/FC/2026/000001',
    grade: '',
    course: 'Forklift Operator Training',
    issueDate: '25/05/2026',
    trainingCenter: 'Jayalath Campus',
    signatureType: 'typed',
    signatureText: 'Admin Department',
    cardDesignation: 'student',
    equipmentType: 'forklift',
    equipmentClass: 'Counterbalance Forklift / Class A'
  },
  {
    id: 'student-2',
    nic: '199524589V',
    name: 'Sanduni Jayasekara',
    idNumber: 'HMA/BL/FC/2026/000002',
    grade: '',
    course: 'Backhoe Loader Operator Training',
    issueDate: '26/05/2026',
    trainingCenter: 'Jayalath Campus',
    signatureType: 'typed',
    signatureText: 'Admin Department',
    cardDesignation: 'student',
    equipmentType: 'backhoe',
    equipmentClass: 'JCB Backhoe Loader / Class A'
  },
  {
    id: 'student-3',
    nic: '198948123V',
    name: 'Chamara Silva',
    idNumber: 'HMA/FL/TT/2026/000003',
    grade: 'B',
    course: 'Forklift Operator Certification',
    issueDate: '24/05/2026',
    trainingCenter: 'Jayalath Campus',
    signatureType: 'typed',
    signatureText: 'Admin Department',
    cardDesignation: 'operator',
    equipmentType: 'forklift',
    equipmentClass: 'Counterbalance Forklift / Class A'
  }
];

const INITIAL_CONFIG: CardConfig = {
  adminSignatureText: 'Admin Department',
  leftMainHeader: 'JAYALATH CAMPUS',
  leftSubHeader: 'Career Education & Training Institute',
  rightMainHeader: 'OFFICIAL ID',
  rightSubHeader: 'CREDENTIAL',
  validityYears: 2,
  backVerificationUrl: 'jceti.com/verification',
  backAddress: 'Jayalath Campus\nNo. 123, Training Road,\nKandana, Western Province, Sri Lanka.',
  backContactPhone: '070 2 503 503',
  backContactEmail: '011 7 503 503',
  backLogoLabel: 'JAYALATH CAMPUS',
  primaryColor: '#0c2340',
  accentColor: '#e2a812',
  canvasElements: []
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown Supabase error.';
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [config, setConfig] = useState<CardConfig>(INITIAL_CONFIG);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configNotice, setConfigNotice] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState<'students' | 'config'>('students');
  const [isEditing, setIsEditing] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [viewMode, setViewMode] = useState<'both' | 'front' | 'back'>('both');
  const [editingSide, setEditingSide] = useState<'front' | 'back'>('front');
  const [selectedCanvasLayer, setSelectedCanvasLayer] = useState<{ surface: TemplateSurface; id: string } | null>(null);

  // Form states
  const [formNic, setFormNic] = useState('');
  const [formName, setFormName] = useState('');
  const [formGrade, setFormGrade] = useState('A');
  const [formCourse, setFormCourse] = useState('Forklift Operator Training');
  const [formIssueDate, setFormIssueDate] = useState('25/05/2026');
  const [formTrainingCenter, setFormTrainingCenter] = useState('Jayalath Campus');
  const [formPhoto, setFormPhoto] = useState<string | undefined>(undefined);
  const [formPhotoPath, setFormPhotoPath] = useState<string | undefined>(undefined);
  const [formSigType, setFormSigType] = useState<'handwritten' | 'typed' | 'uploaded'>('typed');
  const [formSigText, setFormSigText] = useState('');
  const [formSigImg, setFormSigImg] = useState<string | undefined>(undefined);
  const [formSigPath, setFormSigPath] = useState<string | undefined>(undefined);

  // Added selectors for multi-equipment & multi-mode designs
  const [formCardDesignation, setFormCardDesignation] = useState<'student' | 'operator'>('student');
  const [formEquipmentType, setFormEquipmentType] = useState<'forklift' | 'backhoe'>('forklift');
  const [formEquipmentClass, setFormEquipmentClass] = useState('Counterbalance Forklift / Class A');
  const [formMainField, setFormMainField] = useState('HMA');
  const [formTrainingMethod, setFormTrainingMethod] = useState<TrainingMethod>('FC');
  const [formIdYear, setFormIdYear] = useState('2026');
  const [formSerial, setFormSerial] = useState('000001');
  const [formStudentLookupId, setFormStudentLookupId] = useState('');
  const [operatorLookupMessage, setOperatorLookupMessage] = useState('');
  const [linkedStudentId, setLinkedStudentId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsAuthLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setStudents([]);
      setSelectedStudentId('');
      return;
    }

    const loadData = async () => {
      setIsLoadingData(true);
      setDataError('');
      try {
        const workspace = await loadWorkspaceData(INITIAL_CONFIG);
        setStudents(workspace.students);
        setConfig(workspace.config);
        setSelectedStudentId((current) => (
          workspace.students.some((student) => student.id === current)
            ? current
            : (workspace.students[0]?.id || '')
        ));
      } catch (error) {
        console.error('Failed to load Supabase data:', error);
        setDataError(`Unable to load Supabase records: ${errorMessage(error)}`);
      } finally {
        setIsLoadingData(false);
      }
    };

    void loadData();
  }, [session]);

  const selectedStudent = students.find((s) => s.id === selectedStudentId) || students[0];
  const generatedIdNumber = generatedCredentialId(formMainField, formEquipmentType, formTrainingMethod, formIdYear, formSerial);

  const previewStudent: Student = isEditing ? {
    id: editingStudentId || 'student-preview',
    nic: formNic || '199012345V',
    name: formName || 'John Perera',
    idNumber: generatedIdNumber,
    grade: formCardDesignation === 'operator' ? (formGrade || 'A') : '',
    course: formCourse || 'Forklift Operator Training',
    issueDate: formIssueDate || '25/05/2026',
    trainingCenter: formTrainingCenter || 'Jayalath Campus',
    photo: formPhoto,
    photoPath: formPhotoPath,
    signatureType: formCardDesignation === 'student' ? 'typed' : formSigType,
    signatureText: formCardDesignation === 'student'
      ? (config.adminSignatureText.trim() || 'Admin Department')
      : (formSigType === 'typed' ? (formSigText || 'Admin Department') : undefined),
    signatureImage: formCardDesignation === 'operator' && formSigType !== 'typed' ? formSigImg : undefined,
    signaturePath: formSigPath,
    cardDesignation: formCardDesignation,
    equipmentType: formEquipmentType,
    equipmentClass: formEquipmentClass
  } : (selectedStudent || INITIAL_STUDENTS[0]);
  const editingSurface = surfaceFor(previewStudent.cardDesignation, editingSide === 'back');
  const editingLayers = visibleLayers(config.canvasElements, editingSurface);
  const activeCanvasLayer = selectedCanvasLayer?.surface === editingSurface
    ? editingLayers.find((layer) => layer.id === selectedCanvasLayer.id)
    : undefined;
  const isOperatorPreview = previewStudent.cardDesignation === 'operator';
  const isExpandedPreview = isOperatorPreview && viewMode === 'both';

  // Helper to start adding a student
  const handleAddNewClick = () => {
    setEditingStudentId(null);
    setIsEditing(true);
    // Auto-generate realistic next ID code
    const highestSerial = students.reduce((max, student) => {
      const match = student.idNumber.match(/\/(\d{6})$/);
      return Math.max(max, match ? Number(match[1]) : 0);
    }, students.length);
    const paddedNum = String(highestSerial + 1).padStart(6, '0');
    
    setFormNic('');
    setFormName('');
    setFormStudentLookupId('');
    setOperatorLookupMessage('');
    setLinkedStudentId(null);
    
    // Default form configuration as student & forklift
    setFormCardDesignation('student');
    setFormEquipmentType('forklift');
    setFormMainField('HMA');
    setFormTrainingMethod('FC');
    setFormIdYear(String(new Date().getFullYear()));
    setFormSerial(paddedNum);
    setFormGrade('A');
    setFormCourse('Forklift Operator Training');
    setFormEquipmentClass('Counterbalance Forklift / Class A');
    
    // Set actual date formatted like 26/05/2026
    const today = new Date();
    const formattedDate = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
    setFormIssueDate(formattedDate);
    
    setFormTrainingCenter('Jayalath Campus');
    setFormPhoto(undefined);
    setFormPhotoPath(undefined);
    setFormSigType('typed');
    setFormSigText(config.adminSignatureText.trim() || 'Admin Department');
    setFormSigImg(undefined);
    setFormSigPath(undefined);
  };

  // Start editing existing student
  const handleEditClick = (student: Student) => {
    setEditingStudentId(student.id);
    setIsEditing(true);
    
    setFormNic(student.nic);
    setFormName(student.name);
    setFormStudentLookupId('');
    setOperatorLookupMessage('');
    setLinkedStudentId(null);
    setFormGrade(student.grade);
    setFormCourse(student.course);
    setFormIssueDate(student.issueDate);
    setFormTrainingCenter(student.trainingCenter);
    setFormPhoto(student.photo);
    setFormPhotoPath(student.photoPath);
    setFormSigType(student.signatureType);
    setFormSigText(student.signatureText || 'Admin Department');
    setFormSigImg(student.signatureImage);
    setFormSigPath(student.signaturePath);

    // Added selectors load
    setFormCardDesignation(student.cardDesignation || 'student');
    setFormEquipmentType(student.equipmentType || 'forklift');
    setFormEquipmentClass(student.equipmentClass || (student.equipmentType === 'backhoe' ? 'JCB Backhoe Loader / Class A' : 'Counterbalance Forklift / Class A'));
    const parsedId = parseCredentialId(student.idNumber);
    setFormMainField(parsedId.mainField);
    setFormTrainingMethod(parsedId.method);
    setFormIdYear(parsedId.year);
    setFormSerial(parsedId.serial);
  };

  const checkFormerStudentRecord = (nicValue = formNic) => {
    const normalizedNic = nicValue.trim().toLowerCase();
    if (!normalizedNic) {
      setLinkedStudentId(null);
      setOperatorLookupMessage('Enter the NIC number first to check for an existing trainee record.');
      return;
    }

    const formerStudent = students.find((student) => (
      student.cardDesignation !== 'operator'
      && student.nic.trim().toLowerCase() === normalizedNic
    ));
    if (!formerStudent) {
      setLinkedStudentId(null);
      setOperatorLookupMessage('No trainee record found for this NIC. Continue by entering the operator details manually.');
      return;
    }

    if (
      formStudentLookupId.trim()
      && formStudentLookupId.trim().toLowerCase() !== formerStudent.idNumber.trim().toLowerCase()
    ) {
      setLinkedStudentId(null);
      setOperatorLookupMessage('NIC found, but the student ID entered does not match the trainee record. Please check it again.');
      return;
    }

    const parsedStudentId = parseCredentialId(formerStudent.idNumber);
    const operatorEquipmentType = formerStudent.equipmentType || 'forklift';
    setLinkedStudentId(formerStudent.id);
    setFormStudentLookupId(formerStudent.idNumber);
    setFormName(formerStudent.name);
    setFormEquipmentType(operatorEquipmentType);
    setFormEquipmentClass(formerStudent.equipmentClass || (operatorEquipmentType === 'backhoe' ? 'JCB Backhoe Loader / Class A' : 'Counterbalance Forklift / Class A'));
    setFormMainField(parsedStudentId.mainField);
    setFormTrainingCenter(formerStudent.trainingCenter);
    setFormPhoto(formerStudent.photo);
    setFormPhotoPath(formerStudent.photoPath);
    setFormCourse(operatorEquipmentType === 'forklift' ? 'Forklift Operator Certification' : 'Backhoe Loader Operator Certification');
    setOperatorLookupMessage(`Verified trainee record: ${formerStudent.idNumber}. The operator form has been auto-filled.`);
  };

  // Handle Photo upload callback
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Please choose an image smaller than 5 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Handle signature upload callback
  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Please choose an image smaller than 5 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setFormSigImg(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleInstitutionLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) {
      alert('Please choose a PNG, JPG, or WebP logo smaller than 5 MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setConfig((previous) => ({ ...previous, institutionLogo: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  // Save Operator Record
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formNic.trim() || !generatedIdNumber.trim()) {
      alert('Please fill out Name, NIC, and ID Number.');
      return;
    }
    if (!/^\d{4}$/.test(formIdYear)) {
      alert('Please enter a four-digit issuing year.');
      return;
    }

    const normalizedNic = formNic.trim().toLowerCase();
    const normalizedIdNumber = generatedIdNumber.trim().toLowerCase();
    const matchingTrainee = formCardDesignation === 'operator'
      ? students.find((student) => (
        student.cardDesignation !== 'operator'
        && student.nic.trim().toLowerCase() === normalizedNic
      ))
      : undefined;
    if (matchingTrainee && linkedStudentId !== matchingTrainee.id) {
      alert('This NIC belongs to an existing trainee. Please confirm the Student ID using Check Trainee Record before issuing an operator card.');
      return;
    }
    const duplicateId = students.find((student) => (
      student.id !== editingStudentId
      && student.idNumber.trim().toLowerCase() === normalizedIdNumber
    ));
    const duplicateCategoryNic = students.find((student) => (
      student.id !== editingStudentId
      && (student.cardDesignation || 'student') === formCardDesignation
      && student.nic.trim().toLowerCase() === normalizedNic
    ));
    if (duplicateId || duplicateCategoryNic) {
      alert('Issued ID numbers must be unique, and a NIC may only have one card in each category.');
      return;
    }

    const updatedStudent: Student = {
      id: editingStudentId || `student-${Date.now()}`,
      nic: formNic,
      name: formName,
      idNumber: generatedIdNumber,
      grade: formCardDesignation === 'operator' ? formGrade : '',
      course: formCourse,
      issueDate: formIssueDate,
      trainingCenter: formTrainingCenter,
      photo: formPhoto,
      photoPath: formPhotoPath,
      signatureType: formCardDesignation === 'student' ? 'typed' : formSigType,
      signatureText: formCardDesignation === 'student'
        ? (config.adminSignatureText.trim() || 'Admin Department')
        : (formSigType === 'typed' ? (formSigText || 'Admin Department') : undefined),
      signatureImage: formCardDesignation === 'operator' && formSigType !== 'typed' ? formSigImg : undefined,
      signaturePath: formSigPath,
      cardDesignation: formCardDesignation,
      equipmentType: formEquipmentType,
      equipmentClass: formEquipmentClass
    };

    setIsSavingStudent(true);
    setDataError('');
    try {
      const storedStudent = await saveStudent(updatedStudent);
      if (editingStudentId) {
        setStudents((previous) => previous.map((student) => (
          student.id === editingStudentId ? storedStudent : student
        )));
      } else {
        setStudents((previous) => [...previous, storedStudent]);
      }
      setSelectedStudentId(storedStudent.id);
      setIsEditing(false);
      setEditingStudentId(null);
    } catch (error) {
      console.error('Failed to save student:', error);
      setDataError(`Could not save this record to Supabase: ${errorMessage(error)}`);
    } finally {
      setIsSavingStudent(false);
    }
  };

  // Delete Operator
  const handleDeleteStudent = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const student = students.find((candidate) => candidate.id === id);
    if (!student || !confirm('Are you sure you want to remove this operator record?')) {
      return;
    }

    setDataError('');
    try {
      await deleteStudent(student);
      const remaining = students.filter((candidate) => candidate.id !== id);
      setStudents(remaining);
      if (selectedStudentId === id) {
        setSelectedStudentId(remaining[0]?.id || '');
      }
    } catch (error) {
      console.error('Failed to delete student:', error);
      setDataError(`Could not remove this record from Supabase: ${errorMessage(error)}`);
    }
  };

  // PDF trigger
  const handleDownloadPdf = async (mode: 'exact' | 'a4_sheet') => {
    if (!previewStudent) return;
    setIsGeneratingPdf(true);
    // Give elements a tiny frame to settle and render QR codes
    setTimeout(async () => {
      const isOperator = previewStudent.cardDesignation === 'operator';
      const success = await downloadIDCardPDF(
        previewStudent.name,
        previewStudent.idNumber,
        `card-capture-front-${previewStudent.id}`,
        `card-capture-back-${previewStudent.id}`,
        mode,
        isOperator ? 'landscape' : 'portrait'
      );
      setIsGeneratingPdf(false);
      if (!success) {
        alert('There was an issue generating the PDF. Please check that elements are visible on screen.');
      }
    }, 400);
  };

  // Reset to default settings
  const handleSaveSettings = async (nextConfig: CardConfig = config) => {
    setIsSavingConfig(true);
    setConfigNotice('');
    setDataError('');
    try {
      const storedConfig = await saveCardConfig(nextConfig);
      setConfig(storedConfig);
      setConfigNotice('Template settings saved to Supabase.');
    } catch (error) {
      console.error('Failed to save card settings:', error);
      setDataError(`Could not save template settings to Supabase: ${errorMessage(error)}`);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleResetSettings = async () => {
    if (confirm('Reset custom layouts to match default company mockups?')) {
      const resetConfig = { ...INITIAL_CONFIG, institutionLogoPath: config.institutionLogoPath };
      setConfig(resetConfig);
      setSelectedCanvasLayer(null);
      await handleSaveSettings(resetConfig);
    }
  };

  const handleSelectCanvasLayer = (surface: TemplateSurface, id: string) => {
    setEditingSide(surface.endsWith('back') ? 'back' : 'front');
    setSelectedCanvasLayer({ surface, id });
  };

  const handleChangeCanvasLayer = (surface: TemplateSurface, id: string, changes: Partial<CanvasElement>) => {
    setConfig((previous) => {
      const layer = visibleLayers(previous.canvasElements, surface).find((candidate) => candidate.id === id);
      if (!layer) return previous;
      const updated = { ...layer, ...changes };
      return {
        ...previous,
        canvasElements: [
          ...previous.canvasElements.filter((candidate) => !(candidate.surface === surface && candidate.id === id)),
          updated
        ]
      };
    });
  };

  const handleAddCanvasElement = (kind: 'text' | 'rectangle') => {
    const id = `${kind}-${Date.now()}`;
    const element: CanvasElement = {
      ...baseCanvasElement(editingSurface, id, kind === 'text' ? 'Custom text' : `Custom ${kind}`, kind),
      x: 70,
      y: 150,
      width: kind === 'text' ? 220 : 90,
      height: 45,
      text: kind === 'text' ? 'NEW TEXT' : undefined,
      fontSize: 18,
      color: config.primaryColor,
      fill: config.accentColor,
      borderColor: config.accentColor,
      zIndex: 30
    };
    setConfig((previous) => ({ ...previous, canvasElements: [...previous.canvasElements, element] }));
    setSelectedCanvasLayer({ surface: editingSurface, id });
  };

  const handleDeleteCanvasElement = () => {
    if (!activeCanvasLayer || activeCanvasLayer.kind === 'builtin') return;
    setConfig((previous) => ({
      ...previous,
      canvasElements: previous.canvasElements.filter((element) => (
        !(element.surface === editingSurface && element.id === activeCanvasLayer.id)
      ))
    }));
    setSelectedCanvasLayer(null);
  };

  const handleResetCurrentSurface = () => {
    setConfig((previous) => ({
      ...previous,
      canvasElements: previous.canvasElements.filter((element) => element.surface !== editingSurface)
    }));
    setSelectedCanvasLayer(null);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword
    });
    if (error) {
      setAuthError(error.message);
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-natural-cream flex items-center justify-center text-natural-sage">
        <Loader2 className="w-7 h-7 animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-natural-cream flex items-center justify-center p-6 font-sans">
        <form onSubmit={handleSignIn} className="w-full max-w-sm bg-white border border-natural-border shadow-md rounded-2xl p-7 flex flex-col gap-4">
          <div className="w-12 h-12 bg-natural-sage rounded-xl text-white flex items-center justify-center mb-1">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-natural-darktext uppercase">Staff Sign In</h1>
            <p className="text-xs text-natural-muted mt-1">Authorized access to operator credentials and card assets.</p>
          </div>
          {authError && (
            <p className="text-xs bg-red-50 border border-red-200 rounded-lg p-2.5 text-red-700">{authError}</p>
          )}
          <label className="text-xs font-semibold text-natural-muted flex flex-col gap-1">
            Email
            <input
              type="email"
              value={authEmail}
              onChange={(e) => setAuthEmail(e.target.value)}
              className="border border-natural-darkborder rounded-lg p-2.5 text-natural-darktext outline-none focus:border-natural-sage"
              required
            />
          </label>
          <label className="text-xs font-semibold text-natural-muted flex flex-col gap-1">
            Password
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              className="border border-natural-darkborder rounded-lg p-2.5 text-natural-darktext outline-none focus:border-natural-sage"
              required
            />
          </label>
          <button className="bg-natural-sage hover:bg-natural-sage-hover text-white rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider">
            Sign In
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-natural-cream text-natural-text flex flex-col font-sans select-none antialiased">
      {/* Top Professional Navigation Header */}
      <header className="bg-white border-b border-natural-border py-3 px-4 sm:py-4 sm:px-6 relative z-30 shadow-sm flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-10 h-10 bg-natural-sage rounded-xl flex items-center justify-center text-white">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 100 100">
              <path d="M10 65 h40 l10 -15 h15 v12 h-10 v15 h-55 z" />
              <rect x="68" y="25" width="4" height="48" rx="1" />
              <path d="M72 50 h18 v4 h-18 z" fill="#fff" />
              <path d="M84 54 v15 h10 v3 h-14 v-18 z" fill="#fff" />
              <circle cx="21" cy="72" r="11" fill="#fff" />
              <circle cx="56" cy="72" r="11" fill="#fff" />
            </svg>
          </div>
          <div>
            <h1 className="text-base sm:text-lg font-display font-bold tracking-wide text-natural-darktext uppercase leading-none">
              Jayalath Campus ID System
            </h1>
            <p className="text-[10px] text-natural-muted font-semibold uppercase tracking-wider block mt-1">
              Career Education &amp; Training Institute | ID Card Production Hub
            </p>
          </div>
        </div>

        {/* Global Control Stats */}
        <div className="flex flex-wrap gap-2 sm:gap-4 items-center justify-between sm:justify-end w-full sm:w-auto">
          <div className="bg-natural-panel border border-natural-border px-3 sm:px-4 py-1.5 rounded-lg flex flex-col">
            <span className="text-[9px] font-bold text-natural-muted uppercase tracking-widest leading-none">OPERATORS</span>
            <span className="text-sm font-black text-natural-sage block mt-0.5">{students.length} Total</span>
          </div>

          <div className="order-first sm:order-none flex bg-natural-panel border border-natural-border p-1 rounded-lg">
            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === 'students' ? 'bg-natural-sage text-white' : 'text-natural-muted hover:text-natural-darktext'}`}
            >
              <Users className="w-3.5 h-3.5" />
              IDs
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-all ${activeTab === 'config' ? 'bg-natural-sage text-white' : 'text-natural-muted hover:text-natural-darktext'}`}
            >
              <Settings className="w-3.5 h-3.5" />
              Template
            </button>
          </div>
          <div className="hidden xl:flex flex-col text-right">
            <span className="text-[9px] font-bold text-natural-muted uppercase tracking-widest">Signed in</span>
            <span className="text-[10px] font-semibold text-natural-darktext">{session.user.email}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 border border-natural-border bg-natural-panel hover:bg-natural-sand rounded-lg px-2.5 sm:px-3 py-2 text-[10px] font-bold uppercase text-natural-muted"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </header>

      {(dataError || configNotice) && (
        <div className={`px-6 py-2 text-xs font-semibold border-b ${dataError ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
          {dataError || configNotice}
        </div>
      )}

      {/* Main Area Split */}
      <main className="flex-1 grid grid-cols-12 overflow-visible lg:overflow-hidden lg:h-full">
        {/* SIDE BAR / LEFT PANEL - CONTROLS & SELECTION */}
        <section className="order-2 lg:order-1 col-span-12 lg:col-span-4 xl:col-span-3 bg-natural-panel border-r border-natural-border p-4 sm:p-6 flex flex-col h-auto lg:h-full overflow-y-visible lg:overflow-y-auto min-h-[500px] lg:min-h-[auto]">
          {isEditing ? (
            /* Sub-Form Area for Operator Adding/Editing */
            <form onSubmit={handleSaveStudent} className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-natural-border pb-3">
                <span className="text-sm font-display font-bold text-natural-darktext uppercase tracking-wider block">
                  {editingStudentId ? 'Modify ID Record' : 'Issue New ID'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="text-xs font-semibold text-natural-muted hover:text-natural-darktext"
                >
                  Cancel
                </button>
              </div>

              {/* Core form fields */}
              <div className="flex flex-col gap-3 text-xs">
                {formCardDesignation === 'student' && (
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-natural-muted">Full Name *</label>
                  <input
                    type="text"
                    autoFocus={!editingStudentId}
                    className="bg-white border border-natural-darkborder rounded px-3 py-2 text-natural-darktext outline-none focus:border-natural-sage"
                    placeholder="e.g. John Perera"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                  />
                </div>
                )}
                
                {/* Form Category Designation & Specialty Selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-natural-sand/30 p-2.5 rounded-xl border border-natural-border/60">
                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-natural-muted uppercase text-[9px] tracking-wider">Card Category</label>
                    <select
                      className="bg-white border border-natural-darkborder rounded-lg px-2.5 py-2 text-natural-darktext font-bold text-xs outline-none focus:border-natural-sage cursor-pointer"
                      value={formCardDesignation}
                      onChange={(e) => {
                        const mode = e.target.value as 'student' | 'operator';
                        setFormCardDesignation(mode);
                        setFormTrainingMethod(mode === 'student' ? 'FC' : 'TT');
                        setFormStudentLookupId('');
                        setOperatorLookupMessage('');
                        setLinkedStudentId(null);
                        // Auto-update course
                        if (formEquipmentType === 'forklift') {
                          setFormCourse(mode === 'student' ? 'Forklift Operator Training' : 'Forklift Operator Certification');
                        } else {
                          setFormCourse(mode === 'student' ? 'Backhoe Loader Operator Training' : 'Backhoe Loader Operator Certification');
                        }
                      }}
                    >
                      <option value="student">🎓 Trainee / Student</option>
                      <option value="operator">🏗️ Certified Operator</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="font-bold text-natural-muted uppercase text-[9px] tracking-wider">Equipment Specialty</label>
                    <select
                      className="bg-white border border-natural-darkborder rounded-lg px-2.5 py-2 text-natural-darktext font-bold text-xs outline-none focus:border-natural-sage cursor-pointer"
                      value={formEquipmentType}
                      onChange={(e) => {
                        const spec = e.target.value as 'forklift' | 'backhoe';
                        setFormEquipmentType(spec);
                        // Auto-update course & class
                        if (spec === 'forklift') {
                          setFormCourse(formCardDesignation === 'student' ? 'Forklift Operator Training' : 'Forklift Operator Certification');
                          setFormEquipmentClass('Counterbalance Forklift / Class A');
                        } else {
                          setFormCourse(formCardDesignation === 'student' ? 'Backhoe Loader Operator Training' : 'Backhoe Loader Operator Certification');
                          setFormEquipmentClass('JCB Backhoe Loader / Class A');
                        }
                      }}
                    >
                      <option value="forklift">🚜 Forklift Operator</option>
                      <option value="backhoe">🏗️ Backhoe Loader</option>
                    </select>
                  </div>
                </div>

                {formCardDesignation === 'operator' && (
                  <>
                    <div className="border border-natural-border bg-white p-3 flex flex-col gap-3">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-[10px] text-natural-darktext uppercase tracking-wider">Former Student Verification</span>
                        <span className="text-[10px] text-natural-muted">Enter NIC first. Matching trainee details will be filled automatically.</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="flex flex-col gap-1">
                          <span className="font-semibold text-natural-muted">NIC Number *</span>
                          <input
                            type="text"
                            autoFocus={!editingStudentId}
                            className="bg-white border border-natural-darkborder rounded px-2.5 py-2 text-natural-darktext outline-none focus:border-natural-sage"
                            placeholder="e.g. 123456789V"
                            value={formNic}
                            onChange={(e) => {
                              setFormNic(e.target.value);
                              if (linkedStudentId) {
                                setFormStudentLookupId('');
                                setFormName('');
                                setFormPhoto(undefined);
                                setFormPhotoPath(undefined);
                              }
                              setLinkedStudentId(null);
                              setOperatorLookupMessage('');
                            }}
                            onBlur={(e) => checkFormerStudentRecord(e.target.value)}
                            required
                          />
                        </label>
                        <label className="flex flex-col gap-1">
                          <span className="font-semibold text-natural-muted">Student ID Check</span>
                          <input
                            type="text"
                            className="bg-white border border-natural-darkborder rounded px-2.5 py-2 text-natural-darktext outline-none focus:border-natural-sage"
                            placeholder="HMA/FL/FC/2026/000001"
                            value={formStudentLookupId}
                            onChange={(e) => {
                              setFormStudentLookupId(e.target.value);
                              setLinkedStudentId(null);
                            }}
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => checkFormerStudentRecord()}
                        className="self-start bg-natural-sage text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide"
                      >
                        Check Trainee Record
                      </button>
                      {operatorLookupMessage && (
                        <div className={`px-3 py-2 text-[10px] font-semibold border ${linkedStudentId ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-natural-panel border-natural-border text-natural-muted'}`}>
                          {operatorLookupMessage}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-natural-muted">Full Name *</label>
                      <input
                        type="text"
                        className="bg-white border border-natural-darkborder rounded px-3 py-2 text-natural-darktext outline-none focus:border-natural-sage"
                        placeholder="Auto-filled when a trainee is found, or enter manually"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

                {/* Equipment Type & Classification Details */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-natural-muted">Equipment Class / Model Specialty *</label>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-2 text-natural-darktext outline-none focus:border-natural-sage text-xs"
                    placeholder="e.g. Counterbalance Forklift / Class A"
                    value={formEquipmentClass}
                    onChange={(e) => setFormEquipmentClass(e.target.value)}
                    required
                  />
                </div>

                <div className="border border-natural-border bg-white p-3 flex flex-col gap-2">
                  <span className="font-bold text-[10px] text-natural-darktext uppercase tracking-wider">{formCardDesignation === 'operator' ? 'Operator ID Composition' : 'Student ID Composition'}</span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    <label className="flex flex-col gap-1 text-[9px] font-bold text-natural-muted uppercase">Category
                      <select value={formMainField} onChange={(e) => setFormMainField(e.target.value)} className="border border-natural-darkborder p-1.5 text-xs text-natural-darktext bg-white">
                        {MAIN_FIELD_OPTIONS.map((field) => (
                          <option key={field.code} value={field.code} disabled={!field.enabled}>{field.code} - {field.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[9px] font-bold text-natural-muted uppercase">Sub Field
                      <input value={specialtyCode(formEquipmentType)} readOnly className="border border-natural-border bg-natural-panel p-1.5 text-xs text-natural-darktext font-bold" />
                    </label>
                    <label className="flex flex-col gap-1 text-[9px] font-bold text-natural-muted uppercase">Course Type
                      <select value={formTrainingMethod} onChange={(e) => setFormTrainingMethod(e.target.value as TrainingMethod)} className="border border-natural-darkborder p-1.5 text-xs text-natural-darktext bg-white">
                        <option value="FC">FC - Full Course</option>
                        <option value="TT">TT - Trade Test</option>
                        <option value="GAP">GAP - Gap Filling</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-[9px] font-bold text-natural-muted uppercase">Year
                      <input value={formIdYear} onChange={(e) => setFormIdYear(e.target.value.replace(/\D/g, '').slice(0, 4))} className="border border-natural-darkborder p-1.5 text-xs text-natural-darktext" maxLength={4} />
                    </label>
                    <label className="flex flex-col gap-1 text-[9px] font-bold text-natural-muted uppercase">Serial
                      <input value={formSerial} readOnly className="border border-natural-border bg-natural-panel p-1.5 text-xs text-natural-darktext font-bold" />
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-[9px] font-bold text-natural-muted uppercase">Generated {formCardDesignation === 'operator' ? 'Operator' : 'Student'} ID
                    <input value={generatedIdNumber} readOnly className="border border-natural-darkborder bg-natural-panel px-3 py-2 text-xs text-[#0c2340] font-black tracking-wide" />
                  </label>
                </div>

                {/* NIC & generated ID row */}
                {formCardDesignation === 'student' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-natural-muted">NIC Number *</label>
                    <input
                      type="text"
                      className="bg-white border border-natural-darkborder rounded px-2.5 py-2 text-natural-darktext outline-none focus:border-natural-sage"
                      placeholder="e.g. 123456789V"
                      value={formNic}
                      onChange={(e) => setFormNic(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-natural-muted">Issued ID Number</label>
                    <input
                      type="text"
                      className="bg-natural-panel border border-natural-border rounded px-2.5 py-2 text-[#0c2340] font-bold"
                      value={generatedIdNumber}
                      readOnly
                    />
                  </div>
                </div>
                )}

                {/* Course Title name */}
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-natural-muted">{formCardDesignation === 'operator' ? 'Certification Course Title' : 'Training Course Title'}</label>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-2 text-natural-darktext outline-none focus:border-natural-sage"
                    value={formCourse}
                    onChange={(e) => setFormCourse(e.target.value)}
                  />
                </div>

                <div className={`grid grid-cols-1 gap-2 ${formCardDesignation === 'operator' ? 'sm:grid-cols-3' : ''}`}>
                  {formCardDesignation === 'operator' && (
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-natural-muted">Grade</label>
                      <select
                        className="bg-white border border-natural-darkborder rounded px-2.5 py-1.5 text-natural-darktext outline-none focus:border-natural-sage cursor-pointer"
                        value={formGrade}
                        onChange={(e) => setFormGrade(e.target.value)}
                      >
                        <option value="A">A</option>
                        <option value="A+">A+</option>
                        <option value="B">B</option>
                        <option value="C">C</option>
                      </select>
                    </div>
                  )}
                  <div className={`flex flex-col gap-1 ${formCardDesignation === 'operator' ? 'sm:col-span-2' : ''}`}>
                    <label className="font-semibold text-natural-muted">{formCardDesignation === 'operator' ? 'Issue Date' : 'Enrollment Date'}</label>
                    <input
                      type="text"
                      className="bg-white border border-natural-darkborder rounded px-2.5 py-2 text-natural-darktext outline-none focus:border-natural-sage"
                      placeholder="e.g. 25/05/2026"
                      value={formIssueDate}
                      onChange={(e) => setFormIssueDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-natural-muted">Training Institute / Company Name</label>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-2 text-natural-darktext outline-none focus:border-natural-sage"
                    value={formTrainingCenter}
                    onChange={(e) => setFormTrainingCenter(e.target.value)}
                  />
                </div>

                {/* Profile Photo upload */}
                <div className="border border-natural-border rounded-xl p-3 bg-white flex flex-col gap-2">
                  <span className="font-bold text-[11px] uppercase tracking-wide text-natural-darktext block">Cardholder Portrait Photo</span>
                  <div className="flex items-center gap-3">
                    {formPhoto ? (
                      <div className="relative w-12 h-14 bg-natural-sand rounded-lg overflow-hidden border border-natural-border">
                        <img src={formPhoto} alt="Upload preview" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setFormPhoto(undefined)}
                          className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-red-400 text-[9px] font-bold uppercase transition-opacity"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      <div className="w-12 h-14 bg-natural-cream border border-dashed border-natural-darkborder rounded-lg flex items-center justify-center text-natural-muted">
                        <Upload className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1">
                      <label className="inline-flex items-center gap-1 bg-natural-panel border border-natural-border text-natural-darktext px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wide cursor-pointer hover:bg-natural-sand transition-colors">
                        <Upload className="w-3 h-3" /> Select Photo
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoUpload}
                          className="hidden"
                        />
                      </label>
                      <span className="block text-[8.5px] text-natural-muted mt-1">Recommended file: Aspect 4:5 ratio</span>
                    </div>
                  </div>
                </div>

                {formCardDesignation === 'student' ? (
                  <div className="border border-natural-border bg-white p-3 flex flex-col gap-1">
                    <span className="font-bold text-[11px] uppercase tracking-wide text-natural-darktext">Admin Department Signature</span>
                    <span className="text-[10px] text-natural-muted">Applied from Template settings: {config.adminSignatureText.trim() || 'Admin Department'}.</span>
                  </div>
                ) : (
                <div className="border border-natural-border rounded-xl p-3 bg-white flex flex-col gap-2.5">
                  <span className="font-bold text-[11px] uppercase tracking-wide text-natural-darktext block">Admin Department Signature</span>
                  <div className="grid grid-cols-3 bg-natural-sand p-0.5 rounded-lg border border-natural-border">
                    <button
                      type="button"
                      onClick={() => setFormSigType('typed')}
                      className={`py-1 rounded text-[10px] font-bold uppercase transition-all ${formSigType === 'typed' ? 'bg-natural-sage text-white shadow-sm' : 'text-natural-muted hover:text-natural-darktext'}`}
                    >
                      Typed
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormSigType('handwritten')}
                      className={`py-1 rounded text-[10px] font-bold uppercase transition-all ${formSigType === 'handwritten' ? 'bg-natural-sage text-white shadow-sm' : 'text-natural-muted hover:text-natural-darktext'}`}
                    >
                      Draw
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormSigType('uploaded')}
                      className={`py-1 rounded text-[10px] font-bold uppercase transition-all ${formSigType === 'uploaded' ? 'bg-natural-sage text-white shadow-sm' : 'text-natural-muted hover:text-natural-darktext'}`}
                    >
                      Upload File
                    </button>
                  </div>

                  {/* Render based on SigType */}
                  {formSigType === 'typed' && (
                    <div className="flex flex-col gap-1.5">
                      <label className="font-semibold text-natural-muted text-[10px]">Authorized signatory label</label>
                      <input
                        type="text"
                        className="bg-white border border-natural-darkborder rounded px-2.5 py-1.5 text-natural-darktext outline-none text-xs focus:border-natural-sage"
                        placeholder="Admin Department"
                        value={formSigText}
                        onChange={(e) => setFormSigText(e.target.value)}
                      />
                      <span className="font-formal-sig text-[32px] text-natural-sage text-center block h-12 py-1 select-none pointer-events-none">
                        {formSigText || "Admin Department"}
                      </span>
                    </div>
                  )}

                  {formSigType === 'handwritten' && (
                    <SignaturePad
                      onSave={(dataUrl) => setFormSigImg(dataUrl)}
                      onClear={() => setFormSigImg(undefined)}
                      initialValue={formSigImg}
                    />
                  )}

                  {formSigType === 'uploaded' && (
                    <div className="flex items-center gap-3">
                      {formSigImg ? (
                        <div className="relative w-12 h-10 bg-white rounded border border-natural-border p-1 flex items-center justify-center">
                          <img src={formSigImg} alt="Uploaded signature" className="h-full object-contain" />
                          <button
                            type="button"
                            onClick={() => setFormSigImg(undefined)}
                            className="absolute inset-0 bg-black/60 opacity-0 hover:opacity-100 flex items-center justify-center text-red-400 text-[8px] font-bold uppercase transition-opacity"
                          >
                            Del
                          </button>
                        </div>
                      ) : (
                        <div className="w-12 h-10 bg-natural-cream border border-dashed border-natural-darkborder rounded flex items-center justify-center text-natural-muted">
                          <Upload className="w-4 h-4" />
                        </div>
                      )}
                      <div className="flex-1">
                        <label className="inline-flex items-center gap-1 bg-natural-panel border border-natural-border text-natural-darktext px-3 py-1 rounded text-[9px] font-bold uppercase cursor-pointer hover:bg-natural-sand transition-colors">
                          <Upload className="w-3 h-3" /> Select File
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleSignatureUpload}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setEditingStudentId(null);
                  }}
                  className="px-4 py-2 bg-natural-sand border border-natural-border hover:bg-natural-border text-natural-darktext font-bold uppercase rounded-lg tracking-wide text-xs transition-colors"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-4 py-2 bg-natural-sage hover:bg-natural-sage-hover disabled:opacity-50 text-white font-bold uppercase rounded-lg tracking-wide text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  {isSavingStudent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {isSavingStudent ? 'Saving' : 'Save Record'}
                </button>
              </div>
            </form>
          ) : activeTab === 'students' ? (
            /* TAB 1 - CUSTOMERS/OPERATORS LIST */
            <div className="flex flex-col gap-4 h-full">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-natural-muted tracking-widest uppercase block">Enrollments</span>
                <button
                  onClick={handleAddNewClick}
                  className="flex items-center gap-1 bg-natural-sage hover:bg-natural-sage-hover text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Student
                </button>
              </div>

              {/* Scrollable grid student cards */}
              <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-1">
                {isLoadingData && (
                  <div className="p-5 flex items-center justify-center text-natural-muted text-xs gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading Supabase records...
                  </div>
                )}
                {students.map((student) => {
                  const isSelected = student.id === selectedStudentId;
                  return (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudentId(student.id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex justify-between items-center ${isSelected ? 'bg-white border-natural-sage shadow-md' : 'bg-white border-natural-border hover:border-natural-darkborder'}`}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-9 h-10 rounded-lg bg-natural-sand flex items-center justify-center border border-natural-border overflow-hidden flex-shrink-0">
                          {student.photo ? (
                            <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-natural-muted font-black text-xs font-mono">FI</span>
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-natural-darktext text-xs truncate capitalize leading-tight">
                            {student.name}
                          </span>
                          <span className="text-[9px] text-natural-muted font-mono tracking-tight block mt-0.5">
                            {student.idNumber}{student.cardDesignation === 'operator' ? ` | Grade ${student.grade || 'A'}` : ''}
                          </span>
                          {/* Rich Badge indicators */}
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-extrabold uppercase ${student.cardDesignation === 'operator' ? 'bg-[#0c2340]/10 text-[#0c2340]' : 'bg-[#e2a812]/15 text-[#8f6400]'}`}>
                              {student.cardDesignation === 'operator' ? 'Operator' : 'Trainee'}
                            </span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded font-extrabold bg-slate-100 text-slate-600 uppercase">
                              {student.equipmentType === 'backhoe' ? 'JCB Backhoe' : 'Forklift'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Control row block */}
                      <div className="flex items-center gap-1 opacity-85 hover:opacity-100 flex-shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(student);
                          }}
                          className="p-1 px-1.5 rounded text-natural-muted hover:text-natural-darktext hover:bg-natural-sand transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteStudent(student.id, e)}
                          className="p-1 px-1.5 rounded text-natural-muted hover:text-red-500 hover:bg-natural-sand transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Guidance advice text */}
              <div className="bg-white border border-natural-border rounded-xl p-4 mt-auto shadow-sm">
                <span className="font-bold text-[11px] text-natural-sage uppercase tracking-wider block mb-1">Interactive Verification</span>
                <p className="text-[10.5px] text-natural-text leading-relaxed">
                  Scanning the dynamic QR code on the back verifies the operator against the URL configuration. The front-left mini QR code encodes a rich detail profile summary string.
                </p>
              </div>
            </div>
          ) : (
            /* TAB 2 - CARD LAYOUT SETTINGS */
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-natural-border pb-3">
                <span className="text-xs font-bold text-natural-muted tracking-widest uppercase block">Design Template Defaults</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => void handleSaveSettings()}
                    disabled={isSavingConfig}
                    className="flex items-center gap-1 text-[10px] font-bold text-natural-sage hover:text-natural-sage-hover disabled:opacity-50 transition-colors uppercase tracking-wider"
                  >
                    {isSavingConfig ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save Template
                  </button>
                  <button
                    onClick={() => void handleResetSettings()}
                    disabled={isSavingConfig}
                    className="flex items-center gap-1 text-[10px] font-bold text-natural-muted hover:text-natural-darktext disabled:opacity-50 transition-colors uppercase tracking-wider"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset Mock
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-natural-border bg-white p-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-black text-natural-darktext uppercase tracking-wider block">Canvas Designer</span>
                    <span className="text-[9px] text-natural-muted font-semibold">Select or drag a layer on the card.</span>
                  </div>
                  <div className="flex bg-natural-panel border border-natural-border p-0.5 rounded-md">
                    {(['front', 'back'] as const).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => {
                          setEditingSide(side);
                          setViewMode(side);
                          setSelectedCanvasLayer(null);
                        }}
                        className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase ${editingSide === side ? 'bg-natural-sage text-white' : 'text-natural-muted'}`}
                      >
                        {side}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-[9px] rounded-md bg-natural-panel border border-natural-border p-2 font-semibold text-natural-muted uppercase tracking-wider">
                  Editing {editingSurface.replace('-', ' ')} fixed design
                </div>

                <div className="grid grid-cols-2 gap-2 text-[9px] font-bold text-natural-muted uppercase">
                  <label className="flex items-center justify-between rounded-md border border-natural-border px-2 py-1.5">
                    Main color
                    <input type="color" value={config.primaryColor} onChange={(e) => setConfig((previous) => ({ ...previous, primaryColor: e.target.value }))} className="w-7 h-6 rounded border-0 p-0 bg-transparent" />
                  </label>
                  <label className="flex items-center justify-between rounded-md border border-natural-border px-2 py-1.5">
                    Accent
                    <input type="color" value={config.accentColor} onChange={(e) => setConfig((previous) => ({ ...previous, accentColor: e.target.value }))} className="w-7 h-6 rounded border-0 p-0 bg-transparent" />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto pr-1">
                  {editingLayers.map((layer) => (
                    <button
                      key={layer.id}
                      type="button"
                      onClick={() => setSelectedCanvasLayer({ surface: editingSurface, id: layer.id })}
                      className={`text-left px-2 py-1.5 rounded-md border text-[9.5px] font-bold truncate ${activeCanvasLayer?.id === layer.id ? 'border-natural-sage bg-natural-sage/10 text-natural-sage' : 'border-natural-border text-natural-text hover:bg-natural-panel'}`}
                    >
                      {layer.name}
                    </button>
                  ))}
                </div>

                <div className="flex gap-1.5">
                  <button type="button" onClick={() => handleAddCanvasElement('text')} className="flex-1 flex items-center justify-center gap-1 rounded-md border border-natural-border bg-natural-panel p-1.5 text-[9px] font-bold uppercase text-natural-darktext">
                    <Type className="w-3 h-3" /> Text
                  </button>
                  <button type="button" onClick={() => handleAddCanvasElement('rectangle')} className="flex-1 flex items-center justify-center gap-1 rounded-md border border-natural-border bg-natural-panel p-1.5 text-[9px] font-bold uppercase text-natural-darktext">
                    <Square className="w-3 h-3" /> Box
                  </button>
                </div>

                {activeCanvasLayer && (
                  <div className="border-t border-natural-border pt-3 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase text-natural-darktext">{activeCanvasLayer.name}</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title={activeCanvasLayer.hidden ? 'Show layer' : 'Hide layer'}
                          onClick={() => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { hidden: !activeCanvasLayer.hidden })}
                          className="p-1 rounded border border-natural-border text-natural-muted hover:text-natural-darktext"
                        >
                          {activeCanvasLayer.hidden ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                        {activeCanvasLayer.kind !== 'builtin' && (
                          <button type="button" onClick={handleDeleteCanvasElement} className="p-1 rounded border border-red-200 text-red-600">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {activeCanvasLayer.kind === 'text' && (
                      <input
                        type="text"
                        value={activeCanvasLayer.text || ''}
                        onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { text: e.target.value })}
                        className="bg-natural-panel border border-natural-darkborder rounded px-2 py-1.5 text-xs outline-none focus:border-natural-sage"
                        aria-label="Layer text"
                      />
                    )}

                    <div className="grid grid-cols-3 gap-2 text-[9px] font-bold text-natural-muted uppercase">
                      <label>X
                        <input type="number" value={activeCanvasLayer.x} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { x: Number(e.target.value) })} className="mt-1 w-full rounded border border-natural-darkborder px-1.5 py-1 text-natural-darktext" />
                      </label>
                      <label>Y
                        <input type="number" value={activeCanvasLayer.y} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { y: Number(e.target.value) })} className="mt-1 w-full rounded border border-natural-darkborder px-1.5 py-1 text-natural-darktext" />
                      </label>
                      <label>Rotate
                        <input type="number" value={activeCanvasLayer.rotation} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { rotation: Number(e.target.value) })} className="mt-1 w-full rounded border border-natural-darkborder px-1.5 py-1 text-natural-darktext" />
                      </label>
                      <label>Scale
                        <input type="number" min="0.1" step="0.05" value={activeCanvasLayer.scale} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { scale: Number(e.target.value) || 1 })} className="mt-1 w-full rounded border border-natural-darkborder px-1.5 py-1 text-natural-darktext" />
                      </label>
                      <label>Opacity
                        <input type="number" min="0" max="1" step="0.1" value={activeCanvasLayer.opacity} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { opacity: Number(e.target.value) })} className="mt-1 w-full rounded border border-natural-darkborder px-1.5 py-1 text-natural-darktext" />
                      </label>
                      <label>Layer
                        <input type="number" value={activeCanvasLayer.zIndex} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { zIndex: Number(e.target.value) })} className="mt-1 w-full rounded border border-natural-darkborder px-1.5 py-1 text-natural-darktext" />
                      </label>
                    </div>

                    {activeCanvasLayer.kind !== 'builtin' && (
                      <div className="grid grid-cols-3 gap-2 text-[9px] font-bold text-natural-muted uppercase">
                        <label>Width
                          <input type="number" value={activeCanvasLayer.width || 100} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { width: Number(e.target.value) })} className="mt-1 w-full rounded border border-natural-darkborder px-1.5 py-1 text-natural-darktext" />
                        </label>
                        {activeCanvasLayer.kind !== 'text' && (
                          <label>Height
                            <input type="number" value={activeCanvasLayer.height || 50} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { height: Number(e.target.value) })} className="mt-1 w-full rounded border border-natural-darkborder px-1.5 py-1 text-natural-darktext" />
                          </label>
                        )}
                        {activeCanvasLayer.kind === 'text' && (
                          <label>Font
                            <input type="number" value={activeCanvasLayer.fontSize || 16} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, { fontSize: Number(e.target.value) })} className="mt-1 w-full rounded border border-natural-darkborder px-1.5 py-1 text-natural-darktext" />
                          </label>
                        )}
                        <label>Color
                          <input type="color" value={activeCanvasLayer.kind === 'text' ? (activeCanvasLayer.color || config.primaryColor) : (activeCanvasLayer.fill || config.accentColor)} onChange={(e) => handleChangeCanvasLayer(editingSurface, activeCanvasLayer.id, activeCanvasLayer.kind === 'text' ? { color: e.target.value } : { fill: e.target.value, borderColor: e.target.value })} className="mt-1 w-full h-7 rounded border border-natural-darkborder" />
                        </label>
                      </div>
                    )}
                  </div>
                )}

                <button type="button" onClick={handleResetCurrentSurface} className="text-[9px] font-bold uppercase tracking-wider text-natural-muted hover:text-natural-darktext self-start">
                  Reset current side layout
                </button>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div className="border border-natural-border bg-white p-3 flex flex-col gap-2">
                  <span className="font-bold text-[10.5px] text-natural-darktext uppercase tracking-wider">Company Logo</span>
                  <span className="text-[9px] font-semibold text-natural-muted">Displayed on student and operator ID designs.</span>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 border border-natural-border bg-natural-panel flex items-center justify-center overflow-hidden">
                      {config.institutionLogo ? (
                        <img src={config.institutionLogo} alt="Company logo preview" className="max-w-full max-h-full object-contain p-1" />
                      ) : (
                        <span className="text-[9px] font-bold text-natural-muted uppercase">Default</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="inline-flex items-center gap-1 border border-natural-darkborder bg-natural-panel px-3 py-1.5 text-[9px] font-bold uppercase text-natural-darktext cursor-pointer hover:bg-natural-sand">
                        <Upload className="w-3 h-3" /> Select Logo
                        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleInstitutionLogoUpload} className="hidden" />
                      </label>
                      {config.institutionLogo && (
                        <button
                          type="button"
                          onClick={() => setConfig((previous) => ({ ...previous, institutionLogo: undefined }))}
                          className="text-[9px] font-bold uppercase text-red-600 text-left"
                        >
                          Remove logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="border border-natural-border bg-white p-3 flex flex-col gap-2">
                  <span className="font-bold text-[10.5px] text-natural-darktext uppercase tracking-wider">Admin Department Signature</span>
                  <span className="text-[9px] font-semibold text-natural-muted">Default authorized signature shown on student ID designs.</span>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.adminSignatureText}
                    onChange={(e) => setConfig((previous) => ({ ...previous, adminSignatureText: e.target.value }))}
                    placeholder="Admin Department"
                  />
                  <span className="font-formal-sig text-[28px] text-[#0c2340] leading-none min-h-8">
                    {config.adminSignatureText.trim() || 'Admin Department'}
                  </span>
                </div>

                {/* Left Area header customizing text fields */}
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">LEFT ROW HEADER (BOLDEST)</span>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.leftMainHeader}
                    onChange={(e) => setConfig(prev => ({ ...prev, leftMainHeader: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">LEFT SUB HEADER</span>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.leftSubHeader}
                    onChange={(e) => setConfig(prev => ({ ...prev, leftSubHeader: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">RIGHT CORNER HEADER</span>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.rightMainHeader}
                    onChange={(e) => setConfig(prev => ({ ...prev, rightMainHeader: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">RIGHT SUB TITLE</span>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.rightSubHeader}
                    onChange={(e) => setConfig(prev => ({ ...prev, rightSubHeader: e.target.value }))}
                  />
                </div>

                <hr className="border-natural-border my-2" />

                {/* Back side details configurations */}
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">BACK SIDE LOGO TEXT</span>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.backLogoLabel}
                    onChange={(e) => setConfig(prev => ({ ...prev, backLogoLabel: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">VERIFICATION WEBSITE URL</span>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.backVerificationUrl}
                    onChange={(e) => setConfig(prev => ({ ...prev, backVerificationUrl: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">VALIDITY FOR ID (YEARS)</span>
                  <input
                    type="number"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.validityYears}
                    onChange={(e) => setConfig(prev => ({ ...prev, validityYears: parseInt(e.target.value) || 2 }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">CONTACT TELEPHONE</span>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.backContactPhone}
                    onChange={(e) => setConfig(prev => ({ ...prev, backContactPhone: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">SECOND CONTACT TELEPHONE</span>
                  <input
                    type="text"
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage"
                    value={config.backContactEmail}
                    onChange={(e) => setConfig(prev => ({ ...prev, backContactEmail: e.target.value }))}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="font-bold text-[10.5px] text-natural-darktext block">OFFICIAL POSTAL ADDRESS</span>
                  <textarea
                    rows={3}
                    className="bg-white border border-natural-darkborder rounded px-3 py-1.5 text-natural-darktext outline-none focus:border-natural-sage font-sans text-xs"
                    value={config.backAddress}
                    onChange={(e) => setConfig(prev => ({ ...prev, backAddress: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}
        </section>

        {/* DETAILS PRESENTATION AREA - MAIN BODY RIGHT */}
        <section className="order-1 lg:order-2 col-span-12 lg:col-span-8 xl:col-span-9 bg-natural-sand px-3 py-4 sm:px-6 sm:py-8 flex flex-col justify-between items-center h-auto lg:h-full overflow-y-visible lg:overflow-y-auto min-h-[500px]">
          {(selectedStudent || activeTab === 'config') ? (
            <div className={`flex-1 flex flex-col justify-center items-center gap-4 sm:gap-6 w-full ${isExpandedPreview ? 'max-w-[1420px]' : 'max-w-4xl'}`}>
              
              {/* Toolbar preview switches */}
              <div className={`flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center w-full ${isExpandedPreview ? 'max-w-[1380px]' : 'max-w-[860px]'} bg-white p-2.5 rounded-xl border border-natural-border shadow-sm`}>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold tracking-widest text-natural-sage uppercase block pl-1">
                    ACTIVE CARD PREVIEW
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div className="grid grid-cols-3 gap-1.5 bg-natural-panel p-0.5 rounded-lg border border-natural-border w-full sm:w-auto">
                  <button
                    onClick={() => setViewMode('both')}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'both' ? 'bg-natural-sage text-white' : 'text-natural-muted hover:text-natural-darktext'}`}
                  >
                    Both Sides
                  </button>
                  <button
                    onClick={() => setViewMode('front')}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'front' ? 'bg-natural-sage text-white' : 'text-natural-muted hover:text-natural-darktext'}`}
                  >
                    Front Only
                  </button>
                  <button
                    onClick={() => setViewMode('back')}
                    className={`px-3 py-1 rounded text-[10px] font-bold uppercase transition-all ${viewMode === 'back' ? 'bg-natural-sage text-white' : 'text-natural-muted hover:text-natural-darktext'}`}
                  >
                    Back Only
                  </button>
                </div>
              </div>

              {/* Physical Render of Cards side by side or stacked */}
              <div className={`operator-preview-stage flex flex-col md:flex-row gap-5 items-center ${isExpandedPreview ? 'md:justify-start xl:justify-center' : 'justify-center'} my-2 p-2 w-full max-w-full overflow-x-auto`}>
                {(viewMode === 'both' || viewMode === 'front') && (
                  <div className="flex flex-col items-center gap-2 flex-shrink-0 animate-fade-in">
                    {viewMode === 'both' && <span className="text-[9.5px] font-extrabold text-[#0c2340] bg-[#e2a812]/15 text-[#8f6400] px-2.5 py-0.5 uppercase tracking-widest">FRONT CARD</span>}
                    <div className={`preview-card-frame ${isOperatorPreview ? 'preview-card-frame--operator' : 'preview-card-frame--student'}`}>
                      <div className="preview-card-paper bg-white p-2 border border-natural-border shadow-md">
                        <IDCard
                          student={previewStudent}
                          config={config}
                          showBack={false}
                          designMode={activeTab === 'config'}
                          selectedLayerId={selectedCanvasLayer?.id}
                          selectedSurface={selectedCanvasLayer?.surface}
                          onSelectLayer={handleSelectCanvasLayer}
                          onChangeLayer={handleChangeCanvasLayer}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {(viewMode === 'both' || viewMode === 'back') && (
                  <div className="flex flex-col items-center gap-2 flex-shrink-0 animate-fade-in">
                    {viewMode === 'both' && <span className="text-[9.5px] font-extrabold text-white bg-[#0c2340] px-2.5 py-0.5 uppercase tracking-widest">REVERSE CARD</span>}
                    <div className={`preview-card-frame ${isOperatorPreview ? 'preview-card-frame--operator' : 'preview-card-frame--student'}`}>
                      <div className="preview-card-paper bg-white p-2 border border-natural-border shadow-md">
                        <IDCard
                          student={previewStudent}
                          config={config}
                          showBack={true}
                          designMode={activeTab === 'config'}
                          selectedLayerId={selectedCanvasLayer?.id}
                          selectedSurface={selectedCanvasLayer?.surface}
                          onSelectLayer={handleSelectCanvasLayer}
                          onChangeLayer={handleChangeCanvasLayer}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Downloads action hub block */}
              <div className={`w-full ${isExpandedPreview ? 'max-w-[1380px]' : 'max-w-[860px]'} bg-white rounded-2xl border border-natural-border p-4 sm:p-5 flex flex-col gap-4 mt-2 shadow-sm`}>
                <div className="flex flex-col">
                  <span className="text-sm font-display font-extrabold text-natural-darktext tracking-wide uppercase">
                    Export Credentials & ID Print
                  </span>
                  <span className="text-[10px] text-natural-muted pt-1 font-semibold">
                    Generate secure PDFs configured beautifully for printing. Select your layout mode below:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Option 1: Double Sided ID Size download */}
                  <button
                    onClick={() => handleDownloadPdf('exact')}
                    disabled={isGeneratingPdf}
                    className="flex flex-col items-center text-center p-4 bg-natural-panel hover:bg-natural-sand disabled:opacity-50 border border-natural-border hover:border-natural-darkborder rounded-xl transition-all cursor-pointer select-none gap-2 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-natural-sage/10 flex items-center justify-center text-natural-sage group-hover:bg-natural-sage/20 transition-colors">
                      <Download className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-extrabold text-xs text-natural-darktext uppercase tracking-wider block">ID Card Dimensions</span>
                      <span className="text-[9px] text-natural-sage mt-0.5 font-semibold block uppercase">
                        {previewStudent.cardDesignation === 'operator' ? '85.6mm x 54mm (CR80 Landscape)' : '54mm x 85.6mm (CR80 Portrait)'}
                      </span>
                    </div>
                    <span className="text-[10px] text-natural-text mt-2 leading-relaxed font-semibold">
                      Best option for professional PVC card printers or individual ID slots. Generates a tight 2-page print PDF.
                    </span>
                  </button>

                  {/* Option 2: A4 printable format PDF */}
                  <button
                    onClick={() => handleDownloadPdf('a4_sheet')}
                    disabled={isGeneratingPdf}
                    className="flex flex-col items-center text-center p-4 bg-natural-panel hover:bg-natural-sand disabled:opacity-50 border border-natural-border hover:border-natural-darkborder rounded-xl transition-all cursor-pointer select-none gap-2 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-natural-sage/10 flex items-center justify-center text-natural-sage group-hover:bg-natural-sage/20 transition-colors">
                      <Grid className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-extrabold text-xs text-natural-darktext uppercase tracking-wider block">A4 Centered Layout</span>
                      <span className="text-[9px] text-natural-sage mt-0.5 font-semibold block uppercase">A4 Sheet with crop guides</span>
                    </div>
                    <span className="text-[10px] text-natural-text mt-2 leading-relaxed font-semibold">
                      Best for standard office papers. Centered front & back with safe dashed scissor borders for easy cutting.
                    </span>
                  </button>
                </div>

                {/* Print loading status state */}
                {isGeneratingPdf && (
                  <div className="bg-natural-panel p-2.5 rounded-lg border border-natural-border flex items-center justify-center gap-2 text-xs text-natural-darktext">
                    <div className="w-4 h-4 border-2 border-natural-sage border-t-transparent rounded-full animate-spin" />
                    <span>Compiling PDF canvas layers at 300 DPI layout. Please wait...</span>
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="flex h-full flex-col justify-center items-center text-natural-muted gap-3">
              <svg className="w-16 h-16 opacity-30 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h7.5A.75.75 0 0 1 13 8.25v9a.75.75 0 0 1-.75.75H5.25A.75.75 0 0 1 4.5 17.25v-9A.75.75 0 0 1 5.25 7.5Z" />
              </svg>
              <div className="text-center">
                <span className="block font-bold text-sm text-natural-darktext uppercase tracking-widest">No Operator Selected</span>
                <span className="text-xs text-natural-muted mt-1 block">Enroll, add details, or customize defaults to preview ID cards</span>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Off-screen capture container for reliable, high-fidelity PDF rendering independent of view tab selection */}
      <div 
        id="print-capture-sandbox" 
        style={{ 
          position: 'fixed', 
          left: '0', 
          top: '0', 
          width: '1200px', 
          height: '1200px', 
          overflow: 'hidden', 
          zIndex: -9999, 
          opacity: 0.001, 
          pointerEvents: 'none' 
        }}
      >
        <div 
          id={`card-capture-front-${previewStudent.id}`}
          style={{
            width: previewStudent.cardDesignation === 'operator' ? '650px' : '410px',
            height: previewStudent.cardDesignation === 'operator' ? '410px' : '650px',
            boxSizing: 'border-box'
          }}
        >
          <IDCard student={previewStudent} config={config} showBack={false} />
        </div>
        <div 
          id={`card-capture-back-${previewStudent.id}`} 
          style={{
            width: previewStudent.cardDesignation === 'operator' ? '650px' : '410px',
            height: previewStudent.cardDesignation === 'operator' ? '410px' : '650px',
            boxSizing: 'border-box',
            marginTop: '32px'
          }}
        >
          <IDCard student={previewStudent} config={config} showBack={true} />
        </div>
      </div>
    </div>
  );
}
