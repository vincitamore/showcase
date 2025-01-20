import { NextResponse } from "next/server"
import { createTransport } from "nodemailer"

// Force Node.js runtime and disable static optimization
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'iad1'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, email, message } = body

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: 'Name, email, and message are required' },
        { status: 400 }
      )
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    const smtpConfig = {
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
    }

    if (!smtpConfig.host || !smtpConfig.port || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      console.error("Missing SMTP configuration")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const transporter = createTransport(smtpConfig)

    try {
      await transporter.verify()
    } catch (verifyError) {
      console.error("SMTP verification failed:", verifyError)
      return NextResponse.json(
        { error: "Failed to connect to mail server" },
        { status: 500 }
      )
    }

    const mailOptions = {
      from: smtpConfig.auth.user,
      to: "vincit_amore@amore.build",
      subject: `Contact Form: Message from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <h3>Message:</h3>
        <p>${message.replace(/\n/g, "<br>")}</p>
      `
    }

    try {
      await transporter.sendMail(mailOptions)
      return NextResponse.json(
        { message: 'Message sent successfully' },
        { status: 200 }
      )
    } catch (sendError) {
      console.error("Failed to send email:", sendError)
      return NextResponse.json(
        { error: "Failed to send email" },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Contact form error:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
} 