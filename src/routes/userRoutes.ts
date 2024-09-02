import { Router } from "express";
import { multerUpload } from "../utils/multerUploader";
import prisma from "../db";
import { string, z } from "zod";
import {
  cloudinaryDelete,
  cloudinaryUpload,
} from "../utils/cloudinaryUploader";
import bcryptjs from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendEmail } from "../utils/mailer";
import { userAuthorization } from "../middleware/cookieAuth";
import fs from "fs";

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

    const newUser = await prisma.user.create({
      data: {
        email: email,
        password: newHashedPassword,
        profilePicture: process.env.DEFAULT_PIC,
        username: username,
      },
      select: {
        userId: true,
        email: true,
        profilePicture: true,
        username: true,
      },
    });

    if (!newUser) {
      throw new Error("error while creating user");
    }
    await sendEmail({ emailType: "VERIFY", userId: newUser.userId });

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
      const res = await sendEmail({ emailType: "VERIFY", userId: user.userId });

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
          profilePic: user.profilePicture,
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
  multerUpload.single("profilePic"),
  async (req, res) => {
    let {
      loggedInUsername,
    }: {
      loggedInUsername: string;
    } = req.body;

    const filePath = req.file?.path;
    console.log("filePath", filePath);
    try {
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
      if (user.profilePicture) {
        await cloudinaryDelete(user.profilePicture);
      }
      if (!filePath) {
        throw new Error("update failed due to unsufficient data");
      }
      const cloudinaryUploadResponse = await cloudinaryUpload(filePath);
      console.log(cloudinaryUploadResponse);

      await prisma.user.update({
        where: {
          username: user.username,
        },
        data: {
          profilePicture: cloudinaryUploadResponse.url,
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
    const existingUsername = await prisma.user.findUnique({
      where: {
        username: req.user.username,
      },
    });
    if (existingUsername) {
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
        email: req.user.email,
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

router.patch("/changePassword", userAuthorization, async (req, res) => {
  const { newPassword } = req.body;

  try {
    const hashedPassword = await bcryptjs.hash(newPassword, 11);
    const passwordChange = await prisma.user.update({
      where: {
        username: req.user.username,
      },
      data: {
        password: hashedPassword,
      },
    });
    if (!passwordChange) {
      throw new Error("unable to change password");
    }
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
        profilePicture: true,
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
                profilePicture: true,
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
                profilePicture: true,
              },
            },
            followingUsername: true,
            followId: true,
          },
        },
        profilePicture: true,
        username: true,
        userId: true,
        posts: {
          include: {
            author: {
              select: {
                username: true,
                profilePicture: true,
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
        profilePicture: true,
      },
    });
    res.status(200).json({ message: "success", data: users });
  } catch (error: any) {
    res.status(error.code).json({ message: "unSuccessfull" });
  }
});

export default router;
