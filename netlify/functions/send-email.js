// netlify/functions/send-email.js - Brevo Version
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

    // Get Brevo API key from environment variables
    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    if (!BREVO_API_KEY) {
      console.error('❌ Brevo API key not found in environment variables');
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          success: false,
          error: 'Brevo API key not configured. Please add BREVO_API_KEY to environment variables.' 
        })
      };
    }

    console.log(`📧 Processing ${emails.length} emails via Brevo...`);

    const results = await Promise.all(
      emails.map(async (emailData, index) => {
        try {
          console.log(`📤 Sending email ${index + 1}/${emails.length} to: ${emailData.to}`);
          
          const response = await fetch('https://api.brevo.com/v3/smtp/email', {
            method: 'POST',
            headers: {
              'api-key': BREVO_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              sender: {
                name: 'Procurement Reports',
                email: 'proc.prism@gmail.com'
              },
              to: [{
                email: emailData.to
              }],
              subject: emailData.subject,
              htmlContent: emailData.html
            })
          });

          if (response.status === 201) { // Brevo success status
            const result = await response.json();
            console.log(`✅ Email ${index + 1} sent successfully to ${emailData.to}`);
            return {
              success: true,
              email: emailData.to,
              messageId: result.messageId || 'sent'
            };
          } else {
            const errorText = await response.text();
            console.error(`❌ Email ${index + 1} failed for ${emailData.to}:`, errorText);
            return {
              success: false,
              email: emailData.to,
              error: errorText || 'Brevo API error'
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

    console.log(`🎉 BREVO SUMMARY: ${successCount} successful, ${failureCount} failed`);

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
    console.error('💥 BREVO FUNCTION ERROR:', error);
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
