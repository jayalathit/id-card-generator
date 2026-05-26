import { ASSET_BUCKET, supabase } from '../lib/supabase';
import { CardConfig, Student } from '../types';

const MAX_ASSET_BYTES = 5 * 1024 * 1024;

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

  return {
    id: row.id,
    nic: row.nic,
    name: row.name,
    idNumber: row.id_number,
    grade: row.grade,
    course: row.course,
    issueDate: toDisplayDate(row.issue_date),
    trainingCenter: row.training_center,
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
  return {
    institutionLogo: await signedAssetUrl(row.institution_logo_path),
    institutionLogoPath: row.institution_logo_path || undefined,
    leftMainHeader: row.left_main_header,
    leftSubHeader: row.left_sub_header,
    rightMainHeader: row.right_main_header,
    rightSubHeader: row.right_sub_header,
    validityYears: row.validity_years,
    backVerificationUrl: row.back_verification_url,
    backAddress: row.back_address,
    backContactPhone: row.back_contact_phone,
    backContactEmail: row.back_contact_email,
    backLogoLabel: row.back_logo_label
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
  const row = {
    id: 1,
    institution_logo_path: config.institutionLogoPath || null,
    left_main_header: config.leftMainHeader,
    left_sub_header: config.leftSubHeader,
    right_main_header: config.rightMainHeader,
    right_sub_header: config.rightSubHeader,
    validity_years: config.validityYears,
    back_verification_url: config.backVerificationUrl,
    back_address: config.backAddress,
    back_contact_phone: config.backContactPhone,
    back_contact_email: config.backContactEmail,
    back_logo_label: config.backLogoLabel
  };

  const { data, error } = await supabase.from('card_config').upsert(row).select('*').single();
  if (error) throw error;
  return hydrateConfig(data as ConfigRow);
}
