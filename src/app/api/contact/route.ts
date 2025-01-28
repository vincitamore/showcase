import { NextResponse } from "next/server"
import { createTransport } from "nodemailer"
import { APIError, handleAPIError } from '@/lib/api-error'

// Force Node.js runtime and disable static optimization
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'iad1'

export async function POST(request: Request) {
  let parsedBody: { name?: string; email?: string; message?: string } = {}
  
  try {
    parsedBody = await request.json()
    const { name, email, message } = parsedBody

    // Validate required fields
    if (!name?.trim()) {
      throw new APIError(
        'Name is required',
        400,
        'MISSING_FIELD'
      )
    }
    if (!email?.trim()) {
      throw new APIError(
        'Email is required',
        400,
        'MISSING_FIELD'
      )
    }
    if (!message?.trim()) {
      throw new APIError(
        'Message is required',
        400,
        'MISSING_FIELD'
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new APIError(
        'Invalid email format',
        400,
        'INVALID_EMAIL'
      )
    }

    // Validate SMTP configuration
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
      throw new APIError(
        'SMTP configuration is incomplete',
        500,
        'SMTP_CONFIG_ERROR'
      )
    }

    const transporter = createTransport(smtpConfig)

    // Verify SMTP connection
    try {
      await transporter.verify()
    } catch (verifyError) {
      throw new APIError(
        `Failed to connect to mail server: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`,
        500,
        'SMTP_CONNECTION_ERROR'
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

    // Send email
    try {
      await transporter.sendMail(mailOptions)
      return NextResponse.json(
        { message: 'Message sent successfully' },
        { status: 200 }
      )
    } catch (sendError) {
      throw new APIError(
        `Failed to send email: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`,
        500,
        'EMAIL_SEND_ERROR'
      )
    }
  } catch (error) {
    return handleAPIError(error)
  }
} 