import { asyncHandler } from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler( async (req,res) => {
    // res.status(200).json({
    //     message: "chai or backend"
    // })

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

export { registerUser }