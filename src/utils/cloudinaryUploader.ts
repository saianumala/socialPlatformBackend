import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import fs from "fs";
import "dotenv/config";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

export async function cloudinaryUpload(
  filePath: string,
  fieldname: string,
  filename: string
): Promise<UploadApiResponse> {
  const uploadResult = await cloudinary.uploader.upload(filePath, {
    resource_type: "auto",
    // use_filename: true,
    public_id: filename.split(".")[0].slice(0, 40) + Date.now(),
    folder: fieldname,
    allowed_formats: ["jpg", "mp4", "jpeg", "mov", "png", "gif"],
  });
  if (!uploadResult) {
    console.log("upload failed inside uploader");
  }
  if (filePath !== process.env.DEFAULT_PIC) {
    fs.unlink(filePath, (err) => {
      if (err) {
        console.log("error in fs.unlink", err);
      } else {
        console.log("local file deleted");
      }
    });
  }
  return uploadResult;
}
export async function cloudinaryDelete(cloudinaryURL: string) {
  const name = cloudinaryURL.split("/")[7].split(".")[0];

  const deleteResult = await cloudinary.uploader.destroy(
    name,
    {
      invalidate: true,
    },
    (error, result) => {
      if (error) {
        console.log("Error:", error);
      } else {
        console.log("prev post or profile deleted", result);
      }
    }
  );
  console.log(deleteResult);
}
