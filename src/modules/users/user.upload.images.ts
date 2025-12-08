import { diskStorage } from 'multer';
import { extname } from 'path';

export const userImageUpload = {
  storage: diskStorage({
    destination: './uploads/users', // folder to store images
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const extension = extname(file.originalname); // keep original extension
      cb(null, uniqueSuffix + extension);
    },
  }),
  fileFilter: (req, file, cb) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      cb(new Error('Only image files are allowed!'), false);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      cb(null, true);
    }
  },
};
