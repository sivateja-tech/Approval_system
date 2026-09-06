const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary with your .env credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Configure Multer to use Cloudinary
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'fund_requests', // Creates a folder in your Cloudinary account
    resource_type: 'auto',   // IMPORTANT: Allows PDFs, Docs, and spreadsheets (not just images)
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv']
  }
});

// 10MB file size limit
const upload = multer({ 
  storage: storage, 
  limits: { fileSize: 10 * 1024 * 1024 } 
});

module.exports = upload;