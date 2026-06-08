/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import { getFontEmbedCSS, toPng } from 'html-to-image';

type CaptureCopy = {
  host: HTMLDivElement;
  element: HTMLElement;
};

type CaptureSize = {
  width: number;
  height: number;
};

type CardCaptureImages = {
  front: string;
  back: string;
  width: number;
  height: number;
};

function mountCaptureCopy(source: HTMLElement, width: number, height: number, top: number): CaptureCopy {
  const host = document.createElement('div');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    boxSizing: 'border-box',
    overflow: 'hidden',
    opacity: '1',
    visibility: 'visible',
    pointerEvents: 'none',
    zIndex: '-1',
    backgroundColor: '#ffffff'
  });
  host.className = 'pdf-export-host';

  const element = source.cloneNode(true) as HTMLElement;
  element.removeAttribute('id');
  element.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
  Object.assign(element.style, {
    width: `${width}px`,
    height: `${height}px`,
    boxSizing: 'border-box',
    opacity: '1',
    visibility: 'visible',
    transform: 'none'
  });

  host.appendChild(element);
  document.body.appendChild(host);
  return { host, element };
}

async function captureElementImage(element: HTMLElement, size: CaptureSize, fontEmbedCSS?: string): Promise<string> {
  element.getBoundingClientRect();
  return toPng(element, {
    cacheBust: true,
    pixelRatio: 3,
    backgroundColor: '#ffffff',
    width: size.width,
    height: size.height,
    style: {
      width: `${size.width}px`,
      height: `${size.height}px`,
      margin: '0',
      transform: 'none',
      transformOrigin: 'top left'
    },
    fontEmbedCSS
  });
}

function safeFileName(studentName: string, idNumber: string, extension: 'pdf' | 'jpg'): string {
  return `${studentName.trim().replace(/\s+/g, '_')}_ID_${idNumber.replace(/\s+/g, '_')}.${extension}`;
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

/**
 * Approximate but highly accurate conversion from OKLAB color space values to sRGB.
 */
function oklabToRgb(l: number, a_lab: number, b_lab: number, a: number = 1): string {
  const l_lms = l + 0.3963377774 * a_lab + 0.2158037573 * b_lab;
  const m_lms = l - 0.1055613458 * a_lab - 0.0638541728 * b_lab;
  const s_lms = l - 0.0894841775 * a_lab - 1.2914855414 * b_lab;

  const l_cube = l_lms * l_lms * l_lms;
  const m_cube = m_lms * m_lms * m_lms;
  const s_cube = s_lms * s_lms * s_lms;

  const r_linear = +4.0767416621 * l_cube - 3.3077115913 * m_cube + 0.2309699292 * s_cube;
  const g_linear = -1.2684380046 * l_cube + 2.6097574011 * m_cube - 0.3413190470 * s_cube;
  const b_linear = -0.0041960863 * l_cube - 0.7034186147 * m_cube + 1.7076147010 * s_cube;

  const toSRGB = (x: number) => {
    if (x <= 0.0031308) return 12.92 * x;
    return 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };

  const r = Math.min(255, Math.max(0, Math.round(toSRGB(r_linear) * 255)));
  const g = Math.min(255, Math.max(0, Math.round(toSRGB(g_linear) * 255)));
  const b = Math.min(255, Math.max(0, Math.round(toSRGB(b_linear) * 255)));

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Approximate but highly accurate conversion from OKLCH color space to sRGB Colors.
 * Converts modern OKLCH variables dynamically for seamless layout rendering of PDF canvases.
 */
function oklchToRgb(l: number, c: number, h: number, a: number = 1): string {
  const hRad = (h * Math.PI) / 180;
  const a_lab = c * Math.cos(hRad);
  const b_lab = c * Math.sin(hRad);
  return oklabToRgb(l, a_lab, b_lab, a);
}

/**
 * Searches and replaces all OKLCH color definitions with custom parsed RGBA colors for PDF image rendering.
 */
export function parseAndConvertOklch(val: string): string {
  if (typeof val !== 'string' || !val.includes('oklch')) {
    return val;
  }

  return val.replace(
    /oklch\(\s*([\d.eE+-]+)(%?)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.eE+-]+)(%?))?\s*\)/gi,
    (match, lStr, lPercent, cStr, hStr, aStr, aPercent) => {
      let l = parseFloat(lStr);
      if (lPercent === '%') {
        l = l / 100;
      }
      const c = parseFloat(cStr);
      const h = parseFloat(hStr);
      let a = 1;
      if (aStr) {
        a = parseFloat(aStr);
        if (aPercent === '%') {
          a = a / 100;
        }
      }
      return oklchToRgb(l, c, h, a);
    }
  );
}

/**
 * Searches and replaces all OKLAB color definitions with custom parsed RGBA colors for PDF image rendering.
 */
export function parseAndConvertOklab(val: string): string {
  if (typeof val !== 'string' || !val.includes('oklab')) {
    return val;
  }

  return val.replace(
    /oklab\(\s*([\d.eE+-]+)(%?)\s+([\d.eE+-]+)\s+([\d.eE+-]+)(?:\s*\/\s*([\d.eE+-]+)(%?))?\s*\)/gi,
    (match, lStr, lPercent, aStr, bStr, alphaStr, alphaPercent) => {
      let l = parseFloat(lStr);
      if (lPercent === '%') {
        l = l / 100;
      }
      const aVal = parseFloat(aStr);
      const bVal = parseFloat(bStr);
      let alpha = 1;
      if (alphaStr) {
        alpha = parseFloat(alphaStr);
        if (alphaPercent === '%') {
          alpha = alpha / 100;
        }
      }
      return oklabToRgb(l, aVal, bVal, alpha);
    }
  );
}

async function captureCardImages(
  frontElementId: string,
  backElementId: string,
  orientation: 'portrait' | 'landscape'
): Promise<CardCaptureImages | null> {
  const frontEl = document.getElementById(frontElementId);
  const backEl = document.getElementById(backElementId);

  if (!frontEl || !backEl) {
    console.error(`Cannot find elements: ${frontElementId} or ${backElementId}`);
    return null;
  }

  const originalGetComputedStyle = window.getComputedStyle;
  const captureCopies: CaptureCopy[] = [];

  try {
    const sanitizeValue = (val: any) => {
      if (typeof val === 'string') {
        let clean = val;
        if (clean.includes('oklch')) {
          clean = parseAndConvertOklch(clean);
        }
        if (clean.includes('oklab')) {
          clean = parseAndConvertOklab(clean);
        }
        return clean;
      }
      return val;
    };

    window.getComputedStyle = function (elt: Element, pseudoElt?: string | null) {
      const style = originalGetComputedStyle(elt, pseudoElt);
      return new Proxy(style, {
        get(target, prop) {
          const value = Reflect.get(target, prop);
          if (typeof value === 'function') {
            return function (...args: any[]) {
              const result = value.apply(target, args);
              return sanitizeValue(result);
            };
          }
          return sanitizeValue(value);
        }
      }) as any;
    };

    const isLandscape = orientation === 'landscape';
    const captureWidth = isLandscape ? 660 : 410;
    const captureHeight = isLandscape ? 420 : 650;
    const frontCapture = mountCaptureCopy(frontEl, captureWidth, captureHeight, 0);
    const backCapture = mountCaptureCopy(backEl, captureWidth, captureHeight, captureHeight + 24);
    captureCopies.push(frontCapture, backCapture);

    const assetWaitMs = 1200;
    if (document.fonts?.ready) {
      await Promise.race([
        document.fonts.ready,
        new Promise<void>((resolve) => window.setTimeout(resolve, assetWaitMs))
      ]);
    }

    const captureImages = [...frontCapture.element.querySelectorAll('img'), ...backCapture.element.querySelectorAll('img')];
    await Promise.all(captureImages.map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const timeout = window.setTimeout(resolve, assetWaitMs);
        const finish = () => {
          window.clearTimeout(timeout);
          resolve();
        };
        image.addEventListener('load', finish, { once: true });
        image.addEventListener('error', finish, { once: true });
      });
    }));

    const captureSize = { width: captureWidth, height: captureHeight };
    const fontEmbedCSS = await Promise.race([
      getFontEmbedCSS(frontCapture.element),
      new Promise<string | undefined>((resolve) => window.setTimeout(() => resolve(undefined), assetWaitMs))
    ]);

    const [front, back] = await Promise.all([
      captureElementImage(frontCapture.element, captureSize, fontEmbedCSS),
      captureElementImage(backCapture.element, captureSize, fontEmbedCSS)
    ]);

    return { front, back, width: captureWidth, height: captureHeight };
  } finally {
    window.getComputedStyle = originalGetComputedStyle;
    captureCopies.forEach(({ host }) => host.remove());
  }
}

/**
 * Downloads high-fidelity ID card PDFs.
 */
export async function downloadIDCardPDF(
  studentName: string,
  idNumber: string,
  frontElementId: string,
  backElementId: string,
  mode: 'exact' | 'a4_sheet' = 'exact',
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<boolean> {
  try {
    const images = await captureCardImages(frontElementId, backElementId, orientation);
    if (!images) return false;

    const isLandscape = orientation === 'landscape';
    const filename = safeFileName(studentName, idNumber, 'pdf');

    if (mode === 'exact') {
      const cardWidth = isLandscape ? 88 : 54;
      const cardHeight = isLandscape ? 56 : 85.6;

      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: [cardWidth, cardHeight]
      });

      pdf.addImage(images.front, 'PNG', 0, 0, cardWidth, cardHeight, undefined, 'FAST');
      pdf.addPage([cardWidth, cardHeight], orientation);
      pdf.addImage(images.back, 'PNG', 0, 0, cardWidth, cardHeight, undefined, 'FAST');
      pdf.save(filename);
      return true;
    }

    if (isLandscape) {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const cardWidth = 88;
      const cardHeight = 56;
      const gap = 10;
      const pageWidth = 297;
      const pageHeight = 210;
      const totalWidth = (cardWidth * 2) + gap;
      const startX = (pageWidth - totalWidth) / 2;
      const yOffset = (pageHeight - cardHeight) / 2;

      pdf.addImage(images.front, 'PNG', startX, yOffset, cardWidth, cardHeight, undefined, 'FAST');
      pdf.addImage(images.back, 'PNG', startX + cardWidth + gap, yOffset, cardWidth, cardHeight, undefined, 'FAST');

      pdf.setDrawColor(205, 213, 224);
      pdf.setLineWidth(0.15);
      pdf.rect(startX - 0.5, yOffset - 0.5, cardWidth + 1, cardHeight + 1, 'S');
      pdf.rect(startX + cardWidth + gap - 0.5, yOffset - 0.5, cardWidth + 1, cardHeight + 1, 'S');
      pdf.save(filename);
      return true;
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const cardWidth = 54;
    const cardHeight = 85.6;
    const xOffset = (210 - cardWidth) / 2;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(12, 35, 64);
    pdf.text('Jayalath Campus - ID Print Sheet', 105, 18, { align: 'center' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(100, 110, 120);
    pdf.text('Use A4 card stock, print at 100% scale, and cut along the dashed guidelines.', 105, 24, { align: 'center' });

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(15, 23, 42);
    pdf.text('FRONT SIDE', 105, 34, { align: 'center' });

    pdf.setDrawColor(200, 200, 200);
    pdf.setLineDashPattern([2, 2], 0);
    pdf.rect(xOffset - 0.5, 37.5, cardWidth + 1, cardHeight + 1, 'S');
    pdf.addImage(images.front, 'PNG', xOffset, 38, cardWidth, cardHeight, undefined, 'FAST');

    const backYText = 138;
    const backYImage = 142;
    pdf.text('REVERSE SIDE', 105, backYText, { align: 'center' });
    pdf.rect(xOffset - 0.5, backYImage - 0.5, cardWidth + 1, cardHeight + 1, 'S');
    pdf.addImage(images.back, 'PNG', xOffset, backYImage, cardWidth, cardHeight, undefined, 'FAST');

    pdf.setFont('helvetica', 'italic');
    pdf.setFontSize(7.5);
    pdf.setTextColor(130, 130, 130);
    const generatedDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());
    pdf.text(`Generated via Operator ID Management Platform on ${generatedDate}`, 105, 260, { align: 'center' });

    pdf.save(filename);
    return true;
  } catch (error) {
    console.error('Failed to generate card PDF:', error);
    return false;
  }
}

async function loadDataUrlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

/**
 * Downloads a high-resolution JPEG sheet using the exact captured card artwork.
 */
export async function downloadIDCardJPEG(
  studentName: string,
  idNumber: string,
  frontElementId: string,
  backElementId: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<boolean> {
  try {
    const images = await captureCardImages(frontElementId, backElementId, orientation);
    if (!images) return false;

    const frontImage = await loadDataUrlImage(images.front);
    const backImage = await loadDataUrlImage(images.back);
    const isLandscape = orientation === 'landscape';
    const gap = isLandscape ? 24 : 36;
    const padding = isLandscape ? 0 : 32;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;

    canvas.width = Math.max(frontImage.naturalWidth, backImage.naturalWidth) + (padding * 2);
    canvas.height = frontImage.naturalHeight + backImage.naturalHeight + gap + (padding * 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const frontX = Math.round((canvas.width - frontImage.naturalWidth) / 2);
    const backX = Math.round((canvas.width - backImage.naturalWidth) / 2);
    const frontY = padding;
    const backY = padding + frontImage.naturalHeight + gap;

    ctx.drawImage(frontImage, frontX, frontY);
    ctx.drawImage(backImage, backX, backY);

    downloadDataUrl(canvas.toDataURL('image/jpeg', 0.98), safeFileName(studentName, idNumber, 'jpg'));
    return true;
  } catch (error) {
    console.error('Failed to generate card JPEG:', error);
    return false;
  }
}
