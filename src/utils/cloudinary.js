import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const uploadOnCloudinary = async (filePath) => {
  try {
    if (!filePath) return null;
    const cloudinaryResponse = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    return cloudinaryResponse;
  } catch (err) {
    console.error("Error in uploading file on cloud :", err);
    fs.unlinkSync(filePath);
    return null;
  }
};

export default uploadOnCloudinary;
