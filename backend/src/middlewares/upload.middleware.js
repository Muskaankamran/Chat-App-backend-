import multer from "multer";
import { getSupportedMediaType } from "../utils/media-validation.js";

const storage = multer.memoryStorage()

const upload = multer({
    storage,
    limits:{
        fileSize: 5 * 1024 * 1024 //5MB
    }
})

const chatUpload = multer({
    storage,
    limits: {
        fileSize: 15 * 1024 * 1024
    },
    fileFilter(_req, file, callback) {
        callback(null, getSupportedMediaType(file.mimetype) !== null);
    }
});

export { chatUpload };
export default upload;