// netlify/functions/send-email.js - Gmail SMTP Version (Sequential Sending)
const nodemailer = require('nodemailer');

// Small delay between emails to avoid Gmail throttling
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

    // Create Gmail SMTP transporter with connection pooling
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      pool: true,           // Use connection pool to reuse connections
      maxConnections: 1,    // Force single connection — prevents concurrent send throttling
      maxMessages: 100,     // Max messages per connection before reconnecting
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
      }
    });

    console.log(`📧 Processing ${emails.length} emails via Gmail SMTP (sequential)...`);

    const results = [];

    // Send emails one by one with a small gap between each
    for (let index = 0; index < emails.length; index++) {
      const emailData = emails[index];

      try {
        console.log(`📤 Sending email ${index + 1}/${emails.length} to: ${emailData.to}`);

        const info = await transporter.sendMail({
          from: `"Procurement Reports" <${GMAIL_USER}>`,
          to: emailData.to,
          subject: emailData.subject,
          html: emailData.html
        });

        console.log(`✅ Email ${index + 1} sent successfully to ${emailData.to} — MessageId: ${info.messageId}`);
        results.push({
          success: true,
          email: emailData.to,
          messageId: info.messageId
        });

      } catch (emailError) {
        console.error(`💥 Email ${index + 1} failed for ${emailData.to}:`, emailError.message);
        results.push({
          success: false,
          email: emailData.to,
          error: emailError.message
        });
      }

      // Wait 300ms between each email to stay well within Gmail's rate limits
      if (index < emails.length - 1) {
        await delay(300);
      }
    }

    // Close the transporter pool cleanly
    transporter.close();

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`🎉 GMAIL SUMMARY: ${successCount} successful, ${failureCount} failed`);

    if (failureCount > 0) {
      console.log('❌ Failed emails:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`   - ${r.email}: ${r.error}`);
      });
    }

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
