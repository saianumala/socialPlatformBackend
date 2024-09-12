import { Router } from "express";
import { multerUploadMiddleware } from "../middleware/multerUploader";
import prisma from "../db";
import { z } from "zod";
import {
  cloudinaryDelete,
  cloudinaryUpload,
} from "../utils/cloudinaryUploader";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/mailer";
import { userAuthorization } from "../middleware/cookieAuth";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

const router = Router();

const userZodSchema = z.object({
  email: z.string(),
  username: z.string(),
  password: z.string().min(8),
});

async function hashPassword(password: string) {
  const hashedPassword = await bcryptjs.hash(password, 9);

  return hashedPassword;
}

router.get("/isLoggedIn", userAuthorization, async (req, res) => {
  try {
    console.log("is logged in being checked");

    res.status(200).json({ user: req.user });
  } catch (error: any) {
    // console.log(error);
    res.status(error.code).json({ message: error.message, user: req.user });
  }
});
// in signup, write logic to make  username unique
router.post("/signup", async (req, res) => {
  const userFields = userZodSchema.safeParse(req.body);

  try {
    if (!userFields.success) {
      throw new Error("all fields are required or password should be longer");
    }
    const username = userFields.data.username;
    const email = userFields.data.email;
    const password = userFields.data.password;
    if ([username, email, password].some((value) => value === "")) {
      throw new Error("all fields are required");
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: email }, { username: username }],
      },
      select: {
        username: true,
        email: true,
      },
    });

    if (user) {
      const existingField = user.username === username ? "username" : "email";
      throw new Error(
        existingField === "username"
          ? "username is taken"
          : "user with this email already exists"
      );
    }
    const newHashedPassword = await hashPassword(password);
    const verifyToken = uuidv4();

    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: newHashedPassword,
        profilePictureURL: process.env.DEFAULT_PIC || "",
        username: username,
        verifyToken: verifyToken,
        VerificationExpiry: Date.now() + 3600000,
      },
      select: {
        userId: true,
        email: true,
        profilePictureURL: true,
        username: true,
      },
    });

    if (!newUser) {
      throw new Error("error while creating user");
    }
    await sendEmail({
      emailType: "VERIFY",
      token: verifyToken,
      username: newUser.username,
      email: newUser.email,
    });

    res.status(200).json({ message: "signup successfull" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/verifyemail", async (req, res) => {
  const verificationToken = req.query.token;
  console.log(req.query);
  console.log("verificationToken", verificationToken);
  try {
    if (typeof verificationToken !== "string") {
      throw new Error("invalid token, please try logging in");
    }

    const user = await prisma.user.findFirst({
      where: {
        verifyToken: verificationToken,
      },
    });

    if (!user) {
      throw new Error("invalid token, please try logging in");
    }

    if (user?.VerificationExpiry && user.VerificationExpiry < Date.now()) {
      throw new Error("token expired,login again");
    }

    await prisma.user.update({
      where: {
        userId: user.userId,
      },
      data: {
        verifyToken: null,
        VerificationExpiry: null,
        isVerified: true,
      },
    });
    res
      .json({ message: "you have succesfully verified your email." })
      .status(200);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/signIn", async (req, res) => {
  const { email, password } = req.body;
  try {
    if ([email, password].some((value) => value === "")) {
      throw new Error("all fields are required");
    }
    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    if (!user) {
      throw new Error("no user exists with this email: " + email);
    }
    const isPasswordCorrect = await bcryptjs.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new Error("Incorrect Password");
    }
    if (!user.isVerified) {
      if (user.VerificationExpiry && user.VerificationExpiry < Date.now()) {
        const token = uuidv4();

        await prisma.user.update({
          where: {
            email: email,
          },
          data: {
            verifyToken: token,
            VerificationExpiry: Date.now() + 3600000,
          },
        });

        await sendEmail({
          emailType: "VERIFY",
          username: user.username,
          email: user.email,
          token: token,
        });
      } else {
        await sendEmail({
          emailType: "VERIFY",
          username: user.username,
          email: user.email,
          token: user.verifyToken || "",
        });
      }

      throw new Error("a verification mail has been sent to your email");
    }

    const token = jwt.sign(
      {
        user: {
          userId: user.userId,
          username: user.username,
          email: user.email,
        },
      },
      process.env.ACCESS_TOKEN_SECRET!,
      { expiresIn: Date.now() + 86400000 }
    );
    console.log("logged in");

    res
      .status(200)
      .cookie("accessToken", token, {
        sameSite: "lax",
        httpOnly: true,
        maxAge: 60 * 60 * 1000,
      })
      .json({
        message: "you are logged in",
        data: {
          username: user.username,
          profilePic: user.profilePictureURL,
          email: user.email,
          accessToken: token,
        },
      });
  } catch (error: any) {
    console.log("login failed");
    if (error instanceof Error) {
      return res.status(400).json({ message: error.message });
    } else {
      res.status(500).json({ message: error.message });
    }
  }
});

router.get("/signOut", userAuthorization, (req, res) => {
  res
    .status(200)
    .clearCookie("accessToken")
    .json({ message: "loggedOut successfully" });
});

router.patch(
  "/updateProfilepic",
  userAuthorization,
  multerUploadMiddleware("profilePic"),
  async (req, res) => {
    let {
      loggedInUsername,
    }: {
      loggedInUsername: string;
    } = req.body;

    try {
      if (req.file?.mimetype.split("/")[0] !== "image") {
        throw new Error("file type not supported");
      }
      if (loggedInUsername !== req.user.username) {
        throw new Error("unAuthorized user");
      }
      const user = await prisma.user.findUnique({
        where: {
          username: req.user.username,
        },
      });
      if (!user) {
        throw new Error("user not found");
      }
      if (user.profilePictureURL) {
        await cloudinaryDelete(user.profilePictureURL);
      }
      if (!req.file || !req.file.path) {
        throw new Error("update failed due to unsufficient data");
      }
      const cloudinaryUploadResponse = await cloudinaryUpload(
        req.file.path,
        req.file.fieldname,
        req.file.originalname
      );
      console.log(cloudinaryUploadResponse);

      await prisma.user.update({
        where: {
          username: user.username,
        },
        data: {
          profilePictureURL: cloudinaryUploadResponse.url,
        },
      });

      res.status(200).json({ message: "success" });
    } catch (error: any) {
      console.log(error);
      res.status(400).json({ message: error.message });
    }
  }
);

router.patch("/updateUsername", userAuthorization, async (req, res) => {
  const { username }: { username: string } = req.body;
  try {
    console.log(username);
    const existingUserWithUsername = await prisma.user.findUnique({
      where: {
        username: username,
      },
    });
    console.log(existingUserWithUsername);
    if (existingUserWithUsername) {
      throw new Error(`${username} is already taken`);
    }
    const user = await prisma.user.update({
      where: {
        username: req.user.username,
      },
      data: {
        username: username,
      },
    });
    if (!user) {
      throw new Error(`unable to change username`);
    }
    res.status(200).json({ message: "success" });
  } catch (error: any) {
    res.status(400).json({ message: error.message, error: error });
  }
});

router.patch("/updateEmail", userAuthorization, async (req, res) => {
  const { email }: { email: string } = req.body;
  try {
    const existingemail = await prisma.user.findUnique({
      where: {
        email: email,
      },
    });
    if (existingemail) {
      throw new Error(`${email} is already taken`);
    }
    const user = await prisma.user.update({
      where: {
        email: req.user.email,
      },
      data: {
        email: email,
      },
    });
    if (!user) {
      throw new Error(`unable to change email`);
    }
    res.status(200).json({ message: "success" });
  } catch (error: any) {
    res.status(400).json({ message: error.message, error: error });
  }
});

router.get("/passwordCheck/:password", userAuthorization, async (req, res) => {
  const { password } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: {
        userId: req.user.userId,
      },
    });
    if (!user) {
      throw new Error("user not found");
    }
    const isPasswordCorrect = await bcryptjs.compare(password, user.password);
    if (!isPasswordCorrect) {
      throw new Error("password incorrect");
    }
    res.status(200).json({ message: "success" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post("/sendresetlink", async (req, res) => {
  const { email } = req.body;
  console.log(email);
  try {
    const user = await prisma.user.findUnique({
      where: {
        email: email,
      },
      select: {
        email: true,
        username: true,
      },
    });
    if (!user) {
      throw new Error(`there is no user with this email`);
    }
    const passwordResetToken = uuidv4();
    await prisma.user.update({
      where: {
        email: email,
      },
      data: {
        passwordResetToken: passwordResetToken,
        passwordResetExpiry: Date.now() + 1200000,
      },
    });
    const ress = await sendEmail({
      emailType: "RESETPASSWORD",
      username: user.username,
      email: user.email,
      token: passwordResetToken,
    });
    console.log(ress);
    res.status(200).json({ message: "reset link sent" });
  } catch (error: any) {
    res.status(400).json({ message: error.message, error: error });
  }
});
router.patch("/resetPassword", async (req, res) => {
  const token = req.query.token;
  const { newPassword } = req.body;

  try {
    if (!token || typeof token !== "string") {
      throw new Error("require token to change the password");
    }
    const user = await prisma.user.findUnique({
      where: {
        passwordResetToken: token,
      },
    });
    if (!user) {
      throw new Error("invalid token");
    }
    if (user.passwordResetExpiry && user.passwordResetExpiry < Date.now()) {
      throw new Error("token expired, resend the link again");
    }
    if (newPassword.length < 8) {
      throw new Error("password should be atleast 8 characters");
    }
    const hashedPassword = await bcryptjs.hash(newPassword, 11);

    await prisma.user.update({
      where: {
        username: user.username,
      },
      data: {
        password: hashedPassword,
        passwordResetExpiry: null,
        passwordResetToken: null,
      },
    });

    res.status(200).json({ message: "success" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});
router.patch("/changePassword", userAuthorization, async (req, res) => {
  const { newPassword } = req.body;

  try {
    if (newPassword.length < 8) {
      throw new Error("password should be atleast 8 characters");
    }
    const hashedPassword = await bcryptjs.hash(newPassword, 11);

    await prisma.user.update({
      where: {
        username: req.user.username,
      },
      data: {
        password: hashedPassword,
      },
    });

    res.status(200).json({ message: "success" });
  } catch (error: any) {
    res.status(400).json({ message: error.message, error: error });
  }
});

router.get("/userSearch/:username", userAuthorization, async (req, res) => {
  const { username } = req.params;
  try {
    const users = await prisma.user.findMany({
      where: {
        username: {
          contains: username,
        },
      },
      select: {
        userId: true,
        username: true,
        profilePictureURL: true,
      },
    });
    if (!users) {
      throw new Error("no user found");
    }
    res.status(200).json({ users: users });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});
router.get("/profile/:username", userAuthorization, async (req, res) => {
  const { username } = req.params;
  console.log(username);
  try {
    const user = await prisma.user.findUnique({
      where: {
        username: username,
      },
      select: {
        followers: {
          select: {
            followedBy: {
              select: {
                profilePictureURL: true,
              },
            },
            followedByUsername: true,
            followId: true,
          },
        },
        following: {
          select: {
            following: {
              select: {
                profilePictureURL: true,
              },
            },
            followingUsername: true,
            followId: true,
          },
        },
        profilePictureURL: true,
        username: true,
        userId: true,
        posts: {
          include: {
            author: {
              select: {
                username: true,
                profilePictureURL: true,
              },
            },
          },
        },
      },
    });
    if (!user) {
      throw new Error("user not found");
    }
    res.status(200).json({ message: "user found", userData: user });
  } catch (error: any) {
    res.json({ error: error.message }).status(404);
  }
});

router.get("/loggedInUserProfile", userAuthorization, async (req, res) => {
  try {
    const loggedInuser = await prisma.user.findUnique({
      where: {
        userId: req.user.userId,
      },
      select: {
        followers: true,
        following: true,
      },
    });
    const userfollowers: string[] | null = loggedInuser
      ? loggedInuser.followers.map((follower) => follower.followedByUsername)
      : null;
    const userfollowing: string[] | null = loggedInuser
      ? loggedInuser.following.map((following) => following.followingUsername)
      : null;

    res.status(200).json({ user: req.user, userfollowers, userfollowing });
  } catch (error: any) {
    console.log(error);
    res.status(error.code).json({ message: error.message });
  }
});

router.post("/follow/:username", userAuthorization, async (req, res) => {
  const { username } = req.params;
  try {
    const toFollowUser = await prisma.user.findUnique({
      where: {
        username: username,
      },
      select: {
        userId: true,
        username: true,
      },
    });
    if (!toFollowUser) {
      throw new Error("user not found");
    }
    if (toFollowUser.username === req.user.username) {
      throw new Error("you cant follow yourself");
    }
    console.log(toFollowUser, req.user.username);
    const followResult = await prisma.follow.create({
      data: {
        followingUsername: toFollowUser.username,
        followedByUsername: req.user.username,
      },
    });
    console.log(followResult);
    res.status(200).json({ message: "following " });
  } catch (error: any) {
    console.log(error);
    res.status(400).json({ status: error.status, message: error.message });
  }
});

router.delete("/unfollow/:username", userAuthorization, async (req, res) => {
  const { username } = req.params;
  try {
    const toUnFollowUser = await prisma.user.findUnique({
      where: {
        username: username,
      },
      select: {
        userId: true,
        username: true,
      },
    });
    if (!toUnFollowUser) {
      throw new Error("user not found");
    }

    await prisma.follow.delete({
      where: {
        followedByUsername_followingUsername: {
          followingUsername: toUnFollowUser.username,
          followedByUsername: req.user.username,
        },
      },
    });
    res.status(200).json({ message: "unfollowed" });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get("/suggestions", userAuthorization, async (req, res) => {
  try {
    const userFollowing = await prisma.follow.findMany({
      where: {
        followedByUsername: req.user.username,
      },
      select: {
        followingUsername: true,
      },
    });
    if (!userFollowing) {
      throw new Error("not following anyone");
    }

    const users = await prisma.user.findMany({
      where: {
        username: {
          in: userFollowing.map((following) => following.followingUsername),
        },
      },
      select: {
        userId: true,
        username: true,
        profilePictureURL: true,
      },
    });
    res.status(200).json({ message: "success", data: users });
  } catch (error: any) {
    res.status(error.code).json({ message: "unSuccessfull" });
  }
});
router.get("/likes", userAuthorization, async (req, res) => {
  const userId = req.user.userId;

  const order = req.query.orderBy;
  const orderBy = order === "asc" || order === "desc" ? order : "desc";
  try {
    const userLikes = await prisma.like.findMany({
      where: {
        likedByUsername: req.user.username,
      },
      include: {
        post: {
          include: {
            author: {
              select: {
                username: true,
                profilePictureURL: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: orderBy,
      },
    });

    res.status(200).json({ message: "success", data: userLikes });
  } catch (error: any) {
    res.status(400).json({ message: error.message, error: error });
  }
});

router.get("/comments", userAuthorization, async (req, res) => {
  const userId = req.user.userId;
  const order = req.query.orderBy;
  const orderBy = order === "asc" || order === "desc" ? order : "desc";
  try {
    const userComments = await prisma.comment.findMany({
      where: {
        commentedByUsername: req.user.username,
      },
      include: {
        post: {
          include: {
            author: {
              select: {
                username: true,
                profilePictureURL: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: orderBy,
      },
    });

    if (!userComments) {
      throw new Error("user not found, try logging in again");
    }
    res.status(200).json({ message: "success", data: userComments });
  } catch (error: any) {
    res.status(400).json({ message: error.message, error: error });
  }
});

export default router;
