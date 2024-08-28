import mongoose, {Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
    {
        content: {
            type: String,
            require: true
        },
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
            require: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
            require: true
        }
    },
    {
        timestamps: true
    }
)

commentSchema.plugin(mongooseAggregatePaginate)

export const Comment = mongoose.model("Comment", commentSchema)
