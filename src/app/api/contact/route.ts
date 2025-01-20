import { NextResponse } from "next/server"
import nodemailer from "nodemailer"

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  try {
    const { name, email, message } = await req.json()

    // Validate input
    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error("Missing SMTP configuration")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    })

    // Verify SMTP connection configuration
    try {
      await transporter.verify()
      console.log("SMTP connection verified successfully")
    } catch (verifyError) {
      console.error("SMTP verification failed:", verifyError)
      return NextResponse.json(
        { error: "Failed to connect to mail server" },
        { status: 500 }
      )
    }

    try {
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: "vincit_amore@amore.build",
        subject: `Contact Form: Message from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <h3>Message:</h3>
          <p>${message.replace(/\n/g, "<br>")}</p>
        `,
      })
      console.log("Email sent successfully")
    } catch (sendError) {
      console.error("Failed to send email:", sendError)
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Contact form error:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
} 