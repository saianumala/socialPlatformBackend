import express from "express";
import multer from "multer";
import cloudinary from "cloudinary";
import {
  cloudinaryDelete,
  cloudinaryUpload,
} from "../utils/cloudinaryUploader";
import prisma from "../db";
import { multerUpload } from "../utils/multerUploader";
import { userAuthorization } from "../middleware/cookieAuth";

const router = express.Router();

router.get("/followingUsersPosts", userAuthorization, async (req, res) => {
  const { username } = req.user;
  try {
    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
      select: {
        following: true,
        profilePicture: true,
        username: true,
      },
    });
    if (user && !user.following) {
      // write logic to exclude the login user posts
      const posts = await prisma.user.findMany();
      res.json({ loggedInUser: username, posts: posts });
    }
    // let authorIds:[] = [];
    // for (let i = 0; i < user?.following.length; i++) {
    //   if (user.following[i]) {
    //     authorIds.push({ authorId: user.following[i].userId });
    //   } else {
    //     continue;
    //   }
    // }
    const authornames =
      user?.following?.map((following) => following.followingUsername) || [];
    console.log("authorName's: ", authornames);
    const followingUserPosts = await prisma.post.findMany({
      where: {
        authorName: {
          in: authornames,
        },
      },
      include: {
        author: {
          select: {
            username: true,
            profilePicture: true,
          },
        },
      },
    });
    // for (let i = 0; i < followingUserPosts.length; i++) {
    //   console.log(new Date(followingUserPosts[i].createdAt));
    // }
    // console.log("followingUserPosts: ", followingUserPosts.sort((a,b)=> new Date(b.createdAt) - a.createdAt));
    res.json({ loggedInUser: username, posts: followingUserPosts }).status(200);
  } catch (error: any) {
    res.json({ message: error.message, error: error });
  }
});

router.post(
  "/newPost",
  userAuthorization,
  multerUpload.single("postFile"),
  async (req, res) => {
    try {
      // image or video to post, description , authorId
      const filePath = req.file?.path;
      const body = req.body;
      console.log("body", body);
      console.log("filePath", filePath);
      if (!filePath) {
        throw new Error("upload failed, please try again");
      }
      // console.log(req);
      const uploadResult = await cloudinaryUpload(filePath);
      console.log("upload Result", uploadResult);
      if (!uploadResult) {
        throw new Error("upload failed");
      }
      const user = await prisma.user.findUnique({
        where: {
          username: req.user.username,
        },
      });
      if (!user || !user.userId) {
        throw new Error("user is not logged in");
      }
      const newPost = await prisma.post.create({
        data: {
          image: uploadResult.url,
          authorName: user?.username,
          description: body.description,
        },
      });

      if (!newPost) {
        throw new Error("error while creating post");
      }
      res.json({ postDetails: newPost }).status(200);
      // get the url from upload result and store it along with other details in the database
    } catch (error: any) {
      res.json({ error: error.message }).status(400);
    }
  }
);

router.get("/singlePost/:postId", async (req, res) => {
  const { postId } = req.params;

  try {
    const post = await prisma.post.findUnique({
      where: {
        postId: postId,
      },
      include: {
        author: {
          select: {
            username: true,
            profilePicture: true,
          },
        },
        likes: true,
        comments: true,
      },
    });
    if (!post) {
      throw new Error("post not found");
    }
    res.status(200).json({ message: "success", post: post });
  } catch (error: any) {
    res.status(400).json({ message: "unable to fetch the post", error: error });
  }
});

router.patch(
  "/updatePost",
  userAuthorization,
  multerUpload.single("postFile"),
  async (req, res) => {
    let {
      description,
      loggedInUsername,
      postId,
    }: {
      description: string | null;
      loggedInUsername: string;
      postId: string;
    } = req.body;
    let updatedPost;

    try {
      const post = await prisma.post.findUnique({
        where: {
          postId: postId,
        },
      });
      if (!post) {
        throw new Error("post not found");
      }

      if (
        loggedInUsername !== req.user.username ||
        loggedInUsername !== post.authorName
      ) {
        throw new Error("you are not authorized to update this post");
      }
      console.log(description);

      if (description === "") {
        description = null;
      }
      if (req.file?.path) {
        const uploadResult = await cloudinaryUpload(req.file.path);
        updatedPost = await prisma.post.update({
          where: {
            postId: postId,
          },
          data: {
            image: uploadResult.url,
            description: description,
          },
        });
      } else {
        updatedPost = await prisma.post.update({
          where: {
            postId: postId,
          },
          data: {
            description: description,
          },
        });
      }

      res
        .json({
          message: "Post updated successfully",
          updatedPost: updatedPost,
        })
        .status(200);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }
);

router.delete("/deletePost", userAuthorization, async (req, res) => {
  const { postId, loggedInUsername } = req.body;

  try {
    const post = await prisma.post.findUnique({
      where: {
        postId: postId,
      },
    });
    if (!post) {
      throw new Error("post not found");
    }
    if (
      loggedInUsername !== req.user.username ||
      loggedInUsername !== post.authorName
    ) {
      throw new Error("you are not authorized to delete this post");
    }
    await cloudinaryDelete(post.image);

    await prisma.post.delete({
      where: {
        postId: postId,
      },
    });
    res.json({ message: "Post deleted" }).status(200);
  } catch (error: any) {
    if (error.code === "P2002") {
      // Handle Prisma error code for non-existent post
      res.status(404).json({ message: "Post not found" });
    } else {
      res.status(400).json({ message: "Error deleting post" });
    }
  }
});
router.get("/userPosts/:userName", userAuthorization, async (req, res) => {
  const { userName } = req.params;
  try {
    const userPosts = await prisma.post.findMany({
      where: {
        authorName: userName,
      },
      orderBy: {
        createdAt: "asc",
      },
    });
    res.json({ posts: userPosts }).status(200);
  } catch (error) {
    res.status(500).json({ message: "unable to fetch the posts" });
  }
});

router.get(
  "/getlike/:postId/:username",
  userAuthorization,
  async (req, res) => {
    console.log("reached  post like");
    const { postId, username } = req.params;
    console.log(username, postId);
    console.log(username, postId);
    try {
      const like = await prisma.like.findUnique({
        where: {
          likedByUsername_postId: {
            postId: postId,
            likedByUsername: username,
          },
        },
      });
      if (!like) {
        throw new Error("no entry exists");
      }
      res.status(200).json({ message: "success", like: like });
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: error });
    }
  }
);
router.get("/getLikes/:postId", userAuthorization, async (req, res) => {
  const { postId } = req.params;
  try {
    if (!postId) {
      throw new Error("invalid postId");
    }
    const likes = await prisma.like.findMany({
      where: {
        postId: postId,
      },
      include: {
        likedBy: {
          select: {
            profilePicture: true,
            username: true,
          },
        },
      },
    });
    if (!likes) {
      throw new Error("error while fetching likes");
    }
    res.status(200).json({ message: "success", likes: likes });
  } catch (error: any) {
    res.status(400).json({ message: error.message, error: error });
  }
});
router.post("/like", userAuthorization, async (req, res) => {
  const { postId } = req.body;
  console.log(postId);
  try {
    const post = await prisma.post.findUnique({
      where: { postId: postId },
    });

    if (!post) {
      return res.status(400).json({ message: "Post not found" });
    }
    await prisma.like.create({
      data: {
        likedByUsername: req?.user.username,
        postId: postId,
      },
    });
    res.status(200).json({ message: "liked " });
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(400).json({ message: "Already liked this post" });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

router.delete("/unlike", userAuthorization, async (req, res) => {
  const { postId } = req.body;
  try {
    const post = await prisma.post.findUnique({
      where: { postId: postId },
    });

    if (!post) {
      return res.status(400).json({ message: "Post not found" });
    }
    await prisma.like.delete({
      where: {
        likedByUsername_postId: {
          likedByUsername: req.user.username,
          postId: postId,
        },
      },
    });
    res.status(200).json({ message: "unlike successfull" });
  } catch (error: any) {
    res.status(400).json({ message: error.message, error: error });
  }
});
router.get(
  "/getUserComments/:postId/:username",
  userAuthorization,
  async (req, res) => {
    const { postId, username } = req.params;
    try {
      const comments = await prisma.comment.findMany({
        where: {
          commentedByUsername: username,
          postId: postId,
        },
      });
      if (!comments) {
        throw new Error("no entry exists");
      }
      res.status(200).json({ message: "success", comments: comments });
    } catch (error: any) {
      res.status(400).json({ message: error.message, error: error });
    }
  }
);
router.get("/getComments/:postId", userAuthorization, async (req, res) => {
  const { postId } = req.params;
  try {
    if (!postId) {
      throw new Error("invalid postId");
    }
    const comments = await prisma.comment.findMany({
      where: {
        postId: postId,
      },
      include: {
        commentedBy: {
          select: {
            profilePicture: true,
            username: true,
          },
        },
      },
    });
    if (!comments) {
      throw new Error("error while fetching comments");
    }
    res.status(200).json({ message: "success", comments: comments });
  } catch (error: any) {
    res.status(400).json({ message: error.message, error: error });
  }
});
router.post("/createComment", userAuthorization, async (req, res) => {
  const { postId, description }: { postId: string; description: string } =
    req.body;
  try {
    const post = await prisma.post.findUnique({
      where: { postId: postId },
    });

    if (!post) {
      return res.status(400).json({ message: "Post not found" });
    }
    await prisma.comment.create({
      data: {
        commentedByUsername: req?.user.username,
        postId: postId,
        commentDescription: description,
      },
    });
    res.status(200).json({ message: "commented successfully " });
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(400).json({ message: "Already commented to this post" });
    } else {
      res.status(400).json({ message: error.message });
    }
  }
});

router.patch("/updateComment", userAuthorization, async (req, res) => {
  const {
    postId,
    commentId,
    updatedDescription,
  }: { postId: string; commentId: string; updatedDescription: string } =
    req.body;
  try {
    console.log(req.body);
    console.log(commentId);
    console.log(updatedDescription);
    const post = await prisma.post.findUnique({
      where: {
        postId: postId,
      },
    });
    if (!post) {
      throw new Error("post not found");
    }
    const comment = await prisma.comment.findUnique({
      where: {
        commentId: commentId,
      },
    });
    if (!comment) {
      throw new Error("comment not found");
    }
    await prisma.comment.update({
      where: {
        commentId: comment.commentId,
      },

      data: {
        commentDescription: updatedDescription,
      },
    });
    res.status(200).json({ message: "success" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.delete("/deleteComment", userAuthorization, async (req, res) => {
  const { postId, commentId } = req.body;
  try {
    if (!postId) {
      throw new Error("invalid postId");
    }
    const post = await prisma.post.findUnique({
      where: { postId: postId },
    });

    if (!post) {
      return res.status(400).json({ message: "Post not found" });
    }
    await prisma.comment.delete({
      where: {
        commentId: commentId,
      },
    });
    res.status(200).json({ message: "commented deleted" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
