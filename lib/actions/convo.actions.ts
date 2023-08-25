"use server";

import { revalidatePath } from "next/cache";

import { connectToDB } from "../mongoose";

import User from "../models/user.model";
import Convo from "../models/convo.model";
import Community from "../models/community.model";

export async function fetchPosts(pageNumber = 1, pageSize = 20) {
  connectToDB();

  // Calculate the number of posts to skip based on the page number and page size.
  const skipAmount = (pageNumber - 1) * pageSize;

  // Create a query to fetch the posts that have no parent (top-level threads) (a thread that is not a comment/reply).
  const postsQuery = Convo.find({ parentId: { $in: [null, undefined] } })
    .sort({ createdAt: "desc" })
    .skip(skipAmount)
    .limit(pageSize)
    .populate({
      path: "author",
      model: User,
    })
    .populate({
      path: "community",
      model: Community,
    })
    .populate({
      path: "children", // Populate the children field
      populate: {
        path: "author", // Populate the author field within children
        model: User,
        select: "_id name parentId image", // Select only _id and username fields of the author
      },
    });

  // Count the total number of top-level posts (convos) i.e., convos that are not comments.
  const totalPostsCount = await Convo.countDocuments({
    parentId: { $in: [null, undefined] },
  }); // Get the total count of posts

  const posts = await postsQuery.exec();

  const isNext = totalPostsCount > skipAmount + posts.length;

  return { posts, isNext };
}

interface Params {
  text: string,
  author: string,
  communityId: string | null,
  path: string,
}

export async function createConvo({ text, author, communityId, path }: Params
) {
  try {
    connectToDB();

    const communityIdObject = await Community.findOne(
      { id: communityId },
      { _id: 1 }
    );

    const createdConvo = await Convo.create({
      text,
      author,
      community: communityIdObject, // Assign communityId if provided, or leave it null for personal account
    });

    // Update User model
    await User.findByIdAndUpdate(author, {
      $push: { convos: createdConvo._id },
    });

    if (communityIdObject) {
      // Update Community model
      await Community.findByIdAndUpdate(communityIdObject, {
        $push: { convos: createdConvo._id },
      });
    }

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to create convo: ${error.message}`);
  }
}

async function fetchAllChildConvos(convoId: string): Promise<any[]> {
  const childConvos = await Convo.find({ parentId: convoId });

  const descendantConvos = [];
  for (const childConvo of childConvos) {
    const descendants = await fetchAllChildConvos(childConvo._id);
    descendantConvos.push(childConvo, ...descendants);
  }

  return descendantConvos;
}

export async function deleteConvo(id: string, path: string): Promise<void> {
  try {
    connectToDB();

    // Find the convo to be deleted (the main convo)
    const mainConvo = await Convo.findById(id).populate("author community");

    if (!mainConvo) {
      throw new Error("Convo not found");
    }

    // Fetch all child convos and their descendants recursively
    const descendantConvos = await fetchAllChildConvos(id);

    // Get all descendant Convo IDs including the main Convo ID and child Convo IDs
    const descendantConvoIds = [
      id,
      ...descendantConvos.map((convo) => convo._id),
    ];

    // Extract the authorIds and communityIds to update User and Community models respectively
    const uniqueAuthorIds = new Set(
      [
        ...descendantConvos.map((convo) => convo.author?._id?.toString()), // Use optional chaining to handle possible undefined values
        mainConvo.author?._id?.toString(),
      ].filter((id) => id !== undefined)
    );

    const uniqueCommunityIds = new Set(
      [
        ...descendantConvos.map((convo) => convo.community?._id?.toString()), // Use optional chaining to handle possible undefined values
        mainConvo.community?._id?.toString(),
      ].filter((id) => id !== undefined)
    );

    // Recursively delete child convos and their descendants
    await Convo.deleteMany({ _id: { $in: descendantConvoIds } });

    // Update User model
    await User.updateMany(
      { _id: { $in: Array.from(uniqueAuthorIds) } },
      { $pull: { convos: { $in: descendantConvoIds } } }
    );

    // Update Community model
    await Community.updateMany(
      { _id: { $in: Array.from(uniqueCommunityIds) } },
      { $pull: { convos: { $in: descendantConvoIds } } }
    );

    revalidatePath(path);
  } catch (error: any) {
    throw new Error(`Failed to delete convo: ${error.message}`);
  }
}

export async function fetchConvoById(convoId: string) {
  connectToDB();

  try {
    const convo = await Convo.findById(convoId)
      .populate({
        path: "author",
        model: User,
        select: "_id id name image",
      }) // Populate the author field with _id and username
      .populate({
        path: "community",
        model: Community,
        select: "_id id name image",
      }) // Populate the community field with _id and name
      .populate({
        path: "children", // Populate the children field
        populate: [
          {
            path: "author", // Populate the author field within children
            model: User,
            select: "_id id name parentId image", // Select only _id and username fields of the author
          },
          {
            path: "children", // Populate the children field within children
            model: Convo, // The model of the nested children (assuming it's the same "Thread" model)
            populate: {
              path: "author", // Populate the author field within nested children
              model: User,
              select: "_id id name parentId image", // Select only _id and username fields of the author
            },
          },
        ],
      })
      .exec();

    return convo;
  } catch (err) {
    console.error("Error while fetching convo:", err);
    throw new Error("Unable to fetch convo");
  }
}

export async function addCommentToConvo(
  convoId: string,
  commentText: string,
  userId: string,
  path: string
) {
  connectToDB();

  try {
    // Find the original convo by its ID
    const originalConvo = await Convo.findById(convoId);

    if (!originalConvo) {
      throw new Error("Convo not found");
    }

    // Create the new comment thread
    const commentConvo = new Convo({
      text: commentText,
      author: userId,
      parentId: convoId, // Set the parentId to the original convo's ID
    });

    // Save the comment convo to the database
    const savedCommentConvo = await commentConvo.save();

    // Add the comment convo's ID to the original thread's children array
    originalConvo.children.push(savedCommentConvo._id);

    // Save the updated original thread to the database
    await originalConvo.save();

    revalidatePath(path);
  } catch (err) {
    console.error("Error while adding comment:", err);
    throw new Error("Unable to add comment");
  }
}
