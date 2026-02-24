// netlify/functions/send-email.js
const fetch = require('node-fetch');

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

    const RESEND_API_KEY = 're_Qt4wLve3_7nJXrrVyEjRm2ka85BUAghnT';

    console.log(`📧 Processing ${emails.length} emails...`);

    const results = await Promise.all(
      emails.map(async (emailData, index) => {
        try {
          console.log(`📤 Sending email ${index + 1}/${emails.length} to: ${emailData.to}`);
          
          const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${RESEND_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Procurement Reports <onboarding@resend.dev>',
              to: emailData.to,
              subject: emailData.subject,
              html: emailData.html
            })
          });

          const result = await response.json();
          
          if (response.ok) {
            console.log(`✅ Email ${index + 1} sent successfully to ${emailData.to}`);
            return {
              success: true,
              email: emailData.to,
              messageId: result.id || 'unknown'
            };
          } else {
            console.error(`❌ Email ${index + 1} failed for ${emailData.to}:`, result);
            return {
              success: false,
              email: emailData.to,
              error: result.message || 'Unknown error'
            };
          }
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

    console.log(`🎉 EMAIL SUMMARY: ${successCount} successful, ${failureCount} failed`);

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
    console.error('💥 NETLIFY FUNCTION ERROR:', error);
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
