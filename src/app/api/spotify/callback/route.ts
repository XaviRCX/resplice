import { NextRequest, NextResponse } from "next/server";
import {
  loadPkce,
  clearPkce,
  exchangeCode,
  loadTokens,
} from "@/lib/spotify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const err = req.nextUrl.searchParams.get("error");

  if (err) {
    return new NextResponse(
      `<html><body style="font-family:sans-serif;background:#0c0a09;color:#f4ece2;padding:40px">
        <h2>Spotify: acesso negado</h2><p>${err}</p>
        <p>Feche esta aba e tente conectar de novo no app.</p></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (!code || !state) {
    return new NextResponse("Parametros ausentes.", { status: 400 });
  }

  const verifier = loadPkce(state);
  if (!verifier) {
    return new NextResponse(
      "State/SKCE invalido. Reinicie a conexao no app.",
      { status: 400 }
    );
  }
  clearPkce();

  try {
    const tokens = await exchangeCode(code, verifier);
    const name = tokens.user?.display_name ?? "voce";
    return new NextResponse(
      `<html><body style="font-family:sans-serif;background:#0c0a09;color:#f4ece2;padding:40px">
        <h2 style="color:#e0a44a">Resplice conectado ao Spotify</h2>
        <p>Ola, ${name}. Voce ja pode fechar esta aba e usar suas playlists no app.</p>
        <script>
          try {
            if (window.opener) {
              window.opener.postMessage({ type: "spotify-connected" }, "*");
            }
          } catch (e) {}
          setTimeout(function () { window.close(); }, 2500);
        </script></body></html>`,
      { headers: { "Content-Type": "text/html" } }
    );
  } catch (e: any) {
    return new NextResponse("Falha no token: " + e.message, { status: 500 });
  }
}
