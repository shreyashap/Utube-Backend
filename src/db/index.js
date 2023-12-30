import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.DATABSE_URL}/${DB_NAME}`
    );
    console.log(
      "Successfully connected to mongodb :",
      connectionInstance.connection.host
    );
  } catch (err) {
    console.error("Failed to connect mongodb : ", err);
    process.exit(1);
  }
};

export default connectDB;
