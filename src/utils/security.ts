/**
 * Módulo de Seguridad y Sanitización para RGDev.Web.PdfEditor
 * Incluye validación de tipos MIME reales, magic bytes para PDFs e imágenes,
 * límites de memoria (anti-DoS), sanitización de nombres de archivo,
 * sanitización profunda de SVGs contra XSS y sanitización de texto para pdf-lib.
 */

// Límite máximo para PDFs: 100 MB para evitar DoS por agotamiento de memoria
export const MAX_PDF_SIZE_BYTES = 100 * 1024 * 1024;

// Límite máximo para imágenes: 20 MB
export const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

// Límite máximo de páginas para prevenir DoS y agotamiento de memoria en navegador
export const MAX_PDF_PAGES = 150;

// Tipos MIME permitidos para imágenes
export const ALLOWED_IMAGE_MIMES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml',
];

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Sanitiza un nombre de archivo para prevenir Path Traversal, colisiones con dispositivos
 * de Windows y caracteres peligrosos para sistemas de archivos o navegadores.
 */
export function sanitizeFileName(rawName: string, fallback = 'documento.pdf'): string {
  if (!rawName || typeof rawName !== 'string') return fallback;

  // Remover path traversal y caracteres peligrosos
  let clean = rawName
    .replace(/[/\\]/g, '_') // slashes
    .replace(/\.\.+/g, '') // directory traversal ..
    .replace(/[<>:"|?*]/g, '_') // caracteres prohibidos en Windows/POSIX
    .replace(/[\x00-\x1F\x7F]/g, '') // caracteres de control ASCII
    .replace(/^\.+/, '') // prevenir archivos ocultos al inicio
    .trim();

  // Si coincide con un nombre reservado de Windows (ej. CON, PRN, AUX, NUL)
  if (WINDOWS_RESERVED_NAMES.test(clean)) {
    clean = `archivo_${clean}`;
  }

  // Limitar longitud para evitar desbordamientos de buffer en SO/navegador
  if (clean.length > 120) {
    const extIdx = clean.lastIndexOf('.');
    const ext = extIdx > 0 ? clean.substring(extIdx) : '';
    clean = clean.substring(0, 120 - ext.length) + ext;
  }

  return clean || fallback;
}

/**
 * Garantiza que un nombre de archivo termine con la extensión .pdf
 */
export function ensurePdfExtension(fileName: string, fallback = 'documento.pdf'): string {
  const safe = sanitizeFileName(fileName, fallback);
  return safe.toLowerCase().endsWith('.pdf') ? safe : `${safe}.pdf`;
}

/**
 * Valida la cabecera mágica (Magic Bytes) de un archivo PDF: '%PDF-' (0x25, 0x50, 0x44, 0x46, 0x2D)
 */
export function verifyPdfMagicBytes(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 5) return false;
  const header = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 1024));
  const decoder = new TextDecoder('latin1');
  const str = decoder.decode(header);
  return str.includes('%PDF-');
}

/**
 * Valida los magic bytes para formatos de imagen (PNG, JPEG, WebP, SVG).
 */
export function verifyImageMagicBytes(buffer: ArrayBuffer, mimeType: string, fileName: string): boolean {
  if (buffer.byteLength < 4) return false;
  const bytes = new Uint8Array(buffer);
  const lowerName = fileName.toLowerCase();

  // 1. PNG: 89 50 4E 47 0D 0A 1A 0A
  const isPng =
    mimeType === 'image/png' || lowerName.endsWith('.png');
  if (isPng && bytes.length >= 8) {
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    ) {
      return true;
    }
  }

  // 2. JPEG: FF D8 FF
  const isJpeg =
    mimeType === 'image/jpeg' ||
    mimeType === 'image/jpg' ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg');
  if (isJpeg && bytes.length >= 3) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
      return true;
    }
  }

  // 3. WebP: RIFF (0..3) ... WEBP (8..11)
  const isWebp =
    mimeType === 'image/webp' || lowerName.endsWith('.webp');
  if (isWebp && bytes.length >= 12) {
    const isRiff =
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    const isWebpHeader =
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    if (isRiff && isWebpHeader) {
      return true;
    }
  }

  // 4. SVG: Archivo de texto XML que contiene la etiqueta <svg
  const isSvg =
    mimeType === 'image/svg+xml' || lowerName.endsWith('.svg');
  if (isSvg) {
    try {
      const slice = bytes.subarray(0, Math.min(bytes.length, 1024));
      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(slice).toLowerCase();
      // Debe contener la etiqueta svg y no tener bytes de control binarios iniciales de ejecutables
      if (text.includes('<svg') || text.includes('<?xml')) {
        return true;
      }
    } catch {
      return false;
    }
  }

  // Si no coincidió con el tipo esperado pero coincide con alguno de los formatos seguros conocidos
  if (bytes.length >= 8) {
    const isPngFallback =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47;
    const isJpegFallback =
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isWebpFallback =
      bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46;
    if (isPngFallback || isJpegFallback || isWebpFallback) {
      return true;
    }
  }

  return false;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Valida un archivo PDF en subida (tipo, tamaño y cabecera mágica).
 */
export async function validatePdfFile(file: File): Promise<ValidationResult> {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo.' };
  }

  // 1. Tamaño máximo
  if (file.size > MAX_PDF_SIZE_BYTES) {
    return {
      valid: false,
      error: `El archivo supera el tamaño máximo permitido de 100 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'El archivo está vacío (0 bytes).',
    };
  }

  // 2. Extensión o tipo MIME básico
  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith('.pdf') && file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'El archivo seleccionado no tiene formato PDF.',
    };
  }

  // 3. Verificación de Magic Bytes
  try {
    const slice = await file.slice(0, 1024).arrayBuffer();
    if (!verifyPdfMagicBytes(slice)) {
      return {
        valid: false,
        error: 'El archivo no contiene una cabecera PDF válida (%PDF-). Puede estar dañado o tener una extensión falsa.',
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Error de lectura al validar la integridad del archivo PDF.',
    };
  }

  return { valid: true };
}

/**
 * Valida un archivo de imagen en subida, comprobando formato, tamaño y magic bytes reales.
 */
export async function validateImageFile(file: File): Promise<ValidationResult> {
  if (!file) {
    return { valid: false, error: 'No se seleccionó ninguna imagen.' };
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return {
      valid: false,
      error: `La imagen supera el tamaño máximo permitido de 20 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'El archivo de imagen está vacío (0 bytes).',
    };
  }

  const isAllowedMime = ALLOWED_IMAGE_MIMES.includes(file.type.toLowerCase());
  const lowerName = file.name.toLowerCase();
  const hasAllowedExt =
    lowerName.endsWith('.png') ||
    lowerName.endsWith('.jpg') ||
    lowerName.endsWith('.jpeg') ||
    lowerName.endsWith('.webp') ||
    lowerName.endsWith('.svg');

  if (!isAllowedMime && !hasAllowedExt) {
    return {
      valid: false,
      error: 'Formato de imagen no compatible. Usa PNG, JPG, WebP o SVG.',
    };
  }

  // Verificación estricta de Magic Bytes en los primeros bytes del archivo
  try {
    const slice = await file.slice(0, 2048).arrayBuffer();
    if (!verifyImageMagicBytes(slice, file.type, file.name)) {
      return {
        valid: false,
        error: 'Los bytes internos del archivo no corresponden a una imagen válida (PNG, JPG, WebP o SVG). Puede estar corrupto o tener extensión alterada.',
      };
    }
  } catch {
    return {
      valid: false,
      error: 'Error al comprobar los datos binarios de la imagen.',
    };
  }

  return { valid: true };
}

/**
 * Sanitiza contenido SVG desarmando scripts, animaciones ejecutables,
 * vectores externos, eventos inline y elementos peligrosos para evitar DOM XSS.
 */
export function sanitizeSvgXml(svgText: string): string {
  if (!svgText || typeof svgText !== 'string') {
    throw new Error('El contenido SVG está vacío.');
  }

  // Prevenir ataques de entidad XML (XML entity expansion / Billion Laughs / XXE)
  if (/<!entity/i.test(svgText) || /<!doctype/i.test(svgText)) {
    // Remover declaraciones DOCTYPE y ENTITY para prevenir DoS por expansión
    svgText = svgText
      .replace(/<!DOCTYPE[^>]*(\[[^\]]*\])?>/gi, '')
      .replace(/<!ENTITY[^>]*>/gi, '');
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');

  // Si hay error de parsing
  const parserError = doc.querySelector('parsererror');
  if (parserError) {
    throw new Error('El archivo SVG no tiene una estructura XML válida o está mal formado.');
  }

  // Tags prohibidos que pueden ejecutar JavaScript o cargar recursos externos arbitrarios
  const dangerousTags = [
    'script',
    'foreignobject',
    'iframe',
    'embed',
    'object',
    'applet',
    'meta',
    'link',
    'style', // Previene CSS injection, @import y expression()
    'animate', // Previene XSS por manipulación de atributos SVG
    'animatemotion',
    'animatetransform',
    'set',
    'discard',
    'handler',
    'listener',
  ];

  dangerousTags.forEach((tagName) => {
    const elements = doc.querySelectorAll(tagName);
    elements.forEach((el) => el.remove());
  });

  // Limpiar referencias externas en elementos <use>
  const useElements = doc.querySelectorAll('use');
  useElements.forEach((useEl) => {
    const href = useEl.getAttribute('href') || useEl.getAttribute('xlink:href') || '';
    // Solo permitir fragmentos locales (#simbolo), prohibir URLs externas (http, data, javascript)
    if (href && !href.startsWith('#')) {
      useEl.remove();
    }
  });

  // Limpiar todos los atributos peligrosos de todos los elementos restantes
  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el) => {
    const attrsToRemove: string[] = [];
    for (let i = 0; i < el.attributes.length; i++) {
      const attr = el.attributes[i];
      const attrName = attr.name.toLowerCase();
      const attrValue = attr.value.trim().toLowerCase();

      // Atributos de evento on* (onclick, onload, onerror, onmouseover, etc.)
      if (attrName.startsWith('on')) {
        attrsToRemove.push(attr.name);
        continue;
      }

      // Enlaces o referencias peligrosas javascript:, vbscript:, data:
      if (
        attrName === 'href' ||
        attrName === 'xlink:href' ||
        attrName.endsWith(':href') ||
        attrName === 'src' ||
        attrName === 'action' ||
        attrName === 'formaction'
      ) {
        if (
          attrValue.startsWith('javascript:') ||
          attrValue.startsWith('vbscript:') ||
          (attrValue.startsWith('data:') && !attrValue.startsWith('data:image/'))
        ) {
          attrsToRemove.push(attr.name);
          continue;
        }
      }

      // Estilos en línea con vectores de inyección
      if (attrName === 'style') {
        if (
          attrValue.includes('url(') ||
          attrValue.includes('expression(') ||
          attrValue.includes('@import') ||
          attrValue.includes('-moz-binding') ||
          attrValue.includes('behavior:')
        ) {
          attrsToRemove.push(attr.name);
          continue;
        }
      }
    }

    attrsToRemove.forEach((name) => el.removeAttribute(name));
  });

  const serializer = new XMLSerializer();
  return serializer.serializeToString(doc);
}

/**
 * Sanitiza texto para fuentes estándar de pdf-lib (WinAnsi / Latin-1).
 * Reemplaza caracteres Unicode no mapeables (como comillas tipográficas, guiones largos o emojis)
 * para prevenir excepciones no controladas de tipo "WinAnsi cannot encode" en tiempo de exportación.
 */
export function sanitizeWinAnsiText(text: string): string {
  if (!text) return '';

  return text
    // Comillas tipográficas
    .replace(/[\u201C\u201D\u201E\u201F\u00AB\u00BB]/g, '"')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    // Guiones largos y viñetas
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2022\u2023\u25E6]/g, '*')
    .replace(/\u2026/g, '...')
    // Reemplazar caracteres fuera del rango seguro WinAnsi (código > 255)
    .replace(/[^\x00-\xFF]/g, '?');
}
