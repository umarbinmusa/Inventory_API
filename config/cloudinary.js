import { v2 as cloudinary } from "cloudinary";

// The SDK auto-configures itself from process.env.CLOUDINARY_URL if it's
// set (format: cloudinary://<api_key>:<api_secret>@<cloud_name>) - that's
// the simplest option (one env var, copy-pasted straight from the
// Cloudinary dashboard). Individual vars are supported as a fallback for
// anyone who'd rather set them separately.
if (!process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

export default cloudinary;
