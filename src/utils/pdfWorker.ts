import * as pdfjsLib from 'pdfjs-dist';
// Vite URL import for worker
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}

export { pdfjsLib };
export default pdfjsLib;
