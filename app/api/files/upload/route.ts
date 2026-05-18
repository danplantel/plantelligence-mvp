import {
  AWS_ACCESS_KEY_ID,
  AWS_REGION,
  AWS_SECRET_ACCESS_KEY,
  S3_BUCKET_NAME,
} from "@/constants/app";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dayjs from "dayjs";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { autoCropToSquare } from "@/lib/image-processing";
import {
  putObjectBuffer,
  buildUploadKey,
  isR2Configured,
} from "@/lib/r2";

const s3Client =
  AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY && S3_BUCKET_NAME
    ? new S3Client({
        region: AWS_REGION,
        credentials: {
          accessKeyId: AWS_ACCESS_KEY_ID,
          secretAccessKey: AWS_SECRET_ACCESS_KEY,
        },
      })
    : null;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const autoCrop = formData.get("autoCrop") !== "false";
    const cropSize = formData.get("cropSize")
      ? parseInt(formData.get("cropSize") as string)
      : 800;

    if (!file) {
      return NextResponse.json({ message: "File not found" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);
    let contentType = file.type || "image/png";

    if (autoCrop && file.type.startsWith("image/")) {
      try {
        buffer = await autoCropToSquare(buffer, cropSize);
        contentType = "image/jpeg";
      } catch (error) {
        console.warn("Failed to auto-crop image, using original:", error);
      }
    }

    if (isR2Configured()) {
      const fileName =
        file.name?.replace(/\W+/g, "-") || `upload-${Date.now()}.png`;
      const key = buildUploadKey({
        orgId: session.user.id,
        subPath: "uploads",
        fileName: `${dayjs().format("YYYY-MM-DD")}/${Date.now()}-${fileName}`,
      });
      const ok = await putObjectBuffer({
        key,
        body: buffer,
        contentType,
      });
      if (ok) {
        const url = `/api/r2/signed-url?key=${encodeURIComponent(key)}&redirect=1`;
        return NextResponse.json({
          message: "File uploaded successfully",
          url,
          key,
        });
      }
      return NextResponse.json(
        { message: "R2 upload failed" },
        { status: 500 },
      );
    }

    if (!s3Client || !S3_BUCKET_NAME) {
      return NextResponse.json(
        {
          message: "File upload not configured. Set R2 or S3 credentials.",
        },
        { status: 503 },
      );
    }

    const key = `${dayjs().format("YYYY-MM-DD")}/${Date.now()}-${file.name?.replace(/\W/g, "-")}`;
    await s3Client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    const fileUrl = `https://${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com/${key}`;
    return NextResponse.json({
      message: "File uploaded successfully",
      url: fileUrl,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { message: "Error uploading file" },
      { status: 500 },
    );
  }
}
