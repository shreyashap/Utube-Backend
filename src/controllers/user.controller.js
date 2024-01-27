import { asyncHandler } from "../utils/AsyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { User } from "../models/user.model.js";
import jwt from "jsonwebtoken";
import uploadOnCloudinary from "../utils/cloudinary.js";

const options = {
  httpOnly: true,
  secure: true,
};
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

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async () => {
  const userToken = req.cookies?.refreshToken || req.body.refreshToken;
  if (!userToken) {
    throw new ApiError(404, "unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(userToken, process.env.ACCESS_TOKEN_SECRET);

    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    if (userToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }

    const { accessToken, newRefreshToken } = generateAccessAndRefreshTokens(
      user._id
    );

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken,
            refreshToken: newRefreshToken,
          },
          "Access token refreshed"
        )
      );
  } catch (err) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;

  if (newPassword !== confirmPassword) {
    throw new ApiError(409, "New and confirm password didnt match");
  }

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
  if (!isPasswordCorrect) {
    throw new ApiError(409, "Invalid password");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "password changed successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "current user fetched successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;

  if (!email || !fullName) {
    throw new ApiError(409, "Provide email and fullName ");
  }

  User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Account details updated"));
});

const updateAvtarAndCoverImage = asyncHandler(async () => {
  const avtarLocalPath = req.files?.avtar[0].path;
  const coverImageLocalPath = req.files?.coverImage[0].path;
  if (!avtarLocalPath || coverImageLocalPath) {
    throw new ApiError(409, "Avtar or cover image file is missing");
  }
  const avtar = await uploadOnCloudinary(avtarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  if (!avtar.url) {
    throw new ApiError(500, "Errpr while uploading avtar file");
  }
  if (!coverImage.url) {
    throw new ApiError(500, "Errpr while uploading cover image file");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avtar: avtar.url,
        coverImage: coverImage.url,
      },
    },
    {
      new: true,
    }
  ).select("-password");

  return res
    .status(200)
    .json(new ApiResponse(200, { user }, "Images updated successfully"));
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  updateAccountDetails,
  updateAvtarAndCoverImage,
};
