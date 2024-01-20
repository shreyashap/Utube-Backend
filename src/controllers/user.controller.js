import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = await user.generteAccessToken();
    const refreshToken = await user.generteRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiError(
      500,
      "Something went wrong while genearting access adn refresh token"
    );
  }
};

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

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    throw new ApiError(400, "username or email is required");
  }
  const user = await User.findOne({
    email,
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1, // this removes the field from document
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});
export { registerUser, loginUser, logoutUser };
