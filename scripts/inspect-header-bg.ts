import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import {
  R2_ACCESS_KEY_ID,
  R2_BUCKET,
  R2_ENDPOINT,
  R2_SECRET_ACCESS_KEY,
} from "../constants/app";

const KEY =
  "org/6a7886bcf8afdab7df945812/uploads/advisor/background/1786284186987-image_cropped-png";

function pngDims(buf: Buffer) {
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return "?";
  return `${buf.readUInt32BE(16)}x${buf.readUInt32BE(20)}`;
}

function jpegDims(buf: Buffer) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xd8 || marker === 0xff) { i += 2; continue; }
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return `${buf.readUInt16BE(i + 7)}x${buf.readUInt16BE(i + 5)}`;
    }
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return "?";
}

async function main() {
  const client = new S3Client({
    region: "auto",
    endpoint: R2_ENDPOINT,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    forcePathStyle: true,
  });
  console.log("key:", KEY);
  const res = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: KEY }));
  console.log("ContentType:", res.ContentType);
  console.log("ContentLength:", res.ContentLength);
  const body = await res.Body?.transformToByteArray();
  if (body) {
    const buf = Buffer.from(body);
    console.log("bytes:", buf.length);
    const dims = KEY.endsWith("png") ? pngDims(buf) : jpegDims(buf);
    console.log("dims:", dims);
    console.log("head hex:", buf.slice(0, 24).toString("hex"));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
