import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import prisma from "../db";

export async function userAuthorization(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const accessToken = req.cookies.accessToken;
    // console.log(accessToken);
    // console.log(req);
    if (!accessToken) {
      throw new Error("please signin");
    }
    const verifiedToken = jwt.verify(
      accessToken,
      process.env.ACCESS_TOKEN_SECRET!
    ) as JwtPayload;
    // console.log(verifiedToken);
    const user = await prisma.user.findUnique({
      where: {
        userId: verifiedToken.user.userId,
      },
      select: {
        username: true,
        profilePictureURL: true,
        userId: true,
        email: true,
      },
    });
    if (!user) {
      throw new Error("user not found");
    }
    req.user = user;
    next();
  } catch (error: any) {
    // console.log(error);
    return res.status(403).json({ message: error.message, error: error });
  }
}
