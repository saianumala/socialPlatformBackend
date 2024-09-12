import nodemailer from "nodemailer";
import prisma from "../db";

export async function sendEmail({
  emailType,
  email,
  username,
  token,
}: {
  emailType: "VERIFY" | "RESETPASSWORD";
  email: string;
  username: string;
  token: string;
}) {
  try {
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
      to: email, // list of receivers
      subject:
        emailType === "VERIFY" ? "Verify your email" : "Reset your password",
      text:
        emailType === "VERIFY"
          ? `Hi ${username}, Welcome to social platform.`
          : `Hi ${username}, reset your password.`,
      html:
        emailType === "VERIFY"
          ? `
      <div>
        <p>
        Click <a href="http://localhost:5000/verifyemail/${token}">here</a> to verify your email
        or copy and paste the link below in your browser. <br> ${process.env.ORIGIN}/verifyemail/${token}
        </p>
      </div>`
          : `
      <div>
        <p>
        Click <a href="http://localhost:5000/account/passwordreset/confirm?token=${token}">here</a> to reset your password
        or copy and paste the link below in your browser. <br> ${process.env.ORIGIN}/password/reset?token=${token}
        </p>
      </div>`,
    });
    return mailSent;
  } catch (error) {
    console.log("error while sending email:", error);
  }
}
