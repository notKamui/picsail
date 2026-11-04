import { deleteFileByCode } from '@/server/files/delete'
import { getFileMetadata } from '@/server/files/info'
import { listOwnedFiles } from '@/server/files/list'
import { getFileContent } from '@/server/files/public'
import { uploadImageForUser } from '@/server/files/upload'

export const router = {
  files: {
    list: listOwnedFiles,
    getMetadata: getFileMetadata,
    delete: deleteFileByCode,
    upload: uploadImageForUser,
    getContent: getFileContent,
  },
}
