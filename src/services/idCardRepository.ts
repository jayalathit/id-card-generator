import { ASSET_BUCKET, supabase } from '../lib/supabase';
import { CanvasElement, CardConfig, Student, TemplateDetails } from '../types';

const MAX_ASSET_BYTES = 5 * 1024 * 1024;
const ADMIN_SIGNATURE_SETTING_ID = '__template_admin_signature__';
const ADMIN_SIGNATURE_PATH_SETTING_ID = '__template_admin_signature_path__';
const STUDENT_DETAILS_SETTING_ID = '__template_student_details__';
const OPERATOR_DETAILS_SETTING_ID = '__template_operator_details__';
const STUDENT_HEAD_OFFICE_ADDRESS = 'Jayalath Campus\nNugadolawatta,\nAttanagalla Road,\nPasyala (Off Kandy Road)';
const OPERATOR_HEAD_OFFICE_ADDRESS = '658, Dr. Danister De Silva Road,\nColombo 9,\nSri Lanka.';

interface StudentRow {
  id: string;
  nic: string;
  name: string;
  id_number: string;
  grade: string;
  course: string;
  issue_date: string;
  training_center: string;
  photo_path: string | null;
  signature_type: Student['signatureType'];
  signature_text: string | null;
  signature_path: string | null;
  card_designation: NonNullable<Student['cardDesignation']>;
  equipment_type: NonNullable<Student['equipmentType']>;
  equipment_class: string;
}

interface ConfigRow {
  id: number;
  institution_logo_path: string | null;
  admin_signature_text?: string | null;
  left_main_header: string;
  left_sub_header: string;
  right_main_header: string;
  right_sub_header: string;
  validity_years: number;
  back_verification_url: string;
  back_address: string;
  back_contact_phone: string;
  back_contact_email: string;
  back_logo_label: string;
  primary_color: string;
  accent_color: string;
  canvas_elements: CanvasElement[] | null;
}

function rectangularElements(elements: CanvasElement[] | null | undefined): CanvasElement[] {
  if (!Array.isArray(elements)) return [];
  return elements.map((element) => (
    element.kind === 'circle'
      ? { ...element, kind: 'rectangle', name: 'Custom box' }
      : element
  ));
}

function editableCanvasElements(elements: CanvasElement[] | null | undefined): CanvasElement[] {
  return rectangularElements(elements).filter((element) => ![
    ADMIN_SIGNATURE_SETTING_ID,
    ADMIN_SIGNATURE_PATH_SETTING_ID,
    STUDENT_DETAILS_SETTING_ID,
    OPERATOR_DETAILS_SETTING_ID
  ].includes(element.id));
}

function settingsElement(id: string, text: string): CanvasElement {
  return {
    id,
    surface: 'student-front',
    name: 'Template setting',
    kind: 'text',
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    opacity: 0,
    zIndex: -1,
    hidden: true,
    text
  };
}

function storedCanvasElements(config: CardConfig): CanvasElement[] {
  return [
    ...editableCanvasElements(config.canvasElements),
    settingsElement(ADMIN_SIGNATURE_SETTING_ID, config.adminSignatureText.trim() || 'Admin Department'),
    ...(config.adminSignaturePath ? [settingsElement(ADMIN_SIGNATURE_PATH_SETTING_ID, config.adminSignaturePath)] : []),
    settingsElement(STUDENT_DETAILS_SETTING_ID, JSON.stringify(config.studentDetails)),
    settingsElement(OPERATOR_DETAILS_SETTING_ID, JSON.stringify(config.operatorDetails))
  ];
}

function configuredAdminSignature(row: ConfigRow): string {
  const storedSetting = row.canvas_elements?.find((element) => element.id === ADMIN_SIGNATURE_SETTING_ID)?.text;
  return row.admin_signature_text?.trim() || storedSetting?.trim() || 'Admin Department';
}

function configuredAdminSignaturePath(row: ConfigRow): string | undefined {
  return row.canvas_elements?.find((element) => element.id === ADMIN_SIGNATURE_PATH_SETTING_ID)?.text?.trim() || undefined;
}

function normalizeTemplateDetails(details: TemplateDetails, designation: 'student' | 'operator'): TemplateDetails {
  const headOfficeAddress = designation === 'operator' ? OPERATOR_HEAD_OFFICE_ADDRESS : STUDENT_HEAD_OFFICE_ADDRESS;
  const hasLegacyAddress = details.backAddress.includes('for Construction & Industrial Training') ||
    details.backAddress.includes('No. 123, Training Road') ||
    details.backAddress.includes('Danister De Silva Road') ||
    details.backAddress.includes('Nugadolawatta');
  return {
    ...details,
    backAddress: hasLegacyAddress ? headOfficeAddress : details.backAddress,
    backContactPhone: details.backContactPhone === '+94 11 2 345 678' || details.backContactPhone === '070 2 503 503'
      ? '+94 70 250 3503'
      : details.backContactPhone,
    backContactEmail: details.backContactEmail === '+94 77 123 4567' || details.backContactEmail === '011 7 503 503'
      ? '+94 11 750 3503'
      : details.backContactEmail
  };
}

function legacyDetails(row: ConfigRow, designation: 'student' | 'operator'): TemplateDetails {
  const headOfficeAddress = designation === 'operator' ? OPERATOR_HEAD_OFFICE_ADDRESS : STUDENT_HEAD_OFFICE_ADDRESS;
  return normalizeTemplateDetails({
    leftMainHeader: row.left_main_header,
    leftSubHeader: row.left_sub_header === 'for Construction & Industrial Training'
      ? 'Career Education & Training Institute'
      : row.left_sub_header,
    rightMainHeader: row.right_main_header === 'GLOBAL SKILLS' ? 'OFFICIAL ID' : row.right_main_header,
    rightSubHeader: row.right_sub_header === 'INSTITUTE' ? 'CREDENTIAL' : row.right_sub_header,
    validityYears: row.validity_years,
    backVerificationUrl: row.back_verification_url === 'www.jayalathcampus.lk/verify'
      ? 'jceti.com/verification'
      : row.back_verification_url,
    backAddress: row.back_address.includes('for Construction & Industrial Training') || row.back_address.includes('Danister De Silva Road')
      ? headOfficeAddress
      : row.back_address,
    backContactPhone: row.back_contact_phone === '+94 11 2 345 678' || row.back_contact_phone === '070 2 503 503'
      ? '+94 70 250 3503'
      : row.back_contact_phone,
    backContactEmail: row.back_contact_email === '+94 77 123 4567' || row.back_contact_email === '011 7 503 503'
      ? '+94 11 750 3503'
      : row.back_contact_email,
    backLogoLabel: row.back_logo_label
  }, designation);
}

function storedDetails(row: ConfigRow, id: string, fallback: TemplateDetails, designation: 'student' | 'operator'): TemplateDetails {
  const serialized = row.canvas_elements?.find((element) => element.id === id)?.text;
  if (!serialized) return normalizeTemplateDetails(fallback, designation);
  try {
    return normalizeTemplateDetails({ ...fallback, ...(JSON.parse(serialized) as Partial<TemplateDetails>) }, designation);
  } catch {
    return normalizeTemplateDetails(fallback, designation);
  }
}

function toDisplayDate(date: string): string {
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
}

function toDatabaseDate(date: string): string {
  const parts = date.split('/');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : date;
}

async function signedAssetUrl(path?: string | null): Promise<string | undefined> {
  if (!path) return undefined;
  const { data, error } = await supabase.storage.from(ASSET_BUCKET).createSignedUrl(path, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

async function hydrateStudent(row: StudentRow): Promise<Student> {
  const [photo, signatureImage] = await Promise.all([
    signedAssetUrl(row.photo_path),
    signedAssetUrl(row.signature_path)
  ]);

  const oldIdMatch = row.id_number.match(/^(FL|BL)-(?:20)?(\d{2})-(?:OP-)?(\d{1,3})$/i);
  const migratedIdNumber = oldIdMatch
    ? `HMA/${oldIdMatch[1].toUpperCase()}/${row.card_designation === 'operator' ? 'TT' : 'FC'}/20${oldIdMatch[2]}/${oldIdMatch[3].padStart(6, '0')}`
    : row.id_number;

  return {
    id: row.id,
    nic: row.nic,
    name: row.name,
    idNumber: migratedIdNumber,
    grade: row.grade,
    course: row.course,
    issueDate: toDisplayDate(row.issue_date),
    trainingCenter: row.training_center === 'Global Skills Institute' ? 'Jayalath Campus' : row.training_center,
    photo,
    photoPath: row.photo_path || undefined,
    signatureType: row.signature_type,
    signatureText: row.signature_text || undefined,
    signatureImage,
    signaturePath: row.signature_path || undefined,
    cardDesignation: row.card_designation,
    equipmentType: row.equipment_type,
    equipmentClass: row.equipment_class
  };
}

async function hydrateConfig(row: ConfigRow): Promise<CardConfig> {
  const studentLegacy = legacyDetails(row, 'student');
  const operatorLegacy = legacyDetails(row, 'operator');
  const studentDetails = storedDetails(row, STUDENT_DETAILS_SETTING_ID, studentLegacy, 'student');
  const operatorDetails = storedDetails(row, OPERATOR_DETAILS_SETTING_ID, operatorLegacy, 'operator');
  const adminSignaturePath = configuredAdminSignaturePath(row);
  return {
    institutionLogo: await signedAssetUrl(row.institution_logo_path),
    institutionLogoPath: row.institution_logo_path || undefined,
    adminSignatureText: configuredAdminSignature(row),
    adminSignatureImage: await signedAssetUrl(adminSignaturePath),
    adminSignaturePath,
    ...studentDetails,
    primaryColor: row.primary_color || '#0c2340',
    accentColor: row.accent_color || '#e2a812',
    canvasElements: editableCanvasElements(row.canvas_elements),
    studentDetails,
    operatorDetails
  };
}

export async function loadWorkspaceData(defaultConfig: CardConfig): Promise<{ students: Student[]; config: CardConfig }> {
  const [studentResponse, configResponse] = await Promise.all([
    supabase.from('students').select('*').order('created_at', { ascending: true }),
    supabase.from('card_config').select('*').eq('id', 1).maybeSingle()
  ]);

  if (studentResponse.error) throw studentResponse.error;
  if (configResponse.error) throw configResponse.error;

  const students = await Promise.all((studentResponse.data as StudentRow[]).map(hydrateStudent));
  const config = configResponse.data
    ? await hydrateConfig(configResponse.data as ConfigRow)
    : defaultConfig;

  return { students, config };
}

function extensionForMimeType(mimeType: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  return 'png';
}

async function uploadDataUrl(studentId: string, kind: 'photo' | 'signature', dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const asset = await response.blob();

  if (!asset.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.');
  }
  if (asset.size > MAX_ASSET_BYTES) {
    throw new Error('Images must be 5 MB or smaller.');
  }

  const path = `students/${studentId}/${kind}-${Date.now()}.${extensionForMimeType(asset.type)}`;
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, asset, {
    contentType: asset.type,
    upsert: false
  });
  if (error) throw error;
  return path;
}

async function uploadInstitutionLogo(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const asset = await response.blob();

  if (!asset.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.');
  }
  if (asset.size > MAX_ASSET_BYTES) {
    throw new Error('Images must be 5 MB or smaller.');
  }

  const path = `template/institution-logo-${Date.now()}.${extensionForMimeType(asset.type)}`;
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, asset, {
    contentType: asset.type,
    upsert: false
  });
  if (error) throw error;
  return path;
}

async function uploadTemplateSignature(dataUrl: string): Promise<string> {
  const response = await fetch(dataUrl);
  const asset = await response.blob();

  if (!asset.type.startsWith('image/')) {
    throw new Error('Only image files can be uploaded.');
  }
  if (asset.size > MAX_ASSET_BYTES) {
    throw new Error('Images must be 5 MB or smaller.');
  }

  const path = `template/admin-signature-${Date.now()}.${extensionForMimeType(asset.type)}`;
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, asset, {
    contentType: asset.type,
    upsert: false
  });
  if (error) throw error;
  return path;
}

function studentRow(student: Student, photoPath: string | null, signaturePath: string | null): StudentRow {
  return {
    id: student.id,
    nic: student.nic.trim(),
    name: student.name.trim(),
    id_number: student.idNumber.trim(),
    grade: student.grade.trim(),
    course: student.course.trim(),
    issue_date: toDatabaseDate(student.issueDate),
    training_center: student.trainingCenter.trim(),
    photo_path: photoPath,
    signature_type: student.signatureType,
    signature_text: student.signatureType === 'typed' ? (student.signatureText || student.name).trim() : null,
    signature_path: student.signatureType === 'typed' ? null : signaturePath,
    card_designation: student.cardDesignation || 'student',
    equipment_type: student.equipmentType || 'forklift',
    equipment_class: student.equipmentClass || ''
  };
}

export async function saveStudent(student: Student): Promise<Student> {
  let photoPath = student.photoPath || null;
  let signaturePath = student.signaturePath || null;
  const uploadedPaths: string[] = [];

  if (!student.photo) {
    photoPath = null;
  } else if (student.photo.startsWith('data:')) {
    photoPath = await uploadDataUrl(student.id, 'photo', student.photo);
    uploadedPaths.push(photoPath);
  }

  if (student.signatureType === 'typed' || !student.signatureImage) {
    signaturePath = null;
  } else if (student.signatureImage.startsWith('data:')) {
    try {
      signaturePath = await uploadDataUrl(student.id, 'signature', student.signatureImage);
      uploadedPaths.push(signaturePath);
    } catch (error) {
      if (uploadedPaths.length) {
        await supabase.storage.from(ASSET_BUCKET).remove(uploadedPaths);
      }
      throw error;
    }
  }

  const { data, error } = await supabase
    .from('students')
    .upsert(studentRow(student, photoPath, signaturePath))
    .select('*')
    .single();

  if (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from(ASSET_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }

  const replacedPaths = [
    student.photoPath && student.photoPath !== photoPath ? student.photoPath : null,
    student.signaturePath && student.signaturePath !== signaturePath ? student.signaturePath : null
  ].filter((path): path is string => Boolean(path));

  if (replacedPaths.length) {
    await supabase.storage.from(ASSET_BUCKET).remove(replacedPaths);
  }

  return hydrateStudent(data as StudentRow);
}

export async function deleteStudent(student: Student): Promise<void> {
  const { error } = await supabase.from('students').delete().eq('id', student.id);
  if (error) throw error;

  const paths = [student.photoPath, student.signaturePath].filter((path): path is string => Boolean(path));
  if (paths.length) {
    await supabase.storage.from(ASSET_BUCKET).remove(paths);
  }
}

export async function saveCardConfig(config: CardConfig): Promise<CardConfig> {
  let institutionLogoPath = config.institutionLogoPath || null;
  let adminSignaturePath = config.adminSignaturePath || null;
  let uploadedLogoPath: string | null = null;
  let uploadedSignaturePath: string | null = null;

  try {
    if (!config.institutionLogo) {
      institutionLogoPath = null;
    } else if (config.institutionLogo.startsWith('data:')) {
      institutionLogoPath = await uploadInstitutionLogo(config.institutionLogo);
      uploadedLogoPath = institutionLogoPath;
    }

    if (!config.adminSignatureImage) {
      adminSignaturePath = null;
    } else if (config.adminSignatureImage.startsWith('data:')) {
      adminSignaturePath = await uploadTemplateSignature(config.adminSignatureImage);
      uploadedSignaturePath = adminSignaturePath;
    }
  } catch (error) {
    const uploadedPaths = [uploadedLogoPath, uploadedSignaturePath].filter((path): path is string => Boolean(path));
    if (uploadedPaths.length) await supabase.storage.from(ASSET_BUCKET).remove(uploadedPaths);
    throw error;
  }

  const row = {
    id: 1,
    institution_logo_path: institutionLogoPath,
    admin_signature_text: config.adminSignatureText.trim() || 'Admin Department',
    left_main_header: config.studentDetails.leftMainHeader,
    left_sub_header: config.studentDetails.leftSubHeader,
    right_main_header: config.studentDetails.rightMainHeader,
    right_sub_header: config.studentDetails.rightSubHeader,
    validity_years: config.studentDetails.validityYears,
    back_verification_url: config.studentDetails.backVerificationUrl,
    back_address: config.studentDetails.backAddress,
    back_contact_phone: config.studentDetails.backContactPhone,
    back_contact_email: config.studentDetails.backContactEmail,
    back_logo_label: config.studentDetails.backLogoLabel,
    primary_color: config.primaryColor,
    accent_color: config.accentColor,
    canvas_elements: storedCanvasElements({ ...config, institutionLogoPath: institutionLogoPath || undefined, adminSignaturePath: adminSignaturePath || undefined })
  };

  let { data, error } = await supabase.from('card_config').upsert(row).select('*').single();
  if (error?.message?.includes("'admin_signature_text' column")) {
    const { admin_signature_text: _omittedSignatureColumn, ...compatibleRow } = row;
    const retry = await supabase.from('card_config').upsert(compatibleRow).select('*').single();
    data = retry.data;
    error = retry.error;
  }
  if (error) {
    const uploadedPaths = [uploadedLogoPath, uploadedSignaturePath].filter((path): path is string => Boolean(path));
    if (uploadedPaths.length) await supabase.storage.from(ASSET_BUCKET).remove(uploadedPaths);
    throw error;
  }

  if (config.institutionLogoPath && config.institutionLogoPath !== institutionLogoPath) {
    await supabase.storage.from(ASSET_BUCKET).remove([config.institutionLogoPath]);
  }
  if (config.adminSignaturePath && config.adminSignaturePath !== adminSignaturePath) {
    await supabase.storage.from(ASSET_BUCKET).remove([config.adminSignaturePath]);
  }

  return hydrateConfig(data as ConfigRow);
}
