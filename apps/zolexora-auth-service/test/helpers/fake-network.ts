// Fake Cloudinary upload API and S3-compatible bucket for tests. Anything else goes to `passthrough`.
/** Objects stored by the fake S3 endpoint, keyed by URL path. */
export const fakeS3Objects = new Map<string, { contentType: string; size: number }>();

export function fakeFetch(passthrough?: typeof fetch) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.startsWith("https://s3.test/")) {
      const req = input instanceof Request ? input : new Request(url, init);
      if (!req.headers.get("authorization")?.startsWith("AWS4-HMAC-SHA256"))
        return new Response("unsigned", { status: 403 });
      const path = new URL(url).pathname;
      if (req.method === "PUT") {
        const body = await req.arrayBuffer();
        fakeS3Objects.set(path, {
          contentType: req.headers.get("content-type") ?? "",
          size: body.byteLength,
        });
        return new Response(null, { status: 200 });
      }
      if (req.method === "DELETE") {
        fakeS3Objects.delete(path);
        return new Response(null, { status: 204 });
      }
    }
    if (url.startsWith("https://api.cloudinary.com/")) {
      const form = init?.body as FormData;
      const publicId = String(form.get("public_id"));
      const file = form.get("file") as Blob;
      const format = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
      return Response.json({
        secure_url: `https://res.cloudinary.com/test-cloud/image/upload/f_auto,q_auto/${publicId}.${format}`,
        public_id: publicId,
        bytes: file.size,
        format,
        version: 1,
      });
    }
    if (passthrough) return passthrough(input, init);
    throw new Error(`Unexpected network call in tests: ${url}`);
  };
}
