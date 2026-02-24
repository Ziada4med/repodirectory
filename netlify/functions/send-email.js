// netlify/functions/send-email.js - SendGrid Version
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

    const SENDGRID_API_KEY = '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';

    console.log(`📧 Processing ${emails.length} emails via SendGrid...`);

    const results = await Promise.all(
      emails.map(async (emailData, index) => {
        try {
          console.log(`📤 Sending email ${index + 1}/${emails.length} to: ${emailData.to}`);
          
          const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SENDGRID_API_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              personalizations: [{
                to: [{ email: emailData.to }],
                subject: emailData.subject
              }],
              from: { 
                email: 'ziad.ahmed@nesmapartners.com', 
                name: 'Procurement Reports' 
              },
              content: [{
                type: 'text/html',
                value: emailData.html
              }]
            })
          });

          if (response.status === 202) { // SendGrid success status
            console.log(`✅ Email ${index + 1} sent successfully to ${emailData.to}`);
            return {
              success: true,
              email: emailData.to,
              messageId: response.headers.get('x-message-id') || 'sent'
            };
          } else {
            const errorText = await response.text();
            console.error(`❌ Email ${index + 1} failed for ${emailData.to}:`, errorText);
            return {
              success: false,
              email: emailData.to,
              error: errorText || 'SendGrid API error'
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

    console.log(`🎉 SENDGRID SUMMARY: ${successCount} successful, ${failureCount} failed`);

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
    console.error('💥 SENDGRID FUNCTION ERROR:', error);
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
