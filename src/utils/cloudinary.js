import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

const ulpoadOnCloudinary = async (filePath) => {
  try {
    if (!filePath) return;

    const cloudinaryResponse = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    console.log("Cloudinary response :", cloudinaryResponse.url);
    return cloudinaryResponse;
  } catch (err) {
    fs.unlinkSync(filePath);
    return null;
  }
};

export default ulpoadOnCloudinary;
