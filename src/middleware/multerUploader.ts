import { NextFunction, Request, Response } from "express";
import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./files/");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.originalname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

export function multerUploadMiddleware(fieldName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const upload = multer({
      storage: storage,
      fileFilter(req, file, cb) {
        const filetypes = /jpeg|jpg|png|gif|mp4|mov/;
        const extname = filetypes.test(
          path.extname(file.originalname).toLowerCase()
        );
        const mimetype = filetypes.test(file.mimetype);

        if (mimetype && extname) {
          cb(null, true);
        } else {
          cb(new Error("file format not supported"));
        }
      },
    }).single(fieldName);

    upload(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          return res
            .status(400)
            .json({ message: `Multer error: ${err.message}` });
        } else {
          return res.status(400).json({ message: `${err.message}` });
        }
      }
      next();
    });
  };
}
