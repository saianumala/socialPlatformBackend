import nodemailer from "nodemailer";
import prisma from "../db";
import { v4 as uuidv4 } from "uuid";

export async function sendEmail({
  emailType,
  userId,
}: {
  emailType: string;
  userId: string;
}) {
  const verifyToken = uuidv4();

  try {
    const user = await prisma.user.update({
      where: {
        userId,
      },
      data: {
        verifyToken: verifyToken,
        VerificationExpiry: Date.now() + 3600000,
      },
    });

    var transport = nodemailer.createTransport({
      host: "sandbox.smtp.mailtrap.io",
      port: 2525,
      auth: {
        user: "05d1d642efe4a4",
        pass: "9c0e3341ce4400",
      },
    });

    const mailSent = await transport.sendMail({
      from: "info@mailtrap.club",
      to: user?.email, // list of receivers
      subject:
        emailType === "VERIFY" ? "Verify your email" : "Reset your password",
      text:
        emailType === "VERIFY"
          ? `Hi ${user?.username}, Welcome to social platform.`
          : `Hi ${user?.username}, reset your password.`,
      html: `<p>Click <a href="http://localhost:5000/verifyemail/${verifyToken}">here</a> to ${
        emailType === "VERIFY" ? "verify your email" : "reset your password"
      }
                or copy and paste the link below in your browser. <br> ${
                  process.env.ORIGIN
                }/verifyemail/${verifyToken}
                </p>`,
    });
    return mailSent;
  } catch (error) {
    console.log("error while sending email:", error);
  }
}
