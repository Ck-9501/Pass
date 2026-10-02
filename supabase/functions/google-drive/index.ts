// supabase/functions/google-drive/index.ts

type Env = {
  get(name: string): string | undefined;
};

type Runtime = typeof globalThis & {
  Deno?: {
    env: Env;
  };
};

function getEnv(name: string): string | undefined {
  const runtime = globalThis as Runtime;
  return runtime.Deno?.env?.get(name);
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":
    "GET, POST, OPTIONS",
};

function jsonResponse(
  data: unknown,
  status = 200,
): Response {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/json",
      },
    },
  );
}

async function handleRequest(
  req: Request,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  const url = new URL(req.url);

  let body: Record<string, unknown> = {};

  if (req.method === "POST") {
    try {
      body = (await req.json()) as Record<
        string,
        unknown
      >;
    } catch {
      body = {};
    }
  }

  const action =
    url.searchParams.get("action") ??
    (body.action as string | undefined);

  // =====================================================
  // GOOGLE OAUTH
  // =====================================================

  if (action === "auth") {
    const clientId =
      getEnv("GOOGLE_CLIENT_ID");

    const redirectUri =
      getEnv("GOOGLE_REDIRECT_URI");

    if (!clientId || !redirectUri) {
      return jsonResponse(
        {
          error:
            "Missing Google OAuth configuration.",
        },
        500,
      );
    }

    const googleUrl = new URL(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );

    googleUrl.searchParams.set(
      "client_id",
      clientId,
    );

    googleUrl.searchParams.set(
      "redirect_uri",
      redirectUri,
    );

    googleUrl.searchParams.set(
      "response_type",
      "code",
    );

    googleUrl.searchParams.set(
      "scope",
      "https://www.googleapis.com/auth/drive.file",
    );

    googleUrl.searchParams.set(
      "access_type",
      "offline",
    );

    googleUrl.searchParams.set(
      "prompt",
      "consent",
    );

    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location:
          googleUrl.toString(),
      },
    });
  }

  // =====================================================
  // GOOGLE OAUTH CALLBACK
  // =====================================================

  if (action === "callback") {
    const code =
      url.searchParams.get("code");

    if (!code) {
      return new Response(
        "Missing authorization code.",
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "text/plain",
          },
        },
      );
    }

    const clientId =
      getEnv("GOOGLE_CLIENT_ID");

    const clientSecret =
      getEnv("GOOGLE_CLIENT_SECRET");

    const redirectUri =
      getEnv("GOOGLE_REDIRECT_URI");

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      return new Response(
        "Missing Google OAuth secrets.",
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "text/plain",
          },
        },
      );
    }

    const tokenResponse =
      await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret:
              clientSecret,
            redirect_uri:
              redirectUri,
            grant_type:
              "authorization_code",
          }),
        },
      );

    const tokenData =
      await tokenResponse.json();

    if (!tokenResponse.ok) {
      return new Response(
        JSON.stringify(tokenData),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type":
              "application/json",
          },
        },
      );
    }

    return new Response(
      `
      <html>
        <body style="font-family:Arial;padding:30px">
          <h2>Google Drive Connected Successfully</h2>
          <p>Your OAuth connection is working.</p>
          <p>Do not expose your refresh token publicly.</p>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type":
            "text/html",
        },
      },
    );
  }

  // =====================================================
  // GOOGLE DRIVE UPLOAD
  // =====================================================

  if (action === "upload") {
    try {
      const fileName =
        body.fileName as string | undefined;

      const pdfBase64 =
        body.pdfBase64 as
          | string
          | undefined;

      if (!fileName || !pdfBase64) {
        return jsonResponse(
          {
            success: false,
            error:
              "fileName and pdfBase64 are required.",
          },
          400,
        );
      }

      const clientId =
        getEnv("GOOGLE_CLIENT_ID");

      const clientSecret =
        getEnv(
          "GOOGLE_CLIENT_SECRET",
        );

      const refreshToken =
        getEnv(
          "GOOGLE_REFRESH_TOKEN",
        );

      const folderId =
        getEnv(
          "GOOGLE_DRIVE_FOLDER_ID",
        );

      if (
        !clientId ||
        !clientSecret ||
        !refreshToken ||
        !folderId
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Missing Google Drive secrets.",
          },
          500,
        );
      }

      // -------------------------------------------------
      // Get Google access token
      // -------------------------------------------------

      const tokenResponse =
        await fetch(
          "https://oauth2.googleapis.com/token",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: clientId,
              client_secret:
                clientSecret,
              refresh_token:
                refreshToken,
              grant_type:
                "refresh_token",
            }),
          },
        );

      const tokenData =
        await tokenResponse.json();

      if (
        !tokenResponse.ok ||
        !tokenData.access_token
      ) {
        return jsonResponse(
          {
            success: false,
            error:
              "Could not obtain Google access token.",
          },
          500,
        );
      }

      const accessToken =
        tokenData.access_token as string;

      // -------------------------------------------------
      // Decode PDF
      // -------------------------------------------------

      const cleanBase64 =
        pdfBase64.includes(",")
          ? pdfBase64
              .split(",")
              .pop()!
          : pdfBase64;

      const binary =
        atob(cleanBase64);

      const bytes =
        new Uint8Array(
          binary.length,
        );

      for (
        let i = 0;
        i < binary.length;
        i++
      ) {
        bytes[i] =
          binary.charCodeAt(i);
      }

      const pdfBlob =
        new Blob(
          [bytes],
          {
            type:
              "application/pdf",
          },
        );

      // -------------------------------------------------
      // Drive metadata
      // -------------------------------------------------

      const metadata = {
        name: fileName,
        parents: [folderId],
        mimeType:
          "application/pdf",
      };

      // -------------------------------------------------
      // Multipart upload
      // -------------------------------------------------

      const form =
        new FormData();

      form.append(
        "metadata",
        new Blob(
          [
            JSON.stringify(
              metadata,
            ),
          ],
          {
            type:
              "application/json",
          },
        ),
      );

      form.append(
        "file",
        pdfBlob,
        fileName,
      );

      const uploadResponse =
        await fetch(
          "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
            body: form,
          },
        );

      const uploadData =
        await uploadResponse.json();

      if (!uploadResponse.ok) {
        return jsonResponse(
          {
            success: false,
            error:
              "Google Drive upload failed.",
            details:
              uploadData,
          },
          500,
        );
      }

      return jsonResponse({
        success: true,
        fileId:
          uploadData.id,
        fileName:
          uploadData.name,
      });
    } catch (error) {
      console.error(
        "Google Drive error:",
        error,
      );

      return jsonResponse(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown error.",
        },
        500,
      );
    }
  }

  return jsonResponse(
    {
      success: false,
      error:
        "Invalid action.",
    },
    400,
  );
}

// =========================================================
// SUPABASE EDGE FUNCTION RUNTIME
// =========================================================
//
// This is intentionally accessed through globalThis so
// normal VS Code TypeScript checking does not complain
// about the Deno global.
//
// Supabase runs this function inside the Deno runtime.

const runtime =
  globalThis as typeof globalThis & {
    Deno?: {
      serve?: (
        handler: (
          req: Request,
        ) => Promise<Response>,
      ) => void;
    };
  };

if (runtime.Deno?.serve) {
  runtime.Deno.serve(
    handleRequest,
  );
}