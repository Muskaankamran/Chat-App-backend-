import ImageKit from '@imagekit/nodejs';

async function uploadFile(
  buffer,
  { fileName = `image${Date.now()}.jpg`, folder = "products" } = {},
) {
    if (!process.env.IMAGEKIT_PRIVATE_KEY) {
      throw new Error("IMAGEKIT_PRIVATE_KEY is not configured");
    }
    const client = new ImageKit({
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    });
    const response = await client.files.upload({
        file: buffer.toString("base64"),
        fileName,
        folder
      });
      return response
}
export default uploadFile