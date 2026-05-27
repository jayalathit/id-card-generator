/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

type CaptureCopy = {
  host: HTMLDivElement;
  element: HTMLElement;
};

function mountCaptureCopy(source: HTMLElement, width: number, height: number, top: number): CaptureCopy {
  const host = document.createElement('div');
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
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
    opacity: '1',
    visibility: 'visible',
    transform: 'none'
  });

  host.appendChild(element);
  document.body.appendChild(host);
  return { host, element };
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
 * Searches and replaces all OKLCH color definitions with custom parsed RGBA colors that are fully compatible with html2canvas.
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
 * Searches and replaces all OKLAB color definitions with custom parsed RGBA colors that are fully compatible with html2canvas.
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

/**
 * Downloads high-fidelity operator card PDFs
 */
export async function downloadIDCardPDF(
  studentName: string,
  idNumber: string,
  frontElementId: string,
  backElementId: string,
  mode: 'exact' | 'a4_sheet' = 'exact',
  orientation: 'portrait' | 'landscape' = 'portrait'
): Promise<boolean> {
  const frontEl = document.getElementById(frontElementId);
  const backEl = document.getElementById(backElementId);

  if (!frontEl || !backEl) {
    console.error(`Cannot find elements: ${frontElementId} or ${backElementId}`);
    return false;
  }

  const originalGetComputedStyle = window.getComputedStyle;
  const captureCopies: CaptureCopy[] = [];

  try {
    // Intercept window.getComputedStyle to automatically sanitize any 'oklch' values.
    // getComputedStyle contains modern color definitions in Oklch form for Tailwind CSS v4 variables
    // which crashes html2canvas's internal colorparser. By proxying the style values and converting
    // oklch values to fully equivalent RGBA elements, we ensure html2canvas executes reliably and retains accurate brand coloring.
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

    try {
      const isLandscape = orientation === 'landscape';
      const captureWidth = isLandscape ? 650 : 410;
      const captureHeight = isLandscape ? 410 : 650;
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

      // Temporarily apply clean, high-resolution layout and capture canvases
      // Using high zoom scaling (3x) for flawless print output quality
      const canvasOptions = {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        allowTaint: true,
        width: captureWidth,
        height: captureHeight,
        scrollX: 0,
        scrollY: 0,
        windowWidth: captureWidth,
        windowHeight: captureHeight
      };

      const canvasFront = await html2canvas(frontCapture.element, canvasOptions);
      const canvasBack = await html2canvas(backCapture.element, canvasOptions);

      const imgFront = canvasFront.toDataURL('image/jpeg', 0.98);
      const imgBack = canvasBack.toDataURL('image/jpeg', 0.98);

      const filename = `${studentName.trim().replace(/\s+/g, '_')}_ID_${idNumber.replace(/\s+/g, '_')}.pdf`;

      if (mode === 'exact') {
        const cardWidth = isLandscape ? 85.6 : 54;
        const cardHeight = isLandscape ? 54 : 85.6;

        const pdf = new jsPDF({
          orientation: orientation,
          unit: 'mm',
          format: [cardWidth, cardHeight]
        });

        // Page 1: Front
        pdf.addImage(imgFront, 'JPEG', 0, 0, cardWidth, cardHeight, undefined, 'FAST');
        
        // Page 2: Back
        pdf.addPage([cardWidth, cardHeight], orientation);
        pdf.addImage(imgBack, 'JPEG', 0, 0, cardWidth, cardHeight, undefined, 'FAST');

        pdf.save(filename);
      } else {
        // A4 printable layout centering Front & Back horizontally, stacked vertically
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4' // 210mm x 297mm
        });

        const cardWidth = isLandscape ? 85.6 : 54;
        const cardHeight = isLandscape ? 54 : 85.6;
        const xOffset = (210 - cardWidth) / 2;

        // Title & Instruction headers
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.setTextColor(12, 35, 64);
        pdf.text('Jayalath Campus - ID Print Sheet', 105, 18, { align: 'center' });

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        pdf.setTextColor(100, 110, 120);
        pdf.text('Use A4 card stock, print at 100% scale, and cut along the dashed guidelines.', 105, 24, { align: 'center' });

        // -- FRONT CARD SECTION --
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(15, 23, 42);
        pdf.text('FRONT SIDE', 105, 34, { align: 'center' });

        // Subtle crop line guide container
        pdf.setDrawColor(200, 200, 200);
        pdf.setLineDashPattern([2, 2], 0);
        pdf.rect(xOffset - 0.5, 37.5, cardWidth + 1, cardHeight + 1, 'S');

        // Draw client front side
        pdf.addImage(imgFront, 'JPEG', xOffset, 38, cardWidth, cardHeight, undefined, 'FAST');

        // -- BACK CARD SECTION --
        const backYText = isLandscape ? 114 : 138;
        const backYImage = isLandscape ? 118 : 142;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(15, 23, 42);
        pdf.text('REVERSE SIDE', 105, backYText, { align: 'center' });

        // Subtle crop line guide container
        pdf.rect(xOffset - 0.5, backYImage - 0.5, cardWidth + 1, cardHeight + 1, 'S');

        // Draw client back side
        pdf.addImage(imgBack, 'JPEG', xOffset, backYImage, cardWidth, cardHeight, undefined, 'FAST');

        // Footnote information
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(7.5);
        pdf.setTextColor(130, 130, 130);
        const generatedDate = new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(new Date());
        pdf.text(`Generated via Operator ID Management Platform on ${generatedDate}`, 105, 260, { align: 'center' });
        
        pdf.save(filename);
      }
    } finally {
      // Restore original getComputedStyle method
      window.getComputedStyle = originalGetComputedStyle;
      captureCopies.forEach(({ host }) => host.remove());
    }

    return true;
  } catch (error) {
    console.error('Failed to generate card PDF:', error);
    return false;
  }
}
