import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import 'dotenv/config'; // Requires dotenv to be installed, or run with --env-file
import crypto from 'crypto';

const r2Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

async function testR2Upload() {
  console.log("--- R2 Upload Test ---");
  console.log("Checking Environment Variables...");
  const requiredVars = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'];
  const domainVars = ['R2_PUBLIC_DOMAIN', 'NEXT_PUBLIC_R2_PUBLIC_DOMAIN'];
  
  for (const v of requiredVars) {
    if (!process.env[v]) {
      console.error(`❌ Missing: ${v}`);
    } else {
      console.log(`✅ ${v} is set`);
    }
  }

  const publicDomain = process.env.R2_PUBLIC_DOMAIN || process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN;
  if (!publicDomain) {
    console.error(`❌ Missing: R2_PUBLIC_DOMAIN or NEXT_PUBLIC_R2_PUBLIC_DOMAIN`);
  } else {
    console.log(`✅ Public domain is set: ${publicDomain}`);
  }

  const testUrl = "https://avatars.githubusercontent.com/u/1?v=4";
  const postId = "test-post-" + Date.now();
  
  console.log(`\nAttempting to upload: ${testUrl}`);
  console.log(`Using Post ID: ${postId}`);

  try {
    const response = await fetch(testUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get("content-type") || "image/jpeg";
    
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileName = `${year}/${month}/${postId}/${crypto.randomUUID()}.jpg`;

    console.log(`Destination Key: ${fileName}`);

    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const publicUrl = `${process.env.R2_PUBLIC_DOMAIN?.replace(/\/$/, "")}/${fileName}`;
    console.log(`\n🚀 SUCCESS! File uploaded.`);
    console.log(`Public URL: ${publicUrl}`);
    
  } catch (error) {
    console.error("\n❌ UPLOAD FAILED:");
    console.error(error);
  }
}

testR2Upload();
