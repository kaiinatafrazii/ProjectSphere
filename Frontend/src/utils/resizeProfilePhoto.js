export function resizeProfilePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    return Promise.reject(new Error('Choose a JPG, PNG, or WebP image.'));
  }
  if (file.size > 5 * 1024 * 1024) {
    return Promise.reject(new Error('Choose an image smaller than 5 MB.'));
  }

  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    const releaseUrl = () => URL.revokeObjectURL(objectUrl);
    image.onload = () => {
      releaseUrl();
      try {
        const maxDimension = 512;
        const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('This image could not be processed. Try another image.'));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.78, 0.68, 0.58, 0.48]) {
          const imageData = canvas.toDataURL('image/jpeg', quality);
          const base64Length = imageData.length - 'data:image/jpeg;base64,'.length;
          if (Math.ceil(base64Length * 3 / 4) <= 512000) {
            resolve(imageData);
            return;
          }
        }
        reject(new Error('This image is too detailed to save. Choose a smaller image.'));
      } catch {
        reject(new Error('This image could not be processed. Try another image.'));
      }
    };
    image.onerror = () => {
      releaseUrl();
      reject(new Error('This image could not be read. Try another image.'));
    };
    image.src = objectUrl;
  });
}
