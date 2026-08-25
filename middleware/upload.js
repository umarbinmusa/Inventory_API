import multer from "multer";

// Memory storage only - the file never touches this server's disk. Its
// buffer is handed straight to Cloudinary (see server.js's /api/upload
// route), which is what actually stores and serves the image.
const storage = multer.memoryStorage();

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const fileFilter = (_req, file, cb) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return cb(new Error("Only PNG, JPEG, WEBP, or GIF images are allowed."));
  }
  cb(null, true);
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
});
