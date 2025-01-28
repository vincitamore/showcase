import { NextResponse } from "next/server"
import { createTransport } from "nodemailer"
import { APIError, handleAPIError } from '@/lib/api-error'
import { logger, withLogging } from '@/lib/logger'

// Force Node.js runtime and disable static optimization
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const preferredRegion = 'iad1'

async function handleContact(request: Request): Promise<Response> {
  let parsedBody: { name?: string; email?: string; message?: string } = {}
  
  try {
    logger.info('Processing contact form submission', {
      step: 'init',
      url: request.url
    })

    parsedBody = await request.json()
    const { name, email, message } = parsedBody

    logger.debug('Validating form fields', {
      step: 'validate-fields',
      hasName: !!name?.trim(),
      hasEmail: !!email?.trim(),
      hasMessage: !!message?.trim()
    })

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

    logger.debug('Validating email format', {
      step: 'validate-email',
      email
    })

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new APIError(
        'Invalid email format',
        400,
        'INVALID_EMAIL'
      )
    }

    logger.debug('Checking SMTP configuration', {
      step: 'check-smtp-config',
      hasHost: !!process.env.SMTP_HOST,
      hasPort: !!process.env.SMTP_PORT,
      hasUser: !!process.env.SMTP_USER,
      hasPass: !!process.env.SMTP_PASS
    })

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

    logger.info('Creating SMTP transport', {
      step: 'create-transport',
      host: smtpConfig.host,
      port: smtpConfig.port
    })

    const transporter = createTransport(smtpConfig)

    // Verify SMTP connection
    try {
      logger.debug('Verifying SMTP connection', {
        step: 'verify-connection'
      })

      await transporter.verify()
      
      logger.info('SMTP connection verified', {
        step: 'verify-success'
      })
    } catch (verifyError) {
      logger.error('SMTP verification failed', {
        step: 'verify-error',
        error: verifyError
      })

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
      logger.info('Sending email', {
        step: 'send-email',
        from: mailOptions.from,
        to: mailOptions.to,
        subject: mailOptions.subject
      })

      await transporter.sendMail(mailOptions)

      logger.info('Email sent successfully', {
        step: 'complete'
      })

      return NextResponse.json(
        { message: 'Message sent successfully' },
        { status: 200 }
      )
    } catch (sendError) {
      logger.error('Failed to send email', {
        step: 'send-error',
        error: sendError
      })

      throw new APIError(
        `Failed to send email: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`,
        500,
        'EMAIL_SEND_ERROR'
      )
    }
  } catch (error) {
    logger.error('Contact form submission failed', {
      step: 'error',
      error,
      parsedBody
    })

    return handleAPIError(error)
  }
}

export const POST = withLogging(handleContact, 'api/contact') 