import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  private transporter = nodemailer.createTransport({
    service: 'gmail', // or use host, port, secure manually
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  async sendMail(options: { to: string; subject: string; text: string }) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.transporter.sendMail({
        from: process.env.MAIL_USER,
        to: options.to,
        subject: options.subject,
        text: options.text,
      });
      console.log(`✅ Email sent to ${options.to}`);
    } catch (err) {
      console.error('❌ Error sending email:', err);
      throw err;
    }
  }

  async sendVerificationEmail(email: string, code: string) {
    const subject = 'Your verification code';
    const text = `Your verification code is ${code}`;
    await this.sendMail({ to: email, subject, text });
  }
}
