import express, { Router } from "express";
import postRouter from "./postRoutes";
import userRouter from "./userRoutes";
const router = express.Router();

// router.use("/post", postRouter);

export { postRouter, userRouter };
