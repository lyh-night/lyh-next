-- CreateTable
CREATE TABLE "FileWorkspace" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '上传的文件夹',
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileWorkspace_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileWorkspace_userId_expiresAt_idx" ON "FileWorkspace"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "FileWorkspace" ADD CONSTRAINT "FileWorkspace_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
