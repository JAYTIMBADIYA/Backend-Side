import mongoose, { Schema } from "mongoose";

const subSchema = new Schema({
    subscriber: {
        type: Schema.Types.ObjectId, // one who is subscriber
        ref : "User"
    },
    channel : {
        type: Schema.Types.ObjectId, // one who is channel
        ref : "User"
    }
}, { timestamps: true })

export const Sub = mongoose.model("Sub", subSchema)