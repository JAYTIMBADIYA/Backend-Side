import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import jwt from "jsonwebtoken"

const generateAccessTokenAndRefreshToken = async(userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken =  user.generateAccessToken()
        const refreshToken =  user.generateRefreshToken()

        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {
            accessToken,
            refreshToken
        }

    } catch (error) {
        throw new ApiError("Something went wrong while generating access and refresh token", 500) 
    }
    
}

const registerUser = asyncHandler( async (req,res) => {

    //step: 
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, and avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token filed from response
    // check for user creation
    // return response



    const {fullName, email, username, password} = req.body
    console.log("email:-", email);  

    if(
        [fullName, email, username, password].some((filed) => 
        filed?.trim() === "")
    ) {
        throw new ApiError("All fields are required", 400)
    }

   const existedUser = await User.findOne({
        $or: [{username},{email}]
    })

    if(existedUser){
        throw new ApiError("User with email or username already exists", 409)
    }

   const avatarLoccalPath =  req.files?.avatar[0]?.path;
//    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

   let coverImageLocalPath;
   if(req.files && Array.isArray(req.files?.coverImage) && req.files?.coverImage?.length > 0){
       coverImageLocalPath = req.files?.coverImage?.[0]?.path   
   }


   if (!avatarLoccalPath){
    throw new ApiError("Avatar is required", 400)
   }

   const avatar =  await uploadOnCloudinary(avatarLoccalPath)
   const coverImage =  await uploadOnCloudinary(coverImageLocalPath)

   if(!avatar) {
    throw new ApiError("Avatar is required", 400)
   }

   const user =  await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "", 
        email,
        password,
        username: username.toLowerCase(),
    })

    const createdUser =  await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser) {
        throw new ApiError("Something went wrong", 500)
    }

    return res.status(201).json(
        new ApiResponse(201, createdUser,"User created successfully")
    )

})

const loginUser = asyncHandler( async (req,res) => {
    // req body -> data
    // username or email
    // find the user
    // password check
    // access and refresh token
    // send cookie


    const {email, username, password} = req.body

    if(!(username || email)){
        throw new ApiError("Username or email is required", 400)
    }

    const user = await User.findOne({
        $or: [{username},{email}]
    })

    if(!user){
        throw new ApiError("User not found", 404)
    }

    const isPasswordVaild = await user.isPasswordCorrect(password)

    if(!isPasswordVaild){
        throw new ApiError("Incorrect password", 400)
    }

    const {accessToken, refreshToken} = await generateAccessTokenAndRefreshToken(user._id)
    
   const loggedInUser = await User.findById(user._id).
   select("-password -refreshToken")

   const option  = {
    httpOnly: true,
    secure: true
   }

   return res
   .status(200)
   .cookie("accessToken", accessToken, option)
   .cookie("refreshToken", refreshToken, option)
   .json(
    new ApiResponse(
        200,
        {
            user: loggedInUser,accessToken,refreshToken
        },
        "User logged in successfully"
    )
   )
})

const logoutUser = asyncHandler( async (req,res) => {
    await User.findByIdAndUpdate(req.user._id, 
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const option  = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(
        new ApiResponse(
            200,
            {},
            "User logged out successfully"
        )
    )
})

const refreshAccessToken = asyncHandler(async (req,res) => {
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken) {
        throw new ApiError(401, "unothorized request")
    }

    try {
        const decodedToken = jwt.verify( 
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id)        
    
        if(!user) {
            throw new ApiError(401, "Invaild Refresh Token")
        }
    
        if(incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh Token is expired and used")
        }
    
        const option = {
            httpOnly: true,
            secure: true
        }
    
        const {accessToken, newRefreshToken} = await generateAccessTokenAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken", accessToken, option)
        .cookie("refreshToken", newRefreshToken, option)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken: newRefreshToken},
                "Access Token refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
    }
})

const changeCurrentPassword = asyncHandler(async (req,res) => {
    const {oldPassword, newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError("Old password is incorrect", 400)
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res.status(200).json(
        new ApiResponse(200, {}, "Password changed successfully")
    )
})

const getCurrentUser = asyncHandler(async (req,res) => {
    return res.status(200).json(
        new ApiResponse(200, req.user, "User found successfully")
    )
})

const updateAccountDetails = asyncHandler(async (req,res) => {
    const {fullName, email} = req.body

    if(!fullName || !email) {
        throw new ApiError("All fields are required", 400)
    }

    const user =await User.findByIdAndUpdate(
        req.user?._id, 
        {
            $set: {
                fullName,
                email
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async (req,res) => {
    const avatarLoccalPath = req.files?.path

    if(!avatarLoccalPath){
        throw new ApiError("Avatar is missing", 400)
    }

    const avatar = await uploadOnCloudinary(avatarLoccalPath)

    if(!avatar.url) {
        throw new ApiError("Error while uploading avatar", 400)
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200, user, "avatar updated successfully"))
})

const updateUserCoverImage = asyncHandler(async (req,res) => {
    const coverImageLocalPath = req.files?.path

    if(!coverImageLocalPath){
        throw new ApiError("Cover image is missing", 400)
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if(!coverImage.url) {
        throw new ApiError("Error while uploading avatar", 400)
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res.status(200)
    .json(new ApiResponse(200, user, "Cover image updated successfully"))
})

const getUserChannalProfile = asyncHandler(async (req,res) => {
    const {username} = req.params

    if(!username?.trim()){
        throw new ApiError("Username is required", 400)
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "sub",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "sub",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])



    if(!channel?.length){
        throw new ApiError("channel dose not found", 404)
    }

    return res.status(200)
    .json(new ApiResponse(200, channel[0], "Channel found successfully"))
})

const getWatchHistory = asyncHandler(async (req,res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchhistory",
                foreignField: "_id",
                as: "watchhistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                },
                                {
                                     $addFields: {
                                        owner:{
                                            $first: "$owner"
                                        }
                                     }
                                }

                            ]
                        }
                    }
                ]
            }
        }
        
    ])

    return res.status(200)
    .json(new ApiResponse(200, user[0].watchHistory, "Watch history found successfully"))
     

})




export { registerUser,
          loginUser, 
          logoutUser,
          refreshAccessToken, 
          changeCurrentPassword, 
          getCurrentUser,
          updateAccountDetails, 
          updateUserAvatar,
          updateUserCoverImage,
          getUserChannalProfile,
          getWatchHistory
    }