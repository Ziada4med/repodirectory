// netlify/functions/send-email.js - Gmail SMTP Version
const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { emails } = JSON.parse(event.body);

    if (!emails || !Array.isArray(emails)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid email data' })
      };
    }

    // Get Gmail credentials from environment variables
    const GMAIL_USER = process.env.GMAIL_USER;
    const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      console.error('❌ Gmail credentials not found in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          success: false,
          error: 'Gmail credentials not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD to environment variables.'
        })
      };
    }

    // Create Gmail SMTP transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
      }
    });

    console.log(`📧 Processing ${emails.length} emails via Gmail SMTP...`);

    const results = await Promise.all(
      emails.map(async (emailData, index) => {
        try {
          console.log(`📤 Sending email ${index + 1}/${emails.length} to: ${emailData.to}`);

          const info = await transporter.sendMail({
            from: `"Procurement Reports" <${GMAIL_USER}>`,
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html
          });

          console.log(`✅ Email ${index + 1} sent successfully to ${emailData.to} — MessageId: ${info.messageId}`);
          return {
            success: true,
            email: emailData.to,
            messageId: info.messageId
          };

        } catch (emailError) {
          console.error(`💥 Email ${index + 1} crashed for ${emailData.to}:`, emailError);
          return {
            success: false,
            email: emailData.to,
            error: emailError.message
          };
        }
      })
    );

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`🎉 GMAIL SUMMARY: ${successCount} successful, ${failureCount} failed`);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        emailsSent: successCount,
        totalEmails: emails.length,
        results: results,
        summary: {
          successful: results.filter(r => r.success),
          failed: results.filter(r => !r.success)
        }
      })
    };

  } catch (error) {
    console.error('💥 GMAIL FUNCTION ERROR:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        success: false,
        error: error.message,
        details: 'Check Netlify function logs for more details'
      })
    };
  }
};
