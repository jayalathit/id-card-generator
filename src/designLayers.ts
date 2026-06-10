import { CanvasElement, TemplateSurface } from './types';

export interface BuiltinLayer {
  id: string;
  name: string;
}

export const TEMPLATE_LAYERS: Record<TemplateSurface, BuiltinLayer[]> = {
  'student-front': [
    { id: 'front-slot', name: 'Card slot' },
    { id: 'front-watermark', name: 'Watermark' },
    { id: 'front-header', name: 'Header and logo' },
    { id: 'front-wave', name: 'Header accent bars' },
    { id: 'front-title', name: 'Card title' },
    { id: 'front-photo', name: 'Portrait photo' },
    { id: 'front-details', name: 'Identity details' },
    { id: 'front-badges', name: 'Training details' },
    { id: 'front-signature', name: 'Signature' },
    { id: 'front-footer', name: 'Footer bar' }
  ],
  'student-back': [
    { id: 'back-slot', name: 'Card slot' },
    { id: 'back-watermark', name: 'Watermark' },
    { id: 'back-header', name: 'Header' },
    { id: 'back-safety', name: 'Safety instructions' },
    { id: 'back-contact', name: 'Emergency contact' },
    { id: 'back-verify', name: 'Verification QR' },
    { id: 'back-statement', name: 'Training statement' },
    { id: 'back-address', name: 'Address' },
    { id: 'back-footer', name: 'Footer bar' }
  ],
  'operator-front': [
    { id: 'front-watermark', name: 'Watermark' },
    { id: 'front-wave', name: 'Corner accent bars' },
    { id: 'front-header', name: 'Header and logo' },
    { id: 'front-brand-logo', name: 'Header logo' },
    { id: 'front-brand-wordmark', name: 'Jayalath wordmark' },
    { id: 'front-brand-tagline', name: 'Header tagline' },
    { id: 'front-official-title', name: 'Official ID title' },
    { id: 'front-details', name: 'Operator details group' },
    { id: 'front-title-card', name: 'Operator title card' },
    { id: 'front-title-icon', name: 'Operator title icon' },
    { id: 'front-title-text', name: 'Forklift / operator title' },
    { id: 'front-info-rows', name: 'Operator data rows' },
    { id: 'front-photo', name: 'Photo and signature' },
    { id: 'front-verify', name: 'QR and validity' },
    { id: 'front-issued-by', name: 'Issued by text' },
    { id: 'front-verify-text', name: 'Verify website text' },
    { id: 'front-footer', name: 'Footer bar' },
    { id: 'front-footer-left-cap', name: 'Footer left gold bar' },
    { id: 'front-footer-slogan', name: 'Footer slogan' },
    { id: 'front-footer-right-cap', name: 'Footer right gold bar' }
  ],
  'operator-back': [
    { id: 'back-watermark', name: 'Watermark' },
    { id: 'back-wave', name: 'Top accent bars' },
    { id: 'back-header', name: 'Header' },
    { id: 'back-operator-title', name: 'Operator ID title' },
    { id: 'back-brand-logo', name: 'Back header logo' },
    { id: 'back-brand-wordmark', name: 'Back Jayalath wordmark' },
    { id: 'back-brand-tagline', name: 'Back header tagline' },
    { id: 'back-statement', name: 'Identification and validity' },
    { id: 'back-verify', name: 'Verification QR' },
    { id: 'back-contact', name: 'Contact row' },
    { id: 'back-footer', name: 'Footer bar' }
  ]
};

export function surfaceFor(designation: 'student' | 'operator' | undefined, showBack: boolean): TemplateSurface {
  return `${designation || 'student'}-${showBack ? 'back' : 'front'}` as TemplateSurface;
}

export function baseCanvasElement(surface: TemplateSurface, id: string, name: string, kind: CanvasElement['kind'] = 'builtin'): CanvasElement {
  const defaultZIndex = id.endsWith('slot')
    ? 20
    : (id.endsWith('watermark') || id.endsWith('wave') ? 0 : 10);
  return {
    id,
    surface,
    name,
    kind,
    x: 0,
    y: 0,
    rotation: 0,
    scale: 1,
    opacity: 1,
    zIndex: kind === 'builtin' ? defaultZIndex : 30
  };
}

export function getCanvasElement(elements: CanvasElement[], surface: TemplateSurface, id: string): CanvasElement | undefined {
  return elements.find((element) => element.surface === surface && element.id === id);
}

export function visibleLayers(elements: CanvasElement[], surface: TemplateSurface): CanvasElement[] {
  const adjustedBuiltin = TEMPLATE_LAYERS[surface].map((layer) => (
    getCanvasElement(elements, surface, layer.id) || baseCanvasElement(surface, layer.id, layer.name)
  ));
  const custom = elements.filter((element) => element.surface === surface && element.kind !== 'builtin');
  return [...adjustedBuiltin, ...custom];
}
