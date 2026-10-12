import QRCode from 'qrcode';

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url') ?? '';
  if (!/^https?:\/\//.test(url) || url.length > 300) return new Response('bad url', {status: 400});
  const svg = await QRCode.toString(url, {type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: {dark: '#1E1E1E', light: '#FFFFFF00'}});
  return new Response(svg, {headers: {'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=3600'}});
}
