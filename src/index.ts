import express, { urlencoded } from "express";
import { postRouter, userRouter } from "./routes";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";

const app = express();
app.use(
  cors({
    credentials: true,
    origin: process.env.ORIGIN,
  })
);

app.use(urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use("/api/post", postRouter);
app.use("/api/user", userRouter);
app.get("/", (req, res) => {
  console.log(process.env.API_KEY);
  res.send("welcome to social media website");
});

app.listen(4000);
