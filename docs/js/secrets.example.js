/**
 * Local secrets configuration - EXAMPLE FILE
 *
 * Instructions:
 * 1. Copy this file to secrets.js (in the same folder)
 * 2. Fill in your OneMap email and password
 * 3. (Optional) Add your Google Sheets Web App URL for data saving
 * 4. The app will automatically fetch and use your token
 *
 * Get your OneMap account at: https://www.onemap.gov.sg/apidocs/register
 *
 * For Google Sheets integration:
 * 1. Create a Google Sheet
 * 2. Go to Extensions → Apps Script
 * 3. Paste the doPost function from the README
 * 4. Deploy as Web App (Execute as: Me, Access: Anyone)
 * 5. Copy the deployment URL here
 */

export const SECRETS = {
  onemap: {
    email: "your-email@example.com",
    password: "your-password-here",
  },
  googleSheets: {
    webAppUrl: "",
  },
};
