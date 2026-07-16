import { promises as fs } from 'fs';
import path from 'path';

/**
 * Delete a file from the uploads directory
 * @param fileUrl - The file URL (e.g., "/uploads/stories/image.jpg")
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteUploadedFile(fileUrl: string | null | undefined): Promise<boolean> {
  if (!fileUrl) return false;

  try {
    // Extract the file path from the URL
    // Handle both full URLs and relative paths
    const urlPath = fileUrl.startsWith('http') 
      ? new URL(fileUrl).pathname 
      : fileUrl;

    // Remove leading slash and construct absolute path
    const relativePath = urlPath.startsWith('/') ? urlPath.slice(1) : urlPath;
    const filePath = path.join(process.cwd(), relativePath);

    // Check if file exists before attempting deletion
    try {
      await fs.access(filePath);
    } catch {
      console.warn(`File not found: ${filePath}`);
      return false;
    }

    // Delete the file
    await fs.unlink(filePath);
    console.log(`✅ Deleted file: ${filePath}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to delete file: ${fileUrl}`, error);
    return false;
  }
}

/**
 * Delete multiple files from the uploads directory
 * @param fileUrls - Array of file URLs
 * @returns Number of files successfully deleted
 */
export async function deleteUploadedFiles(fileUrls: (string | null | undefined)[]): Promise<number> {
  const validUrls = fileUrls.filter((url): url is string => !!url);
  const results = await Promise.all(validUrls.map(url => deleteUploadedFile(url)));
  const deletedCount = results.filter(Boolean).length;
  
  console.log(`Deleted ${deletedCount} of ${validUrls.length} files`);
  return deletedCount;
}
