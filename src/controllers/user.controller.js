import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
  const { username, email, password, fullName } = req.body;

  if (
    [username, email, password, fullName].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(404, "Fill out the all fields");
  }

  const userExist = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (userExist)
    throw new ApiError(409, "User with username or email already exist");

  const avtarFilePath = req.files?.avtar[0]?.path;
  const coverImagePath = req.files?.coverImage[0]?.path;

  if (!avtarFilePath) throw new ApiError(409, "Avtar image is required");

  const avtar = await uploadOnCloudinary(avtarFilePath);
  const coverImage = await uploadOnCloudinary(coverImagePath);

  if (!avtar) throw new ApiError(409, "Avtar image is required");
  const user = await User.create({
    username,
    email,
    password,
    fullName,
    avtar: avtar.url,
    coverImage: coverImage?.url || "",
  });

  const createdUser = User.findById(user._id).select("-password -refreshToken");

  if (!createdUser) throw new ApiError(500, "Failed to register user");

  return res
    .status(201)
    .json(new ApiResponse(200, "User registred successfully now yo can login"));
});

export default registerUser;
