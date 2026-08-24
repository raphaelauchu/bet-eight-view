// Normalise n'importe quel format d'image (JPG, PNG, HEIC, ...) en JPEG via canvas,
// pour garantir un format compatible avec l'API Anthropic (vision) peu importe la
// source (galerie photo, capture native iOS, etc.).
export function fichierVersJpegBase64(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unsupported_image')); };
    img.src = url;
  });
}
