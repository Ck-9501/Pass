import { google } from "googleapis";

export default async function handler(req: any, res: any) {
  try {
    const code = req.query.code;

    if (!code) {
      return res.status(400).send("Missing OAuth code.");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    return res.status(200).send(`
      <h2>Google Drive connected successfully.</h2>
      <p>Copy the refresh token below and add it to your Vercel environment variables.</p>
      <textarea style="width:100%;height:150px;">${tokens.refresh_token ?? ""}</textarea>
      <p>Keep this token private.</p>
    `);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Google Drive authentication failed.");
  }
}