/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { CSSProperties, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { CanvasElement, CardConfig, Student, TemplateSurface } from '../types';
import jayalathWordmarkUrl from '../assets/jayalath-wordmark.png';
import associateChiuTengUrl from '../assets/associate-chiu-teng.png';
import associateGlobalWorkforceUrl from '../assets/associate-global-workforce.png';
import associateOverseasVocationalUrl from '../assets/associate-overseas-vocational.png';
import adminDepartmentSignatureUrl from '../assets/admin-department-signature.png';
import { baseCanvasElement, getCanvasElement, surfaceFor, TEMPLATE_LAYERS } from '../designLayers';
import { 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Calendar, 
  Briefcase, 
  Award, 
  BookOpen, 
  Globe, 
  Fingerprint
} from 'lucide-react';

interface IDCardProps {
  student: Student;
  config: CardConfig;
  showBack?: boolean;
  designMode?: boolean;
  selectedLayerId?: string;
  selectedSurface?: TemplateSurface;
  onSelectLayer?: (surface: TemplateSurface, id: string) => void;
  onChangeLayer?: (surface: TemplateSurface, id: string, changes: Partial<CanvasElement>) => void;
}

function verificationUrl(configuredUrl: string, idNumber: string): string {
  const input = /^https?:\/\//i.test(configuredUrl.trim())
    ? configuredUrl.trim()
    : `https://${configuredUrl.trim()}`;

  try {
    const url = new URL(input);
    url.searchParams.set('id', idNumber);
    return url.toString();
  } catch {
    return `https://example.invalid/verify?id=${encodeURIComponent(idNumber)}`;
  }
}

const OPERATOR_GRADE_GUIDE = [
  { grade: 'A', marks: '85-100 marks', label: 'Advanced competency' },
  { grade: 'B', marks: '70-84 marks', label: 'Professional competency' },
  { grade: 'C', marks: '55-69 marks', label: 'Operational competency' }
];

const ASSOCIATE_COMPANIES = [
  { name: 'Jayalath Chiu Teng Lanka', logo: associateChiuTengUrl },
  { name: 'Jayalath Global Workforce', logo: associateGlobalWorkforceUrl },
  { name: 'Jayalath Overseas Vocational Training Institute', logo: associateOverseasVocationalUrl }
];

const STUDENT_HEAD_OFFICE_ADDRESS = 'Jayalath Campus\nNugadolawatta,\nAttanagalla Road,\nPasyala (Off Kandy Road)';
const OPERATOR_HEAD_OFFICE_ADDRESS = '658, Dr. Danister De Silva Road,\nColombo 9,\nSri Lanka.';
const DEFAULT_PRIMARY_CONTACT = '+94 70 250 3503';
const DEFAULT_SECONDARY_CONTACT = '+94 11 750 3503';
const DEFAULT_WEBSITE = 'jceti.com';
const DEFAULT_EMAIL = 'info@jceti.com';
const DESIGN_SNAP_STEP = 5;

function snapDesignValue(value: number): number {
  return Math.round(value / DESIGN_SNAP_STEP) * DESIGN_SNAP_STEP;
}

function formatSriLankanPhone(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('94')) return `+${digits.replace(/^94(\d{2})(\d{3})(\d{4})$/, '94 $1 $2 $3')}`;
  if (digits.startsWith('0') && digits.length === 10) {
    const withoutLeadingZero = digits.slice(1);
    return `+94 ${withoutLeadingZero.slice(0, 2)} ${withoutLeadingZero.slice(2, 5)} ${withoutLeadingZero.slice(5)}`;
  }
  return trimmed;
}

function websiteFromVerificationUrl(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return DEFAULT_WEBSITE;
  return trimmed.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/verification\/?$/i, '') || DEFAULT_WEBSITE;
}

export const IDCard: React.FC<IDCardProps> = ({
  student,
  config,
  showBack = false,
  designMode = false,
  selectedLayerId,
  selectedSurface,
  onSelectLayer,
  onChangeLayer
}) => {
  const [backQrUrl, setBackQrUrl] = useState<string>('');

  const card_designation = student.cardDesignation || 'student';
  const equipment_type = student.equipmentType || 'forklift';
  const templateDetails = card_designation === 'operator' ? config.operatorDetails : config.studentDetails;
  const equipment_class = student.equipmentClass || (equipment_type === 'forklift'
    ? 'Counterbalance Forklift / Class A'
    : 'JCB Backhoe Loader / Class A');
  const primaryContact = formatSriLankanPhone(templateDetails.backContactPhone, DEFAULT_PRIMARY_CONTACT);
  const secondaryContact = formatSriLankanPhone(templateDetails.backContactEmail, DEFAULT_SECONDARY_CONTACT);
  const defaultHeadOfficeAddress = card_designation === 'operator' ? OPERATOR_HEAD_OFFICE_ADDRESS : STUDENT_HEAD_OFFICE_ADDRESS;
  const headOfficeAddress = (templateDetails.backAddress || defaultHeadOfficeAddress).replace(/\\n/g, '\n');
  const website = websiteFromVerificationUrl(templateDetails.backVerificationUrl);
  const [mainFieldCode = 'HMA', , trainingMethodCode = 'FC'] = String(student.idNumber || '').toUpperCase().split('/');
  const courseCategory = ({
    HMA: 'Heavy Machinery',
    HCA: 'Health Care'
  } as Record<string, string>)[mainFieldCode] || mainFieldCode;
  const courseType = ({
    FC: 'Full Course',
    TT: 'Trade Test',
    GAP: 'Gap Filling'
  } as Record<string, string>)[trainingMethodCode] || trainingMethodCode;
  const surface = surfaceFor(card_designation, showBack);
  const layoutElements = config.canvasElements || [];
  const dragRef = useRef<{ id: string; pointerId: number; startX: number; startY: number; x: number; y: number } | null>(null);
  const adminSignatureImage = config.adminSignatureImage?.startsWith('data:')
    ? config.adminSignatureImage
    : adminDepartmentSignatureUrl;
  const operatorDefaultSignatureImage = adminDepartmentSignatureUrl;
  const operatorSignatureImage = student.signatureType !== 'typed' && student.signatureImage?.startsWith('data:')
    ? student.signatureImage
    : operatorDefaultSignatureImage;

  const layerValue = (id: string): CanvasElement => {
    const name = TEMPLATE_LAYERS[surface].find((layer) => layer.id === id)?.name || id;
    return getCanvasElement(layoutElements, surface, id) || baseCanvasElement(surface, id, name);
  };

  const beginDrag = (event: React.PointerEvent<HTMLDivElement>, element: CanvasElement) => {
    if (!designMode) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      id: element.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: element.x,
      y: element.y
    };
    onSelectLayer?.(surface, element.id);
  };

  const continueDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!designMode || !drag || drag.pointerId !== event.pointerId) return;
    onChangeLayer?.(surface, drag.id, {
      x: snapDesignValue(drag.x + event.clientX - drag.startX),
      y: snapDesignValue(drag.y + event.clientY - drag.startY)
    });
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
    }
  };

  const editorProps = (id: string): React.HTMLAttributes<HTMLDivElement> => {
    const element = layerValue(id);
    const isBackgroundLayer = id.endsWith('watermark');
    const savedElement = getCanvasElement(layoutElements, surface, id);
    return {
      'data-design-layer': id,
      'data-design-selected': designMode && selectedSurface === surface && selectedLayerId === id ? 'true' : undefined,
      title: designMode ? element.name : undefined,
      onPointerDown: designMode && !isBackgroundLayer ? (event) => beginDrag(event, element) : undefined,
      onPointerMove: designMode && !isBackgroundLayer ? continueDrag : undefined,
      onPointerUp: designMode && !isBackgroundLayer ? endDrag : undefined,
      style: {
        transform: `translate(${element.x}px, ${element.y}px) rotate(${element.rotation}deg) scale(${element.scale})`,
        opacity: element.hidden ? 0 : element.opacity,
        zIndex: savedElement?.zIndex,
        visibility: element.hidden && !designMode ? 'hidden' : undefined,
        pointerEvents: designMode && !isBackgroundLayer ? 'auto' : undefined
      }
    };
  };

  const selectedClass = (id: string) => (
    designMode && selectedSurface === surface && selectedLayerId === id ? 'design-layer-active' : ''
  );

  const typographyStyle = (
    id: string,
    defaults: { fontSize?: number; lineHeight?: number; letterSpacing?: number } = {}
  ): CSSProperties => {
    const element = layerValue(id);
    return {
      fontSize: element.fontSize ? `${element.fontSize}px` : (defaults.fontSize ? `${defaults.fontSize}px` : undefined),
      lineHeight: element.lineHeight || defaults.lineHeight,
      letterSpacing: typeof element.letterSpacing === 'number'
        ? `${element.letterSpacing}px`
        : (typeof defaults.letterSpacing === 'number' ? `${defaults.letterSpacing}px` : undefined)
    };
  };

  const layerBoxStyle = (id: string, defaults: { width?: number; height?: number } = {}): CSSProperties => {
    const element = layerValue(id);
    return {
      width: element.width ? `${element.width}px` : (defaults.width ? `${defaults.width}px` : undefined),
      height: element.height ? `${element.height}px` : (defaults.height ? `${defaults.height}px` : undefined)
    };
  };

  const cardDesignModeClass = designMode ? ' design-grid-active' : '';

  const customLayers = () => layoutElements
    .filter((element) => element.surface === surface && element.kind !== 'builtin')
    .map((element) => {
      const style: CSSProperties = {
        position: 'absolute',
        left: element.x,
        top: element.y,
        width: element.width || 100,
        height: element.kind === 'text' ? 'auto' : (element.height || 50),
        color: element.color || config.primaryColor,
        background: element.kind === 'text' ? 'transparent' : (element.fill || config.accentColor),
        border: element.kind === 'text' ? undefined : `1px solid ${element.borderColor || element.fill || config.accentColor}`,
        borderRadius: 0,
        fontSize: element.fontSize || 16,
        fontWeight: 700,
        lineHeight: element.lineHeight || 1.1,
        letterSpacing: typeof element.letterSpacing === 'number' ? element.letterSpacing : undefined,
        textAlign: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transform: `rotate(${element.rotation}deg) scale(${element.scale})`,
        opacity: element.hidden ? 0 : element.opacity,
        visibility: element.hidden && !designMode ? 'hidden' : undefined,
        zIndex: element.zIndex,
        cursor: designMode ? 'move' : undefined,
        pointerEvents: designMode ? 'auto' : 'none'
      };

      return (
        <div
          key={`${surface}-${element.id}`}
          data-design-layer={element.id}
          data-design-selected={designMode && selectedSurface === surface && selectedLayerId === element.id ? 'true' : undefined}
          title={designMode ? element.name : undefined}
          style={style}
          onPointerDown={designMode ? (event) => beginDrag(event, element) : undefined}
          onPointerMove={designMode ? continueDrag : undefined}
          onPointerUp={designMode ? endDrag : undefined}
        >
          {element.kind === 'text' ? element.text : null}
        </div>
      );
    });

  const cardStyle = (width: string, height: string): CSSProperties => ({
    width,
    height,
    minWidth: width,
    minHeight: height,
    boxSizing: 'border-box',
    '--card-primary': config.primaryColor || '#0c2340',
    '--card-accent': config.accentColor || '#e2a812'
  } as CSSProperties);

  // Generate real dynamic QR codes when student data or URLs change
  useEffect(() => {
    // Back QR Code encodes the direct verification website url
    const backData = verificationUrl(templateDetails.backVerificationUrl, student.idNumber);
    QRCode.toDataURL(backData, {
      margin: 1,
      width: 200,
      color: {
        dark: '#0c2340',
        light: '#ffffff'
      }
    })
      .then(url => setBackQrUrl(url))
      .catch(err => console.error("Error generating back QR", err));
  }, [student, templateDetails.backVerificationUrl, card_designation, equipment_type]);

  // A generic profile avatar placeholder SVG
  const AvatarPlaceholder = () => (
    <svg width="64" height="64" className="w-16 h-16 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
    </svg>
  );

  const CampusMark = ({ size = 42 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-label="Jayalath Campus logo" className="block">
      <rect x="1.5" y="1.5" width="45" height="45" fill="#ffffff" stroke="#0c2340" strokeWidth="3" />
      <path d="M9 14h30v3H9z" fill="#e2a812" />
      <path d="M13 21h7v12c0 2.4-1.9 4-4.5 4-1.6 0-2.9-.5-4-1.5l2.1-2.7c.5.5 1 .7 1.5.7.7 0 1-.4 1-1.2V21z" fill="#0c2340" />
      <path d="M36.2 32.5c-1.5 2.9-4 4.5-7.3 4.5-4.7 0-8.1-3.5-8.1-8.1 0-4.7 3.5-8.2 8.2-8.2 3.2 0 5.8 1.6 7.2 4.4l-3.6 1.7c-.7-1.5-1.9-2.3-3.5-2.3-2.3 0-4 1.8-4 4.4 0 2.5 1.7 4.3 4 4.3 1.6 0 2.8-.8 3.6-2.4z" fill="#0c2340" />
    </svg>
  );

  const BrandLogo = ({ size = 42 }: { size?: number }) => (
    config.institutionLogo ? (
      <img
        src={config.institutionLogo}
        alt="Jayalath Campus logo"
        style={{ width: size, height: size }}
        className="object-contain"
      />
    ) : (
      <CampusMark size={size} />
    )
  );

  const OperatorJayalathBrand = ({
    logoSize = 42,
    wordmarkWidth = 155,
    wordmarkHeight = 25,
    taglineSize = 5.8,
    showLogo = true
  }: {
    logoSize?: number;
    wordmarkWidth?: number;
    wordmarkHeight?: number;
    taglineSize?: number;
    showLogo?: boolean;
  }) => (
    <div className="inline-flex items-center justify-center select-none">
      {showLogo && (
        <div
          className="flex items-center justify-center overflow-hidden shrink-0 mr-2.5"
          style={{ width: logoSize, height: logoSize }}
        >
          <BrandLogo size={logoSize} />
        </div>
      )}
      <div className="flex flex-col items-center justify-center leading-none">
        <img
          src={jayalathWordmarkUrl}
          alt="JAYALATH"
          className="object-contain object-center"
          style={{ width: wordmarkWidth, height: wordmarkHeight }}
          draggable={false}
        />
        <span
          className="text-[#e2a812] font-sans font-black uppercase tracking-[0.035em] leading-[0.92] text-center block mt-[1px]"
          style={{ width: wordmarkWidth, fontSize: taglineSize }}
        >
          <span className="block">CAMPUS FOR CAREER EDUCATION</span>
          <span className="block">&amp; TRAINING INSTITUTE</span>
        </span>
      </div>
    </div>
  );

  // High-fidelity graphic watermarks of Forklift or Backhoe Loader
  const ForkliftWatermark = () => (
    <svg width="180" height="180" viewBox="0 0 100 100" fill="currentColor" className="w-[180px] h-[180px] text-[#0c2340] opacity-[0.03] select-none pointer-events-none">
      <path d="M5 65 h40 l10 -15 h15 v12 h-10 v15 h-55 z" />
      <rect x="63" y="25" width="4" height="48" rx="1" />
      <path d="M17 62 l6 -28 h18 l10 28" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="16" cy="72" r="11" />
      <circle cx="51" cy="72" r="11" />
      <path d="M67 50 h22 v4 h-22 z" />
      <path d="M79 54 v15 h10 v3 h-14 v-18 z" />
    </svg>
  );

  const BackhoeWatermark = () => (
    <svg width="180" height="180" viewBox="0 0 100 100" fill="currentColor" className="w-[180px] h-[180px] text-[#0c2340] opacity-[0.03] select-none pointer-events-none">
      <path d="M30 35 h24 l8 20 h-32 z" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="25" y="55" width="30" height="15" />
      <circle cx="28" cy="72" r="14" />
      <circle cx="52" cy="75" r="9" />
      <path d="M15 65 l-10 -18 l-12 10" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M55 65 l15 4 l8 -14 l-6 -6 z" />
    </svg>
  );

  // ==========================================
  // LANDSCAPE CARD RENDER (OPERATOR CARD METHOD)
  // ==========================================
  if (card_designation === 'operator') {
    if (showBack) {
      // Landscape Operator ID Back Side
      return (
        <div 
          id={`card-back-${student.id}`}
          className={`id-card-surface relative bg-white border border-slate-300 overflow-hidden text-slate-800 flex flex-col justify-between p-5 select-none print:m-0 print:border-0 print:shadow-none shadow-xl${cardDesignModeClass}`}
          style={cardStyle('660px', '420px')}
        >
          {/* Watermark in background */}
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none" {...editorProps('back-watermark')}>
            {equipment_type === 'forklift' ? <ForkliftWatermark /> : <BackhoeWatermark />}
          </div>

          {/* Precision top accent rails */}
          <div className="absolute top-0 left-0 right-0 h-[10px] overflow-hidden pointer-events-none select-none z-0" {...editorProps('back-wave')}>
            <div className="absolute top-0 inset-x-0 h-[7px] bg-[#0c2340]" />
            <div className="absolute top-[7px] inset-x-0 h-[3px] bg-[#e2a812]" />
          </div>

          {/* Top Row Header area */}
          <div className="relative z-10 flex items-center justify-between mt-[2px] mb-2" {...editorProps('back-header')}>
            {/* Header left: OPERATOR ID with line */}
            <div className="flex flex-col text-left w-[170px] shrink-0">
              <span className="font-sans font-black text-[22px] text-[#0c2340] tracking-tight uppercase leading-none whitespace-nowrap block">
                OPERATOR ID
              </span>
              <div className="flex items-center gap-[1.5px] mt-1.5 h-[3px] w-28 rounded-full overflow-hidden">
                <div className="h-full w-24 bg-[#e2a812]" />
                <div className="h-full w-4 bg-[#0c2340]" />
              </div>
            </div>

            {/* Header right: Institution brand model logo */}
            <div className="flex items-center justify-center pr-1 shrink-0">
              <OperatorJayalathBrand
                logoSize={28}
                wordmarkWidth={82}
                wordmarkHeight={19}
                taglineSize={3.7}
              />
            </div>
          </div>

          {/* Central content splitting columns */}
          <div className="relative z-10 grid grid-cols-12 gap-4 items-start mt-[10px] px-1">
            {/* Left side details */}
            <div className="col-span-7 flex flex-col gap-2" {...editorProps('back-statement')}>
              <div className="grid grid-cols-[28px_1fr] gap-3 border-l-[3px] border-[#0c2340] bg-slate-50/80 px-3 py-2 min-h-[58px]">
                <div className="w-[28px] h-[28px] bg-[#0c2340] flex items-center justify-center text-white flex-shrink-0 shadow-sm">
                  <ShieldCheck size={15} className="stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <span className="text-[8.6px] font-black text-[#0c2340] tracking-[0.16em] uppercase leading-none block">
                    Authorized Operator Credential
                  </span>
                  <p className="text-[9.4px] font-semibold text-slate-600 leading-[1.28] mt-1.5 max-w-[270px]">
                    This card is an official identification for authorized heavy equipment operators only. It is non-transferable and must be carried while on duty.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[28px_1fr] gap-3 border-l-[3px] border-[#e2a812] bg-white px-3 py-2 min-h-[52px] shadow-sm">
                <div className="w-[28px] h-[28px] bg-[#e2a812] flex items-center justify-center text-[#0c2340] flex-shrink-0 shadow-sm">
                  <Calendar size={15} className="stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <span className="text-[8.6px] font-black text-[#e2a812] uppercase tracking-[0.16em] leading-none block">
                    VALIDITY
                  </span>
                  <p className="text-[9.4px] font-semibold text-slate-600 leading-[1.28] mt-1.5 max-w-[270px]">
                    This ID card is valid for <span className="text-[#0c2340] font-black uppercase">{templateDetails.validityYears} YEAR{templateDetails.validityYears === 1 ? '' : 'S'}</span> from the date of certification.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-[28px_1fr] gap-3 border-l-[3px] border-slate-300 bg-white px-3 py-2 shadow-sm">
                <div className="w-[28px] h-[28px] bg-slate-100 flex items-center justify-center text-[#0c2340] flex-shrink-0 shadow-sm">
                  <Award size={15} className="stroke-[2.5]" />
                </div>
                <div className="text-left">
                  <span className="text-[8.6px] font-black text-[#0c2340] uppercase tracking-[0.16em] leading-none block">
                    Grade Classification Guide
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 mt-1.5">
                    {OPERATOR_GRADE_GUIDE.map((item) => (
                      <div key={item.grade} className="border border-slate-200 bg-slate-50 px-1.5 py-1.5 min-h-[37px]">
                        <span className="text-[10.6px] font-black text-[#0c2340] leading-none block">Grade {item.grade}</span>
                        <span className="text-[7.7px] font-black text-[#e2a812] uppercase leading-none block mt-1">{item.marks}</span>
                        <span className="text-[6.9px] font-bold text-slate-500 uppercase leading-none block mt-1">{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right side verification */}
            <div className="col-span-5 flex justify-end" {...editorProps('back-verify')}>
              <div className="w-[196px] flex flex-col gap-2">
                <div className="border border-slate-200 bg-white shadow-sm">
                  <div className="h-[24px] bg-[#0c2340] flex items-center justify-center text-white text-[8px] font-black tracking-[0.18em] uppercase border-b-[3px] border-[#e2a812]">
                    Verify Operator
                  </div>
                  <div className="p-2.5 flex flex-col items-center">
                    <div className="bg-white border border-slate-300 p-1 w-[92px] h-[92px] flex items-center justify-center">
                      {backQrUrl ? (
                        <img src={backQrUrl} alt="Back Verification Qr code" className="w-[84px] h-[84px] object-contain" />
                      ) : (
                        <div className="w-full h-full bg-slate-100" />
                      )}
                    </div>
                    <div className="mt-2 w-full border-t border-slate-100 pt-2 flex items-start gap-2">
                      <Globe size={12} className="text-[#e2a812] flex-shrink-0 mt-[1px]" />
                      <div className="flex flex-col leading-none text-left min-w-0">
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider leading-none block">
                          Website verification
                        </span>
                        <span className="text-[7.9px] font-extrabold text-[#0c2340] tracking-wide block break-all leading-snug select-all mt-1">
                          {templateDetails.backVerificationUrl}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="border border-[#d8dee8] bg-white px-2 py-1.5 shadow-sm">
                  <span className="block text-center text-[6.6px] font-black text-slate-400 uppercase tracking-[0.16em] leading-none">
                    Associate Companies
                  </span>
                  <div className="grid grid-cols-3 gap-1.5 items-center mt-1.5">
                    {ASSOCIATE_COMPANIES.map((company) => (
                      <div key={company.name} className="h-[38px] bg-white border border-[#d8dee8] flex items-center justify-center p-1">
                        <img src={company.logo} alt={company.name} className="max-h-[29px] max-w-[46px] object-contain" draggable={false} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Contacts Row */}
          <div className="relative z-10 grid grid-cols-3 gap-0 border-t border-gray-200 mt-auto mb-[18px]" {...editorProps('back-contact')}>
            {/* Column 1 Address */}
            <div className="grid grid-cols-[14px_1fr] gap-2 pt-[10px] pr-3">
              <div className="w-[14px] h-[14px] flex items-start justify-center pt-[1px]">
                <MapPin size={12} className="text-[#e2a812] flex-shrink-0" />
              </div>
              <div className="text-left min-w-0">
                <strong className="text-[9px] font-black text-[#0c2340] tracking-wider uppercase block leading-none">HEAD OFFICE</strong>
                <p className="text-[8.8px] font-semibold text-slate-500 mt-[5px] tracking-tight leading-normal whitespace-pre-wrap">{headOfficeAddress}</p>
              </div>
            </div>
            {/* Column 2 Contact */}
            <div className="grid grid-cols-[14px_1fr] gap-2 border-x border-gray-200 pt-[10px] px-3">
              <div className="w-[14px] h-[14px] flex items-start justify-center pt-[1px]">
                <Phone size={12} className="text-[#e2a812] flex-shrink-0" />
              </div>
              <div className="text-left min-w-0">
                <strong className="text-[9px] font-black text-[#0c2340] tracking-wider uppercase block leading-none">CONTACT</strong>
                <p className="text-[8.8px] font-semibold text-slate-500 mt-[5px] leading-tight select-all">{primaryContact}<br/>{secondaryContact}</p>
              </div>
            </div>
            {/* Column 3 Website and email */}
            <div className="grid grid-cols-[14px_1fr] gap-2 pt-[10px] pl-3">
              <div className="w-[14px] h-[14px] flex items-start justify-center pt-[1px]">
                <Mail size={12} className="text-[#e2a812] flex-shrink-0" />
              </div>
              <div className="text-left min-w-0">
                <strong className="text-[9px] font-black text-[#0c2340] tracking-wider uppercase block leading-none">WEB / EMAIL</strong>
                <p className="text-[8.8px] font-semibold text-slate-500 mt-[5px] leading-tight select-all">{website}<br/>{DEFAULT_EMAIL}</p>
              </div>
            </div>
          </div>

          {/* Dark Blue bottom footer bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[22px] bg-[#0c2340] pointer-events-none select-none flex items-center justify-center border-t border-slate-800" {...editorProps('back-footer')}>
            <div className="flex items-center gap-4 w-full px-6">
              <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-[#e2a812]/50" />
              <span className="text-[8.6px] font-sans font-black text-white uppercase tracking-[0.18em] mt-0.5 shrink-0 block">
                SAFETY FIRST. SKILLS ALWAYS.
              </span>
              <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-[#e2a812]/50" />
            </div>
          </div>
          {customLayers()}
        </div>
      );
    } else {
      // Landscape Operator ID Front Side (Image 1)
      const infoRows = [
        { label: 'NIC NO.', value: student.nic || '199012345V', icon: Fingerprint },
        { label: 'NAME', value: student.name || 'JOHN PERERA', icon: User },
        { label: 'ID NUMBER', value: student.idNumber || '', icon: Award },
        { label: 'GRADE', value: student.grade || 'A', icon: ShieldCheck },
        { label: 'COURSE', value: student.course || (equipment_type === 'forklift' ? 'FORKLIFT OPERATOR CERTIFICATION' : 'BACKHOE LOADER CERTIFICATION'), icon: BookOpen },
        { label: 'ISSUE DATE', value: student.issueDate || '26/05/2026', icon: Calendar },
        { label: 'TRAINING CENTER', value: student.trainingCenter || 'JAYALATH CAMPUS', icon: Briefcase }
      ];

      return (
        <div 
          id={`card-front-${student.id}`}
          className={`id-card-surface relative bg-white border border-slate-300 overflow-hidden text-slate-800 flex flex-col justify-between p-5 select-none print:m-0 print:border-0 print:shadow-none shadow-xl${cardDesignModeClass}`}
          style={cardStyle('660px', '420px')}
        >
          {/* Watermark in background */}
          <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none" {...editorProps('front-watermark')}>
            {equipment_type === 'forklift' ? <ForkliftWatermark /> : <BackhoeWatermark />}
          </div>

          {/* Precision corner accent rails */}
          <div className="absolute top-0 right-0 w-[240px] h-[10px] pointer-events-none overflow-hidden z-0" {...editorProps('front-wave')}>
            <div className="absolute top-0 inset-x-0 h-[7px] bg-[#0c2340]" />
            <div className="absolute top-[7px] inset-x-0 h-[3px] bg-[#e2a812]" />
          </div>

          {/* Top Row Header area */}
          <div className="relative z-10 flex items-center justify-between" {...editorProps('front-header')}>
            {/* Header left: balanced Jayalath Campus brand lockup */}
            <div className="flex items-center justify-center min-w-[310px]">
              <div className="inline-flex items-center justify-center select-none">
                <div
                  className={`flex items-center justify-center overflow-hidden shrink-0 mr-2.5 ${selectedClass('front-brand-logo')}`}
                  {...editorProps('front-brand-logo')}
                  style={{
                    ...editorProps('front-brand-logo').style,
                    ...layerBoxStyle('front-brand-logo', { width: 48, height: 48 })
                  }}
                >
                  <BrandLogo size={layerValue('front-brand-logo').width || 48} />
                </div>
                <div className="flex flex-col items-center justify-center leading-none">
                  <img
                    src={jayalathWordmarkUrl}
                    alt="JAYALATH"
                    className={`object-contain object-center ${selectedClass('front-brand-wordmark')}`}
                    {...editorProps('front-brand-wordmark')}
                    style={{
                      ...editorProps('front-brand-wordmark').style,
                      ...layerBoxStyle('front-brand-wordmark', { width: 190, height: 38 })
                    }}
                    draggable={false}
                  />
                  <span
                    className={`text-[#e2a812] font-sans font-black uppercase tracking-[0.035em] leading-[0.92] text-center block mt-[1px] ${selectedClass('front-brand-tagline')}`}
                    {...editorProps('front-brand-tagline')}
                    style={{
                      ...editorProps('front-brand-tagline').style,
                      ...layerBoxStyle('front-brand-tagline', { width: 190 }),
                      ...typographyStyle('front-brand-tagline', { fontSize: 6.8, lineHeight: 0.92, letterSpacing: 0.2 })
                    }}
                  >
                    <span className="block">CAMPUS FOR CAREER EDUCATION</span>
                    <span className="block">&amp; TRAINING INSTITUTE</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Subdued Vertical Divider line */}
            <div className="w-[1px] h-8 bg-slate-200" />

            {/* Header right: INSTITUTION branding */}
            <div
              className={`flex flex-col text-center pr-3 min-w-[120px] ${selectedClass('front-official-title')}`}
              {...editorProps('front-official-title')}
            >
              <span className="font-sans font-black text-[16px] tracking-tight text-[#0c2340] leading-none uppercase">
                {templateDetails.rightMainHeader || "OFFICIAL ID"}
              </span>
              <span className="text-[9px] font-bold text-[#e2a812] tracking-[0.15em] mt-1.5 leading-none uppercase">
                {templateDetails.rightSubHeader || "CREDENTIAL"}
              </span>
            </div>
          </div>

          {/* Central Section Grid */}
          <div className="relative z-10 grid grid-cols-12 gap-4 items-start mt-3 pb-[46px]">
            {/* Left side parameters list */}
            <div className="col-span-8 flex flex-col gap-2" {...editorProps('front-details')}>
              {/* Title zone: Machine logo box + Heavy operator title labels */}
              <div
                className={`flex items-center text-left w-[300px] h-[46px] bg-white border border-slate-200 shadow-sm ${selectedClass('front-title-card')}`}
                {...editorProps('front-title-card')}
              >
                {/* Visual indicator card */}
                <div
                  className={`w-[48px] h-full bg-slate-50 border-r-[3px] border-[#e2a812] flex-shrink-0 flex items-center justify-center text-[#0c2340] ${selectedClass('front-title-icon')}`}
                  {...editorProps('front-title-icon')}
                >
                  {equipment_type === 'forklift' ? (
                    <svg width="28" height="28" viewBox="0 0 100 100" fill="currentColor" className="w-7 h-7">
                      <path d="M12 65 h40 l10 -15 h15 v12 h-10 v15 h-55 z" />
                      <rect x="70" y="25" width="4" height="48" rx="1" />
                      <path d="M24 62 l6 -28 h18 l10 28" fill="none" stroke="currentColor" strokeWidth="3" />
                      <circle cx="23" cy="72" r="11" />
                      <circle cx="58" cy="72" r="11" />
                      <path d="M74 50 h22 v4 h-22 z" />
                      <path d="M86 54 v15 h10 v3 h-14 v-18 z" />
                    </svg>
                  ) : (
                    <svg width="28" height="28" viewBox="0 0 100 100" fill="currentColor" className="w-7 h-7">
                      <path d="M30 35 h24 l8 20 h-32 z" fill="none" stroke="currentColor" strokeWidth="3" />
                      <rect x="25" y="55" width="30" height="15" />
                      <circle cx="28" cy="72" r="14" />
                      <circle cx="52" cy="75" r="9" />
                      <path d="M15 65 l-10 -18 l-12 10" fill="none" stroke="currentColor" strokeWidth="4" />
                      <path d="M55 65 l15 4 l8 -14 l-6 -6 z" />
                    </svg>
                  )}
                </div>
                
                <div
                  className={`flex flex-col justify-center leading-none pl-4 pr-3 flex-1 ${selectedClass('front-title-text')}`}
                  {...editorProps('front-title-text')}
                >
                  <span
                    className="font-sans font-black text-[20px] text-[#0c2340] tracking-tight uppercase leading-none"
                    style={typographyStyle('front-title-text', { lineHeight: 0.92, letterSpacing: -0.3 })}
                  >
                    {equipment_type === 'forklift' ? 'FORKLIFT' : 'BACKHOE LOADER'}
                  </span>
                  <span
                    className="font-sans font-black text-[17px] text-[#e2a812] tracking-[0.08em] uppercase mt-[2px] leading-none"
                    style={typographyStyle('front-title-text', { lineHeight: 0.92, letterSpacing: 0.7 })}
                  >
                    OPERATOR ID
                  </span>
                </div>
              </div>

              {/* Rows Details columns list with colons - perfectly aligned */}
              <div
                className={`flex flex-col gap-[2px] w-full max-w-[390px] ${selectedClass('front-info-rows')}`}
                {...editorProps('front-info-rows')}
                style={{
                  ...editorProps('front-info-rows').style,
                  rowGap: `${Math.max(0, (layerValue('front-info-rows').lineHeight ?? 1.2) * 1.7)}px`
                }}
              >
                {infoRows.map((row, idx) => {
                  const IconComp = row.icon;
                  return (
                    <div key={idx} className="flex items-center gap-1.5 pb-[1px] leading-none min-h-[19px]">
                      {/* Round icon label button wrapper */}
                      <div className="w-[17px] h-[17px] bg-[#0c2340] rounded flex items-center justify-center text-white flex-shrink-0 shadow border border-slate-800">
                        <IconComp size={8.5} className="stroke-[3]" />
                      </div>
                      {/* Wide fixed label column preventing line wrap */}
                      <span
                        className="w-[104px] text-[8.4px] font-bold text-slate-500 uppercase tracking-[0.14em] block text-left shrink-0"
                        style={typographyStyle('front-info-rows', { lineHeight: 1, letterSpacing: 1.1 })}
                      >
                        {row.label}
                      </span>
                      {/* Aligned colons column */}
                      <span
                        className="text-[9.8px] font-black text-[#0c2340] block w-[10px] shrink-0 text-center pr-1"
                        style={typographyStyle('front-info-rows', { lineHeight: 1 })}
                      >
                        :
                      </span>
                      {/* Uppercase formatted bold values for elite card design */}
                      <span
                        className="flex-1 text-[9.8px] font-black text-[#0c2340] uppercase whitespace-nowrap leading-none mt-[1px] text-left select-all tracking-[0.015em] font-sans"
                        style={typographyStyle('front-info-rows', { lineHeight: 1, letterSpacing: 0.15 })}
                      >
                        {String(row.value).toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right side portrait photo, signature */}
            <div className="col-span-4 flex flex-col items-center pl-2 shrink-0" {...editorProps('front-photo')}>
              {/* Slate dark blue outline border enclosing custom photo */}
              <div className="border-[2px] border-[#0c2340] w-[142px] h-[170px] bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center shadow-md">
                {student.photo ? (
                  <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-300">
                    <AvatarPlaceholder />
                    <div className="text-[7.5px] font-bold uppercase tracking-widest text-[#0c2340]/40 mt-2 leading-none">
                      TRAINEE PHOTO
                    </div>
                  </div>
                )}
              </div>

              {/* Signature section below photo */}
              <div className="flex flex-col items-center justify-center mt-2 z-10 w-[166px]">
                <div className="relative h-11 flex items-end justify-center w-full pb-0.5">
                  <img
                    src={operatorSignatureImage}
                    alt="Admin department signature"
                    className="max-h-11 max-w-[156px] object-contain select-none pointer-events-none"
                  />
                </div>
                {/* Horizontal signature line */}
                <div className="w-full h-[1px] bg-slate-400" />
                <span className="text-[5px] font-black text-slate-400 tracking-[0.12em] uppercase mt-[4px] block leading-none whitespace-nowrap text-center">
                  ADMIN DEPARTMENT SIGNATURE
                </span>
              </div>
            </div>
          </div>

          {/* Compact verification line; full QR verification is provided on the reverse side. */}
          <div className="absolute left-5 right-5 bottom-9 z-10 h-[28px] flex items-center justify-between border-t border-slate-100 pt-1.5" {...editorProps('front-verify')}>
            <span className="w-[230px] text-[7.1px] font-black uppercase tracking-[0.12em] text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis">
              Issued by Jayalath Campus
            </span>
            <span className="w-[245px] text-right text-[7.1px] font-black uppercase tracking-[0.075em] text-[#0c2340] whitespace-nowrap overflow-hidden text-ellipsis">
              Verify: {templateDetails.backVerificationUrl}
            </span>
          </div>

          {/* Solid footer with squared gold terminals */}
          <div className="absolute bottom-0 left-0 right-0 h-9 bg-[#0c2340] border-t-[3px] border-[#e2a812] pointer-events-none select-none overflow-hidden flex items-center justify-between px-6 z-10" {...editorProps('front-footer')}>
            <div className="absolute left-0 bottom-0 top-0 w-2 bg-[#e2a812]" />
            
            {/* Centered slogans with high spacing */}
            <span className="text-[9.6px] font-sans font-black tracking-[0.135em] text-white uppercase z-10 mx-auto block leading-none">
              SAFE HANDS  •  SKILLED MINDS  •  STRONGER FUTURE
            </span>

            <div className="absolute right-0 bottom-0 top-0 w-2 bg-[#e2a812]" />
          </div>
          {customLayers()}
        </div>
      );
    }
  }

  // ==========================================
  // PORTRAIT CARD RENDER (STUDENT CARD METHOD)
  // ==========================================
  if (showBack) {
    // Portrait Student ID Back Side
    return (
      <div 
        id={`card-back-${student.id}`}
        className={`id-card-surface relative bg-white border border-slate-300 overflow-hidden text-slate-800 flex flex-col justify-between p-5 select-none print:m-0 print:border-0 print:shadow-none shadow-xl${cardDesignModeClass}`}
        style={cardStyle('410px', '650px')}
      >
        {/* Punch Card Slot Punch representation on top */}
        <div className="absolute top-2 left-0 right-0 z-20 flex justify-center" {...editorProps('back-slot')}>
          <div className="w-[72px] h-[13px] bg-white rounded-full border border-gray-300 shadow-inner opacity-80" />
        </div>

        {/* Central Graphic Watermark watermark decoration */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none" {...editorProps('back-watermark')}>
          {equipment_type === 'forklift' ? <ForkliftWatermark /> : <BackhoeWatermark />}
        </div>

        {/* Back Upper Banner Title Zone */}
        <div className="relative z-10 flex items-center justify-between mt-3 mb-1 border-b border-gray-200/60 pb-2" {...editorProps('back-header')}>
          {/* logo cap decoration */}
            <div className="w-[52px] h-[52px] flex items-center justify-center">
              <BrandLogo size={48} />
          </div>

          <div className="flex-1 text-right pl-3">
            <h2 className="font-sans font-black text-[22px] tracking-tight text-[#0c2340] uppercase leading-none">
              STUDENT ID
            </h2>
            <div className="flex justify-end items-center gap-1.5 mt-[5px]">
              <span className="h-[2px] w-8 bg-[#e2a812] block rounded-full" />
              <div className="flex gap-0.5">
                <span className="w-1.5 h-2 bg-[#0c2340] -skew-x-[20deg]" />
                <span className="w-1.5 h-2 bg-[#0c2340] -skew-x-[20deg]" />
                <span className="w-1.5 h-2 bg-[#e2a812] -skew-x-[20deg]" />
              </div>
            </div>
          </div>
        </div>

        {/* Central body containing instructions */}
        <div className="relative z-10 flex-1 flex flex-col justify-between pt-1 pb-[50px] my-[2px] font-sans text-left gap-2">
          
          {/* Section: SAFETY INSTRUCTIONS */}
          <div className="flex flex-col gap-1" {...editorProps('back-safety')}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4 h-4 bg-[#0c2340] rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg width="10" height="10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296" />
                </svg>
              </span>
              <span className="text-[10px] font-extrabold text-[#0c2340] tracking-wider uppercase leading-none">
                SAFETY INSTRUCTIONS
              </span>
              <div className="flex-1 h-[1.5px] bg-[#0c2340]/10 rounded-full" />
            </div>
            
            <ul className="flex flex-col gap-1 pl-1 text-[8.5px] font-semibold text-slate-500 leading-tight">
              <li className="flex items-start gap-1.5">
                <span className="text-[#e2a812] text-xs leading-none">•</span>
                <span>Always follow safety rules and training procedures.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#e2a812] text-xs leading-none">•</span>
                <span>Wear required Personal Protective Equipment (PPE) at all times.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#e2a812] text-xs leading-none">•</span>
                <span>Report hazards, incidents, and near misses immediately.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#e2a812] text-xs leading-none">•</span>
                <span>Use equipment ONLY if you are authorized and trained.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-[#e2a812] text-xs leading-none">•</span>
                <span>This card is non-transferable and must be displayed while on-site.</span>
              </li>
            </ul>
          </div>

          {/* Section: EMERGENCY CONTACT */}
          <div className="flex flex-col gap-1" {...editorProps('back-contact')}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4 h-4 bg-[#0c2340] rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg width="10" height="10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25" />
                </svg>
              </span>
              <span className="text-[10px] font-extrabold text-[#0c2340] tracking-wider uppercase leading-none">
                EMERGENCY CONTACT
              </span>
              <div className="flex-1 h-[1.5px] bg-[#0c2340]/10 rounded-full" />
            </div>
            <p className="text-[9px] text-[#0c2340] font-black pl-4 uppercase">
              Contact: {primaryContact} <span className="text-gray-400 font-normal px-1">|</span> {secondaryContact}
            </p>
          </div>

          {/* Section: QR CODE VERIFICATION PORT CAP */}
          <div className="grid grid-cols-12 gap-3 items-center p-3 border border-[#e2a812]/45 bg-[#fff9e8] shadow-[0_10px_24px_rgba(12,35,64,0.08)]" {...editorProps('back-verify')}>
            {/* QR block Left Column */}
            <div className="col-span-5 flex justify-center">
              <div className="bg-white border-[3px] border-[#0c2340] p-1 shadow-lg w-[104px] h-[104px] flex items-center justify-center">
                {backQrUrl ? (
                  <img src={backQrUrl} alt="Back Verification Qr code" className="w-[88px] h-[88px] object-contain" />
                ) : (
                  <div className="w-full h-full bg-slate-100" />
                )}
              </div>
            </div>

            {/* Verification details capsule on right */}
            <div className="col-span-7 flex flex-col gap-1.5">
              <div className="bg-[#0c2340] text-white py-3 px-3.5 flex items-center justify-between gap-2.5 shadow-lg border border-slate-850 min-h-[62px]">
                <div className="w-8 h-8 bg-white/10 flex items-center justify-center text-[#e2a812] flex-shrink-0">
                  <svg width="16" height="16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                </div>
                <div className="w-[1px] h-6 bg-white/20" />
                <div className="flex-1 text-left min-w-0">
                  <span className="text-[7.5px] font-black tracking-widest text-[#e2a812] block uppercase leading-none">
                    VERIFY AT:
                  </span>
                  <span className="text-[8px] font-extrabold text-white block leading-snug break-all mt-0.5 select-all">
                    {templateDetails.backVerificationUrl}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section: AUTHORIZED STUDY STATEMENT */}
          <div className="flex flex-col gap-1" {...editorProps('back-statement')}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4 h-4 bg-[#0c2340] rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg width="10" height="10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                </svg>
              </span>
              <span className="text-[10px] font-extrabold text-[#0c2340] tracking-wider uppercase leading-none">
                AUTHORIZED TRAINING STATEMENT
              </span>
              <div className="flex-1 h-[1.5px] bg-[#0c2340]/10 rounded-full" />
            </div>
            <p className="text-[8.5px] text-slate-500 font-semibold pl-4 leading-normal">
              This ID card confirms that the above-named trainee is enrolled in an approved career training programme conducted by Jayalath Campus.
            </p>
          </div>

          {/* Section: ADDRESS */}
          <div className="flex flex-col gap-1" {...editorProps('back-address')}>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-4 h-4 bg-[#0c2340] rounded-full flex items-center justify-center text-white flex-shrink-0">
                <svg width="10" height="10" className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                  <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </span>
              <span className="text-[10px] font-extrabold text-[#0c2340] tracking-wider uppercase leading-none">
                ADDRESS
              </span>
              <div className="flex-1 h-[1.5px] bg-[#0c2340]/10 rounded-full" />
            </div>
            <p className="text-[8.5px] text-slate-500 font-semibold pl-4 leading-normal whitespace-pre-line tracking-tight uppercase">
              {headOfficeAddress}
            </p>
          </div>

        </div>

        {/* Squared warning footer */}
        <div className="absolute bottom-0 left-0 right-0 h-[52px] bg-[#0c2340] border-t-[4px] border-[#e2a812] pointer-events-none select-none overflow-hidden z-10" {...editorProps('back-footer')}>
          <div className="absolute bottom-2 left-4 right-4 z-20 flex items-center gap-2">
            <div className="w-7 h-7 bg-[#e2a812] flex items-center justify-center text-[#0b1b30] flex-shrink-0">
              <span className="text-sm font-black text-[#0c2340] leading-none mb-0.5 font-mono">!</span>
            </div>
            <div className="text-left text-white leading-tight">
              <span className="text-[7px] font-black text-[#e2a812] uppercase block tracking-wider">
                IMPORTANT NOTE
              </span>
              <span className="text-[8.5px] font-bold text-slate-200 block max-w-[320px] uppercase">
                This card is valid only during the training period shown on the front.
              </span>
            </div>
          </div>
        </div>
        {customLayers()}

      </div>
    );
  }

  // Portrait Student ID Front Side (Image 2 styles)
  return (
    <div 
      id={`card-front-${student.id}`}
      className={`id-card-surface relative bg-white border border-slate-300 overflow-hidden text-slate-800 flex flex-col justify-between p-0 select-none print:m-0 print:border-0 print:shadow-none shadow-xl${cardDesignModeClass}`}
      style={cardStyle('410px', '650px')}
    >
      {/* Absolute top punch card slot representation */}
      <div className="absolute top-2 left-0 right-0 z-20 flex justify-center" {...editorProps('front-slot')}>
        <div className="w-[72px] h-[13px] bg-white rounded-full border border-gray-300 shadow-inner opacity-80" />
      </div>

      {/* Graphic Watermark background placement */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none" {...editorProps('front-watermark')}>
        {equipment_type === 'forklift' ? <ForkliftWatermark /> : <BackhoeWatermark />}
      </div>

      {/* High Fidelity Curved Header Wave block */}
      <div className="relative z-10 w-full bg-[#0c2340] pt-[28px] pb-[16px] px-[18px] flex flex-col justify-end text-white select-none shadow-md" {...editorProps('front-header')}>
        
        {/* Centered institution brand */}
        <div className="flex items-center justify-center">
          <div className="flex flex-col items-center justify-center select-none">
            <div className="w-[52px] h-[52px] flex items-center justify-center overflow-hidden shrink-0">
              <BrandLogo size={52} />
            </div>
            <img
              src={jayalathWordmarkUrl}
              alt="JAYALATH"
              className="h-[27px] w-[210px] object-contain object-center mt-[4px]"
              draggable={false}
            />
            <span className="font-sans font-extrabold text-[6.6px] text-[#e2a812] uppercase tracking-[0.04em] block mt-[2px] leading-[1.05] text-center w-[210px]">
              <span className="block">CAMPUS FOR CAREER EDUCATION</span>
              <span className="block">& TRAINING INSTITUTE</span>
            </span>
          </div>
        </div>

        {/* Crisp transition rails */}
        <div className="absolute left-0 right-0 bottom-[-6px] h-[6px] z-10 pointer-events-none select-none" {...editorProps('front-wave')}>
          <div className="absolute top-0 inset-x-0 h-[4px] bg-[#e2a812]" />
          <div className="absolute top-[4px] inset-x-0 h-[2px] bg-[#0c2340]" />
        </div>
      </div>

      {/* Main Core Identity Details Container */}
      <div className="relative z-10 px-4 pt-[18px] flex-1 flex flex-col justify-start">
        
        {/* Large centered card ID type designation */}
        <div className="flex items-center justify-center gap-3.5 my-3" {...editorProps('front-title')}>
          <div className="h-[1.5px] flex-1 bg-gradient-to-r from-transparent to-[#e2a812]" />
          <span className="font-sans font-black text-[21px] text-[#0c2340] tracking-[0.12em] block uppercase leading-none text-center">
            STUDENT ID
          </span>
          <div className="h-[1.5px] flex-1 bg-gradient-to-l from-transparent to-[#e2a812]" />
        </div>

        {/* Profile and Detail Matrix block */}
        <div className="grid grid-cols-12 gap-3.5 items-start my-2">
          
          {/* Column 1: Portrait photo with gold frame and rounded shadow */}
          <div className="col-span-4 flex justify-center" {...editorProps('front-photo')}>
            <div className="border-[2px] border-[#e2a812] rounded-2.5xl w-[114px] h-[138px] bg-slate-50 relative overflow-hidden flex flex-col items-center justify-center shadow-lg">
              {student.photo ? (
                <img src={student.photo} alt={student.name} className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-300">
                  <AvatarPlaceholder />
                  <div className="text-[7.5px] font-bold uppercase tracking-widest text-[#0c2340]/40 mt-[3px] leading-none">
                    TRAINEE PHOTO
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Aligned Form values with grey bottom borders */}
          <div className="col-span-8 flex flex-col justify-between h-[138px] text-left pl-1" {...editorProps('front-details')}>
            
            {/* Full operator name */}
            <div className="flex flex-col">
              <span className="text-[6.5px] font-black text-slate-400 tracking-wider uppercase leading-none pb-0.5">
                FULL NAME
              </span>
              <span className="text-[13px] font-extrabold text-[#0c2340] uppercase border-b border-slate-100 pb-[3px] leading-tight whitespace-nowrap">
                {String(student.name || "JOHN PERERA").toUpperCase()}
              </span>
            </div>

            {/* Unique register student ID */}
            <div className="flex flex-col">
              <span className="text-[6.5px] font-black text-slate-400 tracking-wider uppercase leading-none pb-0.5">
                STUDENT / TRAINEE ID NO.
              </span>
              <span className="text-[10px] font-black text-[#0c2340] font-mono border-b border-slate-100 pb-[3px] leading-tight tracking-tight select-all whitespace-nowrap">
                {String(student.idNumber || "").toUpperCase()}
              </span>
            </div>

            {/* Course details title */}
            <div className="flex flex-col">
              <span className="text-[6.5px] font-black text-slate-400 tracking-wider uppercase leading-none pb-0.5">
                COURSE TITLE
              </span>
              <span className="text-[10.5px] font-bold text-slate-600 border-b border-slate-100 pb-[3px] leading-tight whitespace-nowrap uppercase">
                {String(student.course || (equipment_type === 'forklift' ? 'FORKLIFT OPERATOR CERTIFICATION' : 'BACKHOE LOADER CERTIFICATION')).toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Lower Row Items (Institutional Badge lists) */}
        <div className="flex flex-col gap-2 mt-4 text-left" {...editorProps('front-badges')}>
          
          {/* Row 1: Issuing school platform */}
          <div className="flex items-center gap-3 py-[2px] border-b border-slate-100">
            <div className="w-7.5 h-7.5 bg-[#0c2340] border-[1.5px] border-[#e2a812] rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <svg width="16" height="16" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[6px] font-black text-slate-400 uppercase tracking-[0.12em] leading-none block">
                TRAINING INSTITUTE / COMPANY
              </span>
              <span className="text-[9.5px] font-black text-[#0c2340] block tracking-tight whitespace-nowrap max-w-[244px] mt-[4px] uppercase">
                {String(student.trainingCenter || "JAYALATH CAMPUS").toUpperCase()}
              </span>
            </div>
          </div>

          {/* Row 2: Selected programme classification */}
          <div className="flex items-center gap-3 py-[2px] border-b border-slate-100">
            <div className="w-7.5 h-7.5 bg-[#0c2340] border-[1.5px] border-[#e2a812] rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <svg width="16" height="16" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[6px] font-black text-slate-400 uppercase tracking-[0.12em] leading-none block">
                COURSE TYPE / CATEGORY
              </span>
              <span className="text-[9.5px] font-black text-[#0c2340] block tracking-tight whitespace-nowrap max-w-[244px] mt-[4px] uppercase">
                {`${courseCategory} / ${courseType}`.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Row 3: Dates */}
          <div className="flex items-center gap-3 py-[2px]">
            <div className="w-7.5 h-7.5 bg-[#0c2340] border-[1.5px] border-[#e2a812] rounded-full flex items-center justify-center text-white flex-shrink-0 shadow-sm">
              <svg width="16" height="16" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <rect width="18" height="18" x="3" y="4" rx="2" />
                <path d="M16 2v4M8 2v4M3 10h18" />
              </svg>
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[6px] font-black text-slate-400 uppercase tracking-[0.12em] leading-none block">
                DATE OF ENROLLMENT
              </span>
              <span className="text-[10px] font-black text-[#0c2340] block tracking-tight whitespace-nowrap mt-[4px] uppercase">
                {String(student.issueDate || '26/05/2026').toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Fine, Handwritten Signature Zone */}
        <div className="mt-4 flex justify-end px-1 border-t border-slate-100 pt-3" {...editorProps('front-signature')}>
          <div className="w-[178px] flex flex-col items-center leading-none">
            <div className="h-11 w-full flex items-end justify-center pb-1">
              <img
                src={adminSignatureImage}
                alt="Admin department signature"
                className="max-h-10 max-w-[168px] object-contain select-none pointer-events-none"
              />
            </div>
            <div className="w-full h-[1px] bg-slate-300" />
            <span className="text-[6.5px] font-black text-slate-400 tracking-[0.14em] uppercase block mt-1.5 text-center">
              ADMIN DEPARTMENT SIGNATURE
            </span>
          </div>
        </div>
      </div>

      {/* Solid footer with squared gold terminals */}
      <div className="absolute bottom-0 left-0 right-0 h-[36px] bg-[#0c2340] border-t-[3px] border-[#e2a812] pointer-events-none select-none overflow-hidden flex items-center justify-between px-6 z-10" {...editorProps('front-footer')}>
        <div className="absolute left-0 bottom-0 top-0 w-2 bg-[#e2a812]" />
        
        {/* Center column footer metrics with gold icons */}
        <div className="w-full h-full flex items-center justify-center gap-10 font-sans z-10 mx-auto">
          {/* Badge 1: SKILL */}
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" className="w-3.5 h-3.5 text-[#e2a812]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2-2s-2 .9-2 2H7c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.04-.42 1.99-1.07 2.25z" />
            </svg>
            <span className="text-[9px] font-black tracking-wider text-white uppercase mt-0.5">
              SKILL
            </span>
          </div>

          {/* Badge 2: SAFETY */}
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" className="w-3.5 h-3.5 text-[#e2a812]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 15l-4-4 1.41-1.41L11 13.17l5.59-5.59L18 9l-7 7z" />
            </svg>
            <span className="text-[9px] font-black tracking-wider text-white uppercase mt-0.5">
              SAFETY
            </span>
          </div>

          {/* Badge 3: PROGRESS */}
          <div className="flex items-center gap-1.5">
            <svg width="14" height="14" className="w-3.5 h-3.5 text-[#e2a812]" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6.18-6.18 4 4L20 9.41 22.29 11.7 23 6z" />
            </svg>
            <span className="text-[9px] font-black tracking-wider text-white uppercase mt-0.5">
              PROGRESS
            </span>
          </div>
        </div>

        <div className="absolute right-0 bottom-0 top-0 w-2 bg-[#e2a812]" />
      </div>
      {customLayers()}

    </div>
  );
};
