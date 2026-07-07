const sendEmailNotification = async (action, data) => {
    console.log(`🎯 EMAIL SYSTEM TRIGGERED - Action: ${action}`, data);
    
    try {
        let emailTargets = [];
        
        switch (action) {
            case 'new_version_viewers_only':
                emailTargets = await getViewersForReportWorking(data.reportId, data.reportName);
                break;
            case 'version_updated':
                emailTargets = await getViewersForVersionUpdate(data.reportId, data.reportName, data.versionId);
                break;
            case 'new_report':
                emailTargets = await getAdminsForNewReportWorking(data.reportId, data.reportName);
                break;
            default:
                throw new Error(`Unknown email action: ${action}`);
        }

        if (emailTargets.length === 0) {
            console.warn('⚠️ NO EMAIL TARGETS FOUND - No emails will be sent');
            return { success: true, result: { emailsQueued: 0, message: 'No recipients found' } };
        }

        console.log('🚀 Sending emails via Netlify Background Function...');
        
        const apiResponse = await fetch('https://repodirectory.netlify.app/.netlify/functions/send-email-background', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emails: emailTargets })
        });
        
        // Background functions reply with an empty 202 the instant they're accepted —
        // the actual sending happens after this returns, so there's no count to read here.
        if (apiResponse.status === 202) {
            console.log(`✅ Email job accepted - ${emailTargets.length} emails queued`);
            alert(`✅ Sending ${emailTargets.length} notification(s) in the background. Check Netlify function logs in a minute to confirm delivery.`);
            return { success: true, result: { emailsQueued: emailTargets.length } };
        } else {
            const text = await apiResponse.text();
            console.error('❌ Unexpected response from email function:', apiResponse.status, text);
            alert(`❌ Email sending failed to start (status ${apiResponse.status}).`);
            return { success: false, error: text };
        }
        
    } catch (emailErr) {
        console.error('💥 COMPLETE EMAIL FAILURE:', emailErr);
        alert(`💥 Email Error: ${emailErr.message}`);
        return { success: false, error: emailErr };
    }
};
